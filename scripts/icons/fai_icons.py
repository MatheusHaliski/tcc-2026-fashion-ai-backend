#!/usr/bin/env python3
"""Catálogo de ícones FAI (documento "FashionAI — Prompts de Assets de Ícones", 23/09/2026).

Todo asset é o logo FAI (medalha) com um objeto diferente no centro. Este script é a
fonte única do inventário (77 IDs: 15 SOC, 16 NAV, 46 ACT) e gera:

  lib/icons/fai-icons.json                      -> catálogo lido pelo frontend (FaiIcon)
  fai-web/src/main/resources/catalog/fai-icons.json -> exposto pela API (/api/assets/icons)
  docs/icones/prompts_icones.csv                -> um prompt por (id, estado, variante)

Uso:
  python3 scripts/icons/fai_icons.py            # gera catálogo + prompts
  python3 scripts/icons/fai_icons.py export DIR # recorta fundo branco e exporta 512/96/48/24 px
                                                #   DIR contém {id}-{estado}.png (1024 px) e,
                                                #   opcionalmente, {id}-{estado}-nomesh.png (24 px)
                                                #   e {id}-{estado}-halfmesh.png (48 px)
"""
import csv
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

MASTER_PROMPT = (
    "A circular app icon badge in soft 3D clay-render style, front view, centered, on a pure white background. "
    "Outer ring: a thick dark espresso-brown disc (#2A211C) with a subtly beveled rim. "
    "{MESH} "
    "Behind the mesh, a vibrant orange halo (#F57C1F) surrounds a smooth matte cream medallion (#F5EBD7) in the center. "
    "On the medallion: {OBJETO}, rendered as a single chunky matte-black object (#1E1B18) with rounded edges, "
    "soft studio lighting from the top-left, a short soft shadow on the cream medallion.{ACCENT} "
    "{TEXTO} "
    "Flat composition, no perspective tilt, no extra objects, no background scene, no watermark, "
    "crisp edges, high detail, 1024x1024."
)
MESH_FULL = ("On the disc: a network mesh of thin cream-colored threads forming triangles, connecting round glossy nodes "
             "in yellow, orange, green, blue and brown, larger nodes near the outer edge, smaller near the center.")
MESH_HALF = ("On the disc: a sparse network mesh of thin cream-colored threads with half the usual number of round glossy "
             "nodes in yellow, orange, green, blue and brown, larger nodes near the outer edge.")
MESH_NONE = "The dark disc is plain, no network mesh, no nodes."
TEXT_BUTTON = "No text, no letters, no numbers anywhere."
TEXT_LOGO = 'The white bold sans-serif letters "FAI" sit on the object.'
ACCENT_ACTIVE = " With accent details in bright orange (#F57C1F): {ACCENT}."
NEGATIVE = ("text, letters, watermark, logo of real brands, photorealistic person, face, hands, gradient background, "
            "perspective, multiple objects, clutter, blur")

SIZES = [
    {"px": 512, "use": "estados vazios, onboarding, telas de conquista", "variant": "full", "adjust": "original reduzido"},
    {"px": 96, "use": "cards, painéis, botões grandes do Smart Mirror", "variant": "full", "adjust": "original reduzido"},
    {"px": 48, "use": "barra lateral expandida, rodapé social", "variant": "halfmesh", "adjust": "malha com metade dos nós"},
    {"px": 24, "use": "barra recolhida, contadores, toggles", "variant": "nomesh", "adjust": "sem malha: só disco, halo, medalhão e objeto"},
]
STATES = {
    "normal": "o asset como gerado",
    "ativo": "gerado de novo com acento laranja (#F57C1F) conforme a coluna 'Estado ativo'",
    "hover": "feito pelo app: brilho +8% e anel de foco de 2 px (não é arquivo)",
    "desabilitado": "feito pelo app: 40% de saturação e 50% de opacidade (não é arquivo)",
}
PALETTE = {"disc": "#2A211C", "halo": "#F57C1F", "medallion": "#F5EBD7", "object": "#1E1B18", "mesh": "#F5EBD7",
           "nodes": ["#F2C230", "#F57C1F", "#5FA35A", "#3B7BC8", "#8A5A3C"]}

# (id, rf, rótulo pt, rótulo en, rótulo es, objeto (prompt), estado ativo pt, acento en (None = estado único), glifo, rota/ação, ia)
SOC = [
    ("SOC-01", "RF7", "Curtir", "Like", "Me gusta", "a puffy heart made of quilted leather, like a quilted handbag panel, with visible diamond stitching", "coração com costura laranja", "orange stitching on the heart", "heart", "like", False),
    ("SOC-02", "RF7", "Comentar", "Comment", "Comentar", "a speech bubble shaped like a sewn-in clothing label, with a stitched border and a tiny tail", "etiqueta com três pontos laranja", "three orange dots on the label", "bubble", "comment", False),
    ("SOC-03", "RF7", "Compartilhar", "Share", "Compartir", "a paper airplane folded from a clothing swing tag, with the tag's round eyelet hole visible", "rastro curto laranja atrás do avião", "a short orange trail behind the airplane", "plane", "share", False),
    ("SOC-04", "RF7", "Remixar", "Remix", "Remezclar", "two clothes hangers whose hooks curve into each other forming a circular loop of two arrows", "ganchos laranja", "orange hooks", "remix", "remix", False),
    ("SOC-05", "RF7", "Salvar", "Save", "Guardar", "a zipped garment bag hanging from a hanger, with a small bookmark ribbon on its side", "fita laranja", "an orange bookmark ribbon", "garmentbag", "save", False),
    ("SOC-06", "RF31", "Favoritar", "Favorite", "Favorito", "a five-pointed star-shaped brooch with a small pin on the back", "estrela preenchida laranja", "the star filled in orange", "star", "favorite", False),
    ("SOC-07", "RF19", "Reação Trend", "Trend reaction", "Reacción Tendencia", "an upward zigzag arrow made of a metal zipper, the zipper pull at the arrow tip", "puxador laranja", "an orange zipper pull", "zigzag", "react:TREND", False),
    ("SOC-08", "RF19", "Reação Elegante", "Elegant reaction", "Reacción Elegante", "a satin bow tie with soft folds", "nó central laranja", "an orange center knot", "bowtie", "react:ELEGANT", False),
    ("SOC-09", "RF19", "Reação Criativo", "Creative reaction", "Reacción Creativo", "a spool of thread with a sewing needle, the loose thread forming a small spark shape", "faísca laranja", "an orange spark", "spool", "react:CREATIVE", False),
    ("SOC-10", "RF7", "Retornar (abrir esquema de origem)", "Back to origin look", "Volver al look de origen", "a clothes hanger whose hook bends backward into a curved return arrow", "seta laranja", "an orange arrow", "hangerback", "return", False),
    ("SOC-11", "RF7", "Editar (só o dono)", "Edit (owner only)", "Editar (solo el dueño)", "a triangular tailor's chalk crossed over a short rolled measuring tape", "fita métrica laranja", "an orange measuring tape", "chalk", "edit", False),
    ("SOC-12", "RF17", "Seguir / Deixar de seguir", "Follow / Unfollow", "Seguir / Dejar de seguir", "a large safety pin bent into a plus sign", "alfinete fechado em check, laranja", "the safety pin closed into an orange check mark", "pin", "follow", False),
    ("SOC-13", "RF7", "Excluir comentário", "Delete comment", "Eliminar comentario", "a pair of tailor's scissors cutting a small fabric label in half", "estado único (ação destrutiva, sem ativo)", None, "scissors", "deleteComment", False),
    ("SOC-14", "RF31", "Disponível", "Available", "Disponible", "a clothes hanger with a small round tag showing a check mark shape", "tag laranja", "an orange tag", "hangercheck", "available", False),
    ("SOC-15", "RF31", "Indisponível", "Unavailable", "No disponible", "a woven laundry basket with a folded shirt on top", "estado único", None, "basket", "unavailable", False),
]
NAV = [
    ("NAV-01", "RF9", "Dashboard", "Dashboard", "Panel", "a small dress form mannequin bust with a round gauge dial on its chest", "resumo e sugestões da IA sobre o seu estilo", "an orange gauge needle", "bustgauge", "/home", False),
    ("NAV-02", "RF4", "Guarda-Roupa", "Wardrobe", "Armario", "a two-door wardrobe with one door slightly open showing hangers inside", "o próprio acervo", "orange hangers inside", "wardrobe", "/my-wardrobe", False),
    ("NAV-03", "RF5", "Criar Look", "Create Look", "Crear Look", "a dress form mannequin with a small four-point sparkle above its shoulder", "montar um look novo", "an orange sparkle", "bustsparkle", "/create-my-scheme", True),
    ("NAV-04", "RF6", "Looks Salvos", "Saved Looks", "Looks guardados", "three garment bags hanging side by side on a short rail", "coleção de looks guardados", "an orange rail", "garmentbags", "/explore-scheme", False),
    ("NAV-05", "RF7", "The Runway", "The Runway", "The Runway", "a high-heeled shoe standing at the end of a short catwalk under a spotlight cone", "feed social = passarela", "an orange spotlight cone", "heel", "/feed", False),
    ("NAV-06", "RF6", "Autopiloto", "Autopilot", "Piloto automático", "a clothes hanger whose hook is a small round clock face", "looks diários e planejamento semanal", "orange clock hands", "hangerclock", "/autopilot", False),
    ("NAV-07", "RF18", "Provador 2D", "2D Fitting Room", "Probador 2D", "a fitting room booth with a half-drawn curtain", "provar peças no manequim", "an orange curtain", "booth", "/dress-tester", False),
    ("NAV-08", "RF8", "Peças Públicas", "Public Pieces", "Piezas públicas", "an open clothing rack with several hangers holding different garments", "vitrine de peças de outros criadores", "an orange rack bar", "rack", "/search-pieces", False),
    ("NAV-09", "RF8", "Buscar", "Search", "Buscar", "a magnifying glass whose lens is a large four-hole sewing button", "encontrar usuários e looks", "an orange lens rim", "search", "/search-items", False),
    ("NAV-10", "RF12", "Minhas Fotos", "My Photos", "Mis fotos", "an instant camera ejecting a small photo with a t-shirt silhouette on it", "galeria de fotos de peças e looks (RF12)", "an orange photo border", "camera", "/my-photos", False),
    ("NAV-11", "RF14", "Marcas", "Brands", "Marcas", "a blank luxury clothing brand label with a small diamond shape stitched in the center", "perfis de marca, sem imitar nenhuma marca real", "an orange stitched diamond", "label", "/maison", False),
    ("NAV-12", "RF22", "Art Celebrity", "Art Celebrity", "Art Celebrity", "a five-pointed star on a short red carpet runner", "looks de celebridades, sem rosto nem pessoa", "an orange star", "starcarpet", "/art-celebrity", False),
    ("NAV-13", "RF16", "Temas Futuros", "Future Topics", "Temas futuros", "a small telescope whose barrel is a spool of thread", "funcionalidades que vêm por aí", "an orange lens", "telescope", "/future-topics", False),
    ("NAV-14", "RF23", "Configurações", "Settings", "Configuración", "a gear wheel with a four-hole sewing button at its center", "preferências e privacidade", "an orange button", "gear", "/profile/settings", False),
    ("NAV-15", "RF6", "Perfil Lookbook", "Lookbook Profile", "Perfil Lookbook", "an open lookbook magazine with a round blank avatar cutout on the left page", "a vitrine pessoal: closet digital e looks salvos (RF6)", "an orange avatar ring", "lookbook", "/profile", False),
    ("NAV-16", "RF32", "Meu Quarto", "My Room", "Mi cuarto", "a wardrobe next to a tall standing mirror", "o guarda-roupa espacial com o Smart Mirror", "an orange mirror frame", "room", "/my-wardrobe/room", False),
]
ACT = [
    ("ACT-01", "RF1", "Criar conta", "Create account", "Crear cuenta", "a blank clothing name tag with a small plus sign stitched on it", "ativo", "an orange plus sign", "tagplus", "signup", False),
    ("ACT-02", "RF2", "Entrar", "Sign in", "Entrar", "a vintage key with a clothing swing tag tied to its bow", "ativo", "an orange swing tag", "key", "signin", False),
    ("ACT-03", "RF3", "Notificações", "Notifications", "Notificaciones", "a small bell hanging from a clothes hanger hook", "ativo", "an orange bell clapper", "bell", "notifications", False),
    ("ACT-04", "RF3", "Privacidade", "Privacy", "Privacidad", "a padlock shaped like a handbag clasp", "ativo", "an orange clasp", "padlock", "privacy", False),
    ("ACT-05", "RF3", "Sair", "Sign out", "Salir", "a half-open door with a coat hook on it", "estado único (disparo único)", None, "door", "signout", False),
    ("ACT-06", "RF4", "Adicionar peça", "Add piece", "Agregar prenda", "a clothes hanger with a round plus-sign tag", "ativo", "an orange plus tag", "hangerplus", "addPiece", False),
    ("ACT-07", "RF4", "Enviar foto", "Upload photo", "Subir foto", "a camera with a folded t-shirt resting on top", "ativo", "an orange lens ring", "camerashirt", "uploadPhoto", False),
    ("ACT-08", "RF4", "Detectar com IA", "Detect with AI", "Detectar con IA", "a folded shirt with a small four-point sparkle over its collar", "ativo", "an orange sparkle", "shirtsparkle", "detectAi", True),
    ("ACT-09", "RF5", "Gerar com IA", "Generate with AI", "Generar con IA", "a knitting needle used as a magic wand, with a tiny sparkle at its tip", "ativo", "an orange sparkle at the tip", "wand", "generateAi", True),
    ("ACT-10", "RF5", "Salvar esquema", "Save look", "Guardar look", "a look box: a flat gift box with a garment hanger printed on the lid", "ativo", "an orange hanger print", "lookbox", "saveScheme", False),
    ("ACT-11", "RF5", "Publicar no feed", "Publish to feed", "Publicar en el feed", "a small spotlight lamp pointing upward", "ativo", "an orange light beam", "spotlight", "publish", False),
    ("ACT-12", "RF8", "Filtrar", "Filter", "Filtrar", "a funnel shaped like an A-line skirt", "ativo", "an orange hem", "funnel", "filter", False),
    ("ACT-13", "RF10", "Abrir Copilot", "Open Copilot", "Abrir Copilot", "a dress form mannequin bust with a small speech bubble beside it, no face", "ativo", "an orange speech bubble", "bustbubble", "copilot", False),
    ("ACT-14", "RF11", "Abrir Background Studio", "Open Background Studio", "Abrir Background Studio", "a painter's palette whose paint wells are small fabric swatches", "ativo", "an orange swatch", "palette", "backgroundStudio", False),
    ("ACT-15", "RF11", "Gerar fundo com IA", "Generate background with AI", "Generar fondo con IA", "a small framed landscape canvas with a sparkle in its corner", "ativo", "an orange sparkle", "canvassparkle", "generateBackground", True),
    ("ACT-16", "RF11", "Enviar imagem de fundo", "Upload background image", "Subir imagen de fondo", "a picture frame with an upward arrow above it", "ativo", "an orange arrow", "frameup", "uploadBackground", False),
    ("ACT-17", "RF12", "Baixar foto", "Download photo", "Descargar foto", "a photo print sliding down into an open shopping bag", "estado único (disparo único)", None, "download", "downloadPhoto", False),
    ("ACT-18", "RF12", "Excluir em lote", "Delete selected", "Eliminar en lote", "a stack of three photo prints with tailor's scissors across them", "ativo", "orange scissor handles", "stackscissors", "bulkDelete", False),
    ("ACT-19", "RF13", "Abrir DNA de Estilo", "Open Style DNA", "Abrir ADN de estilo", "a double helix made of two twisted threads with small buttons as the rungs", "ativo", "orange buttons", "helix", "styleDna", False),
    ("ACT-20", "RF16", "Gerar 3D", "Generate 3D", "Generar 3D", "a wireframe cube with a small t-shirt inside it", "ativo", "an orange t-shirt", "cube", "generate3d", False),
    ("ACT-21", "RF16", "Reprocessar 3D", "Reprocess 3D", "Reprocesar 3D", "a wireframe cube with a circular arrow around it", "ativo", "an orange circular arrow", "cubearrow", "reprocess3d", False),
    ("ACT-22", "RF18", "Manequim masculino", "Male mannequin", "Maniquí masculino", "a male tailor's dress form with broad shoulders on a stand", "ativo", "an orange stand", "formmale", "mannequin:MALE", False),
    ("ACT-23", "RF18", "Manequim feminino", "Female mannequin", "Maniquí femenino", "a female tailor's dress form with a defined waist on a stand", "ativo", "an orange stand", "formfemale", "mannequin:FEMALE", False),
    ("ACT-24", "RF18", "Limpar manequim", "Clear mannequin", "Limpiar maniquí", "a lint roller", "estado único (disparo único)", None, "lintroller", "clearMannequin", False),
    ("ACT-25", "RF18", "Salvar como esquema", "Save as look", "Guardar como look", "a dress form with a small bookmark ribbon on its stand", "ativo", "an orange ribbon", "formribbon", "saveTryOn", False),
    ("ACT-26", "RF20", "Selo de marca", "Brand seal", "Sello de marca", "a round rosette award ribbon with a blank label in the center", "ativo", "orange ribbon tails", "rosette", "brandSeal", False),
    ("ACT-27", "RF21", "Selo de celebridade", "Celebrity seal", "Sello de celebridad", "a round rosette award ribbon with a small star in the center", "ativo", "an orange star", "rosettestar", "celebritySeal", False),
    ("ACT-28", "RF23", "Tema claro/escuro", "Light/dark theme", "Tema claro/oscuro", "a wall light switch, half of it lit", "ativo", "an orange lit half", "switch", "theme", False),
    ("ACT-29", "RF23", "Idioma", "Language", "Idioma", "a small globe wrapped by a measuring tape", "ativo", "an orange measuring tape", "globe", "language", False),
    ("ACT-30", "RF32", "Organizar o quarto", "Organize room", "Organizar el cuarto", "a chest of drawers with one drawer pulled open", "ativo", "an orange drawer", "drawers", "organizeRoom", False),
    ("ACT-31", "RF32", "Mostrar no quarto", "Show in room", "Mostrar en el cuarto", "a single drawer with a small spotlight cone shining on it", "ativo", "an orange spotlight cone", "drawerspot", "showInRoom", False),
    ("ACT-32", "RF33", "Vista-me", "Dress me", "Vísteme", "a tall oval standing mirror with a four-point sparkle in its glass", "ativo", "an orange sparkle", "mirrorsparkle", "vistaMe", True),
    ("ACT-33", "RF33", "Tira uma coisa", "Take one thing off", "Quita una cosa", "a necklace lifting off a hanger, with a small minus sign beside it", "ativo", "an orange minus sign", "necklaceminus", "takeOneOff", False),
    ("ACT-34", "RF33", "Trocar uma peça", "Swap a piece", "Cambiar una prenda", "two clothes hangers with two curved arrows swapping them", "ativo", "orange arrows", "swap", "swapPiece", False),
    ("ACT-35", "RF33", "Sugerir calçado", "Suggest shoes", "Sugerir calzado", "a sneaker with a small four-point sparkle above it", "ativo", "an orange sparkle", "sneakersparkle", "suggestShoes", True),
    ("ACT-36", "RF33", "Usar este look", "Wear this look", "Usar este look", "a clothes hanger holding a full outfit, with a round check-mark tag", "ativo", "an orange check tag", "outfitcheck", "useLook", False),
    ("ACT-37", "RF34", "Destaques", "Highlights", "Destacados", "a trophy cup whose handles are two clothes hangers", "ativo", "orange hanger handles", "trophy", "highlights", False),
    ("ACT-38", "RF34", "Como melhorar meu inventário", "Improve my inventory", "Mejorar mi inventario", "a light bulb whose filament is a thread with a needle", "ativo", "an orange filament", "bulb", "improveInventory", False),
    ("ACT-39", "RF34", "Rankings", "Rankings", "Rankings", "a three-step podium with a tiny folded shirt on the top step", "ativo", "an orange top step", "podium", "rankings", False),
    ("ACT-40", "RF35", "Saldo de FAI Points", "FAI Points balance", "Saldo de FAI Points", "a thick coin designed as a four-hole sewing button", "ativo", "an orange coin rim", "coin", "points", False),
    ("ACT-41", "RF35", "Loja do quarto", "Room shop", "Tienda del cuarto", "a shopping tote bag with rounded handles", "ativo (o mesmo objeto do logo, sem as letras)", "orange handles", "tote", "roomShop", False),
    ("ACT-42", "RF35", "Provar no quarto", "Try in room", "Probar en el cuarto", "a wardrobe door with a small price swing tag hanging from its handle", "ativo", "an orange price tag", "doortag", "tryInRoom", False),
    ("ACT-43", "RF36", "Desafios", "Challenges", "Desafíos", "a stopwatch whose strap is a rolled measuring tape", "ativo", "an orange stopwatch hand", "stopwatch", "challenges", False),
    ("ACT-44", "RF36", "Modo Solo", "Solo mode", "Modo solo", "a single clothes hanger", "ativo", "an orange hook", "hanger", "mode:SOLO", False),
    ("ACT-45", "RF36", "Modo Equipe", "Team mode", "Modo equipo", "three clothes hangers linked hook to hook in a row", "ativo", "orange hooks", "hangers3", "mode:TEAM", False),
    ("ACT-46", "RF36", "Modo Duelo", "Duel mode", "Modo duelo", "two clothes hangers crossed like fencing swords", "ativo", "orange hooks", "hangerscross", "mode:DUEL", False),
]
LOGO = ("LOGO", "—", "Logo FashionAI", "FashionAI logo", "Logo FashionAI", "a shopping tote bag with rounded handles", "—", None, "tote", "logo", False)

EXCLUDED = [
    {"grupo": "Ferramentas do Editor Canvas (RF15)", "itens": "recortar, girar, brilho, remover fundo, desfazer, refazer",
     "motivo": "barra de ferramentas a 16–20 px, lado a lado; medalha ficaria ilegível", "solucao": "ícones de linha simples da mesma paleta (lineIcon)"},
    {"grupo": "Botões de formulário", "itens": "confirmar, cancelar, fechar, próximo, voltar de etapa",
     "motivo": "ícone ilustrado competiria com a ação principal", "solucao": "texto"},
    {"grupo": "Toggles compactos do card (RF31.CA07)", "itens": "estrela pequena, 'indisponível' só com a letra",
     "motivo": "o critério exige estrelinha pequena e letra", "solucao": "SOC-06/14/15 só em filtros, cabeçalho da lista e estados vazios"},
    {"grupo": "Login social", "itens": "botão do Google", "motivo": "logotipo oficial exigido pelo Google", "solucao": "logotipo oficial, nunca recriação"},
]

LINE_ICONS = ["crop", "rotate", "brightness", "removeBackground", "undo", "redo"]


def entry(t, family):
    iid, rf, pt, en, es, obj, active_pt, accent, glyph, target, ai = t
    single = accent is None
    e = {
        "id": iid, "slug": iid.lower(), "family": family, "rf": rf,
        "label": {"PT_BR": pt, "EN": en, "ES": es},
        "object": obj, "activeState": active_pt, "activeAccent": accent, "singleState": single,
        "states": ["normal"] if single else ["normal", "ativo"],
        "glyph": glyph, "ai": ai,
    }
    if family == "NAV":
        e["route"] = target
    else:
        e["action"] = target
    e["files"] = {s: {str(sz["px"]): f"/icons/fai/{iid.lower()}-{s}-{sz['px']}.png" for sz in SIZES} for s in e["states"]}
    return e


def prompt(e, state, variant):
    mesh = {"full": MESH_FULL, "halfmesh": MESH_HALF, "nomesh": MESH_NONE}[variant]
    accent = ACCENT_ACTIVE.replace("{ACCENT}", e["activeAccent"]) if state == "ativo" else ""
    texto = TEXT_LOGO if e["id"] == "LOGO" else TEXT_BUTTON
    return (MASTER_PROMPT.replace("{MESH}", mesh).replace("{OBJETO}", e["object"])
            .replace("{ACCENT}", accent).replace("{TEXTO}", texto))


def build():
    icons = [entry(t, "SOC") for t in SOC] + [entry(t, "NAV") for t in NAV] + [entry(t, "ACT") for t in ACT]
    assert len(icons) == 77, len(icons)
    logo = entry(LOGO, "LOGO")
    public_dir = os.path.join(ROOT, "public")
    for e in icons + [logo]:
        e["available"] = all(os.path.exists(os.path.join(public_dir, f.lstrip("/")))
                             for s in e["files"].values() for f in s.values())
    catalog = {
        "source": "FashionAI — Prompts de Assets de Ícones (2026-09-23)",
        "counts": {"total": len(icons), "SOC": len(SOC), "NAV": len(NAV), "ACT": len(ACT)},
        "palette": PALETTE,
        "masterPrompt": MASTER_PROMPT, "negativePrompt": NEGATIVE,
        "meshVariants": {"full": MESH_FULL, "halfmesh": MESH_HALF, "nomesh": MESH_NONE},
        "textRule": {"logo": TEXT_LOGO, "buttons": TEXT_BUTTON,
                     "counters": "contadores e badges são desenhados pelo app por cima/ao lado do ícone, nunca na imagem"},
        "forbidden": "logotipo de marca real, rosto de pessoa real, símbolos protegidos",
        "sizes": SIZES, "states": STATES,
        "fileNamePattern": "public/icons/fai/{id}-{estado}-{tamanho}.png",
        "format": "PNG com fundo transparente (remoção de fundo do pipeline RF4 antes do export)",
        "coherence": {
            "sparkle": "brilho de quatro pontas só onde há IA (ACT-08, 09, 15, 32, 35 e NAV-03)",
            "hanger": "cabide = peça nas ações de acervo e participante nos modos de Desafios (ACT-44 a 46)",
            "bust": "busto de costura = estilo do usuário (Dashboard, Criar Look, Copilot, manequins do Provador)",
        },
        "checklist": [
            "disco, malha e halo com as cores do logo (#2A211C, creme, #F57C1F)",
            "objeto central preto fosco ocupando 55%–65% do medalhão",
            "sem letras, números ou logotipo de marca real",
            "a 24 px o objeto continua reconhecível ao lado dos outros da família",
            "estado ativo difere do normal só pelo acento laranja",
            "aria-label definido no componente",
        ],
        "excluded": EXCLUDED, "lineIcons": LINE_ICONS,
        "logo": logo, "icons": icons,
    }
    for out in ("lib/icons/fai-icons.json", "fai-web/src/main/resources/catalog/fai-icons.json"):
        p = os.path.join(ROOT, out)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
    csv_path = os.path.join(ROOT, "docs/icones/prompts_icones.csv")
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    rows = 0
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "familia", "rf", "rotulo", "estado", "variante", "tamanhos", "arquivo_fonte", "prompt", "prompt_negativo"])
        for e in [logo] + icons:
            for s in e["states"]:
                for variant, sizes in (("full", "512,96"), ("halfmesh", "48"), ("nomesh", "24")):
                    src = f"{e['slug']}-{s}" + ("" if variant == "full" else f"-{variant}") + ".png"
                    w.writerow([e["id"], e["family"], e["rf"], e["label"]["PT_BR"], s, variant, sizes, src,
                                prompt(e, s, variant), NEGATIVE])
                    rows += 1
    print(f"icons={len(icons)} (+logo) prompts={rows} available={sum(e['available'] for e in icons)}")


def remove_white(img, tol=18):
    """Fundo branco -> transparente por flood-fill a partir das bordas (preserva o creme do medalhão)."""
    from collections import deque
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if 255 - min(r, g, b) > tol:
            continue
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return img


def export(src_dir):
    from PIL import Image
    out_dir = os.path.join(ROOT, "public/icons/fai")
    os.makedirs(out_dir, exist_ok=True)
    catalog = json.load(open(os.path.join(ROOT, "lib/icons/fai-icons.json"), encoding="utf-8"))
    done = 0
    for e in [catalog["logo"]] + catalog["icons"]:
        for s in e["states"]:
            base = os.path.join(src_dir, f"{e['slug']}-{s}.png")
            if not os.path.exists(base):
                continue
            for size in SIZES:
                variant_src = os.path.join(src_dir, f"{e['slug']}-{s}-{size['variant']}.png")
                src = variant_src if size["variant"] != "full" and os.path.exists(variant_src) else base
                img = remove_white(Image.open(src))
                img = img.resize((size["px"], size["px"]), Image.LANCZOS)
                img.save(os.path.join(out_dir, f"{e['slug']}-{s}-{size['px']}.png"), optimize=True)
                done += 1
    print(f"exported {done} files -> {out_dir}")
    build()


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "export":
        export(sys.argv[2])
    else:
        build()
