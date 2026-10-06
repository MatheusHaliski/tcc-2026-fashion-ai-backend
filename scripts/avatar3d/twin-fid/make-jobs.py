"""
TWIN-FID: monta as variações de captura e a lista de casos da bateria.
Uso: python3 make-jobs.py <fotos originais> <pasta das variações> <jobs.json>
Variações (só para os retratos de ROBUST): luz quente, luz fria, exposição -38%, meia resolução, inclinação de 5°;
mais a armação de grau sintética do laboratório e seis corpos paramétricos com o rosto de seis pessoas.
"""
import json, os, sys
from PIL import Image, ImageEnhance
src, var, out = sys.argv[1:4]
ROBUST = ["p07-masc", "p08-masc", "p24-masc", "p28-fem", "p37-fem", "p54-fem"]
os.makedirs(var, exist_ok=True)
for n in ROBUST:
    im = Image.open(f"{src}/{n}.jpg").convert("RGB"); r, g, b = im.split()
    warm = Image.merge("RGB", (r.point(lambda v: min(255, int(v * 1.12))), g.point(lambda v: min(255, int(v * 1.02))), b.point(lambda v: int(v * 0.82))))
    cool = Image.merge("RGB", (r.point(lambda v: int(v * 0.86)), g, b.point(lambda v: min(255, int(v * 1.14)))))
    dark = ImageEnhance.Brightness(im).enhance(0.62)
    half = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    tilt = im.rotate(5, resample=Image.BICUBIC, expand=False, fillcolor=tuple(int(c) for c in im.getpixel((2, 2))))
    for tag, v in [("warm", warm), ("cool", cool), ("dark", dark), ("half", half), ("tilt", tilt)]:
        v.save(f"{var}/{n}~{tag}.jpg", quality=92)
jobs = [{"id": f[:-4], "file": f"{src}/{f}", "views": ["face", "face34", "faceside", "front"]} for f in sorted(os.listdir(src)) if f.endswith(".jpg")]
jobs += [{"id": f[:-4], "file": f"{var}/{f}", "views": ["face", "face34"]} for f in sorted(os.listdir(var)) if f.endswith(".jpg")]
jobs += [{"id": f"{n}~oculos", "file": f"{src}/{n}.jpg", "synth": "frame", "views": ["face", "face34"]} for n in ROBUST]
D = {"FEMININO": dict(stature=1.63, shoulderW=0.19, chestW=0.175, waistW=0.15, hipW=0.205, legLen=0.53, armLen=0.333, headH=0.13, build=0),
     "MASCULINO": dict(stature=1.76, shoulderW=0.205, chestW=0.19, waistW=0.165, hipW=0.19, legLen=0.53, armLen=0.333, headH=0.13, build=0)}
for tag, n, sex, o in [("F1", "p37-fem", "FEMININO", dict(stature=1.55, shoulderW=0.184, chestW=0.165, waistW=0.138, hipW=0.19)),
                       ("F2", "p28-fem", "FEMININO", dict(stature=1.68)),
                       ("F3", "p54-fem", "FEMININO", dict(stature=1.74, chestW=0.182, waistW=0.152, hipW=0.232)),
                       ("M1", "p08-masc", "MASCULINO", dict(stature=1.65, chestW=0.198, waistW=0.182, hipW=0.196, legLen=0.512)),
                       ("M2", "p07-masc", "MASCULINO", dict(stature=1.80)),
                       ("M3", "p24-masc", "MASCULINO", dict(stature=1.92, shoulderW=0.224, chestW=0.206, waistW=0.166, legLen=0.545))]:
    jobs.append({"id": f"corpo-{tag}~{n}", "file": f"{src}/{n}.jpg", "body": {**D[sex], **o}, "views": ["front", "left34", "profile"]})
json.dump(jobs, open(out, "w"), indent=0); print(len(jobs), "casos")
