import unittest
import numpy as np
from services.digital_twin.cleanup_hair_artifacts import smooth_disconnected_strands,optimize_ear_neck_collision,align_neckline_cut
from services.digital_twin.accessories import FootwearPoseWarper,HeadwearAndEyewearWarper
from services.digital_twin.body_shape_customizer import BodyMeasurements,ParametricBodyFitting
from services.anatomical_vton.bottomwear import BottomwearAttributeSchema,calculate_crotch_and_waist_constraints,InseamAnatomicalAlignment
from services.anatomical_vton.health import mask_iou,structural_similarity,reevaluate_catalog_pipeline,auto_fix_subcategory_pipeline

class GeometryTests(unittest.TestCase):
 def test_disconnected_root_is_reattached_without_flattening_curls(self):
  strands=np.array([[[.1,1,0],[.2,.9,.1],[.1,.8,0]]]);roots=np.array([[0,1,0]])
  out,report=smooth_disconnected_strands(strands,roots)
  np.testing.assert_allclose(out[:,1:]-out[:,:-1],strands[:,1:]-strands[:,:-1]);np.testing.assert_allclose(out[:,0],roots);self.assertEqual(report['repairedStrands'],1)
 def test_capsule_collision_pushes_fiber_outside_neck(self):
  roots=np.array([[.2,1,0]]);strands=np.array([[[.2,1,0],[.01,.9,0],[.02,.8,0]]]);out,report=optimize_ear_neck_collision(strands,roots,[{'a':[0,0,0],'b':[0,1,0],'radius':.1}]);self.assertTrue(np.all(np.linalg.norm(out[0,1:,[0,2]],axis=0)>=.1));self.assertLess(report['maxPenetrationM'],1e-5)
 def test_nape_cut_only_trims_selected_short_hair(self):
  strands=np.array([[[0,1,0],[0,.8,0],[0,.6,0]],[[1,1,0],[1,.8,0],[1,.6,0]]]);out,lengths=align_neckline_cut(strands,strands[:,0],nape_strands=[True,False],cut_point=[0,.7,0],cut_normal=[0,1,0]);self.assertAlmostEqual(out[0,-1,1],.7);np.testing.assert_array_equal(out[1],strands[1])
 def test_high_heel_pose_keeps_forefoot_contact(self):
  points={'heel':[0,0,0],'metatarsal':[0,0,.15],'toe':[0,0,.24],'ankle':[0,.08,.02]};out=FootwearPoseWarper().fit(points,heel_height_m=.08);self.assertGreater(out['keypoints']['heel'][1],.05);self.assertAlmostEqual(out['keypoints']['metatarsal'][1],0);self.assertTrue(out['requiresLegIK'])
 def test_unknown_pipeline_is_proposed_but_never_activated(self):
  candidate=auto_fix_subcategory_pipeline('unknown','new_shape');self.assertFalse(candidate['active']);self.assertEqual(candidate['status'],'REQUIRES_PIPELINE_GENERATION');self.assertEqual(candidate['candidateAnchors'],[])
 def test_qa_requires_aligned_ground_truth_and_collision_evidence(self):
  image=np.full((32,32,3),100,np.uint8);mask=np.ones((32,32),bool);self.assertEqual(reevaluate_catalog_pipeline(image,mask)['status'],'UNVERIFIED');self.assertAlmostEqual(structural_similarity(image,image),1);self.assertEqual(mask_iou(mask,mask),1);self.assertEqual(reevaluate_catalog_pipeline(image,mask,ground_truth=image,expected_mask=mask,cloth_body_signed_distances=np.ones(10))['status'],'PASS')
 def test_bottom_skirt_does_not_invent_a_crotch(self):
  attributes=BottomwearAttributeSchema(category='bottom',subcategory='skirt',neckline_type='none',sleeve_length='sleeveless',closure_type='none',waistline_type='mid_waist',fit_type='regular',confidence=.95,bottom_type='skirt',rise='mid',leg_fit='loose',fabric_stiffness=.2,hem_length='knee')
  angle=np.linspace(0,2*np.pi,12,endpoint=False);ring=np.c_[.2*np.cos(angle),np.ones(12),.15*np.sin(angle)]
  result=calculate_crotch_and_waist_constraints(attributes,ring,{'mid':ring});self.assertIsNone(result['crotchTarget']);np.testing.assert_allclose(result['targetRing'],ring,atol=1e-6)
 def test_body_fitting_refuses_uncalibrated_mass_instead_of_guessing_beta(self):
  class Backend:mass_model_calibrated=False
  with self.assertRaisesRegex(RuntimeError,'CALIBRATED_MASS'):ParametricBodyFitting(Backend()).fit(BodyMeasurements(170,70,85))

if __name__=='__main__':unittest.main()
