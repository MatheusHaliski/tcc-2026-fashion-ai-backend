"""Gera o HTML dos cartões de evidência (até 5 por endpoint): requisição → resposta → SQL gravado → mídia → tela.
Uso: python3 evidence.py results.json tabela.json saida_dir"""
import html, json, os, re, sys, collections

res = json.load(open(sys.argv[1]))
tab = json.load(open(sys.argv[2]))
OUT = sys.argv[3]
os.makedirs(OUT, exist_ok=True)
MEDIA_BASE = 'http://localhost:8080/media/'
STATUS = {200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
          404: 'Not Found', 409: 'Conflict', 410: 'Gone', 422: 'Unprocessable', 429: 'Too Many Requests'}


def rf_key(rf):
    m = re.match(r'(RN?F)(\d+)', rf)
    return (0 if m and m.group(1) == 'RF' else 1, int(m.group(2)) if m else 999, rf)


def slug(ep):
    return re.sub(r'[^a-z0-9]+', '-', ep.lower().replace('{', '').replace('}', '')).strip('-')[:80]


def pretty(txt, limit=1300):
    if txt is None:
        return '(sem corpo)'
    try:
        obj = json.loads(txt) if isinstance(txt, str) else txt
        out = json.dumps(obj, ensure_ascii=False, indent=1, default=str)
    except Exception:
        out = str(txt)
    return out if len(out) <= limit else out[:limit] + '\n…'


def split_top(txt):
    """Divide por vírgulas de nível zero, respeitando aspas e parênteses."""
    out, cur, depth, q, i = [], [], 0, None, 0
    while i < len(txt):
        ch = txt[i]
        if q:
            cur.append(ch)
            if ch == '\\' and i + 1 < len(txt):
                cur.append(txt[i + 1])
                i += 1
            elif ch == q:
                if i + 1 < len(txt) and txt[i + 1] == q:
                    cur.append(txt[i + 1])
                    i += 1
                else:
                    q = None
        elif ch in ("'", '"'):
            q = ch
            cur.append(ch)
        elif ch == '(':
            depth += 1
            cur.append(ch)
        elif ch == ')':
            depth -= 1
            cur.append(ch)
        elif ch == ',' and depth == 0:
            out.append(''.join(cur).strip())
            cur = []
        else:
            cur.append(ch)
        i += 1
    if cur:
        out.append(''.join(cur).strip())
    return out


def short(v, n=90):
    v = v.strip()
    return v if len(v) <= n else v[:n] + '…'


def sqlfmt(q):
    """INSERT/UPDATE viram pares coluna = valor (sem os nulos); o resto sai como veio."""
    one = re.sub(r'\s+', ' ', q).strip()
    m = re.match(r'(?is)insert\s+(?:ignore\s+)?into\s+`?(\w+)`?\s*\((.*?)\)\s*values\s*\((.*)\)\s*$', one)
    if m:
        cols = [c.strip(' `') for c in split_top(m.group(2))]
        vals = split_top(m.group(3))
        pairs = [(c, v) for c, v in zip(cols, vals) if v.upper() != 'NULL']
        nulls = len(cols) - len(pairs)
        lines = [f'INSERT INTO {m.group(1)}'] + [f'  {c} = {short(v)}' for c, v in pairs[:22]]
        if len(pairs) > 22:
            lines.append(f'  … +{len(pairs) - 22} colunas preenchidas')
        if nulls:
            lines.append(f'  ({nulls} coluna(s) nula(s) omitida(s))')
        if len(vals) < len(cols):
            lines.append('  (comando cortado na captura)')
        return '\n'.join(lines)
    m = re.match(r'(?is)update\s+`?(\w+)`?\s+set\s+(.*?)\s+where\s+(.*)$', one)
    if m:
        sets = split_top(m.group(2))
        lines = [f'UPDATE {m.group(1)}'] + [f'  {short(x, 110)}' for x in sets[:14]]
        if len(sets) > 14:
            lines.append(f'  … +{len(sets) - 14} colunas')
        lines.append(f'  WHERE {short(m.group(3), 110)}')
        return '\n'.join(lines)
    return short(one, 600)


for r, t in zip(res, tab):
    r['_t'] = t
by_ep = collections.OrderedDict()
for r in sorted(res, key=lambda r: rf_key(r['rf'])):
    by_ep.setdefault(r['endpoint'], []).append(r)

cards = []
for ep, steps in by_ep.items():
    # até 5 passos por endpoint: primeiro os que tiveram o status esperado, com descrições diferentes
    seen, pick = set(), []
    for r in sorted(steps, key=lambda r: (not r['ok'], r['status'] >= 400)):
        if r['desc'] in seen:
            continue
        seen.add(r['desc'])
        pick.append(r)
        if len(pick) == 5:
            break
    for k, r in enumerate(pick, 1):
        cards.append((ep, k, len(pick), r))

CSS = '''
body{margin:0;background:#E9E7DF;font:14px/1.45 Inter,Segoe UI,Arial,sans-serif;color:#191A19}
.card{width:1180px;margin:16px;padding:18px 20px;background:#fff;border-radius:14px;box-shadow:0 1px 0 #d6d3c8}
.top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rf{background:#2F3E46;color:#fff;border-radius:6px;padding:3px 8px;font-weight:700}
.ca{background:#F1F0EA;border-radius:6px;padding:3px 8px}
.ep{font:600 16px ui-monospace,Menlo,Consolas,monospace}
.m{display:inline-block;min-width:54px;text-align:center;border-radius:5px;padding:2px 6px;color:#fff;font-weight:700;font-size:12px}
.GET{background:#1F7A76}.POST{background:#3B6EA8}.PUT{background:#B8862B}.PATCH{background:#7C5FC0}.DELETE{background:#C6275E}
.st{margin-left:auto;font-weight:800;font-size:18px;border-radius:8px;padding:4px 12px}
.ok2{background:#E3F4EC;color:#11663F}.ok4{background:#FFF3DA;color:#8A5A12}.bad{background:#FDE2E7;color:#9F1239}
.desc{margin:6px 0 10px;color:#5C6058}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.box{border:1px solid #E1DED4;border-radius:10px;overflow:hidden}
.box h4{margin:0;padding:6px 10px;background:#F7F6F2;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5C6058}
.box pre{margin:0;padding:8px 10px;font:11.5px/1.4 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow:hidden}
.full{grid-column:1/-1}
.sql pre{background:#0F172A;color:#E2E8F0;max-height:420px;column-count:2;column-gap:24px}
.sql .t{color:#93C5FD}
.media{display:flex;gap:8px;padding:8px;flex-wrap:wrap}
.media img{height:110px;border-radius:6px;border:1px solid #E1DED4;background:#fff;object-fit:contain}
.media span{font:11px ui-monospace,monospace;color:#5C6058}
.fe{padding:8px 10px}
.foot{margin-top:8px;font-size:11px;color:#8B8F86}
'''

parts = [f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>{CSS}</style></head><body>']
manifest = []
for i, (ep, k, n, r) in enumerate(cards):
    t = r['_t']
    method, path = ep.split(' ', 1)
    st = r['status']
    cls = 'ok2' if st < 300 else ('ok4' if r['ok'] else 'bad')
    wsql = r.get('sql_writes') or []
    rsql = r.get('sql_reads') or []
    sql_html = ''
    if wsql:
        sql_html = '\n\n'.join(html.escape(sqlfmt(q)) for q in wsql)
        sql_title = f'3 · Banco — SQL de escrita executado pela API ({", ".join(sorted(r["writes"]))})'
    elif rsql:
        sql_html = '\n\n'.join(html.escape(sqlfmt(q)) for q in rsql)
        sql_title = f'3 · Banco — leitura (SELECT) feita pela API ({", ".join(r["reads"][:6])})'
    else:
        sql_html = html.escape(t['banco'])
        sql_title = '3 · Banco'
    imgs = [m for m in (r.get('media') or []) if re.search(r'\.(png|jpe?g|webp)$', m, re.I)]
    media_html = ''.join(f'<figure style="margin:0"><img src="{MEDIA_BASE}{html.escape(m)}"><br><span>{html.escape(m[-46:])}</span></figure>' for m in imgs[:4]) \
        or f'<span>{html.escape(", ".join(r.get("media") or []) or "nenhum arquivo novo")}</span>'
    cid = f'c{i}'
    parts.append(f'''<div class="card" id="{cid}">
<div class="top"><span class="rf">{html.escape(r['rf'])}</span><span class="ca">{html.escape(r['ca'])}</span><span class="m {method}">{method}</span>
<span class="ep">{html.escape(path)}</span><span class="st {cls}">{st} {STATUS.get(st, '')}</span></div>
<div class="desc">Passo {k}/{n}: <b>{html.escape(r['desc'])}</b> · usuário <b>{html.escape(r['who'])}</b> · URL real <code>{html.escape(r['path'][:120])}</code> · {r['ms']} ms</div>
<div class="grid">
<div class="box"><h4>1 · Requisição</h4><pre>{html.escape(pretty(r.get('req'), 1100))}</pre></div>
<div class="box"><h4>2 · Resposta {st}</h4><pre>{html.escape(pretty(r.get('resp'), 1300))}</pre></div>
<div class="box full sql"><h4>{html.escape(sql_title)}</h4><pre>{sql_html}</pre></div>
<div class="box"><h4>4 · Mídia gravada (storage)</h4><div class="media">{media_html}</div></div>
<div class="box"><h4>5 · Frontend</h4><div class="fe">{html.escape(t['exibe'])}</div></div>
</div>
<div class="foot">Teste ponta a ponta Fashion AI · API real + MySQL (general_log filtrado pelo usuário da aplicação) · status esperado: {"sim" if r['ok'] else "NÃO"}</div>
</div>''')
    rfdir = r['rf'].replace(' ', '_').replace('(', '').replace(')', '')
    manifest.append(dict(id=cid, file=f"{rfdir}/{slug(ep)}__{k}.jpg", rf=r['rf'], ca=r['ca'], endpoint=ep, desc=r['desc'], status=st, ok=r['ok']))
parts.append('</body></html>')
open(os.path.join(OUT, 'cards.html'), 'w').write('\n'.join(parts))
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print('cartões', len(cards), 'endpoints', len(by_ep))
