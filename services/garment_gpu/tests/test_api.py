import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from services.garment_gpu.api import create_app
from services.garment_gpu.tests.support import KEYS, drain, person_photo, png


@pytest.fixture
def client(settings, redis, store, runtime):
    return TestClient(create_app(settings, redis=redis, store=store))


def headers(who="backend"):
    return {"X-API-Key": KEYS[who]}


def submit(client, who="backend", **fields):
    data = {"category": "upper_piece", **fields}
    return client.post("/v1/garments", headers=headers(who), data=data,
                       files={"image": ("camiseta.png", png(person_photo()), "image/png")})


def test_segmentacao_ponta_a_ponta(client, settings, redis, store):
    res = submit(client)
    assert res.status_code == 202, res.text
    job_id = res.json()["job_id"]
    assert client.get(f"/v1/jobs/{job_id}", headers=headers()).json()["status"] == "queued"
    assert client.get(f"/v1/jobs/{job_id}/image", headers=headers()).status_code == 409

    drain(settings, redis)

    body = client.get(f"/v1/jobs/{job_id}", headers=headers()).json()
    assert body["status"] == "completed"
    assert body["review"] == {"status": "not_required"}
    assert body["output"] == "segmentation_only_no_reconstruction"
    assert body["segmentation"]["models"] == {"detector": "fake-dino", "segmenter": "fake-sam"}
    assert "artifacts" not in body and "client_id" not in body
    img = client.get(f"/v1/jobs/{job_id}/image", headers=headers())
    assert img.status_code == 200 and img.headers["x-fai-ai-generated"] == "false"
    final = Image.open(__import__("io").BytesIO(img.content))
    assert final.size == (1024, 1536) and final.getpixel((0, 0)) == (255, 255, 255, 255)
    meta = json.loads(store.get(f"jobs/{job_id}/metadata.json"))
    assert meta["segmentation"]["mask_fraction"] > 0.1


def test_reconstrucao_com_qa_e_revisao(client, settings, redis, store, runtime):
    job_id = submit(client, mode="reconstruct", name="Camisa Holanda", color="laranja", seed="7").json()["job_id"]
    drain(settings, redis)

    body = client.get(f"/v1/jobs/{job_id}", headers=headers()).json()
    assert body["status"] == "completed", body
    assert body["quality"]["verdict"] in ("pass", "warn")
    assert body["quality"]["delta_e"] < settings.qa_max_delta_e
    assert body["reconstruction"]["ai_generated"] is True and body["reconstruction"]["seed"] == 7
    assert body["review"]["status"] == "pending"
    call = runtime["pipeline"].calls[0]
    assert len(call["image"]) == 2 and "Camisa Holanda" in call["prompt"] and "Do not invent" in call["prompt"]
    assert call["width"] % 16 == 0 and call["height"] % 16 == 0

    img = client.get(f"/v1/jobs/{job_id}/image", headers=headers())
    assert img.headers["x-fai-ai-generated"] == "true" and img.headers["x-fai-review"] == "pending"
    assert client.get(f"/v1/jobs/{job_id}/image?variant=segmented", headers=headers()).status_code == 200

    assert client.post(f"/v1/jobs/{job_id}/review", headers=headers(), json={"decision": "approved"}).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/review", headers=headers("reviewer"), json={"decision": "x"}).status_code == 422
    ok = client.post(f"/v1/jobs/{job_id}/review", headers=headers("reviewer"), json={"decision": "approved", "notes": "escudo ok"})
    assert ok.status_code == 200 and ok.json()["review"]["status"] == "approved"
    assert json.loads(store.get(f"jobs/{job_id}/metadata.json"))["review"]["by"] == "reviewer"
    assert client.delete(f"/v1/jobs/{job_id}", headers=headers("reviewer")).status_code == 403


def test_qa_reprova_cor_trocada_e_tenta_outra_semente(client, settings, redis, runtime):
    runtime["pipeline"].color = (20, 60, 220)
    job_id = submit(client, mode="reconstruct").json()["job_id"]
    drain(settings, redis)
    body = client.get(f"/v1/jobs/{job_id}", headers=headers()).json()
    assert body["quality"]["verdict"] == "fail" and "COLOR_DRIFT" in body["quality"]["flags"]
    assert body["reconstruction"]["candidates"] == settings.recon_max_attempts


def test_autenticacao_escopos_e_isolamento(client, settings, redis):
    assert client.post("/v1/garments", files={"image": ("a.png", b"x", "image/png")}).status_code == 401
    assert submit(client, who="reader").status_code == 403
    job_id = submit(client).json()["job_id"]
    assert client.get(f"/v1/jobs/{job_id}", headers=headers("reader")).status_code == 404
    assert client.get(f"/v1/jobs/{job_id}", headers=headers("ops")).status_code == 200
    assert client.get("/v1/jobs/../../etc", headers=headers()).status_code == 404
    bearer = client.get(f"/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {KEYS['backend']}"})
    assert bearer.status_code == 200


def test_validacoes_de_entrada(client):
    bad = client.post("/v1/garments", headers=headers(), data={"category": "upper_piece"},
                      files={"image": ("a.png", b"not an image", "image/png")})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "INVALID_IMAGE"
    assert submit(client, bbox="[10, 10, 5, 5]").json()["detail"]["code"] == "INVALID_BBOX"
    assert submit(client, prompt="x").json()["detail"]["code"] == "PROMPT_REQUIRES_RECONSTRUCT"
    assert submit(client, category="dress").status_code == 422


def test_limite_por_minuto_e_jobs_ativos(settings, redis, store, runtime):
    from dataclasses import replace

    app = TestClient(create_app(replace(settings, rate_limit_per_minute=2, max_active_jobs_per_client=50), redis=redis, store=store))
    assert [submit(app).status_code for _ in range(3)] == [202, 202, 429]
    redis.flushall()
    app = TestClient(create_app(replace(settings, max_active_jobs_per_client=1), redis=redis, store=store))
    assert submit(app).status_code == 202
    blocked = submit(app)
    assert blocked.status_code == 429 and blocked.json()["detail"]["code"] == "TOO_MANY_ACTIVE_JOBS"
    drain(settings, redis)
    assert submit(app).status_code == 202


def test_exclusao_apaga_imagens(client, settings, redis, store):
    job_id = submit(client).json()["job_id"]
    drain(settings, redis)
    assert store.list_prefix(f"jobs/{job_id}/")
    assert client.delete(f"/v1/jobs/{job_id}", headers=headers()).status_code == 204
    assert store.list_prefix(f"jobs/{job_id}/") == []
    assert client.get(f"/v1/jobs/{job_id}", headers=headers()).status_code == 404


def test_operacao_saude_metricas_e_filas(client, settings, redis):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json() == {"status": "ok"}
    assert client.get("/ready", headers=headers("ops")).json()["checks"] == {"redis": "ok", "storage": "ok"}
    submit(client)
    metrics = client.get("/metrics").text
    assert 'fai_queue_depth{queue="fai-segment"} 1.0' in metrics and "fai_jobs_submitted_total" in metrics
    assert client.get("/v1/admin/queues", headers=headers()).status_code == 403
    queues = client.get("/v1/admin/queues", headers=headers("ops")).json()
    assert queues["queues"]["fai-segment"]["queued"] == 1
    assert {m["role"] for m in client.get("/v1/models", headers=headers()).json()["models"]} == {
        "detection", "segmentation", "reconstruction"}


def test_api_recusa_subir_sem_chaves(redis, store):
    from services.garment_gpu import config

    with pytest.raises(RuntimeError):
        create_app(config.load({}), redis=redis, store=store)
