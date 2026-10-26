#!/usr/bin/env python3
"""Opt-in, offline FashionAI canonical *preview* of existing Vertex photo sets.

The remote FASHN endpoint and immutable ``whole.png`` stay unchanged. For each
READY photo set this module reads the template GLB and the photo set's fabric
patch, renders a transparent 900x1200 candidate with CPU NumPy/Pillow, and
writes it to a separate ``canonical-preview/`` directory. No database, bucket,
endpoint, or original photo-set file is ever modified.

This is deliberately marked REVIEW: the V0 GLB templates are not fitted,
unseen logos/panels cannot be authenticated, and view orientation is unknown.

Run:
  python3 -m scripts.catalog.canonical_full_frame \
    --from-lot lote-v1 --asset-root public/models/garments-canonical/v0
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import struct
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

WIDTH, HEIGHT = 900, 1200
VERSION = "FAI_CANONICAL_FRAME_V0_PREVIEW"
CATEGORIES = frozenset({"upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"})
MIME = b"\x89PNG\r\n\x1a\n"


class CanonicalFrameError(ValueError):
    pass


@dataclass(frozen=True)
class Primitive:
    positions: np.ndarray
    texcoords: np.ndarray
    triangles: np.ndarray
    material: int


def _glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 28 or data[:4] != b"glTF":
        raise CanonicalFrameError("INVALID_CANONICAL_GLB")
    magic, version, length = struct.unpack_from("<III", data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
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


def _accessor(doc: dict, binary: bytes, index: int) -> np.ndarray:
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    dimensions = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}.get(acc["type"])
    component = {5126: np.dtype("<f4"), 5125: np.dtype("<u4"), 5123: np.dtype("<u2")}.get(acc["componentType"])
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


def _primitives(asset_path: Path, category: str, subcategory: str) -> list[Primitive]:
    doc, binary = _glb(asset_path)
    extra = doc.get("extras") or {}
    if extra.get("category") != category or extra.get("subcategory") != subcategory:
        raise CanonicalFrameError("CANONICAL_GEOMETRY_ID_MISMATCH")
    if extra.get("approval") != "PROTOTYPE_UNVERIFIED":
        raise CanonicalFrameError("CANONICAL_GEOMETRY_APPROVAL_UNEXPECTED")
    primitives = []
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                raise CanonicalFrameError("UNSUPPORTED_CANONICAL_TOPOLOGY")
            attrs = primitive["attributes"]
            positions = _accessor(doc, binary, attrs["POSITION"]).astype(np.float32)
            uv = _accessor(doc, binary, attrs["TEXCOORD_0"]).astype(np.float32)
            faces = _accessor(doc, binary, primitive["indices"]).reshape(-1).astype(np.int32)
            if len(positions) != len(uv) or len(faces) % 3 or np.any(faces >= len(positions)):
                raise CanonicalFrameError("INVALID_CANONICAL_TOPOLOGY")
            primitives.append(Primitive(positions, uv, faces.reshape(-1, 3), int(primitive.get("material", 0))))
    if not primitives:
        raise CanonicalFrameError("CANONICAL_GEOMETRY_EMPTY")
    return primitives


def _texture(fabric_path: Path) -> tuple[np.ndarray, np.ndarray]:
    with Image.open(fabric_path) as source:
        if source.width < 24 or source.height < 24:
            raise CanonicalFrameError("FABRIC_PATCH_TOO_SMALL")
        source = ImageOps.exif_transpose(source).convert("RGB")
        source.thumbnail((192, 192), Image.Resampling.LANCZOS)
        blurred = source.filter(ImageFilter.GaussianBlur(1.4))
        tiled = np.asarray(blurred, dtype=np.uint8)
    # Strong printing/logos in a patch would be hallucinated all over the mesh.
    # Blend only low-amplitude local texture into the robust median base colour.
    median = np.median(tiled.reshape(-1, 3), axis=0)
    return tiled, median


def _camera(primitives: list[Primitive], category: str):
    yaw = math.radians(24 if category in {"shoes_piece", "accessory_piece"} else 0)
    pitch = math.radians(18 if category == "shoes_piece" else 0)
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    transformed = []
    for p in primitives:
        src = p.positions
        x = cy * src[:, 0] + sy * src[:, 2]
        z = -sy * src[:, 0] + cy * src[:, 2]
        y = cp * src[:, 1] - sp * z
        z = sp * src[:, 1] + cp * z
        transformed.append(np.stack([x, y, z], axis=1))
    full = np.concatenate(transformed)
    xlo, ylo = full[:, :2].min(axis=0)
    xhi, yhi = full[:, :2].max(axis=0)
    extent_x, extent_y = max(0.03, xhi - xlo), max(.03, yhi - ylo)
    scale = min(WIDTH * .76 / extent_x, HEIGHT * .78 / extent_y)
    cx, cy = (xlo + xhi) / 2, (ylo + yhi) / 2
    # Camera looks toward -Z; +Z is the canonical front.
    projected = [np.stack([(v[:, 0] - cx) * scale + WIDTH / 2,
                           -(v[:, 1] - cy) * scale + HEIGHT / 2,
                           v[:, 2]], axis=1) for v in transformed]
    return projected, {"x": float(xlo), "y": float(ylo), "width": float(extent_x),
                       "height": float(extent_y), "scale": float(scale), "yawDegrees": round(math.degrees(yaw), 2),
                       "pitchDegrees": round(math.degrees(pitch), 2)}


def render_asset_png(asset_path: Path, fabric_path: Path, *, category: str, subcategory: str) -> tuple[bytes, dict]:
    """Software render of canonical preview, not a PBR/physics-certified bake."""
    primitives = _primitives(Path(asset_path), category, subcategory)
    tiled, base = _texture(Path(fabric_path))
    projected, framing = _camera(primitives, category)
    output = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    depth_buffer = np.full((HEIGHT, WIDTH), -np.inf, dtype=np.float32)
    tile_h, tile_w = tiled.shape[:2]
    face_count = 0
    for primitive, points in zip(primitives, projected):
        for index in primitive.triangles:
            tri = points[index]
            uv = primitive.texcoords[index]
            xs, ys = tri[:, 0], tri[:, 1]
            xmin, xmax = max(0, int(math.floor(xs.min()))), min(WIDTH - 1, int(math.ceil(xs.max())))
            ymin, ymax = max(0, int(math.floor(ys.min()))), min(HEIGHT - 1, int(math.ceil(ys.max())))
            if xmax < xmin or ymax < ymin:
                continue
            denominator = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(denominator) < 1e-4:
                continue
            yy, xx = np.mgrid[ymin:ymax + 1, xmin:xmax + 1]
            xx, yy = xx + .5, yy + .5
            w0 = ((ys[1] - ys[2]) * (xx - xs[2]) + (xs[2] - xs[1]) * (yy - ys[2])) / denominator
            w1 = ((ys[2] - ys[0]) * (xx - xs[2]) + (xs[0] - xs[2]) * (yy - ys[2])) / denominator
            w2 = 1 - w0 - w1
            inside = (w0 >= -1e-5) & (w1 >= -1e-5) & (w2 >= -1e-5)
            zz = w0 * tri[0, 2] + w1 * tri[1, 2] + w2 * tri[2, 2]
            part_depth = depth_buffer[ymin:ymax + 1, xmin:xmax + 1]
            visible = inside & (zz > part_depth)
            if not np.any(visible):
                continue
            u = w0 * uv[0, 0] + w1 * uv[1, 0] + w2 * uv[2, 0]
            v = w0 * uv[0, 1] + w1 * uv[1, 1] + w2 * uv[2, 1]
            tu = np.mod(np.floor(u * tile_w).astype(np.int32), tile_w)
            tv = np.mod(np.floor((1 - v) * tile_h).astype(np.int32), tile_h)
            if primitive.material == 2:
                rgb = np.broadcast_to(np.array([170., 173., 177.]), (len(tu[visible]), 3))
            else:
                contrast = .22 if primitive.material == 0 else .1
                rgb = base[None, :] * (1 - contrast) + tiled[tv[visible], tu[visible]] * contrast
                if primitive.material == 1:
                    rgb *= .77
            normal = np.cross(tri[1] - tri[0], tri[2] - tri[0]); normal /= max(np.linalg.norm(normal), 1e-8)
            shade = float(np.clip(.83 + .12 * normal[0] + .11 * normal[1] + .12 * abs(normal[2]), .56, 1.06))
            patch = output[ymin:ymax + 1, xmin:xmax + 1]
            patch[visible, :3] = np.clip(rgb * shade, 0, 255).astype(np.uint8)
            patch[visible, 3] = 255
            part_depth[visible] = zz[visible]
            face_count += 1
    if not (output[..., 3] > 0).any():
        raise CanonicalFrameError("CANONICAL_RENDER_EMPTY")
    image = Image.fromarray(output, mode="RGBA")
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue(), {"version": VERSION, "width": WIDTH, "height": HEIGHT,
                            "alpha": True, "renderedTriangles": face_count,
                            "framing": framing, "materialSource": "fabric_crop_reduced_contrast",
                            "status": "REVIEW", "reason": "CANONICAL_TEMPLATE_UNVERIFIED",
                            "sourceOrientation": "UNKNOWN", "logosVerified": False,
                            "constructionVerified": False, "wearableFitVerified": False}


def load_manifest(asset_root: Path) -> dict:
    path = asset_root / "manifest.json"
    obj = json.loads(path.read_text(encoding="utf-8"))
    if obj.get("schemaVersion") != "FAI_CANONICAL_TEMPLATE_V0" or obj.get("approval") != "PROTOTYPE_UNVERIFIED":
        raise CanonicalFrameError("INVALID_CANONICAL_MANIFEST")
    return {(a["category"], a["subcategory"]): a for a in obj["assets"]}


def canonical_candidate(set_path: Path, asset_root: Path, output: Path, registry: dict, *, force=False) -> dict:
    set_path = Path(set_path)
    output = Path(output)
    photo_set = json.loads(set_path.read_text(encoding="utf-8"))
    if photo_set.get("status") != "READY":
        return {"status": "SKIPPED_NOT_READY"}
    category, subcategory = photo_set.get("category"), photo_set.get("subcategory")
    if category not in CATEGORIES or not isinstance(subcategory, str):
        return {"status": "SKIPPED_UNKNOWN_TAXONOMY"}
    entry = registry.get((category, subcategory))
    if entry is None or entry.get("status") != "ACTIVE":
        return {"status": "SKIPPED_TEMPLATE_UNAVAILABLE"}
    # The ONLY upstream files accepted are the contract-declared photo set.
    files = photo_set.get("files") or {}
    if files.get("whole") != "whole.png" or files.get("fabric") != "fabric.png":
        return {"status": "SKIPPED_INVALID_PHOTO_SET"}
    candidate_png = output / "whole_canonical.png"
    candidate_report = output / "canonical_render.json"
    root = asset_root.resolve()
    expected = f"assets/{category}/{subcategory}.glb"
    if entry.get("file") != expected:
        raise CanonicalFrameError("CANONICAL_ASSET_PATH_MISMATCH")
    asset = (root / expected).resolve()
    if not asset.is_relative_to(root) or not asset.is_file():
        raise CanonicalFrameError("CANONICAL_ASSET_UNAVAILABLE")
    if hashlib.sha256(asset.read_bytes()).hexdigest() != entry.get("sha256"):
        raise CanonicalFrameError("CANONICAL_ASSET_CHECKSUM_MISMATCH")
    original = set_path.parent / "whole.png"
    fabric = set_path.parent / "fabric.png"
    for current in (original, fabric):
        if not current.is_file() or not current.read_bytes().startswith(MIME):
            raise CanonicalFrameError("PHOTO_SET_INPUT_INVALID")
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    fabric_hash = hashlib.sha256(fabric.read_bytes()).hexdigest()
    if not force and (candidate_png.exists() or candidate_report.exists()):
        try:
            previous = json.loads(candidate_report.read_text(encoding="utf-8"))
            if (candidate_png.is_file() and previous.get("originalWholeSha256") == original_hash
                    and previous.get("fabricSha256") == fabric_hash
                    and previous.get("templateSha256") == entry["sha256"]
                    and previous.get("sourceSha256") == photo_set.get("sourceSha256")
                    and previous.get("renderSha256") == hashlib.sha256(candidate_png.read_bytes()).hexdigest()):
                return {"status": "ALREADY_RENDERED"}
        except (OSError, json.JSONDecodeError):
            pass
        return {"status": "STALE_CANONICAL_PREVIEW_REQUIRES_FORCE"}
    rendered, meta = render_asset_png(asset, fabric, category=category, subcategory=subcategory)
    # Separate outputs: never overwrite whole.png, set.json, report.jsonl or fabric.png.
    output.mkdir(parents=True, exist_ok=True)
    report = {**meta, "category": category, "subcategory": subcategory,
              "imageId": photo_set.get("imageId"), "sourceSha256": photo_set.get("sourceSha256"),
              "originalWholeSha256": original_hash,
              "fabricSha256": fabric_hash,
              "templateSha256": entry["sha256"], "assetFamily": entry["family"],
              "renderSha256": hashlib.sha256(rendered).hexdigest(),
              "generatedAt": time.time(), "output": "whole_canonical.png"}
    tmp_image = output / "whole_canonical.png.part"
    tmp_report = output / "canonical_render.json.part"
    tmp_image.write_bytes(rendered)
    tmp_report.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp_image.replace(candidate_png)
    tmp_report.replace(candidate_report)
    return {"status": "REVIEW", "reason": "CANONICAL_TEMPLATE_UNVERIFIED", "output": str(candidate_png)}


def render_lot(lot: Path, asset_root: Path, *, out: Path | None = None, limit: int | None = None,
               force: bool = False) -> dict:
    lot = Path(lot)
    asset_root = Path(asset_root)
    registry = load_manifest(asset_root)
    preview_dir = Path(out) if out else lot / "canonical-preview"
    results = {}
    paths = sorted(lot.glob("photo-sets/*/set.json"))
    if limit is not None:
        paths = paths[:limit]
    for item in paths:
        try:
            result = canonical_candidate(item, asset_root, preview_dir / item.parent.name, registry, force=force)
        except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
            reason = str(error) if isinstance(error, CanonicalFrameError) else "CANONICAL_PREVIEW_FAILED"
            result = {"status": "FAILED", "reason": reason}
        key = result["status"]
        results[key] = results.get(key, 0) + 1
        print(f"[{item.parent.name}] {key}" + (f": {result.get('reason')}" if result.get("reason") else ""), flush=True)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-lot", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path, required=True, help="manifest.json + assets/ da biblioteca canônica")
    parser.add_argument("--out", type=Path, help="pasta de prévias; padrão <lote>/canonical-preview")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true", help="substitui APENAS prévias canônicas existentes")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    print(json.dumps(render_lot(args.from_lot, args.asset_root, out=args.out, limit=args.limit, force=args.force),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
