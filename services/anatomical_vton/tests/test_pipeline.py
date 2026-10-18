import base64
import tempfile
import time
import unittest
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient
from services.anatomical_vton.models import Anchor,AnchorRule,Observation,AlignmentError
from services.anatomical_vton.anchors import extract_garment_and_body_anchors
from services.anatomical_vton.warping import apply_constrained_anatomical_warping,ConstrainedTPS
from services.anatomical_vton.compositing import blend_skin_and_cloth
from services.anatomical_vton.auto_catalog import GarmentAutoAnnotator,GarmentAttributeSchema,png_bytes
from services.anatomical_vton.store import ArtifactStore,CatalogStore
from services.anatomical_vton.monitor import AutoGarmentProcessor,ingest_manifest
from services.anatomical_vton.api import create_app,mirror_result


def fixture():
    image=np.zeros((64,64,4),np.uint8);image[8:56,12:52]=[30,100,220,255]
    # Belt/custom profile keeps fixtures geometric; no fake human detector.
    points={'waist_left':Anchor(12,24),'waist_center':Anchor(32,24),
            'waist_right':Anchor(51,24),'waist_lower':Anchor(32,40)}
    observation=Observation(points,(image[:,:,3]>0).astype(float))
    return image,observation


class FakeProvider:
    calls=0
    def annotate(self,image,schema,feedback=None):
        self.calls+=1
        garment,observation=fixture()
        return {'attributes':{'category':'belt','subcategory':'belt','neckline_type':'none',
                'sleeve_length':'sleeveless','closure_type':'none','waistline_type':'mid_waist','fit_type':'regular','confidence':.99},
                'keypoints':{k:{'x':v.x,'y':v.y,'confidence':.99} for k,v in observation.anchors.items()},
                'mask_png':base64.b64encode(png_bytes((observation.mask*255).astype(np.uint8))).decode(),
                'provider':'TEST_FIXTURE_ONLY','model_version':'test-v1'}


class GeometryTests(unittest.TestCase):
    def test_hard_points_and_closure_are_preserved(self):
        image,obs=fixture();person=np.zeros((64,64,3),np.uint8)
        anchors=extract_garment_and_body_anchors(image,person,'BELT',garment=obs,body=obs,
            placket_source=[[32,25],[32,39]],placket_target=[[32,25],[32,39]])
        result=apply_constrained_anatomical_warping(image,anchors,(64,64))
        self.assertLess(result.diagnostics['hardAnchorErrorPx'],1e-6)
        self.assertLess(result.diagnostics['placketErrorPx'],1e-6)
        np.testing.assert_array_equal(result.rgba,image)
    def test_mixed_hard_and_soft_constraints_do_not_relax_hard_points(self):
        src=np.array([[0,0],[100,0],[0,100],[100,100],[50,50]],float)
        dst=src.copy();dst[-1]+=[20,5]
        tps=ConstrainedTPS(src,dst,np.array([1,1,1,1,0],bool),np.ones(5),rigidity=.2)
        self.assertLess(np.linalg.norm(tps(src[:4])-dst[:4],axis=1).max(),1e-6)
        self.assertGreater(np.linalg.norm(tps(src[-1:])-dst[-1:]),.1)
    def test_no_detector_and_unknown_categories_fail_closed(self):
        image,obs=fixture();person=np.zeros((64,64,3),np.uint8)
        with self.assertRaisesRegex(AlignmentError,'EVIDENCE_REQUIRED'):extract_garment_and_body_anchors(image,person,'BELT')
        with self.assertRaisesRegex(AlignmentError,'UNSUPPORTED_CATEGORY'):extract_garment_and_body_anchors(image,person,'ALIEN',garment=obs,body=obs)
    def test_missing_low_confidence_and_out_of_bounds_points_are_rejected(self):
        image,obs=fixture();person=np.zeros((64,64,3),np.uint8)
        for point in [Anchor(12,24,.2),Anchor(-1,24)]:
            broken=Observation({**obs.anchors,'waist_left':point},obs.mask)
            with self.assertRaises(AlignmentError):extract_garment_and_body_anchors(image,person,'BELT',garment=broken,body=obs)
    def test_reflection_is_rejected_by_fold_detection(self):
        image,obs=fixture();person=np.zeros((64,64,3),np.uint8)
        reflected=Observation({k:Anchor(63-a.x,a.y) for k,a in obs.anchors.items()},obs.mask)
        anchors=extract_garment_and_body_anchors(image,person,'BELT',garment=obs,body=reflected)
        with self.assertRaisesRegex(AlignmentError,'REFLECTED'):apply_constrained_anatomical_warping(image,anchors,(64,64))
    def test_skin_and_outside_region_are_unchanged_after_feather(self):
        image,obs=fixture();person=np.full((64,64,3),170,np.uint8);skin=np.zeros((64,64));skin[24:30,20:40]=1
        allowed=obs.mask.copy();allowed[:15]=0
        out=blend_skin_and_cloth(person,image,np.ones((64,64)),skin,allowed)
        np.testing.assert_array_equal(out[skin==1],person[skin==1]);np.testing.assert_array_equal(out[allowed==0],person[allowed==0])
    def test_mirror_pixel_centers_and_double_reflection(self):
        image,_=fixture();out,points=mirror_result(image,{'wrist':{'x':0,'y':12}})
        self.assertEqual(points['wrist']['x'],63)
        np.testing.assert_array_equal(mirror_result(out)[0],image)


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();root=Path(self.directory.name)
        self.store=CatalogStore('sqlite:///'+str(root/'queue.sqlite'),ArtifactStore(root/'artifacts'))
        self.provider=FakeProvider();self.worker=AutoGarmentProcessor(self.store,GarmentAutoAnnotator(self.provider,'test-v1'))
    def tearDown(self):self.directory.cleanup()
    def test_reuse_and_new_image_do_not_override_current_mapping(self):
        image,_=fixture();first=self.store.enqueue('product1',image,'test-v1');self.assertEqual(self.worker.process_one()['status'],'READY')
        self.store.enqueue('product2',image,'test-v1');self.assertEqual(self.worker.process_one()['status'],'IDLE');self.assertEqual(self.provider.calls,1)
        old=self.store.get('product1');image[0,0]=[1,2,3,4];new=self.store.enqueue('product1',image,'test-v1')
        self.assertNotEqual(first['jobKey'],new['jobKey']);self.assertEqual(self.store.get('product1')['state'],'PENDING');self.assertEqual(old['state'],'READY')
    def test_old_lease_cannot_publish_over_new_worker(self):
        image,_=fixture();self.store.enqueue('p1',image,'test-v1');now=time.time()+1
        first=self.store.claim(now=now,lease_seconds=120);second=self.store.claim(now=now+121)
        annotation=self.worker.annotator.annotate(image)
        self.assertFalse(self.store.complete(first,annotation));self.assertTrue(self.store.complete(second,annotation))
    def test_no_configured_model_keeps_new_clothes_pending(self):
        image,_=fixture();self.store.enqueue('p1',image,'test-v1')
        result=AutoGarmentProcessor(self.store,GarmentAutoAnnotator(None,'test-v1')).process_one()
        self.assertEqual(result['status'],'MODEL_NOT_CONFIGURED');self.assertEqual(self.store.get('p1')['attempts'],0)
    def test_retry_limit_and_model_version_cache(self):
        image,_=fixture();self.store.enqueue('p1',image,'test-v1');now=time.time()+1000
        for i in range(3):
            job=self.store.claim(now=now+i*1000);self.store.fail(job,AlignmentError('BAD_ANCHOR'))
        self.assertEqual(self.store.get('p1')['state'],'DEAD');self.assertIsNone(self.store.claim(now=now+4000))
        self.store.enqueue('p1',image,'test-v2');self.assertEqual(self.store.get('p1')['attempts'],0)
    def test_feed_checkpoint_is_incremental_and_partial_lines_wait(self):
        root=Path(self.directory.name);image,_=fixture();(root/'image.png').write_bytes(png_bytes(image));feed=root/'feed.jsonl'
        feed.write_text('{"garment_id":"p1","image_path":"image.png"}\n{"garment_id":')
        self.assertEqual(ingest_manifest(self.store,feed,'test-v1'),1);self.assertEqual(ingest_manifest(self.store,feed,'test-v1'),0)
    def test_worker_auth_and_pending_route(self):
        app=create_app(self.store,self.worker.annotator,token='test-only');image,_=fixture();encoded=base64.b64encode(png_bytes(image)).decode()
        with TestClient(app) as client:
            self.assertEqual(client.post('/v1/catalog/p1',json={'garment_image':encoded}).status_code,401)
            headers={'Authorization':'Bearer test-only'}
            self.assertEqual(client.post('/v1/catalog/p1',json={'garment_image':encoded},headers=headers).status_code,200)
            result=client.post('/try-on',json={'garment_id':'p1','person_image':encoded},headers=headers)
            self.assertEqual(result.status_code,202);self.assertEqual(result.json()['status'],'PENDING')

if __name__=='__main__':unittest.main()
