from types import SimpleNamespace
import unittest
import base64
from fastapi.testclient import TestClient
from services.anatomical_vton.api import create_app
from services.anatomical_vton.auto_catalog import png_bytes
import numpy as np
from services.anatomical_vton.body_pose import pose_result
from services.anatomical_vton.models import AlignmentError


class PoseEvidenceTests(unittest.TestCase):
    def landmarks(self):return [SimpleNamespace(x=.5,y=.5,visibility=.95,presence=.95) for _ in range(33)]

    def test_real_pose_output_is_never_promoted_to_anatomical_evidence(self):
        result=pose_result(self.landmarks(),np.ones((32,64)),64,32,'TEST_ONLY')
        self.assertEqual(result['status'],'POSE_ONLY')
        self.assertFalse(result['anatomicalAnchorsComplete'])
        self.assertFalse(result['physicalFitCertified'])
        self.assertIn('foreground_skin_occlusion',result['missingEvidence'])

    def test_single_channel_mediapipe_mask_is_supported(self):
        result=pose_result(self.landmarks(),np.ones((32,64,1)),64,32,'TEST_ONLY')
        self.assertTrue(result['body_mask'])
        with self.assertRaises(AlignmentError):pose_result(self.landmarks(),np.ones((32,64,3)),64,32,'TEST_ONLY')

    def test_unseen_joints_are_not_clamped_back_into_image_or_counted(self):
        points=self.landmarks();points[0].x=1.1;points[1].visibility=.2
        result=pose_result(points,np.ones((32,64)),64,32,'TEST_ONLY')
        self.assertGreater(result['landmarks'][0]['x'],63)
        self.assertEqual(result['visibleLandmarks'],31)

    def test_wrong_or_nonfinite_model_outputs_are_rejected(self):
        with self.assertRaises(AlignmentError):pose_result([],np.ones((32,64)),64,32,'TEST_ONLY')
        with self.assertRaises(AlignmentError):pose_result(self.landmarks(),np.full((32,64),np.nan),64,32,'TEST_ONLY')
        with self.assertRaises(AlignmentError):pose_result(self.landmarks(),np.zeros((32,64)),64,32,'TEST_ONLY')

class PoseApiTests(unittest.TestCase):
    def test_pose_route_requires_authentication_and_disables_cache(self):
        class TestProbe:
            calls=0
            def detect(self,image):
                self.calls+=1
                return {'status':'POSE_ONLY','anatomicalAnchorsComplete':False,'physicalFitCertified':False}
        probe=TestProbe();image=base64.b64encode(png_bytes(np.zeros((32,32,3),np.uint8))).decode()
        with TestClient(create_app(token='test-token',pose_probe=probe)) as client:
            self.assertEqual(client.post('/v1/body/pose',json={'person_image':image}).status_code,401)
            self.assertEqual(probe.calls,0)
            response=client.post('/v1/body/pose',json={'person_image':image},headers={'Authorization':'Bearer test-token'})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.headers['cache-control'],'no-store')
            self.assertFalse(response.json()['anatomicalAnchorsComplete'])
            self.assertEqual(probe.calls,1)


if __name__=='__main__':unittest.main()
