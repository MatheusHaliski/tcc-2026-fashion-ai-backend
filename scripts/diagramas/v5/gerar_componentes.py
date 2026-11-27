"""Diagrama de componentes por RF: páginas, controllers, serviços, ports com adaptadores, repositórios e bancos."""
from __future__ import annotations

import re

import modelo as M
from gerar_consultas import NOT_COMPONENTS, kind_of_dep, table_of_repo
from gerar_estilo import alias, esc, header


# --------------------------------------------------------------------------------------------- componentes
def components(sc, name, cited_text):
    out = [header(name, sc.title, 'componentes')]
    eps = sc.endpoints
    ctrls = list(dict.fromkeys(e.controller for e in eps))[:6]
    primary = list(dict.fromkeys(s for e in eps for s, _ in e.calls if s in M.TYPES))[:6]
    secondary = []
    for p in primary:
        for d in M.deps_of(p):
            if kind_of_dep(d) == 'service' and d not in primary and d not in secondary and d not in NOT_COMPONENTS:
                secondary.append(d)
    secondary = secondary[:8]
    repos, ports, uses_ai, events = [], [], False, False
    for p in primary:
        for d in M.deps_of(p):
            if d in M.REPOS and d not in repos:
                repos.append(d)
            elif d in M.PORTS and d not in ports:
                ports.append(d)
            elif d == 'AiEngine':
                uses_ai = True
            elif d == 'ApplicationEventPublisher':
                events = True
    out.append('package "Frontend (Next.js)" {')
    for i, r in enumerate(sc.pages[:6]):
        out.append(f'  component "{esc(r)}\\n{esc(M.PAGES[r]["file"].replace("app/", ""), 60)}" as FE{i}')
    out.append('  component "lib/api/client.ts" as APIC')
    out.append('}')
    out.append('package "fai-web (REST)" {')
    for c in ctrls:
        paths = sorted({re.sub(r'/\{[^}]+\}', '/{…}', e.path) for e in eps if e.controller == c})
        shown = '\\n'.join(esc(p, 50) for p in paths[:4]) + (f'\\n(+{len(paths) - 4} rotas)' if len(paths) > 4 else '')
        out.append(f'  component "{c}\\n{shown}" as {alias(c)}')
    out.append('}')
    out.append('package "fai-application (casos de uso)" {')
    for s_ in primary:
        out.append(f'  component "{s_}" as {alias(s_)}')
    for s_ in secondary:
        out.append(f'  component "{s_}" as {alias(s_)} <<apoio>>')
    for p in ports:
        impl = ' / '.join(M.ADAPTERS.get(p, [])[:2])
        out.append(f'  component "{p}' + (f'\\n«{impl}»' if impl else '') + f'" as {alias(p)} <<port>>')
    out.append('}')
    dbs = {}
    for r in repos:
        tbl, db = table_of_repo(r)
        dbs.setdefault(db, []).append((r, tbl))
    if dbs:
        out.append('package "fai-domain (repositórios)" {')
        for db, items in dbs.items():
            out.append(f'  component "' + '\\n'.join(r for r, _ in items[:10]) + (f'\\n(+{len(items) - 10})' if len(items) > 10 else '') + f'" as REPO_{db}')
        out.append('}')
    for db, items in dbs.items():
        tl = sorted({t for _, t in items})
        out.append(f'database "{db}\\n' + '\\n'.join('• ' + t for t in tl[:12]) + (f'\\n(+{len(tl) - 12})' if len(tl) > 12 else '') + f'" as DB_{db}')
    if uses_ai:
        out.append('cloud "Motor de IA (RF24)\\nprovedores externos + reserva local" as AI')
    if events:
        out.append('component "Eventos de domínio\\n(@TransactionalEventListener)" as EV')
    clouds = {}
    for p in ports:
        for a in M.ADAPTERS.get(p, []):
            st = M.store_of_adapter(a)
            if st and st not in dbs:
                clouds.setdefault(st, set()).add(p)
    for c in clouds:
        out.append(f'cloud "{c}" as CL_{alias(c)}')
    for i, r in enumerate(sc.pages[:6]):
        out.append(f'FE{i} --> APIC')
    for c in ctrls:
        n = sum(1 for e in eps if e.controller == c)
        out.append(f'APIC --> {alias(c)} : HTTPS/JSON')
        for s_ in sorted({s_ for e in eps if e.controller == c for s_, _ in e.calls if s_ in primary}):
            out.append(f'{alias(c)} --> {alias(s_)}')
    for p in primary:
        for d in M.deps_of(p):
            if d in secondary or (d in primary and d != p):
                out.append(f'{alias(p)} ..> {alias(d)}')
            elif d in M.PORTS:
                out.append(f'{alias(p)} --> {alias(d)}')
        if any(d in M.REPOS for d in M.deps_of(p)):
            for db in {table_of_repo(d)[1] for d in M.deps_of(p) if d in M.REPOS}:
                out.append(f'{alias(p)} --> REPO_{db}')
        if uses_ai and 'AiEngine' in M.deps_of(p):
            out.append(f'{alias(p)} --> AI')
        if events and 'ApplicationEventPublisher' in M.deps_of(p):
            out.append(f'{alias(p)} --> EV')
    for db in dbs:
        out.append(f'REPO_{db} --> DB_{db} : JPA' + ('/Flyway' if db == 'MySQL' else ''))
    for c, ps in clouds.items():
        for p in sorted(ps):
            out.append(f'{alias(p)} --> CL_{alias(c)}')
    import unidades as U
    decl = [ln for ln in out if not re.match(r'^\S+\s+(-+>|\.\.>|\.\.\|>)\s+\S+', ln)]
    edges = [ln for ln in out if re.match(r'^\S+\s+(-+>|\.\.>|\.\.\|>)\s+\S+', ln)]
    out = decl + U.aggregate_edges(set(edges))
    out.append('@enduml')
    return '\n'.join(out)
