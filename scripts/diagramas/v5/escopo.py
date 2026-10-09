"""Escopo de cada RF: quais controllers, serviços, entidades e telas pertencem a ele.

Ponto de partida: os nomes citados nos diagramas que o time já tinha por RF (numeração do Trello). Eles são filtrados
contra o código atual (o que não existe mais sai) e completados pelo próprio código:

- rotas: endpoints dos controllers citados cujo @Operation/@Tag cita o RF (na numeração do código) ou que as telas do
  RF chamam;
- serviços: os chamados por essas rotas;
- entidades: as dos repositórios usados por esses serviços (direto) e as citadas;
- telas: as páginas citadas e as que chamam as rotas do RF.
"""
from __future__ import annotations

import glob
import os
import re
from dataclasses import dataclass, field

import modelo as M

DIAG = os.path.join(M.ROOT, 'docs', 'diagramas')

# Trello → numeração usada nos comentários e no Swagger (docs/novos-rf/README.md). O resto coincide.
CODE_RF = {27: [32], 28: [33, 28], 29: [34], 30: [35], 31: [10, 7, 31], 32: [36], 33: [33], 34: [22], 35: [22, 14],
           36: [4, 5], 45: [4], 47: [47], 53: [53, 6]}
# RF33 colide no código: no MirrorController é o Vista-me (Trello RF28); no ShowcaseController é a Passarela (Trello RF33)
RF_TAG_EXCLUDE = {33: {'MirrorController'}, 28: {'ShowcaseController'}}


@dataclass
class Scope:
    key: str                     # pasta (ex.: RF27, RF25-criador-de-selos)
    rf: int | None
    title: str
    old_files: list
    endpoints: list = field(default_factory=list)
    services: list = field(default_factory=list)
    entities: list = field(default_factory=list)
    enums: list = field(default_factory=list)
    pages: list = field(default_factory=list)
    ports: list = field(default_factory=list)
    state_hint: str = ''


def _tokens(text):
    return set(re.findall(r'[A-Za-z_][A-Za-z0-9_]*', text))


def _routes_in(text):
    out = set()
    for m in re.finditer(r'\(([a-z]+)\)/([\w\-\[\]/]+)/page\.tsx', text):
        out.add('/' + m.group(2))
    for m in re.finditer(r'(?<![\w/])(/(?:[a-z0-9\-]+|\[[a-zA-Z]+\])(?:/(?:[a-z0-9\-]+|\[[a-zA-Z]+\]))*)', text):
        r = m.group(1)
        if not r.startswith('/api') and not r.startswith('/bff') and not r.startswith('/media'):
            out.add(r)
    return {r for r in out if r in M.PAGES}


def _title(text, key):
    m = re.search(r'^title\s+(.+)$', text, re.M)
    if not m:
        return key
    t = m.group(1).split('\\n')[0].strip()
    return t


def _rf_number(key):
    m = re.match(r'RF(\d+)', key)
    return int(m.group(1)) if m else None


def _rf_in_text(text, n):
    return re.search(r'\bRF0?' + str(n) + r'(?!\d)', text or '') is not None


CITACOES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'citacoes.json')
_CIT = None


def citacoes():
    """O que cada diagrama do time citava (título + nomes, na ordem em que apareciam), guardado em citacoes.json.

    É o ponto de partida do escopo de cada arquivo: assim o escopo continua o mesmo depois que o arquivo .puml é
    reescrito pelo gerador."""
    global _CIT
    if _CIT is None:
        import json
        _CIT = json.load(open(CITACOES_PATH, encoding='utf-8')) if os.path.exists(CITACOES_PATH) else {}
    return _CIT


def tokens_ordered(text):
    seen, out = set(), []
    for tok in re.findall(r'[\w$\-\[\]()/.{}]+', text):
        tok = tok.strip('.()')
        if len(tok) < 3 or tok in seen or re.fullmatch(r'#?[0-9A-Fa-f]{6}', tok):
            continue
        seen.add(tok)
        out.append(tok)
    return out


def source_text(f):
    """Texto citado por um arquivo: o de citacoes.json se houver; senão o próprio arquivo."""
    rel = os.path.relpath(f, M.ROOT)
    c = citacoes().get(rel)
    if c:
        return 'title ' + c['title'] + '\n' + ' '.join(c['tokens'])
    return open(f, encoding='utf-8').read()


def build(key, files, rf=None):
    text = '\n'.join(source_text(f) for f in files)
    toks = _tokens(text)
    sc = Scope(key, rf if rf is not None else _rf_number(key), _title(text, key), files)
    # nomes citados que existem no código
    cited_ctrl = [c for c in M.CONTROLLERS if c in toks]
    cited_svc = [s for s in M.TYPES if s in toks and M.TYPES[s].module == 'application' and M.TYPES[s].kind == 'class']
    cited_ent = [e for e in M.ENTITIES if e in toks]
    tables = {M.table_of(e): e for e in M.ENTITIES}
    cited_ent += [e for t, e in tables.items() if t and t in toks and e not in cited_ent]
    cited_pages = _routes_in(text)
    # rotas: dos controllers citados, as que citam o RF; e as que as telas citadas chamam
    nums = [sc.rf] + CODE_RF.get(sc.rf, []) if sc.rf else []
    eps = []
    for e in M.ENDPOINTS:
        if e.controller in RF_TAG_EXCLUDE.get(sc.rf, set()):
            continue
        ctrl = M.CONTROLLERS[e.controller]
        tag = ctrl.annotations.get('Tag', '')
        hit_rf = any(_rf_in_text(e.summary, n) for n in nums if n) or (
            not re.search(r'\bRF\d+', e.summary or '') and any(_rf_in_text(tag, n) for n in nums if n))
        static = re.sub(r'/\{[^}]+\}', '', e.path)
        cited_path = static in text or (e.method in toks and e.controller in cited_ctrl)
        svc_hit = any(svc in cited_svc for svc, _ in e.calls)
        if hit_rf and (e.controller in cited_ctrl or svc_hit):
            eps.append(e)
        elif cited_path and (e.controller in cited_ctrl or svc_hit):
            eps.append(e)
    shared = {id(e) for e in M.ENDPOINTS if sum(1 for p in M.PAGES.values() if any(c[2] is e for c in p['calls'])) > 8}
    core = [e for e in eps if id(e) not in shared]
    for r in cited_pages:
        for verb, path, e, f in M.PAGES[r]['calls']:
            if e is not None and e not in eps and id(e) not in shared and (
                    e.controller in cited_ctrl or any(s in cited_svc for s, _ in e.calls)):
                eps.append(e)
    # telas: citadas + as que chamam ao menos 2 rotas próprias do RF (rotas usadas por quase todas as telas não contam)
    pages = list(cited_pages)
    for r, p in M.PAGES.items():
        hits = {id(c[2]) for c in p['calls'] if c[2] in core}
        if r not in pages and len(hits) >= 2:
            pages.append(r)
    svcs = []
    for e in eps:
        for s, _ in e.calls:
            if s not in svcs and s in M.TYPES:
                svcs.append(s)
    for s in cited_svc:
        if s not in svcs and s in M.SERVICES:
            svcs.append(s)
    ents = list(dict.fromkeys(cited_ent))
    for s in svcs:
        for d in M.deps_of(s):
            if d in M.REPOS and M.REPOS[d][0] in M.ENTITIES and M.REPOS[d][0] in toks:
                if M.REPOS[d][0] not in ents:
                    ents.append(M.REPOS[d][0])
    enums = [n for n in M.ENUMS if n in toks]
    for e in ents:
        for fname, ftype, rel, init in M.entity_fields(e):
            if ftype in M.ENUMS and ftype not in enums:
                enums.append(ftype)
    ports = []
    for s in svcs:
        for d in M.deps_of(s):
            if d in M.PORTS and d not in ports:
                ports.append(d)
    sc.endpoints, sc.services, sc.entities, sc.enums, sc.pages, sc.ports = eps, svcs, ents, enums, pages, ports
    st = [f for f in files if 'maquinadeestados' in f.lower() or 'estados' in os.path.basename(f).lower()]
    sc.state_hint = open(st[0], encoding='utf-8').read() if st else ''
    return sc


def all_scopes():
    """Uma entrada por pasta de diagramas (RF e temas), com os arquivos .puml que ela tem hoje."""
    out = []
    for d in sorted(glob.glob(DIAG + '/*/')):
        key = os.path.basename(d.rstrip('/'))
        files = sorted(glob.glob(d + '*.puml'))
        if files:
            out.append(build(key, files))
        for sub in sorted(glob.glob(d + '*/')):
            sf = sorted(glob.glob(sub + '*.puml'))
            if sf:
                out.append(build(key + '/' + os.path.basename(sub.rstrip('/')), sf, _rf_number(key)))
    return out


def gravar_citacoes(origem):
    """Gera citacoes.json a partir de uma cópia dos diagramas do time (mesma árvore de pastas)."""
    import json
    out = {}
    for f in sorted(glob.glob(os.path.join(origem, '**', '*.puml'), recursive=True)):
        rel = os.path.relpath(f, origem)
        text = open(f, encoding='utf-8').read()
        m = re.search(r'^title\s+(.+)$', text, re.M)
        body = re.sub(r'(?ms)^\s*skinparam\s+\w+\s*\{.*?^\s*\}', '', text)
        body = re.sub(r'(?m)^\s*(skinparam|!pragma|autonumber|left to right|hide ).*$', '', body)
        out[rel] = {'title': m.group(1).strip() if m else '', 'tokens': tokens_ordered(body)}
    json.dump(out, open(CITACOES_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    return len(out)


def acrescentar_citacoes(arquivos):
    """Registra as citações de diagramas novos do time (caminhos a partir da raiz do repositório) sem mexer nas que já
    existem — as dos diagramas antigos foram tiradas antes da reescrita e não devem ser trocadas pelo texto gerado."""
    import json
    atual = json.load(open(CITACOES_PATH, encoding='utf-8')) if os.path.exists(CITACOES_PATH) else {}
    novos = 0
    for f in arquivos:
        rel = os.path.relpath(os.path.abspath(f), M.ROOT)
        if rel in atual:
            continue
        text = open(os.path.join(M.ROOT, rel), encoding='utf-8').read()
        m = re.search(r'^title\s+(.+)$', text, re.M)
        body = re.sub(r'(?ms)^\s*skinparam\s+\w+\s*\{.*?^\s*\}', '', text)
        body = re.sub(r'(?m)^\s*(skinparam|!pragma|autonumber|left to right|hide ).*$', '', body)
        atual[rel] = {'title': m.group(1).strip() if m else '', 'tokens': tokens_ordered(body)}
        novos += 1
    json.dump(atual, open(CITACOES_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    return novos


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == '--gravar-citacoes':
        print('citações gravadas:', gravar_citacoes(sys.argv[2]))
        raise SystemExit
    if len(sys.argv) > 2 and sys.argv[1] == '--acrescentar':
        print('citações novas:', acrescentar_citacoes(sys.argv[2:]))
        raise SystemExit
    for sc in all_scopes():
        print(f'{sc.key:32} rotas {len(sc.endpoints):3} serv {len(sc.services):2} ent {len(sc.entities):2} '
              f'telas {len(sc.pages):2} | {sc.title[:70]}')
