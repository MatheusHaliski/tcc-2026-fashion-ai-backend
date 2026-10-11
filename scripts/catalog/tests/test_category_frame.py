import json
import unittest
from scripts.catalog.category_frame import POLICY, VERSION, apply_frame


def product_frame(fit="COVER", align="TOP", crop=None, ok=True, reason=None, scope="FRAME", coverage=1.0, inside=1.0,
                  compliance_ok=True, target="neckline_top", observations=()):
    """Quadro como o CatalogImageBatchCli devolve (ProductRuleFrame.Result.toMap)."""
    return {"version": "PRODUCT_RULE_FRAME_V1", "ok": ok, "reason": reason,
            "crop": crop if crop is not None else ({"x": .375, "y": .3, "w": .25, "h": .25} if ok else None), "aspect": "3:4",
            "rule": {"fit": fit, "align": align, "view": "FRONT", "focusTopHalf": fit == "COVER"},
            "ruleSource": {"registry": "catalog/semantic-regions.json", "registryVersion": "2.1.0", "pieceType": "UPPER_PIECE",
                           "subcategory": "t_shirt", "origin": "pieceType"},
            "target": target, "focus": {"name": "collar_chest", "x": .5, "y": .35}, "product": {"x": .2, "y": .2, "w": .6, "h": .7},
            "model": False, "skinExcluded": 0.0, "garmentCoverage": coverage if scope else 0.0, "coverageScope": scope,
            "objectInside": inside, "padding": 0.0, "background": "#f0f0f0", "truncated": [], "sideView": None,
            "compliance": {"ok": compliance_ok, "focusInTopHalf": compliance_ok}, "cropWidthPx": 300, "observations": list(observations)}


class CategoryFrameTest(unittest.TestCase):
    """Modo padrão: o quadro da regra do produto do Java; dúvida de conformidade pede revisão; sem quadro, nada."""

    def response(self, width=1200, height=1600, frame=None):
        return {'columns': {'width': width, 'height': height, 'processing_status': 'APPROVED',
                            'crop_json': json.dumps({'product': {'x': .1, 'y': .1, 'w': .8, 'h': .8}, 'rule': {'fit': 'COVER'}})},
                'productFrame': frame if frame is not None else product_frame()}

    def test_pixel_aspect_and_product_rule_policy(self):
        original = self.response()
        result = apply_frame(original, 'upper_piece', subcategory='t_shirt')
        crop = json.loads(result['columns']['crop_json'])
        r = crop['crop']
        self.assertAlmostEqual(r['w'] * 1200 / (r['h'] * 1600), .75)
        editor = crop['editorFrame']
        self.assertEqual((editor['version'], editor['policy'], editor['fit'], editor['align']), (VERSION, POLICY, 'COVER', 'TOP'))
        self.assertEqual(editor['ruleSource']['registry'], 'catalog/semantic-regions.json')
        self.assertNotIn('rule', crop, 'a regra 4:5 antiga do card não sobrevive no recorte 3:4')
        self.assertEqual(result['columns']['processing_status'], 'APPROVED')
        self.assertEqual(original['columns']['processing_status'], 'APPROVED')

    def test_compliance_doubt_requires_review(self):
        result = apply_frame(self.response(frame=product_frame(compliance_ok=False)), 'upper_piece')['columns']
        self.assertEqual(result['processing_status'], 'NEEDS_REPROCESSING')
        editor = json.loads(result['crop_json'])['editorFrame']
        self.assertTrue(editor['requiresReview'])
        self.assertIn('RULE_COMPLIANCE_DOUBT', editor['observations'])

    def test_no_frame_and_unknown_category(self):
        with self.assertRaisesRegex(ValueError, 'FRAME_UNAVAILABLE:WAISTBAND_NOT_FOUND'):
            apply_frame(self.response(frame=product_frame(ok=False, reason='WAISTBAND_NOT_FOUND')), 'lower_piece')
        with self.assertRaises(ValueError):
            apply_frame(self.response(), 'unknown')

    def test_csv_gate_reasons_are_preserved(self):
        response = self.response(frame=product_frame(fit='WIDTH', align='CENTER', scope=None, compliance_ok=False, target='whole_shoe'))
        response['columns']['gate_reasons'] = 'LOW_RESOLUTION,FOCUS_UNCERTAIN'
        result = apply_frame(response, 'shoes_piece')['columns']
        self.assertEqual(result['gate_reasons'], 'LOW_RESOLUTION,FOCUS_UNCERTAIN,CATEGORY_FRAME_RULE_REVIEW')


if __name__ == '__main__':
    unittest.main()
