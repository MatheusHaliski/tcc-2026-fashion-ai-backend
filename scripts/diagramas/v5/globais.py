"""Diagramas globais: classes por área de negócio e componentes da arquitetura inteira.

As áreas vêm de scripts/docs/taxonomia_entidades.py (a única parte manual do projeto), para que a taxonomia, o
diagrama de classes global e o de contextos usem o mesmo agrupamento.
"""
from __future__ import annotations

import importlib.util
import os
import re

import modelo as M
from gerar import alias, esc, header, relations, wrap

ROOT = M.ROOT


def areas():
    spec = importlib.util.spec_from_file_location('taxonomia_entidades', os.path.join(ROOT, 'scripts', 'docs', 'taxonomia_entidades.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.AREAS


HIDDEN = {'version', 'createdBy', 'lastModifiedBy', 'createdAt', 'updatedAt', 'id'}


# --------------------------------------------------------------------------------------------- classes por área
def classes_by_area(name, title, compact=False, max_fields=6):
    out = [header(name, title, 'classes', f'{len(M.ENTITIES)} entidades JPA do fai-domain em {len(areas())} áreas')]
    shown = []
    for area, rfs, names in areas():
        names = [n for n in names if n in M.ENTITIES]
        if not names:
            continue
        out.append(f'package "{esc(area, 60)}\\n<size:10>{esc(rfs, 60)}</size>" {{')
        for n in names:
            if compact:
                stat = ', '.join(f for f, _, _ in M.status_fields(n))
                out.append(f'  class {n} <<{M.table_of(n)}>>' + (f' {{\n    {esc(stat, 40)}\n  }}' if stat else ''))
            else:
                fs = [f for f in M.entity_fields(n) if f[0] not in HIDDEN]
                out.append(f'  class {n} <<{M.table_of(n)}>> {{')
                for fname, ftype, rel, init in fs[:max_fields]:
                    out.append(f'    +{fname}: {esc(ftype.replace("java.util.", "").replace("java.time.", ""), 30)}')
                if len(fs) > max_fields:
                    out.append(f'    .. +{len(fs) - max_fields} ..')
                out.append('  }')
            shown.append(n)
        out.append('}')
    rels = [r for r in relations(set(shown)) if ' --> ' in r and '"' in r]   # só ManyToOne/OneToOne/OneToMany reais
    out += rels
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- componentes globais
GROUPS = [
    ('Conta, perfil e social', ('Auth', 'Me', 'Preferences', 'Profile', 'Account', 'Social', 'Comment', 'Notification', 'Admin', 'Dashboard', 'IssuerReview', 'MediaProxy')),
    ('Guarda-roupa, looks e fotos', ('Wardrobe', 'Scheme', 'Lookbook', 'Photo', 'Background', 'Dna', 'Autopilot', 'Mirror', 'Room', 'RoomCreator')),
    ('Catálogo, marcas, provador e 3D', ('Catalog', 'BrandLogo', 'TryOn', 'Avatar3d', 'Showcase', 'Discovery', 'Lens', 'Insights')),
    ('Selos, cupons, jogos e Hype', ('Seal', 'Coupon', 'Flair', 'FlairModes', 'Challenge', 'Highlights', 'Hype', 'Institutional', 'Points')),
]


def _group_of(ctrl):
    base = ctrl.replace('Controller', '')
    for g, prefixes in GROUPS:
        if base in prefixes:
            return g
    for g, prefixes in GROUPS:
        if any(base.startswith(p) for p in prefixes):
            return g
    return 'Outros'


def components_global(name, title):
    out = [header(name, title, 'componentes',
                  f'{len(M.PAGES)} páginas · {len(M.CONTROLLERS)} controllers · {len(M.ENDPOINTS)} rotas · {len(M.SERVICES)} serviços · {len(M.REPOS)} repositórios · {len(M.PORTS)} ports')]
    out.append('package "Frontend (Next.js · Vercel)" {')
    out.append(f'  component "app/ · {len(M.PAGES)} páginas\\n(site)/(app), (auth), (gate), lab" as PAGES')
    out.append(f'  component "BFF /bff/* · {len(M.BFF_ROUTES)} rotas\\n(login, register, refresh, logout)" as BFF')
    out.append('  component "lib/api/client.ts" as APIC')
    out.append('  component "middleware.ts\\n(gate de desenvolvedor)" as MW')
    out.append('}')
    groups = {}
    for c in sorted(M.CONTROLLERS):
        groups.setdefault(_group_of(c), []).append(c)
    primary = {}
    for e in M.ENDPOINTS:
        for s, _ in e.calls:
            if s in M.SERVICES:
                primary.setdefault(e.controller, set()).add(s)
    out.append('package "fai-web (REST · Spring Boot · Railway)" {')
    for g, cs in groups.items():
        out.append(f'  package "{g}" {{')
        for c in cs:
            n = sum(1 for e in M.ENDPOINTS if e.controller == c)
            out.append(f'    component "{c}\\n{n} rotas" as {alias(c)}')
        out.append('  }')
    out.append('}')
    svcs = sorted({s for ss in primary.values() for s in ss})
    out.append('package "fai-application (casos de uso)" {')
    for g, cs in groups.items():
        gs = sorted({s for c in cs for s in primary.get(c, ())})
        if gs:
            out.append(f'  component "{wrap(", ".join(gs), 48)}" as SVC_{alias(g)}')
    out.append('  component "AiEngine\\n(RF24: provedores + reserva local, orçamento, consentimento)" as AI')
    out.append('  component "Eventos de domínio\\n(@TransactionalEventListener)" as EV')
    out.append('}')
    dbs = {}
    for r, (ent, db) in M.REPOS.items():
        dbs.setdefault(db, set()).add(M.table_of(ent) or ent)
    out.append('package "fai-domain (JPA) e fai-infrastructure" {')
    for db, tbls in dbs.items():
        out.append(f'  component "Repositórios {db}\\n{len([r for r in M.REPOS if M.REPOS[r][1] == db])} interfaces" as REPO_{db}')
    adapters = {}
    for p, al in M.ADAPTERS.items():
        st = M.store_of_adapter(al[0]) if al else None
        adapters.setdefault(st or 'Adaptadores locais', []).append(p)
    for st, ps in adapters.items():
        out.append(f'  component "{esc(st, 30)}\\n{wrap(", ".join(sorted(ps)), 44)}" as AD_{alias(st)}')
    out.append('}')
    for db, tbls in dbs.items():
        out.append(f'database "{db}\\n{len(tbls)} tabelas" as DB_{db}')
    for st in adapters:
        if st not in dbs and st != 'Adaptadores locais':
            out.append(f'cloud "{esc(st, 30)}" as CL_{alias(st)}')
    out.append('PAGES --> APIC')
    out.append('PAGES --> BFF')
    out.append('MW ..> PAGES : protege')
    for g, cs in groups.items():
        out.append(f'APIC --> {alias(cs[0])} : HTTPS/JSON')
        for c in cs:
            if primary.get(c):
                out.append(f'{alias(c)} --> SVC_{alias(g)}')
        out.append(f'SVC_{alias(g)} --> AI')
        out.append(f'SVC_{alias(g)} --> EV')
        for db in dbs:
            out.append(f'SVC_{alias(g)} --> REPO_{db}')
    for db in dbs:
        out.append(f'REPO_{db} --> DB_{db} : JPA' + ('/Flyway' if db == 'MySQL' else ''))
    for st in adapters:
        if st in dbs:
            out.append(f'AD_{alias(st)} --> DB_{st}')
        elif st != 'Adaptadores locais':
            out.append(f'AD_{alias(st)} --> CL_{alias(st)}')
    out.append('@enduml')
    return '\n'.join(out)
