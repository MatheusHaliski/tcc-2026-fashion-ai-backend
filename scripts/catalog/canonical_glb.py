"""Strict, dependency-light decoder for the canonical template GLB library (glTF 2.0 binary).

Pure parsing: bytes in, NumPy arrays out. No rendering, manifest, photo set or network.
Only the subset produced by the V0 template builder is accepted (triangle lists, dense
float32/uint32/uint16 accessors); anything else fails with a stable uppercase reason
code, which ``canonical_full_frame.render_lot`` reports as ``FAILED: <code>``.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

GLB_MAGIC = 0x46546C67  # b"glTF" little-endian
TRIANGLES = 4
APPROVAL = "PROTOTYPE_UNVERIFIED"
_DIMENSIONS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}
_COMPONENTS = {5126: np.dtype("<f4"), 5125: np.dtype("<u4"), 5123: np.dtype("<u2")}


class CanonicalFrameError(ValueError):
    pass


@dataclass(frozen=True)
class Primitive:
    positions: np.ndarray
    texcoords: np.ndarray
    triangles: np.ndarray
    material: int


def parse_glb(data: bytes) -> tuple[dict, bytes]:
    """Split a GLB container into its JSON document and BIN chunk, validating every bound."""
    if len(data) < 28 or data[:4] != b"glTF":
        raise CanonicalFrameError("INVALID_CANONICAL_GLB")
    magic, version, length = struct.unpack_from("<III", data)
    if magic != GLB_MAGIC or version != 2 or length != len(data):
        raise CanonicalFrameError("INVALID_CANONICAL_GLB")
    offset, document, binary = 12, None, None
    while offset < len(data):
        if offset + 8 > len(data):
            raise CanonicalFrameError("INVALID_CANONICAL_GLB_CHUNK")
        chunk_size, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if chunk_size % 4 or offset + chunk_size > len(data):
            raise CanonicalFrameError("INVALID_CANONICAL_GLB_CHUNK")
        value = data[offset:offset + chunk_size]
        offset += chunk_size
        if kind == b"JSON":
            document = json.loads(value)
        if kind == b"BIN\x00":
            binary = value
    if not isinstance(document, dict) or binary is None:
        raise CanonicalFrameError("INVALID_CANONICAL_GLB_CHUNK")
    return document, binary


def accessor_array(doc: dict, binary: bytes, index: int) -> np.ndarray:
    """Dense (count, dimensions) view of one accessor; strided views are honoured, sparse refused."""
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    dimensions = _DIMENSIONS.get(acc["type"])
    component = _COMPONENTS.get(acc["componentType"])
    if dimensions is None or component is None or acc.get("sparse"):
        raise CanonicalFrameError("UNSUPPORTED_CANONICAL_ACCESSOR")
    count = int(acc["count"])
    start = int(view.get("byteOffset", 0)) + int(acc.get("byteOffset", 0))
    stride = int(view.get("byteStride", dimensions * component.itemsize))
    extent = start + (count - 1) * stride + dimensions * component.itemsize
    if count < 1 or start < 0 or extent > len(binary):
        raise CanonicalFrameError("INVALID_CANONICAL_ACCESSOR_BOUNDS")
    if stride == dimensions * component.itemsize:
        data = np.frombuffer(binary, dtype=component, count=count * dimensions, offset=start)
        result = data.reshape(count, dimensions)
    else:
        result = np.ndarray(shape=(count, dimensions), dtype=component, buffer=binary, offset=start,
                            strides=(stride, component.itemsize))
    if not np.isfinite(result).all():
        raise CanonicalFrameError("NONFINITE_CANONICAL_GEOMETRY")
    return np.asarray(result)


def primitives_from_document(doc: dict, binary: bytes, category: str, subcategory: str) -> list[Primitive]:
    """Textured triangle meshes of a template whose extras match the requested taxonomy."""
    extra = doc.get("extras") or {}
    if extra.get("category") != category or extra.get("subcategory") != subcategory:
        raise CanonicalFrameError("CANONICAL_GEOMETRY_ID_MISMATCH")
    if extra.get("approval") != APPROVAL:
        raise CanonicalFrameError("CANONICAL_GEOMETRY_APPROVAL_UNEXPECTED")
    primitives = []
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", TRIANGLES) != TRIANGLES:
                raise CanonicalFrameError("UNSUPPORTED_CANONICAL_TOPOLOGY")
            attrs = primitive["attributes"]
            positions = accessor_array(doc, binary, attrs["POSITION"]).astype(np.float32)
            uv = accessor_array(doc, binary, attrs["TEXCOORD_0"]).astype(np.float32)
            faces = accessor_array(doc, binary, primitive["indices"]).reshape(-1).astype(np.int32)
            if len(positions) != len(uv) or len(faces) % 3 or np.any(faces >= len(positions)):
                raise CanonicalFrameError("INVALID_CANONICAL_TOPOLOGY")
            primitives.append(Primitive(positions, uv, faces.reshape(-1, 3), int(primitive.get("material", 0))))
    if not primitives:
        raise CanonicalFrameError("CANONICAL_GEOMETRY_EMPTY")
    return primitives


def load_primitives(asset_path: Path, category: str, subcategory: str) -> list[Primitive]:
    doc, binary = parse_glb(Path(asset_path).read_bytes())
    return primitives_from_document(doc, binary, category, subcategory)
