#!/usr/bin/env python3
"""
Fashion AI — animação fluida para variantes AURA que só tinham imagem estática.

Chrome Iridescent (aura_avantgarde_cromo) e Terracotta Dune (aura_boemio_terracota) vinham de /aura_sem_GIF/*.png e
eram animadas só por CSS (hue-rotate / drift). Este script aplica o mesmo warp fluido do Aura Geometry
(scripts/assets/aura_geometry_fluid.py) à imagem inteira — o cromo escorre como metal líquido, as dunas deslizam como
areia — e grava /aura_com_GIF/<variante>.mp4 (H.264, 20 fps, 10 s, loop perfeito), que o build_asset_catalog.py
registra como `animated` da variante e o card desenha como <video> (lib/card-art.ts). Um GIF de tela cheia neste
tamanho passaria de 10 MB; o MP4 fica em torno de 1–2 MB.

Uso:
    python3 scripts/assets/aura_static_fluid.py                # todas as variantes listadas
    python3 scripts/assets/aura_static_fluid.py aura_avantgarde_cromo__cromo_lilas
    python3 scripts/assets/build_asset_catalog.py --no-derived && python3 scripts/assets/build_card_art_index.py
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import av
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aura_geometry_fluid as fluid  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "aura_sem_GIF"
OUT = ROOT / "public" / "aura_com_GIF"
WIDTH = 480  # largura do vídeo (o card mostra a arte só na faixa do passe-partout)
FPS = 20

VARIANTS = [
    "aura_avantgarde_cromo__cromo_lilas",
    "aura_avantgarde_cromo__fluxo_de_luz",
    "aura_boemio_terracota__dunas_douradas",
    "aura_boemio_terracota__deserto",
    "aura_boemio_terracota__crepusculo",
]


def main() -> None:
    wanted = sys.argv[1:] or VARIANTS
    OUT.mkdir(parents=True, exist_ok=True)
    for i, vid in enumerate(wanted, 1):
        src = SRC / f"{vid}.png"
        im = Image.open(src).convert("RGBA")
        height = round(im.height * WIDTH / im.width) // 2 * 2  # yuv420p exige dimensões pares
        im = im.resize((WIDTH, height), Image.LANCZOS)
        seed = int(hashlib.sha1(vid.encode()).hexdigest()[:8], 16)
        frames = fluid.fluid_frames(im, seed, frames=FPS * fluid.SECONDS)
        out = OUT / f"{vid}.mp4"
        write_mp4(frames, out)
        print(f"[{i}/{len(wanted)}] {vid} → {out} ({out.stat().st_size // 1024} KB)", flush=True)


def write_mp4(frames, path: Path) -> None:
    """H.264 yuv420p com faststart; os quadros vêm premultiplicados em [0, 1] (imagem opaca)."""
    h, w = frames[0].shape[:2]
    with av.open(str(path), "w") as container:
        stream = container.add_stream("libx264", rate=FPS)
        stream.width, stream.height, stream.pix_fmt = w, h, "yuv420p"
        stream.options = {"crf": "21", "preset": "slow", "movflags": "+faststart", "profile": "high"}
        for fr in frames:
            rgb = (np.clip(fr[..., :3], 0, 1) * 255).round().astype(np.uint8)
            for packet in stream.encode(av.VideoFrame.from_ndarray(rgb, format="rgb24")):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)


if __name__ == "__main__":
    main()
