"""Diagrama de classes por RF: entidades JPA citadas, enums de estado, o serviço principal e as relações."""
from __future__ import annotations

import re

import modelo as M
from gerar_estilo import esc, header


# --------------------------------------------------------------------------------------------- classes
def relations(names):
    out = []
    for n in [x for x in names if x in M.ENTITIES]:
        for fname, typ, rel, init in M.entity_fields(n):
            base = re.sub(r'^(List|Set)<(\w+)>$', r'\2', typ)
            if base in names and base != n and rel:
                arrow = '"*" --> "1"' if rel == 'many' else '"1" --> "1"' if rel == 'one' else '"1" --> "*"'
                out.append(f'{n} {arrow} {base} : {fname}')
            elif fname.endswith('Id') and fname != 'id' and rel is None and typ == 'UUID':
                target = fname[:-2][0].upper() + fname[:-2][1:]
                alias_ = {'Owner': 'User', 'Actor': 'User', 'Creator': 'User', 'Author': 'User', 'Issuer': 'User',
                          'Follower': 'User', 'Followee': 'User', 'Winner': 'User', 'Piece': 'WardrobeItem',
                          'WardrobeItem': 'WardrobeItem', 'Look': 'Scheme', 'Scheme': 'Scheme', 'Seal': 'Seal'}.get(target, target)
                if alias_ in names and alias_ != n:
                    out.append(f'{n} ..> {alias_} : {fname}')
            if typ in M.ENUMS and typ in names:
                out.append(f'{n} --> {typ}')
    return sorted(set(out))


HIDDEN_FIELDS = {'version', 'createdBy', 'lastModifiedBy', 'createdAt', 'updatedAt'}


def classes(sc, name, cited_text, max_ents=12, max_fields=10):
    out = [header(name, sc.title, 'classes')]
    ents = [e for e in sc.entities if e in cited_text] + [e for e in sc.entities if e not in cited_text]
    ents = list(dict.fromkeys(ents))[:max_ents]
    enums = []
    for e in ents:
        for fname, ftype, rel, init in M.entity_fields(e):
            if ftype in M.ENUMS and ftype not in enums and M.STATUS_FIELD.match(fname):
                enums.append(ftype)
    for e in ents:
        for fname, ftype, rel, init in M.entity_fields(e):
            if ftype in M.ENUMS and ftype not in enums and ftype in cited_text and len(enums) < 6:
                enums.append(ftype)
    enums = enums[:6]
    out.append('package "fai-domain (entidades JPA)" {')
    for e in ents:
        out.append(f'  class {e} <<{M.table_of(e)}>> {{')
        fs = [f for f in M.entity_fields(e) if f[0] not in HIDDEN_FIELDS]
        for fname, ftype, rel, init in fs[:max_fields]:
            out.append(f'    +{fname}: {esc(ftype.replace("java.util.", "").replace("java.time.", ""), 40)}')
        if len(fs) > max_fields:
            out.append(f'    .. +{len(fs) - max_fields} campos ..')
        out.append('  }')
    out.append('}')
    if enums:
        out.append('package "fai-domain (enums)" {')
        for en in enums:
            vals = M.ENUMS[en]
            out.append(f'  enum {en} {{\n' + '\n'.join('    ' + v for v in vals[:10]) + ('\n    ..' if len(vals) > 10 else '') + '\n  }')
        out.append('}')
    main = next((s_ for e in sc.endpoints for s_, _ in e.calls if s_ in M.SERVICES), None)
    if main:
        meths = list(dict.fromkeys(m for e in sc.endpoints for (sv, m) in e.calls if sv == main))[:10]
        out.append('package "fai-application" {')
        out.append(f'  class {main} <<service>> {{')
        for m in meths:
            out.append(f'    +{m}()')
        out.append('  }')
        out.append('}')
        used = sorted({M.REPOS[d][0] for d in M.deps_of(main) if d in M.REPOS and M.REPOS[d][0] in ents})
        for u in used[:6]:
            out.append(f'{main} ..> {u} : usa')
    out += relations(set(ents) | set(enums))
    out.append('@enduml')
    return '\n'.join(out)
