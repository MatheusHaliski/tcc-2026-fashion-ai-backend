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
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

PIPELINE_VERSION = "CATALOG_IMAGE_PIPELINE_V4"
MAX_BYTES = 10 * 1024 * 1024  # Mesmo ImageOps.MAX_UPLOAD_BYTES da API Java.
PROGRESS_INTERVAL = 5
# Falhas do canal Java que valem para o lote inteiro: nunca viram enquadramento geométrico de uma foto.
JAVA_TRANSPORT_ERRORS = {"PROCESS_EXITED", "PIPE_CLOSED", "REQUEST_TIMEOUT", "ANALYZER_CLOSED", "STARTUP_TIMEOUT",
                         "JAVA_START_FAILED", "JAVA_UNAVAILABLE", "CLASSPATH_UNAVAILABLE", "PIPELINE_VERSION_MISMATCH",
                         "PROTOCOL_ERROR", "DUPLICATE_REQUEST_ID", "BAD_REQUEST"}


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


def authorize_download(url, allowed_domains):
    if allowed_domains is None:
        return
    from source_persistence import image_hostname, matches
    host = image_hostname(url)
    if not any(matches(host, domain) for domain in allowed_domains):
        raise DownloadFailure("REDIRECT_OR_HOST_UNAUTHORIZED")


class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_domains=None):
        super().__init__()
        self.allowed_domains = allowed_domains

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_image_url(newurl)
        authorize_download(newurl, self.allowed_domains)
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
        self.final_urls = {}

    def get(self, url: str, *, allowed_domains=None) -> Path:
        authorize_download(url, allowed_domains)
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
                authorize_download(self.final_urls.get(str(path), url), allowed_domains)
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
                    opener = urllib.request.build_opener(CheckedRedirect(allowed_domains))
                    with opener.open(request, timeout=self.timeout) as response:
                        public_image_url(response.geturl())
                        authorize_download(response.geturl(), allowed_domains)
                        self.final_urls[str(path)] = response.geturl()
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


def fresh_source_decision(record):
    from db import connect
    from source_persistence import source_decision
    conn = connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT s.domain, s.active, s.allows_image_persistence FROM catalog_sources s JOIN catalog_products p ON p.brand_id=s.brand_id WHERE p.id=%s", (record["product_id"],))
            return source_decision(cursor.fetchall(), record["source_url"], record.get("source_domain"))
    finally:
        conn.rollback()
        conn.close()


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


def audit_record(record, downloader, analyzer, checkpoint, *, apply):
    from catalog_image_inventory import is_standardized
    from category_frame import VERSION as FRAME_VERSION
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
    if before is True and (not getattr(analyzer, "category_frame", False) or result.get("pipeline_version") == FRAME_VERSION):
        result["status_note"] = "Já aprovado e padronizado nesta versão; preservado."
        return result
    if result.get("review_status") in ("APPROVED", "REJECTED") or result.get("processing_status") == "DOWNLOADING" or result.get("usage_status") == "REJECTED":
        result["status_note"] = "Preservado: revisão humana ou processamento em andamento."
        return result
    category_frame = getattr(analyzer, "category_frame", False)
    frame_storage = getattr(analyzer, "frame_storage", None)
    # Decisão explícita do responsável (--force-category-frame): dispensa só a autorização da fonte e a
    # identificação visual confirmada; as proteções técnicas de download continuam valendo.
    force = bool(category_frame) and getattr(analyzer, "force_frame", False) is True
    try:
        if category_frame and not force:
            if result.get("category") not in {"upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"}:
                raise ValueError("CATEGORY_FRAME_UNSUPPORTED:" + str(result.get("category")))
            if frame_storage and not result.get("allows_image_persistence"):
                raise ValueError((result.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED"))
        # Sem fonte cadastrada não há domínio autorizado para redirecionamentos: no modo forçado o download segue
        # só com as proteções técnicas (HTTPS, sem credenciais, host público, tamanho, tipo).
        allowed = None if force else (result["persistence_decision"]["domains"] if frame_storage else None)
        response = checkpoint.get(result, analyzer.ready["pipelineVersion"])
        if response is not None and category_frame and (not isinstance(response.get("productFrame"), dict)
                                                         or response["productFrame"].get("version") != analyzer.ready.get("productFrameVersion")):
            response = None                     # análise guardada antes da regra do produto (V1/V2) ou de outra versão dela: refaz
        if response is None:
            path = downloader.get(result["source_url"], allowed_domains=allowed) if frame_storage else downloader.get(result["source_url"])
            try:
                response = analyzer.analyze(path, result.get("category"), result.get("subcategory"),
                                            result.get("image_type") or "PACKSHOT", image_id=result["image_id"])
                checkpoint.put(result, analyzer.ready["pipelineVersion"], response)
            except Exception as error:
                code = getattr(error, "code", None)
                if not category_frame or not code or code in JAVA_TRANSPORT_ERRORS:
                    raise
                # Java não analisou esta foto (ex.: IMAGE_TOO_SMALL): sem a máscara da peça não há como aplicar a regra — a foto
                # não é reenquadrada
                raise ValueError("FRAME_UNAVAILABLE:JAVA_" + str(code)) from error
        result["java_analysis_completed"] = True
        if category_frame:
            from category_frame import apply_frame, report_fields, FORCED_DECISION
            response = apply_frame(response, result.get("category"), force=force, subcategory=result.get("subcategory"))
            result.update(report_fields(response))
        if frame_storage:
            path = downloader.get(result["source_url"], allowed_domains=allowed)
            if force:
                decision = {"mode": FORCED_DECISION, "sourceState": (result.get("persistence_decision") or {}).get("state"),
                            "sourceReason": (result.get("persistence_decision") or {}).get("reason"),
                            "host": (result.get("persistence_decision") or {}).get("host"), "decidedBy": "PROJECT_OWNER"}
                public_image_url(downloader.final_urls.get(str(path), result["source_url"]))
                response["framed_assets"] = analyzer.frame_storage.store(result, response, path, decision=decision)
            else:
                if not result.get("allows_image_persistence"):
                    raise ValueError((result.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED"))
                fresh = fresh_source_decision(result)
                if fresh['state'] != 'AUTHORIZED':
                    raise ValueError(fresh['reason'])
                from source_persistence import image_hostname, matches
                if not any(matches(image_hostname(result['source_url']), d) for d in fresh['domains']):
                    raise ValueError('SOURCE_AUTHORIZATION_CHANGED')
                authorize_download(downloader.final_urls.get(str(path), result["source_url"]), fresh["domains"])
                response["framed_assets"] = analyzer.frame_storage.store(result, response, path)
            result["frame_render"] = response["framed_assets"].get("render_info")
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
        if isinstance(error, (DownloadFailure, ValueError)):
            result["error"] = str(error)
        elif getattr(error, "code", None):
            result["error"] = "JAVA:" + str(error.code)
        elif isinstance(getattr(error, "response", None), dict):
            # AWS error messages can contain URLs; report codes, never credentials.
            code = str(error.response.get("Error", {}).get("Code", "UNKNOWN"))
            result["error"] = "STORAGE_ERROR:" + code if code.replace("_", "").isalnum() else "STORAGE_ERROR"
        else:
            result["error"] = type(error).__name__
        result["status_note"] = "Pipeline não aplicado: " + result["error"]
    return result


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
    ap = argparse.ArgumentParser(description=__doc__)
    source = ap.add_mutually_exclusive_group(required=True)
    source.add_argument("--snapshot", nargs="+", type=Path, help="JSONL/JSONL.GZ: estado local, não produção")
    source.add_argument("--database", action="store_true", help="Inventário atual do MySQL via MYSQL_*")
    ap.add_argument("--category-frame", action="store_true",
                    help="Quadro 3:4 pela regra de enquadramento do produto do card (catalog/semantic-regions.json): parte de cima e de "
                         "baixo preenchem 100%% do quadro a partir da gola/do cós, calçado inteiro na largura, acessório inteiro contido; "
                         "sem quadro possível pela regra a foto não é reenquadrada; dúvida de conformidade exige revisão (requer --apply)")
    ap.add_argument("--force-category-frame", action="store_true",
                    help="Decisão do responsável: enquadra e persiste todas as fotos sem exigir autorização da fonte nem identificação "
                         "visual confirmada; dúvidas de conformidade viram observações no relatório. Sem quadro pela regra do produto a "
                         "foto não é gravada (requer --database --apply --category-frame)")
    ap.add_argument("--apply", action="store_true", help="Aplicar pipeline; com --database persiste os metadados")
    ap.add_argument("--output", required=True, type=Path, help="Planilha .xlsx")
    ap.add_argument("--checkpoint", type=Path, help="SQLite de análises para retomada")
    ap.add_argument("--java-classpath")
    ap.add_argument("--java")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--java-threads", type=int, default=2)
    ap.add_argument("--authorized-only", action="store_true", help="Selecionar produtos com ao menos uma imagem autorizada; preservar inventário completo por produto")
    ap.add_argument("--limit", type=int, help="Limitar imagens apenas para amostra explicitamente identificada")
    ap.add_argument("--timeout", type=float, default=25)
    args = ap.parse_args(argv)
    if args.authorized_only and not args.database:
        ap.error("--authorized-only requer --database")
    if args.category_frame and not args.database:
        ap.error("--category-frame requer --database: snapshots não autorizam uploads")
    if args.category_frame and not args.apply:
        ap.error("--category-frame requer --apply")
    if args.force_category_frame and not (args.database and args.apply and args.category_frame):
        ap.error("--force-category-frame requer --database --apply --category-frame")
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
                            stream.write(json.dumps(safe_audit(row), ensure_ascii=False, default=str) + "\n")
            with tempfile.TemporaryDirectory(prefix="fashionai-catalog-images-") as directory:
                downloader = ImageDownloader(Path(directory), timeout=args.timeout)
                with CatalogImageAnalyzer(classpath, java=args.java, threads=args.java_threads,
                                          stderr_path=args.output.with_suffix(".java.log")) as analyzer:
                    if analyzer.ready["pipelineVersion"] != PIPELINE_VERSION:
                        raise RuntimeError("JAR desatualizado: compile a versão atual do pipeline antes de aplicar")
                    if args.category_frame and not analyzer.ready.get("productFrameVersion"):
                        raise RuntimeError("JAR sem a regra de enquadramento do produto (V3): rode `mvn -q -DskipTests package` antes de aplicar")
                    analyzer.category_frame = args.category_frame
                    analyzer.force_frame = args.force_category_frame
                    if args.force_category_frame:
                        progress("Modo forçado: autorização da fonte e identificação visual não bloqueiam; proteções técnicas de download mantidas.")
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
        finally:
            if args.category_frame and "analyzer" in locals() and getattr(analyzer, "frame_storage", None):
                cleanup_assets(analyzer.frame_storage, {str(i): {"framed_assets": assets} for i, assets in enumerate(analyzer.frame_storage.pending_assets())})
            checkpoint.close()
    else:
        records = [audit_record(row, None, None, None, apply=False) for row in records]
    summary["persistence_states"] = dict(Counter((r.get("persistence_decision") or {}).get("state", "UNKNOWN") for r in records if r.get("source_url")))
    summary["persistence_reasons"] = dict(Counter((r.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED") for r in records if r.get("source_url")))
    summary["failure_reasons"] = dict(Counter(r["error"].split(":", 1)[0] for r in records if r.get("error")))
    summary["frame_observations"] = dict(Counter(o.split(":", 1)[0] for r in records for o in (r.get("frame_observations") or [])))
    summary["frame_fallbacks"] = sum(bool(r.get("frame_fallback")) for r in records)
    summary["frame_unavailable"] = dict(Counter(r["error"].split(":", 2)[1] for r in records
                                                 if str(r.get("error", "")).startswith("FRAME_UNAVAILABLE:")))
    summary["fabric_frame_unavailable"] = summary["frame_unavailable"]        # nome antigo (V2), mantido nos relatórios
    summary["write_results"] = dict(Counter(str(r.get("write_result")).split(":", 1)[0] for r in records if r.get("write_result")))
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
    return 2 if args.apply and any(r.get("error") for r in records) else 0


if __name__ == "__main__":
    raise SystemExit(main())
