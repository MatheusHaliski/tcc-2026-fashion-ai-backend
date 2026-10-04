#!/usr/bin/env python3
"""
RF25 — modelos dos três tipos de selo do criador (Circular, Folha e Padrão FashionAI).

Lê os pacotes enviados na raiz do repositório (selos_FashionAI.zip, seloscirculares-parte1.zip,
seloscirculares-parte2.zip) e escreve:

  public/selos/fai/NN.webp        medalhões do Padrão FashionAI, recortados em círculo com fundo transparente
  public/selos/circular/NN.webp   anéis com o centro livre (o criador desenha o elemento central por cima)
  (as folhas, em camadas editáveis, são geradas por scripts/selos/build_folhas.mjs)
  lib/seals/templates.json        catálogo lido pelo frontend (SealMedallion)
  fai-application/.../seals/templates.json      ids e cores dos modelos, validados/usados pelo backend (SealDesigns)

Requer Python 3 + opencv-python + numpy + Pillow. Uso: python3 scripts/selos/build_templates.py
"""
import json
import os
import sys
import zipfile

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "selos")
SIZE = 384
DEBUG = os.environ.get("SELOS_DEBUG")


def read_zip(name):
    """Imagens PNG de um zip, em ordem de nome (a mesma da folha de contato enviada)."""
    with zipfile.ZipFile(os.path.join(ROOT, name)) as z:
        names = sorted(n for n in z.namelist() if n.lower().endswith(".png") and "__MACOSX" not in n)
        for n in names:
            data = np.frombuffer(z.read(n), np.uint8)
            yield os.path.basename(n), cv2.imdecode(data, cv2.IMREAD_UNCHANGED)


def bgra(im):
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGRA)
    elif im.shape[2] == 3:
        im = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA)
    return im


def ellipse_box(im):
    """Caixa (x, y, w, h) do medalhão: alfa quando existe; senão, diferença para a cor do fundo (cantos)."""
    h, w = im.shape[:2]
    if im.shape[2] == 4 and (im[:, :, 3] < 250).mean() > 0.05:
        mask = (im[:, :, 3] > 40).astype(np.uint8) * 255
    else:
        rgb = im[:, :, :3].astype(np.int16)
        k = max(4, min(h, w) // 40)
        corners = np.concatenate([rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3), rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3)])
        bg = np.median(corners, axis=0)
        diff = np.abs(rgb - bg).sum(axis=2)
        mask = (diff > 38).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    if len(hull) >= 5:
        (cx, cy), (a, b), ang = cv2.fitEllipse(hull)
        if abs(((ang + 45) % 90) - 45) < 12:         # eixos alinhados: usa o elipse ajustado
            ww, hh = (a, b) if abs(ang % 180) < 45 or abs(ang % 180) > 135 else (b, a)
            return cx - ww / 2, cy - hh / 2, ww, hh
    x, y, ww, hh = cv2.boundingRect(hull)
    return x, y, ww, hh


def hough_box(im):
    """Medalhão sobre cena (fundo com textura/luz): círculo de Hough mais forte e grande."""
    g = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY)
    g = cv2.medianBlur(g, 5)
    m = min(g.shape)
    cs = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.5, minDist=m, param1=90, param2=40, minRadius=int(m * 0.36), maxRadius=int(m * 0.52))
    if cs is None:
        return None
    x, y, r = cs[0][0]
    return x - r, y - r, 2 * r, 2 * r


def medallion(im, box, inset=0.985):
    """Recorta a caixa, desfaz o achatamento (elipse → círculo) e aplica a máscara circular suavizada."""
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    w, h = w * inset, h * inset
    src = np.float32([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2]])
    dst = np.float32([[0, 0], [SIZE * 4, 0], [0, SIZE * 4]])
    big = cv2.warpAffine(bgra(im), cv2.getAffineTransform(src, dst), (SIZE * 4, SIZE * 4), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    mask = np.zeros((SIZE * 4, SIZE * 4), np.uint8)
    cv2.circle(mask, (SIZE * 2, SIZE * 2), SIZE * 2 - 2, 255, -1, lineType=cv2.LINE_AA)
    big[:, :, 3] = np.minimum(big[:, :, 3], mask)
    return cv2.resize(big, (SIZE, SIZE), interpolation=cv2.INTER_AREA)


def center_ratio(m):
    """Raio do disco central liso (fração do raio do selo): região conexa da cor do centro."""
    s = m.shape[0]
    c = s // 2
    rgb = cv2.GaussianBlur(m[:, :, :3], (5, 5), 0).astype(np.int16)
    ref = np.median(rgb[c - 4:c + 5, c - 4:c + 5].reshape(-1, 3), axis=0)
    close = (np.abs(rgb - ref).sum(axis=2) < 70).astype(np.uint8)
    n, lab = cv2.connectedComponents(close)
    area = (lab == lab[c, c]).sum()
    r = float(np.sqrt(area / np.pi) / (s / 2))
    return round(r, 3) if 0.22 <= r <= 0.62 else None


def dominant(m):
    """Cor dominante do anel (sem o centro), para a IA sugerir o modelo mais próximo da paleta da marca."""
    s = m.shape[0]
    yy, xx = np.mgrid[:s, :s]
    r = np.hypot(xx - s / 2, yy - s / 2) / (s / 2)
    sel = (r > 0.62) & (r < 0.9) & (m[:, :, 3] > 200)
    px = m[:, :, :3][sel].astype(np.float32)
    hsv = cv2.cvtColor(px.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    sat = hsv[:, 1] > 60
    pick = px[sat] if sat.mean() > 0.2 else px
    b, g, rr = np.median(pick, axis=0)
    return "#%02X%02X%02X" % (int(rr), int(g), int(b))


def save(m, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(cv2.cvtColor(m, cv2.COLOR_BGRA2RGBA)).save(path, "WEBP", quality=80, method=6)


def disc_fill(im, tol=4):
    """Disco liso do centro: preenchimento por inundação a partir do centro (bordas nítidas contra a malha)."""
    h, w = im.shape[:2]
    img = cv2.GaussianBlur(np.ascontiguousarray(im[:, :, :3]), (5, 5), 0)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(img, mask, (w // 2, h // 2), 0, (tol,) * 3, (tol,) * 3, 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
    m = cv2.morphologyEx(mask[1:-1, 1:-1], cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    c = max(cs, key=cv2.contourArea)
    x, y, ww, hh = cv2.boundingRect(c)
    if cv2.contourArea(c) / (np.pi * ww * hh / 4) < 0.95 or not 0.2 < hh / h < 0.65:
        return None
    return x + ww / 2, y + hh / 2, ww, hh


def disc_box(im):
    """Variações em grade vêm achatadas (elipse): o disco do centro dá o centro e o achatamento; o raio externo vem
    da borda do anel contra o fundo (mediana em volta), com a proporção típica (disco = 45 % do raio) de reserva."""
    h, w = im.shape[:2]
    d = disc_fill(im)
    if d is None:
        return None
    cx, cy, dw, dh = d
    ky = dw / dh                                   # escala vertical que torna o disco um círculo
    rd = dw / 2
    # anel ≈ disco / 0,47 (medido nas variações com borda nítida); a grade corta o topo e a base de algumas variações,
    # então o raio nunca passa do que cabe na célula (o círculo recorta igual em volta, sem repetir o fundo)
    R = min(rd / 0.47, (min(cy, h - cy) - 1) * ky, min(cx, w - cx) - 1)
    return cx - R, cy - R / ky, 2 * R, 2 * R / ky


def fill_hole(m):
    """Anel com o centro vazado: o centro vira um disco creme (onde o criador desenha o elemento)."""
    s = m.shape[0]
    if m[s // 2, s // 2, 3] > 40:
        return m
    hole = (m[:, :, 3] < 40).astype(np.uint8)
    n, lab = cv2.connectedComponents(hole)
    region = lab == lab[s // 2, s // 2]
    r = np.sqrt(region.sum() / np.pi)
    disc = np.zeros((s, s), np.uint8)
    cv2.circle(disc, (s // 2, s // 2), int(r + 3), 255, -1, lineType=cv2.LINE_AA)
    a = disc.astype(np.float32) / 255 * (1 - m[:, :, 3:4].astype(np.float32)[:, :, 0] / 255)
    for ch, v in enumerate((203, 230, 245)):                      # BGR do creme #F5E6CB
        m[:, :, ch] = (m[:, :, ch] * (1 - a) + v * a).astype(np.uint8)
    m[:, :, 3] = np.maximum(m[:, :, 3], disc)
    return m


def frontal(m):
    """Controle de qualidade das variações em grade: depois de desfazer o achatamento, o disco central tem de estar
    redondo e no centro (variação fotografada de lado, em perspectiva, fica de fora)."""
    s = m.shape[0]
    d = disc_fill(m)
    if d is None:
        return False
    cx, cy, a, b = d
    if min(a, b) / max(a, b) < 0.95 or np.hypot(cx - s / 2, cy - s / 2) > 0.04 * s:
        return False
    return True


def grid_cells(im, cols=3, rows=3):
    h, w = im.shape[:2]
    for r in range(rows):
        for c in range(cols):
            yield im[int(r * h / rows):int((r + 1) * h / rows), int(c * w / cols):int((c + 1) * w / cols)]


# ---------------------------------------------------------------- Padrão FashionAI
def build_fai():
    out = []
    for i, (name, im) in enumerate(read_zip("selos_FashionAI.zip"), start=1):
        box = next((b for k, b in FAI_BOX.items() if name.endswith(k)), None)
        if box:
            pass
        elif im.shape[2] == 4 and (im[:, :, 3] < 250).mean() > 0.05:
            box = ellipse_box(im)
        else:
            box = hough_box(im) or ellipse_box(im)
        m = medallion(im, box, inset=0.99)
        tid = "%02d" % i
        save(m, os.path.join(OUT, "fai", tid + ".webp"))
        out.append({"id": "fai/" + tid, "src": "/selos/fai/%s.webp" % tid, "color": dominant(m)})
        if DEBUG:
            print("fai", tid, name, [round(v) for v in box])
    return out


# ---------------------------------------------------------------- Circular (centro livre)
# fora do catálogo: a grade de padrões étnicos (centro todo estampado, sem espaço para o elemento) e a mandala com olho
SKIP = ("16.29.40 (1).png", "20.31.03 (6).png")
# medalhão sobre palco escuro com reflexos: o círculo de Hough pega o palco; centro e raio medidos à mão (px do original)
FAI_BOX = {"16.29.39 (7).png": (593 - 405, 450 - 405, 810, 810)}


def build_circular():
    out = []
    sources = []
    for z in ("seloscirculares-parte1.zip", "seloscirculares-parte2.zip"):
        for name, im in read_zip(z):
            h, w = im.shape[:2]
            if name.endswith(SKIP):
                continue
            if abs(w / h - 1200 / 896) < 0.02 and w >= 1100:          # folha 3×3 de variações
                for k, cell in enumerate(grid_cells(im)):
                    sources.append((f"{name}#{k}", cell, True))
            else:
                sources.append((name, im, False))
    i = 0
    seen = []
    for name, im, cell in sources:
        box = (disc_box(im) if cell else None) or ellipse_box(im)
        m = fill_hole(medallion(im, box, inset=0.985))
        if cell and not frontal(m):
            if DEBUG:
                print("circ fora", name)
            continue
        thumb = cv2.resize(m, (24, 24), interpolation=cv2.INTER_AREA).astype(np.int16)
        if any(np.abs(thumb - t).mean() < 9 for t in seen):          # variação repetida em outra grade
            if DEBUG:
                print("circ repetida", name)
            continue
        seen.append(thumb)
        i += 1
        tid = "%02d" % i
        save(m, os.path.join(OUT, "circular", tid + ".webp"))
        cr = center_ratio(m)
        out.append({"id": "circular/" + tid, "src": "/selos/circular/%s.webp" % tid, "center": cr or 0.4, "plain": cr is not None, "color": dominant(m)})
        if DEBUG:
            print("circ", tid, name, cr)
    return out


def write_backend(catalog):
    """O backend valida o "template" do desenho contra os mesmos ids e usa a cor de cada modelo na sugestão "Com IA"."""
    keep = ("id", "color", "plain")
    slim = {k: [{f: t[f] for f in keep if f in t} for t in v] for k, v in catalog.items()}
    res = os.path.join(ROOT, "fai-application", "src", "main", "resources", "seals", "templates.json")
    os.makedirs(os.path.dirname(res), exist_ok=True)
    with open(res, "w", encoding="utf-8") as fh:
        json.dump(slim, fh, indent=1)
        fh.write("\n")


def main():
    path = os.path.join(ROOT, "lib", "seals", "templates.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    folha = json.load(open(path, encoding="utf-8")).get("folha", []) if os.path.exists(path) else []
    catalog = {"fai": build_fai(), "circular": build_circular(), "folha": folha}      # folhas: build_folhas.mjs
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    write_backend(catalog)
    print({k: len(v) for k, v in catalog.items()})


if __name__ == "__main__":
    sys.exit(main())
