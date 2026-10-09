#!/usr/bin/env python3
"""Audit the complete catalog, apply the existing Java pipeline, and export XLSX.

Snapshots are explicitly not evidence of current production state. Database writes
require --database --apply; source photos are only downloaded to temporary storage.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import socket
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

PIPELINE_VERSION = "CATALOG_IMAGE_PIPELINE_V4"
MAX_BYTES = 10 * 1024 * 1024  # Mesmo ImageOps.MAX_UPLOAD_BYTES da API Java.
PROGRESS_INTERVAL = 5


def progress(message):
    """Keep phase/counter messages separate from the JSON result and omit inputs."""
    print("[catalogo] " + message, file=sys.stderr, flush=True)


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
    analyzed = failures = completed = 0
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
                analyzed += bool(result.get("analysis"))
                failures += bool(result.get("error"))
            counter.update(completed, detail=f"Análises concluídas: {analyzed}; falhas: {failures}.")
    counter.update(completed, detail=f"Análises concluídas: {analyzed}; falhas: {failures}.", force=True)
    return results


class DownloadFailure(RuntimeError):
    pass


def configure_railway_environment():
    """Accept Railway names without logging URLs/passwords or using root implicitly."""
    public_url = os.environ.get("MYSQL_PUBLIC_URL", "").strip()
    # urlsplit treats bare host:port as a scheme/path, not a network endpoint.
    # Normalize only the parsed copy; preserve the original environment value.
    if public_url and "://" not in public_url and not public_url.startswith("//"):
        public_url = "mysql://" + public_url
    public = urllib.parse.urlsplit(public_url)
    if not os.getenv("MYSQL_HOST"):
        host = public.hostname or os.getenv("MYSQLHOST")
        if host:
            os.environ["MYSQL_HOST"] = host
        if public.hostname and public.port:
            os.environ.setdefault("MYSQL_PORT", str(public.port))
        elif os.getenv("MYSQLPORT"):
            os.environ.setdefault("MYSQL_PORT", os.environ["MYSQLPORT"])
    if not os.getenv("MYSQL_DATABASE"):
        database = os.getenv("MYSQLDATABASE") or public.path.removeprefix("/")
        if database:
            os.environ["MYSQL_DATABASE"] = database
    app_password = os.getenv("MYSQL_APP_PASSWORD") or os.getenv("RAILWAY_MYSQL_APP_PASSWORD")
    if not os.getenv("MYSQL_PASSWORD") and app_password:
        os.environ["MYSQL_PASSWORD"] = app_password
        os.environ.setdefault("MYSQL_USER", "fai_app")
    elif not os.getenv("MYSQL_USER") and os.getenv("MYSQLUSER") and os.getenv("MYSQLUSER") != "root":
        os.environ["MYSQL_USER"] = os.environ["MYSQLUSER"]
    if public.hostname:
        os.environ.setdefault("MYSQL_SSL_MODE", "REQUIRED")


def public_image_url(url: str) -> str:
    """Reject credentials, non-HTTPS sources, and local/internal addresses."""
    try:
        parts = urllib.parse.urlsplit(url)
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
            raise DownloadFailure("UNSAFE_IMAGE_URL")
        if parts.port not in (None, 443):
            raise DownloadFailure("UNSAFE_IMAGE_PORT")
        addresses = socket.getaddrinfo(parts.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
            raise DownloadFailure("NON_PUBLIC_IMAGE_HOST")
    except (ValueError, socket.gaierror) as error:
        raise DownloadFailure("IMAGE_HOST_UNAVAILABLE") from error
    return url


class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_image_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ImageDownloader:
    """Deduplicate downloads; stop a blocked domain and a rejected CONNECT proxy."""
    def __init__(self, directory: Path, *, timeout=25, min_interval=.5):
        self.directory = directory
        self.timeout = timeout
        self.min_interval = min_interval
        self.lock = threading.Lock()
        self.domain_locks = {}
        self.last_request = {}
        self.stopped_domains = {}
        self.proxy_blocked = False

    def get(self, url: str) -> Path:
        host = urllib.parse.urlsplit(url).hostname or ""
        key = hashlib.sha256(url.encode()).hexdigest()
        path = self.directory / (key + ".img")
        with self.lock:
            domain_lock = self.domain_locks.setdefault(host, threading.Lock())
        with domain_lock:
            if self.proxy_blocked:
                raise DownloadFailure("NETWORK_PROXY_BLOCKED")
            if host in self.stopped_domains:
                raise DownloadFailure(self.stopped_domains[host])
            try:
                public_image_url(url)
            except DownloadFailure as error:
                if str(error) == "IMAGE_HOST_UNAVAILABLE":
                    self.stopped_domains[host] = str(error)
                raise
            if path.exists() and 0 < path.stat().st_size <= MAX_BYTES:
                return path
            for attempt in range(3):
                delay = self.min_interval - (time.monotonic() - self.last_request.get(host, 0))
                if delay > 0:
                    time.sleep(delay)
                self.last_request[host] = time.monotonic()
                request = urllib.request.Request(url, headers={
                    "User-Agent": "FashionAI-catalog-image-pipeline/4.0",
                    "Accept": "image/*", "Accept-Encoding": "identity",
                })
                try:
                    opener = urllib.request.build_opener(CheckedRedirect())
                    with opener.open(request, timeout=self.timeout) as response:
                        if response.headers.get_content_maintype() != "image":
                            raise DownloadFailure("NOT_AN_IMAGE")
                        if int(response.headers.get("Content-Length", "0")) > MAX_BYTES:
                            raise DownloadFailure("IMAGE_TOO_LARGE")
                        body = response.read(MAX_BYTES + 1)
                    if not body or len(body) > MAX_BYTES:
                        raise DownloadFailure("IMAGE_TOO_LARGE_OR_EMPTY")
                    temp = path.with_suffix(".tmp")
                    temp.write_bytes(body)
                    temp.replace(path)
                    return path
                except urllib.error.HTTPError as error:
                    if error.code in (403, 429):
                        self.stopped_domains[host] = f"IMAGE_DOMAIN_BLOCKED_{error.code}"
                    if error.code >= 500 and attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    raise DownloadFailure(f"IMAGE_HTTP_{error.code}") from error
                except (urllib.error.URLError, TimeoutError, OSError) as error:
                    # A proxy's CONNECT rejection applies to the execution environment,
                    # not to each of the thousands of product photos individually.
                    reason = str(getattr(error, "reason", ""))
                    if "Tunnel connection failed: 403" in reason or "CONNECT tunnel failed" in reason:
                        self.proxy_blocked = True
                        raise DownloadFailure("NETWORK_PROXY_BLOCKED") from error
                    if attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    raise DownloadFailure("IMAGE_DOWNLOAD_UNAVAILABLE") from error
            raise DownloadFailure("IMAGE_DOWNLOAD_UNAVAILABLE")


class AnalysisCheckpoint:
    """Only completed analyses are resumable; download failures are retried next run."""
    def __init__(self, path: Path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        self.conn.execute("CREATE TABLE IF NOT EXISTS analyses (cache_key TEXT PRIMARY KEY, result TEXT NOT NULL)")
        self.conn.commit()

    def key(self, record, version):
        context = [version, record.get("source_url"), record.get("category"), record.get("subcategory"),
                   record.get("image_type"), record.get("version"), record.get("source_sha256"), record.get("last_verified_at")]
        return hashlib.sha256(json.dumps(context, ensure_ascii=False, default=str).encode()).hexdigest()

    def get(self, record, version):
        with self.lock:
            found = self.conn.execute("SELECT result FROM analyses WHERE cache_key=?", (self.key(record, version),)).fetchone()
        return json.loads(found[0]) if found else None

    def put(self, record, version, result):
        with self.lock:
            self.conn.execute("INSERT OR REPLACE INTO analyses VALUES (?, ?)",
                              (self.key(record, version), json.dumps(result, ensure_ascii=False)))
            self.conn.commit()

    def close(self):
        self.conn.close()


def update_analysis(record, response):
    """Keep existing source/provenance and attach only the CLI's analysis columns."""
    updated = {**record, **response["columns"]}
    for alias, key in (("crop", "crop_json"), ("metrics", "metrics_json")):
        value = updated.get(key)
        updated[alias] = json.loads(value) if isinstance(value, str) else value
    return updated


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


def audit_record(record, downloader, analyzer, checkpoint, *, apply):
    from catalog_image_inventory import is_standardized
    result = dict(record)
    snapshot = (result.get("origin") == "SNAPSHOT" or result.get("source_scope") == "SNAPSHOT_LOCAL"
                or str(result.get("source_scope", "")).startswith("snapshot:"))
    known = not snapshot or bool(result.get("processing_status") or result.get("pipeline_version"))
    before = is_standardized(result) if known or not result.get("source_url") else None
    result.update(standardized_before=before, standardized_after=before)
    if not result.get("source_url"):
        result["status_note"] = "Produto sem imagem cadastrada."
        return result
    if not apply:
        result["status_note"] = "Não verificado no banco atual; snapshot sem metadados." if before is None else "Auditoria dos metadados atuais."
        return result
    if before is True and (not getattr(analyzer, "category_frame", False) or result.get("pipeline_version") == "CATALOG_FRAME_34_50_V1"):
        result["status_note"] = "Já aprovado e padronizado nesta versão; preservado."
        return result
    if result.get("review_status") in ("APPROVED", "REJECTED") or result.get("processing_status") == "DOWNLOADING":
        result["status_note"] = "Preservado: revisão humana ou processamento em andamento."
        return result
    try:
        response = checkpoint.get(result, analyzer.ready["pipelineVersion"])
        if response is None:
            path = downloader.get(result["source_url"])
            response = analyzer.analyze(path, result.get("category"), result.get("subcategory"),
                                        result.get("image_type") or "PACKSHOT", image_id=result["image_id"])
            checkpoint.put(result, analyzer.ready["pipelineVersion"], response)
        if getattr(analyzer, "category_frame", False):
            from category_frame import apply_frame
            response = apply_frame(response, result.get("category"))
        if getattr(analyzer, "frame_storage", None):
            if not result.get("allows_image_persistence"):
                raise ValueError("SOURCE_DISALLOWS_IMAGE_PERSISTENCE")
            path = downloader.get(result["source_url"])
            response["framed_assets"] = analyzer.frame_storage.store(result, response, path)
        result["analysis"] = response
        analyzed = update_analysis(result, response)
        result["analysis_standardized"] = is_standardized(analyzed)
        # Snapshot results are local evidence, never a claim of a production update.
        if snapshot:
            result.update(analyzed)
            result["standardized_after"] = result["analysis_standardized"]
        result["status_note"] = "Pipeline executado; " + ("enquadramento aprovado." if result["analysis_standardized"]
                                                         else "não aprovado para o enquadramento; requer revisão.")
    except Exception as error:
        result["error"] = str(error) if isinstance(error, (DownloadFailure, ValueError)) else type(error).__name__
        result["status_note"] = "Pipeline não aplicado: " + result["error"]
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    source = ap.add_mutually_exclusive_group(required=True)
    source.add_argument("--snapshot", nargs="+", type=Path, help="JSONL/JSONL.GZ: estado local, não produção")
    source.add_argument("--database", action="store_true", help="Inventário atual do MySQL via MYSQL_*")
    ap.add_argument("--category-frame", action="store_true", help="Quadro 3:4 com largura 50%; focos estimados de zíper/cadarço exigem revisão (requer --apply)")
    ap.add_argument("--apply", action="store_true", help="Aplicar pipeline; com --database persiste os metadados")
    ap.add_argument("--output", required=True, type=Path, help="Planilha .xlsx")
    ap.add_argument("--checkpoint", type=Path, help="SQLite de análises para retomada")
    ap.add_argument("--java-classpath")
    ap.add_argument("--java")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--java-threads", type=int, default=2)
    ap.add_argument("--limit", type=int, help="Limitar imagens apenas para amostra explicitamente identificada")
    ap.add_argument("--timeout", type=float, default=25)
    args = ap.parse_args(argv)
    if args.category_frame and not args.apply:
        ap.error("--category-frame requer --apply")
    if args.output.suffix.lower() != ".xlsx":
        ap.error("--output deve terminar em .xlsx")
    if args.workers < 1 or args.workers > 16 or args.java_threads < 1 or args.java_threads > 16:
        ap.error("Concorrência deve ficar entre 1 e 16")
    if args.limit is not None and args.limit < 1:
        ap.error("--limit deve ser positivo")
    from catalog_image_inventory import load_database, load_snapshot
    from catalog_image_workbook import write_workbook
    if args.database:
        configure_railway_environment()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    progress("Consultando o inventário atual do MySQL..." if args.database else "Lendo o inventário local...")
    records = list(load_database() if args.database else load_snapshot(args.snapshot))
    total = len(records)
    progress(f"Inventário carregado: {len({r['product_id'] for r in records})} peças, "
             f"{sum(bool(r.get('source_url')) for r in records)} imagens, {total} registros.")
    if args.limit:
        records = records[:args.limit]
        progress(f"Amostra selecionada: {len(records)} registros.")
    summary = {"source_scope": "DATABASE" if args.database else "SNAPSHOT_LOCAL",
               "source": "MySQL configurado em MYSQL_*" if args.database else ", ".join(str(p) for p in args.snapshot),
               "pipeline_version": PIPELINE_VERSION, "sample": bool(args.limit), "inventory_rows": total,
               "applied_to_database": False, "generated_at": datetime.now(timezone.utc).isoformat()}
    if args.apply:
        from catalog_image_analyzer import CatalogImageAnalyzer, ensure_classpath
        from catalog_image_inventory import is_standardized
        progress("Preparando e iniciando o pipeline Java...")
        classpath = ensure_classpath(Path(__file__).resolve().parents[2], classpath=args.java_classpath)
        checkpoint = AnalysisCheckpoint(args.checkpoint or args.output.with_suffix(".checkpoint.sqlite"))
        try:
            if args.database:
                before = args.output.with_suffix(".before.audit.jsonl")
                if not before.exists():
                    with before.open("w", encoding="utf-8") as stream:
                        for row in records:
                            stream.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
            with tempfile.TemporaryDirectory(prefix="fashionai-catalog-images-") as directory:
                downloader = ImageDownloader(Path(directory), timeout=args.timeout)
                with CatalogImageAnalyzer(classpath, java=args.java, threads=args.java_threads,
                                          stderr_path=args.output.with_suffix(".java.log")) as analyzer:
                    if analyzer.ready["pipelineVersion"] != PIPELINE_VERSION:
                        raise RuntimeError("JAR desatualizado: compile a versão atual do pipeline antes de aplicar")
                    analyzer.category_frame = args.category_frame
                    if args.category_frame:
                        from category_frame_storage import FrameStorage
                        analyzer.frame_storage = FrameStorage()
                    progress("Pipeline Java pronto.")
                    records = analyze_records(records, downloader, analyzer, checkpoint, workers=args.workers)
                    summary["network_proxy_blocked"] = downloader.proxy_blocked
                    if args.database:
                        from catalog_image_updates import apply_product
                        from db import connect
                        by_product = {}
                        for row in records:
                            by_product.setdefault(row["product_id"], []).append(row)
                        counter = ProgressCounter("Verificando e gravando produtos no MySQL", len(by_product))
                        conn = connect()
                        try:
                            changed_total = 0
                            with args.output.with_suffix(".changes.audit.jsonl").open("a", encoding="utf-8") as journal:
                                for completed, rows in enumerate(by_product.values(), 1):
                                    analyses = {r["image_id"]: r["analysis"] for r in rows if r.get("analysis")}
                                    if not analyses:
                                        counter.update(completed, detail=f"Imagens alteradas: {changed_total}.")
                                        continue
                                    report = apply_product(conn, rows, analyses, analyzer.rank)
                                    committed = {change["image_id"]: change for change in report["changes"]}
                                    for change in committed.values():
                                        journal.write(json.dumps(change, ensure_ascii=False, default=str) + "\n")
                                    journal.flush()
                                    os.fsync(journal.fileno())
                                    changed_total += len(committed)
                                    for row in rows:
                                        if row["image_id"] in committed:
                                            update_committed(row, committed[row["image_id"]])
                                            row["standardized_after"] = is_standardized(row)
                                            row["status_note"] = ("Pipeline e enquadramento salvos no banco." if row.get("analysis")
                                                                  else "Imagem canônica reclassificada no banco.")
                                        elif row["image_id"] in analyses:
                                            row["status_note"] = "Não alterado: registro mudou ou revisão humana preservada."
                                    counter.update(completed, detail=f"Imagens alteradas: {changed_total}.")
                            counter.update(len(by_product), detail=f"Imagens alteradas: {changed_total}.", force=True)
                            summary["database_images_changed"] = changed_total
                            summary["applied_to_database"] = changed_total > 0
                        finally:
                            conn.close()
        finally:
            checkpoint.close()
    else:
        records = [audit_record(row, None, None, None, apply=False) for row in records]
    progress("Exportando a planilha e os relatórios de auditoria...")
    jsonl = args.output.with_suffix(".audit.jsonl")
    with jsonl.open("w", encoding="utf-8") as stream:
        for row in records:
            stream.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
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
    return 2 if args.apply and any(r.get("error") for r in records) else 0


if __name__ == "__main__":
    raise SystemExit(main())
