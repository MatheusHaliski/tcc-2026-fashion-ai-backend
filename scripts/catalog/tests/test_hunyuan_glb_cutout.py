"""hunyuan_glb_cutout: a foto vira PNG RGBA só com a peça (alfa = peça), quadrado e centrado; peça pequena é recusada;
recorte.json registra modo, pessoa e peça cortada pela borda."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import hunyuan_glb_cutout as cut  # noqa: E402


class Fusion:
    def __init__(self, target, mode="parser+birefnet", person=True, complete=True):
        self.target, self.mode, self.person, self._complete = target, mode, person, complete
        self.alpha = np.where(target, 0.9, 0.0).astype(np.float32)

    def attestations(self):
        return {"complete": self._complete}


class Provider:
    def __init__(self, fusion):
        self.fusion, self.calls = fusion, []

    def analyse(self, image, category, subcategory):
        self.calls.append((image.mode, image.size, category, subcategory))
        return self.fusion


def photo(tmp_path, size=(100, 200)):
    path = tmp_path / "foto.jpg"
    Image.new("RGB", size, (200, 30, 30)).save(path)
    return path


def test_garment_only_square_cutout_and_review(tmp_path):
    target = np.zeros((200, 100), dtype=bool)
    target[50:150, 20:60] = True                      # 100 × 40 px: 20 % da foto
    provider = Provider(Fusion(target, complete=False))
    out = cut.GarmentCutout(None, provider=provider)(photo(tmp_path), "lower_piece", "", tmp_path / "w" / "front_cut.png")
    assert provider.calls == [("RGB", (100, 200), "lower_piece", None)]
    image = Image.open(out)
    side = int(100 * (1 + 2 * cut.MARGIN))
    assert image.mode == "RGBA" and image.size == (side, side)
    alpha = np.asarray(image.getchannel("A"))
    assert alpha.max() == 229 and alpha[0, 0] == 0 and (alpha > 0).sum() == 100 * 40
    ys, xs = np.nonzero(alpha)
    assert abs((ys.min() + ys.max()) / 2 - side / 2) <= 1 and abs((xs.min() + xs.max()) / 2 - side / 2) <= 1
    review = json.loads((tmp_path / "w" / "recorte.json").read_text())
    assert review == {"modo": "parser+birefnet", "pessoa": True, "incompleta": True, "fracao": 0.2}


def test_tiny_garment_is_refused(tmp_path):
    target = np.zeros((200, 100), dtype=bool)
    target[0:5, 0:5] = True
    with pytest.raises(ValueError, match="RECORTE_PECA_PEQUENA"):
        cut.GarmentCutout(None, provider=Provider(Fusion(target)))(photo(tmp_path), "upper_piece", "t_shirt",
                                                                    tmp_path / "front_cut.png")
    assert not (tmp_path / "front_cut.png").exists()
