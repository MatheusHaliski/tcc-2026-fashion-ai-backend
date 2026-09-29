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
    {"id": "aura_electro", "name": "Aura Electro", "archetype": "Efeitos de luz e cor eletro",
     "palette": ["#087bff", "#00e5ff", "#ac53ff", "#ff39d5"], "season": "Todo o ano · editorial/urbano",
     "gradient": {"type": "conic", "angle": 0}, "animation": {"kind": "gif", "durationS": 10},
     "prompt": "electro fashion aura, vibrant neon light trails with transparent center, high-energy color gradients",
     "recommendedMaterials": ["laminado_metalico", "malha_canelada"], "skinFamilyRisk": "high"},
    {"id": "aura_geometry", "name": "Aura Geometry", "archetype": "Composições geométricas e arte gráfica",
     "palette": ["#101820", "#f2ece2", "#d72c3f"], "season": "Todo o ano · editorial/gráfico",
     "gradient": {"type": "linear", "angle": 135}, "animation": {"kind": "gif", "durationS": 10},
     "prompt": "geometric editorial fashion aura, graphic composition with crisp shapes and a transparent center",
     "recommendedMaterials": ["laminado_metalico", "tweed_boucle"], "skinFamilyRisk": "high"},
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

# P01..P18 → preset AURA (fashionai-diagramas-completo 11, RF11_PROPOSTA_PRESETS_AURA_E_MATERIAIS.md §7.4 — tabela
# oficial vigente). O arquivo estático de /public/aura_sem_GIF foi escolhido pelo conteúdo que a tabela descreve
# (conferido visualmente). P09 e P10 não têm arquivo estático próprio: usam o 1º quadro do vídeo P×M como pôster.
# "brilho_suave" (Petal Bloom) e "esportivo_performance__diagonais" são variantes estáticas extras, sem código P.
AURA_VARIANTS = [
    ("P01", "aura_alfaiataria__cabides", "aura_alfaiataria", "Pares de peças em cabides sobre fundo cinza-claro"),
    ("P02", "aura_editorial_mono__estudio", "aura_editorial_mono", "Pedestais de still-life com objetos drapeados"),
    ("P03", "aura_romantico_petala__petalas", "aura_romantico_petala", "Close-ups têxteis com pétalas flutuando"),
    ("P04", "aura_boemio_terracota__dunas_douradas", "aura_boemio_terracota", "Dunas de tecido ao pôr do sol"),
    ("P05", "aura_streetwear_neon__circuitos", "aura_streetwear_neon", "Painéis com faixas diagonais em relevo"),
    ("P06", "aura_esportivo_performance__feixes", "aura_esportivo_performance", "Feixes de luz em X sobre fundos texturizados"),
    ("P07", "aura_natural_organico__floresta", "aura_natural_organico", "Texturas têxteis e paisagens em névoa"),
    ("P08", "aura_boemio_terracota__deserto", "aura_boemio_terracota", "Moldura com 4 painéis verticais de deserto"),
    ("P09", "aura_natural_organico__gotas", "aura_natural_organico", "Amostras quadradas com gotas sobre fundo branco"),
    ("P10", "aura_glam_noite__tecidos_flutuando", "aura_glam_noite", "Tecidos flutuando em estúdio escuro"),
    ("P11", "aura_avantgarde_cromo__cromo_lilas", "aura_avantgarde_cromo", "Tecidos lilás e violeta holográficos sobre preto"),
    ("P12", "aura_streetwear_neon__diagonais", "aura_streetwear_neon", "Colagem glitch ciano e magenta"),
    ("P13", "aura_glam_noite__palco", "aura_glam_noite", "Palcos com passarela e holofotes"),
    ("P14", "aura_dark_academia__escritorio", "aura_dark_academia", "Biblioteca com escrivaninha e luminária"),
    ("P15", "aura_natural_organico__interiores", "aura_natural_organico", "Detalhes de interiores: estofado, cortinas, móveis"),
    ("P16", "aura_boemio_terracota__crepusculo", "aura_boemio_terracota", "Painéis têxteis ornamentais com dunas"),
    ("P17", "aura_avantgarde_cromo__fluxo_de_luz", "aura_avantgarde_cromo", "Amostras de tecido com curvas cromadas"),
    ("P18", "aura_dark_academia__biblioteca", "aura_dark_academia", "A mesma biblioteca em vários tratamentos de cor"),
]
AURA_VARIANT_ORDER = [v[1] for v in AURA_VARIANTS]

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
    {"id": "nylon_ripstop", "name": "Nylon Ripstop", "fiber": "Nylon ripstop (trama fechada com reforço em losango)", "finish": "satin",
     "params": {"density": 85, "threadDirection": "cross", "threadThickness": 1.4, "embossIntensity": 45},
     "archetype": "Streetwear técnico, esportivo", "legacyAliases": ["nylon_ripstop"], "folder": "acolchoado_azul_marinho", "promptStatus": "novo — criado nesta rodada (não constava nos 10 prompts originais)",
     "prompt": "quilted navy nylon fabric surface, diamond stitched padding pattern, soft puffed relief between seams, subtle satin sheen"},
    {"id": "organza_translucida", "name": "Organza translúcida", "fiber": "Tecido plano, fio fino, sheer", "finish": "satin",
     "params": {"density": 20, "threadDirection": "horizontal", "threadThickness": 0.5, "embossIntensity": 10},
     "archetype": "Romântico, noiva, editorial leve", "legacyAliases": ["glass_material"],
     "prompt": "sheer organza fabric surface, crisp fine plain weave, translucent light-catching texture, subtle satin glow"},
    {"id": "brocado_jacquard", "name": "Brocado Jacquard", "fiber": "Brocado jacquard (damasco com fio metálico)", "finish": "satin",
     "params": {"density": 110, "threadDirection": "cross", "threadThickness": 2.2, "embossIntensity": 65},
     "archetype": "Glam de noite, dark academia", "legacyAliases": ["brocado_floral", "embroidered_fabric"], "folder": "brocado_floral",
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

# Skins de card (presets recomendados do RF11). Tokens visuais por skin; prompts, thumbHint e status vêm dos
# markdowns de /public/presets_recomendados (fonte: skinRegistry.ts + mockup "Quatro Conceitos").
CARD_SKINS = [
    {"id": "atelier", "name": "Atelier", "family": "fine", "nativeContainer": "#FFFFFF", "font": "Inter",
     "tokens": {"bg": "#FFFFFF", "ink": "#1A1714", "accent": "#1A1714", "border": "#E7E2DA", "radius": 14, "titleWeight": 500}},
    {"id": "spread", "name": "Spread", "family": "fine", "nativeContainer": "#F7F4EE", "font": "Fraunces",
     "tokens": {"bg": "#F7F4EE", "ink": "#111111", "accent": "#B4442C", "border": "#D9D1C4", "radius": 6, "titleWeight": 800}},
    {"id": "index", "name": "Índice", "family": "fine", "nativeContainer": "#FFFFFF", "font": "IBM Plex Mono",
     "tokens": {"bg": "#FBFAF6", "ink": "#23201C", "accent": "#5B6B7A", "border": "#23201C", "radius": 4, "titleWeight": 600}},
    {"id": "trading", "name": "Trading", "family": "framed", "nativeContainer": "#F2F2F2", "font": "Inter",
     "tokens": {"bg": "#F2F2F2", "ink": "#16161A", "accent": "#7C5FC0", "border": "#9A9AA3", "radius": 18, "titleWeight": 800}},
    {"id": "fai_max", "name": "FAI Max", "family": "framed", "nativeContainer": "#FFF4EC", "font": "Inter",
     "tokens": {"bg": "#FFF4EC", "ink": "#1A0F08", "accent": "#FF6A1A", "border": "#FF6A1A", "radius": 20, "titleWeight": 900}},
    {"id": "stub", "name": "Stub", "family": "framed", "nativeContainer": "#FBF7EF", "font": "IBM Plex Mono",
     "tokens": {"bg": "#FBF7EF", "ink": "#2A241C", "accent": "#A0522D", "border": "#2A241C", "radius": 2, "titleWeight": 700}},
    {"id": "specimen", "name": "Specimen", "family": "framed", "nativeContainer": "#F4F7F2", "font": "IBM Plex Mono",
     "tokens": {"bg": "#F4F7F2", "ink": "#1F2A22", "accent": "#3D7A5A", "border": "#9FB3A5", "radius": 6, "titleWeight": 600}},
    {"id": "editorial_ivory", "name": "Editorial Ivory Paper", "family": "fine", "nativeContainer": "#F7F4EE", "font": "Georgia",
     "tokens": {"bg": "#F7F4EE", "ink": "#1A1410", "accent": "#C4956A", "border": "#D4CEC4", "badgeBg": "#F0EDE8",
                "radius": 3, "titleWeight": 400, "pieceStripe": "side-3px", "glass": False}},
    {"id": "show_notes", "name": "Show Notes", "family": "framed", "nativeContainer": "#0A0A0A", "font": "Inter",
     "tokens": {"bg": "#0A0A0A", "ink": "#F5F5F5", "accent": "#F5F5F5", "border": "rgba(255,255,255,0.18)", "radius": 3,
                "titleWeight": 900, "watermarkOpacity": 0.028, "pieceStripe": "top-2px", "badges": "outline"}},
    {"id": "atelier_terracotta", "name": "Atelier Terracota", "family": "framed", "nativeContainer": "#3A2416", "font": "Georgia",
     "tokens": {"bg": "#3A2416", "ink": "#F3E6D8", "accent": "#C4674A", "border": "rgba(243,230,216,0.28)", "radius": 7,
                "titleWeight": 300, "pieceGradient": ["#3D2B1F", "#261A11"], "linenOpacity": 0.022, "cutCorner": True}},
    {"id": "luxury_glass_warm", "name": "Luxury Glass Quente", "family": "framed", "nativeContainer": "#0D1B2A", "font": "Inter",
     "tokens": {"bg": "rgba(13,27,42,0.97)", "ink": "#EDE6F5", "accent": "#C4956A", "accent2": "#7C5FC0",
                "border": "rgba(196,149,106,0.22)", "radius": 16, "titleWeight": 200, "hairline": ["#C4956A", "#7C5FC0"]}},
]
PRESET_DOC_BY_SKIN = {"atelier": "01_atelier.md", "spread": "02_spread.md", "index": "03_index.md", "trading": "04_trading.md",
                      "fai_max": "05_fai_max.md", "stub": "06_stub.md", "specimen": "07_specimen.md",
                      "editorial_ivory": "09_editorial_ivory_paper.md", "show_notes": "10_show_notes.md",
                      "atelier_terracotta": "11_atelier_terracota.md", "luxury_glass_warm": "12_luxury_glass_quente.md"}
PIECE_CONTEXT = "single garment product framing, one clothing item centered as hero subject, isolated product-shot styling"
SCHEME_CONTEXT = ("full outfit editorial framing, complete look composition with multiple garment pieces styled together, "
                  "head-to-toe styling context")

# RF4 — imagem padrão da peça quando o usuário deixa a foto vazia (/public/assets_pecas).
DEFAULT_PIECE_FOLDERS = ["assets_pecas", "assets_peças", "assets_pecas_default"]
PIECE_CATEGORIES = {
    "upper_piece": ["t_shirt", "shirt", "blouse", "tank_top", "crop_top", "polo_shirt", "bodysuit", "sweater", "sweatshirt",
                    "hoodie", "cardigan", "vest", "blazer", "jacket", "coat", "parka", "windbreaker", "kimono"],
    "lower_piece": ["jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants",
                    "leggings", "culottes", "shorts", "bermuda_shorts", "denim_shorts", "skirt", "skort"],
    "shoes_piece": ["casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "skate_shoes",
                    "high_top_sneakers", "loafers", "moccasins", "oxford_shoes", "derby_shoes", "ankle_boots", "long_boots",
                    "combat_boots", "sandals", "flip_flops", "heels", "flats", "espadrilles"],
    "accessory_piece": ["handbag", "crossbody_bag", "tote_bag", "clutch", "backpack", "belt", "cap", "hat", "beanie", "scarf",
                        "tie", "bow_tie", "sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch",
                        "gloves", "socks", "hair_accessory"],
    "full_body_piece": ["dress", "jumpsuit", "romper", "matching_set", "overalls"],
}
CATEGORY_ALIASES = {"upper_piece": ["parte_cima", "parte_de_cima", "top", "tops", "upper", "camiseta", "blusa"],
                    "lower_piece": ["parte_baixo", "parte_de_baixo", "bottom", "bottoms", "lower", "calca", "calcas"],
                    "shoes_piece": ["tenis", "calcado", "calcados", "shoes", "sapato", "sapatos"],
                    "accessory_piece": ["acessorio", "acessorios", "accessory", "accessories"],
                    "full_body_piece": ["corpo_inteiro", "vestido", "full_body", "macacao"]}
# Pastas numeradas de /public/assets_pecas → categoria da taxonomia; "06_Variacao_inicial" = imagem genérica.
PIECE_FOLDER_CATEGORY = {"parte_superior": "upper_piece", "parte_inferior": "lower_piece", "calcados": "shoes_piece",
                         "acessorios": "accessory_piece", "corpo_inteiro": "full_body_piece", "variacao_inicial": "generic"}
# Nomes dos arquivos (sem o prefixo numérico) → subcategoria. Cobre os nomes bilíngues e os em português.
PIECE_FILE_ALIASES = {
    "camiseta_referencia": "t_shirt", "shirt_camisa": "shirt", "blouse_blusa": "blouse", "tank_top_regata": "tank_top",
    "crop_top_cropped": "crop_top", "polo_shirt_camisa_polo": "polo_shirt", "bodysuit_body": "bodysuit",
    "sweater_sueter": "sweater", "sweatshirt_moletom_sem_capuz": "sweatshirt", "hoodie_moletom_com_capuz": "hoodie",
    "cardigan": "cardigan", "vest_colete": "vest", "blazer": "blazer", "jacket_jaqueta": "jacket", "coat_casaco": "coat",
    "parka": "parka", "windbreaker_corta_vento": "windbreaker", "kimono_quimono": "kimono",
    "jeans": "jeans", "calca_casual": "casual_pants", "calca_alfaiataria": "tailored_pants", "calca_cargo": "cargo_pants",
    "calca_chino": "chino_pants", "calca_moletom": "sweatpants", "calca_jogger": "jogger_pants", "legging": "leggings",
    "pantacourt": "culottes", "bermuda": "bermuda_shorts", "shorts_jeans": "denim_shorts", "saia": "skirt",
    "shorts": "shorts", "short_saia": "skort",
    "tenis_casual": "casual_sneakers", "tenis_corrida": "running_shoes", "tenis_treino": "training_shoes",
    "tenis_skate": "skate_shoes", "loafer": "loafers", "tenis_cano_alto": "high_top_sneakers",
    "tenis_basquete": "basketball_shoes", "mocassim": "moccasins", "oxford": "oxford_shoes", "derby": "derby_shoes",
    "bota_cano_curto": "ankle_boots", "bota_cano_longo": "long_boots", "sandalia": "sandals", "coturno": "combat_boots",
    "chinelo": "flip_flops", "salto_alto": "heels", "sapatilha": "flats", "alpargata": "espadrilles",
    "bolsa_transversal": "crossbody_bag", "bolsa_mao": "handbag", "clutch": "clutch", "tote": "tote_bag",
    "mochila": "backpack", "cinto": "belt", "bone": "cap", "chapeu": "hat", "gorro": "beanie", "cachecol": "scarf",
    "gravata": "tie", "gravata_borboleta": "bow_tie", "oculos_sol": "sunglasses", "oculos_grau": "eyeglasses",
    "colar": "necklace", "pulseira": "bracelet", "brincos": "earrings", "anel": "ring", "relogio": "watch",
    "luvas": "gloves", "meias": "socks", "acessorio_cabelo": "hair_accessory",
    "vestido": "dress", "macacao": "jumpsuit", "macaquinho": "romper", "conjunto_coordenado": "matching_set",
    "jardineira": "overalls",
}

SILHOUETTES = {
    "upper_piece": "M60 40 L100 22 Q120 36 140 22 L180 40 L200 90 L172 100 L168 78 L168 200 L72 200 L72 78 L68 100 L40 90 Z",
    "lower_piece": "M72 24 L168 24 L176 216 L130 216 L122 90 L118 90 L110 216 L64 216 Z",
    "shoes_piece": "M40 150 Q44 110 84 108 L120 104 Q150 120 176 128 Q204 136 204 160 L204 170 L40 170 Z",
    "accessory_piece": "M70 90 Q70 50 120 50 Q170 50 170 90 L186 90 L194 200 L46 200 L54 90 Z M88 90 Q88 66 120 66 Q152 66 152 90 Z",
    "full_body_piece": "M92 22 L148 22 L156 70 L190 216 L50 216 L84 70 Z",
    "generic": "M60 40 L100 22 Q120 36 140 22 L180 40 L200 90 L172 100 L168 78 L168 200 L72 200 L72 78 L68 100 L40 90 Z",
}

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


def md_block(text: str, heading: str) -> str | None:
    """Primeiro bloco ``` depois do cabeçalho indicado (prompts dos presets recomendados)."""
    idx = text.find(heading)
    if idx < 0:
        return None
    m = re.search(r"```\n?(.*?)```", text[idx:], re.S)
    return m.group(1).strip() if m else None


def md_field(text: str, label: str) -> str | None:
    m = re.search(r"\*\*" + re.escape(label) + r":\*\*\s*`?([^`|\n]+)`?", text)
    return m.group(1).strip().strip('"“”') if m else None


def build_skins() -> dict:
    folder = PUBLIC / "presets_recomendados"
    negative = None
    notes = {}
    if (folder / "08_negativo_e_geracao_tecnica.md").is_file():
        negative = md_block((folder / "08_negativo_e_geracao_tecnica.md").read_text(encoding="utf-8"), "## Prompt negativo")
    fmt = None
    if (folder / "00_dimensoes_e_metodologia.md").is_file():
        fmt = md_block((folder / "00_dimensoes_e_metodologia.md").read_text(encoding="utf-8"), "## Fragmento de formato")
    skins = []
    for base in CARD_SKINS:
        skin = dict(base)
        doc = folder / PRESET_DOC_BY_SKIN[base["id"]]
        text = doc.read_text(encoding="utf-8") if doc.is_file() else ""
        title = re.search(r"^# Preset — (.+)$", text, re.M)
        skin["doc"] = url_of(doc) if doc.is_file() else None
        skin["displayName"] = title.group(1).split(" (")[0].strip() if title else base["name"]
        skin["component"] = md_field(text, "Componente")
        skin["thumbHint"] = md_field(text, "thumbHint atual")
        candidate = "ID candidato" in text
        skin["status"] = "candidate" if candidate else "implemented"
        skin["styleFragment"] = md_block(text, "## Fragmento de estilo")
        final = md_block(text, "## Prompt final")
        if not final and skin["styleFragment"]:
            final = ", ".join([skin["styleFragment"], SCHEME_CONTEXT, fmt or ""]).strip(", ")
        if candidate and skin["styleFragment"] and skin["styleFragment"].startswith("Fundo"):
            # 10–12 descrevem o visual em prosa; o prompt final pronto está no bloco "Prompt final".
            skin["visualDescription"] = skin["styleFragment"]
        skin["thumbnailPrompt"] = {"scheme": final, "piece": final.replace(SCHEME_CONTEXT, PIECE_CONTEXT) if final else None}
        skin["negativePrompt"] = negative
        skin["thumbnail"] = None
        for ext in (".webp", ".png", ".jpg"):
            f = folder / f"{base['id']}{ext}"
            if f.is_file():
                skin["thumbnail"] = url_of(f)
        skin["thumbnailSpec"] = {"aspect": "220:566", "ratio": 0.389, "variant": "Lista vertical — Ampliado",
                                 "generation": "gerar em retrato (~0,67:1) e recortar ao centro para 0,39:1",
                                 "fallback": "live-css-miniature" if skin["thumbnail"] is None else "asset"}
        collision = re.search(r"(Colisão de nome[^\n]*|Aviso de nomenclatura[^\n]*)", text)
        skin["namingNote"] = collision.group(1).strip("*> ") if collision and "nenhuma" not in collision.group(1).lower() else None
        skins.append(skin)
    return {"skins": skins, "negativePrompt": negative, "formatFragment": fmt,
            "contextFragments": {"scheme": SCHEME_CONTEXT, "piece": PIECE_CONTEXT},
            "source": "/presets_recomendados"}


def build_default_pieces(d) -> dict:
    """RF4 — imagem padrão por subcategoria → categoria → genérica. Sem arquivos, gera silhuetas SVG."""
    folder = next((PUBLIC / n for n in DEFAULT_PIECE_FOLDERS if (PUBLIC / n).is_dir()), None)
    files = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT | {".svg"}) if folder else []
    by_sub, by_cat, generic, unmatched, duplicates = {}, {}, None, [], []
    sub_to_cat = {sub: cat for cat, subs in PIECE_CATEGORIES.items() for sub in subs}
    hashes = {}
    # arquivos dentro das pastas por categoria têm prioridade sobre cópias soltas na raiz
    files.sort(key=lambda f: (f.parent == folder, str(f)))
    for f in files:
        digest = sha256(f)
        if digest in hashes:
            duplicates.append({"file": url_of(f), "sameAs": hashes[digest]})
            continue
        hashes[digest] = url_of(f)
        key = re.sub(r"^\d+_", "", slug(f.stem))
        folder_key = re.sub(r"^\d+_", "", slug(f.parent.name)) if f.parent != folder else None
        entry = {"url": url_of(f), "file": f.name,
                 "previewUrl": d.image(f, DERIVED / "pecas_default" / f"{slug(f.parent.name)}_{slug(f.stem)}_preview.webp", 360, 80)
                 if f.suffix.lower() != ".svg" else url_of(f)}
        folder_cat = PIECE_FOLDER_CATEGORY.get(folder_key) if folder_key else None
        if folder_cat == "generic":
            generic = generic or entry
            continue
        sub = PIECE_FILE_ALIASES.get(key) or next((s2 for s2 in sub_to_cat if key == s2 or key.startswith(s2 + "_")
                                                   or key.endswith("_" + s2)), None)
        if sub:
            cat = sub_to_cat[sub]
            if folder_cat and folder_cat != cat:
                unmatched.append({"file": url_of(f), "reason": f"pasta indica {folder_cat}, nome indica {cat}"})
            by_sub.setdefault(sub, {**entry, "category": cat})
            continue
        cat = folder_cat or next((c for c, al in CATEGORY_ALIASES.items() if key == c or key in al), None)
        if cat:
            by_cat.setdefault(cat, entry)
        elif key in ("default", "generic", "generica", "padrao", "peca", "placeholder"):
            generic = entry
        else:
            unmatched.append({"file": url_of(f), "reason": "nome não mapeado para subcategoria"})
    # categoria sem imagem própria usa a primeira subcategoria dela (ex.: camiseta para parte de cima)
    for cat, subs in PIECE_CATEGORIES.items():
        first = next((by_sub[s2] for s2 in subs if s2 in by_sub), None)
        if first and cat not in by_cat:
            by_cat[cat] = {k: v for k, v in first.items() if k != "category"}
    missing_subs = [s2 for s2 in sub_to_cat if s2 not in by_sub]
    generated = {}
    out_dir = DERIVED / "pecas_default"
    out_dir.mkdir(parents=True, exist_ok=True)
    for cat, path in SILHOUETTES.items():
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="480" height="480">'
               f'<rect width="240" height="240" rx="24" fill="#F4F1EC"/><path d="{path}" fill="#D8D1C7" stroke="#A89F93" '
               f'stroke-width="3" stroke-linejoin="round"/><text x="120" y="232" font-family="Inter,Arial" font-size="11" '
               f'fill="#8A8176" text-anchor="middle">Fashion AI · sem foto</text></svg>')
        target = out_dir / f"{cat}.svg"
        target.write_text(svg, encoding="utf-8")
        generated[cat] = url_of(target)
    for cat in PIECE_CATEGORIES:
        by_cat.setdefault(cat, {"url": generated[cat], "previewUrl": generated[cat], "generated": True})
    return {"folder": ("/" + folder.name) if folder else None, "acceptedFolderNames": DEFAULT_PIECE_FOLDERS,
            "found": len(files), "mapped": len(by_sub), "duplicatesIgnored": duplicates, "missingSubcategories": missing_subs,
            "bySubcategory": by_sub, "byCategory": by_cat,
            "generic": generic or {"url": generated["generic"], "previewUrl": generated["generic"], "generated": True},
            "unmatchedFiles": unmatched,
            "resolution": "subcategoria → categoria → genérica; sem arquivo em /public/assets_pecas usa silhueta gerada",
            "naming": "<subcategoria>.png (ex.: t_shirt.png) ou <categoria>.png (ex.: upper_piece.png / parte_cima.png)"}


def build(derived_enabled: bool) -> dict:
    d = Deriver(derived_enabled)
    missing: list[dict] = []
    categories = []
    public_root = PUBLIC.resolve()

    def public_asset(url: object) -> Path | None:
        if not isinstance(url, str) or not url.startswith("/"):
            return None
        path = (PUBLIC / url.lstrip("/")).resolve()
        return path if path.is_relative_to(public_root) else None

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
        s = mat_static.get(m["id"]) or mat_static.get(m.get("folder", ""))
        if s:
            entry["static"] = {"url": url_of(s),
                               "previewUrl": d.image(s, DERIVED / "material" / f"{m['id']}_preview.webp", 360, 78),
                               "cardUrl": d.image(s, DERIVED / "material" / f"{m['id']}_card.webp", 900, 80),
                               **d.image_info(s)}
        else:
            entry["static"] = None
            missing.append({"category": "material_static", "id": m["id"], "expected": f"/material_no_GIF/{m['id']}/{m['id']}.jpg"})
        a = mat_anim.get(m["id"]) or mat_anim.get(m.get("folder", ""))
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
    presets = {p["id"]: {**p, "negativePrompt": AURA_NEGATIVE, "variants": []} for p in AURA_PRESETS}
    variants_flat = []
    extras = sorted(v for v in aura_static if v not in AURA_VARIANT_ORDER)
    rows = [(code, vid, pid, desc) for code, vid, pid, desc in AURA_VARIANTS] + \
           [(None, vid, vid.partition("__")[0], "variante estática extra (sem código P no catálogo P×M)") for vid in extras]
    for idx, (code, variant, preset_id, desc) in enumerate(rows, start=1):
        preset = presets.get(preset_id)
        if preset is None:
            continue
        theme = variant.partition("__")[2]
        v = {"id": variant, "presetId": preset_id, "theme": theme.replace("_", " "), "description": desc,
             "index": idx, "code": code}
        s_file = aura_static.get(variant)
        if s_file:
            v["static"] = {"url": url_of(s_file),
                           "previewUrl": d.image(s_file, DERIVED / "aura" / f"{variant}_preview.webp", 360, 78),
                           "cardUrl": d.image(s_file, DERIVED / "aura" / f"{variant}_card.webp", 900, 80),
                           **d.image_info(s_file)}
        else:
            v["static"] = None
            v["staticFallback"] = {"strategy": "poster-do-video-PxM", "note": "sem arquivo em /aura_sem_GIF; usa o pôster "
                                   "do asset imagem única " + (code or "") + "_M01"}
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

    # ---------------- Aura Electro (PNG + GIF próprio por variante) ----------------
    electro_catalog = PUBLIC / "aura" / "electro" / "catalogo.json"
    if electro_catalog.is_file() and "aura_electro" in presets:
        electro = json.loads(electro_catalog.read_text(encoding="utf-8"))
        preset = presets["aura_electro"]
        asset_by_id = {item["id"]: item for item in electro.get("assets", [])}
        variant_by_id = {slug(item["name"]): item for item in electro.get("variants", [])}
        for idx, (asset_id, asset) in enumerate(sorted(asset_by_id.items()), start=1):
            variant_info = variant_by_id.get(asset_id, {})
            variant_id = f"aura_electro__{asset_id}"
            theme = re.sub(r"^\d+_", "", asset_id).replace("_", " ")
            v = {"id": variant_id, "presetId": "aura_electro", "theme": theme, "code": f"E{idx:02d}",
                 "description": f"Aura Electro · movimento {variant_info.get('movement', 'dinâmico')}",
                 "index": len(variants_flat) + 1, "palette": variant_info.get("colors", [])}
            static_file = public_asset(asset.get("image"))
            animated_file = public_asset(asset.get("gif"))
            if static_file and static_file.is_file():
                v["static"] = {"url": url_of(static_file),
                               "previewUrl": d.image(static_file, DERIVED / "aura" / f"{variant_id}_preview.webp", 360, 78) or url_of(static_file),
                               "cardUrl": d.image(static_file, DERIVED / "aura" / f"{variant_id}_card.webp", 900, 80) or url_of(static_file),
                               **d.image_info(static_file)}
            else:
                v["static"] = None
                missing.append({"category": "aura_static", "id": variant_id, "expected": asset.get("image")})
            if animated_file and animated_file.is_file():
                v["animated"] = {"url": url_of(animated_file), "mime": "image/gif", "durationS": 10,
                                 "posterUrl": (v.get("static") or {}).get("previewUrl"), **d.image_info(animated_file)}
            else:
                v["animated"] = None
                missing.append({"category": "aura_animated", "id": variant_id, "expected": asset.get("gif")})
            preset["variants"].append(v)
            variants_flat.append(v)

    # ---------------- Aura Geometry (PNG + GIF próprio por variante) ----------------
    geometry_dir = PUBLIC / "aura" / "geometry"
    geometry_sources = [geometry_dir / "catalogo-completo.json", *sorted(geometry_dir.glob("catalogo-parte-*.json"))]
    geometry_assets: dict[str, dict] = {}
    for source in geometry_sources:
        if not source.is_file():
            continue
        data = json.loads(source.read_text(encoding="utf-8"))
        entries = data.get("assets", []) if isinstance(data, dict) else data
        if isinstance(entries, list):
            for asset in entries:
                if isinstance(asset, dict) and isinstance(asset.get("id"), str):
                    geometry_assets.setdefault(asset["id"], asset)
    preset = presets.get("aura_geometry")
    if preset:
        for asset_id, asset in sorted(geometry_assets.items()):
            static_file = public_asset(asset.get("image"))
            animated_file = public_asset(asset.get("gif"))
            has_static = static_file is not None and static_file.is_file()
            has_animated = animated_file is not None and animated_file.is_file()
            if not (has_static or has_animated):
                continue
            collection = slug(str(asset.get("collection") or "geometry"))
            asset_name = asset_id.removeprefix(collection + "_")
            match = re.fullmatch(r"([ap])(\d{3})(?:_(.+))?", asset_name)
            if match and collection == "grafica":
                letter, number, suffix = match.groups()
                theme = f"{letter}{number}".upper()
                code = f"G{number}" if letter == "a" else None
                if suffix:
                    theme = f"{theme} {suffix.replace('_', ' ')}"
            elif match:
                letter, number, suffix = match.groups()
                theme = (suffix or f"{letter}{number}").replace("_", " ").title()
                code = f"D{number}" if collection == "gradientes" else f"{letter.upper()}{number}"
            else:
                theme, code = asset_name.replace("_", " ").title(), None
            variant_id = f"aura_geometry__{slug(asset_id)}"
            v = {"id": variant_id, "presetId": "aura_geometry", "theme": theme, "code": code,
                 "collection": collection, "partial": bool(asset.get("partial")),
                 "description": f"Aura Geometry · {collection} {theme}", "index": len(variants_flat) + 1}
            if has_static:
                v["static"] = {"url": url_of(static_file),
                               "previewUrl": d.image(static_file, DERIVED / "aura" / f"{variant_id}_preview.webp", 360, 78)
                               or url_of(static_file),
                               "cardUrl": d.image(static_file, DERIVED / "aura" / f"{variant_id}_card.webp", 900, 80)
                               or url_of(static_file),
                               **d.image_info(static_file)}
            else:
                v["static"] = None
                missing.append({"category": "aura_static", "id": variant_id, "expected": asset.get("image")})
            if has_animated:
                v["animated"] = {"url": url_of(animated_file), "mime": "image/gif", "durationS": 10,
                                 "posterUrl": (v.get("static") or {}).get("previewUrl"), **d.image_info(animated_file)}
            else:
                v["animated"] = None
                missing.append({"category": "aura_animated", "id": variant_id, "expected": asset.get("gif")})
            preset["variants"].append(v)
            variants_flat.append(v)

    # ---------------- Combinações aura × material ----------------
    def combo_items(key: str, exts: set[str]) -> list[dict]:
        folder = find_folder(key)
        items = []
        for p in media_files(folder, exts):
            stem = p.stem
            mm = re.match(r"^P(\d{2})_M(\d{2})(?:\s*-\s*(.+?)\s+GIF\s*\+\s*(.+))?$", unicodedata.normalize("NFC", stem))
            aura_v = mat_id = None
            label = None
            if mm and mm.group(3):
                label = {"aura": mm.group(3).strip(), "material": mm.group(4).strip()}
            if mm:
                pi, mi = int(mm.group(1)), int(mm.group(2))
                vcode = f"P{pi:02d}"
                match = next((v for v in variants_flat if v.get("code") == vcode), None)
                if match and 1 <= mi <= len(MATERIALS):
                    aura_v, mat_id = match["id"], MATERIALS[mi - 1]["id"]
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
                    "format": "MOSAICO" if "mosaic" in key else "IMAGEM_UNICA",
                    "code": next((f"{v['code']}_{mt['code']}" for v in variants_flat if v["id"] == aura_v and v.get("code")
                                  for mt in materials if mt["id"] == mat_id), None)}
            if label:
                preset_name = next((pr["name"] for pr in AURA_PRESETS if aura_v and aura_v.startswith(pr["id"] + "__")), None)
                item["label"] = label
                item["labelConflict"] = preset_name is not None and preset_name.lower() != label["aura"].lower()
                if item["labelConflict"]:
                    item["labelNote"] = (f"nome do arquivo diz '{label['aura']}', o índice oficial P##→variante "
                                         f"(indice_de_correspondencia.csv) diz '{preset_name}'")
            if p.suffix.lower() in VIDEO_EXT:
                code = item["code"] or stem[:7]
                item["posterUrl"] = d.poster(p, DERIVED / key / f"{code}_poster.jpg")
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

    # P09/P10: sem estático próprio → pôster do asset imagem única Pxx_M01 como quadro estático
    for v in variants_flat:
        if v["static"] is None and v.get("code"):
            poster = next((c.get("posterUrl") for c in combos["animated"] if (c.get("code") or "").startswith(v["code"] + "_M01")), None)
            if poster:
                v["staticFallback"]["posterUrl"] = poster
    skins = build_skins()
    default_pieces = build_default_pieces(d)
    counts = {
        "material_static": sum(1 for m in materials if m["static"]),
        "material_animated": sum(1 for m in materials if m["animated"]),
        "aura_static": sum(1 for v in variants_flat if v["static"]),
        "aura_animated": sum(1 for v in variants_flat if v["animated"]),
        "aura_material_static": len(combos["static"]),
        "aura_material_animated": len(combos["animated"]),
        "aura_material_mosaic_animated": len(combos["mosaic"]),
    }
    expected_aura_variants = len(AURA_VARIANTS)
    if electro_catalog.is_file():
        expected_aura_variants += len(json.loads(electro_catalog.read_text(encoding="utf-8")).get("assets", []))
    expected_aura_variants += len(geometry_assets)
    for key, (label, expected, fallback) in CATEGORY_META.items():
        if key in ("aura_static", "aura_animated"):
            expected = expected_aura_variants
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
        "cardSkins": skins["skins"],
        "skinGeneration": {k: v for k, v in skins.items() if k != "skins"},
        "defaultPieceImages": default_pieces,
        "pCodeConflicts": sorted({c["code"].split("_")[0] + ": arquivo='" + c["label"]["aura"] + "' índice='" +
                                  c["labelNote"].split("diz '")[-1].rstrip("'") + "'"
                                  for c in combos["animated"] if c.get("labelConflict")}),
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
