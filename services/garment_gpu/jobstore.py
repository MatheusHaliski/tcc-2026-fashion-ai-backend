"""Job records in Redis: one JSON document per pipeline run, owned by the client that submitted it.

RQ jobs are an implementation detail of each stage; this record is the public contract (status, stage results,
quality report, human review) and survives worker restarts until JOB_TTL_SECONDS."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from redis import WatchError

ACTIVE = ("queued", "segmenting", "reconstructing")
TERMINAL = ("completed", "failed")
MAX_EVENTS = 30


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def job_key(job_id: str) -> str:
    return f"fai:job:{job_id}"


def active_key(client_id: str) -> str:
    return f"fai:client:{client_id}:active"


class JobNotFound(KeyError):
    pass


class JobStore:
    def __init__(self, redis, ttl_seconds: int):
        self.redis = redis
        self.ttl = ttl_seconds

    def create(self, record: dict) -> dict:
        record = dict(record)
        record.setdefault("status", "queued")
        record.setdefault("stage", "segment")
        record["created_at"] = record["updated_at"] = now_iso()
        record["events"] = [{"at": record["created_at"], "status": record["status"], "detail": "recebido"}]
        pipe = self.redis.pipeline()
        pipe.set(job_key(record["job_id"]), json.dumps(record), ex=self.ttl, nx=True)
        pipe.sadd(active_key(record["client_id"]), record["job_id"])
        pipe.expire(active_key(record["client_id"]), self.ttl)
        ok, _, _ = pipe.execute()
        if not ok:
            raise ValueError("job_id duplicado")
        return record

    def get(self, job_id: str) -> dict:
        raw = self.redis.get(job_key(job_id))
        if raw is None:
            raise JobNotFound(job_id)
        return json.loads(raw)

    def update(self, job_id: str, changes: dict | None = None, event: str | None = None, mutate=None) -> dict:
        """Optimistic read-modify-write (WATCH) so the API (review) and the workers never overwrite each other."""
        key = job_key(job_id)
        for _ in range(20):
            with self.redis.pipeline() as pipe:
                try:
                    pipe.watch(key)
                    raw = pipe.get(key)
                    if raw is None:
                        raise JobNotFound(job_id)
                    record = json.loads(raw)
                    if changes:
                        record.update(changes)
                    if mutate is not None:
                        mutate(record)
                    record["updated_at"] = now_iso()
                    if event:
                        record["events"] = (record.get("events", []) + [
                            {"at": record["updated_at"], "status": record.get("status"), "detail": event[:300]}
                        ])[-MAX_EVENTS:]
                    ttl = pipe.ttl(key)
                    pipe.multi()
                    pipe.set(key, json.dumps(record), ex=ttl if ttl and ttl > 0 else self.ttl)
                    if record.get("status") in TERMINAL:
                        pipe.srem(active_key(record["client_id"]), job_id)
                    pipe.execute()
                    return record
                except WatchError:
                    time.sleep(0.01)
        raise RuntimeError(f"Conflito persistente ao atualizar o job {job_id}")

    def active_count(self, client_id: str) -> int:
        """Counts unfinished jobs, pruning ids whose record expired or finished without cleanup."""
        ids = [i.decode() if isinstance(i, bytes) else i for i in self.redis.smembers(active_key(client_id))]
        alive = 0
        for job_id in ids:
            raw = self.redis.get(job_key(job_id))
            if raw is None or json.loads(raw).get("status") in TERMINAL:
                self.redis.srem(active_key(client_id), job_id)
            else:
                alive += 1
        return alive

    def delete(self, job_id: str) -> None:
        record = self.get(job_id)
        pipe = self.redis.pipeline()
        pipe.delete(job_key(job_id))
        pipe.srem(active_key(record["client_id"]), job_id)
        pipe.execute()


def public_view(record: dict) -> dict:
    """What clients see: never storage keys, only API paths."""
    view = {k: v for k, v in record.items() if k not in {"artifacts", "client_id", "prompt"}}
    view["images"] = {name: f"/v1/jobs/{record['job_id']}/image?variant={name}"
                      for name in record.get("artifacts", {}) if name != "input"}
    view["custom_prompt"] = bool(record.get("prompt"))
    return view
