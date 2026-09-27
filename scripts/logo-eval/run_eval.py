"""
Avaliação do RF4 (tipo, cor, logo, marca) com as fotos de dataset.json.

Para cada foto:
  1. RF4 atual: POST /api/pieces/analysis no backend (o mesmo endpoint do app), guardando categoria, subcategoria,
     cor, marca e o logo apontado pelo estúdio;
  2. pipeline proposto (pipeline.py): OCR + símbolo em recortes ampliados, com as probabilidades brutas.

Uso:
  API=http://localhost:8080 TOKEN=... CLIP_DIR=... CACHE=... python3 run_eval.py resultados.json
O backend deve rodar com IA remota desligada ou ligada; o resultado registra qual provedor respondeu.
"""
import json
import os
import sys
import time
import urllib.request

import numpy as np
import requests
from PIL import Image

from pipeline import LogoPipeline, decide

API = os.environ.get("API", "http://localhost:8080")
TOKEN = os.environ["TOKEN"]
CACHE = os.environ.get("CACHE", "cache")
OUT = sys.argv[1] if len(sys.argv) > 1 else "resultados.json"
os.makedirs(CACHE, exist_ok=True)

data = json.load(open(os.path.join(os.path.dirname(__file__), "dataset.json"), encoding="utf-8"))
done = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
pipe = LogoPipeline(os.environ["CLIP_DIR"])


def fetch(item):
    path = os.path.join(CACHE, item["imageId"] + ".jpg")
    if not os.path.exists(path):
        urllib.request.urlretrieve(item["imageUrl"], path)
    return path


def rf4(path):
    for attempt in range(5):
        with open(path, "rb") as f:
            r = requests.post(f"{API}/api/pieces/analysis", headers={"Authorization": f"Bearer {TOKEN}"},
                              files={"file": (os.path.basename(path), f, "image/jpeg")}, timeout=180)
        if r.status_code == 429:
            time.sleep(15 * (attempt + 1)); continue
        if r.status_code >= 400:
            return {"erro": f"{r.status_code} {r.text[:160]}"}
        d = r.json(); pf = d.get("prefill") or {}; st = d.get("studio") or {}
        return {"category": pf.get("category"), "subcategory": pf.get("subcategory"), "color": pf.get("color"),
                "brand": pf.get("brand"), "confidence": pf.get("confidence"), "aiLogo": pf.get("logo"),
                "studioLogo": st.get("logo"), "backgroundRemoved": d.get("backgroundRemoved"),
                "provider": [s.get("provider") for s in (d.get("flatLayMetadata") or {}).get("stages", [])][:1]}
    return {"erro": "429 repetido"}


for item in data["itens"]:
    if item.get("excluded") or str(item["n"]) in done:
        continue
    path = fetch(item)
    t0 = time.time(); cur = rf4(path); t1 = time.time()
    img = Image.open(path).convert("RGB")
    texts = pipe.read_text(img); probs = pipe.symbol_probs(pipe.crops(img)); res = decide(texts, probs); t2 = time.time()
    done[str(item["n"])] = {"rf4": cur, "rf4Ms": int((t1 - t0) * 1000),
                            "pipeline": {"estado": res.estado, "marca": res.marca, "fonte": res.fonte, "confianca": res.confianca,
                                         "textos": res.textos, "clip": res.clip}, "pipelineMs": int((t2 - t1) * 1000),
                            "probs": np.round(probs, 4).tolist(), "textosConf": [[t, round(c, 3)] for t, c in texts]}
    json.dump(done, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(item["n"], item.get("marca") or "-", "| RF4:", cur.get("category"), cur.get("subcategory"), cur.get("color"), cur.get("brand"),
          "| proposto:", res.estado, res.marca, res.fonte, flush=True)
