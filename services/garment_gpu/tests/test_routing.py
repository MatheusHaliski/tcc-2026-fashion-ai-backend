"""Phase 1 → Phase 2 routing (mode=auto) and the mask fixes from the catalogue pilot: a worn garment always goes to
the generative stage, a flat product photo stops at Phase 1, a hand in front of the fabric is never pasted into the
cut-out, and a mask that leaks out of the detector's box (legs, hair) is refused instead of shipped."""
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from services.garment_gpu.analysis import skin_holes
from services.garment_gpu.api import create_app
from services.garment_gpu.image_ops import clean_mask
from services.garment_gpu.segmentation import SegmentationError, inside_box, pick_mask, run_segmentation
from services.garment_gpu.tests.support import KEYS, ORANGE, FakeSegmentEngine, drain, person_photo, png

SKIN = (224, 172, 140)


def product_photo():
    img = np.full((360, 240, 3), 250, np.uint8)
    img[60:240, 50:190] = ORANGE
    return Image.fromarray(img)


@pytest.fixture
def client(settings, redis, store, runtime):
    return TestClient(create_app(settings, redis=redis, store=store))


def submit(client, image, mode="auto"):
    res = client.post("/v1/garments", headers={"X-API-Key": KEYS["backend"]},
                      data={"category": "upper_piece", "mode": mode},
                      files={"image": ("p.png", png(image), "image/png")})
    assert res.status_code == 202, res.text
    return res.json()["job_id"]


def job(client, job_id):
    return client.get(f"/v1/jobs/{job_id}", headers={"X-API-Key": KEYS["backend"]}).json()


def test_peca_vestida_vai_para_a_fase_2_e_sai_reconstruida(client, settings, redis, runtime):
    job_id = submit(client, person_photo())
    drain(settings, redis)
    body = job(client, job_id)
    assert body["analysis"]["metrics"]["person"] is True and body["analysis"]["needs_reconstruction"] is True
    assert body["status"] == "completed" and "reconstructed" in body["images"]
    prompt = runtime["pipeline"].calls[0]["prompt"]
    assert "flat lay" in prompt and "ghost-mannequin" in prompt


def test_foto_de_produto_para_na_fase_1(client, settings, redis, runtime):
    job_id = submit(client, product_photo())
    drain(settings, redis)
    body = job(client, job_id)
    assert body["output"] == "flat_product" and body["analysis"]["class"] == "COMPLETE_PRODUCT"
    assert "reconstructed" not in body["images"] and runtime["pipeline"].calls == []


def test_sem_worker_generativo_o_recorte_vem_marcado_como_nao_final(client, settings, redis):
    redis.delete("fai:worker:test-reconstruct")
    job_id = submit(client, person_photo())
    drain(settings, redis)
    body = job(client, job_id)
    assert body["status"] == "completed" and body["output"] == "needs_reconstruction_unavailable"
    assert "reconstructed" not in body["images"]


def test_mao_na_frente_da_peca_nao_entra_no_recorte():
    img = np.asarray(product_photo()).copy()
    img[120:170, 100:140] = SKIN                    # mão sobre o tecido, cercada pela peça
    garment = (np.abs(img.astype(int) - np.array(ORANGE)).sum(-1) < 40).astype(np.uint8)
    holes = skin_holes(img, garment)
    assert holes[140, 120] and holes.sum() == 50 * 40
    assert clean_mask(garment)[140, 120] == 1                      # antes: o buraco virava "peça" (a mão colada)
    assert clean_mask(garment, keep_open=holes)[140, 120] == 0     # agora fica aberto para a Fase 2 repintar


def test_sam_escolhe_a_mascara_que_fica_dentro_da_caixa():
    box = [50, 60, 190, 240]
    shorts = np.zeros((360, 240), np.uint8)
    shorts[60:240, 50:190] = 1
    legs = np.zeros((360, 240), np.uint8)
    legs[200:360, 60:180] = 1                       # pernas: mais contraste, mas quase toda fora da caixa
    chosen, score, fit = pick_mask([legs, shorts], [0.99, 0.80], box)
    assert chosen is shorts and fit == 1.0 and score == 0.80
    assert inside_box(legs, box) == pytest.approx(40 / 160)


def test_mascara_fora_da_caixa_e_recusada_em_vez_de_entregar_o_corpo():
    class LegsEngine(FakeSegmentEngine):
        def segment(self, image, box):
            legs = np.zeros((image.height, image.width), np.uint8)
            legs[250:360, 60:180] = 1
            return legs, 0.99, inside_box(legs, box)

    with pytest.raises(SegmentationError) as err:
        run_segmentation(LegsEngine(), person_photo(), "lower_piece")
    assert err.value.code == "MASK_OUTSIDE_DETECTION"


def test_fase_2_gera_tambem_as_costas_para_o_avatar(client, settings, redis, runtime):
    job_id = submit(client, person_photo(), mode="reconstruct")
    drain(settings, redis)
    body = job(client, job_id)
    assert "reconstructed_back" in body["images"] and body["reconstruction"]["back"]["inferred"] is True
    front, back = runtime["pipeline"].calls[0], runtime["pipeline"].calls[-1]
    assert "BACK of exactly the same garment" in back["prompt"] and "Do not copy front logos" in back["prompt"]
    assert back["image"][0].size == (front["width"], front["height"])   # a frente já gerada é a referência
    img = client.get(f"/v1/jobs/{job_id}/image?variant=reconstructed_back", headers={"X-API-Key": KEYS["backend"]})
    assert img.status_code == 200 and img.headers["x-fai-ai-generated"] == "true"


def test_costas_nao_se_aplicam_a_calcados_nem_quando_desligadas(settings, redis, store, runtime):
    from dataclasses import replace

    from services.garment_gpu import stages

    app = TestClient(create_app(settings, redis=redis, store=store))
    res = app.post("/v1/garments", headers={"X-API-Key": KEYS["backend"]},
                   data={"category": "shoes_piece", "mode": "reconstruct"},
                   files={"image": ("p.png", png(person_photo()), "image/png")})
    drain(settings, redis)
    assert "reconstructed_back" not in job(app, res.json()["job_id"])["images"]
    stages.RUNTIME["settings"] = replace(settings, recon_back_view=False)
    job_id = submit(app, person_photo(), mode="reconstruct")
    drain(settings, redis)
    assert "reconstructed_back" not in job(app, job_id)["images"]
