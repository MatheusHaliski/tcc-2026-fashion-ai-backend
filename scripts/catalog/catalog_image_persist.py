"""Gravação no MySQL do lote de imagens (--database --apply): produto a produto pelo apply_product, com diário
.changes.audit.jsonl, limpeza de assets sem referência e o resultado de cada foto no relatório."""
from __future__ import annotations

import json
import os

from catalog_image_report import progress, safe_audit

def update_committed(record, change):
    """Report the actual committed row, including ranking-only changes."""
    after = change["after"]
    record.update({key: value for key, value in after.items() if key not in ("id", "product_id", "source_url")})
    for name in ("crop", "metrics", "assets"):
        value = record.get(name + "_json")
        record[name] = json.loads(value) if isinstance(value, str) else value
    assets = record.get("assets")
    record["current_url"] = (assets.get("card") or record.get("stored_url") if record.get("is_canonical") and assets
                             else record["source_url"])
    return record


def asset_referenced(url):
    from db import connect
    conn = connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM catalog_images WHERE stored_url=%s OR JSON_SEARCH(assets_json, 'one', %s) IS NOT NULL LIMIT 1", (url, url))
            return cursor.fetchone() is not None
    finally:
        conn.rollback()
        conn.close()


def cleanup_assets(storage, analyses):
    for analysis in analyses.values():
        assets = analysis.get("framed_assets")
        if assets:
            try:
                storage.discard_unreferenced(assets, asset_referenced)
            except Exception:
                # Never delete if reference status is uncertain. Retain for operator audit.
                progress("Limpeza pendente: não foi possível confirmar referência/remoção de asset.")


def persist_products(args, records, analyzer, summary, counter_factory):
    """Aplica as análises de cada produto numa transação e atualiza as linhas do relatório com o que foi gravado."""
    from catalog_image_inventory import is_standardized
    from catalog_image_updates import apply_product
    from db import connect
    by_product = {}
    for row in records:
        by_product.setdefault(row["product_id"], []).append(row)
    counter = counter_factory("Verificando e gravando produtos no MySQL", len(by_product))
    conn = connect()
    try:
        changed_total = 0
        with args.output.with_suffix(".changes.audit.jsonl").open("a", encoding="utf-8") as journal:
            for completed, rows in enumerate(by_product.values(), 1):
                analyses = {r["image_id"]: r["analysis"] for r in rows if r.get("analysis")}
                if not analyses:
                    counter.update(completed, detail=f"Imagens alteradas: {changed_total}.")
                    continue
                try:
                    report = apply_product(conn, rows, analyses, analyzer.rank,
                                           persistence_override="FORCED_CATEGORY_FRAME" if args.force_category_frame else None)
                finally:
                    if args.category_frame:
                        cleanup_assets(analyzer.frame_storage, analyses)
                committed = {change["image_id"]: change for change in report["changes"]}
                for change in committed.values():
                    journal.write(json.dumps(safe_audit(change), ensure_ascii=False, default=str) + "\n")
                journal.flush()
                os.fsync(journal.fileno())
                changed_total += len(committed)
                for row in rows:
                    if row["image_id"] in committed:
                        update_committed(row, committed[row["image_id"]])
                        row["standardized_after"] = is_standardized(row)
                        if (row.get("analysis") or {}).get("frame_revert"):
                            row["frame_reverted"] = True
                            row["frame_observations"] = ["REVERTED_TO_ORIGINAL:" + row["frame_revert"]["reason"].split(":", 1)[1]]
                            row["status_note"] = ("Quadro V4 recusado: a imagem enquadrada antiga (" + str(row["frame_revert"]["revertedFrom"])
                                                  + ") voltou ao estado anterior ao quadro no banco; o JPEG antigo continua no S3.")
                        else:
                            row["status_note"] = ("Enquadramento salvo no S3 e referência ativa atualizada no banco." if (row.get("analysis") or {}).get("framed_assets")
                                                  else "Pipeline e enquadramento salvos no banco." if row.get("analysis")
                                                  else "Imagem canônica reclassificada no banco.")
                        row["write_result"] = "COMMITTED"
                    elif row["image_id"] in analyses:
                        row["status_note"] = "Não alterado: registro mudou ou revisão humana preservada."
                        row["write_result"] = "SKIPPED:" + str(report.get("skip_reasons", {}).get(row["image_id"], "PRODUCT_CHANGED"))
                counter.update(completed, detail=f"Imagens alteradas: {changed_total}.")
        counter.update(len(by_product), detail=f"Imagens alteradas: {changed_total}.", force=True)
        summary["database_images_changed"] = changed_total
        summary["applied_to_database"] = changed_total > 0
    finally:
        conn.close()
