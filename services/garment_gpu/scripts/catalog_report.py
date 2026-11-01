"""Pilot report: summary table, projection for the whole catalogue and a visual grid (original × cut-out) to review."""
from __future__ import annotations

import html
import json
from collections import Counter
from pathlib import Path

from services.garment_gpu.scripts.catalog_classify import CLASSES

LABELS = {**CLASSES, "NO_GARMENT": "nenhuma peça detectada", "FAILED": "falhou (download/API)"}
COLORS = {"COMPLETE_PRODUCT": "#1a7f37", "COMPLETE_ON_MODEL": "#2f6fd6", "OCCLUDED": "#b26a00", "CUT": "#b26a00",
          "NO_GARMENT": "#a40e26", "FAILED": "#a40e26"}


def summarize(rows: list[dict], catalogue_size: int, gpu_hour_usd: float, workers: int) -> dict:
    counts = Counter(r["class"] for r in rows)
    done = [r for r in rows if r.get("gpu_seconds") is not None]
    mean = sum(r["gpu_seconds"] for r in done) / len(done) if done else None
    reconstruct = counts["OCCLUDED"] + counts["CUT"]
    share = reconstruct / len(rows) if rows else 0.0
    hours = (mean * catalogue_size / max(workers, 1) / 3600) if mean else None
    return {"total": len(rows), "counts": dict(counts), "mean_gpu_seconds": round(mean, 2) if mean else None,
            "reconstruction_share": round(share, 4), "projected_reconstructions": round(share * catalogue_size),
            "projected_segment_hours": round(hours, 1) if hours else None,
            "projected_segment_usd": round(hours * gpu_hour_usd, 2) if hours else None}


def write_report(out: Path, rows: list[dict], summary: dict) -> Path:
    cards = []
    for r in rows:
        color = COLORS.get(r["class"], "#555")
        metrics = html.escape(json.dumps(r.get("metrics", {}), ensure_ascii=False))
        imgs = "".join(f'<img src="{html.escape(name)}" alt="">' for name in (r.get("thumb_in"), r.get("thumb_out")) if name)
        cards.append(f'<figure>{imgs}<figcaption><b style="color:{color}">{html.escape(LABELS.get(r["class"], r["class"]))}'
                     f'</b><br>{html.escape(str(r.get("name", "")))[:80]}<br><small>{html.escape(str(r.get("category")))}'
                     f' · {r.get("gpu_seconds", "–")} s · {html.escape(str(r.get("reason", "")))}</small>'
                     f'<details><summary>métricas</summary><code>{metrics}</code></details></figcaption></figure>')
    rows_html = "".join(f"<tr><td>{html.escape(LABELS.get(k, k))}</td><td>{v}</td></tr>"
                        for k, v in sorted(summary["counts"].items(), key=lambda kv: -kv[1]))
    page = f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Piloto GPU do catálogo</title><style>
body{{font:14px system-ui;margin:16px;background:#fafafa;color:#222}} table{{border-collapse:collapse;margin:8px 0 16px}}
td{{border:1px solid #ccc;padding:4px 10px}} .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}}
figure{{margin:0;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px}} img{{width:49%;height:180px;object-fit:contain;background:#eee}}
code{{font-size:11px;word-break:break-all}}</style>
<h1>Piloto de enquadramento — GPU própria</h1>
<p>{summary['total']} produtos · {summary['mean_gpu_seconds']} s/foto na GPU · precisariam de reconstrução:
<b>{summary['reconstruction_share']:.0%}</b> (projeção no catálogo: ~{summary['projected_reconstructions']} peças) ·
segmentação do catálogo inteiro: ~{summary['projected_segment_hours']} h ≈ US$ {summary['projected_segment_usd']}</p>
<table>{rows_html}</table><div class="grid">{''.join(cards)}</div></html>"""
    path = out / "index.html"
    path.write_text(page, encoding="utf-8")
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
