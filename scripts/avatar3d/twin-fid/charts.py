"""
TWIN-FID: gráficos do relatório (SVG com tema claro e escuro), lidos só do agregado (sem rostos e sem nomes).
Uso: python3 charts.py <agregado.json> <body-antes.json> <body-depois.json> <pasta de saída>
"""
import json, sys, random, statistics as st
agg, before, after, outdir = sys.argv[1:5]
A = json.load(open(agg)); B0 = json.load(open(before)); B1 = json.load(open(after))
random.seed(7)
STYLE = """<style>
.bg{fill:#fcfcfb}.t{fill:#0b0b0b;font:600 15px system-ui,-apple-system,Segoe UI,sans-serif}.s{fill:#52514e;font:12px system-ui,-apple-system,Segoe UI,sans-serif}
.m{fill:#6f6e69;font:11px system-ui,-apple-system,Segoe UI,sans-serif}.g{stroke:#e4e3de;stroke-width:1}.ax{stroke:#a9a8a2;stroke-width:1}
.th{stroke:#52514e;stroke-width:1.5;stroke-dasharray:4 3}.s1{fill:#2a78d6}.s2{fill:#eb6834}.ctx{fill:#a9a8a2;fill-opacity:.55}.ring{stroke:#fcfcfb;stroke-width:2}
.med{stroke:#0b0b0b;stroke-width:2}.l1{stroke:#2a78d6;stroke-width:2}.l2{stroke:#eb6834;stroke-width:2}
@media (prefers-color-scheme:dark){.bg{fill:#1a1a19}.t{fill:#fff}.s{fill:#c3c2b7}.m{fill:#9d9c94}.g{stroke:#33332f}.ax{stroke:#5d5c57}.th{stroke:#c3c2b7}
.s1{fill:#3987e5}.s2{fill:#d95926}.ctx{fill:#6f6e69}.ring{stroke:#1a1a19}.med{stroke:#fff}.l1{stroke:#3987e5}.l2{stroke:#d95926}}
</style>"""
def svg(w, h, body, title, desc):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>{STYLE}<rect class="bg" width="{w}" height="{h}" rx="6"/>{body}</svg>'
f2 = lambda v: f"{v:.2f}".replace(".", ",")
tick = lambda t: f"{t:+d}" if t else "0"
# ---------------- 1) própria foto × fotos de outras pessoas
W, x0, x1 = 760, 150, 730; lo, hi = -0.2, 0.8; X = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0)
rows = [("face", "Frente"), ("face34", "Três quartos")]
b = [f'<text class="t" x="20" y="30">Semelhança do gêmeo com a própria foto e com fotos de outras pessoas</text>',
     f'<text class="s" x="20" y="50">Cosseno SFace entre o render do avatar e cada foto do conjunto ({A["A"]["retratos"]} retratos; {A["A"]["montados"]} avatares montados)</text>']
top = 80; rh = 92
for t in [i / 10 for i in range(-2, 9, 2)]:
    b.append(f'<line class="g" x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{top}" y2="{top + rh * 2}"/><text class="m" x="{X(t):.1f}" y="{top + rh * 2 + 16}" text-anchor="middle">{f2(t)}</text>')
for i, (v, lab) in enumerate(rows):
    y = top + i * rh; cy = y + rh / 2
    b.append(f'<text class="s" x="20" y="{cy + 4:.1f}">{lab}</text><line class="ax" x1="{x0}" x2="{x1}" y1="{y + rh:.1f}" y2="{y + rh:.1f}"/>')
    imp = A["distribuicoes"]["impostor"][v]; gen = A["distribuicoes"]["genuino"][v]
    for s in imp: b.append(f'<circle class="ctx" cx="{X(s):.1f}" cy="{cy + random.uniform(-26, 26):.1f}" r="3"/>')
    for s in gen: b.append(f'<circle class="s1 ring" cx="{X(s):.1f}" cy="{cy + random.uniform(-14, 14):.1f}" r="5"/>')
    b.append(f'<line class="med" x1="{X(st.median(gen)):.1f}" x2="{X(st.median(gen)):.1f}" y1="{cy - 30:.1f}" y2="{cy + 30:.1f}"/>')
    b.append(f'<text class="m" x="{X(st.median(gen)) + 6:.1f}" y="{cy - 22:.1f}">mediana {f2(st.median(gen))}</text>')
xt = X(0.363); b.append(f'<line class="th" x1="{xt:.1f}" x2="{xt:.1f}" y1="{top - 6}" y2="{top + rh * 2}"/><text class="m" x="{xt + 4:.1f}" y="{top - 8}">limiar de mesma pessoa 0,363</text>')
ly = top + rh * 2 + 40
b.append(f'<circle class="s1" cx="30" cy="{ly - 4}" r="5"/><text class="s" x="42" y="{ly}">avatar × foto da própria pessoa</text><circle class="ctx" cx="260" cy="{ly - 4}" r="4"/><text class="s" x="272" y="{ly}">avatar × foto de outra pessoa</text>')
open(f"{outdir}/twin-fid-semelhanca.svg", "w").write(svg(W, ly + 16, "".join(b), "Semelhança do gêmeo digital", "Pontos azuis: cosseno SFace do avatar com a foto da própria pessoa; pontos cinza: com fotos de outras pessoas. Limiar 0,363."))
# ---------------- 2) robustez a variações de captura
conds = [("orig", "Foto original"), ("warm", "Luz quente"), ("cool", "Luz fria"), ("dark", "Exposição −38%"), ("half", "Meia resolução"), ("tilt", "Cabeça inclinada 5°"), ("oculos", "Armação de grau")]
lo, hi = 0.0, 0.8; X = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0); rh = 40; top = 80
b = [f'<text class="t" x="20" y="30">Mesmo gêmeo sob luz, resolução, inclinação e óculos diferentes</text>',
     f'<text class="s" x="20" y="50">SFace do avatar (frente) × foto ORIGINAL; até 6 pessoas por condição (recusadas ficam fora); traço = mediana</text>']
for t in [i / 10 for i in range(0, 9, 2)]:
    b.append(f'<line class="g" x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{top}" y2="{top + rh * len(conds)}"/><text class="m" x="{X(t):.1f}" y="{top + rh * len(conds) + 16}" text-anchor="middle">{f2(t)}</text>')
for i, (c, lab) in enumerate(conds):
    cy = top + i * rh + rh / 2
    vals = A["distribuicoes"]["robustez"]["original" if c == "orig" else c]
    b.append(f'<text class="s" x="20" y="{cy + 4:.1f}">{lab}</text>')
    for v in vals: b.append(f'<circle class="s1 ring" cx="{X(v):.1f}" cy="{cy + random.uniform(-8, 8):.1f}" r="5"/>')
    if vals:
        m = st.median(vals); b.append(f'<line class="med" x1="{X(m):.1f}" x2="{X(m):.1f}" y1="{cy - 13:.1f}" y2="{cy + 13:.1f}"/><text class="m" x="{x1 + 4}" y="{cy + 4:.1f}" text-anchor="end">{f2(m)}</text>')
xt = X(0.363); b.append(f'<line class="th" x1="{xt:.1f}" x2="{xt:.1f}" y1="{top - 6}" y2="{top + rh * len(conds)}"/><text class="m" x="{xt + 4:.1f}" y="{top - 8}">limiar 0,363</text>')
open(f"{outdir}/twin-fid-robustez.svg", "w").write(svg(W, top + rh * len(conds) + 30, "".join(b), "Robustez do gêmeo digital", "Para cada condição de captura, cosseno SFace do avatar com a foto original de 6 pessoas; traço preto é a mediana."))
# ---------------- 3) corpos: diferença pedida × obtida
W3, H3 = 760, 470; px0, px1, py0, py1 = 90, 520, 400, 80; lo, hi = -4, 6
PX = lambda v: px0 + (v - lo) / (hi - lo) * (px1 - px0); PY = lambda v: py0 - (v - lo) / (hi - lo) * (py0 - py1)
b = [f'<text class="t" x="20" y="30">Corpos paramétricos: o que foi pedido × o que a malha entregou</text>',
     f'<text class="s" x="20" y="50">Diferença ao corpo típico do sexo, em cm ({sum(1 for r in B1 for m in r["measures"].values() if abs(m["deltaAsked"]) >= 0.01)} medidas pedidas diferentes do típico, 6 perfis); diagonal = fidelidade perfeita</text>']
for t in range(lo, hi + 1, 2):
    b.append(f'<line class="g" x1="{PX(t):.1f}" x2="{PX(t):.1f}" y1="{py1}" y2="{py0}"/><line class="g" x1="{px0}" x2="{px1}" y1="{PY(t):.1f}" y2="{PY(t):.1f}"/>')
    b.append(f'<text class="m" x="{PX(t):.1f}" y="{py0 + 16}" text-anchor="middle">{tick(t)}</text><text class="m" x="{px0 - 8}" y="{PY(t) + 4:.1f}" text-anchor="end">{tick(t)}</text>')
b.append(f'<line class="ax" x1="{PX(lo):.1f}" y1="{PY(lo):.1f}" x2="{PX(hi):.1f}" y2="{PY(hi):.1f}"/><text class="m" x="{(px0 + px1) / 2:.0f}" y="{py0 + 34}" text-anchor="middle">pedido (cm)</text><text class="m" x="26" y="{(py0 + py1) / 2:.0f}" transform="rotate(-90 26 {(py0 + py1) / 2:.0f})" text-anchor="middle">obtido na malha (cm)</text>')
def pts(rows, cls, r):
    out = []
    for row in rows:
        for k, m in row["measures"].items():
            if abs(m["deltaAsked"]) < 0.01: continue
            out.append(f'<circle class="{cls} ring" cx="{PX(m["deltaAsked"]):.1f}" cy="{PY(m["deltaGot"]):.1f}" r="{r}"/>')
    return out
b += pts(B0, "s2", 5) + pts(B1, "s1", 5)
err = lambda R: (sum(m["errCm"] for r in R for m in r["measures"].values()) / sum(len(r["measures"]) for r in R), max(m["errCm"] for r in R for m in r["measures"].values()))
e0, e1 = err(B0), err(B1)
lx = 545
b.append(f'<circle class="s2" cx="{lx}" cy="96" r="5"/><text class="s" x="{lx + 12}" y="100">antes (peso 1 no ajuste)</text><text class="m" x="{lx + 12}" y="116">erro médio {f2(e0[0])} cm · máx. {f2(e0[1])} cm</text>')
b.append(f'<circle class="s1" cx="{lx}" cy="146" r="5"/><text class="s" x="{lx + 12}" y="150">depois (peso 4 no ajuste)</text><text class="m" x="{lx + 12}" y="166">erro médio {f2(e1[0])} cm · máx. {f2(e1[1])} cm</text>')
b.append(f'<text class="m" x="{lx}" y="200">Estatura: erro 0 cm nos 6 perfis.</text><text class="m" x="{lx}" y="216">Maior desvio: quadril +4,7 cm pedido</text><text class="m" x="{lx}" y="232">(F3) — antes +3,0, depois +3,9 cm.</text>')
open(f"{outdir}/twin-fid-corpos.svg", "w").write(svg(W3, H3, "".join(b), "Fidelidade dos corpos paramétricos", "Dispersão: diferença pedida (x) e obtida (y) em cm para 6 perfis de corpo, antes e depois do ajuste de peso das medidas informadas."))
print("ok", e0, e1)
