"""Unit tests for the pure canonical GLB decoder (bytes in, arrays out; no files besides tmp)."""

import tempfile
import unittest
from pathlib import Path

import numpy as np

from scripts.catalog import canonical_full_frame as cff
from scripts.catalog import canonical_glb as glb
from scripts.catalog.tests.glb_fixture import QUAD_INDICES, QUAD_POSITIONS, QUAD_UV, glb_bytes, quad_document, quad_glb


class CanonicalGlbTest(unittest.TestCase):
    def test_parse_glb_splits_document_and_padded_binary(self):
        document, binary = quad_document()
        parsed, chunk = glb.parse_glb(glb_bytes(document, binary))
        self.assertEqual(parsed, document)
        self.assertEqual(chunk[:len(binary)], binary)
        self.assertEqual(len(chunk) % 4, 0)

    def test_dense_accessors_round_trip(self):
        document, binary = quad_document()
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 0), QUAD_POSITIONS)
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 1), QUAD_UV)
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 2).reshape(-1), QUAD_INDICES)

    def test_strided_interleaved_view_and_uint32_indices(self):
        interleaved = np.hstack([QUAD_POSITIONS, QUAD_UV]).astype("<f4")  # 20-byte stride
        indices = QUAD_INDICES.astype("<u4")
        binary = interleaved.tobytes() + indices.tobytes()
        document = {"bufferViews": [{"byteOffset": 0, "byteStride": 20}, {"byteOffset": len(interleaved.tobytes())}],
                    "accessors": [{"bufferView": 0, "componentType": 5126, "count": 4, "type": "VEC3"},
                                  {"bufferView": 0, "byteOffset": 12, "componentType": 5126, "count": 4, "type": "VEC2"},
                                  {"bufferView": 1, "componentType": 5125, "count": 6, "type": "SCALAR"}]}
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 0), QUAD_POSITIONS)
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 1), QUAD_UV)
        np.testing.assert_array_equal(glb.accessor_array(document, binary, 2).reshape(-1), indices)

    def test_unsupported_accessor_types_are_refused(self):
        document, binary = quad_document()
        for field, value in (("type", "MAT4"), ("componentType", 5121)):
            broken = {**document, "accessors": [dict(document["accessors"][0], **{field: value})]}
            with self.assertRaisesRegex(glb.CanonicalFrameError, "^UNSUPPORTED_CANONICAL_ACCESSOR$"):
                glb.accessor_array(broken, binary, 0)
        broken = {**document, "accessors": [dict(document["accessors"][0], byteOffset=-4)]}
        with self.assertRaisesRegex(glb.CanonicalFrameError, "^INVALID_CANONICAL_ACCESSOR_BOUNDS$"):
            glb.accessor_array(broken, binary, 0)

    def test_primitives_are_triangles_with_material(self):
        document, binary = quad_document(material=2)
        (primitive,) = glb.primitives_from_document(document, binary, "upper_piece", "t_shirt")
        self.assertEqual(primitive.triangles.tolist(), [[0, 1, 2], [0, 2, 3]])
        self.assertEqual((primitive.positions.dtype, primitive.triangles.dtype, primitive.material),
                         (np.float32, np.int32, 2))

    def test_load_primitives_reads_only_the_given_path(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "t.glb"
            path.write_bytes(quad_glb())
            self.assertEqual(len(glb.load_primitives(path, "upper_piece", "t_shirt")), 1)
            self.assertEqual([p.name for p in Path(temp).iterdir()], ["t.glb"])

    def test_error_type_is_shared_with_existing_importers(self):
        from scripts.catalog import canonical_photo_guided
        self.assertIs(cff.CanonicalFrameError, glb.CanonicalFrameError)
        self.assertIs(canonical_photo_guided.CanonicalFrameError, glb.CanonicalFrameError)
        self.assertIs(cff.Primitive, glb.Primitive)
        self.assertTrue(issubclass(glb.CanonicalFrameError, ValueError))


if __name__ == "__main__":
    unittest.main()
