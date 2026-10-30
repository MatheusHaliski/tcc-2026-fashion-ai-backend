"""Artifact contract regression: no GPU, network, database or real storage."""
import hashlib
import io
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from scripts.catalog.photo_set_artifacts import ready_files, upload_verified
from scripts.catalog import process_photo_sets as worker


class ArtifactTest(unittest.TestCase):
    def fixture(self, directory):
        root = Path(directory)
        for name, size in [('whole', (900, 1200)), ('fabric', (48, 64))]:
            Image.new('RGB', size, '#3268a4').save(root / (name + '.png'))
        return root / 'set.json', {'whole': 'whole.png', 'fabric': 'fabric.png'}

    def test_accepts_exact_files_without_reencoding_and_keeps_worker_entrypoint(self):
        with tempfile.TemporaryDirectory() as directory:
            path, files = self.fixture(directory)
            data, error = ready_files(path, files)
            self.assertIsNone(error)
            self.assertEqual(data['whole'], (path.parent / 'whole.png').read_bytes())
            self.assertEqual(worker.ready_files(path, files), (data, None))

    def test_rejects_traversal_corruption_wrong_dimensions_and_oversize(self):
        with tempfile.TemporaryDirectory() as directory:
            path, files = self.fixture(directory)
            self.assertEqual(ready_files(path, {**files, 'whole': '../whole.png'}), (None, 'PHOTO_SET_FILES_INVALID'))
            (path.parent / 'fabric.png').write_bytes(b'not PNG')
            self.assertEqual(ready_files(path, files), (None, 'PHOTO_SET_FILES_INVALID'))
            path, files = self.fixture(directory)
            Image.new('RGB', (48, 64), 'blue').save(path.parent / 'whole.png')
            self.assertEqual(ready_files(path, files), (None, 'PHOTO_SET_FILES_INVALID'))
            path, files = self.fixture(directory)
            with (path.parent / 'whole.png').open('ab') as stream:
                stream.truncate(15_000_001)
            self.assertEqual(ready_files(path, files), (None, 'PHOTO_SET_FILES_INVALID'))

    def test_rejects_symlinked_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            path, files = self.fixture(directory)
            (path.parent / 'fabric.png').rename(path.parent / 'other.png')
            (path.parent / 'fabric.png').symlink_to('other.png')
            self.assertEqual(ready_files(path, files), (None, 'PHOTO_SET_FILES_INVALID'))

    def test_upload_preserves_version_hash_bytes_and_verifies_readback(self):
        class Storage:
            bucket = 'test'
            base = 'https://example.invalid'
            tamper = False
            def __init__(self): self.client = self
            def put_object(self, **request): self.request = request
            def get_object(self, **request):
                self.body = io.BytesIO(self.request['Body'] + (b'changed' if self.tamper else b''))
                return {'Body': self.body}
        store = Storage()
        payload = b'unchanged bytes'
        url = upload_verified(store, payload, 'test-version')
        self.assertEqual(url, f'https://example.invalid/catalog/photo-sets/test-version/{hashlib.sha256(payload).hexdigest()}.png')
        self.assertEqual(store.request['Body'], payload)
        self.assertTrue(store.body.closed)
        store.tamper = True
        with self.assertRaisesRegex(ValueError, 'UPLOAD_VERIFICATION_FAILED'):
            upload_verified(store, payload, 'test-version')
        self.assertTrue(store.body.closed)
