import boto3
import pytest
from moto import mock_aws

from services.garment_gpu import config, segmentation, stages
from services.garment_gpu.jobstore import JobStore
from services.garment_gpu.segmentation import SegmentationError, pick_box, run_segmentation
from services.garment_gpu.storage import ObjectNotFound, S3Store
from services.garment_gpu.tests.support import FakeSegmentEngine, person_photo, png


def record(job_id="a" * 32, mode="segment"):
    return {"job_id": job_id, "client_id": "backend", "mode": mode, "category": "upper_piece", "background": "white",
            "framing": "catalog", "bbox": None, "seed": None, "prompt": None, "hints": {},
            "artifacts": {"input": f"jobs/{job_id}/input.png"}}


def test_escolhe_a_deteccao_mais_confiavel_que_nao_seja_o_quadro_todo():
    box, info = pick_box([[0, 0, 100, 100], [10, 10, 60, 80]], [0.9, 0.6], ["person shirt", "shirt"], 100, 100)
    assert box == [10, 10, 60, 80] and info["detection_label"] == "shirt"
    with pytest.raises(SegmentationError) as err:
        pick_box([], [], [], 100, 100)
    assert err.value.code == "NO_GARMENT_DETECTED"


def test_bbox_manual_pula_o_detector_e_mascara_absurda_e_recusada():
    engine = FakeSegmentEngine()
    _, metrics = run_segmentation(engine, person_photo(), "upper_piece", [50, 60, 190, 240])
    assert metrics["detection_label"] == "manual_bbox" and not any(c[0] == "detect" for c in engine.calls)
    with pytest.raises(SegmentationError) as err:
        run_segmentation(engine, person_photo(), "upper_piece", [0, 300, 40, 360])
    assert err.value.code == "INCONSISTENT_MASK"
    assert "garment." in segmentation.PROMPTS["auto"]


@pytest.fixture
def jobs(redis, store, settings):
    js = JobStore(redis, settings.job_ttl_seconds)
    stages.configure(settings, store, js, redis, FakeSegmentEngine(), None)
    return js


def test_falha_tecnica_volta_para_fila_e_so_falha_na_ultima_tentativa(jobs, store, monkeypatch):
    jobs.create(record())
    store.put("jobs/" + "a" * 32 + "/input.png", png(person_photo()), "image/png")

    class Boom(FakeSegmentEngine):
        def segment(self, image, box):
            raise RuntimeError("CUDA out of memory")
    stages.RUNTIME["segment"] = Boom()

    class Job:
        retries_left = 1
    monkeypatch.setattr(stages, "get_current_job", lambda: Job)
    with pytest.raises(RuntimeError):
        stages.run_segment("a" * 32)
    assert jobs.get("a" * 32)["status"] == "queued"
    Job.retries_left = 0
    with pytest.raises(RuntimeError):
        stages.run_segment("a" * 32)
    failed = jobs.get("a" * 32)
    assert failed["status"] == "failed" and failed["error"]["code"] == "SEGMENT_ERROR"
    assert failed["attempts"]["segment"] == 2
    assert stages.run_segment("a" * 32) == {"job_id": "a" * 32, "skipped": True}


def test_job_excluido_durante_a_fila_e_ignorado(jobs):
    assert stages.run_segment("b" * 32)["skipped"] is True
    assert stages.run_reconstruct("b" * 32)["skipped"] is True


@mock_aws
def test_s3_cria_bucket_com_retencao_e_apaga_por_prefixo():
    settings = config.load({"S3_ENDPOINT": "", "S3_ACCESS_KEY": "k", "S3_SECRET_KEY": "s", "RETENTION_DAYS": "14"})
    store = S3Store(settings)
    store.put("jobs/x/input.png", b"1", "image/png")
    store.put("jobs/x/mask.png", b"2", "image/png")
    store.put("jobs/y/input.png", b"3", "image/png")
    rules = boto3.client("s3", region_name="us-east-1").get_bucket_lifecycle_configuration(Bucket=settings.s3_bucket)
    assert rules["Rules"][0]["Expiration"]["Days"] == 14
    assert store.get("jobs/x/mask.png") == b"2" and store.ping()
    assert store.delete_prefix("jobs/x/") == 2
    assert store.list_prefix("jobs/") == ["jobs/y/input.png"]
    with pytest.raises(ObjectNotFound):
        store.get("jobs/x/input.png")
