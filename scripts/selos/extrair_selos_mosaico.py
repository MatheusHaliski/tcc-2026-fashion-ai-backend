#!/usr/bin/env python3
"""
Recorta os selos dos mosaicos 3x3 (seloscirculares-parte1/novasvar*.png e os dois mosaicos 1200x896 da parte 2) e
remove o fundo: GrabCut em cada célula + elipse ajustada ao contorno do selo (borda limpa, sem a sombra).

Uso: descompacte seloscirculares-parte1.zip e seloscirculares-parte2.zip numa pasta e rode
    python3 scripts/selos/extrair_selos_mosaico.py <saida> <pasta-dos-zips-descompactados>
O selo vazado mosaico_f_l1c2 (anel sobre estampa) foi refeito à mão: anel + disco central concêntrico.
"""
import cv2, numpy as np, glob, os, sys
BASE = sys.argv[2] if len(sys.argv) > 2 else "zx"
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
mosaics = sorted(glob.glob(BASE + "/seloscirculares-parte1/novasvar*.png")) + [f for f in sorted(glob.glob(BASE + "/seloscirculares-parte2/*")) if Image.open(f).size == (1200, 896)]
names = ["mosaico_a", "mosaico_b", "mosaico_c", "mosaico_d", "mosaico_e", "mosaico_f"]
report = []
for name, path in zip(names, mosaics):
    img = cv2.imread(path, cv2.IMREAD_COLOR); H, W = img.shape[:2]
    for r in range(3):
        for c in range(3):
            y0, y1 = round(r * H / 3), round((r + 1) * H / 3); x0, x1 = round(c * W / 3), round((c + 1) * W / 3)
            cell = img[y0:y1, x0:x1].copy(); h, w = cell.shape[:2]
            mask = np.zeros((h, w), np.uint8); bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
            cv2.grabCut(cell, mask, (3, 3, w - 6, h - 6), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
            fg = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            big = max(cnts, key=cv2.contourArea)
            hull = cv2.convexHull(big)
            (cx, cy), (ea, eb), ang = cv2.fitEllipse(hull)
            em = np.zeros((h, w), np.uint8)
            cv2.ellipse(em, ((cx, cy), (ea * 0.985, eb * 0.985), ang), 255, -1, cv2.LINE_AA)
            # borda suave de 1 px
            alpha = cv2.GaussianBlur(em, (3, 3), 0)
            rgba = cv2.cvtColor(cell, cv2.COLOR_BGR2BGRA); rgba[..., 3] = alpha
            ys, xs = np.where(alpha > 0); crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            fn = f"{name}_l{r + 1}c{c + 1}.png"
            cv2.imwrite(os.path.join(OUT, fn), crop)
            cover = cv2.contourArea(big) / (np.pi * ea * eb / 4)
            report.append((fn, crop.shape[1], crop.shape[0], round(cover, 2)))
for r in report: print(*r)
