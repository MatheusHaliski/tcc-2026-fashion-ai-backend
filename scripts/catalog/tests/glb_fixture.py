"""Tiny in-memory GLB/photo-set fixtures for canonical preview tests (no bundled assets)."""

import hashlib
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

QUAD_POSITIONS = np.array([[-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0]], dtype="<f4")
QUAD_UV = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype="<f4")
QUAD_INDICES = np.array([0, 1, 2, 0, 2, 3], dtype="<u2")


def glb_bytes(document: dict, binary: bytes, *, magic=b"glTF", version=2, length_delta=0, include_bin=True) -> bytes:
    """Assemble a GLB container: 12-byte header, padded JSON chunk, padded BIN chunk."""
    text = json.dumps(document).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    body = struct.pack("<I4s", len(text), b"JSON") + text
    if include_bin:
        body += struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    return magic + struct.pack("<II", version, 12 + len(body) + length_delta) + body


def quad_document(*, category="upper_piece", subcategory="t_shirt", approval="PROTOTYPE_UNVERIFIED",
                  positions=QUAD_POSITIONS, mode=4, indices=QUAD_INDICES, material=0, sparse=False):
    binary = positions.tobytes() + QUAD_UV.tobytes() + indices.tobytes()
    p, u = len(positions.tobytes()), len(QUAD_UV.tobytes())
    position_accessor = {"bufferView": 0, "componentType": 5126, "count": len(positions), "type": "VEC3"}
    if sparse:
        position_accessor["sparse"] = {"count": 1}
    document = {
        "asset": {"version": "2.0"},
        "extras": {"category": category, "subcategory": subcategory, "approval": approval},
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": p},
                        {"buffer": 0, "byteOffset": p, "byteLength": u},
                        {"buffer": 0, "byteOffset": p + u, "byteLength": len(indices.tobytes())}],
        "accessors": [position_accessor,
                      {"bufferView": 1, "componentType": 5126, "count": len(QUAD_UV), "type": "VEC2"},
                      {"bufferView": 2, "componentType": 5123, "count": len(indices), "type": "SCALAR"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2,
                                    "mode": mode, "material": material}]}],
    }
    return document, binary


def quad_glb(**kwargs) -> bytes:
    return glb_bytes(*quad_document(**kwargs))


def write_asset_root(root: Path, glb: bytes, *, category="upper_piece", subcategory="t_shirt",
                     status="ACTIVE", sha=None) -> Path:
    asset = root / "assets" / category / f"{subcategory}.glb"
    asset.parent.mkdir(parents=True, exist_ok=True)
    asset.write_bytes(glb)
    manifest = {"schemaVersion": "FAI_CANONICAL_TEMPLATE_V0", "approval": "PROTOTYPE_UNVERIFIED",
                "assets": [{"category": category, "subcategory": subcategory, "status": status, "family": "test",
                            "file": f"assets/{category}/{subcategory}.glb",
                            "sha256": sha or hashlib.sha256(glb).hexdigest()}]}
    (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return asset


def write_photo_set(folder: Path, *, status="READY", category="upper_piece", subcategory="t_shirt") -> dict:
    folder.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (900, 1200), (0, 0, 0, 0)).save(folder / "whole.png", format="PNG")
    Image.new("RGB", (32, 32), (82, 149, 118)).save(folder / "fabric.png", format="PNG")
    record = {"status": status, "imageId": "img-1", "sourceSha256": "source-sha", "category": category,
              "subcategory": subcategory, "files": {"whole": "whole.png", "fabric": "fabric.png"}}
    (folder / "set.json").write_text(json.dumps(record), encoding="utf-8")
    return record


def tree_hashes(folder: Path) -> dict:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.iterdir())}
