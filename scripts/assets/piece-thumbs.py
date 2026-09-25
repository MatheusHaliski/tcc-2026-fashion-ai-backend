#!/usr/bin/env python3
"""
Miniaturas WebP (320 e 640 px) das imagens padrão de peça (/public/assets_pecas) para os cards.

Os originais são PNGs de até 2 MB, pensados para o estúdio e o 3D; nos cards, a miniatura de 640 px cobre a tela
retina do desktop e a de 320 px a do celular. Gera public/_derived/pecas_thumb/* e o mapa lib/assets/piece-thumbs.json
(URL original → URLs das miniaturas), lido por thumbUrl() em lib/api/client.ts.
Uso: python3 scripts/assets/piece-thumbs.py
"""
import json, re, unicodedata
from pathlib import Path
from PIL import Image

PUBLIC = Path("public")
SRC = PUBLIC / "assets_pecas"
OUT = PUBLIC / "_derived" / "pecas_thumb"
MAP = Path("lib/assets/piece-thumbs.json")
SIZES = (320, 640)

def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mapping, before, after = {}, 0, 0
    for f in sorted(SRC.rglob("*")):
        if f.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"} or not f.is_file():
            continue
        rel = f.relative_to(PUBLIC).as_posix()
        name = slug(f.relative_to(SRC).with_suffix("").as_posix())
        im = Image.open(f)
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
        entry = {}
        for size in SIZES:
            t = im.copy(); t.thumbnail((size, size), Image.LANCZOS)
            dest = OUT / f"{name}-{size}.webp"
            t.save(dest, "WEBP", quality=80, method=6)
            entry[str(size)] = "/" + dest.relative_to(PUBLIC).as_posix()
            after += dest.stat().st_size if size == 640 else 0
        before += f.stat().st_size
        mapping["/" + rel] = entry
    MAP.write_text(json.dumps(mapping, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(mapping)} imagens · originais {before / 1e6:.1f} MB → miniaturas 640 px {after / 1e6:.1f} MB")

if __name__ == "__main__":
    main()
