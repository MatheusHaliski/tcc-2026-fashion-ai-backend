import json
import unittest
from scripts.catalog.category_frame import apply_frame

class CategoryFrameTest(unittest.TestCase):
    def response(self, width=1200, height=1600):
        return {'columns': {'width': width, 'height': height, 'processing_status': 'APPROVED',
            'crop_json': json.dumps({'product': {'x': .1, 'y': .1, 'w': .8, 'h': .8},
                'focus': {'rect': {'x': .4, 'y': .1, 'w': .2, 'h': .2}}})}}

    def test_pixel_aspect_and_editor_width(self):
        original = self.response(1600, 1200)
        crop = json.loads(apply_frame(original, 'upper_piece')['columns']['crop_json'])
        r = crop['crop']
        self.assertEqual(r['w'], .5)
        self.assertAlmostEqual(r['w']*1600/(r['h']*1200), .75)
        self.assertAlmostEqual(r['x']+r['w']/2, .5)
        self.assertEqual(original['columns']['processing_status'], 'APPROVED')

    def test_estimated_landmarks_require_review(self):
        for category in ['lower_piece', 'shoes_piece']:
            result = apply_frame(self.response(), category)['columns']
            self.assertEqual(result['processing_status'], 'NEEDS_REPROCESSING')
            crop = json.loads(result['crop_json'])
            self.assertTrue(crop['editorFrame']['requiresReview'])
            self.assertGreaterEqual(crop['crop']['y'], 0)

    def test_frame_too_tall_and_unknown_category(self):
        with self.assertRaises(ValueError): apply_frame(self.response(4000, 1000), 'upper_piece')
        with self.assertRaises(ValueError): apply_frame(self.response(), 'unknown')

    def test_csv_gate_reasons_are_preserved(self):
        response = self.response()
        response['columns']['gate_reasons'] = 'LOW_RESOLUTION,FOCUS_UNCERTAIN'
        result = apply_frame(response, 'shoes_piece')['columns']
        self.assertEqual(result['gate_reasons'], 'LOW_RESOLUTION,FOCUS_UNCERTAIN,CATEGORY_FRAME_LANDMARK_REVIEW')

    def test_missing_product_is_not_reported_as_unknown_category(self):
        response = self.response()
        response['columns']['crop_json'] = None
        response['columns']['gate_reasons'] = 'NO_FOREGROUND'
        with self.assertRaisesRegex(ValueError, 'MISSING_PRODUCT:NO_FOREGROUND'):
            apply_frame(response, 'upper_piece')

    def test_full_body_uses_product_center(self):
        result = apply_frame(self.response(), 'full_body_piece')['columns']
        crop = json.loads(result['crop_json'])
        self.assertEqual(crop['editorFrame']['target'], 'garment_center')
        self.assertAlmostEqual(crop['crop']['y'] + crop['crop']['h']/2, .5)
