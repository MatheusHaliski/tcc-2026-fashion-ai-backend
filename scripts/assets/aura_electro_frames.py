#!/usr/bin/env python3
"""
Fashion AI — Aura Electro: 12 molduras de LED com movimento perimetral próprio.

Cada variante é um anel de LEDs (360×480, centro transparente, anel de 108 px = 30 % da largura, 9 fileiras de LEDs
que preenchem a faixa inteira, sem margem transparente) que o card desenha como border-image 9-slice
(.card-art-frame, slice 108): o feixe sai de um ponto, percorre as quatro bordas e volta. A faixa é 3× mais espessa
que a versão anterior (anel de 56 px em 540, ~10 % da largura).
Os 12 GIFs não são a mesma animação recolorida — cada um muda ao menos três atributos (quantidade de cabeças,
sentido, velocidade, ritmo, cauda, iluminação, origem):

  01 cyan pulse       1 cometa horário, cauda longa, origem no topo
  02 violet voltage   2 cabeças opostas (180°) horárias, caudas curtas, rápido
  03 magenta rush     2 cometas em sentidos contrários que se cruzam
  04 lime circuit     24 segmentos acendendo em sequência (circuito), ritmo staccato
  05 solar flow       2 cabeças anti-horárias com clarões pulsando
  06 gold charge      barra de carga: enche do centro da base até 100 % e esvazia
  07 brasil current   verde horário e amarelo anti-horário, cores distintas
  08 aurora boreal    anel inteiro com 4 cores fluindo + 2 cabeças brilhantes
  09 rainbow spectrum espectro girando no anel inteiro + faíscas em sentido contrário
  10 ice chrome       tracejado marchando (loading de quadrados) em dois grupos, respiração branca
  11 red reactor      batimento cardíaco (duas pulsações + pausa) no anel inteiro + cabeça lenta
  12 fashion signal   4 cabeças coloridas, duas horárias e duas anti-horárias, com blips de sinal

Uso: python3 scripts/assets/aura_electro_frames.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ELECTRO = ROOT / "public" / "aura" / "electro"
W, H, RING, INSET = 360, 480, 108, 0
CELL, DOT = 12, 10        # grade de LEDs: célula de 12 px, led de 10 px (9 fileiras no anel)
FRAMES, DELAY = 100, 100  # 10 s a 10 fps
TAU = 2 * np.pi


def hex_rgb(h: str):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def perimeter_coords():
    """Para cada célula de LED do anel: s (posição no perímetro 0..1, sentido horário a partir do centro do topo)
    e r (0 = borda interna, 1 = borda externa)."""
    cells = []
    x0, y0, x1, y1 = INSET, INSET, W - INSET, H - INSET
    R = RING
    inner = (x0 + R, y0 + R, x1 - R, y1 - R)
    lt, lv = inner[2] - inner[0], inner[3] - inner[1]      # trechos retos (topo/base e lados)
    la = (np.pi / 2) * (R / 2)                             # arco da linha central em cada canto
    per = 2 * (lt + lv) + 4 * la
    cx0 = (x0 + x1) / 2
    # Nos cantos o feixe gira em torno do vértice interno do anel: as frentes do feixe são raios a partir dele,
    # então a largura (borda externa - borda interna) fica preenchida de ponta a ponta durante toda a curva.
    for cy in range(y0, y1, CELL):
        for cx in range(x0, x1, CELL):
            mx, my = cx + CELL / 2, cy + CELL / 2
            if inner[0] <= mx <= inner[2] and inner[1] <= my <= inner[3]:
                continue
            dl, dt, dr, db = mx - x0, my - y0, x1 - mx, y1 - my
            left, right = mx < inner[0], mx > inner[2]
            up, down = my < inner[1], my > inner[3]
            if up and right:
                s = lt / 2 + (2 / np.pi) * la * np.arctan2(mx - inner[2], inner[1] - my)
            elif down and right:
                s = lt / 2 + la + lv + (2 / np.pi) * la * np.arctan2(my - inner[3], mx - inner[2])
            elif down and left:
                s = lt / 2 + 2 * la + lv + lt + (2 / np.pi) * la * np.arctan2(inner[0] - mx, my - inner[3])
            elif up and left:
                s = lt / 2 + 3 * la + lv + lt + lv + (2 / np.pi) * la * np.arctan2(inner[1] - my, inner[0] - mx)
            elif up:
                s = (mx - cx0) % per
            elif right:
                s = lt / 2 + la + (my - inner[1])
            elif down:
                s = lt / 2 + 2 * la + lv + (inner[2] - mx)
            else:
                s = lt / 2 + 3 * la + lv + lt + (inner[3] - my)
            r = 1 - min(dl, dt, dr, db) / RING
            cells.append((cx, cy, (s % per) / per, float(np.clip(r, 0, 1))))
    return cells


def comet(s, head, length, direction=1):
    """Brilho 0..1 de um cometa com cabeça em `head` e cauda `length` (frações do perímetro)."""
    d = (head - s) % 1.0 if direction > 0 else (s - head) % 1.0
    return np.where(d < length, (1 - d / length) ** 2, 0.0)


def render_variant(name: str, movement: str, colors: list[str], idx: int):
    cells = perimeter_coords()
    s = np.array([c[2] for c in cells]); r = np.array([c[3] for c in cells])
    cols = [hex_rgb(c) for c in colors]
    base, mid, hi = cols[0], cols[len(cols) // 2], cols[-1]
    frames = []
    for f in range(FRAMES):
        t = f / FRAMES
        inten = np.full_like(s, 0.12)        # LEDs apagados: brilho residual
        color = np.tile(base, (len(s), 1))
        if idx == 1:      # 1 cometa horário, cauda longa, origem no topo
            inten += comet(s, t, 0.28)
        elif idx == 2:    # 2 cabeças opostas horárias, caudas curtas, rápido
            inten += comet(s, 2 * t, 0.12) + comet(s, 2 * t + 0.5, 0.12)
        elif idx == 3:    # 2 cometas em sentidos contrários
            inten += comet(s, t, 0.18, 1) + comet(s, -t + 0.5, 0.18, -1)
        elif idx == 4:    # 24 segmentos acendendo em sequência (circuito)
            seg = np.floor(s * 24); active = np.floor(t * 24)
            inten += np.where(seg == active, 1.0, np.where((seg - active) % 24 <= 3, 0.45 * (1 - ((seg - active) % 24) / 4), 0.0))
        elif idx == 5:    # 2 cabeças anti-horárias com clarões pulsando
            flare = 0.7 + 0.3 * np.sin(TAU * 6 * t)
            inten += flare * (comet(s, -t * 1.5, 0.2, -1) + comet(s, -t * 1.5 + 0.5, 0.2, -1))
        elif idx == 6:    # barra de carga a partir do centro da base: enche e esvazia
            level = 1 - abs(2 * t - 1)
            d = (s - 0.5) % 1.0; d = np.minimum(d, 1 - d) * 2
            inten += np.where(d <= level, 0.75 + 0.25 * (d / max(level, 1e-3)), 0.0)
            inten += np.where(abs(d - level) < 0.03, 0.6, 0.0)
        elif idx == 7:    # verde horário, amarelo anti-horário
            a = comet(s, t * 1.2, 0.22, 1); b = comet(s, -t * 0.8, 0.22, -1)
            inten += a + b
            color = np.where((a > b)[:, None], np.tile(cols[0], (len(s), 1)), np.tile(cols[-1], (len(s), 1)))
        elif idx == 8:    # anel inteiro com 4 cores fluindo + 2 cabeças brilhantes
            u = (s - t) % 1.0 * len(cols)
            k0 = np.floor(u).astype(int) % len(cols); k1 = (k0 + 1) % len(cols); fr = (u - np.floor(u))[:, None]
            color = np.array(cols)[k0] * (1 - fr) + np.array(cols)[k1] * fr
            inten = 0.5 + comet(s, t, 0.1) + comet(s, t + 0.5, 0.1)
        elif idx == 9:    # espectro girando no anel inteiro + faíscas em sentido contrário
            u = (s + t) % 1.0 * len(cols)
            k0 = np.floor(u).astype(int) % len(cols); k1 = (k0 + 1) % len(cols); fr = (u - np.floor(u))[:, None]
            color = np.array(cols)[k0] * (1 - fr) + np.array(cols)[k1] * fr
            spark = (np.sin(TAU * (s * 40 - t * 3)) > 0.95).astype(float)
            inten = 0.55 + 0.45 * spark
        elif idx == 10:   # tracejado marchando em dois grupos + respiração branca
            dash = (np.floor((s - t * 0.5) * 36) % 3 == 0).astype(float)
            dash2 = (np.floor((s + t * 0.25) * 18) % 2 == 0).astype(float) * 0.5
            inten += 0.6 * dash + dash2 * (0.5 + 0.5 * np.sin(TAU * 2 * t))
        elif idx == 11:   # batimento cardíaco no anel inteiro + cabeça lenta
            ph = (t * 2) % 1.0
            beat = max(np.exp(-((ph - 0.1) / 0.05) ** 2), 0.7 * np.exp(-((ph - 0.3) / 0.05) ** 2))
            inten += 0.75 * beat + comet(s, t * 0.5, 0.15)
        elif idx == 12:   # 4 cabeças coloridas, duas horárias e duas anti-horárias, com blips
            heads = [(t, 1, 0), (t + 0.5, 1, 1), (-t + 0.25, -1, 2), (-t + 0.75, -1, 3)]
            best = np.zeros_like(s)
            for hd, dirn, ci in heads:
                c = comet(s, hd, 0.14, dirn)
                color = np.where((c > best)[:, None], np.tile(cols[ci % len(cols)], (len(s), 1)), color)
                best = np.maximum(best, c)
            blip = (np.sin(TAU * (s * 12 + 5 * t)) > 0.98).astype(float)
            inten += best + 0.5 * blip
        inten = np.clip(inten, 0, 1)
        if idx not in (7, 8, 9, 12):
            # gradiente do preset: brilho baixo na cor base, alto na cor clara
            color = np.tile(base, (len(s), 1)) * (1 - inten)[:, None] + np.tile(mid, (len(s), 1)) * inten[:, None]
            color = np.where((inten > 0.85)[:, None], np.tile(hi, (len(s), 1)), color)
        # borda externa do anel levemente mais escura (profundidade)
        shade = (0.75 + 0.25 * (1 - r))[:, None]
        rgb = np.clip(color * (0.35 + 0.65 * inten)[:, None] * shade, 0, 1)
        frame = np.zeros((H, W, 4), np.uint8)
        for (cx, cy, _, _), px, a in zip(cells, (rgb * 255).astype(np.uint8), inten):
            frame[cy + 1:cy + 1 + DOT, cx + 1:cx + 1 + DOT, :3] = px
            frame[cy + 1:cy + 1 + DOT, cx + 1:cx + 1 + DOT, 3] = 255
        frames.append(frame)
    return frames


def save_gif(frames, path: Path):
    imgs = []
    pal_src = Image.fromarray(np.concatenate([f[f[..., 3] > 0][:, :3] for f in frames[::10]])[None], "RGB")
    pal = pal_src.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    palette = pal.getpalette()[: 255 * 3] + [255, 0, 255]
    pal.putpalette(palette)
    for f in frames:
        q = Image.fromarray(f[..., :3], "RGB").quantize(palette=pal, dither=Image.Dither.NONE)
        idx = np.asarray(q).copy(); idx[f[..., 3] == 0] = 255
        p = Image.fromarray(idx, "P"); p.putpalette(palette); imgs.append(p)
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=DELAY, loop=0, disposal=2, transparency=255, optimize=False)


def main():
    cat = json.loads((ELECTRO / "catalogo.json").read_text(encoding="utf-8"))
    variants = cat["variants"]
    for i, v in enumerate(variants, 1):
        vid = v["name"].lower()
        frames = render_variant(vid, v["movement"], v["colors"], i)
        d = ELECTRO / vid
        d.mkdir(exist_ok=True)
        save_gif(frames, d / "loading_10s.gif")
        # pôster/miniatura: o quadro com mais LEDs acesos (o quadro 12 deixava o tile do seletor quase apagado)
        poster = max(frames, key=lambda fr: int(fr[..., :3].astype(np.uint32).sum()))
        Image.fromarray(poster).save(d / "imagem.png", optimize=True)
        print(f"[{i}/{len(variants)}] {vid} → loading_10s.gif ({(d / 'loading_10s.gif').stat().st_size // 1024} KB)", flush=True)
    cat["ring_px"] = RING; cat["inset_px"] = INSET; cat["size_px"] = [W, H]
    cat["safe_content_box"] = [INSET + RING, INSET + RING, W - INSET - RING, H - INSET - RING]
    cat["movements"] = __doc__.split("origem):")[1].split("Uso:")[0].strip()
    (ELECTRO / "catalogo.json").write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
