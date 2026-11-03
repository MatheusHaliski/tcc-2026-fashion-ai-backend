#!/usr/bin/env python3
"""Audit the complete catalog, apply the existing Java pipeline, and export XLSX.

Snapshots are explicitly not evidence of current production state. Database writes
require --database --apply; source photos are only downloaded to temporary storage.
"""
from __future__ import annotations

import json
import socket  # noqa: F401 — os testes trocam process_catalog_images.socket.getaddrinfo
import sys
import tempfile
import time
from datetime import datetime, timezone
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

PIPELINE_VERSION = "CATALOG_IMAGE_PIPELINE_V4"
PROGRESS_INTERVAL = 5

# Fachada: CLI (main) e a análise concorrente ficam aqui; download, ambiente, checkpoint, auditoria de cada foto,
# gravação e relatórios em catalog_image_*.py. Os nomes de antes continuam importáveis deste módulo.
from catalog_image_download import (MAX_BYTES, CheckedRedirect, DownloadFailure, ImageDownloader,  # noqa: E402,F401
                                    authorize_download, public_image_url)
from catalog_image_environment import (FRAME_MYSQL_VARIABLES, FRAME_S3_VARIABLES,  # noqa: E402,F401
                                       configure_railway_environment, missing_frame_environment)
from catalog_image_checkpoint import AnalysisCheckpoint  # noqa: E402,F401
from catalog_image_audit import JAVA_TRANSPORT_ERRORS, audit_record, fresh_source_decision, update_analysis  # noqa: E402,F401
from catalog_image_report import export_reports, progress, safe_audit, summarize  # noqa: E402,F401
from catalog_image_persist import asset_referenced, cleanup_assets, persist_products, update_committed  # noqa: E402,F401
from catalog_image_cli import build_parser, parse_args  # noqa: E402,F401


class ProgressCounter:
    def __init__(self, label, total):
        self.label = label
        self.total = total
        self.last_report = time.monotonic()
        progress(f"{label}: 0/{total}.")

    def update(self, completed, *, detail="", force=False):
        now = time.monotonic()
        if force or now - self.last_report >= PROGRESS_INTERVAL:
            progress(f"{self.label}: {completed}/{self.total}." + (" " + detail if detail else ""))
            self.last_report = now


def analyze_records(records, downloader, analyzer, checkpoint, *, workers):
    """Report completions as they arrive while preserving the inventory's order."""
    results = [None] * len(records)
    counter = ProgressCounter("Analisando registros de imagem", len(records))
    analyzed = failures = completed = java_completed = 0
    failure_reasons = Counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending = {
            pool.submit(audit_record, row, downloader, analyzer, checkpoint, apply=True): index
            for index, row in enumerate(records)
        }
        while pending:
            done, _ = wait(pending, timeout=PROGRESS_INTERVAL, return_when=FIRST_COMPLETED)
            for future in done:
                index = pending.pop(future)
                result = future.result()
                results[index] = result
                completed += 1
                java_completed += bool(result.get("java_analysis_completed"))
                analyzed += bool(result.get("analysis"))
                if result.get("error"):
                    failure_reasons[result["error"].split(":", 1)[0]] += 1
                failures += bool(result.get("error"))
            counter.update(completed, detail=f"Java concluído: {java_completed}; prontas para gravação: {analyzed}; falhas: {failures}. Motivos: {dict(failure_reasons.most_common(4))}")
    counter.update(completed, detail=f"Java concluído: {java_completed}; prontas para gravação: {analyzed}; falhas: {failures}. Motivos: {dict(failure_reasons)}", force=True)
    return results


def select_records(records, limit=None, authorized_only=False, database=False):
    if authorized_only:
        products = {r['product_id'] for r in records if r.get('allows_image_persistence')}
        records = [r for r in records if r['product_id'] in products]
    if limit:
        if database:
            candidates = [r for r in records if r.get('allows_image_persistence')] if authorized_only else records
            products = {r['product_id'] for r in candidates[:limit]}
            # SQL optimistic guards require every image of each selected product.
            records = [r for r in records if r['product_id'] in products]
        else:
            records = records[:limit]
    return records


def main(argv=None):
    from category_frame import VERSION as FRAME_VERSION
    ap = build_parser(__doc__)
    args = parse_args(ap, argv)
    from catalog_image_inventory import load_database, load_snapshot
    from catalog_image_workbook import write_workbook
    if args.database:
        configure_railway_environment()
    if args.apply and args.category_frame:
        missing = missing_frame_environment()
        if missing:
            progress("Configuração incompleta para --apply --category-frame: defina no ambiente " + ", ".join(missing)
                     + ". O MySQL também aceita os nomes do Railway (MYSQL_PUBLIC_URL, MYSQLHOST, MYSQLDATABASE, MYSQLUSER, "
                       "MYSQL_APP_PASSWORD). Nenhum valor é exibido; nada foi lido, baixado ou gravado.")
            return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    progress("Consultando o inventário atual do MySQL..." if args.database else "Lendo o inventário local...")
    records = list(load_database() if args.database else load_snapshot(args.snapshot))
    total = len(records)
    progress(f"Inventário carregado: {len({r['product_id'] for r in records})} peças, "
             f"{sum(bool(r.get('source_url')) for r in records)} imagens, {total} registros.")
    records = select_records(records, args.limit, args.authorized_only, args.database)
    if args.limit or args.authorized_only:
        progress(f"Seleção com inventário completo por produto: {len(records)} registros.")
    summary = {"source_scope": "DATABASE" if args.database else "SNAPSHOT_LOCAL",
               "source": "MySQL configurado em MYSQL_*" if args.database else ", ".join(str(p) for p in args.snapshot),
               "pipeline_version": PIPELINE_VERSION,
               "framing_version": FRAME_VERSION if args.category_frame else None,
               "forced_category_frame": bool(args.force_category_frame),
               "sample": bool(args.limit), "inventory_rows": total,
               "applied_to_database": False, "generated_at": datetime.now(timezone.utc).isoformat()}
    if args.apply:
        from catalog_image_analyzer import CatalogImageAnalyzer, ensure_classpath
        frame_storage = None
        if args.category_frame:
            # antes do Java: configuração do S3 inválida (URL pública sem HTTPS, boto3 ausente) para o lote no início, sem
            # traceback e sem exibir valores
            from category_frame_storage import FrameStorage
            try:
                frame_storage = FrameStorage()
            except ImportError:
                progress("boto3 não instalado: python3 -m pip install -r scripts/catalog/requirements-images.txt. Nada foi baixado ou gravado.")
                return 2
            except (KeyError, ValueError) as error:
                detail = ("variável " + str(error.args[0]) + " ausente" if isinstance(error, KeyError)
                          else str(error) if str(error).startswith("Configure ") else "confira S3_ENDPOINT, S3_REGION e as credenciais")
                progress("Configuração do S3 inválida para --category-frame: " + detail + ". Nenhum valor é exibido; nada foi baixado ou gravado.")
                return 2
        progress("Preparando e iniciando o pipeline Java...")
        classpath = ensure_classpath(Path(__file__).resolve().parents[2], classpath=args.java_classpath)
        checkpoint = AnalysisCheckpoint(args.checkpoint or args.output.with_suffix(".checkpoint.sqlite"))
        try:
            if args.database:
                before = args.output.with_suffix(".before.audit.jsonl")
                if not before.exists():
                    with before.open("w", encoding="utf-8") as stream:
                        for row in records:
                            stream.write(json.dumps(safe_audit(row), ensure_ascii=False, default=str) + "\n")
            with tempfile.TemporaryDirectory(prefix="fashionai-catalog-images-") as directory:
                downloader = ImageDownloader(Path(directory), timeout=args.timeout)
                with CatalogImageAnalyzer(classpath, java=args.java, threads=args.java_threads,
                                          stderr_path=args.output.with_suffix(".java.log")) as analyzer:
                    if analyzer.ready["pipelineVersion"] != PIPELINE_VERSION:
                        raise RuntimeError("JAR desatualizado: compile a versão atual do pipeline antes de aplicar")
                    if args.category_frame and not analyzer.ready.get("fabricFrameVersion"):
                        raise RuntimeError("JAR sem enquadramento preenchido por categoria (V4): rode `mvn -q -DskipTests package` antes de aplicar")
                    analyzer.category_frame = args.category_frame
                    analyzer.force_frame = args.force_category_frame
                    if args.force_category_frame:
                        progress("Modo forçado: autorização da fonte e identificação visual não bloqueiam; proteções técnicas de download mantidas.")
                    if args.category_frame:
                        analyzer.frame_storage = frame_storage
                    progress("Pipeline Java pronto.")
                    records = analyze_records(records, downloader, analyzer, checkpoint, workers=args.workers)
                    summary["network_proxy_blocked"] = downloader.proxy_blocked
                    if args.database:
                        persist_products(args, records, analyzer, summary, ProgressCounter)
        finally:
            if args.category_frame and "analyzer" in locals() and getattr(analyzer, "frame_storage", None):
                cleanup_assets(analyzer.frame_storage, {str(i): {"framed_assets": assets} for i, assets in enumerate(analyzer.frame_storage.pending_assets())})
            checkpoint.close()
    else:
        records = [audit_record(row, None, None, None, apply=False) for row in records]
    summarize(records, summary)
    export_reports(args, records, summary, write_workbook)
    return 2 if args.apply and any(r.get("error") for r in records) else 0


if __name__ == "__main__":
    raise SystemExit(main())
