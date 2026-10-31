"""Fixtures: fakeredis + in-memory store + deterministic engines. The RQ path is real (SimpleWorker in burst mode on
fakeredis); only the neural networks are replaced, so the CPU CI covers everything except the GPU math."""
import fakeredis
import pytest

from services.garment_gpu import config, stages
from services.garment_gpu.jobstore import JobStore
from services.garment_gpu.reconstruction import ReconstructionEngine
from services.garment_gpu.security import digest
from services.garment_gpu.storage import MemoryStore
from services.garment_gpu.tests.support import KEYS, FakePipeline, FakeSegmentEngine


@pytest.fixture
def settings():
    env = {"FAI_API_KEYS": ";".join([
        f"backend:{digest(KEYS['backend'])}:submit|read",
        f"reviewer:{digest(KEYS['reviewer'])}:read|review",
        f"reader:{digest(KEYS['reader'])}:read",
        f"ops:{digest(KEYS['ops'])}:admin"]),
        "RATE_LIMIT_PER_MINUTE": "100", "MAX_ACTIVE_JOBS_PER_CLIENT": "50", "RECON_STEPS": "8",
        "RECON_MAX_SIDE": "512", "WORKER_METRICS_PORT": "0"}
    return config.load(env)


@pytest.fixture
def redis():
    return fakeredis.FakeStrictRedis()


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def pipeline():
    return FakePipeline()


@pytest.fixture
def runtime(settings, redis, store, pipeline):
    seg = FakeSegmentEngine()
    rec = ReconstructionEngine(settings, pipeline=pipeline)
    stages.configure(settings, store, JobStore(redis, settings.job_ttl_seconds), redis, seg, rec)
    redis.set("fai:worker:test-reconstruct", '{"stage": "reconstruct"}', ex=60)  # heartbeat of a generative worker
    return {"segment": seg, "reconstruct": rec, "pipeline": pipeline}
