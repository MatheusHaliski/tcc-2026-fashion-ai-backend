import math, os, random
from gen import W, H, SANS, SERIF, perforated_paper, badge_text, tshirt, STAMPS as BRANDS
from gen_fai import NODES, tote, CREAM, BLACK

OUT = os.path.dirname(os.path.abspath(__file__))


def shade(hex_color, k):
    """k<1 escurece, k>1 clareia (mistura com branco)."""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    if k <= 1:
        r, g, b = (int(c * k) for c in (r, g, b))
    else:
        t = min(k - 1, 1)
        r, g, b = (int(c + (255 - c) * t) for c in (r, g, b))
    return f"#{r:02X}{g:02X}{b:02X}"


# ---------------------------------------------------------------- materiais
# Cada material define: base da faixa (fill + textura), estilo de nó, estilo de linha,
# cores de painel/emblema/texto. Tudo em gradientes e traços — nada de <filter>.
MATERIALS = [
    dict(n=1, id="plastico", title="Plástico", tag="Nós brilhantes · tubos com reflexo",
         band="#F58220", panel="#F7B26B", ring="#3B3428", disc="#F58220", txt="#3B3428", accent="#3B3428",
         node="gloss", line=dict(color="#FFF1DC", w=2.6, hi="#FFFFFF", hi_w=0.9, hi_op=0.7), texture="sheen"),
    dict(n=2, id="metal", title="Metal", tag="Aço escovado · nós cromados",
         band="#9A9DA2", panel="#D6D8DB", ring="#3A3C40", disc="#B5B8BC", txt="#2A2C30", accent="#C9A86A",
         node="chrome", line=dict(color="#4C4F54", w=2.2, hi="#F4F5F6", hi_w=0.7, hi_op=0.8), texture="brushed"),
    dict(n=3, id="madeira", title="Madeira", tag="Veios de carvalho · botões torneados",
         band="#A0642F", panel="#D9A46A", ring="#4A2C14", disc="#B87333", txt="#3A2210", accent="#F3E6C8",
         node="wood", line=dict(color="#E8C48F", w=1.7, hi=None), texture="grain"),
    dict(n=4, id="vidro", title="Vidro", tag="Esferas translúcidas · reflexos de luz",
         band="#CFE9F0", panel="#EAF6F9", ring="#2E5E6B", disc="#BFE0EA", txt="#1F3F48", accent="#2E5E6B",
         node="glass", line=dict(color="#FFFFFF", w=1.3, hi=None, op=0.85, shadow="#7FB1C0"), texture="streaks"),
    dict(n=5, id="marmore", title="Mármore", tag="Veios de Carrara · embutidos em latão",
         band="#F1EEE8", panel="#F8F6F2", ring="#3B3428", disc="#E9E4DC", txt="#3B3428", accent="#C9A86A",
         node="stone", line=dict(color="#C9A86A", w=1.3, hi=None), texture="veins"),
    dict(n=6, id="tecido", title="Tecido", tag="Denim · costura em linha amarela · botões",
         band="#3E5A82", panel="#5C7BA6", ring="#1F2E45", disc="#3E5A82", txt="#F3E6C8", accent="#F2C14E",
         node="button", line=dict(color="#F2C14E", w=1.4, hi=None, dash="3 2.2"), texture="weave"),
    dict(n=7, id="couro", title="Couro", tag="Grão natural · pesponto · rebites de latão",
         band="#6B3E26", panel="#8A5638", ring="#2E1A0E", disc="#7A4A2C", txt="#F3E6C8", accent="#F0D48A",
         node="rivet", line=dict(color="#F3E6C8", w=1.3, hi=None, dash="4 3", groove="#3E2314"), texture="pebble"),
    dict(n=8, id="ceramica", title="Cerâmica", tag="Esmalte craquelado · traço em azul cobalto",
         band="#F7F3EC", panel="#FFFFFF", ring="#1F4E9C", disc="#EEF3FA", txt="#1F4E9C", accent="#1F4E9C",
         node="glaze", line=dict(color="#1F4E9C", w=1.2, hi=None), texture="crackle"),
    dict(n=9, id="neon", title="Neon", tag="Acrílico iluminado · tubos com halo",
         band="#0B0B14", panel="#14142A", ring="#FF3EA5", disc="#1C1C36", txt="#F5F2FF", accent="#FF3EA5",
         node="neon", line=dict(color="#FF3EA5", w=1.1, hi="#FFD6EE", hi_w=0.5, hi_op=0.95, halo="#FF3EA5"), texture="vignette"),
    dict(n=10, id="concreto", title="Concreto", tag="Superfície porosa · sulcos e discos foscos",
         band="#9C9C97", panel="#BDBDB8", ring="#3A3A38", disc="#A9A9A4", txt="#2A2A28", accent="#F58220",
         node="matte", line=dict(color="#6E6E69", w=1.4, hi="#D9D9D4", hi_w=0.6, hi_op=0.8), texture="speckle"),
    dict(n=11, id="ouro", title="Ouro martelado", tag="Marcas de martelo · domos polidos",
         band="url(#ouro-band)", panel="#F1E4BC", ring="#5A4210", disc="#D4B25A", txt="#3B2A08", accent="#3B2A08",
         node="gold", line=dict(color="#7A5A16", w=1.5, hi="#FFF0B8", hi_w=0.6, hi_op=0.85), texture="hammer",
         band_defs='<linearGradient id="ouro-band" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6C766"/><stop offset="0.5" stop-color="#B58C2E"/><stop offset="1" stop-color="#7A5A16"/></linearGradient>'),
    dict(n=12, id="holo", title="Holográfico", tag="Iridescência · aberração cromática",
         band="url(#holo-band)", panel="#F6F3FB", ring="#6B5BA6", disc="url(#holo-disc)", txt="#3A2E6B", accent="#6B5BA6",
         node="holo", line=dict(color="#FFFFFF", w=1.2, hi=None, chroma=True), texture="streaks",
         band_defs='<linearGradient id="holo-band" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB3E6"/><stop offset="0.25" stop-color="#B3E5FF"/><stop offset="0.5" stop-color="#C8FFB3"/><stop offset="0.75" stop-color="#FFF3B3"/><stop offset="1" stop-color="#E0B3FF"/></linearGradient>'
                   '<linearGradient id="holo-disc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0B3FF"/><stop offset="0.5" stop-color="#B3E5FF"/><stop offset="1" stop-color="#FFB3E6"/></linearGradient>'),
]


def node_defs(mid, kind):
    """Gradientes por cor de nó, um conjunto por material."""
    out = []
    for c in sorted(set(NODES)):
        gid = f"{mid}-n-{c[1:]}"
        if kind == "gloss":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="{shade(c, 1.6)}"/><stop offset="0.45" stop-color="{c}"/><stop offset="1" stop-color="{shade(c, 0.55)}"/></radialGradient>')
        elif kind == "chrome":
            out.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="{shade(c, 1.25)}"/><stop offset="0.5" stop-color="{shade(c, 0.5)}"/><stop offset="0.75" stop-color="{shade(c, 1.1)}"/><stop offset="1" stop-color="{shade(c, 0.4)}"/></linearGradient>')
        elif kind == "wood":
            wc = {"#F5C518": "#D9A45A", "#6AA82E": "#8B6B3E", "#1F7BC8": "#6B4A2E", "#F26522": "#B8672E", "#7A5A3A": "#5A3A1E", "#E85A2A": "#A85A2A"}.get(c, c)
            out.append(f'<radialGradient id="{gid}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{shade(wc, 1.3)}"/><stop offset="0.7" stop-color="{wc}"/><stop offset="1" stop-color="{shade(wc, 0.6)}"/></radialGradient>')
        elif kind == "glass":
            out.append(f'<radialGradient id="{gid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{c}" stop-opacity="0.25"/><stop offset="0.8" stop-color="{c}" stop-opacity="0.45"/><stop offset="1" stop-color="{shade(c, 0.7)}" stop-opacity="0.8"/></radialGradient>')
        elif kind == "stone":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{shade(c, 1.45)}"/><stop offset="0.6" stop-color="{shade(c, 0.95)}"/><stop offset="1" stop-color="{shade(c, 0.7)}"/></radialGradient>')
        elif kind == "rivet":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FBEBB8"/><stop offset="0.5" stop-color="#D4A94A"/><stop offset="1" stop-color="#7A5216"/></radialGradient>')
        elif kind == "glaze":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="{shade(c, 1.15)}"/><stop offset="1" stop-color="{shade(c, 0.8)}"/></radialGradient>')
        elif kind == "neon":
            out.append(f'<radialGradient id="{gid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{c}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{c}" stop-opacity="0.35"/><stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>')
        elif kind == "matte":
            out.append(f'<radialGradient id="{gid}" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="{shade(c, 1.05)}"/><stop offset="1" stop-color="{shade(c, 0.75)}"/></radialGradient>')
        elif kind == "gold":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFF4C4"/><stop offset="0.45" stop-color="#E2BE55"/><stop offset="1" stop-color="#7A5A16"/></radialGradient>')
        elif kind == "holo":
            out.append(f'<radialGradient id="{gid}" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.3" stop-color="#B3E5FF"/><stop offset="0.6" stop-color="#FFB3E6"/><stop offset="1" stop-color="#8E7CC3"/></radialGradient>')
    return "".join(out)


def node_svg(mid, kind, x, y, r, c):
    gid = f"url(#{mid}-n-{c[1:]})"
    if kind == "gloss":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}"/>'
                f'<ellipse cx="{x - r*0.3:.1f}" cy="{y - r*0.4:.1f}" rx="{r*0.35:.1f}" ry="{r*0.22:.1f}" fill="#fff" opacity="0.85"/>')
    if kind == "chrome":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="#2A2C30" stroke-width="0.5"/>'
                f'<circle cx="{x - r*0.3:.1f}" cy="{y - r*0.35:.1f}" r="{r*0.22:.1f}" fill="#fff" opacity="0.9"/>')
    if kind == "wood":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.6:.1f}" fill="none" stroke="#3A2210" stroke-width="0.5" opacity="0.5"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.25:.1f}" fill="none" stroke="#3A2210" stroke-width="0.5" opacity="0.4"/>')
    if kind == "glass":
        return (f'<circle cx="{x + 1:.1f}" cy="{y + 1.5:.1f}" r="{r:.1f}" fill="#2E5E6B" opacity="0.18"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="#fff" stroke-width="0.8" opacity="0.95"/>'
                f'<path d="M{x - r*0.7:.1f},{y - r*0.2:.1f} A{r*0.75:.1f},{r*0.75:.1f} 0 0,1 {x + r*0.2:.1f},{y - r*0.7:.1f}" fill="none" stroke="#fff" stroke-width="{max(r*0.22,0.8):.1f}" stroke-linecap="round" opacity="0.9"/>')
    if kind == "stone":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="#C9A86A" stroke-width="0.6"/>'
                f'<circle cx="{x - r*0.3:.1f}" cy="{y - r*0.35:.1f}" r="{r*0.18:.1f}" fill="#fff" opacity="0.5"/>')
    if kind == "button":
        h = r * 0.28
        holes = "".join(f'<circle cx="{x + dx:.1f}" cy="{y + dy:.1f}" r="{max(r*0.13,0.5):.1f}" fill="#1F2E45"/>' for dx, dy in ((-h, -h), (h, -h), (-h, h), (h, h)))
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}" stroke="{shade(c, 0.6)}" stroke-width="0.7"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.7:.1f}" fill="none" stroke="{shade(c, 0.7)}" stroke-width="0.5"/>{holes}')
    if kind == "rivet":
        return (f'<circle cx="{x + 0.8:.1f}" cy="{y + 1.2:.1f}" r="{r:.1f}" fill="#000" opacity="0.35"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="#5A3A12" stroke-width="0.5"/>'
                f'<circle cx="{x - r*0.3:.1f}" cy="{y - r*0.35:.1f}" r="{r*0.2:.1f}" fill="#fff" opacity="0.7"/>')
    if kind == "glaze":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="{shade(c, 0.6)}" stroke-width="0.5"/>'
                f'<ellipse cx="{x - r*0.28:.1f}" cy="{y - r*0.38:.1f}" rx="{r*0.4:.1f}" ry="{r*0.28:.1f}" fill="#fff" opacity="0.9"/>')
    if kind == "neon":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*2.6:.1f}" fill="{gid}"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.7:.1f}" fill="{shade(c, 1.7)}"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.35:.1f}" fill="#fff"/>')
    if kind == "matte":
        return (f'<circle cx="{x + 0.6:.1f}" cy="{y + 1:.1f}" r="{r:.1f}" fill="#000" opacity="0.25"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*0.62:.1f}" fill="none" stroke="#000" stroke-width="0.5" opacity="0.25"/>')
    if kind == "gold":
        return (f'<circle cx="{x + 0.8:.1f}" cy="{y + 1.2:.1f}" r="{r:.1f}" fill="#3B2A08" opacity="0.45"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}" stroke="#5A4210" stroke-width="0.4"/>'
                f'<circle cx="{x - r*0.32:.1f}" cy="{y - r*0.36:.1f}" r="{r*0.2:.1f}" fill="#fff" opacity="0.85"/>')
    if kind == "holo":
        return (f'<circle cx="{x + 0.9:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#FF3EA5" opacity="0.35"/>'
                f'<circle cx="{x - 0.9:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#2EC4F0" opacity="0.35"/>'
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{gid}"/>'
                f'<circle cx="{x - r*0.3:.1f}" cy="{y - r*0.35:.1f}" r="{r*0.22:.1f}" fill="#fff" opacity="0.95"/>')
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}"/>'


def line_svg(ls, x1, y1, x2, y2):
    out = []
    if ls.get("halo"):
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ls["halo"]}" stroke-width="{ls["w"] * 4}" stroke-linecap="round" opacity="0.18"/>')
    if ls.get("chroma"):
        out.append(f'<line x1="{x1 - 0.7:.1f}" y1="{y1:.1f}" x2="{x2 - 0.7:.1f}" y2="{y2:.1f}" stroke="#2EC4F0" stroke-width="{ls["w"]}" stroke-linecap="round" opacity="0.6"/>'
                   f'<line x1="{x1 + 0.7:.1f}" y1="{y1:.1f}" x2="{x2 + 0.7:.1f}" y2="{y2:.1f}" stroke="#FF3EA5" stroke-width="{ls["w"]}" stroke-linecap="round" opacity="0.6"/>')
    if ls.get("groove"):
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ls["groove"]}" stroke-width="{ls["w"] + 2.2}" stroke-linecap="round" opacity="0.6"/>')
    if ls.get("shadow"):
        out.append(f'<line x1="{x1 + 0.8:.1f}" y1="{y1 + 1.2:.1f}" x2="{x2 + 0.8:.1f}" y2="{y2 + 1.2:.1f}" stroke="{ls["shadow"]}" stroke-width="{ls["w"]}" stroke-linecap="round" opacity="0.5"/>')
    dash = f' stroke-dasharray="{ls["dash"]}"' if ls.get("dash") else ""
    op = f' opacity="{ls["op"]}"' if ls.get("op") else ""
    out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ls["color"]}" stroke-width="{ls["w"]}" stroke-linecap="round"{dash}{op}/>')
    if ls.get("hi"):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L * ls["w"] * 0.28, dx / L * ls["w"] * 0.28
        out.append(f'<line x1="{x1 + nx:.1f}" y1="{y1 + ny:.1f}" x2="{x2 + nx:.1f}" y2="{y2 + ny:.1f}" stroke="{ls["hi"]}" stroke-width="{ls["hi_w"]}" stroke-linecap="round" opacity="{ls["hi_op"]}"/>')
    return "".join(out)


def mesh_band(m, cid, seed, pitch=15):
    rnd = random.Random(seed)
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    cols, rows = int((x1 - x0) / pitch) + 2, int((y1 - y0) / pitch) + 2
    g = [[(x0 - 4 + i * pitch + rnd.uniform(-3, 3), y0 - 4 + j * pitch + rnd.uniform(-3, 3)) for i in range(cols)] for j in range(rows)]
    lines, dots = [], []
    for j in range(rows):
        for i in range(cols):
            x, y = g[j][i]
            if i + 1 < cols: lines.append(line_svg(m["line"], x, y, *g[j][i + 1]))
            if j + 1 < rows:
                lines.append(line_svg(m["line"], x, y, *g[j + 1][i]))
                if i + 1 < cols and (i + j) % 2 == 0: lines.append(line_svg(m["line"], x, y, *g[j + 1][i + 1]))
            if (i * 7 + j * 3) % 4 == 0:
                dots.append(node_svg(m["id"], m["node"], x, y, rnd.uniform(2.8, 4.2), rnd.choice(NODES)))
    return f'<g id="borda-malha" clip-path="url(#{cid})">{"".join(lines)}{"".join(dots)}</g>'


def mesh_disc(m, cx, cy, R, seed):
    rnd = random.Random(seed)
    rings = [(0.58, 8), (0.79, 13), (0.97, 18)]
    pts = []
    for fr, n in rings:
        pts.append([(cx + R * fr * rnd.uniform(0.96, 1.04) * math.cos(a), cy + R * fr * rnd.uniform(0.96, 1.04) * math.sin(a), rnd.choice(NODES), rnd.uniform(3.2, 5.2))
                    for a in (2 * math.pi * i / n + rnd.uniform(-0.12, 0.12) for i in range(n))])
    lines, dots = [], []
    for k, ring in enumerate(pts):
        for i, (x, y, c, r) in enumerate(ring):
            lines.append(line_svg(m["line"], x, y, *ring[(i + 1) % len(ring)][:2]))
            if k + 1 < len(pts):
                for nx, ny, _, _ in sorted(pts[k + 1], key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)[:2]:
                    lines.append(line_svg(m["line"], x, y, nx, ny))
            dots.append(node_svg(m["id"], m["node"], x, y, r, c))
    return f'<g id="rede">{"".join(lines)}</g><g id="nos">{"".join(dots)}</g>'


def texture(m, cid, seed):
    """Textura do material na faixa, sempre por baixo da malha."""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    t, els = m["texture"], []
    if t == "sheen":
        els.append(f'<rect x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="url(#{m["id"]}-sheen)"/>')
    elif t == "brushed":
        els.append(f'<rect x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="url(#{m["id"]}-brush)"/>')
        for y in range(y0, y1, 2):
            els.append(f'<line x1="{x0}" y1="{y + rnd.uniform(0, 1):.1f}" x2="{x1}" y2="{y + rnd.uniform(0, 1):.1f}" stroke="#fff" stroke-width="0.5" opacity="{rnd.uniform(0.05, 0.28):.2f}"/>')
    elif t == "grain":
        for y in range(y0 - 6, y1 + 6, 5):
            d = f"M{x0 - 10},{y}"
            for x in range(x0 - 10, x1 + 20, 24):
                d += f" q12,{rnd.uniform(-3, 3):.1f} 24,{rnd.uniform(-2, 2):.1f}"
            els.append(f'<path d="{d}" fill="none" stroke="#5E3618" stroke-width="{rnd.uniform(0.5, 1.6):.1f}" opacity="{rnd.uniform(0.25, 0.6):.2f}"/>')
    elif t == "streaks":
        els.append(f'<rect x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="url(#{m["id"]}-glass)"/>')
        for i in range(-200, 500, 34):
            els.append(f'<line x1="{i}" y1="{y0}" x2="{i + 180}" y2="{y1}" stroke="#fff" stroke-width="{rnd.uniform(3, 9):.1f}" opacity="{rnd.uniform(0.18, 0.4):.2f}"/>')
    elif t == "veins":
        for _ in range(16):
            x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
            d = f"M{x:.1f},{y:.1f}"
            for _ in range(4):
                d += f" c{rnd.uniform(-30, 30):.1f},{rnd.uniform(-30, 30):.1f} {rnd.uniform(-30, 30):.1f},{rnd.uniform(-30, 30):.1f} {rnd.uniform(-60, 60):.1f},{rnd.uniform(-60, 60):.1f}"
            col = rnd.choice(["#B9B4AD", "#9A948C", "#C9A86A"])
            els.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{rnd.uniform(0.5, 1.6):.1f}" opacity="{rnd.uniform(0.35, 0.8):.2f}" stroke-linecap="round"/>')
    elif t == "weave":
        for i in range(-320, 560, 3):
            els.append(f'<line x1="{i}" y1="{y0}" x2="{i + 300}" y2="{y1}" stroke="#fff" stroke-width="0.5" opacity="0.10"/>')
            els.append(f'<line x1="{i}" y1="{y1}" x2="{i + 300}" y2="{y0}" stroke="#000" stroke-width="0.5" opacity="0.10"/>')
    elif t == "pebble":
        for _ in range(900):
            els.append(f'<circle cx="{rnd.uniform(x0, x1):.1f}" cy="{rnd.uniform(y0, y1):.1f}" r="{rnd.uniform(0.4, 1.3):.1f}" fill="{rnd.choice(["#000", "#fff"])}" opacity="{rnd.uniform(0.06, 0.2):.2f}"/>')
    elif t == "crackle":
        for _ in range(70):
            x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
            pts = [(x, y)]
            for _ in range(rnd.randint(2, 4)):
                x, y = x + rnd.uniform(-14, 14), y + rnd.uniform(-14, 14)
                pts.append((x, y))
            els.append(f'<polyline points="{" ".join(f"{px:.1f},{py:.1f}" for px, py in pts)}" fill="none" stroke="#8A9098" stroke-width="0.5" opacity="{rnd.uniform(0.3, 0.6):.2f}"/>')
    elif t == "vignette":
        els.append(f'<rect x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="url(#{m["id"]}-vig)"/>')
    elif t == "speckle":
        for _ in range(700):
            els.append(f'<circle cx="{rnd.uniform(x0, x1):.1f}" cy="{rnd.uniform(y0, y1):.1f}" r="{rnd.uniform(0.3, 1.1):.1f}" fill="{rnd.choice(["#000", "#fff", "#4A4A46"])}" opacity="{rnd.uniform(0.08, 0.3):.2f}"/>')
        for _ in range(40):
            els.append(f'<ellipse cx="{rnd.uniform(x0, x1):.1f}" cy="{rnd.uniform(y0, y1):.1f}" rx="{rnd.uniform(1, 2.6):.1f}" ry="{rnd.uniform(0.8, 1.8):.1f}" fill="#000" opacity="{rnd.uniform(0.12, 0.28):.2f}"/>')
    elif t == "hammer":
        for _ in range(260):
            x, y, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(3, 7)
            els.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#fff" opacity="{rnd.uniform(0.04, 0.12):.2f}"/>'
                       f'<path d="M{x - r*0.7:.1f},{y + r*0.5:.1f} A{r:.1f},{r:.1f} 0 0,1 {x + r*0.7:.1f},{y + r*0.5:.1f}" fill="none" stroke="#5A4210" stroke-width="0.7" opacity="{rnd.uniform(0.2, 0.45):.2f}"/>'
                       f'<path d="M{x - r*0.7:.1f},{y - r*0.4:.1f} A{r:.1f},{r:.1f} 0 0,0 {x + r*0.7:.1f},{y - r*0.4:.1f}" fill="none" stroke="#FFF0B8" stroke-width="0.7" opacity="{rnd.uniform(0.25, 0.55):.2f}"/>')
    return f'<g id="textura" clip-path="url(#{cid})">{"".join(els)}</g>'


def stamp(m, standalone=True, ox=0, oy=0, brand=None):
    """brand: entrada de gen.STAMPS — troca o emblema pela camisa da marca e o wordmark."""
    n, mid = m["n"], m["id"]
    tag = f"{mid}-{brand['name'].lower().replace(' ', '-')}" if brand else mid
    cid = f"mclip-{tag}"; gid = f"mg-{tag}"
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    cx, cy, R = W / 2, 158, 78
    defs = f'''
  <defs>
    <clipPath id="{cid}"><path fill-rule="evenodd" d="M{x0},{y0} H{x1} V{y1} H{x0} Z M28,28 H{W-28} V{H-28} H28 Z"/></clipPath>
    <linearGradient id="{gid}-base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{brand["shirt"] if brand else "#000"}"/><stop offset="1" stop-color="{brand["shirt_dark"] if brand else "#000"}"/></linearGradient>
    <linearGradient id="{gid}-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
    <linearGradient id="{mid}-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
    <linearGradient id="{mid}-brush" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6E7176"/><stop offset="0.45" stop-color="#DADCDF"/><stop offset="0.6" stop-color="#9A9DA2"/><stop offset="1" stop-color="#5B5E63"/></linearGradient>
    <linearGradient id="{mid}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="1" stop-color="#7FB1C0" stop-opacity="0.35"/></linearGradient>
    <radialGradient id="{mid}-disc" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="{shade(m["disc"], 1.12) if m["disc"].startswith("#") else "#fff"}"/><stop offset="1" stop-color="{shade(m["disc"], 0.82) if m["disc"].startswith("#") else "#fff"}"/></radialGradient>
    <radialGradient id="{mid}-vig" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient>
    {m.get("band_defs", "")}
    {node_defs(mid, m["node"])}
  </defs>'''
    if brand:
        series, wordmark, year = "STREETWEAR · MATERIAL", brand["name"], brand["year"]
        center = f'<g id="centro">{tshirt(brand, gid)}</g>'
    else:
        series, wordmark, year = "SÉRIE MATERIAIS", "FASHION AI", "2026"
        center = f'''<g id="emblema">
    <circle cx="{cx + 2}" cy="{cy + 4}" r="{R}" fill="#000" opacity="0.22"/>
    <circle cx="{cx}" cy="{cy}" r="{R}" fill="{m["ring"]}"/>
    <circle cx="{cx}" cy="{cy}" r="{R - 7}" fill="{m["disc"] if not m["disc"].startswith("#") else f"url(#{mid}-disc)"}"/>
    {mesh_disc(m, cx, cy, R - 7, n)}
    <circle cx="{cx + 2}" cy="{cy + 3}" r="{R * 0.44}" fill="#000" opacity="0.18"/>
    <circle cx="{cx}" cy="{cy}" r="{R * 0.44}" fill="{CREAM}"/>
    {tote(cx, cy - 4, R / 105, BLACK, CREAM)}
  </g>'''
    body = f'''
  {perforated_paper()}
  <rect id="moldura" x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="{m["band"]}"/>
  {texture(m, cid, 300 + n)}
  {mesh_band(m, cid, 100 + n)}
  <rect id="painel" x="28" y="28" width="{W-56}" height="{H-56}" fill="{m["panel"]}"/>
  <rect x="32" y="32" width="{W-64}" height="{H-64}" fill="none" stroke="{m["accent"]}" stroke-width="0.9" opacity="0.7"/>
  {center}
  <g id="tipografia" font-family="{SANS}" fill="{m["txt"]}">
    <text x="{W/2}" y="48" text-anchor="middle" font-size="{7.2 if len(series) < 18 else 6.4}" letter-spacing="{2.2 if len(series) < 18 else 1.3}" font-weight="500">{series} · Nº {n:02d}</text>
    <text x="{W/2}" y="70" text-anchor="middle" font-size="{19 if len(wordmark) <= 11 else 16}" font-weight="700" letter-spacing="0.5">{wordmark}</text>
    <text x="40" y="{H-42}" font-size="7" letter-spacing="1.4" font-weight="500" opacity="0.85">{m["title"].upper()}</text>
    <text x="40" y="{H-31}" font-family="{SERIF}" font-style="italic" font-size="7.5" opacity="0.75">{m["tag"]}</text>
  </g>
  <g id="denominacao" transform="translate({W-56},{H-52})">
    <circle r="17" fill="{m["accent"]}"/>
    <circle r="14" fill="none" stroke="{m["panel"]}" stroke-width="0.8" opacity="0.6"/>
    <text y="4" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="11" letter-spacing="-0.3" fill="{badge_text(dict(accent=m["accent"], ground=m["band"] if m["band"].startswith("#") else m["panel"], panel=m["panel"]))}">{year}</text>
  </g>'''
    if standalone:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
                f'<title>{wordmark} · {m["title"]} Nº{n:02d}</title>{defs}<g id="mat-{tag}">{body}</g></svg>')
    return f'{defs}<g id="mat-{tag}" transform="translate({ox},{oy})">{body}</g>'


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "svg-materiais"), exist_ok=True)
    for m in MATERIALS:
        with open(os.path.join(OUT, "svg-materiais", f'{m["n"]:02d}-fai-{m["id"]}.svg'), "w") as f:
            f.write(stamp(m))
    cols, gap = 4, 28
    SW = cols * W + (cols + 1) * gap
    rows = math.ceil(len(MATERIALS) / cols)
    SH = rows * H + (rows + 1) * gap
    parts = [stamp(m, False, gap + (i % cols) * (W + gap), gap + (i // cols) * (H + gap)) for i, m in enumerate(MATERIALS)]
    with open(os.path.join(OUT, "folha-materiais.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}" height="{SH}" viewBox="0 0 {SW} {SH}">'
                f'<title>Folha de selos · Fashion AI Materiais</title><rect width="{SW}" height="{SH}" fill="#DAD6CC"/>{"".join(parts)}</svg>')
    print("ok", len(MATERIALS), SW, SH)

    # Marcas em material: o material que a marca evoca
    MAT = {m["id"]: m for m in MATERIALS}
    BR = {b["name"]: b for b in BRANDS}
    PAIRS = [("NIKE", "plastico"), ("ADIDAS", "ceramica"), ("PUMA", "metal"), ("NEW BALANCE", "tecido"), ("JORDAN", "couro")]
    os.makedirs(os.path.join(OUT, "svg-marcas-materiais"), exist_ok=True)
    parts = []
    for i, (bn, mid) in enumerate(PAIRS):
        m, b = dict(MAT[mid], n=i + 1), BR[bn]
        with open(os.path.join(OUT, "svg-marcas-materiais", f'{i+1:02d}-{bn.lower().replace(" ", "-")}-{mid}.svg'), "w") as f:
            f.write(stamp(m, brand=b))
        parts.append(stamp(m, False, gap + i * (W + gap), gap, brand=b))
    SW2 = 5 * W + 6 * gap; SH2 = H + 2 * gap
    with open(os.path.join(OUT, "folha-marcas-materiais.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW2}" height="{SH2}" viewBox="0 0 {SW2} {SH2}">'
                f'<title>Folha de selos · Marcas em material</title><rect width="{SW2}" height="{SH2}" fill="#DAD6CC"/>{"".join(parts)}</svg>')
    print("ok marcas", len(PAIRS), SW2, SH2)
