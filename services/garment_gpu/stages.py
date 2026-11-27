"""RQ job functions, one per pipeline stage. Each GPU worker preloads its model once and runs only its own queue, so
segmentation and reconstruction can live on different machines and scale independently (Phase 3)."""
from __future__ import annotations

import json
import random
import time

import numpy as np
from rq import Queue, Retry, get_current_job

from services.garment_gpu import quality
from services.garment_gpu.analysis import classify
from services.garment_gpu.image_ops import make_catalog_png, make_cutout_png, mask_png, open_png, png_bytes
from services.garment_gpu.jobstore import ACTIVE, JobNotFound, public_view
from services.garment_gpu.metrics import QA_SCORE, QA_VERDICTS, STAGE_OUTCOMES, STAGE_SECONDS
from services.garment_gpu.reconstruction import (BACK_VIEW_CATEGORIES, build_back_prompt, build_prompt, output_size,
                                                 to_canvas)
from services.garment_gpu.reference import fill_occlusions
from services.garment_gpu.segmentation import SegmentationError

RUNTIME: dict = {}
VERDICT_RANK = {"pass": 2, "warn": 1, "fail": 0}


def configure(settings, store, jobs, redis, segment_engine=None, reconstruct_engine=None) -> None:
    RUNTIME.clear()
    RUNTIME.update(settings=settings, store=store, jobs=jobs, redis=redis,
                   segment=segment_engine, reconstruct=reconstruct_engine)


def artifact_key(job_id: str, name: str) -> str:
    return f"jobs/{job_id}/{name}.png"


def enqueue_segment(settings, redis, job_id: str):
    return Queue(settings.segment_queue, connection=redis).enqueue(
        "services.garment_gpu.stages.run_segment", job_id, job_id=f"{job_id}-segment",
        job_timeout=settings.segment_timeout_seconds, retry=Retry(max=2, interval=[15, 60]),
        result_ttl=3600, failure_ttl=settings.job_ttl_seconds, description=f"segment {job_id}")


def enqueue_reconstruct(settings, redis, job_id: str):
    return Queue(settings.reconstruct_queue, connection=redis).enqueue(
        "services.garment_gpu.stages.run_reconstruct", job_id, job_id=f"{job_id}-reconstruct",
        job_timeout=settings.reconstruct_timeout_seconds, retry=Retry(max=1, interval=[60]),
        result_ttl=3600, failure_ttl=settings.job_ttl_seconds, description=f"reconstruct {job_id}")


def write_metadata(store, record: dict) -> None:
    """jobs/<id>/metadata.json: the traceable record kept next to the images (models, QA, review, prompt kind)."""
    meta = {k: v for k, v in public_view(record).items() if k not in {"events", "images"}}
    meta["artifacts"] = record.get("artifacts", {})
    store.put(f"jobs/{record['job_id']}/metadata.json", json.dumps(meta, ensure_ascii=False).encode(), "application/json")


def _final_attempt() -> bool:
    job = get_current_job()
    return job is None or not job.retries_left


def _begin(job_id: str, stage: str, status: str):
    """Loads the record and marks the stage as started; returns None when the job was deleted or already moved on
    (an RQ retry after success must not redo work)."""
    jobs = RUNTIME["jobs"]
    try:
        record = jobs.get(job_id)
        if record.get("status") not in ACTIVE or record.get("stage") != stage:
            return None

        def bump(r):
            r.setdefault("attempts", {})[stage] = r.get("attempts", {}).get(stage, 0) + 1
        return jobs.update(job_id, {"status": status}, event=f"{stage}: iniciado", mutate=bump)
    except JobNotFound:
        return None


def _technical_failure(job_id: str, stage: str, exc: Exception) -> None:
    STAGE_OUTCOMES.labels(stage, "error").inc()
    jobs = RUNTIME["jobs"]
    try:
        if _final_attempt():
            jobs.update(job_id, {"status": "failed", "error": {
                "code": f"{stage.upper()}_ERROR", "message": "Falha técnica no worker; verifique os logs"}},
                event=f"{stage}: falhou ({type(exc).__name__})")
        else:
            jobs.update(job_id, {"status": "queued"}, event=f"{stage}: nova tentativa ({type(exc).__name__})")
    except JobNotFound:
        pass


def run_segment(job_id: str) -> dict:
    record = _begin(job_id, "segment", "segmenting")
    if record is None:
        return {"job_id": job_id, "skipped": True}
    settings, store, jobs = RUNTIME["settings"], RUNTIME["store"], RUNTIME["jobs"]
    started = time.perf_counter()
    try:
        image = open_png(store.get(record["artifacts"]["input"])).convert("RGB")
        mask, metrics = RUNTIME["segment"].run(image, record["category"], record.get("bbox"))
        if record["framing"] == "cutout":
            segmented = make_cutout_png(image, mask)
        else:
            segmented = make_catalog_png(image, mask, record["background"])
        store.put(artifact_key(job_id, "mask"), mask_png(mask), "image/png")
        store.put(artifact_key(job_id, "segmented"), segmented, "image/png")
    except SegmentationError as exc:
        STAGE_OUTCOMES.labels("segment", "rejected").inc()
        jobs.update(job_id, {"status": "failed", "error": {"code": exc.code, "message": str(exc)}}, event=str(exc))
        return {"job_id": job_id, "status": "failed"}
    except Exception as exc:
        _technical_failure(job_id, "segment", exc)
        raise
    finally:
        STAGE_SECONDS.labels("segment").observe(time.perf_counter() - started)
    STAGE_OUTCOMES.labels("segment", "ok").inc()
    seg = {**metrics, "models": RUNTIME["segment"].models, "seconds": round(time.perf_counter() - started, 3)}
    verdict = classify(np.asarray(image), mask, record["category"])
    reconstruct, output = route(record["mode"], verdict["needs_reconstruction"])

    def attach(r):
        r["artifacts"].update(mask=artifact_key(job_id, "mask"), segmented=artifact_key(job_id, "segmented"))
        r["segmentation"], r["analysis"] = seg, verdict
        r["review"] = {"status": "pending" if reconstruct else "not_required"}
        r["output"] = output
    if reconstruct:
        record = jobs.update(job_id, {"status": "queued", "stage": "reconstruct"}, event="segmentado; na fila de reconstrução",
                             mutate=attach)
        enqueue_reconstruct(settings, RUNTIME["redis"], job_id)
    else:
        record = jobs.update(job_id, {"status": "completed", "stage": "done"}, event="segmentação concluída", mutate=attach)
    write_metadata(store, record)
    return {"job_id": job_id, "status": record["status"]}


def back_view(job_id: str, record: dict, front, original, mask, seed: int) -> dict | None:
    """Phase 3 input: the back of the same garment, generated from the front flat lay. Always an AI inference (the
    back is rarely photographed), so it carries its own QA and goes through the same human review."""
    if record["category"] not in BACK_VIEW_CATEGORIES:
        return None
    settings, engine = RUNTIME["settings"], RUNTIME["reconstruct"]
    hints = record.get("hints", {})
    image = engine.generate([front, original], build_back_prompt(record["category"], hints.get("name"),
                                                                  hints.get("color")), seed + 1000, output_size(settings))
    qa = quality.flag_back_color(quality.compare(original, mask, image, settings, worn=True), front, image, settings)
    final = to_canvas(image)
    if record["background"] == "transparent":
        final = quality.white_to_alpha(final)
    RUNTIME["store"].put(artifact_key(job_id, "reconstructed_back"), png_bytes(final, optimize=True), "image/png")
    kept = ("verdict", "score", "flags", "delta_e", "front_back_delta_e")
    return {"seed": seed + 1000, "inferred": True, "quality": {k: qa.get(k) for k in kept}}


def reconstruct_worker_alive() -> bool:
    redis = RUNTIME["redis"]
    return any(json.loads(raw).get("stage") == "reconstruct"
               for raw in (redis.get(k) for k in redis.scan_iter("fai:worker:*")) if raw)


def route(mode: str, needs: bool) -> tuple[bool, str]:
    """Phase 1 → Phase 2. segment: never reconstruct; reconstruct: always; auto: only when the analysis says the
    cut-out is not yet a flat product (worn, occluded or truncated) and a generative worker is up."""
    if mode == "reconstruct" or (mode == "auto" and needs and reconstruct_worker_alive()):
        return True, "reconstruction_pending"
    if mode == "auto" and needs:
        return False, "needs_reconstruction_unavailable"   # cut-out kept, but it is NOT a final flat product
    return False, "flat_product" if mode == "auto" else "segmentation_only_no_reconstruction"


def run_reconstruct(job_id: str) -> dict:
    record = _begin(job_id, "reconstruct", "reconstructing")
    if record is None:
        return {"job_id": job_id, "skipped": True}
    settings, store, jobs, engine = RUNTIME["settings"], RUNTIME["store"], RUNTIME["jobs"], RUNTIME["reconstruct"]
    started = time.perf_counter()
    try:
        original = open_png(store.get(record["artifacts"]["input"])).convert("RGB")
        mask = np.asarray(open_png(store.get(record["artifacts"]["mask"])).convert("L")) > 127
        filled, filled_mask, filled_px = fill_occlusions(original, mask)   # hand holes → fabric, not a "cut-out"
        reference = open_png(make_catalog_png(filled, filled_mask.astype(np.uint8), "white")).convert("RGB")
        hints = record.get("hints", {})
        prompt = build_prompt(record["category"], hints.get("name"), hints.get("color"), record.get("prompt"))
        base_seed = record.get("seed") if record.get("seed") is not None else random.randrange(2 ** 31 - 16)
        best, generated = None, 0
        for attempt in range(settings.recon_max_attempts):
            seed, generated = base_seed + attempt, attempt + 1
            candidate = engine.generate([reference, original], prompt, seed, output_size(settings))
            qa = quality.compare(original, mask, candidate, settings,
                                 worn=bool((record.get("analysis") or {}).get("metrics", {}).get("person")))
            QA_SCORE.observe(qa["score"])
            QA_VERDICTS.labels(qa["verdict"]).inc()
            if best is None or (VERDICT_RANK[qa["verdict"]], qa["score"]) > (VERDICT_RANK[best[1]["verdict"]], best[1]["score"]):
                best = (candidate, qa, seed, attempt + 1)
            if qa["verdict"] == "pass":
                break
        candidate, qa, seed, chosen = best
        final = to_canvas(candidate)
        if record["background"] == "transparent":
            final = quality.white_to_alpha(final)
        store.put(artifact_key(job_id, "reconstructed"), png_bytes(final, optimize=True), "image/png")
        back = back_view(job_id, record, candidate, original, mask, seed) if settings.recon_back_view else None
    except Exception as exc:
        _technical_failure(job_id, "reconstruct", exc)
        raise
    finally:
        STAGE_SECONDS.labels("reconstruct").observe(time.perf_counter() - started)
    STAGE_OUTCOMES.labels("reconstruct", qa["verdict"]).inc()
    info = {"models": engine.models, "seed": seed, "candidates": generated, "chosen_candidate": chosen,
            "steps": settings.recon_steps,
            "true_cfg_scale": settings.recon_true_cfg, "prompt_kind": "custom" if record.get("prompt") else "default",
            "prompt": prompt, "occlusion_fill_px": filled_px,
            "ai_generated": True, "back": back, "seconds": round(time.perf_counter() - started, 3)}

    def attach(r):
        r["artifacts"]["reconstructed"] = artifact_key(job_id, "reconstructed")
        if back:
            r["artifacts"]["reconstructed_back"] = artifact_key(job_id, "reconstructed_back")
        r["reconstruction"], r["quality"] = info, qa
        r["output"] = "generative_reconstruction_requires_review"
    try:
        record = jobs.update(job_id, {"status": "completed", "stage": "done"},
                             event=f"reconstrução concluída (QA {qa['verdict']})", mutate=attach)
    except JobNotFound:
        return {"job_id": job_id, "skipped": True}
    write_metadata(store, record)
    return {"job_id": job_id, "status": "completed", "verdict": qa["verdict"]}
