"""glb_quality e glb_web_rendition: nota do .glb lida só do arquivo, e a versão WEB que recomprime as texturas sem
tocar na geometria (mesmos triângulos, caixa e materiais) e para no primeiro degrau que cabe."""
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import glb_quality as gq  # noqa: E402
from scripts.catalog import glb_web_rendition as wr  # noqa: E402
from scripts.catalog.tests.meshy_glb_fixture import meshy_glb  # noqa: E402


def test_meshy_like_glb_is_good_with_metrics():
    q = gq.inspect(meshy_glb())
    assert q["grade"] == "BOM" and q["issues"] == []
    assert (q["triangles"], q["vertices"], q["textures"], q["max_texture"]) == (3000, 8, 3, 64)
    assert q["textured_materials"] == 1 and q["normal_map"] is True
    assert q["dimensions"] == [1.0, 1.6, 0.3]


def test_invalid_files_never_raise():
    for data in (b"", b"not a glb at all", b"glTF" + b"\x00" * 30, meshy_glb()[:-10]):
        assert gq.inspect(data) == {"bytes": len(data), "grade": "RUIM", "issues": ["INVALID_GLB"]}


def test_bad_signals():
    assert "NO_TEXTURE" in gq.inspect(meshy_glb(textures=False))["issues"]
    assert "TOO_FEW_TRIANGLES" in gq.inspect(meshy_glb(triangles=500))["issues"]
    flat = gq.inspect(meshy_glb(dims=(1.0, 1.6, 0.01)))
    assert flat["grade"] == "RUIM" and "FLAT_MESH" in flat["issues"] and "THIN_PROFILE" not in flat["issues"]


def test_thin_profile_is_review_not_bad():
    q = gq.inspect(meshy_glb(dims=(1.0, 1.8, 0.12)))   # 0.12 / 1.8 < 10%: relevo de uma foto só
    assert q["grade"] == "REVISAR" and q["issues"] == ["THIN_PROFILE"]


def test_size_profiles(monkeypatch):
    assert gq.rendition_profile(gq.WEB_BYTES) == "WEB"
    assert gq.rendition_profile(gq.WEB_BYTES + 1) == "DESKTOP_HIGH"
    assert gq.rendition_profile(gq.DESKTOP_BYTES + 1) is None
    data = meshy_glb()
    monkeypatch.setattr(gq, "WEB_BYTES", len(data) - 1)
    assert gq.inspect(data)["issues"] == ["ABOVE_WEB_PROFILE"]
    monkeypatch.setattr(gq, "DESKTOP_BYTES", len(data) - 1)
    assert gq.inspect(data)["grade"] == "RUIM"


def _images(data):
    document, binary = gq.split_glb(data)
    out = []
    for image in document["images"]:
        view = document["bufferViews"][image["bufferView"]]
        raw = binary[view["byteOffset"]:view["byteOffset"] + view["byteLength"]]
        with Image.open(io.BytesIO(raw)) as img:
            out.append((image["mimeType"], img.format, img.size))
    return document, out


def test_web_rendition_keeps_small_file_as_is():
    data = meshy_glb()
    assert wr.web_rendition(data) == (data, "original")


def test_web_rendition_turns_png_normal_into_jpeg_first():
    data = meshy_glb(normal_size=256, noise=True)
    small, recipe = wr.web_rendition(data, limit=len(data) - 1)
    assert recipe == "normal_jpeg" and len(small) < len(data)
    document, images = _images(small)
    assert images == [("image/jpeg", "JPEG", (256, 256)), ("image/jpeg", "JPEG", (64, 64)),
                      ("image/jpeg", "JPEG", (64, 64))]
    before, after = gq.inspect(data), gq.inspect(small)
    for key in ("triangles", "vertices", "dimensions", "textures", "normal_map", "textured_materials"):
        assert before[key] == after[key]
    last = document["bufferViews"][-1]
    assert document["buffers"][0]["byteLength"] == last["byteOffset"] + last["byteLength"]
    assert all(v["byteOffset"] % 4 == 0 for v in document["bufferViews"])


def test_web_rendition_downscales_when_jpeg_is_not_enough():
    data = meshy_glb(normal_size=2048, noise=True)
    jpeg_only = wr._recompress(*gq.split_glb(data), wr.STEPS[0])
    small, recipe = wr.web_rendition(data, limit=len(jpeg_only) - 1)
    assert recipe == "textures_1024"
    assert _images(small)[1][0] == ("image/jpeg", "JPEG", (1024, 1024))
    assert gq.inspect(small)["grade"] == "BOM"


def test_web_rendition_gives_up_when_nothing_fits():
    data = meshy_glb(normal_size=256, noise=True)
    assert wr.web_rendition(data, limit=100) is None


def test_pack_glb_round_trips():
    document, binary = gq.split_glb(meshy_glb())
    again = wr.pack_glb(document, binary)
    assert gq.split_glb(again)[0] == document and len(again) % 4 == 0
