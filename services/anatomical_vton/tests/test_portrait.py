"""Retrato estilizado do Avatar (SDXL + InstantID): rosto, fluxo, T4 compartilhada, contratos e integridade dos pesos.

Dublês explícitos no lugar do SDXL, do SCRFD e do ArcFace. Nada aqui afirma qualidade do retrato nem semelhança real;
a semelhança só é medida na GPU, com os modelos verdadeiros.
"""
import base64
import hashlib
import io
import json
import os
import zipfile
from unittest.mock import patch
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from services.anatomical_vton import portrait_download
from services.anatomical_vton.google_cloud import SERVER_CODES,VertexPredictionClient
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.portrait_face import (ARCFACE_TEMPLATE,STRIDES,anchor_centers,apply,decode_scrfd,nms,only_face,
                                                    portrait_keypoints,similarity_transform)
from services.anatomical_vton.portrait_runtime import SIZE,stylize
from services.anatomical_vton.shared_runtime import SharedT4Runtime,engine_parts
from services.anatomical_vton.vertex_runtime.server import create_app

KPS=np.array([[420.,500.],[520.,498.],[470.,560.],[430.,610.],[512.,608.]])


def scrfd_outputs(hits):
    """Saídas sintéticas do SCRFD: `hits` = [(escala, índice da âncora, score, caixa em distâncias, 5 pontos relativos)]."""
    scores,boxes,points=[],[],[]
    for stride in STRIDES:
        n=len(anchor_centers(stride));scores.append(np.zeros((n,1),np.float32))
        boxes.append(np.zeros((n,4),np.float32));points.append(np.zeros((n,10),np.float32))
    for stride,index,score,box,kps in hits:
        level=STRIDES.index(stride)
        scores[level][index]=score;boxes[level][index]=np.asarray(box)/stride;points[level][index]=np.asarray(kps).reshape(-1)/stride
    return scores+boxes+points


def test_scrfd_decoding_recovers_box_and_points_from_anchor_offsets():
    centers=anchor_centers(32);index=2*(5*20+7)  # célula (x=7, y=5), primeira âncora
    cx,cy=centers[index]
    outputs=scrfd_outputs([(32,index,.9,[40,50,60,70],[[-20,-10],[20,-10],[0,5],[-15,25],[15,25]])])
    boxes,points=decode_scrfd(outputs)
    assert (cx,cy)==(7*32,5*32) and boxes.shape==(1,5)
    assert np.allclose(boxes[0],[cx-40,cy-50,cx+60,cy+70,.9],atol=1e-4)
    assert np.allclose(points[0],[[cx-20,cy-10],[cx+20,cy-10],[cx,cy+5],[cx-15,cy+25],[cx+15,cy+25]],atol=1e-4)
    assert decode_scrfd(scrfd_outputs([(32,index,.3,[1,1,1,1],[[0,0]]*5)]))[0].shape==(0,5)
    with pytest.raises(AlignmentError,match='INVALID_FACE_DETECTOR_OUTPUT'):decode_scrfd(outputs[:8])


def test_nms_keeps_one_box_per_face():
    boxes=np.array([[0,0,100,100,.9],[5,5,105,105,.8],[300,300,400,400,.7]],float)
    assert list(nms(boxes))==[0,2]


def test_portrait_needs_exactly_one_clear_and_large_face():
    big=np.array([[100,100,300,320,.9]]);pts=np.zeros((1,5,2))
    box,_=only_face(big,pts);assert box[2]==300
    with pytest.raises(AlignmentError,match='FACE_NOT_FOUND'):only_face(np.empty((0,5)),np.empty((0,5,2)))
    with pytest.raises(AlignmentError,match='FACE_TOO_SMALL'):only_face(np.array([[0,0,60,70,.9]]),pts)
    two=np.array([[100,100,300,320,.9],[400,100,560,280,.9]])
    with pytest.raises(AlignmentError,match='MULTIPLE_FACES_REJECTED'):only_face(two,np.zeros((2,5,2)))
    tiny_second=np.array([[100,100,300,320,.9],[400,100,430,130,.9]])  # rosto pequeno ao fundo não bloqueia
    assert only_face(tiny_second,np.zeros((2,5,2)))[0][0]==100


def test_similarity_transform_recovers_rotation_scale_and_translation():
    angle=np.radians(12);scale=1.7
    matrix=np.array([[scale*np.cos(angle),-scale*np.sin(angle),30],[scale*np.sin(angle),scale*np.cos(angle),-12]])
    target=apply(matrix,ARCFACE_TEMPLATE)
    assert np.allclose(similarity_transform(ARCFACE_TEMPLATE,target),matrix,atol=1e-6)
    with pytest.raises(AlignmentError,match='DEGENERATE_FACE_LANDMARKS'):similarity_transform(np.zeros((5,2)),ARCFACE_TEMPLATE)


def test_portrait_framing_keeps_the_persons_face_proportions():
    width,height=SIZE
    placed=portrait_keypoints(KPS,SIZE)
    ratio=lambda p:np.linalg.norm(p[1]-p[0])/np.linalg.norm(p[3:].mean(0)-p[:2].mean(0))
    assert np.isclose(ratio(placed),ratio(KPS))   # pose e escala mudam; a geometria do rosto, não
    assert abs(placed[2,0]-width/2)<width*.05 and abs(placed[2,1]-.40*height)<height*.05
    eyes_to_mouth=placed[3:,1].mean()-placed[:2,1].mean()
    assert np.isclose(eyes_to_mouth,.11*height,rtol=.15)


class FakeFace:
    def __init__(self,generated=None,fail_on_output=None):
        self.generated=generated;self.fail=fail_on_output;self.calls=0
    def analyze(self,rgb):
        self.calls+=1
        if self.calls==1:return np.array([0,0,200,220,.9]),KPS,np.ones(512)
        if self.fail:raise AlignmentError(self.fail)
        return np.array([0,0,200,220,.9]),KPS,self.generated


def portrait_image(value=None):
    rng=np.random.default_rng(0)
    return rng.integers(0,255,(SIZE[1],SIZE[0],3),dtype=np.uint8) if value is None else np.full((SIZE[1],SIZE[0],3),value,np.uint8)


def test_stylize_draws_in_portrait_framing_and_measures_identity_on_the_result():
    seen={}
    def generate(identity,kps,size):
        seen.update(identity=identity,kps=kps,size=size);return portrait_image()
    generated=np.ones(512);generated[:256]=0
    output,metrics=stylize(np.zeros((900,700,3),np.uint8),FakeFace(generated),generate)
    assert output.shape==(SIZE[1],SIZE[0],3) and seen['size']==SIZE and np.array_equal(seen['identity'],np.ones(512))
    assert np.allclose(seen['kps'],portrait_keypoints(KPS,SIZE))
    assert metrics=={'identitySimilarity':round(256/np.sqrt(512*256),4),'identityMetric':'ARCFACE_GLINTR100_COSINE'}


def test_stylize_refuses_flat_outputs_and_results_without_the_face():
    with pytest.raises(AlignmentError,match='DEGENERATE_GENERATED_IMAGE'):
        stylize(np.zeros((900,700,3),np.uint8),FakeFace(np.ones(512)),lambda *_:portrait_image(128))
    with pytest.raises(AlignmentError,match='DEGENERATE_GENERATED_IMAGE'):
        stylize(np.zeros((900,700,3),np.uint8),FakeFace(np.ones(512)),lambda *_:np.zeros((10,10,3),np.uint8))
    with pytest.raises(AlignmentError,match='^GENERATED_FACE_REJECTED$'):
        stylize(np.zeros((900,700,3),np.uint8),FakeFace(fail_on_output='FACE_NOT_FOUND'),lambda *_:portrait_image())


class Model:
    ready=True
    def __init__(self,name,log,fail=()):self.name=name;self.log=log;self.fail=list(fail)
    def predict(self,instance):
        self.log.append(('predict',self.name))
        if self.fail:raise AlignmentError(self.fail.pop(0))
        return {'task':instance['task']}
    def unload(self):self.log.append(('unload',self.name))


class Fashn(Model):
    def park(self):self.log.append(('park','fashn'))
    def restore(self):self.log.append(('restore','fashn'))


def shared(log,fashn_fail=()):
    return SharedT4Runtime(Fashn('fashn',log,fashn_fail),{'body_measurement':lambda:Model('body',log),
                                                          'stylized_portrait':lambda:Model('portrait',log)})


def test_portrait_takes_the_t4_alone_and_try_on_gets_it_back():
    log=[];runtime=shared(log)
    assert runtime.tasks==('virtual_try_on','body_measurement','stylized_portrait') and runtime.ready
    runtime.predict({'task':'body_measurement'})
    runtime.predict({'task':'stylized_portrait'});runtime.predict({'task':'stylized_portrait'})
    assert log==[('restore','fashn'),('predict','body'),('unload','body'),('park','fashn'),('predict','portrait'),
                 ('park','fashn'),('predict','portrait')]
    log.clear();runtime.predict({'task':'virtual_try_on'})
    assert log==[('unload','portrait'),('restore','fashn'),('predict','fashn')] and runtime.loaded=={}
    log.clear();runtime.predict({'task':'stylized_portrait'});runtime.predict({'task':'body_measurement'})
    assert ('unload','portrait') in log and log[-2:]==[('restore','fashn'),('predict','body')]


def test_try_on_oom_releases_extras_and_retries_once():
    log=[];runtime=shared(log,['GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD'])
    runtime.predict({'task':'body_measurement'});log.clear()
    assert runtime.predict({'task':'virtual_try_on'})=={'task':'virtual_try_on'}
    assert log==[('restore','fashn'),('predict','fashn'),('unload','body'),('predict','fashn')]


def test_engine_names_are_a_closed_list():
    assert engine_parts('fashn')==set() and engine_parts('fashn+portrait')=={'portrait'}
    assert engine_parts('fashn+sam3d_body+portrait')=={'sam3d_body','portrait'}
    for bad in ('portrait','fashn+portrait+portrait','fashn+other',None,''):
        with pytest.raises(AlignmentError,match='INVALID_VTON_MODEL_ENGINE'):engine_parts(bad)


class Drawing:
    ready=True
    tasks=('virtual_try_on','stylized_portrait')
    def __init__(self):self.received=[]
    def predict(self,instance):
        self.received.append(instance)
        return {'status':'READY','image_jpeg':'AAAA','identitySimilarity':.6,'diagnostics':{'engine':'SDXL_INSTANTID_STYLIZED_PORTRAIT'}}


def test_vertex_contract_forwards_only_the_photo_and_seed_for_the_portrait():
    runtime=Drawing()
    with TestClient(create_app(runtime)) as client:
        ok=client.post('/predict',json={'instances':[{'task':'stylized_portrait','person_image':'TEST','seed':7}]})
        assert ok.status_code==200 and runtime.received==[{'task':'stylized_portrait','person_image':'TEST','seed':7}]
        for extra in ({'garment_image':'TEST'},{'category':'tops'},{'attributes':{}},{'image_png':'TEST'},{'person_image':None},{'seed':-1}):
            body={'task':'stylized_portrait','person_image':'TEST',**extra}
            assert client.post('/predict',json={'instances':[body]}).status_code==422


def jpeg_b64(size=SIZE):
    out=io.BytesIO();Image.fromarray(portrait_image()[:size[1],:size[0]]).save(out,format='JPEG',quality=80)
    return base64.b64encode(out.getvalue()).decode()


def png_b64():
    from services.anatomical_vton.auto_catalog import png_bytes
    return base64.b64encode(png_bytes(np.full((32,32,3),128,np.uint8))).decode()


def test_private_worker_returns_only_the_portrait_and_the_measured_similarity():
    from services.anatomical_vton.api import create_app as worker_app
    app=worker_app(store=object(),annotator=object(),token='TEST_ONLY');headers={'Authorization':'Bearer TEST_ONLY'}
    good={'status':'READY','image_jpeg':jpeg_b64(),'width':SIZE[0],'height':SIZE[1],'identitySimilarity':.61,
          'diagnostics':{'engine':'SDXL_INSTANTID_STYLIZED_PORTRAIT','style':'semi_realistic','device':'cuda:0','gpuName':'Tesla T4',
                         'latencyMs':41000,'seed':42,'faceEmbedding':[0.1]*512}}
    body={'person_image':png_b64()}
    with TestClient(app) as client:
        assert client.post('/v1/avatar/portrait',json=body).status_code==401
        with patch.dict(os.environ,{'VTON_RENDER_PROVIDER':''}):
            assert client.post('/v1/avatar/portrait',json=body,headers=headers).json()['detail']=='PORTRAIT_NOT_CONFIGURED'
        with patch.dict(os.environ,{'VTON_RENDER_PROVIDER':'vertex_fashn'}):
            with patch('services.anatomical_vton.google_cloud.predict_stylized_portrait',return_value=good) as gpu:
                result=client.post('/v1/avatar/portrait',json={**body,'seed':9},headers=headers)
                assert result.status_code==200 and result.headers['cache-control']=='no-store'
                data=result.json()
                assert data['identitySimilarity']==.61 and data['width']==SIZE[0] and 'faceEmbedding' not in result.text
                assert data['diagnostics']['photoStored'] is False and data['diagnostics']['identityCertified'] is False
                assert gpu.call_args.args==(body['person_image'],9)
                assert client.post('/v1/avatar/portrait',json={'person_image':'not-an-image'},headers=headers).status_code==422
            for broken in ({**good,'diagnostics':{**good['diagnostics'],'device':'cpu'}},
                           {**good,'width':SIZE[0]+8},
                           {**good,'identitySimilarity':float('nan')},
                           {**good,'identitySimilarity':3},
                           {**good,'image_jpeg':png_b64(),'width':32,'height':32},
                           {**good,'image_jpeg':'data:image/jpeg;base64,AAAA'}):
                with patch('services.anatomical_vton.google_cloud.predict_stylized_portrait',return_value=broken):
                    assert client.post('/v1/avatar/portrait',json=body,headers=headers).status_code==422


def test_portrait_goes_to_the_same_dedicated_gpu_and_face_refusals_come_back():
    assert {'FACE_NOT_FOUND','MULTIPLE_FACES_REJECTED','FACE_TOO_SMALL','GENERATED_FACE_REJECTED'}<=SERVER_CODES
    seen=[]
    def handler(request):
        seen.append((request.url.host,json.loads(request.content)['instances'][0]))
        return httpx.Response(422,json={'detail':'MULTIPLE_FACES_REJECTED'})
    env={'GOOGLE_CLOUD_PROJECT':'fashionai-test','GOOGLE_CLOUD_LOCATION':'us-central1','VTON_VERTEX_TRYON_ENDPOINT_ID':'12345',
         'VTON_VERTEX_TRYON_DEDICATED_HOST':'12345.us-central1-1234.prediction.vertexai.goog'}
    original=VertexPredictionClient.__init__
    def init(self,*args,**kwargs):
        original(self,*args,**kwargs,transport=httpx.MockTransport(handler));self._headers=lambda:{'Authorization':'Bearer TEST_ONLY'}
    from services.anatomical_vton.google_cloud import predict_stylized_portrait
    with patch.dict(os.environ,env),patch.object(VertexPredictionClient,'__init__',init):
        with pytest.raises(AlignmentError,match='^MULTIPLE_FACES_REJECTED$'):predict_stylized_portrait('TEST',5)
    assert seen==[(env['VTON_VERTEX_TRYON_DEDICATED_HOST'],{'task':'stylized_portrait','person_image':'TEST','seed':5})]


# Pesos: dublês de hf_hub_download e do release da InsightFace, com fixações geradas a partir dos próprios bytes.
def fake_spec():
    big=b'TEST_FIXTURE_NOT_A_MODEL'*10;small=b'{"test": true}\n'
    entry=lambda path,data,lfs:{'path':path,'size':len(data),**({'sha256':hashlib.sha256(data).hexdigest()} if lfs else
                                {'blob_id':hashlib.sha1(b'blob %d\0'%len(data)+data).hexdigest()})}
    archive=io.BytesIO()
    with zipfile.ZipFile(archive,'w') as bundle:
        bundle.writestr('antelopev2/scrfd_10g_bnkps.onnx',b'TEST_DETECTOR');bundle.writestr('antelopev2/glintr100.onnx',b'TEST_RECOGNIZER')
        bundle.writestr('antelopev2/genderage.onnx',b'UNUSED')
    data={'sdxl':{'unet/diffusion_pytorch_model.fp16.safetensors':big,'model_index.json':small},'vae':{'config.json':small},
          'instantid':{'ip-adapter.bin':big}}
    spec={'model_version':'TEST_PORTRAIT','repos':{key:{'repo':'test/'+key,'revision':'c'*40,'files':[entry(p,d,p.endswith(('.safetensors','.bin')))
          for p,d in files.items()]} for key,files in data.items()},
          'face':{'url':'https://example.invalid/antelopev2.zip','sha256':hashlib.sha256(archive.getvalue()).hexdigest(),'size':len(archive.getvalue()),
                  'members':{'antelopev2/scrfd_10g_bnkps.onnx':'scrfd_10g_bnkps.onnx','antelopev2/glintr100.onnx':'glintr100.onnx'}},
          'code':{'instantid':{'files':{}}}}
    return spec,data,archive.getvalue()


def fake_fetchers(data,archive,tamper=None):
    calls=[]
    def fetch(repo,name,revision=None,local_dir=None):
        calls.append((repo,name,revision))
        path=os.path.join(local_dir,name);os.makedirs(os.path.dirname(path),exist_ok=True)
        with open(path,'wb') as out:out.write(b'X'+data[repo.split('/')[1]][name][1:] if name==tamper else data[repo.split('/')[1]][name])
        return path
    def fetch_url(url,destination):Path_write(destination,archive)
    return fetch,fetch_url,calls


def Path_write(path,data):
    with open(path,'wb') as out:out.write(data)


def test_portrait_weights_come_from_pinned_commits_and_are_hashed(tmp_path,monkeypatch):
    spec,data,archive=fake_spec();monkeypatch.setattr(portrait_download,'assets',lambda:spec)
    fetch,fetch_url,calls=fake_fetchers(data,archive)
    manifest=portrait_download.download(tmp_path/'w',fetch,fetch_url)
    assert all(revision=='c'*40 for _,_,revision in calls) and len(calls)==4
    assert {f['path'] for f in manifest['files']}>={'sdxl/model_index.json','antelopev2/glintr100.onnx','antelopev2/scrfd_10g_bnkps.onnx'}
    assert not (tmp_path/'w'/'antelopev2'/'genderage.onnx').exists()
    assert portrait_download.verify_assets(tmp_path/'w')==manifest
    target=tmp_path/'w'/'instantid'/'ip-adapter.bin';os.chmod(target,0o644);target.write_bytes(data['instantid']['ip-adapter.bin'].lower())
    assert portrait_download.verify_assets(tmp_path/'w',hashes=False)==manifest   # subida rápida: só tamanho
    with pytest.raises(AlignmentError,match='SHA256_MISMATCH:instantid/ip-adapter.bin'):portrait_download.verify_assets(tmp_path/'w')


def test_tampered_weights_archive_and_unpinned_revision_stop_the_build(tmp_path,monkeypatch):
    spec,data,archive=fake_spec();monkeypatch.setattr(portrait_download,'assets',lambda:spec)
    fetch,fetch_url,_=fake_fetchers(data,archive,tamper='model_index.json')
    with pytest.raises(AlignmentError,match='PINNED_HASH_MISMATCH:sdxl/model_index.json'):portrait_download.download(tmp_path/'a',fetch,fetch_url)
    fetch,_,_=fake_fetchers(data,archive)
    with pytest.raises(AlignmentError,match='FACE_ARCHIVE_HASH_MISMATCH'):
        portrait_download.download(tmp_path/'b',fetch,lambda url,destination:Path_write(destination,archive+b'X'))
    spec['repos']['vae']['revision']=None
    with pytest.raises(AlignmentError,match='REVISION_NOT_PINNED:vae'):portrait_download.download(tmp_path/'c',*fake_fetchers(data,archive)[:2])


def test_repository_pins_every_portrait_weight_and_the_instantid_code():
    spec=portrait_download.assets()
    for repo in spec['repos'].values():
        assert len(repo['revision'])==40 and repo['files']
        assert all(f.get('sha256') or f.get('blob_id') for f in repo['files'])
        assert all(len(f['sha256'])==64 for f in repo['files'] if f['path'].endswith(('.safetensors','.bin')))
    assert len(spec['face']['sha256'])==64 and 'non-commercial' in spec['face']['license']
    code=spec['code']['instantid'];assert len(code['commit'])==40 and 'pipeline_stable_diffusion_xl_instantid.py' in code['files']


def test_instantid_code_is_checked_file_by_file(tmp_path,monkeypatch):
    content=b'# TEST_FIXTURE\n'
    monkeypatch.setattr(portrait_download,'assets',lambda:{'code':{'instantid':{'files':{'pipeline.py':hashlib.sha256(content).hexdigest()}}}})
    (tmp_path/'pipeline.py').write_bytes(content);portrait_download.verify_code(tmp_path)
    (tmp_path/'pipeline.py').write_bytes(content+b'#')
    with pytest.raises(AlignmentError,match='CODE_SHA256_MISMATCH:pipeline.py'):portrait_download.verify_code(tmp_path)


def test_portrait_build_variant_has_its_own_tag_and_needs_no_secret():
    from scripts.cloud.deploy_fashn_vertex import build_config,engine_name,release_tag
    source='0123456789abcdef0123456789abcdef01234567'
    tags={release_tag(source),release_tag(source,True),release_tag(source,False,True),release_tag(source,True,True)}
    assert len(tags)==4 and release_tag(source,True)==hashlib.sha256((source+'+sam3d_body').encode()).hexdigest()[:12]
    config=build_config('IMAGE','SA','fashionai-test',None,engine_name(with_portrait=True))
    assert config['steps'][0]['args']==['build','--build-arg','VTON_ENGINE=fashn+portrait','-t','IMAGE','.']
    assert 'availableSecrets' not in config and config['timeout']=='5400s'
    both=build_config('IMAGE','SA','fashionai-test','fashionai-hf-token',engine_name(True,True))
    script=both['steps'][0]['args'][1]
    assert '--build-arg VTON_ENGINE=fashn+sam3d_body+portrait' in script and both['timeout']=='5400s' and '$' not in script.replace('$$','')
    with pytest.raises(ValueError):build_config('IMAGE','SA','fashionai-test','fashionai-hf-token','fashn+portrait')
