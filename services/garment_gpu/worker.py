"""GPU worker entrypoint: `python -m services.garment_gpu.worker --stage segment|reconstruct`.

* SimpleWorker (no fork per job): the model is loaded ONCE at startup and stays in VRAM; forking after CUDA init is
  unsafe, and RQ's default forking worker would reload the weights for every job.
* One stage per process: segmentation and reconstruction scale on different GPUs/machines (Phase 3).
* Heartbeat with GPU name/VRAM in Redis (seen by /v1/admin/queues and Prometheus), metrics on WORKER_METRICS_PORT.
* WORKER_MAX_IDLE_SECONDS > 0 exits after that idle time (scale-to-zero on RunPod/Kubernetes)."""
from __future__ import annotations

import argparse
import json
import logging
import os
import socket
import threading
import time

from services.garment_gpu import config, stages
from services.garment_gpu.jobstore import JobStore, now_iso

log = logging.getLogger("fai.worker")


HEARTBEAT_SECONDS = 15
HEARTBEAT_TTL = 120   # 8 batidas: um worker vivo nunca some da fila por uma batida atrasada


def gpu_info(settings) -> dict:
    """Nome e memória total da GPU, lidos UMA vez na subida. Consultar a GPU a cada batida (mem_get_info) pode esperar
    a geração em andamento (~40 s por peça na Fase 2): com a chave de 60 s, a API via o worker sumir e, no mode=auto,
    devolvia só o recorte da Fase 1 (57 de 144 peças do lote 220 em 03/11/2026, com o worker no ar)."""
    info = {"device": settings.device}
    try:
        import torch

        if settings.device == "cuda" and torch.cuda.is_available():
            info.update(gpu=torch.cuda.get_device_name(0),
                        vram_total_mb=torch.cuda.get_device_properties(0).total_memory // 2 ** 20)
    except Exception:  # metrics are best effort
        pass
    return info


def vram_used_mb() -> int | None:
    """Memória reservada por este processo, das estatísticas do alocador do PyTorch: não toca na GPU."""
    try:
        import torch

        return torch.cuda.memory_reserved() // 2 ** 20 if torch.cuda.is_available() else None
    except Exception:
        return None


def heartbeat(redis, name: str, stage: str, settings, stop: threading.Event, interval: int = HEARTBEAT_SECONDS,
              static: dict | None = None) -> None:
    started = now_iso()
    static = gpu_info(settings) if static is None else static
    while not stop.is_set():
        payload = {"name": name, "stage": stage, "host": socket.gethostname(), "started_at": started,
                   "seen_at": now_iso(), **static, "vram_used_mb": vram_used_mb()}
        try:
            redis.set(f"fai:worker:{name}", json.dumps(payload), ex=HEARTBEAT_TTL)
        except Exception as exc:
            log.warning("heartbeat falhou: %s", exc)
        stop.wait(interval)
    redis.delete(f"fai:worker:{name}")


def build_engine(stage: str, settings):
    if stage == "segment":
        from services.garment_gpu.segmentation import SegmentEngine
        return SegmentEngine(settings)
    from services.garment_gpu.reconstruction import ReconstructionEngine
    return ReconstructionEngine(settings)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stage", choices=("segment", "reconstruct"), default=os.environ.get("WORKER_STAGE", "segment"))
    parser.add_argument("--burst", action="store_true", help="processa a fila e sai (lotes agendados)")
    args = parser.parse_args(argv)
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")

    from redis import Redis
    from rq import Queue, SimpleWorker

    from services.garment_gpu.storage import S3Store

    settings = config.load()
    redis = Redis.from_url(settings.redis_url)
    store = S3Store(settings)
    store.prepare()
    jobs = JobStore(redis, settings.job_ttl_seconds)
    t0 = time.perf_counter()
    engine = build_engine(args.stage, settings)  # fail fast: a worker without GPU/weights must not take jobs
    log.info("modelos carregados em %.1fs: %s", time.perf_counter() - t0, engine.models)
    stages.configure(settings, store, jobs, redis,
                     segment_engine=engine if args.stage == "segment" else None,
                     reconstruct_engine=engine if args.stage == "reconstruct" else None)

    if settings.worker_metrics_port:
        from prometheus_client import start_http_server
        start_http_server(settings.worker_metrics_port)

    queue_name = settings.segment_queue if args.stage == "segment" else settings.reconstruct_queue
    name = settings.worker_name or f"{args.stage}-{socket.gethostname()}-{os.getpid()}"
    stop = threading.Event()
    beat = threading.Thread(target=heartbeat, args=(redis, name, args.stage, settings, stop),
                            kwargs={"static": gpu_info(settings)}, daemon=True)   # GPU lida aqui, antes dos jobs
    beat.start()
    try:
        worker = SimpleWorker([Queue(queue_name, connection=redis)], connection=redis, name=name)
        worker.work(burst=args.burst, with_scheduler=True,
                    max_idle_time=settings.worker_max_idle_seconds or None)
    finally:
        stop.set()
        beat.join(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
