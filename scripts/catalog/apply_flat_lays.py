#!/usr/bin/env python3
"""Leva ao catálogo os flat lays aprovados da Fase 2 (GPU própria no RunPod): o Total frame do produto passa a mostrar a
peça esticada, com selo de IA (CatalogFlatLayFrame, colunas flat_lay_* da V85). O recorte real (whole_*) não é tocado.

Entrada: as pastas dos lotes do catalog_batch (audit.jsonl, cutouts/, backs/) e a lista de produtos aprovados na revisão
humana (um id por linha). Por padrão é um ensaio: confere no banco (só leitura) que a foto de origem continua a mesma e
grava prévias 900×1200 em --out-dir. ``--apply`` envia ao armazenamento do app e grava — só com autorização explícita.

    python scripts/catalog/apply_flat_lays.py --lots ~/catalog-fase2/lote-020 --approved aprovados.txt --out-dir /tmp/fl
    python scripts/catalog/apply_flat_lays.py --lots ~/catalog-fase2/lote-020 --approved aprovados.txt --apply
    python scripts/catalog/apply_flat_lays.py --clear --approved remover.txt --apply     # desfaz (volta ao recorte real)
    ... --recover-source   # lotes anteriores ao registro de image_id (flat_lay_source.py)
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from PIL import Image

try:
    from .flat_lay_source import recover
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from flat_lay_source import recover

VERSION = "FLAT_LAY_V1"
FRAME = (900, 1200)                      # quadro 3:4 do Total frame
MARGIN = 0.06                            # folga em volta da peça
BACKGROUND = (255, 255, 255)
RECONSTRUCTED = "generative_reconstruction_requires_review"

CURRENT = "SELECT id, image_url, source_sha256 FROM catalog_images WHERE id IN %(ids)s"
UPDATE = """
UPDATE catalog_images
   SET flat_lay_url = %(url)s, flat_lay_back_url = %(back)s, flat_lay_json = %(json)s, flat_lay_status = 'APPROVED',
       version = version + 1
 WHERE id = %(image_id)s AND image_url = %(original_url)s AND (source_sha256 <=> %(sha)s)
"""
CLEAR = """
UPDATE catalog_images
   SET flat_lay_url = NULL, flat_lay_back_url = NULL, flat_lay_json = NULL, flat_lay_status = NULL, version = version + 1
 WHERE product_id = %(product_id)s AND flat_lay_status IS NOT NULL
"""


def read_ids(path: Path) -> list[str]:
    return list(dict.fromkeys(line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()))


def load_lots(lots: list[Path]) -> dict[str, dict]:
    """Último resultado de cada produto nos lotes (um lote refeito com retry_ids.txt vence o anterior)."""
    found: dict[str, dict] = {}
    for lot in lots:
        for line in (lot / "audit.jsonl").read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                found[row["id"]] = {**row, "lot": lot}
    return found


def plan(row: dict | None) -> tuple[str | None, str]:
    """(motivo para pular, ou None) e o arquivo da frente."""
    if row is None:
        return "NOT_IN_LOTS", ""
    front = row["lot"] / "cutouts" / f"{row['id']}.png"
    if row.get("output") != RECONSTRUCTED:
        return "NOT_RECONSTRUCTED", ""   # só recorte da Fase 1 (ou falha): não é flat lay
    if not row.get("image_id") or not row.get("original_url"):
        return "NO_IMAGE_ID", ""         # lote anterior ao registro da imagem de origem: refaça o produto
    if not front.is_file():
        return "MISSING_FRONT", ""
    return None, str(front)


def render(png: bytes) -> bytes:
    """Flat lay (fundo branco) centralizado no quadro 3:4 com margem: o Total frame o exibe como está."""
    with Image.open(io.BytesIO(png)) as source:
        rgba = source.convert("RGBA")
    flat = Image.new("RGB", rgba.size, BACKGROUND)
    flat.paste(rgba, mask=rgba.split()[3])
    inner = (int(FRAME[0] * (1 - 2 * MARGIN)), int(FRAME[1] * (1 - 2 * MARGIN)))
    flat.thumbnail(inner, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", FRAME, BACKGROUND)
    canvas.paste(flat, ((FRAME[0] - flat.width) // 2, (FRAME[1] - flat.height) // 2))
    out = io.BytesIO()
    canvas.save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue()


def metadata(row: dict) -> str:
    return json.dumps({
        "version": VERSION, "aiGenerated": True, "reviewedBy": "human", "productId": row["id"],
        "imageId": row["image_id"], "originalUrl": row["original_url"], "photoUrl": row.get("photo_url"),
        "sourceSha256": row.get("source_sha256"), "quality": row.get("quality"), "backQuality": row.get("back_quality"),
        "lot": row["lot"].name, "sourceRecovered": bool(row.get("source_recovered")), "width": FRAME[0], "height": FRAME[1], "background": "#FFFFFF",
        "appliedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, ensure_ascii=False)


class FlatLayStorage:
    """Mesmo armazenamento e verificação da Peça inteira (FrameStorage), prefixo catalog/flatlay/."""

    def __init__(self, frame_storage):
        self.inner = frame_storage
        self.keys: list[str] = []

    def put(self, data: bytes) -> str:
        digest = hashlib.sha256(data).hexdigest()
        key = "catalog/flatlay/" + uuid.uuid4().hex + "/" + digest + ".jpg"
        client, bucket = self.inner.client, self.inner.bucket
        client.put_object(Bucket=bucket, Key=key, Body=data, ContentType="image/jpeg", IfNoneMatch="*")
        body = client.get_object(Bucket=bucket, Key=key)["Body"]
        try:
            verified = body.read(len(data) + 1)
        finally:
            body.close()
        if hashlib.sha256(verified).hexdigest() != digest:
            client.delete_object(Bucket=bucket, Key=key)
            raise ValueError("FLAT_LAY_UPLOAD_VERIFICATION_FAILED")
        self.keys.append(key)
        return self.inner.base + "/" + quote(key, safe="/")

    def discard(self, count: int) -> None:
        """Apaga os últimos envios (linha recusada pelo banco: a imagem não pode ficar órfã no bucket)."""
        for key in self.keys[-count:]:
            self.inner.client.delete_object(Bucket=self.inner.bucket, Key=key)
        del self.keys[-count:]


def current_rows(conn, image_ids: list[str]) -> dict[str, dict]:
    if not image_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(CURRENT, {"ids": tuple(image_ids)})
        return {str(r["id"]): r for r in cur.fetchall()}


def apply_one(conn, row: dict, front: str, storage=None, out_dir: Path | None = None) -> dict:
    """Uma peça: renderiza frente e costas; com ``storage``, envia e grava (recusa se a foto mudou)."""
    images = {"front": render(Path(front).read_bytes())}
    back = row["lot"] / "backs" / f"{row['id']}.png"
    if back.is_file():
        images["back"] = render(back.read_bytes())
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        for side, data in images.items():
            (out_dir / f"{row['id']}-{side}.jpg").write_bytes(data)
    if storage is None:
        return {"id": row["id"], "status": "READY", "back": "back" in images}
    urls = {side: storage.put(data) for side, data in images.items()}
    with conn.cursor() as cur:
        cur.execute(UPDATE, {"url": urls["front"], "back": urls.get("back"), "json": metadata(row),
                             "image_id": row["image_id"], "original_url": row["original_url"],
                             "sha": row.get("source_sha256")})
        changed = cur.rowcount
    if changed != 1:
        conn.rollback()
        storage.discard(len(urls))
        return {"id": row["id"], "status": "STALE", "reason": "SOURCE_CHANGED_SINCE_BATCH"}
    conn.commit()
    return {"id": row["id"], "status": "APPLIED", "url": urls["front"], "backUrl": urls.get("back")}


def _real_connect():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    return db.connect(), db.describe_target()


def _real_storage():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from category_frame_storage import FrameStorage
    return FlatLayStorage(FrameStorage())


def unchanged(live: dict | None, row: dict) -> bool:
    return live is not None and live["image_url"] == row["original_url"] and live.get("source_sha256") == row.get("source_sha256")


def main(argv=None, connect=_real_connect, make_storage=_real_storage) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lots", type=Path, nargs="*", default=[], help="pastas dos lotes (audit.jsonl, cutouts/, backs/)")
    parser.add_argument("--approved", type=Path, required=True, help="produtos aprovados na revisão (um id por linha)")
    parser.add_argument("--apply", action="store_true", help="envia e grava no banco (produção: só com autorização)")
    parser.add_argument("--clear", action="store_true", help="remove o flat lay destes produtos (volta ao recorte real)")
    parser.add_argument("--out-dir", type=Path, help="salva as prévias 900×1200 aqui")
    parser.add_argument("--audit", type=Path, default=Path("flat-lays-audit.jsonl"))
    parser.add_argument("--recover-source", action="store_true",
                        help="lotes antigos sem image_id: refaz a escolha da foto no banco (só se nada mudou depois)")
    args = parser.parse_args(argv)
    if not args.clear and not args.lots:
        parser.error("--lots é obrigatório (pastas dos lotes do catalog_batch)")
    ids = read_ids(args.approved)
    conn, target = connect()
    mode = "GRAVANDO" if args.apply else "ensaio (nada é gravado)"
    if args.clear:
        removed = 0
        if args.apply:
            with conn.cursor() as cur:
                for product_id in ids:
                    cur.execute(CLEAR, {"product_id": product_id})
                    removed += cur.rowcount
            conn.commit()
        print(f"remover flat lay: {len(ids)} produtos · {removed} imagens alteradas · {mode} · {target}")
        return 0
    rows = load_lots(args.lots)
    refused = recover(conn, rows, ids) if args.recover_source else {}
    storage = make_storage() if args.apply else None
    results, planned = [], []
    for product_id in ids:
        reason, front = plan(rows.get(product_id))
        reason = refused.get(product_id, reason)
        if reason:
            results.append({"id": product_id, "status": "SKIPPED", "reason": reason})
        else:
            planned.append((rows[product_id], front))
    print(f"flat lays: {len(ids)} aprovados · {len(planned)} prontos · {mode} · {target}")
    live = current_rows(conn, [row["image_id"] for row, _ in planned])
    for row, front in planned:
        if not unchanged(live.get(str(row["image_id"])), row):
            results.append({"id": row["id"], "status": "STALE", "reason": "SOURCE_CHANGED_SINCE_BATCH"})
            continue
        try:
            results.append(apply_one(conn, row, front, storage, args.out_dir))
        except Exception as exc:   # um produto com problema não para o lote
            conn.rollback()
            results.append({"id": row["id"], "status": "FAILED", "reason": f"{type(exc).__name__}: {str(exc)[:120]}"})
    with args.audit.open("a", encoding="utf-8") as audit:
        for result in results:
            audit.write(json.dumps(result, ensure_ascii=False) + "\n")
    counts: dict[str, int] = {}
    for result in results:
        key = result["status"] + (f" ({result['reason']})" if result.get("reason") else "")
        counts[key] = counts.get(key, 0) + 1
    for key, count in sorted(counts.items()):
        print(f"  {count:5d}  {key}")
    return 1 if any(r["status"] == "FAILED" for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
