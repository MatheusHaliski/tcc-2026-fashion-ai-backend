"""Mapeia chamadas api.get/post/put/patch/delete/upload do frontend para os endpoints do inventário."""
import re, glob, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
HERE = os.path.dirname(__file__)
inv = json.load(open(os.path.join(HERE, 'inventory.json')))

def pat(path):
    rx = re.sub(r'\{[^}]+\}', r'[^/]+', re.escape(path).replace(r'\{', '{').replace(r'\}', '}'))
    return re.compile('^' + rx + '$')
for e in inv:
    e['_rx'] = pat(e['path'])

CALL = re.compile(r'api\.(get|post|put|patch|delete|upload)\s*(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\s*\(\s*(`[^`]*`|"[^"]*"|\'[^\']*\')', re.S)
FETCH = re.compile(r'(?:fetch|mediaUrl|href=)\s*\(?\s*(`[^`]*\/api\/[^`]*`|"[^"]*\/api\/[^"]*")')

def norm(lit):
    s = lit[1:-1]
    s = re.sub(r'\$\{API_BASE\}|\$\{API\}', '', s)
    s = s.split('?')[0]
    s = re.sub(r'\$\{[^}]*\}', 'X', s)
    s = re.sub(r'(?<=[a-z0-9-])X(\)\})?$', '', s)      # sufixo de query montada em template
    s = re.sub(r'X\)\}$', '', s)
    return s

def page_of(f):
    rel = os.path.relpath(f, ROOT)
    return rel

calls = []
for f in glob.glob(ROOT + '/app/**/*.tsx', recursive=True) + glob.glob(ROOT + '/components/**/*.tsx', recursive=True) + glob.glob(ROOT + '/lib/**/*.ts', recursive=True):
    src = open(f, encoding='utf-8').read()
    for m in CALL.finditer(src):
        verb = m.group(1).upper()
        if verb == 'UPLOAD':
            tail = src[m.end():m.end() + 200]
            verb = 'PUT' if re.match(r'[^;]*?,\s*"PUT"', tail) else 'POST'
        path = norm(m.group(2))
        calls.append((page_of(f), verb, path))

def match(verb, path):
    hits = [e for e in inv if e['verb'] == verb and e['_rx'].match(path)]
    if not hits and path.endswith('/'):
        hits = [e for e in inv if e['verb'] == verb and e['_rx'].match(path[:-1])]
    return hits

OVERRIDES = {  # rotas montadas com template aninhado que o regex não resolve sozinho
    ('app/(site)/(app)/brands/page.tsx', 'GET', '/api/X'): ['GET /api/brands', 'GET /api/celebrities'],
    ('app/(site)/(app)/flair/page.tsx', 'POST', '/api/flair/combinations/X/redeem${c.bestDeck '): ['POST /api/flair/combinations/{id}/redeem'],
    ('app/(site)/(app)/u/[username]/page.tsx', 'GET', '/api/users/${data'): ['GET /api/users/{userId}/connections'],
}
by_key = {f"{e['verb']} {e['path']}": e for e in inv}
used = {}
unmatched = []
for file, verb, path in calls:
    if (file, verb, path) in OVERRIDES:
        for k in OVERRIDES[(file, verb, path)]:
            k2 = k if k in by_key else next((x for x in by_key if x.split(' ')[0] == k.split(' ')[0] and pat(x.split(' ', 1)[1]).match(k.split(' ', 1)[1].replace('{id}', 'X').replace('{userId}', 'X'))), None)
            if k2:
                used.setdefault(k2, set()).add(file)
        continue
    hits = match(verb, path)
    if not hits and 'X' in path:
        # rota montada dinamicamente (ex.: `/api/${kind}/...`): tenta casar qualquer segmento
        rx = re.compile('^' + re.escape(path).replace('X', '[^/]+') + '$')
        hits = [e for e in inv if e['verb'] == verb and (rx.match(e['path']) or rx.match(re.sub(r'\{[^}]+\}', 'X', e['path'])))]
    if not hits and path.startswith('X/'):
        suffix = path[1:]
        hits = [e for e in inv if e['verb'] == verb and e['path'].endswith(suffix)]
    if not hits:
        unmatched.append((file, verb, path))
    for e in hits:
        used.setdefault(f"{e['verb']} {e['path']}", set()).add(file)

out = {k: sorted(v) for k, v in used.items()}
json.dump(out, open(os.path.join(HERE, 'frontend_map.json'), 'w'), ensure_ascii=False, indent=1)
print('chamadas', len(calls), 'endpoints usados pelo front', len(out), 'de', len(inv))
print('sem correspondência', len(unmatched))
for u in unmatched[:40]:
    print('  ', u)
