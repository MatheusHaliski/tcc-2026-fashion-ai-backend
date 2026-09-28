#!/usr/bin/env python3
"""
Fashion AI — índice compacto de arte do card (RF11), derivado de lib/assets/asset-manifest.json.

O card (frontend) precisa resolver, sem baixar o manifesto inteiro, o que cada escolha do Background Studio desenha:
variante AURA (imagem + animação CSS), material (textura), AURA + material em imagem única ou mosaico (vídeo + pôster),
presets sazonais e gradientes. Rodar de novo sempre que o manifesto mudar:

    python3 scripts/assets/build_card_art_index.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / "lib/assets/asset-manifest.json").read_text(encoding="utf-8"))

presets, variants = {}, {}
for p in manifest["auraPresets"]:
    presets[p["id"]] = {"name": p["name"], "archetype": p.get("archetype"), "palette": p.get("palette", []),
                        "animation": (p.get("animation") or {}).get("kind"), "recommendedMaterials": p.get("recommendedMaterials", []),
                        "variants": [v["id"] for v in p.get("variants", [])]}
    for v in p.get("variants", []):
        static = v.get("static") or {}
        fallback = (v.get("staticFallback") or {}).get("posterUrl")
        variants[v["id"]] = {"presetId": p["id"], "code": v.get("code"), "theme": v.get("theme"),
                             "card": static.get("cardUrl") or fallback, "preview": static.get("previewUrl") or fallback,
                             "animated": (v.get("animated") or {}).get("url"),
                             "animation": (v.get("animatedFallback") or {}).get("animation") or (p.get("animation") or {}).get("kind")}

materials = {m["id"]: {"name": m["name"], "code": m.get("code"), "finish": m.get("finish"),
                       "card": (m.get("static") or {}).get("cardUrl"), "preview": (m.get("static") or {}).get("previewUrl")}
             for m in manifest["materials"]}

combos = {}
for kind, key in (("animated", "single"), ("mosaic", "mosaic")):
    for c in manifest["auraMaterialCombos"].get(kind, []):
        k = f'{c["auraVariantId"]}|{c["materialId"]}'
        combos.setdefault(k, {})[key] = {"url": c["url"], "poster": c.get("posterUrl"), "code": c.get("code")}

out = {"presets": presets, "variants": variants, "materials": materials, "combos": combos,
       "seasonal": {s["id"]: {"season": s["season"], "name": s["name"], "stops": s["stops"], "animation": s.get("animation")} for s in manifest["seasonalPresets"]},
       "gradients": {g["id"]: {"name": g["name"], "type": g.get("type"), "stops": g["stops"], "animation": g.get("animation")} for g in manifest["gradientAuraPresets"]},
       "skins": {s["id"]: {"nativeContainer": s.get("nativeContainer"), "family": s.get("family")} for s in manifest["cardSkins"]}}
dest = ROOT / "lib/assets/card-art-index.json"
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(dest, dest.stat().st_size, "bytes", len(variants), "variantes", len(combos), "combinações")
