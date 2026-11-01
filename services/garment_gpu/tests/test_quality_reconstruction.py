import numpy as np
import pytest
from PIL import Image

from services.garment_gpu import config, quality
from services.garment_gpu.reconstruction import GUARD, ReconstructionEngine, build_prompt, output_size, to_canvas
from services.garment_gpu.tests.support import ORANGE, FakePipeline, FakeSegmentEngine, person_photo

SETTINGS = config.load({"RECON_MAX_SIDE": "512", "RECON_STEPS": "12"})


def original_and_mask():
    photo = person_photo()
    mask, _ = FakeSegmentEngine().run(photo, "upper_piece")
    return photo, mask


def generated(color=ORANGE, skin=False, background=(255, 255, 255)):
    pipe = FakePipeline(color)
    img = pipe(width=320, height=480).images[0]
    px = np.asarray(img).copy()
    if background != (255, 255, 255):
        px[np.all(px == 255, axis=-1)] = background
    if skin:
        px[100:380, 40:90] = (224, 172, 140)
    return Image.fromarray(px)


def test_qa_aprova_reconstrucao_fiel():
    photo, mask = original_and_mask()
    report = quality.compare(photo, mask, generated(), SETTINGS)
    assert report["verdict"] == "pass", report
    assert report["delta_e"] < 5 and report["background_clean"] == 1.0
    assert "logos" in report["requires_human_review"]


@pytest.mark.parametrize("kwargs,flag", [
    ({"color": (20, 60, 220)}, "COLOR_DRIFT"),
    ({"skin": True}, "POSSIBLE_PERSON_LEFT"),
])
def test_qa_reprova_cor_trocada_ou_pessoa_restante(kwargs, flag):
    photo, mask = original_and_mask()
    report = quality.compare(photo, mask, generated(**kwargs), SETTINGS)
    assert report["verdict"] == "fail" and flag in report["flags"]


def test_qa_marca_fundo_sujo_e_quadro_vazio():
    photo, mask = original_and_mask()
    dirty = quality.compare(photo, mask, generated(background=(180, 180, 180)), SETTINGS)
    assert dirty["verdict"] == "fail" and dirty["flags"] == ["EMPTY_OR_FULL_FRAME"]
    empty = quality.compare(photo, mask, Image.new("RGB", (200, 300), (255, 255, 255)), SETTINGS)
    assert empty["verdict"] == "fail"


def test_lab_e_branco_para_alfa():
    lab = quality.srgb_to_lab(np.array([[255, 255, 255], [0, 0, 0]]))
    assert lab[0][0] == pytest.approx(100, abs=0.1) and lab[1][0] == pytest.approx(0, abs=0.1)
    alpha = quality.white_to_alpha(generated())
    assert alpha.getpixel((0, 0))[3] == 0 and alpha.getpixel((160, 240))[3] == 255


def test_prompt_padrao_dicas_e_prompt_do_cliente():
    prompt = build_prompt("upper_piece", "Camisa\x00 Holanda  2024", "laranja")
    assert "Camisa Holanda 2024" in prompt and "original laranja color" in prompt and GUARD in prompt
    assert "picture 2" in prompt and "\x00" not in prompt
    assert build_prompt("shoes_piece").count("pair of shoes") == 1
    custom = build_prompt("auto", custom="Recreate the item as a packshot")
    assert custom.startswith("Recreate the item as a packshot") and custom.endswith(GUARD)


def test_motor_repassa_parametros_ao_pipeline_qwen():
    pipe = FakePipeline()
    engine = ReconstructionEngine(SETTINGS, pipeline=pipe)
    size = output_size(SETTINGS)
    assert size == (336, 512)
    out = engine.generate([Image.new("RGB", (900, 1400)), person_photo()], "p", 11, size)
    call = pipe.calls[0]
    assert out.size == size and call["num_inference_steps"] == 12 and call["true_cfg_scale"] == 4.0
    assert all(max(i.size) <= 512 and i.width % 16 == 0 for i in call["image"])
    assert call["generator"] == 11 and "mannequin" in call["negative_prompt"]
    canvas = to_canvas(out)
    assert canvas.size == (1024, 1536) and canvas.getpixel((0, 0)) == (255, 255, 255)


def test_quantizacao_nf4_para_a_fase_2_caber_na_l4():
    import torch

    from services.garment_gpu.reconstruction import quantization_kwargs

    assert quantization_kwargs(SETTINGS, torch) == {}
    nf4 = config.load({"RECON_QUANTIZE": "nf4"})
    kwargs = quantization_kwargs(nf4, torch)
    assert kwargs["device_map"] == "cuda"
    quant = kwargs["quantization_config"]
    assert quant.quant_backend == "bitsandbytes_4bit" and set(quant.components_to_quantize) == {"transformer", "text_encoder"}
    assert quant.quant_kwargs["bnb_4bit_quant_type"] == "nf4"
    with pytest.raises(ValueError):
        config.load({"RECON_QUANTIZE": "nf4", "FAI_DEVICE": "cpu"})
    with pytest.raises(ValueError):
        config.load({"RECON_QUANTIZE": "int3"})
    with pytest.raises(ValueError):
        config.load({"RECON_QUANTIZE": "nf4", "RECON_OFFLOAD": "sequential"})
    offloaded = quantization_kwargs(config.load({"RECON_QUANTIZE": "nf4", "RECON_OFFLOAD": "model"}), torch)
    assert "device_map" not in offloaded and "quantization_config" in offloaded


def test_lightning_usa_o_agendador_da_destilacao_e_exige_lora_aplicado():
    import math

    from services.garment_gpu import reconstruction as rec

    assert rec.is_lightning("lightx2v/Qwen-Image-Edit-2511-Lightning") and not rec.is_lightning("/loras/fai.safetensors")

    class Pipe:
        scheduler = None

    pipe = Pipe()
    rec.use_lightning_scheduler(pipe)
    cfg = pipe.scheduler.config
    assert cfg.shift_terminal is None and cfg.use_dynamic_shifting
    assert math.isclose(cfg.base_shift, math.log(3)) and math.isclose(cfg.max_shift, math.log(3))

    class Layer:
        lora_A = object()

    class Transformer:
        def __init__(self, layers):
            self.layers = layers

        def modules(self):
            return iter(self.layers)

    assert rec.require_lora_layers(Transformer([Layer(), object(), Layer()]), "x") == 2
    with pytest.raises(RuntimeError, match="não foi aplicado"):
        rec.require_lora_layers(Transformer([object()]), "x")
