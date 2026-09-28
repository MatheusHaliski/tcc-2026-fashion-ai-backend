#!/usr/bin/env python3
"""
RF4 — prova da detecção de marca: envia cada caso de scripts/marcas/gerar-casos.py para a análise real da peça
(POST /api/pieces/analysis) de um backend local e, quando a marca não sai confirmada, para a nova busca em
sub-retângulos (POST /api/pieces/analysis/{id}/brand?grid=3, 4, 5). Grava resultados.json e a planilha .xlsx.

Uso: python3 scripts/marcas/testar-deteccao.py <pasta-dos-casos> <token-de-acesso> [saida.xlsx] [http://localhost:8080]
A IA remota pode estar desligada (AI_REMOTE_ENABLED=false): aí a prova é do leitor de texto do próprio servidor.
"""
import json, os, sys, time, unicodedata, urllib.request, uuid

DIR, TOKEN = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(DIR, "deteccao-de-marca.xlsx")
API = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:8080"


def call(method, path, fields=None, file=None):
    headers = {"Authorization": f"Bearer {TOKEN}"}
    data = None
    if file:
        b = uuid.uuid4().hex; parts = []
        for k, v in (fields or {}).items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(file)}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
                     + open(file, "rb").read() + b"\r\n")
        parts.append(f"--{b}--\r\n".encode()); data = b"".join(parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={b}"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read() or b"{}"), time.time() - t0
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}"), time.time() - t0


def key(s):
    return "".join(c for c in unicodedata.normalize("NFD", (s or "").lower()) if c.isalnum())


NO_BRAND = {"semmarca", "nobrand", "sinmarca"}
cases = json.load(open(os.path.join(DIR, "casos.json")))
rows = []
for c in cases:
    d, dt = call("POST", "/api/pieces/analysis", {"category": c["category"]}, os.path.join(DIR, c["file"]))
    p = d.get("prefill") or {}; bs = p.get("brandSearch") or {}
    # "Sem marca" é o texto que a análise põe no campo quando não acha marca (o campo nunca fica vazio): não é marca
    found = p.get("brand") or bs.get("brand")
    found = None if key(found) in NO_BRAND else found
    r = {**c, "analysis_s": round(dt, 2), "error": d.get("code"), "brand": found, "suggestion": bs.get("suggestion"),
         "foundIn": bs.get("foundIn"), "certainty": bs.get("certainty"), "evidence": bs.get("evidence"), "source": bs.get("logoSource"),
         "retry": None, "retry_s": 0.0}
    if d.get("draftId") and not r["brand"] and c["expected"]:
        for g in (3, 4, 5):
            rr, t2 = call("POST", f"/api/pieces/analysis/{d['draftId']}/brand?grid={g}")
            r["retry_s"] = round(r["retry_s"] + t2, 2)
            if rr.get("brand"):
                r["retry"] = f"grade {g}×{g}"; r["brand"] = rr["brand"] if rr.get("certainty") == "confirmada" else None
                r["suggestion"] = rr["brand"] if rr.get("certainty") != "confirmada" else r["suggestion"]
                r["foundIn"], r["certainty"], r["evidence"], r["source"] = rr.get("region"), rr.get("certainty"), rr.get("evidence"), rr.get("source")
                break
    exp = c["expected"]
    if exp is None:
        ok = not r["brand"] and not r["suggestion"]
    elif "fora do catálogo" in exp:
        ok = key(r["suggestion"]) == key(exp.split(" ")[0]) and not r["brand"]
    else:
        ok = key(r["brand"]) == key(exp)
    r["ok"] = ok
    rows.append(r)
    print(f"{c['id']:02d} {exp!s:28} → {r['brand'] or r['suggestion'] or '—':18} {r['certainty'] or '':10} {r['foundIn'] or '':16} {'OK' if ok else 'FALHOU'} {r['analysis_s']}s{' + retry ' + r['retry'] if r['retry'] else ''}")

json.dump(rows, open(os.path.join(DIR, "resultados.json"), "w"), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ planilha
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from PIL import Image

wb = Workbook(); ws = wb.active; ws.title = "Casos"
head = ["#", "Foto do caso", "Tipo", "Marca esperada", "Onde está na peça", "Variação testada", "Marca lida", "Estado", "Região achada",
        "Texto lido (OCR)", "Quem leu", "Nova busca", "Tempo análise (s)", "Tempo nova busca (s)", "Resultado"]
ws.append(head)
H = Font(bold=True, color="FFFFFF"); HF = PatternFill("solid", fgColor="1F2A44"); thin = Side(style="thin", color="D0D0D0")
for i, h in enumerate(head, 1):
    cell = ws.cell(row=1, column=i); cell.font = H; cell.fill = HF; cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
widths = [5, 16, 12, 18, 16, 34, 16, 12, 18, 18, 12, 12, 11, 11, 11]
for i, w in enumerate(widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w
TYPE = {"upper_piece": "Parte de cima", "lower_piece": "Parte de baixo", "shoes_piece": "Calçado", "full_body_piece": "Corpo inteiro"}
STATE = {"confirmada": "Confirmada", "possivel": "Possível"}
ZONE = {"gola": "fundo da gola", "peito_esquerdo": "peito esquerdo", "peito_direito": "peito direito", "centro_peito": "centro do peito", "peca": "peça inteira",
        "logo": "área do logo", "cos": "cós"}
thumbs = os.path.join(DIR, "_thumbs"); os.makedirs(thumbs, exist_ok=True)
for n, r in enumerate(rows, start=2):
    zone = r["foundIn"] or ""
    zone = ZONE.get(zone, zone.replace("grade_r", "grade linha ").replace("c", ", coluna ") if zone.startswith("grade_") else zone)
    ws.append([r["id"], "", TYPE.get(r["category"], r["category"]), r["expected"] or "(sem marca)", r["region"], r["variation"],
               r["brand"] or (f"{r['suggestion']} (sugestão)" if r["suggestion"] else "—"), STATE.get(r["certainty"], "—"), zone or "—",
               r["evidence"] or "—", {"ocr": "Leitor do servidor", "ia": "IA de visão"}.get(r["source"], "—" if not (r["brand"] or r["suggestion"]) else "Análise"),
               r["retry"] or "não precisou", r["analysis_s"], r["retry_s"] or "", "OK" if r["ok"] else "FALHOU"])
    ws.row_dimensions[n].height = 92
    t = Image.open(os.path.join(DIR, r["file"])); t.thumbnail((100, 120)); tp = os.path.join(thumbs, f"{r['id']:02d}.png"); t.save(tp)
    img = XLImage(tp); ws.add_image(img, f"B{n}")
    res = ws.cell(row=n, column=15); res.font = Font(bold=True, color="FFFFFF")
    res.fill = PatternFill("solid", fgColor="2E7D32" if r["ok"] else "C62828")
    for col in range(1, 16):
        cl = ws.cell(row=n, column=col); cl.alignment = Alignment(wrap_text=True, vertical="center"); cl.border = Border(top=thin, bottom=thin, left=thin, right=thin)
ws.freeze_panes = "C2"; ws.auto_filter.ref = f"A1:O{len(rows) + 1}"

sm = wb.create_sheet("Resumo")
total = len(rows); ok = sum(r["ok"] for r in rows)
brand_cases = [r for r in rows if r["expected"] and "fora do catálogo" not in r["expected"]]
first = sum(1 for r in brand_cases if r["ok"] and not r["retry"])
retry_ok = sum(1 for r in brand_cases if r["ok"] and r["retry"])
controls = [r for r in rows if not r["expected"]]
fp = sum(1 for r in controls if not r["ok"])
t_an = sorted(r["analysis_s"] for r in rows)
lines = [
    ("Detecção de marca — RF4 (1-Foto)", ""),
    ("Casos testados", total),
    ("Acertos (todos os casos)", f"{ok}/{total} ({ok / total:.0%})"),
    ("Marcas do catálogo lidas na 1ª análise", f"{first}/{len(brand_cases)}"),
    ("Marcas do catálogo lidas só na nova busca (grade)", f"{retry_ok}/{len(brand_cases)}"),
    ("Controles sem marca (lisa, frase de estampa) com falso positivo", f"{fp}/{len(controls)}"),
    ("Marca fora do catálogo tratada como 'possível' (pede confirmação)", "OK" if all(r["ok"] for r in rows if r["expected"] and "fora do catálogo" in r["expected"]) else "FALHOU"),
    ("Tempo da análise (mediana / máximo)", f"{t_an[len(t_an) // 2]:.1f} s / {t_an[-1]:.1f} s"),
    ("", ""),
    ("Como foi testado", "Cada foto passou pela análise real da peça no backend (POST /api/pieces/analysis), com a IA remota desligada: "
     "a marca veio do leitor de texto do próprio servidor (OCR PP-OCRv4 em ONNX) casado com o catálogo de marcas. Quando a marca "
     "não saiu confirmada, o teste chamou a nova busca em sub-retângulos (grade 3×3, 4×4, 5×5)."),
    ("Estados", "Confirmada = texto lido é uma marca do catálogo (igual, a uma letra, ou sem a primeira/última letra); "
     "Possível = palavra com cara de logo fora do catálogo — a tela pergunta 'É essa a marca?'."),
    ("Reproduzir", "python3 scripts/marcas/gerar-casos.py <pasta> && python3 scripts/marcas/testar-deteccao.py <pasta> <token>"),
]
for a, b in lines:
    sm.append([a, b])
sm.column_dimensions["A"].width = 58; sm.column_dimensions["B"].width = 110
sm["A1"].font = Font(bold=True, size=14)
for row in sm.iter_rows(min_row=2):
    row[0].font = Font(bold=True); row[1].alignment = Alignment(wrap_text=True, vertical="top")
wb.move_sheet("Resumo", offset=-1)
wb.save(OUT)
print(f"{ok}/{total} OK — planilha: {OUT}")
