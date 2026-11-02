"""Phase 2 fidelity fixes from the RunPod test (02/11/2026): shoes and accessories stay at Phase 1, the prompt forbids
invented prints/labels and keeps the garment's shape, the hand hole reaches Phase 2 as fabric (not as a cut-out),
the back is flagged when its colour drifts from the front, and the batch tells Phase 2 the product's name/colour."""
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from services.garment_gpu import config
from services.garment_gpu.analysis import classify, skin
from services.garment_gpu.api import create_app
from services.garment_gpu.prompts import FIDELITY, GARMENT_SHAPE, GUARD, build_back_prompt, build_prompt
from services.garment_gpu.quality import flag_back_color, garment_delta_e
from services.garment_gpu.reference import fill_occlusions
from services.garment_gpu.scripts.catalog_batch import GpuClient
from services.garment_gpu.tests.support import KEYS, ORANGE, drain, person_photo, png

SKIN = (224, 172, 140)


def hand_on_garment():
    """Model photo with a hand resting on the garment: a skin blob enclosed by the orange fabric."""
    px = np.asarray(person_photo()).copy()
    px[140:180, 100:140] = SKIN
    return Image.fromarray(px)


def garment_mask(image):
    return np.abs(np.asarray(image).astype(int) - np.array(ORANGE)).sum(-1) < 40


@pytest.mark.parametrize("category", ["shoes_piece", "accessory_piece"])
def test_calcado_e_acessorio_cortados_ou_com_pessoa_nao_vao_para_a_fase_2(category):
    px = np.full((360, 240, 3), 250, np.uint8)
    px[200:360, 20:220] = ORANGE                      # encosta na borda de baixo, como o tênis do teste
    px[40:120, 90:150] = SKIN                         # e há uma pessoa na foto
    verdict = classify(px, garment_mask(Image.fromarray(px)), category)
    assert verdict["class"] == "CUT" and verdict["needs_reconstruction"] is False
    assert classify(px, garment_mask(Image.fromarray(px)), "upper_piece")["needs_reconstruction"] is True


def test_prompt_da_frente_proibe_invencoes_e_preserva_o_formato():
    prompt = build_prompt("upper_piece", "Camiseta Básica Manga Curta", "azul claro")
    assert FIDELITY in prompt and GARMENT_SHAPE in prompt and prompt.endswith(GUARD)
    assert "Camiseta Básica Manga Curta in its original azul claro color" in prompt
    for forbidden in ("print", "logo", "label", "tag", "embroidery", "piping", "hole"):
        assert forbidden in FIDELITY
    assert "never a hole or cut-out" in GARMENT_SHAPE and "sleeve length" in GARMENT_SHAPE
    assert "e-commerce" not in prompt   # puxava etiquetas e marcas de catálogo


def test_prompt_de_calcado_e_foto_de_produto_sem_flat_lay_de_roupa():
    prompt = build_prompt("shoes_piece", "Tênis Lona")
    assert "product photo" in prompt and FIDELITY in prompt and prompt.endswith(GUARD)
    assert "flat lay" not in prompt and "sleeves" not in prompt
    assert build_prompt("shoes_piece").count("pair of shoes") == 1


def test_prompt_das_costas_mantem_a_cor_e_nao_inventa_estampas():
    back = build_back_prompt("upper_piece", "Camisa Social", "cinza")
    assert "exact same color as picture 1" in back and "stays plain fabric" in back
    assert "labels" in back and "Do not copy front logos" in back


def test_buraco_da_mao_vira_tecido_e_abertura_real_continua_aberta():
    image = hand_on_garment()
    mask = garment_mask(image)
    filled, filled_mask, count = fill_occlusions(image, mask)
    hole = (slice(140, 180), slice(100, 140))
    assert count == 40 * 40 and filled_mask[hole].all()
    assert not skin(np.asarray(filled)[hole]).any()
    assert np.abs(np.asarray(filled)[hole].astype(int) - np.array(ORANGE)).sum(-1).max() < 40
    design = np.asarray(person_photo()).copy()
    design[140:180, 100:140] = (128, 128, 128)          # vazado de verdade: mostra o fundo, não pele
    same, same_mask, none = fill_occlusions(Image.fromarray(design), garment_mask(Image.fromarray(design)))
    assert none == 0 and not same_mask[hole].any()


def test_mao_na_borda_da_peca_tambem_vira_tecido_e_braco_ao_lado_nao():
    px = np.asarray(person_photo()).copy()
    px[150:190, 160:190] = SKIN                        # mão na cintura: "dente" na borda, não buraco fechado
    image = Image.fromarray(px)
    filled, filled_mask, count = fill_occlusions(image, garment_mask(image))
    assert count == 40 * 30 and filled_mask[150:190, 160:190].all()
    assert not skin(np.asarray(filled)[150:190, 160:190]).any()
    assert not filled_mask[100:300, 195:215].any()     # o braço ao lado da peça continua fora


def test_fase_1_nao_cola_a_mao_no_recorte_pelo_fluxo_real():
    from services.garment_gpu.segmentation import run_segmentation
    from services.garment_gpu.tests.support import FakeSegmentEngine

    mask, _ = run_segmentation(FakeSegmentEngine(), hand_on_garment(), "upper_piece")
    assert not np.asarray(mask)[140:180, 100:140].any()   # antes do conserto o buraco era preenchido com a mão
    assert np.asarray(mask)[100:130, 60:180].all()         # o tecido em volta continua na máscara


def test_fase_2_recebe_a_peca_sem_o_buraco_da_mao(settings, redis, store, runtime):
    app = TestClient(create_app(settings, redis=redis, store=store))
    ids = []
    for photo in (hand_on_garment(), person_photo()):           # a mesma peça, com e sem a mão por cima
        res = app.post("/v1/garments", headers={"X-API-Key": KEYS["backend"]},
                       data={"category": "upper_piece", "mode": "reconstruct"},
                       files={"image": ("p.png", png(photo), "image/png")})
        ids.append(res.json()["job_id"])
        drain(settings, redis)
    body = app.get(f"/v1/jobs/{ids[0]}", headers={"X-API-Key": KEYS["backend"]}).json()
    assert body["status"] == "completed" and body["reconstruction"]["occlusion_fill_px"] == 40 * 40
    with_hand, without = (np.asarray(call["image"][0]).astype(int) for call in runtime["pipeline"].calls[0::2][:2])
    # sem o preenchimento, o buraco branco no meio da peça daria uma diferença média de ~4 níveis
    assert with_hand.shape == without.shape and np.abs(with_hand - without).mean() < 1.0


def test_calcado_com_pessoa_no_modo_auto_termina_na_fase_1(settings, redis, store, runtime):
    app = TestClient(create_app(settings, redis=redis, store=store))
    res = app.post("/v1/garments", headers={"X-API-Key": KEYS["backend"]},
                   data={"category": "shoes_piece", "mode": "auto"},
                   files={"image": ("p.png", png(person_photo()), "image/png")})
    drain(settings, redis)
    body = app.get(f"/v1/jobs/{res.json()['job_id']}", headers={"X-API-Key": KEYS["backend"]}).json()
    assert body["output"] == "flat_product" and runtime["pipeline"].calls == []


def on_white(color):
    px = np.full((300, 200, 3), 255, np.uint8)
    px[60:240, 40:160] = color
    return Image.fromarray(px)


def test_costas_de_cor_diferente_da_frente_sao_sinalizadas():
    settings = config.load({})
    assert garment_delta_e(on_white((20, 20, 22)), on_white((22, 22, 24))) < 2
    qa = flag_back_color({"verdict": "pass", "flags": []}, on_white((20, 20, 22)), on_white((25, 35, 80)), settings)
    assert "BACK_COLOR_MISMATCH" in qa["flags"] and qa["verdict"] == "warn" and qa["front_back_delta_e"] > 10
    ok = flag_back_color({"verdict": "pass", "flags": []}, on_white(ORANGE), on_white(ORANGE), settings)
    assert ok["flags"] == [] and ok["verdict"] == "pass"


class FakeSession:
    def __init__(self):
        self.sent = {}

    def post(self, url, timeout=None, files=None, data=None):
        self.sent = data
        return Reply(202, {"job_id": "j1"})

    def get(self, url, timeout=None, params=None):
        if params:
            return Reply(200, content=b"png")
        return Reply(200, {"status": "completed", "images": {"final": "/x"}})

    def delete(self, url, timeout=None):
        return Reply(204)


class Reply:
    def __init__(self, status_code, body=None, content=b""):
        self.status_code, self._body, self.content = status_code, body, content

    def json(self):
        return self._body

    def raise_for_status(self):
        pass


def test_lote_envia_nome_e_cor_do_produto_para_a_fase_2():
    session = FakeSession()
    client = GpuClient("http://gpu", "k" * 64, poll=0)
    client.segment(b"img", "upper_piece", session=session, hints={"name": "Body Canelado Gola Alta" + "x" * 90,
                                                                   "color": "Rosa", "vazio": None})
    assert session.sent["name"].startswith("Body Canelado Gola Alta") and len(session.sent["name"]) == 80
    assert session.sent["color"] == "Rosa" and "vazio" not in session.sent
