"""Saídas do lote de imagens do catálogo (process_catalog_images.py): auditoria sem URLs nem credenciais, progresso no
stderr, o resumo da execução e a exportação (planilha, .audit.jsonl e .summary.json)."""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.parse
from collections import Counter

def safe_audit(value):
    """Audit artifacts retain identity hashes, never URL credentials/signatures."""
    if isinstance(value, dict):
        return {key: safe_audit(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [safe_audit(item) for item in value]
    if isinstance(value, str):
        if value.startswith(("https://", "http://")):
            try:
                host = urllib.parse.urlsplit(value).hostname or "invalid"
            except ValueError:
                host = "invalid"
            return {"host": host, "url_sha256": hashlib.sha256(value.encode()).hexdigest()}
        if value.startswith(("{", "[")):
            try:
                return safe_audit(json.loads(value))
            except ValueError:
                pass
    return value


def progress(message):
    """Keep phase/counter messages separate from the JSON result and omit inputs."""
    print("[catalogo] " + message, file=sys.stderr, flush=True)


def summarize(records, summary):
    """Contagens do resumo: estado e motivo da fonte, falhas, observações do quadro e resultado da gravação."""
    summary["persistence_states"] = dict(Counter((r.get("persistence_decision") or {}).get("state", "UNKNOWN") for r in records if r.get("source_url")))
    summary["persistence_reasons"] = dict(Counter((r.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED") for r in records if r.get("source_url")))
    summary["failure_reasons"] = dict(Counter(r["error"].split(":", 1)[0] for r in records if r.get("error")))
    summary["frame_observations"] = dict(Counter(o.split(":", 1)[0] for r in records for o in (r.get("frame_observations") or [])))
    summary["frame_fallbacks"] = sum(bool(r.get("frame_fallback")) for r in records)
    summary["frame_unavailable"] = dict(Counter(r["error"].split(":", 2)[1] for r in records
                                                 if str(r.get("error", "")).startswith("FRAME_UNAVAILABLE:")))
    summary["fabric_frame_unavailable"] = summary["frame_unavailable"]        # nome antigo (V2), mantido nos relatórios
    summary["write_results"] = dict(Counter(str(r.get("write_result")).split(":", 1)[0] for r in records if r.get("write_result")))
    # quadros antigos (V1/V2) desfeitos porque a V3 recusou a foto (só os confirmados no COMMIT)
    summary["frame_reverted"] = sum(r.get("frame_reverted") is True for r in records)


def export_reports(args, records, summary, write_workbook):
    """Planilha .xlsx, .audit.jsonl e .summary.json ao lado de --output; o resumo em JSON vai para a saída padrão."""
    progress("Exportando a planilha e os relatórios de auditoria...")
    jsonl = args.output.with_suffix(".audit.jsonl")
    with jsonl.open("w", encoding="utf-8") as stream:
        for row in records:
            stream.write(json.dumps(safe_audit(row), ensure_ascii=False, default=str) + "\n")
    write_workbook(records, args.output, summary)
    summary.update(rows=len(records), products=len({r["product_id"] for r in records}),
                   images=sum(bool(r.get("source_url")) for r in records),
                   without_image=sum(not bool(r.get("source_url")) for r in records),
                   standardized=sum(r.get("standardized_after") is True for r in records),
                   unknown=sum(r.get("standardized_after") is None for r in records),
                   failures=sum(bool(r.get("error")) for r in records))
    args.output.with_suffix(".summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    progress(f"Execução concluída: {summary['standardized']} imagens padronizadas; {summary['failures']} falhas.")
    print(json.dumps({"output": str(args.output), **summary}, ensure_ascii=False, indent=2))
