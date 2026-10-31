"""Prometheus metrics. The API exposes /metrics (jobs, rejections, queue depth, live workers); each GPU worker serves
its own port (stage latency, outcomes, QA). GPU utilisation/VRAM come from NVIDIA DCGM exporter (compose profile)."""
from __future__ import annotations

import json

from prometheus_client import Counter, Histogram
from prometheus_client.core import GaugeMetricFamily

JOBS_SUBMITTED = Counter("fai_jobs_submitted_total", "Jobs aceitos pela API", ["mode", "category"])
REQUESTS_REJECTED = Counter("fai_requests_rejected_total", "Requisições recusadas", ["reason"])
STAGE_SECONDS = Histogram("fai_stage_seconds", "Duração de cada etapa no worker", ["stage"],
                          buckets=(0.5, 1, 2, 5, 10, 20, 40, 60, 120, 300, 600, 1200))
STAGE_OUTCOMES = Counter("fai_stage_outcomes_total", "Resultado de cada etapa", ["stage", "outcome"])
QA_SCORE = Histogram("fai_qa_score", "Nota do QA automático da reconstrução",
                     buckets=(0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0))
QA_VERDICTS = Counter("fai_qa_verdicts_total", "Veredito do QA automático", ["verdict"])
REVIEWS = Counter("fai_reviews_total", "Revisões humanas registradas", ["decision"])


class QueueCollector:
    """Read at scrape time: queue depth per stage (the autoscaling signal) and live GPU workers by heartbeat."""

    def __init__(self, redis, queue_names):
        self.redis = redis
        self.queue_names = queue_names

    def collect(self):
        depth = GaugeMetricFamily("fai_queue_depth", "Jobs aguardando em cada fila", labels=["queue"])
        workers = GaugeMetricFamily("fai_workers_alive", "Workers com heartbeat recente", labels=["stage"])
        try:
            from rq import Queue

            for name in self.queue_names:
                depth.add_metric([name], Queue(name, connection=self.redis).count)
            alive: dict[str, int] = {}
            for key in self.redis.scan_iter("fai:worker:*"):
                raw = self.redis.get(key)
                if raw:
                    stage = json.loads(raw).get("stage", "unknown")
                    alive[stage] = alive.get(stage, 0) + 1
            for stage, count in alive.items():
                workers.add_metric([stage], count)
        except Exception:  # Redis down: /ready reports it; metrics must not crash the scrape
            pass
        yield depth
        yield workers
