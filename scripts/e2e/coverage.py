import json, re, sys
inv = json.load(open('inventory.json'))
res = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'results_final.json'))
def rx(tpl):
    return re.compile('^' + re.sub(r'\\\{[^}]+\\\}', r'[^/]+', re.escape(tpl)) + '$')
pats = [(e, rx(e['path'])) for e in inv]
# prefer templates with fewer variables (literal segment wins)
pats.sort(key=lambda t: (t[0]['path'].count('{'), -len(t[0]['path'])))
def match(method, path):
    p = path.split('?')[0]
    for e, r in pats:
        if e['verb'] == method and r.match(p):
            return e
    return None
cov = {}
unm = []
for r in res:
    e = match(r['method'], r['path'])
    if e is None:
        unm.append((r['method'], r['path']))
        continue
    k = e['verb'] + ' ' + e['path']
    r['endpoint'] = k
    cov.setdefault(k, []).append(r)
json.dump(res, open('results_all.json', 'w'), ensure_ascii=False, indent=1)
missing = [e for e in inv if e['verb'] + ' ' + e['path'] not in cov]
print('endpoints', len(inv), 'cobertos', len(cov), 'faltando', len(missing), 'sem template', len(unm))
for m in unm[:20]: print('UNM', m)
for e in missing: print(f"MISS {e['rf']:<10} {e['controller'][:-10]:<14} {e['verb']:<6} {e['path']}  q={e['query']} body={(e['body'] or '').split('.')[-1]}{' MP' if e['multipart'] else ''}")
