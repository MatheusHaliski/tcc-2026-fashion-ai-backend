import io

import numpy as np
import pytest
from PIL import Image

from services.garment_gpu.image_ops import (InvalidImage, check_bbox, clean_mask, decode_upload, fit_within,
                                            make_catalog_png, make_cutout_png)


def mask_fixture():
    im = Image.new("RGB", (80, 120), (255, 50, 0))
    mask = np.zeros((120, 80), dtype=np.uint8)
    mask[20:100, 20:60] = 1
    return im, mask


def test_bbox():
    assert check_bbox([0, 2, 10, 12], 20, 30) == [0, 2, 10, 12]
    for bad in ([10, 0, 3, 9], [0, 0, 30, 9], [0, 0, 4, 4], [1, 2, 3]):
        with pytest.raises(ValueError):
            check_bbox(bad, 20, 30)


def test_catalog_png_white_e_transparente():
    im, mask = mask_fixture()
    white = Image.open(io.BytesIO(make_catalog_png(im, mask, "white")))
    assert white.size == (1024, 1536)
    assert white.getpixel((0, 0)) == (255, 255, 255, 255)
    assert white.getpixel((512, 768))[0] == 255
    clear = Image.open(io.BytesIO(make_catalog_png(im, mask, "transparent")))
    assert clear.getpixel((0, 0))[3] == 0
    with pytest.raises(ValueError):
        make_catalog_png(im, np.zeros((120, 80), np.uint8))


def test_cutout_mantem_o_quadro_original():
    im, mask = mask_fixture()
    out = Image.open(io.BytesIO(make_cutout_png(im, mask)))
    assert out.size == (80, 120) and out.mode == "RGBA"
    assert out.getpixel((40, 60))[3] == 255 and out.getpixel((2, 2))[3] == 0


def test_limpeza_da_mascara_remove_ilhas_e_fecha_buracos():
    mask = np.zeros((100, 100), np.uint8)
    mask[10:90, 10:60] = 1
    mask[40:50, 30:40] = 0          # buraco interno (estampa escura) → preenchido
    mask[95:97, 95:97] = 1          # cisco fora da peça → removido
    cleaned = clean_mask(mask, box=[5, 5, 70, 95])
    assert cleaned[45, 35] == 1 and cleaned[96, 96] == 0


def test_upload_valida_formato_tamanho_e_orientacao_exif():
    with pytest.raises(InvalidImage):
        decode_upload(b"GIF89a....", 1_000_000)
    gif = io.BytesIO()
    Image.new("RGB", (100, 100)).save(gif, "GIF")
    with pytest.raises(InvalidImage, match="JPG, PNG ou WEBP"):
        decode_upload(gif.getvalue(), 1_000_000)
    big = io.BytesIO()
    Image.new("RGB", (2000, 2000)).save(big, "PNG")
    with pytest.raises(InvalidImage, match="megapixels"):
        decode_upload(big.getvalue(), 1_000_000)
    rotated = io.BytesIO()
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotate 90° CW
    Image.new("RGB", (200, 100)).save(rotated, "JPEG", exif=exif)
    assert decode_upload(rotated.getvalue(), 1_000_000).size == (100, 200)


def test_fit_within_multiplos_de_16():
    out = fit_within(Image.new("RGB", (1500, 1000)), 1024)
    assert max(out.size) <= 1024 and out.width % 16 == 0 and out.height % 16 == 0
