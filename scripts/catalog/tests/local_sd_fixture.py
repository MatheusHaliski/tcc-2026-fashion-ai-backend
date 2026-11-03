"""Fixtures compartilhadas dos testes do lote local (process_local_sd): a camiseta sintética com gola, braços e risco,
as máscaras e os dublês do renderizador, do provedor, da fusão fashn-open e do LaMa — sem GPU, rede nem modelo."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from photo_set import PhotoMasks  # noqa: E402


def shirt_photo(size=(600, 800)):
    """Camiseta azul com gola em anel (buraco fechado com pele dentro), braços de pele saindo das mangas e um risco preto fora."""
    im = Image.new("RGB", size, (235, 235, 235))
    d = ImageDraw.Draw(im)
    d.rectangle((150, 200, 450, 700), fill=(30, 60, 160))          # tronco da camiseta
    d.rectangle((60, 200, 150, 330), fill=(30, 60, 160))           # manga esquerda
    d.rectangle((450, 200, 540, 330), fill=(30, 60, 160))          # manga direita
    d.ellipse((250, 170, 350, 260), fill=(224, 172, 140))          # pescoço (pele) dentro da gola
    d.rectangle((20, 330, 150, 520), fill=(224, 172, 140))         # braço esquerdo (pele) abaixo da manga
    d.rectangle((450, 330, 580, 520), fill=(224, 172, 140))        # braço direito
    d.line((30, 30, 580, 120), fill=(0, 0, 0), width=2)            # risco fora do perímetro
    target = Image.new("L", size, 0)
    t = ImageDraw.Draw(target)
    t.rectangle((150, 200, 450, 700), fill=255); t.rectangle((60, 200, 150, 330), fill=255); t.rectangle((450, 200, 540, 330), fill=255)
    t.ellipse((250, 170, 350, 260), fill=0)                        # a gola é um buraco na máscara da peça
    t.line((30, 30, 580, 120), fill=255, width=2)                  # o segmentador "pegou" o risco
    forbidden = Image.new("L", size, 0)
    f = ImageDraw.Draw(forbidden)
    f.ellipse((250, 170, 350, 260), fill=255); f.rectangle((20, 330, 150, 520), fill=255); f.rectangle((450, 330, 580, 520), fill=255)
    f.line((31, 29, 580, 120), fill=255, width=2)
    return im, target, forbidden


def masks(target, forbidden, category="upper_piece", subcategory="t_shirt"):
    return PhotoMasks(target, forbidden, verified=True, target_category=category, target_subcategory=subcategory,
                      human_present=True, source="fixture")


class FakeRenderer:
    def __init__(self):
        self.calls = 0; self.max_side = 512; self.model = "fake"; self.device = "cpu"; self.steps = 1; self.guidance = 1.0; self.seed = 0; self.controlnet = False

    def render(self, init, mask):
        self.calls += 1
        return Image.new("RGB", init.size, (255, 0, 0))

    def free(self):
        pass


class Provider:
    def __init__(self, target, forbidden):
        self.target, self.forbidden = target, forbidden

    def masks(self, image, category, subcategory=None):
        return masks(self.target, self.forbidden, category, subcategory)


class FakeFusionProvider:
    """Fusão pronta a partir da fixture: alfa = máscara da peça, corpo = forbidden (o que o parser + BiRefNet devolveriam)."""

    def __init__(self, target, forbidden, mode="parser+birefnet"):
        self.target, self.forbidden, self.mode = target, forbidden, mode

    def analyse(self, image, category, subcategory):
        import fashn_open as fo
        t = np.asarray(self.target.convert("L")) >= 128
        f = np.asarray(self.forbidden.convert("L")) >= 128
        return fo.Fusion(t, f, t.astype(np.float32), self.mode, True, ("top",))


class FakeFiller:
    device = "cpu"

    def __init__(self):
        self.calls = 0

    def inpaint(self, image, mask):
        self.calls += 1
        return Image.new("RGB", image.size, (0, 255, 0))
