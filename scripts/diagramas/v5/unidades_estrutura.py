"""Classes e componentes por unidades: tipos e campos, importações e pacotes, e a agregação das setas."""
from __future__ import annotations

import os
import re

import modelo as M
import tsmodelo as T
from gerar_consultas import table_of_repo
from gerar_estilo import alias, esc, header, wrap
from unidades_citadas import NOISE, cited_units


# --------------------------------------------------------------------------------------------- classes
def classes(title, name, text, max_types=16, max_fields=10):
    mods, java = cited_units(text)
    out = [header(name, title, 'classes')]
    names = set()
    by_mod = {}
    for rel in mods:
        mod = T.MODULES[rel]
        ts = [t for t in mod.types.values()]
        ts.sort(key=lambda t: (t.name not in text, t.kind == 'union', -len(t.props)))
        by_mod[rel] = ts
    budget = max_types
    for rel, ts in by_mod.items():
        if budget <= 0:
            break
        pick = ts[:max(2, min(len(ts), budget // max(len(by_mod), 1) + 1))]
        if not pick and not T.MODULES[rel].funcs:
            continue
        out.append(f'package "{esc(rel, 70)}" {{')
        for t in pick:
            if t.name in names:
                continue
            names.add(t.name)
            budget -= 1
            if t.kind == 'union':
                out.append(f'  enum {alias(t.name)} as "{t.name}" {{\n' + '\n'.join('    ' + esc(v, 30) for v in t.values[:12])
                           + ('\n    ..' if len(t.values) > 12 else '') + '\n  }')
            else:
                stereo = '<<interface>>' if t.kind == 'interface' else ('<<type>>' if t.kind == 'type' else '')
                out.append(f'  class {alias(t.name)} as "{t.name}" {stereo} {{')
                for pn, pt in t.props[:max_fields]:
                    out.append(f'    +{esc(pn, 30)}: {esc(pt, 40)}')
                if len(t.props) > max_fields:
                    out.append(f'    .. +{len(t.props) - max_fields} ..')
                out.append('  }')
        fns = [f for f in T.MODULES[rel].funcs.values() if f.exported][:8]
        if fns:
            mname = alias('mod_' + os.path.basename(rel))
            out.append(f'  class {mname} as "{esc(os.path.basename(rel), 40)}" <<módulo>> {{')
            for f in fns:
                out.append(f'    +{esc(f.name, 40)}()')
            out.append('  }')
        out.append('}')
    jt = [j for j in java if j not in M.REPOS][:8]
    if jt:
        out.append('package "Backend (Java)" {')
        for j in jt:
            t = M.TYPES[j]
            stereo = '<<controller>>' if j in M.CONTROLLERS else '<<service>>' if j in M.SERVICES else (
                '<<interface>>' if t.kind == 'interface' else '')
            out.append(f'  class {j} {stereo} {{')
            for f in [f for f in t.fields if not f.type.endswith(('Repository', 'Port', 'Service'))][:6]:
                out.append(f'    -{f.name}: {esc(f.type, 36)}')
            pub = [m.name for m in t.methods][:8]
            for m in dict.fromkeys(pub):
                out.append(f'    +{m}()')
            out.append('  }')
            names.add(j)
        out.append('}')
        for j in jt:
            for d in M.deps_of(j):
                if d in jt and d != j:
                    out.append(f'{j} --> {d}')
    # relações entre tipos TS pelo tipo das propriedades
    rels = set()
    for rel, ts in by_mod.items():
        for t in ts:
            if t.name not in names:
                continue
            for pn, pt in t.props:
                for other in names:
                    if other != t.name and re.search(r'\b' + re.escape(other) + r'\b', pt):
                        rels.add(f'{alias(t.name)} --> {alias(other)} : {esc(pn, 20)}')
    out += sorted(rels)[:30]
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- componentes
def components(title, name, text):
    mods, java = cited_units(text)
    out = [header(name, title, 'componentes')]
    nodes = list(mods)
    for rel in mods:
        for imp in T.imports_of(rel):
            if imp not in nodes and len(nodes) < 12 and os.path.basename(imp) not in NOISE:
                nodes.append(imp)
    groups = {}
    for rel in nodes:
        groups.setdefault(os.path.dirname(rel) or 'raiz', []).append(rel)
    for g, rels in groups.items():
        out.append(f'package "{esc(g, 60)}" {{')
        for rel in rels:
            out.append(f'  component "{esc(os.path.basename(rel), 40)}" as {alias("m_" + rel)}' + ('' if rel in mods else ' <<apoio>>'))
        out.append('}')
    eps = []
    for rel in nodes:
        for f in T.MODULES[rel].funcs.values():
            for st in T.steps(rel, f.name):
                if st.kind == 'api':
                    e = M.match_endpoint(st.verb, st.target)
                    if e:
                        eps.append((rel, e))
    ctrls = sorted({e.controller for _, e in eps} | {j for j in java if j in M.CONTROLLERS})
    others = [j for j in java if j not in M.CONTROLLERS and j not in M.REPOS][:10]
    if ctrls or others:
        out.append('package "Backend (Spring Boot)" {')
        for c in ctrls:
            out.append(f'  component "{c}" as {alias(c)}')
        for j in others:
            out.append(f'  component "{j}" as {alias(j)}' + ('' if j in M.SERVICES or j in M.CONTROLLERS else ' <<apoio>>'))
        out.append('}')
    edges = set()
    for rel in nodes:
        for imp in T.imports_of(rel):
            if imp in nodes and imp != rel and os.path.basename(imp) not in NOISE:
                edges.add(f'{alias("m_" + rel)} --> {alias("m_" + imp)}')
    for rel, e in eps:
        edges.add(f'{alias("m_" + rel)} --> {alias(e.controller)} : HTTPS')
    for c in ctrls:
        for s in {s for e in M.ENDPOINTS if e.controller == c for s, _ in e.calls if s in others}:
            edges.add(f'{alias(c)} --> {alias(s)}')
    for j in others:
        for d in M.deps_of(j):
            if d in others and d != j:
                edges.add(f'{alias(j)} --> {alias(d)}')
            elif d in M.REPOS:
                tbl, db = table_of_repo(d)
                out.append(f'database "{db}" as DB_{db}')
                edges.add(f'{alias(j)} --> DB_{db} : {tbl}')
    seen, final = set(), []
    for ln in out:
        if ln.startswith('database') and ln in seen:
            continue
        seen.add(ln)
        final.append(ln)
    final += aggregate_edges(edges)
    final.append('@enduml')
    return '\n'.join(final)


def aggregate_edges(edges, max_edges=60):
    """Uma seta por par (origem, destino), com os rótulos juntos; o smetana não aguenta muitas setas paralelas."""
    pairs = {}
    for e in sorted(edges):
        m = re.match(r'^(\S+)\s+(-+>|\.\.>|\.\.\|>)\s+(\S+)(?:\s*:\s*(.*))?$', e)
        if not m:
            pairs.setdefault(e, [])
            continue
        key = (m.group(1), m.group(2), m.group(3))
        if m.group(4):
            pairs.setdefault(key, []).append(m.group(4).strip())
        else:
            pairs.setdefault(key, [])
    out = []
    for key, labels in pairs.items():
        if isinstance(key, str):
            out.append(key)
            continue
        labels = list(dict.fromkeys(labels))
        lbl = ''
        if labels:
            shown = labels[:6]
            lbl = ' : ' + ', '.join(shown) + (f' (+{len(labels) - 6})' if len(labels) > 6 else '')
            if len(lbl) > 70:
                lbl = ' : ' + wrap(', '.join(shown), 40)
        out.append(f'{key[0]} {key[1]} {key[2]}{lbl}')
    if len(out) > max_edges:
        # mantém as setas cujas duas pontas são citadas (não #FFFFFF) e corta o excesso
        out = out[:max_edges]
    return out
