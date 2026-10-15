"""Transport/artifact checks with explicit test doubles; no trained-model accuracy claims."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import numpy as np
from fastapi.testclient import TestClient
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.google_cloud import VertexPredictionClient
from services.anatomical_vton.vertex_runtime.bundle import validate_bundle, points_from_tensor, mask_from_tensor
from services.anatomical_vton.vertex_runtime.server import create_app, PAYLOAD_LIMIT
from scripts.cloud.publish_vton_gpu import stage_context


class TestRuntime:
    ready=True
    def predict(self,instance):return {'testOnlyTask':instance['task']}


def fixture_bundle(root):
    # Intentionally not executable weights. Only manifest-integrity tests use them.
    for name in ('garment.pt','body.pt','calibration.json'):(root/name).write_bytes(b'TEST_FIXTURE_NOT_A_MODEL')
    sha=hashlib.sha256(b'TEST_FIXTURE_NOT_A_MODEL').hexdigest()
    def spec(file):return {'file':file,'sha256':sha,'license':'TEST_FIXTURE_ONLY',
        'anchor_names':['left','middle','right'],'supported_categories':['belt']}
    garment=spec('garment.pt');garment['labels']={
        'category':['belt'],'subcategory':['belt'],'neckline_type':['none'],
        'sleeve_length':['sleeveless'],'closure_type':['none'],
        'waistline_type':['mid_waist'],'fit_type':['regular']}
    manifest={'schema_version':1,'model_version':'TEST_ONLY','input_size':128,
        'calibration_report':'calibration.json','calibration_sha256':sha,'garment':garment,'body':{**spec('body.pt'),'labels':garment['labels']}}
    (root/'manifest.json').write_text(json.dumps(manifest));return manifest


class VertexServerTests(unittest.TestCase):
    def test_routes_both_tasks_on_one_runtime(self):
        with TestClient(create_app(TestRuntime())) as client:
            for instance in ({'task':'garment_annotation','image_png':'TEST_ONLY'},
                             {'task':'body_evidence','person_image':'TEST_ONLY','attributes':{}}):
                result=client.post('/predict',json={'instances':[instance]})
                self.assertEqual(result.status_code,200)
                self.assertEqual(result.json()['predictions'][0]['testOnlyTask'],instance['task'])
            self.assertEqual(client.get('/health').json()['maxConcurrency'],1)

    def test_bad_task_and_batch_are_rejected(self):
        with TestClient(create_app(TestRuntime())) as client:
            for instances in ([],[{'task':'download_url','url':'https://external.invalid'}],
                              [{'task':'garment_annotation','image_png':'a'}]*2,
                              [{'task':'body_evidence','image_png':'a'}]):
                self.assertEqual(client.post('/predict',json={'instances':instances}).status_code,422)

    def test_actual_stream_size_is_limited(self):
        with TestClient(create_app(TestRuntime())) as client:
            response=client.post('/predict',content=iter([b'x'*700_001,b'x'*700_001]))
            self.assertEqual(response.status_code,413)

    def test_oversized_response_and_private_errors_are_not_returned(self):
        class Oversized(TestRuntime):
            def predict(self,instance):return {'privateImage':'x'*PAYLOAD_LIMIT}
        class Broken(TestRuntime):
            def predict(self,instance):raise RuntimeError('PRIVATE_IMAGE_AND_CREDENTIAL_CONTENT')
        for runtime,status in ((Oversized(),413),(Broken(),503)):
            with TestClient(create_app(runtime)) as client:
                response=client.post('/predict',json={'instances':[{'task':'garment_annotation','image_png':'a'}]})
                self.assertEqual(response.status_code,status)
                self.assertNotIn('PRIVATE_',response.text)

    def test_single_gpu_rejects_parallel_work_but_health_stays_responsive(self):
        entered=threading.Event();release=threading.Event()
        class Blocking(TestRuntime):
            def predict(self,instance):
                entered.set()
                if not release.wait(5):raise RuntimeError('TEST_TIMEOUT')
                return {'testOnly':True}
        payload={'instances':[{'task':'garment_annotation','image_png':'a'}]}
        with TestClient(create_app(Blocking())) as client,ThreadPoolExecutor(1) as executor:
            future=executor.submit(client.post,'/predict',json=payload)
            try:
                self.assertTrue(entered.wait(2))
                self.assertEqual(client.get('/health').status_code,200)
                self.assertEqual(client.post('/predict',json=payload).status_code,429)
            finally:release.set()
            self.assertEqual(future.result(timeout=3).status_code,200)

    def test_missing_models_never_become_healthy(self):
        app=create_app(loader=lambda:(_ for _ in ()).throw(AlignmentError('MODEL_ARTIFACT_MISSING')))
        with self.assertRaisesRegex(AlignmentError,'MODEL_ARTIFACT_MISSING'):
            with TestClient(app):pass

    def test_vertex_client_rejects_oversized_input_before_authentication(self):
        client=VertexPredictionClient('fashionai-test','southamerica-east1','123')
        with patch.object(client,'_headers',side_effect=AssertionError('SHOULD_NOT_AUTHENTICATE')):
            with self.assertRaisesRegex(AlignmentError,'VERTEX_REQUEST_LIMIT'):
                client.predict({'image_png':'x'*PAYLOAD_LIMIT})


class ArtifactTests(unittest.TestCase):
    def test_missing_and_modified_weights_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);fixture_bundle(root);validate_bundle(root)
            (root/'body.pt').write_bytes(b'MODIFIED')
            with self.assertRaisesRegex(AlignmentError,'HASH_MISMATCH'):validate_bundle(root)
            (root/'body.pt').unlink()
            with self.assertRaisesRegex(AlignmentError,'ARTIFACT_MISSING'):validate_bundle(root)

    def test_external_symlink_and_path_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'bundle';root.mkdir();fixture_bundle(root)
            outside=Path(folder)/'outside.pt';outside.write_bytes(b'TEST_FIXTURE_NOT_A_MODEL')
            (root/'body.pt').unlink();(root/'body.pt').symlink_to(outside)
            with self.assertRaisesRegex(AlignmentError,'PATH_OUTSIDE_BUNDLE'):validate_bundle(root)

    def test_staging_excludes_unlisted_files_and_secrets(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'bundle';root.mkdir();fixture_bundle(root)
            (root/'credentials.json').write_text('TEST_SECRET_DO_NOT_COPY')
            stage=Path(folder)/'stage';stage.mkdir();stage_context(root,stage)
            self.assertFalse((stage/'model-bundle/credentials.json').exists())
            self.assertTrue((stage/'Dockerfile').is_file())
            validate_bundle(stage/'model-bundle')

    def test_normalized_coordinates_map_to_pixel_centers_without_clamping(self):
        points=points_from_tensor([[0,0,.9],[1,1,.95]],['left','right'],64,128)
        self.assertEqual(points['right']['x'],63)
        self.assertEqual(points['right']['y'],127)
        for values in ([[0,0,.2],[1,1,.95]],[[0,0,.9],[1.1,1,.9]]):
            with self.assertRaises(AlignmentError):points_from_tensor(values,['a','b'],64,128)
        with self.assertRaises(AlignmentError):mask_from_tensor(np.full((5,5),np.nan),64,128)


if __name__=='__main__':unittest.main()
