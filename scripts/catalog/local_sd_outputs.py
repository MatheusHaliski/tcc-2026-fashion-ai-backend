"""Arquivos do lote local além do packshot: o photoSet de cada foto (photo-sets/<id>/…) e os relatórios do lote
(metadata_clean.json e ineligible.json)."""
from __future__ import annotations

import hashlib
import io
import json
import time
from typing import Optional

import numpy as np
from PIL import Image

from photo_preflight import MIN_SOURCE_HEIGHT
from photo_set import PHOTO_SET_VERSION
from photo_set import _fabric_box as fabric_box  # o mesmo retângulo 3:4 só de tecido do worker do catálogo
from whole_frame import HEIGHT, WIDTH
from photo_set_quality import apply_quality_gate
from local_sd_base import VERSION
from local_sd_compose import compose_packshot


class LotOutputs:
    """Mixin do GhostPipeline: grava em `self.options.out_dir` o photoSet de uma foto e os relatórios de `self.rows`."""

    def write_photo_set(self, row: dict, data: bytes, info: dict, *, status: Optional[str] = None, reason: Optional[str] = None,
                        image: Optional[Image.Image] = None, target: Optional[np.ndarray] = None, ghost: Optional[np.ndarray] = None,
                        generated: Optional[Image.Image] = None, alpha: Optional[np.ndarray] = None) -> dict:
        """photo-sets/<id>/{whole.png, fabric.png, set.json}: o que `process_photo_sets.py --from-lot` grava como o photoSet da
        foto (CATALOG_PHOTO_SET_V2, o mesmo contrato do worker do catálogo). READY só com preflight PASS — atestado pela
        evidência do engine fashn-open — e um retângulo 3:4 só de tecido; senão fica o status do preflight com o motivo."""
        preflight = info.get("preflight") or {}
        folder = self.options.out_dir / "photo-sets" / hashlib.sha256(str(row.get("id")).encode()).hexdigest()[:24]
        folder.mkdir(parents=True, exist_ok=True)
        metrics = {"version": PHOTO_SET_VERSION, "category": row.get("category"), "subcategory": row.get("subcategory"),
                   "sourceGarmentHeightFraction": preflight.get("sourceGarmentHeightFraction"), "sourceQuality": preflight.get("quality"),
                   "maskSource": preflight.get("maskSource"), "preflight": preflight, "cleanup": info.get("cleanup"), "fashnOpen": info.get("fashnOpen")}
        result = {"version": PHOTO_SET_VERSION, "imageId": row.get("id"), "productId": row.get("product_id"), "sourceUrl": row.get("image_url"),
                  "sourceSha256": hashlib.sha256(data).hexdigest(), "category": row.get("category"), "subcategory": row.get("subcategory"),
                  "color": row.get("color"), "generatedAt": time.time(), "engine": "fashn-open", "metrics": metrics}
        box = fabric_box(Image.fromarray((target * 255).astype(np.uint8))) if target is not None else None
        if status is not None or preflight.get("status") != "PASS":
            result.update(status="INELIGIBLE" if (status or preflight.get("status")) == "INELIGIBLE" else "REVIEW",
                          reason=reason or preflight.get("reason") or "PREFLIGHT_NOT_PASSED")
        elif box is None:
            result.update(status="REVIEW", reason="NO_SAFE_FABRIC_RECTANGLE")
        else:
            whole = compose_packshot(image, target, generated, ghost, shadow=False, alpha=alpha, keep_alpha=True)   # sem sombra, com alfa: vira textura e card
            fabric = image.crop(box)
            if fabric.width > WIDTH:
                fabric = fabric.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
            (folder / "whole.png").write_bytes(whole.data)
            buffer = io.BytesIO()
            fabric.save(buffer, "PNG", optimize=True)
            (folder / "fabric.png").write_bytes(buffer.getvalue())
            metrics["whole"] = {"width": WIDTH, "height": HEIGHT, "box": whole.info["box"], "framing": whole.info["framing"], "background": "#FFFFFF",
                                "rendered": True, "processed": True, "ghostPixels": whole.info["ghostPixels"]}
            metrics["fabric"] = {"width": fabric.width, "height": fabric.height, "sourceBox": list(box), "coverage": 1.0}
            result.update(status="READY", reason=None, files={"whole": "whole.png", "fabric": "fabric.png"})
            # Preflight attests a candidate segmentation, not a complete
            # garment. Human/model photographs, lenient contours and ghost
            # repairs must be reviewed before these files reach the catalog.
            result = apply_quality_gate(result)
            if result["status"] != "READY" and result.get("files"):
                # The GPU wire contract permits file payloads only for READY.
                # Keep local PNGs for diagnostics, but do not transmit them as
                # publishable output from PhotoSetRuntime.
                result["reviewPreviewFiles"] = result.pop("files")
        (folder / "set.json").write_text(json.dumps(result, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        return {"status": result["status"], "reason": result.get("reason"), "dir": folder.as_posix()}

    def write_manifest(self):
        """metadata_clean.json: produto, marca, categoria, arquivo e status de cada foto; e a lista para a quarentena."""
        rows = [{k: r.get(k) for k in ("id", "product_id", "brand", "category", "subcategory", "image_path", "stored_value", "status", "reason")}
                | {"heightFraction": (r.get("metrics") or {}).get("sourceGarmentHeightFraction")} for r in self.rows]
        counts = {}
        for r in self.rows:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        manifest = {"version": VERSION, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "counts": counts,
                    "images": rows, "complete": True}
        (self.options.out_dir / "metadata_clean.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        ineligible = [{"productId": r["product_id"], "imageId": r["id"], "heightFraction": (r.get("metrics") or {}).get("sourceGarmentHeightFraction"),
                       "reason": r.get("reason")} for r in self.rows if r["status"] == "INELIGIBLE"]
        (self.options.out_dir / "ineligible.json").write_text(json.dumps({"version": VERSION, "minimumHeightFraction": MIN_SOURCE_HEIGHT,
                                                                           "note": "candidatos a quarentena; nada foi apagado — use quarantine_unsafe_products.py",
                                                                           "products": ineligible}, ensure_ascii=False, indent=1), encoding="utf-8")
