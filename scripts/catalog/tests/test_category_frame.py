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
        with self.assertRaises(ValueError): apply_frame(self.response(), 'full_body_piece')
