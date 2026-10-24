import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.catalog.prepare_photo_models import prepare, verified


class ModelProvisioningTest(unittest.TestCase):
    def setUp(self):
        self.payload = b'immutable-public-model-fixture'
        self.sha = hashlib.sha256(self.payload).hexdigest()
        self.models = [('parser/model.safetensors', 'https://models.example/immutable',
                        len(self.payload), self.sha)]

    def test_valid_cache_is_reused_without_network_and_same_size_corruption_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp, patch('scripts.catalog.prepare_photo_models.MODELS', self.models), \
                patch('scripts.catalog.prepare_photo_models.urllib.request.urlopen') as network:
            target = Path(tmp)/self.models[0][0]
            target.parent.mkdir()
            target.write_bytes(self.payload)
            evidence = prepare(tmp)
            self.assertTrue(evidence['models'][0]['verified'])
            self.assertEqual(self.sha, evidence['models'][0]['sha256'])
            network.assert_not_called()
            target.write_bytes(b'x'*len(self.payload))
            self.assertFalse(verified(target, len(self.payload), self.sha))
            with self.assertRaisesRegex(ValueError, 'CATALOG_MODEL_MISSING_OR_HASH_MISMATCH'):
                prepare(tmp)
            network.assert_not_called()

    def test_download_replaces_only_verified_bytes_and_reuses_cache(self):
        with tempfile.TemporaryDirectory() as tmp, patch('scripts.catalog.prepare_photo_models.MODELS', self.models), \
                patch('scripts.catalog.prepare_photo_models.urllib.request.urlopen', return_value=io.BytesIO(self.payload)) as network:
            prepare(tmp, download=True)
            target = Path(tmp)/self.models[0][0]
            self.assertEqual(self.payload, target.read_bytes())
            prepare(tmp, download=True)
            network.assert_called_once_with(self.models[0][1], timeout=60)
            self.assertEqual([target], list(target.parent.iterdir()))

    def test_bad_or_oversize_download_never_replaces_cache_or_leaves_temporary_files(self):
        for payload, reason in [(b'x'*len(self.payload), 'HASH_MISMATCH'),
                                (self.payload+b'x', 'OVERSIZE')]:
            with self.subTest(reason=reason), tempfile.TemporaryDirectory() as tmp, \
                    patch('scripts.catalog.prepare_photo_models.MODELS', self.models), \
                    patch('scripts.catalog.prepare_photo_models.urllib.request.urlopen', return_value=io.BytesIO(payload)):
                target = Path(tmp)/self.models[0][0]
                target.parent.mkdir()
                target.write_bytes(b'old-invalid-cache')
                with self.assertRaisesRegex(ValueError, 'CATALOG_MODEL_'+reason):
                    prepare(tmp, download=True)
                self.assertEqual(b'old-invalid-cache', target.read_bytes())
                self.assertEqual([target], list(target.parent.iterdir()))


if __name__ == '__main__':
    unittest.main()
