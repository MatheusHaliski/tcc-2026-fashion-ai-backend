#!/usr/bin/env python3
"""
Fashion AI — gerador do catálogo de assets visuais (RF11 / RF23 / RF4).

Varre a pasta /public, identifica as 7 combinações pedidas para o Background Studio
(material, aura, material+aura e mosaico) e os fundos de chrome do RF23 (/public/bg_chrome),
gera derivados leves para os seletores (RNF7 — desempenho) e escreve um único manifesto
consumido pelo frontend (lib/assets/asset-manifest.json) e pelo backend
(fai-web/src/main/resources/catalog/asset-manifest.json, semeado em asset_presets).

Uso:
    pip install pillow imageio-ffmpeg
    python3 scripts/assets/build_asset_catalog.py            # gera manifesto + derivados
    python3 scripts/assets/build_asset_catalog.py --no-derived  # só manifesto

Rodar de novo sempre que novos arquivos forem adicionados em /public: pastas ausentes hoje
(aura_com_GIF, aura_com_material_sem_GIF) e a pasta vazia aura_com_material_com_GIF passam a ser
detectadas automaticamente, e o status de cada categoria muda de "fallback" para "asset".
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
DERIVED = PUBLIC / "_derived"
FRONT_MANIFEST = ROOT / "lib" / "assets" / "asset-manifest.json"
BACK_MANIFEST = ROOT / "fai-web" / "src" / "main" / "resources" / "catalog" / "asset-manifest.json"

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov"}

# --------------------------------------------------------------------------------------------
# Catálogo curado (RF11_PROPOSTA_PRESETS_AURA_E_MATERIAIS.md + RF11_PROMPTS_AURA_MATERIAIS.md)
# --------------------------------------------------------------------------------------------
AURA_PRESETS = [
    {"id": "aura_alfaiataria", "name": "Tailored Steel", "archetype": "Alfaiataria clássica / quiet luxury",
     "palette": ["#0f172a", "#334155", "#cbd5e1"], "season": "Inverno · formal/corporate",
     "gradient": {"type": "linear", "angle": 135}, "animation": {"kind": "sweep", "durationS": 8},
     "prompt": "tailored classic menswear-inspired background, cold monochrome palette from deep navy to soft steel grey, quiet-luxury studio lighting, sharp low-contrast linear gradient, refined tailored art direction",
     "recommendedMaterials": ["la_fria_alfaiataria"], "skinFamilyRisk": "low"},
    {"id": "aura_editorial_mono", "name": "Editorial Ivory", "archetype": "Minimalismo editorial",
     "palette": ["#f5f2ea", "#d8d0c0", "#a8977c"], "season": "Verão suave · editorial/campanha",
     "gradient": {"type": "linear", "angle": 120}, "animation": {"kind": "breathe", "durationS": 6},
     "prompt": "minimalist editorial fashion background, warm-neutral monochrome palette from ivory to soft taupe, ultra-low saturation, clean campaign lighting, generous negative space for typography",
     "recommendedMaterials": ["organza_translucida"], "skinFamilyRisk": "low"},
    {"id": "aura_romantico_petala", "name": "Petal Bloom", "archetype": "Romântico/feminino",
     "palette": ["#fbe7ea", "#f5c9d6", "#e9a6c2"], "season": "Primavera · social/romântica",
     "gradient": {"type": "radial", "angle": 0}, "animation": {"kind": "particles", "durationS": 9},
     "prompt": "romantic feminine fashion background, soft analogous warm palette from blush pink to dusty rose, radial soft-focus glow, delicate floating petal-like bokeh accents",
     "recommendedMaterials": ["organza_translucida", "cetim_liquido"], "skinFamilyRisk": "medium"},
    {"id": "aura_boemio_terracota", "name": "Terracotta Dune", "archetype": "Boêmio",
     "palette": ["#7c2d12", "#c2703d", "#e8b06a"], "season": "Outono · casual/festival",
     "gradient": {"type": "radial", "angle": 0}, "animation": {"kind": "drift", "durationS": 12},
     "prompt": "bohemian fashion background, warm analogous autumn palette from burnt terracotta to golden ochre, radial sunset glow, organic desert-dune gradient movement",
     "recommendedMaterials": ["linho_natural", "tweed_boucle"], "skinFamilyRisk": "medium"},
    {"id": "aura_streetwear_neon", "name": "Concrete Neon", "archetype": "Streetwear/urbano",
     "palette": ["#0f172a", "#06b6d4", "#ec4899"], "season": "Todo o ano · rua/urbano",
     "gradient": {"type": "linear", "angle": 115}, "animation": {"kind": "scanline", "durationS": 2.5},
     "prompt": "urban streetwear fashion background, high-contrast complementary palette of deep asphalt grey with electric cyan and magenta neon accents, hard diagonal graphic blocks, bold contemporary street energy",
     "recommendedMaterials": ["denim_selvagem", "couro_nappa"], "skinFamilyRisk": "high"},
    {"id": "aura_avantgarde_cromo", "name": "Chrome Iridescent", "archetype": "Avant-garde / futurista",
     "palette": ["#1e1b4b", "#6366f1", "#a5b4fc", "#e0e7ff"], "season": "Inverno · editorial/vanguarda",
     "gradient": {"type": "conic", "angle": 0}, "animation": {"kind": "hue", "durationS": 10},
     "prompt": "avant-garde futuristic fashion background, cool iridescent palette from deep indigo to pale lavender chrome, holographic conic gradient, high-contrast vanguard editorial lighting",
     "recommendedMaterials": ["laminado_metalico"], "skinFamilyRisk": "high"},
    {"id": "aura_esportivo_performance", "name": "Performance Pulse", "archetype": "Esportivo/athleisure",
     "palette": ["#082f49", "#0ea5e9", "#a3e635"], "season": "Todo o ano · sport/activewear",
     "gradient": {"type": "linear", "angle": 125}, "animation": {"kind": "diagonal", "durationS": 3},
     "prompt": "sporty athleisure fashion background, energetic complementary palette of deep petrol blue with electric sky-blue and lime accents, diagonal motion-blur beams, dynamic performance-driven composition",
     "recommendedMaterials": ["malha_canelada"], "skinFamilyRisk": "high"},
    {"id": "aura_glam_noite", "name": "Midnight Spotlight", "archetype": "Glam de noite / red carpet",
     "palette": ["#020617", "#78350f", "#d97706"], "season": "Inverno · evento/noite",
     "gradient": {"type": "radial", "angle": 0}, "animation": {"kind": "shimmer", "durationS": 5},
     "prompt": "evening glam red-carpet fashion background, dark monochrome palette with warm bronze-gold jewel-tone spotlight accent, radial stage-spotlight glow, dramatic high-contrast luxury lighting",
     "recommendedMaterials": ["cetim_liquido", "veludo_profundo"], "skinFamilyRisk": "medium"},
    {"id": "aura_dark_academia", "name": "Ivy Library", "archetype": "Dark academia",
     "palette": ["#1c1917", "#451a03", "#78350f", "#14532d"], "season": "Outono/inverno · editorial intelectual",
     "gradient": {"type": "linear", "angle": 140}, "animation": {"kind": "flicker", "durationS": 5},
     "prompt": "dark academia fashion background, warm analogous palette from deep espresso brown to aged brass, muted forest-green accent, low-key library lighting, intellectual editorial mood",
     "recommendedMaterials": ["tweed_boucle", "veludo_profundo"], "skinFamilyRisk": "medium"},
    {"id": "aura_natural_organico", "name": "Raw Linen", "archetype": "Natural / sustentável",
     "palette": ["#78716c", "#a8a29e", "#e7e5e4"], "season": "Primavera/verão · casual consciente",
     "gradient": {"type": "linear", "angle": 150}, "animation": {"kind": "breathe", "durationS": 8},
     "prompt": "natural sustainable fashion background, neutral cool-toned earthy palette from raw linen grey to bone white, minimal saturation, soft breathable organic lighting",
     "recommendedMaterials": ["linho_natural"], "skinFamilyRisk": "low"},
]
AURA_NEGATIVE = "avoid gamified badge icons, avoid game UI elements, avoid achievement/level-up graphics, avoid text overlays"

# Ordem oficial P01..P18 (indice_de_correspondencia.csv do pacote presets_aura_sem_GIF_nomeados.zip —
# confirmada visualmente contra os vídeos do mosaico: P01=cabides, P05=circuitos, P13=palco).
AURA_VARIANT_ORDER = [
    "aura_alfaiataria__cabides", "aura_editorial_mono__estudio", "aura_romantico_petala__petalas",
    "aura_boemio_terracota__dunas_douradas", "aura_streetwear_neon__circuitos", "aura_natural_organico__floresta",
    "aura_boemio_terracota__deserto", "aura_romantico_petala__brilho_suave", "aura_avantgarde_cromo__fluxo_de_luz",
    "aura_esportivo_performance__feixes", "aura_avantgarde_cromo__cromo_lilas", "aura_esportivo_performance__diagonais",
    "aura_glam_noite__palco", "aura_dark_academia__escritorio", "aura_natural_organico__interiores",
    "aura_boemio_terracota__crepusculo", "aura_streetwear_neon__diagonais", "aura_dark_academia__biblioteca",
]

# Ordem oficial M01..M12 (indice_de_correspondencia.csv de materiais_sem_GIF_nomeados.zip — confirmada
# visualmente: moldura de M01 = lã fria em espinha, M04 = veludo verde, M10 = denim).
MATERIALS = [
    {"id": "la_fria_alfaiataria", "name": "Lã fria / worsted", "fiber": "Twill fino de lã", "finish": "matte",
     "params": {"density": 70, "threadDirection": "diagonal", "threadThickness": 1.6, "embossIntensity": 20},
     "archetype": "Alfaiataria clássica, corporate",
     "prompt": "cold wool suiting fabric surface, fine worsted twill weave, structured firm drape, smooth matte tailored finish"},
    {"id": "cetim_liquido", "name": "Cetim líquido", "fiber": "Satin weave", "finish": "satin",
     "params": {"density": 90, "threadDirection": "horizontal", "threadThickness": 0.8, "embossIntensity": 15},
     "archetype": "Glam de noite, editorial", "legacyAliases": ["water_material"],
     "prompt": "liquid satin fabric surface, fluid high-sheen weave, directional light reflection, smooth glossy drape"},
    {"id": "couro_nappa", "name": "Couro nappa", "fiber": "Couro de curtimento macio", "finish": "satin",
     "params": {"density": 80, "threadDirection": "cross", "threadThickness": 1.2, "embossIntensity": 40},
     "archetype": "Streetwear premium, avant-garde", "legacyAliases": ["lego_material"],
     "prompt": "nappa leather surface, smooth supple grain, controlled satin-matte reflection, structured premium hide texture"},
    {"id": "veludo_profundo", "name": "Veludo profundo", "fiber": "Pile weave", "finish": "satin",
     "params": {"density": 120, "threadDirection": "vertical", "threadThickness": 3.4, "embossIntensity": 85},
     "archetype": "Dark academia, luxo noturno",
     "prompt": "deep velvet pile fabric surface, dense directional nap, soft shadow depth between fibers, rich satin-matte duotone sheen"},
    {"id": "linho_natural", "name": "Linho natural", "fiber": "Tecido plano, fibra vegetal", "finish": "matte",
     "params": {"density": 35, "threadDirection": "horizontal", "threadThickness": 2.0, "embossIntensity": 30},
     "archetype": "Natural, verão, casual consciente",
     "prompt": "natural linen woven textile surface, light plain weave with subtle irregular slub texture, breathable matte finish, soft fabric grain"},
    {"id": "malha_canelada", "name": "Malha canelada", "fiber": "Rib knit", "finish": "matte",
     "params": {"density": 60, "threadDirection": "vertical", "threadThickness": 1.8, "embossIntensity": 35},
     "archetype": "Esportivo/athleisure, natural",
     "prompt": "ribbed knit fabric surface, regular vertical rib lines, soft stretch texture, matte tactile knit finish"},
    {"id": "acolchoado_azul_marinho", "name": "Acolchoado azul-marinho", "fiber": "Matelassê / quilted nylon", "finish": "satin",
     "params": {"density": 75, "threadDirection": "cross", "threadThickness": 2.2, "embossIntensity": 65},
     "archetype": "Outerwear, utilitário, inverno", "promptStatus": "novo — criado nesta rodada (não constava nos 10 prompts originais)",
     "prompt": "quilted navy nylon fabric surface, diamond stitched padding pattern, soft puffed relief between seams, subtle satin sheen"},
    {"id": "organza_translucida", "name": "Organza translúcida", "fiber": "Tecido plano, fio fino, sheer", "finish": "satin",
     "params": {"density": 20, "threadDirection": "horizontal", "threadThickness": 0.5, "embossIntensity": 10},
     "archetype": "Romântico, noiva, editorial leve", "legacyAliases": ["glass_material"],
     "prompt": "sheer organza fabric surface, crisp fine plain weave, translucent light-catching texture, subtle satin glow"},
    {"id": "brocado_floral", "name": "Brocado floral", "fiber": "Jacquard com fio metálico", "finish": "satin",
     "params": {"density": 110, "threadDirection": "cross", "threadThickness": 2.6, "embossIntensity": 75},
     "archetype": "Glam, festa, barroco", "legacyAliases": ["embroidered_fabric"],
     "promptStatus": "novo — criado nesta rodada (não constava nos 10 prompts originais)",
     "prompt": "floral brocade jacquard fabric surface, raised woven floral motifs with metallic gold thread, rich burgundy ground, ornate tactile relief"},
    {"id": "denim_selvagem", "name": "Denim selvedge", "fiber": "Twill grosso", "finish": "matte",
     "params": {"density": 100, "threadDirection": "diagonal", "threadThickness": 3.8, "embossIntensity": 55},
     "archetype": "Streetwear, casual urbano",
     "prompt": "selvedge denim fabric surface, coarse diagonal twill weave, rigid robust texture, matte indigo-toned grain"},
    {"id": "tweed_boucle", "name": "Tweed bouclé", "fiber": "Fio laçado", "finish": "matte",
     "params": {"density": 115, "threadDirection": "cross", "threadThickness": 3.0, "embossIntensity": 70},
     "archetype": "Dark academia, clássico editorial",
     "prompt": "bouclé tweed fabric surface, irregular looped yarn texture, voluminous cross-hatched weave, matte tactile bumpy surface"},
    {"id": "laminado_metalico", "name": "Laminado metálico", "fiber": "Lamê", "finish": "satin",
     "params": {"density": 95, "threadDirection": "diagonal", "threadThickness": 1.0, "embossIntensity": 60},
     "archetype": "Glam, Y2K, futurista",
     "prompt": "metallic laminated fabric surface, reflective foil-coated weave, rigid high-shine texture, futuristic lamé finish"},
]
MATERIAL_NEGATIVE = "avoid literal clothing garment silhouette, avoid stock photo watermark, avoid plastic 3D render look, avoid visible stitched text or logos"

# Predefinições de gradiente Aura (HU-RF11 CA9/CA14) — sistema de engajamento reaproveitado como
# preset de cor (estático) ou animado ("anima como GIF").
GRADIENT_AURA_PRESETS = [
    {"id": "heat_pulse", "name": "Heat Pulse", "type": "radial", "angle": 0, "stops": ["#ff5f6d", "#ffc371", "#3a0b0b"], "animation": "aura-heat-pulse"},
    {"id": "vibrant_spin", "name": "Vibrant Spin", "type": "conic", "angle": 0, "stops": ["#f72585", "#7209b7", "#4361ee", "#4cc9f0", "#f72585"], "animation": "aura-vibrant-rotate"},
    {"id": "iconic_gold", "name": "Iconic Gold", "type": "linear", "angle": 135, "stops": ["#3b2a06", "#c9a227", "#fff1b8", "#c9a227"], "animation": "aura-iconic-shimmer"},
    {"id": "legendary_holo", "name": "Legendary Holo", "type": "linear", "angle": 120, "stops": ["#a1c4fd", "#c2e9fb", "#fbc2eb", "#a6c1ee", "#fdcbf1"], "animation": "aura-legendary-holo"},
    {"id": "neon_drift", "name": "Neon Drift", "type": "linear", "angle": 115, "stops": ["#0f0c29", "#00f5d4", "#9b5de5", "#0f0c29"], "animation": "aura-neon-drift"},
    {"id": "aurora_mist", "name": "Aurora Mist", "type": "linear", "angle": 160, "stops": ["#0b3d2e", "#1fab89", "#62d2a2", "#9df3c4", "#1b1b3a"], "animation": "aura-aurora-mist"},
    {"id": "neon_grid", "name": "Neon Grid", "type": "linear", "angle": 180, "stops": ["#12002b", "#3d0a6b", "#ff2a6d", "#05d9e8"], "animation": "aura-neon-grid"},
]

SEASONAL_PRESETS = [
    {"id": "frost", "season": "WINTER", "name": "Frost", "stops": ["#E8F1F8", "#B9D4E8", "#5C7A99"], "animation": "SNOW"},
    {"id": "solstice", "season": "SUMMER", "name": "Solstice", "stops": ["#FFF3B0", "#FFC259", "#FF7A45"], "animation": "SHIMMER"},
    {"id": "ember", "season": "AUTUMN", "name": "Ember", "stops": ["#F2C879", "#C97C3D", "#7A3B1E"], "animation": "LEAVES"},
    {"id": "bloom", "season": "SPRING", "name": "Bloom", "stops": ["#FDE2EC", "#FFD3E0", "#C9EFCB"], "animation": "PETALS"},
]

CARD_SKINS = [
    {"id": "atelier", "name": "Atelier", "family": "fine", "nativeContainer": "#FFFFFF", "font": "Inter"},
    {"id": "spread", "name": "Spread", "family": "fine", "nativeContainer": "#F7F4EE", "font": "Fraunces"},
    {"id": "index", "name": "Índice", "family": "fine", "nativeContainer": "#FFFFFF", "font": "IBM Plex Mono"},
    {"id": "trading", "name": "Trading", "family": "framed", "nativeContainer": "#F2F2F2", "font": "Inter"},
    {"id": "fai_max", "name": "FAI Max", "family": "framed", "nativeContainer": "#FFF4EC", "font": "Inter"},
    {"id": "stub", "name": "Stub", "family": "framed", "nativeContainer": "#FBF7EF", "font": "IBM Plex Mono"},
    {"id": "specimen", "name": "Specimen", "family": "framed", "nativeContainer": "#F4F7F2", "font": "IBM Plex Mono"},
]

# Nomes semânticos dos fundos do RF23 (arquivos originais sem nome técnico).
CHROME_BG_NAMES = {
    "ChatGPT Image 22 de set. de 2026, 21_44_46.png": ("rf23_bg_selos_fai_claro", "Selos FAI · claro", "light"),
    "ChatGPT Image 22 de set. de 2026, 21_47_25.png": ("rf23_bg_selos_fai_noturno", "Selos FAI · noturno", "dark"),
    "ChatGPT Image 23 de set. de 2026, 09_16_32.png": ("rf23_bg_icones_moda_noite", "Ícones de moda · noite", "dark"),
    "ChatGPT Image 23 de set. de 2026, 09_52_49.png": ("rf23_bg_selos_fai_coloridos", "Selos FAI · coloridos", "light"),
    "ChatGPT Image 23 de set. de 2026, 09_59_57.png": ("rf23_bg_icones_holografico", "Ícones · holográfico", "light"),
    "Sem título - 22 de setembro de 2026 às 20.31.03 (2).png": ("rf23_bg_icones_moda_pastel", "Ícones de moda · pastel", "light"),
    "Sem título - 22 de setembro de 2026 às 20.31.03 (1).png": ("rf23_bg_icones_moda_kraft", "Ícones de moda · kraft", "light"),
}

# Pastas aceitas para cada uma das 7 combinações (nomes reais + variações prováveis).
CATEGORY_FOLDERS = {
    "material_static": ["material_no_GIF", "material_sem_GIF"],
    "material_animated": ["material_com_GIF"],
    "aura_static": ["aura_sem_GIF", "aura_no_GIF"],
    "aura_animated": ["aura_com_GIF"],
    "aura_material_static": ["aura_com_material_sem_GIF", "aura_com_material_no_GIF"],
    "aura_material_animated": ["aura_com_material_com_GIF"],
    "aura_material_mosaic_animated": ["aura_com_material_mosaico_com_GIF", "aura_com_material_mosaico_GIF"],
}
CATEGORY_META = {
    "material_static": ("Material (sem GIF)", 12, "asset"),
    "material_animated": ("Material (com GIF)", 12, "asset"),
    "aura_static": ("Aura (sem GIF)", 18, "asset"),
    "aura_animated": ("Aura (com GIF)", 18, "css-animation-over-static"),
    "aura_material_static": ("Material com Aura (sem GIF)", 216, "css-blend(aura_static + material_static)"),
    "aura_material_animated": ("Material com Aura (com GIF)", 216, "css-blend(aura_static + material_animated video)"),
    "aura_material_mosaic_animated": ("Material em mosaico com Aura (somente com GIF)", 216, "asset"),
}


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def url_of(path: Path) -> str:
    rel = path.relative_to(PUBLIC).as_posix()
    return "/" + "/".join(part for part in rel.split("/"))


def find_folder(key: str) -> Path | None:
    for name in CATEGORY_FOLDERS[key]:
        p = PUBLIC / name
        if p.is_dir():
            return p
    return None


def media_files(folder: Path | None, exts: set[str]) -> list[Path]:
    if not folder:
        return []
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in exts and "_derived" not in p.parts)


class Deriver:
    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.pil = None
        self.ffmpeg = None
        if enabled:
            try:
                from PIL import Image  # noqa
                self.pil = Image
            except ImportError:
                print("[warn] Pillow ausente — derivados de imagem não serão gerados", file=sys.stderr)
            try:
                import imageio_ffmpeg
                self.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:  # noqa: BLE001
                print("[warn] imageio-ffmpeg ausente — posters de vídeo não serão gerados", file=sys.stderr)

    def image_info(self, src: Path) -> dict:
        info = {"bytes": src.stat().st_size, "sha256": sha256(src)}
        if self.pil:
            with self.pil.open(src) as im:
                info["width"], info["height"] = im.size
        return info

    def image(self, src: Path, out: Path, max_side: int, quality: int = 80) -> str | None:
        if not (self.enabled and self.pil):
            return url_of(out) if out.exists() else None
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            return url_of(out)
        with self.pil.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((max_side, max_side))
            im.save(out, "WEBP", quality=quality, method=6)
        return url_of(out)

    def poster(self, src: Path, out: Path, width: int = 360) -> str | None:
        if not (self.enabled and self.ffmpeg):
            return url_of(out) if out.exists() else None
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            return url_of(out)
        cmd = [self.ffmpeg, "-loglevel", "error", "-y", "-ss", "1", "-i", str(src), "-frames:v", "1",
               "-vf", f"scale={width}:-2", "-q:v", "6", str(out)]
        subprocess.run(cmd, check=True)
        return url_of(out)

    def video_info(self, src: Path) -> dict:
        return {"bytes": src.stat().st_size, "sha256": sha256(src), "mime": "video/mp4" if src.suffix.lower() == ".mp4" else "video/webm"}


def build(derived_enabled: bool) -> dict:
    d = Deriver(derived_enabled)
    missing: list[dict] = []
    categories = []

    # ---------------- RF23 — fundos do chrome ----------------
    chrome = []
    bg_dir = PUBLIC / "bg_chrome"
    ignored = []
    for f in sorted(bg_dir.iterdir()) if bg_dir.is_dir() else []:
        if not f.is_file():
            continue
        if f.suffix.lower() not in IMAGE_EXT:
            if f.name != "index":
                ignored.append({"file": url_of(f), "reason": "não é imagem (ex.: zip de materiais duplicado de material_no_GIF)"})
            continue
        norm = unicodedata.normalize("NFC", f.name)
        bg_id, label, tone = CHROME_BG_NAMES.get(norm, (f"rf23_bg_{slug(f.stem)}", f.stem, "light"))
        entry = {"id": bg_id, "label": label, "tone": tone, "rf": ["RF23"], "originalFile": url_of(f),
                 "tileUrl": d.image(f, DERIVED / "bg_chrome" / f"{bg_id}_tile.webp", 1024, 82),
                 "previewUrl": d.image(f, DERIVED / "bg_chrome" / f"{bg_id}_preview.webp", 320, 75)}
        entry.update(d.image_info(f))
        chrome.append(entry)

    # ---------------- Materiais (estático + animado) ----------------
    mat_static_dir = find_folder("material_static")
    mat_anim_dir = find_folder("material_animated")
    mat_static = {p.stem: p for p in media_files(mat_static_dir, IMAGE_EXT)}
    mat_anim = {p.stem: p for p in media_files(mat_anim_dir, VIDEO_EXT | {".gif"})}
    materials = []
    for idx, m in enumerate(MATERIALS, start=1):
        entry = dict(m)
        entry["index"] = idx
        entry["code"] = f"M{idx:02d}"
        entry["negativePrompt"] = MATERIAL_NEGATIVE
        s = mat_static.get(m["id"])
        if s:
            entry["static"] = {"url": url_of(s),
                               "previewUrl": d.image(s, DERIVED / "material" / f"{m['id']}_preview.webp", 360, 78),
                               "cardUrl": d.image(s, DERIVED / "material" / f"{m['id']}_card.webp", 900, 80),
                               **d.image_info(s)}
        else:
            entry["static"] = None
            missing.append({"category": "material_static", "id": m["id"], "expected": f"/material_no_GIF/{m['id']}/{m['id']}.jpg"})
        a = mat_anim.get(m["id"])
        if a:
            entry["animated"] = {"url": url_of(a), "posterUrl": d.poster(a, DERIVED / "material" / f"{m['id']}_poster.jpg"),
                                 **d.video_info(a)}
        else:
            entry["animated"] = None
            missing.append({"category": "material_animated", "id": m["id"], "expected": f"/material_com_GIF/<parte>/{m['id']}/{m['id']}.mp4"})
        materials.append(entry)

    # ---------------- Auras (estático + animado) ----------------
    aura_static_dir = find_folder("aura_static")
    aura_anim_dir = find_folder("aura_animated")
    aura_static = {p.stem: p for p in media_files(aura_static_dir, IMAGE_EXT)}
    aura_anim = {p.stem: p for p in media_files(aura_anim_dir, VIDEO_EXT | {".gif"})}
    known_variants = list(AURA_VARIANT_ORDER) + sorted(v for v in aura_static if v not in AURA_VARIANT_ORDER)
    presets = {p["id"]: {**p, "negativePrompt": AURA_NEGATIVE, "variants": []} for p in AURA_PRESETS}
    variants_flat = []
    for idx, variant in enumerate(known_variants, start=1):
        preset_id, _, theme = variant.partition("__")
        preset = presets.get(preset_id)
        if preset is None:
            continue
        v = {"id": variant, "presetId": preset_id, "theme": theme.replace("_", " "), "index": idx, "code": f"P{idx:02d}"}
        s = aura_static.get(variant)
        if s:
            v["static"] = {"url": url_of(s),
                           "previewUrl": d.image(s, DERIVED / "aura" / f"{variant}_preview.webp", 360, 78),
                           "cardUrl": d.image(s, DERIVED / "aura" / f"{variant}_card.webp", 900, 80),
                           **d.image_info(s)}
        else:
            v["static"] = None
            missing.append({"category": "aura_static", "id": variant, "expected": f"/aura_sem_GIF/{variant}.png"})
        a = aura_anim.get(variant)
        if a:
            v["animated"] = {"url": url_of(a), "posterUrl": d.poster(a, DERIVED / "aura" / f"{variant}_poster.jpg"), **d.video_info(a)}
        else:
            v["animated"] = None
            v["animatedFallback"] = {"strategy": "css-animation-over-static", "animation": preset["animation"]["kind"],
                                     "durationS": preset["animation"]["durationS"]}
            missing.append({"category": "aura_animated", "id": variant,
                            "expected": f"/aura_com_GIF/{variant}.mp4 (ou .gif/.webm)"})
        preset["variants"].append(v)
        variants_flat.append(v)

    # ---------------- Combinações aura × material ----------------
    def combo_items(key: str, exts: set[str]) -> list[dict]:
        folder = find_folder(key)
        items = []
        for p in media_files(folder, exts):
            stem = p.stem
            mm = re.match(r"^P(\d{2})_M(\d{2})$", stem)
            aura_v = mat_id = None
            if mm:
                pi, mi = int(mm.group(1)), int(mm.group(2))
                if 1 <= pi <= len(variants_flat) and 1 <= mi <= len(MATERIALS):
                    aura_v, mat_id = variants_flat[pi - 1]["id"], MATERIALS[mi - 1]["id"]
            else:
                m2 = re.match(r"^(aura_[a-z_]+?)(?:__[a-z_]+)?_mais_([a-z_]+)$", stem)
                if m2:
                    aura_v = m2.group(1)
                    # convenção do doc: pasta = variante; arquivo = preset_mais_material
                    parent = p.parent.name
                    if parent.startswith("aura_") and "__" in parent:
                        aura_v = parent
                    mat_id = m2.group(2)
            if not (aura_v and mat_id):
                continue
            item = {"auraVariantId": aura_v, "materialId": mat_id, "url": url_of(p),
                    "code": next((f"{v['code']}_{mt['code']}" for v in variants_flat if v["id"] == aura_v
                                  for mt in materials if mt["id"] == mat_id), None)}
            if p.suffix.lower() in VIDEO_EXT:
                item["posterUrl"] = d.poster(p, DERIVED / key / f"{stem}_poster.jpg")
                item["mime"] = "video/mp4"
            else:
                item["previewUrl"] = d.image(p, DERIVED / key / f"{stem}_preview.webp", 360, 78)
            items.append(item)
        return items

    combos = {
        "static": combo_items("aura_material_static", IMAGE_EXT),
        "animated": combo_items("aura_material_animated", VIDEO_EXT | {".gif"}),
        "mosaic": combo_items("aura_material_mosaic_animated", VIDEO_EXT | {".gif"}),
    }

    counts = {
        "material_static": sum(1 for m in materials if m["static"]),
        "material_animated": sum(1 for m in materials if m["animated"]),
        "aura_static": sum(1 for v in variants_flat if v["static"]),
        "aura_animated": sum(1 for v in variants_flat if v["animated"]),
        "aura_material_static": len(combos["static"]),
        "aura_material_animated": len(combos["animated"]),
        "aura_material_mosaic_animated": len(combos["mosaic"]),
    }
    for key, (label, expected, fallback) in CATEGORY_META.items():
        folder = find_folder(key)
        n = counts[key]
        status = "complete" if n >= expected else ("partial" if n > 0 else "missing")
        categories.append({
            "key": key, "label": label, "folder": ("/" + folder.name) if folder else None,
            "acceptedFolderNames": CATEGORY_FOLDERS[key], "found": n, "expected": expected, "status": status,
            "renderStrategy": "asset" if status == "complete" else (fallback if fallback != "asset" else "asset-partial"),
        })
        if status != "complete" and key in ("aura_material_static", "aura_material_animated"):
            missing.append({"category": key, "id": "*", "expected": f"/{CATEGORY_FOLDERS[key][0]}/P##_M##.(png|mp4) "
                            f"ou /{CATEGORY_FOLDERS[key][0]}/<aura_variante>/<aura>_mais_<material>.(png|mp4)",
                            "found": n, "total": expected})

    stray = [url_of(p) for p in PUBLIC.iterdir() if p.is_file() and p.name not in ("index",)]
    return {
        "version": 2,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "scripts/assets/build_asset_catalog.py",
        "chromeBackgrounds": chrome,
        "auraPresets": list(presets.values()),
        "materials": materials,
        "auraMaterialCombos": combos,
        "categories": categories,
        "gradientAuraPresets": GRADIENT_AURA_PRESETS,
        "seasonalPresets": SEASONAL_PRESETS,
        "cardSkins": CARD_SKINS,
        "missing": missing,
        "ignoredFiles": ignored + [{"file": s, "reason": "arquivo solto na raiz de /public"} for s in stray],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-derived", action="store_true")
    args = ap.parse_args()
    manifest = build(not args.no_derived)
    for target in (FRONT_MANIFEST, BACK_MANIFEST):
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    cats = ", ".join(f"{c['key']}={c['found']}/{c['expected']}({c['status']})" for c in manifest["categories"])
    print(f"manifesto gerado: {len(manifest['chromeBackgrounds'])} fundos RF23; {cats}")


if __name__ == "__main__":
    main()
