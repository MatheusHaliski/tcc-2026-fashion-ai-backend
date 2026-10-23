"""Load locally reviewed semantic evidence bound to original bytes and analysis pixels.

This is an operator review input, never an automatic conversion of a model's
output into trusted evidence. The standard local provider remains REVIEW until
its actual catalogue accuracy/completeness has been evaluated.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from PIL import Image
try:
    from .photo_set import PhotoMasks
except ImportError:
    from photo_set import PhotoMasks


class ReviewedMaskProvider:
    def __init__(self, manifest, *, source_sha256=None, source_url=None):
        self.path = Path(manifest).resolve()
        raw = self.path.read_bytes()
        self.manifest_sha256 = hashlib.sha256(raw).hexdigest()
        document = json.loads(raw)
        if document.get('version') != 'CATALOG_REVIEWED_MASKS_V1':
            raise ValueError('INVALID_REVIEWED_MASK_MANIFEST')
        self.rows = document['images']
        self.source_sha256 = source_sha256
        self.source_url = source_url

    def for_source(self, source_sha256, source_url=None):
        return ReviewedMaskProvider(self.path, source_sha256=source_sha256, source_url=source_url)

    def _mask(self, row, kind):
        path = (self.path.parent / row[kind+'Mask']).resolve()
        if not path.is_relative_to(self.path.parent):
            raise ValueError('REVIEWED_MASK_PATH_OUTSIDE_MANIFEST')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != row[kind+'MaskSha256']:
            raise ValueError('REVIEWED_MASK_HASH_MISMATCH')
        with Image.open(path) as image:
            return image.convert('L')

    def masks(self, image, category, subcategory=None):
        rows = [row for row in self.rows if row.get('sourceSha256') == self.source_sha256
                and row.get('category') == category and row.get('subcategory') == subcategory
                and (not row.get('sourceUrl') or row['sourceUrl'] == self.source_url)]
        if len(rows) != 1:
            raise ValueError('REVIEWED_SOURCE_NOT_FOUND_OR_AMBIGUOUS')
        row = rows[0]
        if not row.get('reviewedBy') or not row.get('reviewedAt'):
            raise ValueError('REVIEWED_MASK_ATTESTATION_REQUIRED')
        if hashlib.sha256(image.convert('RGB').tobytes()).hexdigest() != row.get('analysisPixelSha256'):
            raise ValueError('REVIEWED_ANALYSIS_PIXELS_CHANGED')
        return PhotoMasks(self._mask(row,'target'),self._mask(row,'forbidden'),confidence=row.get('confidence'),
                          verified=row.get('semanticVerified') is True,target_category=category,target_subcategory=subcategory,
                          human_present=row.get('humanPresent'),source='MANUAL_SEMANTIC_REVIEW:'+self.manifest_sha256,
                          measurement_verified=row.get('measurementVerified') is True,isolation_verified=row.get('isolationVerified') is True,
                          complete=row.get('complete'),occluded=row.get('occluded'))
