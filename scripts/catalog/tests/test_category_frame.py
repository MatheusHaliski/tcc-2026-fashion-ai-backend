import json
import unittest
from scripts.catalog.category_frame import POLICY, apply_frame


class CategoryFrameTest(unittest.TestCase):
    """Modo padrão: o quadro de tecido do Java, focos de zíper/cadarço estimados pedem revisão, nunca quadro com fundo."""

    def response(self, width=1200, height=1600, fabric=None):
        return {'columns': {'width': width, 'height': height, 'processing_status': 'APPROVED',
                            'crop_json': json.dumps({'product': {'x': .1, 'y': .1, 'w': .8, 'h': .8}})},
                'fabricFrame': fabric if fabric is not None else {
                    'ok': True, 'crop': {'x': .375, 'y': .3, 'w': .25, 'h': .25}, 'target': 'chest', 'fabricCoverage': 1.0,
                    'anchor': {'x': .5, 'y': .4, 'source': 'ESTIMATED_CHEST'}}}

    def test_pixel_aspect_and_fabric_policy(self):
        original = self.response()
        crop = json.loads(apply_frame(original, 'upper_piece')['columns']['crop_json'])
        r = crop['crop']
        self.assertAlmostEqual(r['w'] * 1200 / (r['h'] * 1600), .75)
        self.assertEqual(crop['editorFrame']['policy'], POLICY)
        self.assertEqual(original['columns']['processing_status'], 'APPROVED')

    def test_estimated_landmarks_require_review(self):
        for category, target in [('lower_piece', 'fly'), ('shoes_piece', 'upper')]:
            fabric = {'ok': True, 'crop': {'x': .375, 'y': .3, 'w': .25, 'h': .25}, 'target': target, 'fabricCoverage': 1.0,
                      'anchor': {'x': .5, 'y': .4, 'source': 'ESTIMATED_X'}}
            result = apply_frame(self.response(fabric=fabric), category)['columns']
            self.assertEqual(result['processing_status'], 'NEEDS_REPROCESSING')
            self.assertTrue(json.loads(result['crop_json'])['editorFrame']['requiresReview'])

    def test_no_fabric_frame_and_unknown_category(self):
        with self.assertRaisesRegex(ValueError, 'FABRIC_FRAME_UNAVAILABLE'):
            apply_frame(self.response(fabric={'ok': False, 'reason': 'NO_FABRIC_REGION'}), 'upper_piece')
        with self.assertRaises(ValueError):
            apply_frame(self.response(), 'unknown')

    def test_csv_gate_reasons_are_preserved(self):
        fabric = {'ok': True, 'crop': {'x': .375, 'y': .3, 'w': .25, 'h': .25}, 'target': 'upper', 'fabricCoverage': 1.0,
                  'anchor': {'x': .5, 'y': .4, 'source': 'ESTIMATED_UPPER'}}
        response = self.response(fabric=fabric)
        response['columns']['gate_reasons'] = 'LOW_RESOLUTION,FOCUS_UNCERTAIN'
        result = apply_frame(response, 'shoes_piece')['columns']
        self.assertEqual(result['gate_reasons'], 'LOW_RESOLUTION,FOCUS_UNCERTAIN,CATEGORY_FRAME_LANDMARK_REVIEW')


if __name__ == '__main__':
    unittest.main()
