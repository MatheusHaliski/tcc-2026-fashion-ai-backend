"""Monta a pasta de evidências: até 5 fotos por endpoint (cartões requisição→resposta→SQL + telas), galeria HTML por RF.
Uso: python3 pack_evidence.py cards_dir fotos_cartoes_dir ui_dir marcas_dir tabela.json saida_dir"""
import collections, html, json, os, re, shutil, sys
from PIL import Image

cards_dir, photos, ui_dir, brand_dir, tab_json, OUT = sys.argv[1:7]
man = json.load(open(os.path.join(cards_dir, 'manifest.json')))
tab = json.load(open(tab_json))
ui = json.load(open(os.path.join(ui_dir, 'ui_map.json'))) if os.path.exists(os.path.join(ui_dir, 'ui_map.json')) else []
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)


def rf_key(rf):
    m = re.match(r'(RN?F)(\d+)', rf)
    return (0 if m and m.group(1) == 'RF' else 1, int(m.group(2)) if m else 999, rf)


# telas extras por endpoint (cartões primeiro; telas completam até 5)
extra = collections.defaultdict(list)
for u in ui:
    if u.get('ok'):
        for ep in u['endpoints']:
            extra[ep].append((os.path.join(ui_dir, u['name'] + '.png'), 'tela ' + u['url']))
BRAND = {'GET /api/brand-search': ['02_rf4_busca_zar_resultado_com_logo', '03_rf4_zara_escolhida_slot_do_logo', '01_rf4_busca_osklen_status_das_fontes'],
         'POST /api/pieces': ['04_rf4_peca_salva_com_marca_e_logo', '04b_rf4_prova_no_banco_mysql'],
         'POST /api/schemes': ['09_rf5_slots_com_marca_preenchida_pela_peca', '10_rf5_revisao_marca_por_slot'],
         'POST /api/dna-schemes': ['11_rf13_dna_marcas_vindas_das_pecas']}
for ep, names in BRAND.items():
    for n in names:
        p = os.path.join(brand_dir, n + '.png')
        if os.path.exists(p):
            extra[ep].insert(0, (p, n.replace('_', ' ')))

# prova de que a peça existe no guarda-roupa + prova no banco primeiro (pedido para o POST de peça)
def first(ep, *keys):
    lst = extra.get(ep, [])
    extra[ep] = sorted(lst, key=lambda x: next((i for i, k in enumerate(keys) if k in x[0]), len(keys)))


first('POST /api/pieces', 'ui_closet_pecas_criadas', '04b_rf4_prova_no_banco_mysql', '04_rf4_peca_salva')
first('POST /api/schemes', 'ui_look_criado', '09_rf5_slots')
first('GET /api/brand-search', '02_rf4_busca_zar', '03_rf4_zara')

by_ep = collections.OrderedDict()
for m in man:
    by_ep.setdefault(m['endpoint'], []).append(m)
index = collections.defaultdict(list)
count = 0
for ep, ms in by_ep.items():
    rf = ms[0]['rf']
    rfdir = os.path.join(OUT, rf.replace(' ', '_').replace('(', '').replace(')', ''))
    os.makedirs(rfdir, exist_ok=True)
    files = []
    reserve = min(2, len(extra.get(ep, [])))          # até 2 dos 5 lugares ficam para telas reais do app
    for m in ms[:5 - reserve]:
        src = os.path.join(photos, m['file'])
        if os.path.exists(src):
            dst = os.path.join(rfdir, os.path.basename(m['file']))
            shutil.copy(src, dst)
            files.append((os.path.relpath(dst, OUT), f"passo {m['file'].rsplit('__', 1)[-1][:-4]}: {m['desc']} → {m['status']}"))
    slug = os.path.basename(ms[0]['file']).rsplit('__', 1)[0]
    for i, (src, label) in enumerate(extra.get(ep, [])):
        if len(files) >= 5:
            break
        dst = os.path.join(rfdir, f'{slug}__tela{i + 1}.jpg')
        Image.open(src).convert('RGB').save(dst, quality=80)
        files.append((os.path.relpath(dst, OUT), label))
    count += len(files)
    index[rf].append((ep, files, ms))

rows_by_ep = collections.defaultdict(list)
for t in tab:
    rows_by_ep[t['endpoint']].append(t)
H = ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Evidências por endpoint — Fashion AI</title><style>',
     'body{font:14px Inter,Arial,sans-serif;margin:0;background:#F7F6F2;color:#191A19}header{padding:18px 24px;background:#2F3E46;color:#fff}',
     'nav{padding:10px 24px;background:#fff;position:sticky;top:0;border-bottom:1px solid #ddd;z-index:2}nav a{margin-right:8px}',
     'section{padding:10px 24px}h2{margin:18px 0 6px}.ep{background:#fff;border-radius:10px;padding:10px 12px;margin:10px 0}',
     '.ep h3{margin:0 0 6px;font:600 14px ui-monospace,monospace}.row{display:flex;gap:8px;overflow-x:auto}.row a img{height:170px;border:1px solid #ddd;border-radius:6px}',
     '.row figure{margin:0;font-size:11px;color:#5C6058;max-width:260px}table{border-collapse:collapse;font-size:12px;margin-top:6px}td,th{border:1px solid #e1ded4;padding:3px 6px;vertical-align:top}</style></head><body>',
     f'<header><h1 style="margin:0;font-size:20px">Evidências do teste ponta a ponta — {len(by_ep)} endpoints, {count} fotos (no máximo 5 por endpoint)</h1>'
     '<p style="margin:6px 0 0">Cada cartão mostra: 1 requisição · 2 resposta · 3 SQL executado pela API no MySQL (general_log) · 4 mídia gravada · 5 tela do frontend. '
     'As telas completam os cartões nos endpoints de criação.</p></header><nav>']
H += [f'<a href="#{rf}">{rf}</a>' for rf in sorted(index, key=rf_key)]
H.append('</nav>')
for rf in sorted(index, key=rf_key):
    H.append(f'<section id="{rf}"><h2>{rf}</h2>')
    for ep, files, ms in index[rf]:
        H.append(f'<div class="ep"><h3>{html.escape(ep)}</h3><div class="row">')
        for f, label in files:
            H.append(f'<figure><a href="{html.escape(f)}" target="_blank"><img src="{html.escape(f)}" loading="lazy"></a><figcaption>{html.escape(label)}</figcaption></figure>')
        H.append('</div><table><tr><th>CA</th><th>Passo</th><th>Status</th><th>Salvou em qual banco?</th><th>Exibiu no frontend?</th></tr>')
        for t in rows_by_ep.get(ep, [])[:6]:
            H.append(f"<tr><td>{html.escape(t['ca'])}</td><td>{html.escape(t['passo'])}</td><td>{t['status']}</td><td>{html.escape(t['banco'])}</td><td>{html.escape(t['exibe'])}</td></tr>")
        H.append('</table></div>')
    H.append('</section>')
H.append('</body></html>')
open(os.path.join(OUT, 'index.html'), 'w').write('\n'.join(H))
print('endpoints', len(by_ep), 'fotos', count)
