import math, os, html

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 240, 300
PAPER = "#FBF9F4"
INK = "#15151A"
SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"

# ground = frame/border colour, panel = inner vignette ground, accent = highlight,
# shirt = tee colour, print = colour of chest print, border = pattern type
STAMPS = [
    # ---- Série Streetwear -------------------------------------------------
    dict(series="SÉRIE STREETWEAR", n=1, name="NIKE", tag="Performance · Movimento",
         place="Beaverton, Oregon", year="1964", ground="#111111", panel="#1C1C1C",
         accent="#DFFF00", shirt="#DFFF00", shirt_dark="#B9D400", print="#111111",
         border="hatch", motif="slash", txt="#FBF9F4"),
    dict(series="SÉRIE STREETWEAR", n=2, name="ADIDAS", tag="Esporte · Herança",
         place="Herzogenaurach, DE", year="1949", ground="#1A1A1A", panel="#F2F0EA",
         accent="#FBF9F4", shirt="#F7F5F0", shirt_dark="#CFCBC2", print="#1A1A1A",
         border="bars", motif="year", txt="#15151A"),
    dict(series="SÉRIE STREETWEAR", n=3, name="PUMA", tag="Velocidade · Atitude",
         place="Herzogenaurach, DE", year="1948", ground="#C8102E", panel="#15151A",
         accent="#FBF9F4", shirt="#1A1A1A", shirt_dark="#050505", print="#C8102E",
         border="chevron", motif="arc", txt="#FBF9F4"),
    dict(series="SÉRIE STREETWEAR", n=4, name="NEW BALANCE", tag="Conforto · Tradição",
         place="Boston, MA", year="1906", ground="#1F2A44", panel="#E8E6E1",
         accent="#C8102E", shirt="#9AA0A6", shirt_dark="#6E747A", print="#1F2A44",
         border="check", motif="year", txt="#15151A"),
    dict(series="SÉRIE STREETWEAR", n=5, name="JORDAN", tag="Basquete · Lenda",
         place="Chicago, Illinois", year="1985", ground="#CE1141", panel="#15151A",
         accent="#FBF9F4", shirt="#15151A", shirt_dark="#000000", print="#CE1141",
         border="diamond", motif="23", txt="#FBF9F4"),
    # ---- Série Ícones -----------------------------------------------------
    dict(series="SÉRIE ÍCONES", n=6, name="RIHANNA", tag="Música · Beleza · Moda",
         place="Bridgetown, Barbados", year="1988", ground="#5A1A24", panel="#2A0F14",
         accent="#C9A86A", shirt="#6B1F2A", shirt_dark="#3F1119", print="#C9A86A",
         border="pearls", motif="star", txt="#F3E6CF"),
    dict(series="SÉRIE ÍCONES", n=7, name="PHARRELL", tag="Produtor · Diretor Criativo",
         place="Virginia Beach, VA", year="1973", ground="#F2C14E", panel="#1B2A4A",
         accent="#F2C14E", shirt="#1B2A4A", shirt_dark="#0F1A30", print="#F2C14E",
         border="rays", motif="sun", txt="#FBF3DC"),
    dict(series="SÉRIE ÍCONES", n=8, name="ZENDAYA", tag="Atriz · Ícone de Estilo",
         place="Oakland, Califórnia", year="1996", ground="#7B5EA7", panel="#F1ECF7",
         accent="#15151A", shirt="#15151A", shirt_dark="#000000", print="#C9B6E8",
         border="dots", motif="mono", txt="#2B2140"),
    dict(series="SÉRIE ÍCONES", n=9, name="HARRY STYLES", tag="Música · Pleasing",
         place="Redditch, Inglaterra", year="1994", ground="#F4A7B9", panel="#FBF6EE",
         accent="#3E7C59", shirt="#FBF6EE", shirt_dark="#D9CFBF", print="#F4A7B9",
         border="waves", motif="pearls", txt="#3E3A36"),
    dict(series="SÉRIE ÍCONES", n=10, name="BAD BUNNY", tag="Reggaetón · Cultura",
         place="Vega Baja, Porto Rico", year="1994", ground="#FF6F3C", panel="#1B4332",
         accent="#FF6F3C", shirt="#2D6A4F", shirt_dark="#1B4332", print="#FF6F3C",
         border="stars", motif="pr", txt="#FFF1E8"),
]


def luminance(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def badge_text(s):
    """Year sits on the accent disc: pick the palette colour that contrasts most with it."""
    la = luminance(s["accent"])
    candidates = [c for c in (s["ground"], s["panel"], INK, PAPER) if c != s["accent"]]
    return max(candidates, key=lambda c: abs(luminance(c) - la))


def perforated_paper():
    """Paper rect with punch holes as one evenodd compound path (native AI compound path)."""
    r, pitch = 4.2, 12
    d = [f"M0,0 H{W} V{H} H0 Z"]
    def hole(cx, cy):
        d.append(f"M{cx-r:.1f},{cy:.1f} a{r},{r} 0 1,0 {2*r},0 a{r},{r} 0 1,0 {-2*r},0 Z")
    for y in range(6, H, pitch):
        hole(0, y); hole(W, y)
    for x in range(6, W, pitch):
        hole(x, 0); hole(x, H)
    return f'<path id="papel" fill="{PAPER}" fill-rule="evenodd" d="{" ".join(d)}"/>'


def border_pattern(kind, color, cid):
    """Explicit repeated shapes clipped to the frame band (no <pattern>, imports cleanly)."""
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    els = []
    sw = 'stroke-width="1.2"'
    if kind == "hatch":
        for i in range(-300, 600, 9):
            els.append(f'<line x1="{i}" y1="{y0}" x2="{i+300}" y2="{y1}" stroke="{color}" {sw}/>')
    elif kind == "bars":
        for y in range(y0 + 3, y1, 6):
            els.append(f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{color}" stroke-width="1.6"/>')
    elif kind == "chevron":
        for y in range(y0 - 8, y1 + 8, 10):
            pts = " ".join(f"{x},{y + (5 if (x // 6) % 2 else 0)}" for x in range(x0 - 6, x1 + 7, 6))
            els.append(f'<polyline points="{pts}" fill="none" stroke="{color}" {sw}/>')
    elif kind == "check":
        for i in range(x0, x1, 7):
            els.append(f'<line x1="{i}" y1="{y0}" x2="{i}" y2="{y1}" stroke="{color}" stroke-width="0.9"/>')
        for j in range(y0, y1, 7):
            els.append(f'<line x1="{x0}" y1="{j}" x2="{x1}" y2="{j}" stroke="{color}" stroke-width="0.9"/>')
    elif kind == "diamond":
        for y in range(y0, y1 + 10, 10):
            for x in range(x0, x1 + 10, 10):
                els.append(f'<polygon points="{x},{y-4} {x+4},{y} {x},{y+4} {x-4},{y}" fill="none" stroke="{color}" stroke-width="1"/>')
    elif kind == "dots":
        for y in range(y0 + 4, y1, 8):
            for x in range(x0 + 4, x1, 8):
                els.append(f'<circle cx="{x}" cy="{y}" r="1.6" fill="{color}"/>')
    elif kind == "pearls":
        for y in range(y0 + 5, y1, 10):
            for x in range(x0 + 5, x1, 10):
                els.append(f'<circle cx="{x}" cy="{y}" r="3" fill="{color}" opacity="0.9"/>'
                           f'<circle cx="{x-1}" cy="{y-1}" r="1" fill="{PAPER}" opacity="0.8"/>')
    elif kind == "rays":
        cx, cy = W / 2, H / 2
        for a in range(0, 360, 6):
            t = math.radians(a)
            els.append(f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{cx+260*math.cos(t):.1f}" y2="{cy+260*math.sin(t):.1f}" stroke="{color}" stroke-width="1.4"/>')
    elif kind == "waves":
        for y in range(y0, y1 + 10, 8):
            d = f"M{x0-8},{y}"
            for x in range(x0 - 8, x1 + 16, 8):
                d += f" q4,-4 8,0 q4,4 8,0"
            els.append(f'<path d="{d}" fill="none" stroke="{color}" {sw}/>')
    elif kind == "stars":
        for y in range(y0 + 5, y1, 11):
            for x in range(x0 + 5, x1, 11):
                els.append(f'<polygon points="{x},{y-3.5} {x+1},{y-1} {x+3.5},{y} {x+1},{y+1} {x},{y+3.5} {x-1},{y+1} {x-3.5},{y} {x-1},{y-1}" fill="{color}"/>')
    return f'<g id="borda-padrao" clip-path="url(#{cid})" opacity="0.55">{"".join(els)}</g>'


def tshirt(s, gid):
    """Flat-3D tee: base gradient, sleeve seams, collar rib, fold highlights, contact shadow."""
    p = s["print"]
    body = ("M72,26 C84,18 116,18 128,26 L166,44 L182,88 L150,100 L146,178 "
            "L54,178 L50,100 L18,88 L34,44 Z")
    motif = {
        "slash": f'<g transform="translate(100,112)"><path d="M-34,26 L-6,-26" stroke="{p}" stroke-width="10" stroke-linecap="round"/><path d="M-6,26 L22,-26" stroke="{p}" stroke-width="10" stroke-linecap="round"/><path d="M22,26 L50,-26" stroke="{p}" stroke-width="10" stroke-linecap="round" opacity="0.55"/></g>',
        "year": f'<text x="100" y="128" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="40" letter-spacing="-1" fill="{p}">{s["year"]}</text>',
        "arc": f'<g transform="translate(100,112)"><path d="M-44,20 C-30,-30 30,-30 44,20" fill="none" stroke="{p}" stroke-width="9" stroke-linecap="round"/><circle cx="44" cy="20" r="7" fill="{p}"/></g>',
        "23": f'<text x="100" y="134" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="54" letter-spacing="-2" fill="{p}">23</text>',
        "star": f'<g transform="translate(100,112) scale(1.3)"><polygon points="0,-26 7,-9 26,-8 11,4 16,22 0,12 -16,22 -11,4 -26,-8 -7,-9" fill="{p}"/></g>',
        "sun": f'<g transform="translate(100,112)"><circle r="16" fill="{p}"/>' + "".join(f'<line x1="{24*math.cos(math.radians(a)):.1f}" y1="{24*math.sin(math.radians(a)):.1f}" x2="{34*math.cos(math.radians(a)):.1f}" y2="{34*math.sin(math.radians(a)):.1f}" stroke="{p}" stroke-width="4" stroke-linecap="round"/>' for a in range(0, 360, 30)) + '</g>',
        "mono": f'<text x="100" y="134" text-anchor="middle" font-family="{SERIF}" font-style="italic" font-size="60" fill="{p}">Z</text>',
        "pearls": '<g>' + "".join(f'<circle cx="{100+40*math.cos(math.radians(a)):.1f}" cy="{112+30*math.sin(math.radians(a)):.1f}" r="4.5" fill="{p}"/>' for a in range(0, 360, 24)) + '</g>',
        "pr": f'<text x="100" y="130" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="44" letter-spacing="2" fill="{p}">PR</text>',
    }.get(s["motif"], s.get("motif_svg", ""))
    return f'''
  <g id="camisa" transform="translate(58,104) scale(0.62)">
    <ellipse cx="100" cy="184" rx="66" ry="7" fill="#000" opacity="0.28"/>
    <path d="{body}" fill="url(#{gid}-base)"/>
    <path d="{body}" fill="url(#{gid}-side)"/>
    <path d="M34,44 L50,100 L54,96 Z" fill="#000" opacity="0.14"/>
    <path d="M166,44 L150,100 L146,96 Z" fill="#000" opacity="0.10"/>
    <path d="M50,100 L18,88" stroke="#000" opacity="0.18" stroke-width="1.5"/>
    <path d="M150,100 L182,88" stroke="#000" opacity="0.18" stroke-width="1.5"/>
    <path d="M56,172 L144,172" stroke="#000" opacity="0.12" stroke-width="1.5"/>
    <path d="M60,110 C66,140 62,160 66,176" stroke="#fff" opacity="0.10" stroke-width="3" fill="none"/>
    <path d="M136,108 C132,136 138,158 134,176" stroke="#000" opacity="0.10" stroke-width="3" fill="none"/>
    <path d="M72,26 C84,40 116,40 128,26" fill="{s["shirt_dark"]}"/>
    <path d="M76,26 C86,36 114,36 124,26" fill="none" stroke="#fff" opacity="0.18" stroke-width="1.2"/>
    {motif}
  </g>'''


def stamp_svg(s, standalone=True, ox=0, oy=0):
    n = s["n"]; cid = f"clip{n}"; gid = f"g{n}"
    x0, y0, x1, y1 = 10, 10, W - 10, H - 10
    defs = f'''
  <defs>
    <clipPath id="{cid}"><path fill-rule="evenodd" d="M{x0},{y0} H{x1} V{y1} H{x0} Z M28,28 H{W-28} V{H-28} H28 Z"/></clipPath>
    <linearGradient id="{gid}-base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{s["shirt"]}"/><stop offset="1" stop-color="{s["shirt_dark"]}"/>
    </linearGradient>
    <linearGradient id="{gid}-side" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/>
    </linearGradient>
  </defs>'''
    txt = s["txt"]
    name_size = 30 if len(s["name"]) <= 7 else (22 if len(s["name"]) <= 11 else 19)
    body = f'''
  {perforated_paper()}
  <rect id="moldura" x="{x0}" y="{y0}" width="{W-20}" height="{H-20}" fill="{s["ground"]}"/>
  {border_pattern(s["border"], s["accent"], cid)}
  <rect id="painel" x="28" y="28" width="{W-56}" height="{H-56}" fill="{s["panel"]}"/>
  <rect x="32" y="32" width="{W-64}" height="{H-64}" fill="none" stroke="{s["accent"]}" stroke-width="0.9" opacity="0.7"/>
  <g id="tipografia" font-family="{SANS}" fill="{txt}">
    <text x="{W/2}" y="48" text-anchor="middle" font-size="7.2" letter-spacing="2.2" font-weight="500">{s["series"]} · Nº {n:02d}</text>
    <text x="{W/2}" y="82" text-anchor="middle" font-size="{name_size}" font-weight="700" letter-spacing="{-0.5 if name_size > 24 else 0.5}">{html.escape(s["name"])}</text>
    <text x="{W/2}" y="96" text-anchor="middle" font-family="{SERIF}" font-style="italic" font-size="9.5" opacity="0.85">{s["tag"]}</text>
    <line x1="60" y1="103" x2="{W-60}" y2="103" stroke="{s["accent"]}" stroke-width="0.8" opacity="0.6"/>
    <text x="40" y="{H-42}" font-size="7" letter-spacing="1.4" font-weight="500" opacity="0.85">{s["place"].upper()}</text>
    <text x="40" y="{H-31}" font-family="{SERIF}" font-style="italic" font-size="7.5" opacity="0.7">Edição colecionador · vetor</text>
  </g>
  {tshirt(s, gid)}
  <g id="denominacao" transform="translate({W-56},{H-52})">
    <circle r="17" fill="{s["accent"]}"/>
    <circle r="14" fill="none" stroke="{s["panel"]}" stroke-width="0.8" opacity="0.6"/>
    <text y="4" text-anchor="middle" font-family="{SANS}" font-weight="700" font-size="11" letter-spacing="-0.3" fill="{badge_text(s)}">{s["year"]}</text>
  </g>'''
    if standalone:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
                f'<title>{html.escape(s["name"])} · {s["series"]} Nº{n:02d}</title>{defs}<g id="selo-{n:02d}">{body}</g></svg>')
    return f'{defs}<g id="selo-{n:02d}" transform="translate({ox},{oy})">{body}</g>'


def slug(s):
    return f'{s["n"]:02d}-{s["name"].lower().replace(" ", "-")}'


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)
    for s in STAMPS:
        with open(os.path.join(OUT, "svg", slug(s) + ".svg"), "w") as f:
            f.write(stamp_svg(s))
    cols, gap = 5, 28
    SW = cols * W + (cols + 1) * gap
    rows = math.ceil(len(STAMPS) / cols)
    SH = rows * H + (rows + 1) * gap
    parts = []
    for i, s in enumerate(STAMPS):
        parts.append(stamp_svg(s, standalone=False,
                               ox=gap + (i % cols) * (W + gap), oy=gap + (i // cols) * (H + gap)))
    sheet = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}" height="{SH}" viewBox="0 0 {SW} {SH}">'
             f'<title>Folha de selos · Streetwear + Ícones</title><rect width="{SW}" height="{SH}" fill="#DAD6CC"/>'
             + "".join(parts) + '</svg>')
    with open(os.path.join(OUT, "folha-de-selos.svg"), "w") as f:
        f.write(sheet)
    print("ok", len(STAMPS))
