#!/usr/bin/env python3
"""Opt-in, source-guided photo-frame previews; never promotes catalog assets.

The legacy canonical renderer uses only the median colour of the fabric patch.
This pilot accepts an *explicitly paired* studio reference and generates two
independent REVIEW previews:

* whole_reference_frame.png: faithful 2-D isolation of the studio photograph;
* whole_canonical_projected.png: the source image projectively painted onto
  the existing 3-D GLB silhouette (not a validated UV bake or physical fit).

Neither output is approved for the catalog. The immutable GPU output, source
photo set, database and old canonical preview are never written to.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

try:
    from .canonical_full_frame import (CATEGORIES, HEIGHT, WIDTH, CanonicalFrameError,
                                       load_manifest, render_asset_png)
except ImportError:
    from canonical_full_frame import (CATEGORIES, HEIGHT, WIDTH, CanonicalFrameError,
                                      load_manifest, render_asset_png)

VERSION = "FAI_CANONICAL_PHOTO_GUIDED_V1_EXPERIMENT"
OUTPUTS = ("whole_reference_frame.png", "whole_canonical_projected.png", "guided_report.json")
VIEWS = {"FRONT", "BACK", "SIDE", "UNKNOWN"}


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _png(image: Image.Image) -> bytes:
    with io.BytesIO() as out:
        image.save(out, format="PNG", optimize=True)
        return out.getvalue()


def isolate_studio_reference(source: Image.Image) -> tuple[Image.Image, dict]:
    """Conservatively isolate a light, approximately uniform studio background.

    This is NOT a human segmenter. Incomplete photos, white-on-white garments,
    irregular scenes or low-contrast backgrounds require human review and are
    rejected here instead of silently removing garment fabric.
    """
    source = ImageOps.exif_transpose(source).convert("RGBA")
    if source.width * source.height > 40_000_000:
        raise CanonicalFrameError("REFERENCE_TOO_LARGE")
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    incoming_alpha = np.asarray(source.getchannel("A"), dtype=np.uint8)
    if min(source.size) < 120:
        raise CanonicalFrameError("REFERENCE_TOO_SMALL")
    if np.count_nonzero(incoming_alpha < 250) > .06 * incoming_alpha.size:
        alpha = incoming_alpha.copy()
        method = "EXISTING_ALPHA"
    else:
        h, w = rgb.shape[:2]
        edge = max(2, min(h, w) // 50)
        corners = np.concatenate((rgb[:edge, :edge].reshape(-1, 3),
                                  rgb[:edge, -edge:].reshape(-1, 3),
                                  rgb[-edge:, :edge].reshape(-1, 3),
                                  rgb[-edge:, -edge:].reshape(-1, 3)))
        background = np.median(corners, axis=0)
        spread = np.percentile(np.max(np.abs(corners - background), axis=1), 90)
        if background.min() < 180 or spread > 16:
            raise CanonicalFrameError("REFERENCE_BACKGROUND_NOT_STUDIO")
        delta = np.max(np.abs(rgb - background), axis=2)
        # A graded edge avoids thin white halos while preserving genuine
        # details. Large white-on-white patches are inherently not recoverable.
        alpha = np.clip((delta - 22.) * (255. / 33.), 0, 255).astype(np.uint8)
        method = "LIGHT_BACKGROUND_CONTRAST"
    # Isolated source screenshots may have a thin scanner/UI border unrelated
    # to the product. Exclude at most a 1% peripheral stripe for the bbox,
    # but refuse it if a substantial share of foreground would be erased.
    h, w = alpha.shape
    edge_px = max(2, min(h, w) // 100)
    central = alpha.copy()
    central[:edge_px] = 0
    central[-edge_px:] = 0
    central[:, :edge_px] = 0
    central[:, -edge_px:] = 0
    foreground_total = int(np.count_nonzero(alpha > 160))
    fringe_pixels = foreground_total - int(np.count_nonzero(central > 160))
    if foreground_total and fringe_pixels / foreground_total > .012:
        raise CanonicalFrameError("REFERENCE_TOUCHES_SOURCE_BORDER")
    alpha = central
    ys, xs = np.where(alpha > 160)
    if len(xs) < source.width * source.height * .035:
        raise CanonicalFrameError("REFERENCE_GARMENT_NOT_ISOLATED")
    bbox = (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))
    margin = edge_px
    if bbox[0] < margin or bbox[1] < margin or bbox[2] > source.width - margin or bbox[3] > source.height - margin:
        raise CanonicalFrameError("REFERENCE_TOUCHES_SOURCE_BORDER")
    coverage = (len(xs) / ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])))
    if coverage < .2:
        raise CanonicalFrameError("REFERENCE_TOO_FRAGMENTED")
    result = np.asarray(source).copy()
    result[..., 3] = alpha
    # Do not destroy source RGB, including print, seams, brand marks and shade.
    crop = Image.fromarray(result, "RGBA").crop(bbox)
    return crop, {"method": method, "bbox": bbox, "coverage": round(float(coverage), 5),
                  "fringePixelsExcluded": fringe_pixels,
                  "sourceSize": list(source.size)}


def frame_reference(isolated: Image.Image) -> Image.Image:
    cutout = isolated.copy()
    cutout.thumbnail((round(WIDTH * .76), round(HEIGHT * .78)), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    output.alpha_composite(cutout, ((WIDTH - cutout.width) // 2, (HEIGHT - cutout.height) // 2))
    return output


def paint_template(template: Image.Image, isolated: Image.Image) -> tuple[Image.Image, float]:
    """Project observed pixels onto a GLB raster, retaining its alpha contour.

    This deliberately keeps the reference photograph separate too, so reviewers
    can see distortions from trying to fit a 2-D source onto crude V0 geometry.
    """
    target = np.asarray(template.convert("RGBA")).copy()
    alpha = target[..., 3]
    box = template.getchannel("A").getbbox()
    if not box:
        raise CanonicalFrameError("CANONICAL_RENDER_EMPTY")
    x0, y0, x1, y1 = box
    mapped = isolated.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
    src = np.asarray(mapped, dtype=np.uint8)
    dst = target[y0:y1, x0:x1]
    valid = (dst[..., 3] > 0) & (src[..., 3] > 160)
    # Adopt the actual source pixels, including garment details; never tile
    # motifs across unrelated parts of the model.
    dst[..., :3][valid] = src[..., :3][valid]
    projected_fraction = float(np.count_nonzero(valid) / max(np.count_nonzero(alpha), 1))
    return Image.fromarray(target, "RGBA"), projected_fraction


def guided_candidate(set_path: Path, asset_root: Path, out: Path, manifest: dict,
                     reference: dict, map_dir: Path, *, force: bool = False) -> dict:
    photo_set = json.loads(set_path.read_text(encoding="utf-8"))
    category, subcategory = photo_set.get("category"), photo_set.get("subcategory")
    if category not in CATEGORIES or not isinstance(subcategory, str):
        return {"status": "SKIPPED_UNKNOWN_TAXONOMY"}
    entry = manifest.get((category, subcategory))
    if not entry or entry.get("status") != "ACTIVE":
        return {"status": "SKIPPED_TEMPLATE_UNAVAILABLE"}
    if reference.get("confirmedSameProduct") is not True:
        return {"status": "SKIPPED_REFERENCE_PAIR_NOT_CONFIRMED"}
    view = str(reference.get("view", "UNKNOWN")).upper()
    if view not in VIEWS:
        raise CanonicalFrameError("REFERENCE_VIEW_INVALID")
    name = reference.get("file")
    if not isinstance(name, str) or not name.strip():
        raise CanonicalFrameError("REFERENCE_FILE_NOT_PROVIDED")
    reference_file = (map_dir / name).resolve()
    if not reference_file.is_file():
        raise CanonicalFrameError("REFERENCE_FILE_MISSING")
    root = asset_root.resolve()
    expected = f"assets/{category}/{subcategory}.glb"
    if entry.get("file") != expected:
        raise CanonicalFrameError("CANONICAL_ASSET_PATH_MISMATCH")
    asset_file = (root / expected).resolve()
    if not asset_file.is_relative_to(root) or not asset_file.is_file():
        raise CanonicalFrameError("CANONICAL_ASSET_UNAVAILABLE")
    asset_bytes = asset_file.read_bytes()
    if _sha(asset_bytes) != entry.get("sha256"):
        raise CanonicalFrameError("CANONICAL_ASSET_CHECKSUM_MISMATCH")
    reference_bytes = reference_file.read_bytes()
    source_state = _sha(set_path.read_bytes())
    if not force and any((out / filename).exists() for filename in OUTPUTS):
        try:
            prior = json.loads((out / OUTPUTS[-1]).read_text(encoding="utf-8"))
            if (all((out / f).is_file() for f in OUTPUTS)
                and prior.get("referenceSha256") == _sha(reference_bytes)
                and prior.get("setSha256") == source_state
                and prior.get("assetSha256") == _sha(asset_bytes)
                and prior.get("referenceView") == view
                and all(prior.get("outputs", {}).get(f) == _sha((out / f).read_bytes())
                        for f in OUTPUTS[:2])):
                return {"status": "ALREADY_RENDERED"}
        except (OSError, ValueError, KeyError):
            pass
        return {"status": "STALE_GUIDED_PREVIEW_REQUIRES_FORCE"}
    with Image.open(io.BytesIO(reference_bytes)) as photo:
        isolated, isolation_meta = isolate_studio_reference(photo)
    studio_frame = frame_reference(isolated)
    fabric_file = set_path.parent / "fabric.png"
    texture_file = fabric_file if fabric_file.is_file() else reference_file
    canonical, metadata = render_asset_png(asset_file, texture_file,
                                           category=category, subcategory=subcategory)
    with Image.open(io.BytesIO(canonical)) as template:
        projected, projected_fraction = paint_template(template, isolated)
    data = {OUTPUTS[0]: _png(studio_frame), OUTPUTS[1]: _png(projected)}
    report = {"version": VERSION, "status": "REVIEW", "reason": "PROJECTIVE_REFERENCE_NOT_VALIDATED",
              "category": category, "subcategory": subcategory, "photoSetStatus": photo_set.get("status"),
              "referenceView": view, "viewGeometryVerified": False,
              "referenceSha256": _sha(reference_bytes), "setSha256": source_state,
              "assetSha256": _sha(asset_bytes), "assetFamily": entry.get("family"),
              "isolation": isolation_meta, "projectedCoverage": round(projected_fraction, 5),
              "detailsVerified": False, "physicalFitVerified": False,
              "sourceOriginalRetained": True, "outputs": {k: _sha(v) for k, v in data.items()},
              "generatedAt": time.time(), "renderer": metadata.get("version")}
    out.mkdir(parents=True, exist_ok=True)
    # Write only into the new guided-preview tree.
    for name, content in data.items():
        part = out / f"{name}.part"
        part.write_bytes(content)
        part.replace(out / name)
    part = out / "guided_report.json.part"
    part.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    part.replace(out / OUTPUTS[-1])
    return {"status": "REVIEW", "reason": "PROJECTIVE_REFERENCE_NOT_VALIDATED"}


def run_lot(lot: Path, asset_root: Path, reference_map: Path, *, limit: int | None = None,
            force: bool = False) -> dict:
    lot, asset_root, reference_map = Path(lot), Path(asset_root), Path(reference_map)
    refs = json.loads(reference_map.read_text(encoding="utf-8"))
    if not isinstance(refs, dict):
        raise CanonicalFrameError("INVALID_REFERENCE_MAP")
    registry = load_manifest(asset_root)
    found = 0
    counts = {}
    for item in sorted(lot.glob("photo-sets/*/set.json")):
        ref = refs.get(item.parent.name)
        if not isinstance(ref, dict):
            continue
        if limit is not None and found >= limit:
            break
        found += 1
        try:
            result = guided_candidate(item, asset_root, lot / "guided-preview" / item.parent.name,
                                      registry, ref, reference_map.parent, force=force)
        except (OSError, ValueError, KeyError) as error:
            reason = str(error) if isinstance(error, CanonicalFrameError) else "GUIDED_PREVIEW_FAILED"
            result = {"status": "FAILED", "reason": reason}
        key = result["status"]
        counts[key] = counts.get(key, 0) + 1
        print(f"[{item.parent.name}] {key}: {result.get('reason', '')}", flush=True)
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-lot", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path, required=True)
    parser.add_argument("--reference-map", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true", help="substitui somente guided-preview")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    print(json.dumps(run_lot(args.from_lot, args.asset_root, args.reference_map,
                             limit=args.limit, force=args.force), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
