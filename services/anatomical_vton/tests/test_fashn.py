"""Numerical/contract tests. These fixtures are NOT a GPU inference benchmark."""
import base64
import hashlib
import json
import os
from pathlib import Path
import tempfile
from unittest.mock import patch
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from services.anatomical_vton.fashn_runtime import fashion_category,pose_screen,serving_dtype
from services.anatomical_vton.fashn_download import artifact_path,verify_file,download_file
from services.anatomical_vton.google_cloud import VertexPredictionClient
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.vertex_runtime.server import create_app
from scripts.cloud.deploy_fashn_vertex import stage_context,image_payload


def pose():return np.full((1,134,2),50.,float),np.ones((1,134),float)


def tiny_png(path):
    """PNG real e mínimo: o instalador confere formato e dimensões da foto antes de qualquer chamada à nuvem."""
    from PIL import Image
    Image.new('RGB',(32,32),(120,90,60)).save(path,'PNG');return path


def test_only_actual_supported_catalog_categories_are_mapped():
    assert fashion_category('upper_piece')=='tops'
    assert fashion_category('lower_piece')=='bottoms'
    assert fashion_category('full_body_piece')=='one-pieces'
    for category in ('shoes_piece','accessory_piece','unknown',None):
        with pytest.raises(AlignmentError,match='CATEGORY_NOT_SUPPORTED'):fashion_category(category)


def test_pose_screen_normalizes_image_sizes_and_rejects_drift():
    a=pose();b=pose();b[0][:]*=2
    assert pose_screen(a,b,(100,100),(200,200))['normalizedPoseRmse']==0
    b[0][:]=180
    with pytest.raises(AlignmentError,match='POSE_DRIFT'):pose_screen(a,b,(100,100),(200,200))


def test_pose_screen_rejects_multiple_people_missing_landmarks_and_nonfinite():
    a=pose()
    with pytest.raises(AlignmentError,match='EXACTLY_ONE_PERSON'):
        pose_screen(a,(np.ones((2,134,2)),np.ones((2,134))),(100,100),(100,100))
    b=pose();b[1][:]=0
    with pytest.raises(AlignmentError,match='INSUFFICIENT'):pose_screen(a,b,(100,100),(100,100))
    b=pose();b[0][0,1,0]=np.nan
    with pytest.raises(AlignmentError,match='NONFINITE'):pose_screen(a,b,(100,100),(100,100))


def test_assets_are_atomic_cached_and_checksum_checked(tmp_path):
    data=b'TEST_WEIGHT_ONLY';entry={'path':'a.bin','size':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    target=tmp_path/'a.bin';target.write_bytes(data)
    with patch('urllib.request.urlopen',side_effect=AssertionError('cached artifact must not download')):
        assert download_file(tmp_path,entry)['status']=='CACHED'
    assert verify_file(target,entry)
    target.chmod(0o600)  # Simulate deliberate owner tampering with immutable weights.
    target.write_bytes(b'x'*len(data));assert not verify_file(target,entry)
    with pytest.raises(AlignmentError,match='OUTSIDE_ROOT'):artifact_path(tmp_path,'../outside')


def test_dedicated_endpoint_limits_and_destination_validation():
    calls=[]
    def handler(request):
        calls.append(request)
        assert request.headers['X-Vertex-AI-Endpoint-Id']=='123'
        return httpx.Response(200,json={'predictions':[{'status':'READY'}]})
    client=VertexPredictionClient('fashionai-test','southamerica-east1','123',
        dedicated_host='123.southamerica-east1-abc.prediction.vertexai.goog',transport=httpx.MockTransport(handler))
    client._headers=lambda:{'Authorization':'Bearer TEST_ONLY'}
    assert client.payload_limit==9_000_000 and client.timeout==600
    assert client.predict({'task':'virtual_try_on'})['status']=='READY'
    assert len(calls)==1
    for host in ('evil.example.com','https://123.prediction.vertexai.goog','123.prediction.vertexai.goog:443','123.prediction.vertexai.goog/path'):
        with pytest.raises(AlignmentError,match='INVALID_VERTEX_DEDICATED_HOST'):
            VertexPredictionClient('fashionai-test','southamerica-east1','123',dedicated_host=host)


class ContractOnlyRuntime:
    ready=True
    tasks=('virtual_try_on',)
    def predict(self,instance):
        # Explicit fake: only validates the HTTP contract, never returns an image.
        return {'status':'TEST_CONTRACT_ONLY','task':instance['task']}


def test_vertex_routes_native_task_and_refuses_incompatible_contracts():
    with TestClient(create_app(runtime=ContractOnlyRuntime())) as client:
        body={'task':'virtual_try_on','person_image':'TEST','garment_image':'TEST','category':'tops'}
        assert client.post('/predict',json={'instances':[body]}).json()['predictions'][0]['status']=='TEST_CONTRACT_ONLY'
        body['attributes']={}
        assert client.post('/predict',json={'instances':[body]}).status_code==422
        assert client.post('/predict',json={'instances':[{'task':'garment_annotation','image_png':'TEST'}]}).status_code==422


def test_cloud_build_context_contains_code_not_user_media_or_downloaded_weights(tmp_path):
    stage_context(tmp_path)
    assert (tmp_path/'Dockerfile').is_file()
    assert (tmp_path/'services/anatomical_vton/fashn_assets.json').is_file()
    assert not list(tmp_path.rglob('*.safetensors'))
    assert not list(tmp_path.rglob('work'))
    image=tiny_png(tmp_path/'test.png')
    encoded,digest=image_payload(image)
    assert base64.b64decode(encoded)==image.read_bytes()


def test_private_worker_can_render_pending_catalog_via_native_gpu_contract(tmp_path):
    from services.anatomical_vton.api import create_app as worker_app
    from services.anatomical_vton.auto_catalog import GarmentAutoAnnotator,png_bytes,decode_image
    from services.anatomical_vton.store import CatalogStore,ArtifactStore
    image=np.zeros((32,32,4),dtype=np.uint8);image[:,:,:]=[12,60,140,255]
    png=png_bytes(image);encoded=base64.b64encode(png).decode()
    store=CatalogStore('sqlite:///'+str(tmp_path/'catalog.sqlite'),ArtifactStore(tmp_path/'artifacts'))
    app=worker_app(store=store,annotator=GarmentAutoAnnotator(None,'TEST_ONLY'),token='TEST_ONLY')
    response={'status':'READY','image_png':encoded,'diagnostics':{'engine':'FASHN_VTON_1_5','device':'cuda:0'}}
    headers={'Authorization':'Bearer TEST_ONLY'}
    with patch.dict(os.environ,{'VTON_RENDER_PROVIDER':'vertex_fashn'}),TestClient(app) as client:
        assert client.post('/v1/catalog/test',json={'garment_image':encoded},headers=headers).status_code==200
        body={'garment_id':'test','person_image':encoded,'garment_category':'lower_piece','mirror':True}
        with patch('services.anatomical_vton.google_cloud.predict_fashn',return_value=response) as provider:
            result=client.post('/try-on',json=body,headers=headers)
            assert result.status_code==200 and result.json()['status']=='READY'
            assert provider.call_args.args[2]=='bottoms'
            assert result.json()['diagnostics']['physicalFitCertified'] is False
            body['garment_category']='shoes_piece'
            assert client.post('/try-on',json=body,headers=headers).status_code==422
            assert provider.call_count==1
        with patch('services.anatomical_vton.google_cloud.predict_fashn',return_value={**response,'diagnostics':{'device':'cpu'}}):
            body['garment_category']='lower_piece'
            result=client.post('/try-on',json=body,headers=headers)
            assert result.status_code==422 and 'REAL_GPU' in result.json()['code']


def test_transparent_product_background_is_composited_white():
    from services.anatomical_vton.fashn_runtime import decoded_image
    from services.anatomical_vton.auto_catalog import png_bytes
    rgba=np.zeros((32,32,4),dtype=np.uint8);rgba[10:20,10:20]=[10,20,30,255]
    output=decoded_image(base64.b64encode(png_bytes(rgba)).decode())
    assert output[0,0].tolist()==[255,255,255]
    assert output[15,15].tolist()==[10,20,30]


def test_auto_photo_type_distinguishes_flatlay_and_model_and_rejects_groups():
    from services.anatomical_vton.fashn_runtime import inferred_photo_type
    assert inferred_photo_type((np.empty((0,134,2)),np.empty((0,134))))=='flat-lay'
    assert inferred_photo_type(pose())=='model'
    low=pose();low[1][:]=.1
    assert inferred_photo_type(low)=='flat-lay'
    with pytest.raises(AlignmentError,match='MULTIPLE_GARMENT_MODELS'):
        inferred_photo_type((np.zeros((2,134,2)),np.ones((2,134))))


def test_no_detector_person_never_invokes_dwpose_whole_image_fallback():
    from services.anatomical_vton.fashn_runtime import detected_pose
    class Estimator:
        session_det=object()
        def __call__(self,bgr):raise AssertionError('must not invoke whole-image fallback')
    points,scores=detected_pose(np.zeros((32,32,3),dtype=np.uint8),Estimator(),lambda session,bgr:np.array([]))
    assert points.shape==(0,134,2) and scores.shape==(0,134)
    with pytest.raises(AlignmentError,match='EXACTLY_ONE_PERSON'):
        pose_screen((points,scores),(points,scores),(32,32),(32,32))


def test_iam_binding_retries_identity_propagation_without_exposing_policy():
    import subprocess
    from scripts.cloud.deploy_fashn_vertex import iam_command
    missing=subprocess.CompletedProcess([],1,stdout='',stderr='INVALID_ARGUMENT: Service account does not exist.')
    ready=subprocess.CompletedProcess([],0,stdout='TEST_POLICY',stderr='')
    with patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',side_effect=[missing,ready]) as run,patch('scripts.cloud.deploy_fashn_vertex.time.sleep') as sleep:
        assert iam_command('projects','add-iam-policy-binding','TEST_ONLY')=='TEST_POLICY'
        assert run.call_count==2
        sleep.assert_called_once_with(5)
    denied=subprocess.CompletedProcess([],1,stdout='',stderr='PERMISSION_DENIED')
    with patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',return_value=denied) as run,patch('scripts.cloud.deploy_fashn_vertex.time.sleep') as sleep:
        with pytest.raises(subprocess.CalledProcessError):iam_command('TEST_ONLY')
        assert run.call_count==1
        sleep.assert_not_called()


def test_build_account_waits_for_describe_after_create():
    import subprocess
    from scripts.cloud.deploy_fashn_vertex import ensure_build_account
    email='fashionai-vton-build@fashionai-test.iam.gserviceaccount.com'
    missing=subprocess.CompletedProcess([],1,stdout='',stderr='NOT_FOUND')
    created=subprocess.CompletedProcess([],0,stdout='',stderr='Created')
    ready=subprocess.CompletedProcess([],0,stdout=json.dumps({'email':email}),stderr='')
    with patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',side_effect=[missing,created,missing,ready]) as run,patch('scripts.cloud.deploy_fashn_vertex.time.sleep') as sleep:
        ensure_build_account('fashionai-test',email)
        assert run.call_count==4
        sleep.assert_called_once_with(5)


def test_new_installer_resumes_only_state_without_registered_or_deploying_model():
    from scripts.cloud.deploy_fashn_vertex import resumed_state
    previous={'project':'fashionai-test','image':'old','endpoint':'KEEP_ENDPOINT'}
    assert resumed_state(previous,'fashionai-test','new')['endpoint']=='KEEP_ENDPOINT'
    assert resumed_state(previous,'fashionai-test','new')['image']=='new'
    for protected in ({'model':'KEEP_MODEL'},{'deployOperation':'KEEP_OPERATION'}):
        with pytest.raises(RuntimeError,match='ANOTHER_RELEASE'):
            resumed_state({**previous,**protected},'fashionai-test','new')
    with pytest.raises(RuntimeError,match='ANOTHER_PROJECT'):
        resumed_state(previous,'other-project','new')


def test_cloud_build_resume_never_submits_again_or_recreates_identity(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import build_image
    state={'buildId':'1a0bdffd-21d2-4790-bfd5-55fd8d5c7cdf'}
    with patch('scripts.cloud.deploy_fashn_vertex.prepare_build_identity') as identity,patch('scripts.cloud.deploy_fashn_vertex.command') as command,patch('scripts.cloud.deploy_fashn_vertex.wait_build',return_value={'status':'SUCCESS'}) as wait:
        assert build_image('fashionai-test','southamerica-east1','IMAGE',state,tmp_path/'state.json')['status']=='SUCCESS'
        identity.assert_not_called();command.assert_not_called()
        wait.assert_called_once_with('fashionai-test','southamerica-east1',state['buildId'],'IMAGE',3000)


def test_cloud_build_waits_for_same_image_and_rejects_cancelled_without_resubmit():
    from scripts.cloud.deploy_fashn_vertex import wait_build
    image='southamerica-east1-docker.pkg.dev/fashionai-test/fashionai-vton/fashn:123456789abc'
    working={'projectId':'fashionai-test','images':[image],'status':'WORKING'}
    with patch('scripts.cloud.deploy_fashn_vertex.describe_build',side_effect=[working,{**working,'status':'SUCCESS'}]),patch('scripts.cloud.deploy_fashn_vertex.time.sleep') as sleep:
        assert wait_build('fashionai-test','southamerica-east1','BUILD_ID',image)['status']=='SUCCESS'
        sleep.assert_called_once_with(20)
    with patch('scripts.cloud.deploy_fashn_vertex.describe_build',return_value={**working,'status':'CANCELLED'}),patch('scripts.cloud.deploy_fashn_vertex.time.sleep') as sleep:
        with pytest.raises(RuntimeError,match='CLOUD_BUILD_CANCELLED'):
            wait_build('fashionai-test','southamerica-east1','BUILD_ID',image)
        sleep.assert_not_called()
    with patch('scripts.cloud.deploy_fashn_vertex.describe_build',return_value=working):
        with pytest.raises(RuntimeError,match='IMAGE_MISMATCH'):
            wait_build('fashionai-test','southamerica-east1','BUILD_ID','OTHER_IMAGE')


def test_async_cloud_build_is_checkpointed_before_polling(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import build_image
    build_id='1a0bdffd-21d2-4790-bfd5-55fd8d5c7cdf'
    state={};state_file=tmp_path/'deployment.json'
    def wait(*args):
        assert json.loads(state_file.read_text())['buildId']==build_id
        raise KeyboardInterrupt()
    with patch('scripts.cloud.deploy_fashn_vertex.prepare_build_identity',return_value=('SERVICE_ACCOUNT','STAGING_BUCKET')),patch('scripts.cloud.deploy_fashn_vertex.command',return_value=build_id) as command,patch('scripts.cloud.deploy_fashn_vertex.wait_build',side_effect=wait):
        with pytest.raises(KeyboardInterrupt):
            build_image('fashionai-test','southamerica-east1','IMAGE',state,state_file)
        assert command.call_count==1
        assert '--async' in command.call_args.args
        assert state['buildId']==build_id


def test_restart_flag_replaces_only_confirmed_cancelled_build_and_preserves_registered_models():
    from scripts.cloud.deploy_fashn_vertex import adopted_build
    old='southamerica-east1-docker.pkg.dev/fashionai-test/fashionai-vton/fashn:123456789abc'
    new='southamerica-east1-docker.pkg.dev/fashionai-test/fashionai-vton/fashn:abcdef123456'
    previous={'image':old,'endpoint':'KEEP_ENDPOINT','buildId':'OLD_BUILD'}
    for status in ('WORKING','SUCCESS','FAILURE'):
        state,image=adopted_build(previous,{'images':[old],'status':status},'OLD_BUILD','fashionai-test','southamerica-east1',new,True)
        assert state['buildId']=='OLD_BUILD' and image==old
    state,image=adopted_build(previous,{'images':[old],'status':'CANCELLED'},'OLD_BUILD','fashionai-test','southamerica-east1',new,True)
    assert 'buildId' not in state and state['endpoint']=='KEEP_ENDPOINT' and image==new
    for protected in ({'model':'KEEP_MODEL'},{'deployOperation':'KEEP_OPERATION'}):
        with pytest.raises(RuntimeError,match='CANNOT_RESTART'):
            adopted_build({**previous,**protected},{'images':[old],'status':'CANCELLED'},'OLD_BUILD','fashionai-test','southamerica-east1',new,True)


def test_console_retry_is_reused_and_multiple_active_builds_block_new_submission():
    from scripts.cloud.deploy_fashn_vertex import replacement_build
    image='southamerica-east1-docker.pkg.dev/fashionai-test/fashionai-vton/fashn:123456789abc'
    original={'id':'OLD','images':[image],'status':'CANCELLED'}
    retry={'id':'CONSOLE_RETRY','images':[image],'status':'WORKING'}
    unrelated={'id':'OTHER','images':['OTHER_IMAGE'],'status':'WORKING'}
    with patch('scripts.cloud.deploy_fashn_vertex.command',return_value=json.dumps([unrelated,retry,original])):
        assert replacement_build('fashionai-test','southamerica-east1','OLD',image)['id']=='CONSOLE_RETRY'
    with patch('scripts.cloud.deploy_fashn_vertex.command',return_value=json.dumps([retry,{**retry,'id':'ANOTHER_RETRY'}])):
        with pytest.raises(RuntimeError,match='MULTIPLE_ACTIVE_BUILDS'):
            replacement_build('fashionai-test','southamerica-east1','OLD',image)


def test_management_operation_failure_includes_actual_message_and_name():
    from scripts.cloud.deploy_fashn_vertex import Cloud,CloudOperationFailed
    operation={'name':'projects/TEST/locations/TEST/endpoints/TEST/operations/FAILED',
               'done':True,'error':{'code':9,'message':'TEST_ONLY: service precondition was not met'}}
    with pytest.raises(CloudOperationFailed,match='service precondition was not met') as caught:
        Cloud('fashionai-test','southamerica-east1').wait(operation)
    assert operation['name'] in str(caught.value)
    assert caught.value.operation['error']['code']==9


def test_completed_failed_deploy_does_not_silently_retry_or_change_state(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import resume_deployment,Cloud,CloudOperationFailed
    cloud=Cloud('fashionai-test','southamerica-east1')
    operation={'name':'OLD_OPERATION','done':True,'error':{'code':9,'message':'TEST_ONLY'}}
    cloud.request=lambda method,path:operation
    state={'deployOperation':'OLD_OPERATION','model':'KEEP_MODEL'}
    original=state.copy()
    with pytest.raises(CloudOperationFailed):resume_deployment(cloud,state,tmp_path/'state.json')
    assert state==original
    assert not (tmp_path/'state.json').exists()
    resume_deployment(cloud,state,tmp_path/'state.json',retry_failed=True)
    assert state['model']=='KEEP_MODEL' and 'deployOperation' not in state
    assert state['failedDeployOperations'][0]['error']['code']==9
    assert json.loads((tmp_path/'state.json').read_text())['model']=='KEEP_MODEL'


def test_diagnose_mode_only_reads_saved_operation_and_endpoint(tmp_path,capsys):
    from scripts.cloud.deploy_fashn_vertex import diagnose_deployment
    state={'project':'fashionai-test','deployOperation':'FAILED_OPERATION','endpoint':'EXISTING_ENDPOINT'}
    (tmp_path/'deployment.json').write_text(json.dumps(state))
    def request(method,path,*args,**kwargs):
        assert method=='GET'
        return {'name':path,'done':True,'error':{'code':9,'message':'TEST_ONLY'}}
    with patch('scripts.cloud.deploy_fashn_vertex.Cloud.request',side_effect=request) as call,patch('scripts.cloud.deploy_fashn_vertex.command') as command:
        diagnose_deployment('fashionai-test','southamerica-east1',tmp_path)
        assert call.call_count==2
        command.assert_not_called()
    assert 'TEST_ONLY' in capsys.readouterr().out


def test_downloaded_public_weights_are_readable_by_other_runtime_uid(tmp_path):
    import io
    data=b'TEST_PUBLIC_MODEL_WEIGHTS';entry={'path':'a.bin','repo':'TEST_ONLY','revision':'TEST_ONLY','filename':'TEST_ONLY',
        'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    with patch('services.anatomical_vton.fashn_download.urllib.request.urlopen',return_value=io.BytesIO(data)):
        assert download_file(tmp_path,entry)['status']=='VERIFIED'
    assert (tmp_path/'a.bin').stat().st_mode & 0o777==0o444
    assert verify_file(tmp_path/'a.bin',entry)
    (tmp_path/'a.bin').chmod(0o600)
    assert download_file(tmp_path,entry)['status']=='CACHED'
    assert (tmp_path/'a.bin').stat().st_mode & 0o777==0o444


def test_missing_and_invalid_weights_identify_the_file_without_skipping_checks(tmp_path):
    from services.anatomical_vton.fashn_download import verify_assets
    data=b'TEST_PUBLIC_MODEL';entry={'path':'model.bin','size':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    with patch('services.anatomical_vton.fashn_download.assets',return_value={'files':[entry]}):
        with pytest.raises(AlignmentError,match='FASHN_WEIGHT_MISSING:model.bin'):verify_assets(tmp_path)
        (tmp_path/'model.bin').write_bytes(b'bad')
        with pytest.raises(AlignmentError,match='FASHN_WEIGHT_SIZE_MISMATCH:model.bin'):verify_assets(tmp_path)
        (tmp_path/'model.bin').write_bytes(b'x'*len(data))
        with pytest.raises(AlignmentError,match='FASHN_WEIGHT_SHA256_MISMATCH:model.bin'):verify_assets(tmp_path)
        with patch('services.anatomical_vton.fashn_download.verify_file',side_effect=PermissionError()):
            with pytest.raises(AlignmentError,match='FASHN_WEIGHT_UNREADABLE:model.bin'):verify_assets(tmp_path)


def test_new_release_archives_terminal_old_model_without_deleting_cloud_resources(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import start_new_release,Cloud
    state={'image':'OLD_IMAGE','endpoint':'KEEP_ENDPOINT','model':'KEEP_MODEL','deployOperation':'FAILED_DEPLOY'}
    cloud=Cloud('fashionai-test','southamerica-east1')
    with patch.object(cloud,'request',return_value={'done':True,'error':{'code':9}}) as request:
        assert start_new_release(cloud,state,tmp_path/'deployment.json','NEW_IMAGE',{'name':'KEEP_ENDPOINT'})=={}
        request.assert_called_once_with('GET','FAILED_DEPLOY')
    archives=list(tmp_path.glob('deployment.previous-*.json'))
    assert len(archives)==1 and json.loads(archives[0].read_text())==state
    assert start_new_release(cloud,state,tmp_path/'deployment.json','OLD_IMAGE',{'name':'KEEP_ENDPOINT'})==state


def test_new_release_blocks_pending_deployment_and_active_endpoint(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import start_new_release,Cloud
    state={'image':'OLD','endpoint':'ENDPOINT','deployOperation':'PENDING_DEPLOY'}
    cloud=Cloud('fashionai-test','southamerica-east1')
    with patch.object(cloud,'request',return_value={'done':False}):
        with pytest.raises(RuntimeError,match='STILL_RUNNING'):
            start_new_release(cloud,state,tmp_path/'state.json','NEW',{'name':'ENDPOINT'})
        with pytest.raises(RuntimeError,match='NO_DEPLOYED_MODEL'):
            start_new_release(cloud,state,tmp_path/'state.json','NEW',{'name':'ENDPOINT','deployedModels':[{'id':'KEEP'}]})
    assert not list(tmp_path.glob('deployment.previous-*'))


def test_image_only_plan_never_touches_cloud(tmp_path,capsys):
    from scripts.cloud import deploy_fashn_vertex as installer
    with patch.object(installer,'command',side_effect=AssertionError('plan must be local')):
        result=installer.build_only_release('fashionai-test','southamerica-east1','repo/image:abc123',tmp_path)
    assert result['executed'] is False and result['gpuReplicas']==0
    assert not list(tmp_path.iterdir())


def test_image_only_build_checkpoints_and_never_deploys(tmp_path):
    from scripts.cloud import deploy_fashn_vertex as installer
    calls=[]
    def fake_command(*args,**kwargs):
        calls.append(args)
        if args[:3]==('artifacts','repositories','list'):
            return json.dumps([{'name':'projects/test/locations/southamerica-east1/repositories/fashionai-vton'}])
        return 'fashionai-test'
    def fake_build(project,region,image,state,state_file,hf_secret=None):
        assert state_file.name=='build.json' and hf_secret is None
        assert json.loads(state_file.read_text())['image']==image
        state['buildId']='TEST_ONLY_BUILD'
        installer.save_json(state_file,state)
    with patch.object(installer,'command',side_effect=fake_command),patch.object(installer,'build_image',side_effect=fake_build),patch.object(installer.Cloud,'request',side_effect=AssertionError('no Vertex request')):
        result=installer.build_only_release('fashionai-test','southamerica-east1','repo/image:abc123',tmp_path,True)
    assert result['status']=='IMAGE_BUILD_SUCCEEDED' and result['gpuReplicas']==0
    assert result['gpuInferenceValidated'] is False
    assert not (tmp_path/'deployment.json').exists()
    assert not any('aiplatform.googleapis.com' in c for c in calls)
    assert json.loads((tmp_path/'images/abc123/result.json').read_text())==result


def test_build_only_cli_requires_no_photos_and_no_auth(monkeypatch,capsys):
    from scripts.cloud import deploy_fashn_vertex as installer
    monkeypatch.setattr('sys.argv',['deploy_fashn_vertex.py','--build-only'])
    with patch.object(installer,'command',side_effect=AssertionError('no cloud call')):
        installer.main()
    plan=json.loads(capsys.readouterr().out)
    assert plan['executed'] is False and plan['gpuReplicas']==0
    assert plan['image'].startswith('southamerica-east1-docker.pkg.dev/')


def test_prebuilt_image_adoption_initializes_project_before_resume():
    from scripts.cloud.deploy_fashn_vertex import adopted_build,resumed_state
    project='fashionai-test';region='southamerica-east1'
    image=f'{region}-docker.pkg.dev/{project}/fashionai-vton/fashn:00d264820803'
    build={'projectId':project,'images':[image],'status':'SUCCESS'}
    for fresh in ({},{'buildId':'EXISTING_BUILD'}):
        state,chosen=adopted_build(fresh,build,'EXISTING_BUILD',project,region,image)
        result=resumed_state(state,project,chosen)
        assert result=={'project':project,'image':image,'buildId':'EXISTING_BUILD'}
    with pytest.raises(RuntimeError,match='STATE_BELONGS_TO_ANOTHER_PROJECT'):
        adopted_build({'project':'another-project'},build,'EXISTING_BUILD',project,region,image)


def test_vertex_startup_probe_allows_real_cold_start_and_still_requires_health():
    from scripts.cloud.deploy_fashn_vertex import fashn_container_spec
    spec=fashn_container_spec('EXISTING_IMAGE')
    probe=spec['startupProbe']
    assert spec['imageUri']=='EXISTING_IMAGE'
    assert probe['failureThreshold']*probe['periodSeconds']>=600
    assert probe['timeoutSeconds']>=probe['periodSeconds']
    assert probe['initialDelaySeconds']>=30
    assert 'http://localhost:8080/health' in probe['exec']['command'][-1]
    assert 'timeout=5' in probe['exec']['command'][-1]
    assert spec['healthProbe']['failureThreshold']==3
    assert spec['deploymentTimeout']=='1800s'


def test_reregister_archives_old_model_and_keeps_image_build_and_endpoint(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import reregister_model,Cloud
    cloud=Cloud('fashionai-test','southamerica-east1')
    state={'project':cloud.project,'image':'EXISTING_IMAGE','buildId':'EXISTING_BUILD',
           'endpoint':'KEEP_ENDPOINT','model':'OLD_MODEL','deployOperation':'FAILED_OPERATION'}
    with patch.object(cloud,'request',return_value={'done':True,'error':{'code':9}}):
        new=reregister_model(cloud,state,tmp_path/'deployment.json',{'name':'KEEP_ENDPOINT'})
    assert new=={k:state[k] for k in ('project','image','buildId','endpoint')}
    archives=list(tmp_path.glob('deployment.registration.previous-*.json'))
    assert len(archives)==1 and json.loads(archives[0].read_text())==state
    assert state['model']=='OLD_MODEL'
    with patch.object(cloud,'request',return_value={'done':False}):
        with pytest.raises(RuntimeError,match='STILL_RUNNING'):
            reregister_model(cloud,state,tmp_path/'deployment.json',{'name':'KEEP_ENDPOINT'})
    with pytest.raises(RuntimeError,match='NO_DEPLOYED_MODEL'):
        reregister_model(cloud,state,tmp_path/'deployment.json',{'name':'KEEP_ENDPOINT','deployedModels':[{'id':'KEEP'}]})
    with pytest.raises(RuntimeError,match='ANOTHER_PROJECT'):
        reregister_model(cloud,{**state,'project':'OTHER'},tmp_path/'deployment.json',{'name':'KEEP_ENDPOINT'})


def test_reregister_cli_uses_saved_image_without_submitting_another_build(tmp_path,monkeypatch):
    from scripts.cloud import deploy_fashn_vertex as installer
    project='fashionai-test';region='southamerica-east1'
    image=f'{region}-docker.pkg.dev/{project}/fashionai-vton/fashn:00d264820803'
    endpoint={'name':'KEEP_ENDPOINT','displayName':installer.NAME,'dedicatedEndpointEnabled':True}
    old={'project':project,'image':image,'buildId':'EXISTING_BUILD','endpoint':endpoint['name'],
         'model':'OLD_MODEL','deployOperation':'FAILED_OPERATION'}
    installer.save_json(tmp_path/'deployment.json',old)
    photo=tiny_png(tmp_path/'test.png')
    monkeypatch.setattr('sys.argv',['deploy','--apply','--reregister-model','--project',project,
        '--region',region,'--output',str(tmp_path),'--person',str(photo),'--garment',str(photo),'--category','tops'])
    commands=[];uploads=[]
    def fake_command(*args,**kwargs):
        commands.append(args)
        if args[:3]==('artifacts','repositories','list'):
            return json.dumps([{'name':'projects/test/repositories/fashionai-vton'}])
    def fake_request(self,method,path,body=None,host=None):
        if method=='GET' and path=='FAILED_OPERATION':return {'done':True,'error':{'code':9}}
        if method=='GET' and path==endpoint['name']:return endpoint
        if path.endswith('/models:upload'):
            uploads.append(body)
            return {'name':'UPLOAD','done':True,'response':{'model':'NEW_MODEL'}}
        if path.endswith(':deployModel'):
            saved=json.loads((tmp_path/'deployment.json').read_text())
            assert saved['model']=='NEW_MODEL' and saved['image']==image
            raise RuntimeError('TEST_ONLY_STOP_BEFORE_GPU')
        raise AssertionError((method,path))
    build={'projectId':project,'images':[image],'status':'SUCCESS'}
    with patch.object(installer.Cloud,'endpoints',return_value=[endpoint]),patch.object(installer.Cloud,'request',fake_request),patch.object(installer,'command',side_effect=fake_command),patch.object(installer,'describe_build',return_value=build):
        with pytest.raises(RuntimeError,match='TEST_ONLY_STOP_BEFORE_GPU'):installer.main()
    assert len(uploads)==1
    spec=uploads[0]['model']['containerSpec']
    assert spec['imageUri']==image and spec['startupProbe']['failureThreshold']==60
    assert not any(c[:2]==('builds','submit') for c in commands)


def test_reregister_plan_displays_saved_image_instead_of_current_git_head(tmp_path,monkeypatch,capsys):
    from scripts.cloud import deploy_fashn_vertex as installer
    image='southamerica-east1-docker.pkg.dev/fashionai-test/fashionai-vton/fashn:00d264820803'
    installer.save_json(tmp_path/'deployment.json',{'project':'fashionai-test','image':image,'model':'EXISTING_MODEL','buildId':'EXISTING_BUILD'})
    photo=tiny_png(tmp_path/'test.png')
    monkeypatch.setattr('sys.argv',['deploy','--reregister-model','--project','fashionai-test',
        '--output',str(tmp_path),'--person',str(photo),'--garment',str(photo),'--category','tops'])
    with patch.object(installer,'command',side_effect=AssertionError('plan must not call cloud')):installer.main()
    plan=json.loads(capsys.readouterr().out)
    assert plan['executed'] is False and plan['image']==image and plan['reregisterModel'] is True


def test_predict_error_shows_only_known_server_code_never_the_echoed_input():
    import io,urllib.error
    from scripts.cloud.deploy_fashn_vertex import Cloud,server_code
    assert server_code(b'{"detail":"INVALID_VTON_IMAGE"}')=='INVALID_VTON_IMAGE'
    wrapped=json.dumps({'error':{'code':422,'message':json.dumps({'detail':'GENERATED_POSE_DRIFT_REJECTED'}),'status':'FAILED_PRECONDITION'}})
    assert server_code(wrapped.encode())=='GENERATED_POSE_DRIFT_REJECTED'
    assert server_code(b'{"echo":"AAAABBBBCCCCDDDDEEEE"}') is None          # base64 ecoado nunca vira "código"
    echoed=json.dumps({'error':{'message':'bad instance person_image=QUJDREVGR0hJSktM '+'X'*40+' {"detail":"EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED"}'}}).encode()
    error=urllib.error.HTTPError('https://x.prediction.vertexai.goog/v1/p:predict',422,'Unprocessable',{},io.BytesIO(echoed))
    opener=type('O',(),{'open':lambda self,*a,**k:(_ for _ in ()).throw(error)})()
    cloud=Cloud('project-14023673-32d6-4bf2-8b7','southamerica-east1')
    with patch('scripts.cloud.deploy_fashn_vertex.command',return_value='TOKEN'),patch('scripts.cloud.deploy_fashn_vertex.urllib.request.build_opener',return_value=opener):
        with pytest.raises(RuntimeError) as raised:cloud.request('POST','projects/p/locations/l/endpoints/e:predict',{'instances':[{}]},host='x.prediction.vertexai.goog')
    message=str(raised.value)
    assert 'GOOGLE_CLOUD_HTTP_422' in message and 'EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED' in message and 'exatamente uma pessoa' in message
    assert 'QUJDREVGR0hJSktM' not in message and 'TOKEN' not in message


def test_management_error_shows_google_reason_and_poll_rides_out_a_transient_403():
    import io,urllib.error
    from scripts.cloud.deploy_fashn_vertex import Cloud,CloudHTTPError
    body=json.dumps({'error':{'code':403,'status':'PERMISSION_DENIED','message':'Permission aiplatform.operations.get denied; Bearer abc.def',
        'details':[{'@type':'type.googleapis.com/google.rpc.ErrorInfo','reason':'IAM_PERMISSION_DENIED'}]}}).encode()
    def failing(code,payload):
        error=urllib.error.HTTPError('https://us-central1-aiplatform.googleapis.com/v1/op',code,'x',{},io.BytesIO(payload))
        return type('O',(),{'open':lambda self,*a,**k:(_ for _ in ()).throw(error)})()
    cloud=Cloud('project-14023673-32d6-4bf2-8b7','us-central1')
    with patch('scripts.cloud.deploy_fashn_vertex.command',return_value='TOKEN'),patch('scripts.cloud.deploy_fashn_vertex.urllib.request.build_opener',return_value=failing(403,body)):
        with pytest.raises(CloudHTTPError) as raised:cloud.request('GET','projects/p/locations/l/endpoints/e/operations/1')
    message=str(raised.value)
    assert raised.value.status==403 and 'PERMISSION_DENIED' in message and 'IAM_PERMISSION_DENIED' in message and 'operations.get denied' in message
    assert 'abc.def' not in message and 'TOKEN' not in message
    # :predict keeps hiding the body even when it is a Google JSON error that could echo the photos.
    with patch('scripts.cloud.deploy_fashn_vertex.command',return_value='TOKEN'),patch('scripts.cloud.deploy_fashn_vertex.urllib.request.build_opener',return_value=failing(403,body)):
        with pytest.raises(CloudHTTPError) as raised:cloud.request('POST','projects/p/locations/l/endpoints/e:predict',{'instances':[{}]},host='x.prediction.vertexai.goog')
    assert 'operations.get denied' not in str(raised.value)
    # Poll: one transient 403 is retried and the wait still returns the finished operation.
    done={'name':'op/1','done':True,'response':{'ok':1}}
    with patch.object(cloud,'request',side_effect=[CloudHTTPError(403,'GOOGLE_CLOUD_HTTP_403'),done]) as request,patch('scripts.cloud.deploy_fashn_vertex.time.sleep'):
        assert cloud.wait({'name':'op/1','done':False})=={'ok':1}
    assert request.call_count==2
    # A persistent error still stops after the retries; a 404 is not retried.
    with patch.object(cloud,'request',side_effect=CloudHTTPError(403,'GOOGLE_CLOUD_HTTP_403')) as request,patch('scripts.cloud.deploy_fashn_vertex.time.sleep'):
        with pytest.raises(CloudHTTPError):cloud.wait({'name':'op/1','done':False})
    assert request.call_count==4
    with patch.object(cloud,'request',side_effect=CloudHTTPError(404,'GOOGLE_CLOUD_HTTP_404')) as request,patch('scripts.cloud.deploy_fashn_vertex.time.sleep'):
        with pytest.raises(CloudHTTPError):cloud.wait({'name':'op/1','done':False})
    assert request.call_count==1


def test_deploy_wait_shows_the_stage_and_a_local_timeout_says_the_operation_keeps_running(capsys):
    from scripts.cloud.deploy_fashn_vertex import Cloud
    cloud=Cloud('project-14023673-32d6-4bf2-8b7','us-central1')
    running={'name':'op/9','done':False,'metadata':{'@type':'type.googleapis.com/google.cloud.aiplatform.v1.DeployModelOperationMetadata',
        'deploymentStage':'ADDING_NODES_TO_CLUSTER'}}
    with patch.object(cloud,'request',return_value={'name':'op/9','done':True,'response':{'deployedModel':{'id':'7'}}}),patch('scripts.cloud.deploy_fashn_vertex.time.sleep'):
        assert cloud.wait(running)=={'deployedModel':{'id':'7'}}
    assert 'DeployModelOperationMetadata [ADDING_NODES_TO_CLUSTER]' in capsys.readouterr().out
    with pytest.raises(RuntimeError) as raised:cloud.wait(running,seconds=-1)
    assert 'CLOUD_OPERATION_STILL_RUNNING: op/9 (etapa ADDING_NODES_TO_CLUSTER)' in str(raised.value)


def test_smoke_photos_are_checked_and_fitted_before_any_deploy(tmp_path):
    import io
    from PIL import Image
    from scripts.cloud.deploy_fashn_vertex import image_size,image_payload,MAX_SIDE
    def save(name,size,fmt,mode='RGB'):
        path=tmp_path/name;Image.new(mode,size,(200,40,40) if mode=='RGB' else (200,40,40,255)).save(path,fmt);return path
    assert image_size(save('a.png',(572,380),'PNG').read_bytes())==(572,380)
    assert image_size(save('b.jpg',(640,480),'JPEG').read_bytes())==(640,480)
    assert image_size(save('c.webp',(640,540),'WEBP','RGBA').read_bytes())==(640,540)
    encoded,digest=image_payload(save('phone.jpg',(3024,4032),'JPEG'))   # foto de celular: o servidor recusaria (1536 px)
    with Image.open(io.BytesIO(base64.b64decode(encoded))) as fitted:
        assert max(fitted.size)==MAX_SIDE and abs(fitted.width/fitted.height-3024/4032)<0.01
    assert digest==hashlib.sha256(base64.b64decode(encoded)).hexdigest()
    heic=tmp_path/'photo.heic';heic.write_bytes(b'\x00\x00\x00\x18ftypheic'+b'\x00'*64)
    with pytest.raises(ValueError,match='FORMAT_UNSUPPORTED'):image_payload(heic)
    small,_=image_payload(save('ok.png',(572,380),'PNG'))
    assert base64.b64decode(small)==(tmp_path/'ok.png').read_bytes()       # dentro do limite: bytes intactos


def test_undeploy_removes_only_the_saved_model_replica(tmp_path):
    from scripts.cloud.deploy_fashn_vertex import undeploy_ours
    state=tmp_path/'deployment.json'
    state.write_text(json.dumps({'project':'project-14023673-32d6-4bf2-8b7','endpoint':'projects/p/locations/l/endpoints/e','model':'models/ours'}))
    calls=[]
    class FakeCloud:
        project='project-14023673-32d6-4bf2-8b7'
        def request(self,method,path,body=None,host=None):
            calls.append((method,path,body))
            if method=='GET':return {'deployedModels':[{'id':'1','model':'models/ours'},{'id':'2','model':'models/someone-else'}]}
            return {'name':'operations/x','done':True}
        def wait(self,operation,seconds=0):return {}
    assert undeploy_ours(FakeCloud(),state)==['1']
    posts=[c for c in calls if c[0]=='POST']
    assert posts==[('POST','projects/p/locations/l/endpoints/e:undeployModel',{'deployedModelId':'1','trafficSplit':{}})]
    state.write_text(json.dumps({'project':'outro-projeto','endpoint':'e','model':'m'}))
    with pytest.raises(RuntimeError,match='ANOTHER_PROJECT'):undeploy_ours(FakeCloud(),state)


def test_deploy_only_moves_region_with_the_built_image_and_keeps_the_gpu(tmp_path,monkeypatch,capsys):
    from scripts.cloud import deploy_fashn_vertex as installer
    project='fashionai-test';image=f'southamerica-east1-docker.pkg.dev/{project}/fashionai-vton/fashn:00d264820803'
    monkeypatch.setattr('sys.argv',['deploy','--deploy-only','--project',project,'--region','us-central1',
        '--source-image',image,'--accelerator','NVIDIA_L4','--output',str(tmp_path)])
    with patch.object(installer,'command',side_effect=AssertionError('plan must not call cloud')):installer.main()
    plan=json.loads(capsys.readouterr().out)        # sem --apply: só o plano, sem fotos
    assert plan['executed'] is False and plan['deployOnly'] and plan['accelerator']=='NVIDIA_L4' and plan['machineType']=='g2-standard-8' and plan['image']==image
    monkeypatch.setattr('sys.argv',['deploy','--apply','--deploy-only','--project',project,'--region','us-central1',
        '--source-image',image,'--accelerator','NVIDIA_L4','--output',str(tmp_path)])
    commands=[];calls=[];endpoint={'name':'projects/p/locations/us-central1/endpoints/9','displayName':installer.NAME,
        'dedicatedEndpointEnabled':True,'dedicatedEndpointDns':'9.us-central1-1.prediction.vertexai.goog','deployedModels':[]}
    def fake_command(*args,**kwargs):
        commands.append(args)
        if args[:3]==('artifacts','repositories','list'):return json.dumps([{'name':'projects/test/repositories/fashionai-vton'}])
    def fake_request(self,method,path,body=None,host=None):
        calls.append((method,path,body))
        if path.endswith('/models:upload'):return {'name':'UPLOAD','done':True,'response':{'model':'MODEL_US'}}
        if path.endswith(':deployModel'):return {'name':'DEPLOY_OP','done':True,'response':{'deployedModel':{'id':'777'}}}
        if method=='GET' and path==endpoint['name']:return endpoint
        raise AssertionError((method,path))
    with patch.object(installer.Cloud,'endpoints',return_value=[]),patch.object(installer.Cloud,'request',fake_request),\
         patch.object(installer.Cloud,'wait',lambda self,op,seconds=0:op.get('response',{})),patch.object(installer,'command',side_effect=fake_command),\
         patch('scripts.cloud.deploy_fashn_vertex.subprocess.run',return_value=type('R',(),{'stdout':'0'*40})()):
        endpoint_create=[]
        orig=fake_request
        def request(self,method,path,body=None,host=None):
            if path.endswith('/endpoints') and method=='POST':endpoint_create.append(body);return {'name':'CREATE','done':True,'response':endpoint}
            return orig(self,method,path,body,host)
        with patch.object(installer.Cloud,'request',request):installer.main()
    out=capsys.readouterr().out
    assert '"status": "GPU_DEPLOYED"' in out and 'permanece ativa' in out
    upload=[b for m,p,b in calls if p.endswith('/models:upload')][0]['model']['containerSpec']
    assert upload['imageUri']==image and upload['startupProbe']['failureThreshold']==60   # mesma imagem, sondas do cold start
    deploy=[b for m,p,b in calls if p.endswith(':deployModel')][0]['deployedModel']['dedicatedResources']['machineSpec']
    assert deploy=={'machineType':'g2-standard-8','acceleratorType':'NVIDIA_L4','acceleratorCount':1}
    assert not any(p.endswith(':predict') or p.endswith(':undeployModel') for _,p,_ in calls)      # sem teste e sem desligar
    assert not any(c[:2]==('builds','submit') for c in commands)                                    # sem novo Cloud Build
    config=json.loads((tmp_path/'backend-config.json').read_text())
    assert config['GOOGLE_CLOUD_LOCATION']=='us-central1' and config['VTON_VERTEX_TRYON_ENDPOINT_ID']=='9'


def test_source_image_must_belong_to_the_project(monkeypatch):
    from scripts.cloud import deploy_fashn_vertex as installer
    monkeypatch.setattr('sys.argv',['deploy','--deploy-only','--project','fashionai-test','--source-image','docker.io/someone/else:latest'])
    with pytest.raises(SystemExit):installer.main()


def test_t4_serves_float32_because_emulated_bf16_exhausts_its_memory():
    class Cuda:
        def __init__(self,native):self.native=native
        def is_bf16_supported(self,including_emulation=True):return self.native or including_emulation
    class Torch:
        bfloat16='bf16';float32='fp32'
        def __init__(self,native):self.cuda=Cuda(native)
    assert serving_dtype(Torch(native=False))=='fp32'   # Turing/T4: torch says "supported" only by emulation
    assert serving_dtype(Torch(native=True))=='bf16'    # Ampere+/L4: native bf16, as FASHN ships its weights
