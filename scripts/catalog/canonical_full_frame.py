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
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

try:
    from .canonical_glb import CanonicalFrameError, Primitive, load_primitives
    from .photo_set_quality import assess_ready_candidate
except ImportError:
    from canonical_glb import CanonicalFrameError, Primitive, load_primitives
    from photo_set_quality import assess_ready_candidate

WIDTH, HEIGHT = 900, 1200
VERSION = "FAI_CANONICAL_FRAME_V0_PREVIEW"
CATEGORIES = frozenset({"upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"})
MIME = b"\x89PNG\r\n\x1a\n"


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
    primitives = load_primitives(Path(asset_path), category, subcategory)
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
              "sourcePostflight": assess_ready_candidate(photo_set).as_dict(),
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
