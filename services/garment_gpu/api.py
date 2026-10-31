"""Private FastAPI front door (CPU only): authentication, validation, quotas, job records and image delivery.
The GPU never talks to clients; it only consumes the Redis queues."""
from __future__ import annotations

import json
import re
import uuid
from typing import Literal

from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, REGISTRY, generate_latest

from services.garment_gpu import config as config_module, models, ratelimit, stages
from services.garment_gpu.image_ops import InvalidImage, check_bbox, decode_upload, png_bytes
from services.garment_gpu.jobstore import JobNotFound, JobStore, now_iso, public_view
from services.garment_gpu.metrics import JOBS_SUBMITTED, REQUESTS_REJECTED, REVIEWS, QueueCollector
from services.garment_gpu.security import Client, KeyRing
from services.garment_gpu.storage import ObjectNotFound, S3Store

JOB_ID = re.compile(r"^[0-9a-f]{32}$")
VARIANTS = ("final", "segmented", "reconstructed", "mask", "input")


def fail(status: int, code: str, message: str, headers: dict | None = None):
    raise HTTPException(status, {"code": code, "message": message}, headers=headers)


def create_app(settings=None, redis=None, store=None, enqueue=None) -> FastAPI:
    settings = settings or config_module.load()
    keyring = KeyRing.from_settings(settings)
    if len(keyring) == 0:
        raise RuntimeError("Nenhuma chave configurada: defina FAI_API_KEYS (recomendado) ou FAI_API_KEY")
    if redis is None:
        from redis import Redis
        redis = Redis.from_url(settings.redis_url, socket_timeout=5, socket_connect_timeout=5)
    store = store or S3Store(settings)
    jobs = JobStore(redis, settings.job_ttl_seconds)
    enqueue = enqueue or stages.enqueue_segment
    queues = (settings.segment_queue, settings.reconstruct_queue)
    registry = CollectorRegistry()
    registry.register(QueueCollector(redis, queues))

    app = FastAPI(title="FashionAI Garment GPU API", version="1.0.0")

    def authenticated(x_api_key: str | None = Header(default=None), authorization: str | None = Header(default=None)) -> Client:
        presented = x_api_key or (authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None)
        client = keyring.authenticate(presented)
        if client is None:
            REQUESTS_REJECTED.labels("unauthorized").inc()
            fail(401, "UNAUTHORIZED", "Chave de API inválida")
        return client

    def scoped(scope: str):
        def dependency(client: Client = Depends(authenticated)) -> Client:
            if not client.can(scope):
                REQUESTS_REJECTED.labels("forbidden").inc()
                fail(403, "FORBIDDEN", f"A chave não tem o escopo {scope}")
            return client
        return dependency

    def owned(job_id: str, client: Client, reviewers_too: bool = True) -> dict:
        """Owner or admin; reviewers (scope review) can read and review every client's jobs, never delete them."""
        if not JOB_ID.match(job_id):
            fail(404, "NOT_FOUND", "Processamento não encontrado ou expirado")
        try:
            record = jobs.get(job_id)
        except JobNotFound:
            fail(404, "NOT_FOUND", "Processamento não encontrado ou expirado")
        cross_client = client.is_admin or (reviewers_too and "review" in client.scopes)
        if record["client_id"] != client.client_id and not cross_client:
            fail(404, "NOT_FOUND", "Processamento não encontrado ou expirado")  # never reveal other clients' jobs
        return record

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "fai-garment-api"}

    def optional_client(x_api_key: str | None = Header(default=None)) -> Client | None:
        return keyring.authenticate(x_api_key)

    @app.get("/ready")
    def ready(client: Client | None = Depends(optional_client)):
        """Status code for probes; which dependency is down only for admin keys (the API may be public via Funnel)."""
        checks = {}
        for name, probe in (("redis", lambda: bool(redis.ping())), ("storage", store.ping)):
            try:
                checks[name] = "ok" if probe() else "down"
            except Exception:
                checks[name] = "down"
        ok = all(v == "ok" for v in checks.values())
        body = {"status": "ok" if ok else "degraded"}
        if client is not None and client.is_admin:
            body["checks"] = checks
        return JSONResponse(body, status_code=200 if ok else 503)

    @app.get("/metrics")
    def metrics(client: Client | None = Depends(optional_client)):
        if not settings.metrics_public and (client is None or not client.is_admin):
            fail(401, "UNAUTHORIZED", "Métricas exigem chave admin")
        return Response(generate_latest(REGISTRY) + generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    @app.post("/v1/garments", status_code=202)
    def submit(  # sync on purpose: decoding, S3 and Redis are blocking → FastAPI runs it in the threadpool
        image: UploadFile = File(...),
        category: Literal["upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "auto"] = Form("auto"),
        background: Literal["white", "transparent"] = Form("white"),
        framing: Literal["catalog", "cutout"] = Form("catalog"),
        mode: Literal["segment", "reconstruct"] = Form("segment"),
        bbox: str | None = Form(None),
        prompt: str | None = Form(None, max_length=2000),
        name: str | None = Form(None, max_length=80),
        color: str | None = Form(None, max_length=80),
        seed: int | None = Form(None, ge=0, le=2 ** 31 - 32),
        client: Client = Depends(scoped("submit")),
    ):
        allowed, retry_after = ratelimit.check(redis, client.client_id, settings.rate_limit_per_minute)
        if not allowed:
            REQUESTS_REJECTED.labels("rate_limit").inc()
            fail(429, "RATE_LIMITED", "Limite de envios por minuto atingido", {"Retry-After": str(retry_after)})
        if settings.max_active_jobs_per_client and jobs.active_count(client.client_id) >= settings.max_active_jobs_per_client:
            REQUESTS_REJECTED.labels("quota").inc()
            fail(429, "TOO_MANY_ACTIVE_JOBS", "Muitos processamentos em andamento para esta chave", {"Retry-After": "30"})
        raw = image.file.read(settings.max_upload_bytes + 1)
        if len(raw) > settings.max_upload_bytes:
            REQUESTS_REJECTED.labels("too_large").inc()
            fail(413, "TOO_LARGE", f"Imagem maior que {settings.max_upload_mb} MB")
        try:
            picture = decode_upload(raw, settings.max_pixels)
        except InvalidImage as exc:
            REQUESTS_REJECTED.labels("invalid_image").inc()
            fail(422, "INVALID_IMAGE", str(exc))
        coords = None
        if bbox:
            try:
                coords = check_bbox(json.loads(bbox), picture.width, picture.height)
            except (ValueError, TypeError):
                fail(422, "INVALID_BBOX", "bbox deve ser [x1,y1,x2,y2] em pixels dentro da imagem")
        if prompt and mode != "reconstruct":
            fail(422, "PROMPT_REQUIRES_RECONSTRUCT", "prompt só vale para mode=reconstruct")
        job_id = uuid.uuid4().hex
        record = {"job_id": job_id, "client_id": client.client_id, "mode": mode, "category": category,
                  "background": background, "framing": framing, "bbox": coords, "seed": seed, "prompt": prompt,
                  "hints": {k: v for k, v in (("name", name), ("color", color)) if v},
                  "artifacts": {"input": f"jobs/{job_id}/input.png"},
                  "input_size": [picture.width, picture.height]}
        try:
            store.put(record["artifacts"]["input"], png_bytes(picture), "image/png")  # re-encoded: EXIF/metadata dropped
            jobs.create(record)
            enqueue(settings, redis, job_id)
        except Exception:
            REQUESTS_REJECTED.labels("backend_unavailable").inc()
            try:
                jobs.update(job_id, {"status": "failed", "error": {"code": "QUEUE_UNAVAILABLE", "message": "Fila indisponível"}})
            except Exception:
                pass
            fail(503, "BACKEND_UNAVAILABLE", "Armazenamento ou fila indisponível")
        JOBS_SUBMITTED.labels(mode, category).inc()
        return {"job_id": job_id, "status": "queued", "mode": mode, "poll": f"/v1/jobs/{job_id}"}

    @app.get("/v1/jobs/{job_id}")
    def job_status(job_id: str, client: Client = Depends(scoped("read"))):
        return public_view(owned(job_id, client))

    @app.get("/v1/jobs/{job_id}/image")
    def job_image(job_id: str, variant: str = Query("final"), client: Client = Depends(scoped("read"))):
        record = owned(job_id, client)
        if variant not in VARIANTS:
            fail(422, "INVALID_VARIANT", f"variant deve ser um de {', '.join(VARIANTS)}")
        artifacts = record.get("artifacts", {})
        if variant == "final":
            if record.get("status") != "completed":
                fail(409, "NOT_READY", "Imagem ainda não está pronta")
            variant = "reconstructed" if "reconstructed" in artifacts else "segmented"
        if variant not in artifacts:
            fail(409, "NOT_READY", "Essa variante não existe (ainda) para este processamento")
        try:
            data = store.get(artifacts[variant])
        except ObjectNotFound:
            fail(410, "EXPIRED", "Imagem expirada pela política de retenção")
        except Exception:
            fail(503, "STORAGE_UNAVAILABLE", "Imagem temporariamente indisponível")
        headers = {"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff",
                   "X-FAI-Variant": variant, "X-FAI-AI-Generated": "true" if variant == "reconstructed" else "false",
                   "X-FAI-Review": record.get("review", {}).get("status", "not_required")}
        return Response(data, media_type="image/png", headers=headers)

    @app.post("/v1/jobs/{job_id}/review")
    def review(job_id: str, payload: dict = Body(...), client: Client = Depends(scoped("review"))):
        record = owned(job_id, client)
        decision = payload.get("decision")
        notes = str(payload.get("notes") or "")[:1000]
        if decision not in ("approved", "rejected"):
            fail(422, "INVALID_DECISION", "decision deve ser approved ou rejected")
        if record.get("status") != "completed" or "reconstructed" not in record.get("artifacts", {}):
            fail(409, "NOTHING_TO_REVIEW", "Só reconstruções concluídas passam por revisão")
        stamp = {"status": decision, "by": client.client_id, "notes": notes}
        updated = jobs.update(job_id, mutate=lambda r: r.__setitem__("review", {**stamp, "at": now_iso()}),
                              event=f"revisão: {decision}")
        stages.write_metadata(store, updated)
        REVIEWS.labels(decision).inc()
        return public_view(updated)

    @app.delete("/v1/jobs/{job_id}", status_code=204)
    def delete(job_id: str, client: Client = Depends(scoped("submit"))):
        owned(job_id, client, reviewers_too=False)
        store.delete_prefix(f"jobs/{job_id}/")
        jobs.delete(job_id)
        return Response(status_code=204)

    @app.get("/v1/models")
    def model_list(client: Client = Depends(scoped("read"))):
        return {"models": models.configured(settings)}

    @app.get("/v1/admin/queues")
    def admin_queues(client: Client = Depends(scoped("admin"))):
        from rq import Queue

        out = {}
        for name in queues:
            q = Queue(name, connection=redis)
            out[name] = {"queued": q.count, "started": q.started_job_registry.count,
                         "failed": q.failed_job_registry.count, "scheduled": q.scheduled_job_registry.count}
        workers = [json.loads(redis.get(k)) for k in redis.scan_iter("fai:worker:*") if redis.get(k)]
        return {"queues": out, "workers": workers}

    return app


def app_factory() -> FastAPI:
    """uvicorn entrypoint: `uvicorn --factory services.garment_gpu.api:app_factory`."""
    return create_app()
