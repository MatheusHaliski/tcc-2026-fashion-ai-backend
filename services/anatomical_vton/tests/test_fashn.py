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
from services.anatomical_vton.fashn_runtime import fashion_category,pose_screen
from services.anatomical_vton.fashn_download import artifact_path,verify_file,download_file
from services.anatomical_vton.google_cloud import VertexPredictionClient
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.vertex_runtime.server import create_app
from scripts.cloud.deploy_fashn_vertex import stage_context,image_payload


def pose():return np.full((1,134,2),50.,float),np.ones((1,134),float)


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
    image=tmp_path/'test.png';image.write_bytes(b'TEST_ONLY')
    encoded,digest=image_payload(image)
    assert base64.b64decode(encoded)==b'TEST_ONLY'


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
