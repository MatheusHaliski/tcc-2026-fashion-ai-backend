"""Medidas do corpo na GPU (SAM 3D Body): contrato, roteamento na T4 compartilhada e integridade dos pesos.

Dublês explícitos no lugar do modelo; a geometria usa o corpo sintético de test_body_measure. Nada aqui afirma
acurácia do modelo treinado.
"""
import base64
import hashlib
import json
import os
from types import SimpleNamespace
from unittest.mock import patch
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from services.anatomical_vton import sam3d_download
from services.anatomical_vton.google_cloud import VertexPredictionClient
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.sam3d_runtime import FashnWithBodyRuntime,dinov3_hub_load,full_body_box,measure_photo
from services.anatomical_vton.tests.test_body_measure import body
from services.anatomical_vton.vertex_runtime.server import create_app

SIZE=(400,800)


def evidence(people=1,score=.9,ankle_score=.9):
    boxes=np.tile([[100.,40.,300.,780.]],(people,1))
    points=np.tile(np.linspace([150,60],[250,760],134)[None],(people,1,1))
    scores=np.full((people,134),score);scores[:,[10,13]]=ankle_score
    return boxes,points,scores


def test_full_body_box_needs_one_person_seen_from_head_to_ankles():
    assert full_body_box(evidence(),SIZE).tolist()==[[100,40,300,780]]
    with pytest.raises(AlignmentError,match='EXACTLY_ONE_PERSON'):full_body_box(evidence(people=0),SIZE)
    with pytest.raises(AlignmentError,match='EXACTLY_ONE_PERSON'):full_body_box(evidence(people=2),SIZE)
    with pytest.raises(AlignmentError,match='FULL_BODY_NOT_VISIBLE'):full_body_box(evidence(ankle_score=.2),SIZE)
    boxes,points,scores=evidence();points[0,13]=[150,900]
    with pytest.raises(AlignmentError,match='OUTSIDE_IMAGE'):full_body_box((boxes,points,scores),SIZE)
    boxes,points,scores=evidence();points[0,0]=np.nan
    with pytest.raises(AlignmentError,match='NONFINITE'):full_body_box((boxes,points,scores),SIZE)


def test_photo_becomes_only_proportions_never_mesh_or_points():
    vertices,keypoints=body();calls=[]
    def reconstruct(rgb,box):
        calls.append(box.tolist())
        return [{'pred_vertices':vertices,'pred_keypoints_3d':keypoints,'pred_cam_t':np.zeros(3)}]
    out=measure_photo(np.zeros((800,400,3),np.uint8),lambda rgb:evidence(),reconstruct)
    assert calls==[[[100,40,300,780]]]
    assert set(out)=={'ratios','refused','warnings'}
    assert out['ratios']['waistW']==pytest.approx(0.27/1.70,abs=0.006) and out['refused']=={}


def test_photo_refusals_reach_the_app_as_short_codes():
    rgb=np.zeros((800,400,3),np.uint8)
    with pytest.raises(AlignmentError,match='^FULL_BODY_NOT_VISIBLE$'):
        measure_photo(rgb,lambda _:evidence(ankle_score=0),lambda *_:pytest.fail('GPU must not run'))
    with pytest.raises(AlignmentError,match='^ONE_BODY_RECONSTRUCTION_REQUIRED$'):measure_photo(rgb,lambda _:evidence(),lambda *_:[])
    with pytest.raises(AlignmentError,match='^INVALID_BODY_MESH$'):
        measure_photo(rgb,lambda _:evidence(),lambda *_:[{'pred_vertices':np.zeros((3,3)),'pred_keypoints_3d':np.zeros((70,3))}])


def test_backbone_code_comes_from_the_pinned_checkout_without_network_or_pretrained_weights():
    built=[]
    backbones=SimpleNamespace(dinov3_vith16plus=lambda **kwargs:built.append(kwargs) or 'BACKBONE')
    load=dinov3_hub_load(backbones)
    assert load('facebookresearch/dinov3','dinov3_vith16plus',source='github',pretrained=False,drop_path=.1)=='BACKBONE'
    assert built==[{'pretrained':False,'drop_path':.1}]
    for repo,name,kwargs,code in (('attacker/dinov3','dinov3_vith16plus',{'pretrained':False},'UNEXPECTED_TORCH_HUB'),
                                  ('facebookresearch/dinov3','dinov3_vith16plus',{},'PRETRAINED_DOWNLOAD_FORBIDDEN'),
                                  ('facebookresearch/dinov3','os_system',{'pretrained':False},'UNKNOWN_DINOV3')):
        with pytest.raises(AlignmentError,match=code):load(repo,name,**kwargs)


class Fake:
    ready=True
    def __init__(self,fail=()):self.calls=[];self.fail=list(fail);self.unloaded=False
    def predict(self,instance):
        self.calls.append(instance['task'])
        if self.fail:raise AlignmentError(self.fail.pop(0))
        return {'task':instance['task']}
    def unload(self):self.unloaded=True


def test_shared_t4_loads_body_model_once_on_demand_and_routes_each_task():
    fashn=Fake();bodies=[]
    runtime=FashnWithBodyRuntime(fashn,lambda:bodies.append(Fake()) or bodies[-1])
    assert runtime.tasks==('virtual_try_on','body_measurement') and runtime.ready
    assert runtime.predict({'task':'virtual_try_on'})=={'task':'virtual_try_on'} and bodies==[]
    for _ in range(2):assert runtime.predict({'task':'body_measurement'})=={'task':'body_measurement'}
    assert len(bodies)==1 and bodies[0].calls==['body_measurement']*2


def test_try_on_out_of_memory_releases_body_model_and_retries_once():
    fashn=Fake(fail=['GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD']);body_model=Fake()
    runtime=FashnWithBodyRuntime(fashn,lambda:body_model)
    runtime.predict({'task':'body_measurement'})
    assert runtime.predict({'task':'virtual_try_on'})=={'task':'virtual_try_on'}
    assert body_model.unloaded and runtime.body is None and fashn.calls==['virtual_try_on']*2


def test_other_failures_and_oom_without_body_model_are_not_retried():
    for fail,loaded in ((['GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD'],False),(['GENERATED_POSE_DRIFT_REJECTED'],True)):
        fashn=Fake(fail=fail);body_model=Fake();runtime=FashnWithBodyRuntime(fashn,lambda:body_model)
        if loaded:runtime.predict({'task':'body_measurement'})
        with pytest.raises(AlignmentError,match=fail[0]):runtime.predict({'task':'virtual_try_on'})
        assert fashn.calls==['virtual_try_on'] and not body_model.unloaded


class Measuring:
    ready=True
    tasks=('virtual_try_on','body_measurement')
    def __init__(self):self.received=[]
    def predict(self,instance):
        self.received.append(instance)
        return {'status':'READY','measurement':{'ratios':{'waistW':.16},'refused':{},'warnings':[]},
                'diagnostics':{'engine':'SAM_3D_BODY_DINOV3','device':'cuda:0'}}


def test_vertex_contract_forwards_only_the_photo_for_body_measurement():
    runtime=Measuring()
    with TestClient(create_app(runtime)) as client:
        assert client.get('/health').json()['tasks']==['virtual_try_on','body_measurement']
        ok=client.post('/predict',json={'instances':[{'task':'body_measurement','person_image':'TEST'}]})
        assert ok.status_code==200 and runtime.received==[{'task':'body_measurement','person_image':'TEST'}]
        for extra in ({'garment_image':'TEST'},{'category':'tops'},{'attributes':{}},{'image_png':'TEST'},{'person_image':None}):
            body={'task':'body_measurement','person_image':'TEST',**extra}
            assert client.post('/predict',json={'instances':[body]}).status_code==422
    class TryOnOnly(Measuring):tasks=('virtual_try_on',)
    with TestClient(create_app(TryOnOnly())) as client:
        refused=client.post('/predict',json={'instances':[{'task':'body_measurement','person_image':'TEST'}]})
        assert refused.status_code==422 and refused.json()['detail']=='TASK_NOT_SUPPORTED_BY_MODEL'


def png_b64():
    from services.anatomical_vton.auto_catalog import png_bytes
    return base64.b64encode(png_bytes(np.full((32,32,3),128,np.uint8))).decode()


def test_private_worker_returns_only_known_proportions_and_never_caches():
    from services.anatomical_vton.api import create_app as worker_app
    app=worker_app(store=object(),annotator=object(),token='TEST_ONLY');headers={'Authorization':'Bearer TEST_ONLY'}
    good={'status':'READY','measurement':{'ratios':{'waistW':.16,'hipW':.2},'refused':{'chestW':'SLICE_WITHOUT_TORSO'},
          'warnings':['ARMS_CLOSE_TO_BODY']},'diagnostics':{'engine':'SAM_3D_BODY_DINOV3','device':'cuda:0','gpuName':'Tesla T4',
          'pred_vertices':'PRIVATE_MESH'}}
    body={'person_image':png_b64()}
    with TestClient(app) as client:
        assert client.post('/v1/body/measure',json=body).status_code==401
        with patch.dict(os.environ,{'VTON_RENDER_PROVIDER':''}):
            assert client.post('/v1/body/measure',json=body,headers=headers).json()['detail']=='BODY_MEASUREMENT_NOT_CONFIGURED'
        with patch.dict(os.environ,{'VTON_RENDER_PROVIDER':'vertex_fashn'}):
            with patch('services.anatomical_vton.google_cloud.predict_body_measurement',return_value=good) as gpu:
                result=client.post('/v1/body/measure',json=body,headers=headers)
                assert result.status_code==200 and result.headers['cache-control']=='no-store'
                assert result.json()['ratios']=={'waistW':.16,'hipW':.2} and 'PRIVATE_MESH' not in result.text
                assert result.json()['diagnostics']['photoStored'] is False
                assert gpu.call_args.args==(body['person_image'],)
                assert client.post('/v1/body/measure',json={'person_image':'not-an-image'},headers=headers).status_code==422
                assert gpu.call_count==1
            for broken in ({**good,'diagnostics':{'engine':'SAM_3D_BODY_DINOV3','device':'cpu'}},
                           {**good,'measurement':{**good['measurement'],'ratios':{'mesh':[1,2,3]}}},
                           {**good,'measurement':{**good['measurement'],'ratios':{'waistW':float('inf')}}},
                           {**good,'measurement':{**good['measurement'],'warnings':['data:image/png;base64,AAAA']}}):
                with patch('services.anatomical_vton.google_cloud.predict_body_measurement',return_value=broken):
                    assert client.post('/v1/body/measure',json=body,headers=headers).status_code==422


def test_body_measurement_goes_to_the_same_dedicated_gpu_and_refusals_come_back():
    seen=[]
    def handler(request):
        seen.append((request.url.host,json.loads(request.content)['instances'][0]))
        return httpx.Response(422,json={'detail':'FULL_BODY_NOT_VISIBLE'})
    env={'GOOGLE_CLOUD_PROJECT':'fashionai-test','GOOGLE_CLOUD_LOCATION':'us-central1','VTON_VERTEX_TRYON_ENDPOINT_ID':'12345',
         'VTON_VERTEX_TRYON_DEDICATED_HOST':'12345.us-central1-1234.prediction.vertexai.goog'}
    original=VertexPredictionClient.__init__
    def init(self,*args,**kwargs):
        original(self,*args,**kwargs,transport=httpx.MockTransport(handler));self._headers=lambda:{'Authorization':'Bearer TEST_ONLY'}
    from services.anatomical_vton.google_cloud import predict_body_measurement
    with patch.dict(os.environ,env),patch.object(VertexPredictionClient,'__init__',init):
        with pytest.raises(AlignmentError,match='^FULL_BODY_NOT_VISIBLE$'):predict_body_measurement('TEST')
    assert seen==[(env['VTON_VERTEX_TRYON_DEDICATED_HOST'],{'task':'body_measurement','person_image':'TEST'})]


# Pesos do repositório fechado do Hugging Face: dublês de HfApi/hf_hub_download, token só em memória.
FILES={'model.ckpt':b'TEST_FIXTURE_NOT_A_CHECKPOINT','model_config.yaml':b'MODEL: {}\n','assets/mhr_model.pt':b'TEST_FIXTURE_NOT_MHR'}
TOKEN='hf_TEST_ONLY_NEVER_PRINTED'


def hub(files=FILES,revision='a'*40,tamper=None):
    def sibling(name,data):
        if name.endswith('.yaml'):return SimpleNamespace(rfilename=name,size=len(data),lfs=None,
            blob_id=hashlib.sha1(b'blob %d\0'%len(data)+data).hexdigest())
        return SimpleNamespace(rfilename=name,size=len(data),lfs={'sha256':hashlib.sha256(data).hexdigest()},blob_id=None)
    calls=[]
    class Api:
        def model_info(self,repo,revision=None,files_metadata=False,token=None):
            calls.append(('info',repo,revision,token))
            return SimpleNamespace(sha=revision_sha,siblings=[sibling(n,d) for n,d in files.items()])
    revision_sha=revision
    def fetch(repo,name,revision=None,token=None,local_dir=None):
        calls.append(('fetch',name,revision,token))
        path=os.path.join(local_dir,name);os.makedirs(os.path.dirname(path),exist_ok=True)
        with open(path,'wb') as out:out.write(b'TAMPERED' if name==tamper else files[name])
        return path
    return Api(),fetch,calls


def test_gated_weights_are_fetched_from_the_resolved_commit_and_hashed(tmp_path,monkeypatch,capsys):
    token=tmp_path/'hf_token';token.write_text(TOKEN+'\n')
    api,fetch,calls=hub()
    manifest=sam3d_download.download(tmp_path/'w',api,fetch,token)
    assert manifest['revision']=='a'*40 and {f['path'] for f in manifest['files']}==set(FILES)
    assert all(c[2]=='a'*40 for c in calls if c[0]=='fetch') and all(c[3]==TOKEN for c in calls)
    assert sam3d_download.verify_assets(tmp_path/'w')==manifest
    assert TOKEN not in (tmp_path/'w'/'manifest.json').read_text() and TOKEN not in capsys.readouterr().out
    os.chmod(tmp_path/'w'/'model.ckpt',0o644);(tmp_path/'w'/'model.ckpt').write_bytes(FILES['model.ckpt'].lower())  # same size, other bytes
    with pytest.raises(AlignmentError,match='SHA256_MISMATCH:model.ckpt'):sam3d_download.verify_assets(tmp_path/'w')


def test_tampered_download_missing_token_and_unpinned_revision_are_refused(tmp_path,monkeypatch):
    token=tmp_path/'hf_token';token.write_text(TOKEN)
    api,fetch,_=hub(tamper='model_config.yaml')
    with pytest.raises(AlignmentError,match='PUBLISHED_HASH_MISMATCH:model_config.yaml'):sam3d_download.download(tmp_path/'a',api,fetch,token)
    monkeypatch.delenv('HF_TOKEN',raising=False)
    with pytest.raises(AlignmentError,match='HF_TOKEN_REQUIRED'):sam3d_download.download(tmp_path/'b',*hub()[:2],tmp_path/'absent')
    pinned={**sam3d_download.assets(),'revision':'b'*40}
    monkeypatch.setattr(sam3d_download,'assets',lambda:pinned)
    with pytest.raises(AlignmentError,match='REVISION_MISMATCH'):sam3d_download.download(tmp_path/'c',*hub()[:2],token)
    pinned['files']=[{'path':'model.ckpt','sha256':'0'*64}];api,fetch,_=hub(revision='b'*40)
    with pytest.raises(AlignmentError,match='PINNED_SHA256_MISMATCH:model.ckpt'):sam3d_download.download(tmp_path/'d',api,fetch,token)


def test_sam3d_build_variant_gets_its_own_tag_and_reads_the_token_only_inside_cloud_build():
    from scripts.cloud.deploy_fashn_vertex import build_config,release_tag
    source='0123456789abcdef0123456789abcdef01234567'
    assert release_tag(source)=='0123456789ab'
    variant=release_tag(source,True);assert len(variant)==12 and variant!='0123456789ab' and int(variant,16)>=0
    plain=build_config('IMAGE','SA','fashionai-test')
    assert plain['steps'][0]['args']==['build','-t','IMAGE','.'] and 'availableSecrets' not in plain
    config=build_config('IMAGE','SA','fashionai-test','fashionai-hf-token');step=config['steps'][0]
    assert config['availableSecrets']=={'secretManager':[{'versionName':'projects/fashionai-test/secrets/fashionai-hf-token/versions/latest','env':'HF_TOKEN'}]}
    assert step['secretEnv']==['HF_TOKEN'] and step['entrypoint']=='bash'
    script=step['args'][1]
    assert '--build-arg VTON_ENGINE=fashn+sam3d_body' in script and '--secret id=hf_token,src=' in script
    # Cloud Build replaces "$X": every shell variable must be escaped, and the token is only ever redirected to a file.
    assert '$HF_TOKEN' not in script.replace('$$HF_TOKEN','') and 'echo' not in script and 'set -x' not in script
    assert '$' not in script.replace('$$','')


def test_missing_hf_secret_stops_before_any_build_with_instructions_and_no_value():
    import subprocess
    from scripts.cloud import deploy_fashn_vertex as installer
    missing=subprocess.CompletedProcess([],1,'','NOT_FOUND')
    with patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',return_value=missing),patch.object(installer,'iam_command') as grant:
        with pytest.raises(RuntimeError,match='HF_SECRET_NOT_FOUND: crie o segredo fashionai-hf-token'):
            installer.grant_build_secret('fashionai-test','fashionai-hf-token','b@fashionai-test.iam.gserviceaccount.com')
        grant.assert_not_called()
    found=subprocess.CompletedProcess([],0,'projects/1/secrets/fashionai-hf-token','')
    with patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',return_value=found),patch.object(installer,'iam_command') as grant:
        installer.grant_build_secret('fashionai-test','fashionai-hf-token','b@fashionai-test.iam.gserviceaccount.com')
        assert grant.call_args.args[:3]==('secrets','add-iam-policy-binding','fashionai-hf-token')
        assert '--role=roles/secretmanager.secretAccessor' in grant.call_args.args
    with pytest.raises(ValueError):installer.grant_build_secret('fashionai-test','../other','b@x')


def test_installer_smoke_keeps_only_proportions_and_requires_real_cuda_evidence():
    from scripts.cloud.deploy_fashn_vertex import body_measurement_smoke
    class Cloud:
        def __init__(self,prediction):self.prediction=prediction;self.sent=[]
        def request(self,method,path,body=None,host=None):self.sent.append((path,body,host));return {'predictions':[self.prediction]}
    good={'status':'READY','measurement':{'ratios':{'waistW':.16},'refused':{},'warnings':[]},
          'diagnostics':{'engine':'SAM_3D_BODY_DINOV3','device':'cuda:0','peakCudaBytes':123}}
    cloud=Cloud(good)
    result=body_measurement_smoke(cloud,'projects/p/locations/r/endpoints/1','HOST','PHOTO')
    assert result['ratios']=={'waistW':.16} and cloud.sent==[('projects/p/locations/r/endpoints/1:predict',
        {'instances':[{'task':'body_measurement','person_image':'PHOTO'}]},'HOST')]
    with pytest.raises(RuntimeError,match='REAL_CUDA_BODY_MEASUREMENT'):
        body_measurement_smoke(Cloud({**good,'diagnostics':{'engine':'SAM_3D_BODY_DINOV3','device':'cpu'}}),'e','HOST','PHOTO')
