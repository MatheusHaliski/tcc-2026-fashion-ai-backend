"""Variant ownership and proof binding for the legacy whole-frame worker."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from PIL import Image, ImageDraw

from scripts.catalog import process_whole_frames as batch
from scripts.catalog.photo_set import PhotoMasks


class WholeFrameVariantContextTests(unittest.TestCase):
    def test_explicit_variant_without_product_owned_match_never_downloads_or_renders(self):
        for matched in (None, 'different-variant'):
            with self.subTest(matched=matched), tempfile.TemporaryDirectory() as tmp:
                downloader, provider, storage = Mock(), Mock(spec=['masks']), Mock()
                out = Path(tmp) / 'previews'
                record = {'id': 'image', 'product_id': 'product', 'variant_id': 'variant',
                          'matched_variant_id': matched, 'image_url': 'https://brand.example/photo.jpg'}
                with patch.object(batch, 'clean_target_mask') as cleanup, patch.object(batch, 'render_whole') as render:
                    result = batch.process(record, downloader, None, provider=provider, storage=storage, out_dir=out)
                self.assertEqual(('REVIEW', 'VARIANT_CONTEXT_UNRESOLVED'), (result['status'], result['reason']))
                self.assertEqual('variant', result['variantId'])
                self.assertIsNone(result['metrics']['sourceGarmentHeightFraction'])
                downloader.get.assert_not_called()
                provider.masks.assert_not_called()
                cleanup.assert_not_called()
                render.assert_not_called()
                storage.put.assert_not_called()
                self.assertFalse(out.exists())

    def test_rendered_proof_and_guarded_patch_bind_selected_variant_and_effective_color(self):
        for variant_id, color in [('blue-variant', 'blue'), ('blank-variant', ''), (None, 'product-color')]:
            with self.subTest(variant_id=variant_id, color=color), tempfile.TemporaryDirectory() as tmp:
                image = Image.new('RGB', (400, 500), 'white')
                mask = Image.new('L', image.size)
                ImageDraw.Draw(image).rectangle((100, 100, 299, 399), fill='blue')
                ImageDraw.Draw(mask).rectangle((100, 100, 299, 399), fill=255)
                path = Path(tmp) / 'source.png'
                image.save(path)
                provider = Mock(spec=['masks'])
                provider.masks.return_value = PhotoMasks(mask, Image.new('L', image.size), verified=True,
                    target_category='upper_piece', target_subcategory='shirt', human_present=False,
                    measurement_verified=True, isolation_verified=True, complete=True, occluded=False)
                downloader, storage = Mock(), Mock()
                downloader.get.return_value = path
                storage.put.return_value = 'https://media.example/catalog/whole/verified.jpg'
                record = {'id': 'image', 'image_version': 7, 'product_id': 'product', 'variant_id': variant_id,
                          'matched_variant_id': variant_id, 'color': color, 'category': 'upper_piece',
                          'subcategory': 'shirt', 'image_url': 'https://brand.example/photo.png'}
                result = batch.process(record, downloader, None, provider=provider, storage=storage)
                self.assertEqual('STORED', result['status'])
                proof = json.loads(result['patch']['json'])
                self.assertEqual({'imageId': 'image', 'variantId': variant_id, 'color': color,
                                  'category': 'upper_piece', 'subcategory': 'shirt'},
                                 {key: proof[key] for key in ('imageId', 'variantId', 'color', 'category', 'subcategory')})
                self.assertEqual(variant_id, result['patch']['variant_id'])
                self.assertEqual(color, result['patch']['color'])
                self.assertEqual(proof, result['info'])
                storage.put.assert_called_once()

    def test_database_contract_refreshes_stale_proof_and_guards_variant_ownership_and_color(self):
        # These clauses protect concurrent variant reassignment/recoloring, which
        # does not necessarily increment the selected image's version.
        for statement in (batch.SELECT, batch.UPDATE):
            self.assertIn('LEFT JOIN catalog_variants v ON v.id = i.variant_id AND v.product_id = p.id', statement)
            self.assertIn('COALESCE(v.color, p.color)', statement)
            self.assertNotIn('NULLIF', statement)
        self.assertIn('i.variant_id <=> %(variant_id)s', batch.UPDATE)
        self.assertIn('COALESCE(v.color, p.color) <=> %(color)s', batch.UPDATE)
        self.assertIn('(i.variant_id IS NULL OR v.id IS NOT NULL)', batch.UPDATE)
        self.assertIn('(i.variant_id IS NOT NULL AND v.id IS NULL)', batch.SELECT)
        self.assertIn('p.category = %(category)s AND p.subcategory <=> %(subcategory)s', batch.UPDATE)
        for name in ('imageId', 'variantId', 'color', 'category', 'subcategory'):
            self.assertIn("OR NOT (JSON_EXTRACT(i.whole_json, '$." + name + "') <=> CAST(", batch.SELECT)


if __name__ == '__main__':
    unittest.main()
