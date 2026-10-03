import math, os, random, html
import gen
from gen import W, H, PAPER, SANS, SERIF, perforated_paper, badge_text, tshirt

OUT = os.path.dirname(os.path.abspath(__file__))

# Paleta extraída do emblema Fashion AI
ORANGE = "#F58220"; ORANGE_D = "#D9661A"; BROWN = "#3B3428"; BLACK = "#1C1A17"
CREAM = "#F3E6C8"; LINE = "#EBD9B0"
NODES = ["#F5C518", "#6AA82E", "#1F7BC8", "#F26522", "#7A5A3A", "#E85A2A", "#F5C518", "#1F7BC8"]


def network_disc(cx, cy, R, seed, line=LINE, node_scale=1.0):
    """Rede radial: anéis de nós com jitter, ligados a vizinhos do mesmo anel e do anel seguinte."""
    rnd = random.Random(seed)
    rings = [(0.58, 8), (0.79, 13), (0.97, 18)]
    pts = []
    for k, (fr, n) in enumerate(rings):
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n + rnd.uniform(-0.12, 0.12)
            r = R * fr * rnd.uniform(0.96, 1.04)
            ring.append((cx + r * math.cos(a), cy + r * math.sin(a), rnd.choice(NODES), rnd.uniform(3.2, 5.2) * node_scale))
        pts.append(ring)
    lines, dots = [], []
    for k, ring in enumerate(pts):
        n = len(ring)
        for i, (x, y, c, r) in enumerate(ring):
            x2, y2 = ring[(i + 1) % n][:2]
            lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
            if k + 1 < len(pts):
                nxt = sorted(pts[k + 1], key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)[:2]
                for (nx, ny, _, _) in nxt:
                    lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{nx:.1f}" y2="{ny:.1f}"/>')
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}"/>'
                        f'<circle cx="{x - r * 0.3:.1f}" cy="{y - r * 0.3:.1f}" r="{r * 0.3:.1f}" fill="#fff" opacity="0.35"/>')
    return (f'<g id="rede" stroke="{line}" stroke-width="1.1" stroke-linecap="round">{"".join(lines)}</g>'
            f'<g id="nos">{"".join(dots)}</g>')


def network_band(cid, seed, line=LINE, pitch=15):
    """Malha triangulada em grade com jitter, recortada para a faixa da moldura."""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    cols = int((x1 - x0) / pitch) + 2
    rows = int((y1 - y0) / pitch) + 2
    grid = [[(x0 - 4 + i * pitch + rnd.uniform(-3, 3), y0 - 4 + j * pitch + rnd.uniform(-3, 3)) for i in range(cols)] for j in range(rows)]
    lines, dots = [], []
    for j in range(rows):
        for i in range(cols):
            x, y = grid[j][i]
            if i + 1 < cols:
                lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{grid[j][i+1][0]:.1f}" y2="{grid[j][i+1][1]:.1f}"/>')
            if j + 1 < rows:
                lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{grid[j+1][i][0]:.1f}" y2="{grid[j+1][i][1]:.1f}"/>')
                if i + 1 < cols and (i + j) % 2 == 0:
                    lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{grid[j+1][i+1][0]:.1f}" y2="{grid[j+1][i+1][1]:.1f}"/>')
            if (i * 7 + j * 3) % 4 == 0:
                r = rnd.uniform(2.4, 3.8)
                dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{rnd.choice(NODES)}"/>')
    return (f'<g id="borda-rede" clip-path="url(#{cid})"><g stroke="{line}" stroke-width="1" opacity="0.9">{"".join(lines)}</g>'
            f'<g>{"".join(dots)}</g></g>')


def tote(cx, cy, s=1.0, bag=BLACK, ink=CREAM, label="FAI", shadow=True):
    """Sacola: aba superior curva, corpo trapezoidal, alça em arco único, rótulo bold."""
    sh = f'<ellipse cx="0" cy="56" rx="34" ry="4.5" fill="#000" opacity="0.22"/>' if shadow else ""
    return f'''<g id="sacola" transform="translate({cx},{cy}) scale({s})">
    {sh}
    <path d="M-17,-10 C-17,-42 17,-42 17,-10" fill="none" stroke="{bag}" stroke-width="7" stroke-linecap="round"/>
    <path d="M-17,-10 C-17,-40 17,-40 17,-10" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.14" stroke-linecap="round"/>
    <path d="M-36,-12 Q0,-18 36,-12 L28,52 Q0,56 -28,52 Z" fill="{bag}"/>
    <path d="M-36,-12 Q0,-18 36,-12 L34,-4 Q0,-10 -34,-4 Z" fill="#000" opacity="0.28"/>
    <path d="M-30,-6 L-24,46" stroke="#fff" opacity="0.10" stroke-width="2.5" stroke-linecap="round"/>
    <text y="34" text-anchor="middle" font-family="{SANS}" font-weight="800" font-size="30" letter-spacing="-0.5" fill="{ink}">{label}</text>
  </g>'''


def emblem(cx, cy, R, seed, ring=BROWN, disc=ORANGE, inner=CREAM, bag=BLACK, ink=CREAM, line=LINE):
    """Emblema completo, fiel ao logo: anel escuro, disco laranja com rede, disco creme, sacola."""
    return f'''<g id="emblema">
    <circle cx="{cx}" cy="{cy}" r="{R}" fill="{ring}"/>
    <circle cx="{cx}" cy="{cy}" r="{R - 4}" fill="none" stroke="{line}" stroke-width="0.8" opacity="0.5"/>
    <circle cx="{cx}" cy="{cy}" r="{R - 7}" fill="{disc}"/>
    {network_disc(cx, cy, R - 7, seed, line)}
    <circle cx="{cx + 2}" cy="{cy + 3}" r="{R * 0.44}" fill="#000" opacity="0.18"/>
    <circle cx="{cx}" cy="{cy}" r="{R * 0.44}" fill="{inner}"/>
    {tote(cx, cy - 4, R / 105, bag, ink)}
  </g>'''


VARS = [
    dict(n=1, title="Oficial", ground=BROWN, panel=ORANGE, accent=CREAM, txt=CREAM, kind="emblem",
         tag="Emblema fiel · paleta canônica"),
    dict(n=2, title="Noturno", ground=BLACK, panel=BROWN, accent=ORANGE, txt=CREAM, kind="emblem-dark",
         tag="Fundo escuro · acento laranja"),
    dict(n=3, title="Creme", ground=ORANGE, panel=CREAM, accent=BROWN, txt=BROWN, kind="emblem-light",
         tag="Fundo claro · rede em sépia"),
    dict(n=4, title="Rede total", ground=BROWN, panel=ORANGE, accent=CREAM, txt=CREAM, kind="fullnet",
         tag="Rede preenche o painel · sacola flutuante"),
    dict(n=5, title="Vestível", ground=ORANGE, panel=BLACK, accent=CREAM, txt=CREAM, kind="shirt",
         tag="Camisa 3D · estampa com a sacola"),
    dict(n=6, title="Monograma", ground=BLACK, panel=CREAM, accent=ORANGE, txt=BROWN, kind="mono",
         tag="Sacola como painel · rede interna"),
]


def stamp(v, standalone=True, ox=0, oy=0):
    n = v["n"]; cid = f"fclip{n}"; gid = f"fg{n}"
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    cx, cy = W / 2, 158
    defs = f'''
  <defs>
    <clipPath id="{cid}"><path fill-rule="evenodd" d="M{x0},{y0} H{x1} V{y1} H{x0} Z M28,28 H{W-28} V{H-28} H28 Z"/></clipPath>
    <clipPath id="{cid}-painel"><rect x="28" y="82" width="{W-56}" height="{H-140}"/></clipPath>
    <clipPath id="{cid}-sacola"><path d="M{cx-62},{cy-36} Q{cx},{cy-46} {cx+62},{cy-36} L{cx+50},{cy+76} Q{cx},{cy+84} {cx-50},{cy+76} Z"/></clipPath>
    <linearGradient id="{gid}-base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A2622"/><stop offset="1" stop-color="#0E0D0B"/></linearGradient>
    <linearGradient id="{gid}-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
  </defs>'''
    k = v["kind"]
    border = network_band(cid, seed=100 + n, line=v["accent"] if k not in ("emblem-light",) else BROWN)
    if k == "emblem":
        center = emblem(cx, cy, 78, seed=n)
    elif k == "emblem-dark":
        center = emblem(cx, cy, 78, seed=n, ring=ORANGE, disc=BROWN, inner=CREAM, line=ORANGE)
    elif k == "emblem-light":
        center = emblem(cx, cy, 78, seed=n, ring=BROWN, disc=CREAM, inner=ORANGE, bag=BLACK, ink=CREAM, line=BROWN)
    elif k == "fullnet":
        center = (f'<g clip-path="url(#{cid}-painel)">{network_disc(cx, cy, 150, seed=n, node_scale=1.1)}</g>'
                  f'<circle cx="{cx + 2}" cy="{cy + 4}" r="52" fill="#000" opacity="0.2"/>'
                  f'<circle cx="{cx}" cy="{cy}" r="52" fill="{CREAM}"/>{tote(cx, cy - 4, 0.9)}')
    elif k == "shirt":
        s = dict(shirt="#2A2622", shirt_dark="#0E0D0B", print=CREAM, motif="tote",
                 motif_svg=tote(100, 118, 0.62, bag=CREAM, ink=BLACK, shadow=False), year="2026")
        center = tshirt(s, gid)
    else:  # mono
        my = cy + 10
        center = (f'<path d="M{cx-62},{my-46} Q{cx},{my-56} {cx+62},{my-46} L{cx+50},{my+66} Q{cx},{my+74} {cx-50},{my+66} Z" fill="{BLACK}"/>'
                  f'<g clip-path="url(#{cid}-sacola)" opacity="0.9">{network_disc(cx, my + 10, 96, seed=n + 7, line=ORANGE_D)}</g>'
                  f'<path d="M{cx-30},{my-46} C{cx-30},{my-84} {cx+30},{my-84} {cx+30},{my-46}" fill="none" stroke="{BLACK}" stroke-width="11" stroke-linecap="round"/>'
                  f'<rect x="{cx-44}" y="{my-6}" width="88" height="44" rx="4" fill="{CREAM}"/>'
                  f'<text x="{cx}" y="{my+26}" text-anchor="middle" font-family="{SANS}" font-weight="800" font-size="34" letter-spacing="-1" fill="{BLACK}">FAI</text>')
    txt = v["txt"]
    body = f'''
  {perforated_paper()}
  <rect id="moldura" x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="{v["ground"]}"/>
  {border}
  <rect id="painel" x="28" y="28" width="{W-56}" height="{H-56}" fill="{v["panel"]}"/>
  <rect x="32" y="32" width="{W-64}" height="{H-64}" fill="none" stroke="{v["accent"]}" stroke-width="0.9" opacity="0.7"/>
  <g id="centro">{center}</g>
  <g id="tipografia" font-family="{SANS}" fill="{txt}">
    <text x="{W/2}" y="48" text-anchor="middle" font-size="7.2" letter-spacing="2.2" font-weight="500">SÉRIE FASHION AI · Nº {n:02d}</text>
    <text x="{W/2}" y="70" text-anchor="middle" font-size="19" font-weight="700" letter-spacing="0.5">FASHION AI</text>
    <text x="40" y="{H-42}" font-size="7" letter-spacing="1.4" font-weight="500" opacity="0.85">{v["title"].upper()}</text>
    <text x="40" y="{H-31}" font-family="{SERIF}" font-style="italic" font-size="7.5" opacity="0.75">{v["tag"]}</text>
  </g>
  <g id="denominacao" transform="translate({W-56},{H-52})">
    <circle r="17" fill="{v["accent"]}"/>
    <circle r="14" fill="none" stroke="{v["panel"]}" stroke-width="0.8" opacity="0.6"/>
    <text y="4" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="11" letter-spacing="-0.3" fill="{badge_text(v)}">2026</text>
  </g>'''
    if standalone:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
                f'<title>Fashion AI · {v["title"]} Nº{n:02d}</title>{defs}<g id="fai-{n:02d}">{body}</g></svg>')
    return f'{defs}<g id="fai-{n:02d}" transform="translate({ox},{oy})">{body}</g>'


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "svg-fai"), exist_ok=True)
    for v in VARS:
        with open(os.path.join(OUT, "svg-fai", f'{v["n"]:02d}-fai-{v["title"].lower().replace(" ", "-").replace("í", "i")}.svg'), "w") as f:
            f.write(stamp(v))
    cols, gap = 3, 28
    SW = cols * W + (cols + 1) * gap
    rows = math.ceil(len(VARS) / cols)
    SH = rows * H + (rows + 1) * gap
    parts = [stamp(v, False, gap + (i % cols) * (W + gap), gap + (i // cols) * (H + gap)) for i, v in enumerate(VARS)]
    with open(os.path.join(OUT, "folha-fashion-ai.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}" height="{SH}" viewBox="0 0 {SW} {SH}">'
                f'<title>Folha de selos · Fashion AI</title><rect width="{SW}" height="{SH}" fill="#DAD6CC"/>{"".join(parts)}</svg>')
    print("ok", len(VARS), SW, SH)
