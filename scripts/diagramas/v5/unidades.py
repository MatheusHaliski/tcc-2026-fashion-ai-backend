"""Diagramas "por unidades de código": para o que não é rota → serviço → repositório.

Uma unidade é um módulo TypeScript (lib/, components/, app/) ou uma classe Java citada pelo diagrama (pipelines de
imagem, filtros de segurança, serviços de demonstração). Os cinco tipos de diagrama saem das próprias unidades:
passos das funções (atividades e sequência), tipos e campos (classes), importações e pacotes (componentes) e mudanças de
estado de tela ou de enum (máquina de estados).
"""
from __future__ import annotations

import os
import re

import modelo as M
import tsmodelo as T
from gerar import STYLE, TODAY, alias, esc, header, human_code, kind_of_dep, repo_op, sql_of, table_of_repo, wrap

JAVA_SKIP = {'Override', 'String', 'List', 'Map', 'Set', 'UUID', 'Instant', 'Optional'}


# --------------------------------------------------------------------------------------------- unidades citadas
NOISE = ('i18n.tsx', 'i18n.ts', 'ui.tsx', 'utils.ts', 'fai-icon.tsx', 'client.ts', 'cn.ts', 'types.ts', 'labels-pt.ts',
         'labels-en.ts', 'labels-es.ts')


def _ident_tokens(text):
    return [t for t in re.findall(r'\b[A-Z][A-Za-z0-9]{4,}\b', text)]


def cited_units(text, limit=6):
    """(módulos TS, classes Java) citados no texto do diagrama do time.

    Módulos entram por nome de arquivo ('garments.ts', 'mirror/page.tsx') e também por identificador exportado
    ('ArtVideo', 'HumanOutfit', 'CardArtLayer'), na ordem em que aparecem."""
    mods = []
    for tok in re.findall(r'[A-Za-z0-9_\-\[\]()/.]+\.tsx?\b', text):
        r = T.find_module(tok)
        if r and r not in mods:
            mods.append(r)
    for ident in _ident_tokens(text):
        r = T.FUNCS.get(ident) or (T.TYPES[ident].module if ident in T.TYPES and T.TYPES[ident].kind != 'union' else None)
        if r and r not in mods and os.path.basename(r) not in NOISE and len(mods) < limit:
            mods.append(r)
    java = []
    for name, t in M.TYPES.items():
        if name in JAVA_SKIP or t.kind not in ('class', 'record', 'interface') or t.outer:
            continue
        if t.module in ('domain',) and name in M.ENTITIES:
            continue
        if re.search(r'\b' + re.escape(name) + r'\b', text):
            java.append(name)
    return mods, java


def cited_funcs(text, rel):
    """Funções do módulo citadas pelo nome no texto, na ordem."""
    mod = T.MODULES[rel]
    out = []
    for ident in re.findall(r'\b[A-Za-z_$][\w$]{3,}\b', text):
        if ident in mod.funcs and ident not in out:
            out.append(ident)
    return out


def is_unit_mode(text, kind=None):
    """Modo por unidades quando o diagrama do time fala sobretudo de módulos do frontend (fora das páginas) ou de
    classes Java que não são controllers nem serviços (pipelines, filtros, adaptadores). Diagramas de componentes ficam
    no modo RF sempre que citam algum controller ou serviço."""
    mods, java = cited_units(text)
    lib_mods = [m for m in mods if not m.startswith('app/')]
    std = [j for j in java if j in M.CONTROLLERS or j in M.SERVICES]
    other = [j for j in java if j not in std and j not in M.REPOS and M.TYPES[j].module != 'domain'
             and len(j) >= 6 and not j.endswith(('Request', 'Response', 'View', 'Dto', 'Exception'))]
    units = len(lib_mods) + len(other)
    if units == 0:
        return False
    if not std:
        return True
    if kind == 'componentes':
        return False
    return (len(lib_mods) >= 2 and len(lib_mods) >= len(std)) or (len(other) >= 3 and len(std) <= 2)


def _main_func(rel, prefer=()):
    mod = T.MODULES[rel]
    if not mod.funcs:
        return None
    for name in prefer:
        if name in mod.funcs and T.steps(rel, name):
            return name
    exported = [f for f in mod.funcs.values() if f.exported]
    pool = exported or list(mod.funcs.values())
    default = [f for f in pool if f.kind == 'component']
    pool = default or pool
    return max(pool, key=lambda f: len(T.steps(rel, f.name))).name


def _java_main(name):
    t = M.TYPES[name]
    best, n = None, -1
    an = M.analyzer(name) if t.kind == 'class' else None
    for m in t.methods:
        if m.node is None or 'private' in (M._text(m.node.parent, M.src_of(t))[:40] if m.node.parent else ''):
            continue
        k = len(an.steps(m.name)) if an else 0
        if k > n:
            best, n = m.name, k
    return best


def _short(rel):
    return rel.replace('app/(site)/(app)/', 'app/').replace('components/', 'c/').replace('lib/', 'lib/')


def _lane_of(rel):
    if rel.startswith('app/') or rel.startswith('components/'):
        return 'Tela (React)'
    if rel == 'middleware.ts':
        return 'Borda (middleware Next.js)'
    return 'Lógica no navegador (lib)'


# --------------------------------------------------------------------------------------------- atividades
def activity(title, name, text, max_steps=24):
    mods, java = cited_units(text)
    out = [header(name, title, 'atividades')]
    out.append('|Pessoa usuária|')
    out.append('start')
    flows = []
    for rel in mods[:3]:
        names = cited_funcs(text, rel) or ([_main_func(rel)] if _main_func(rel) else [])
        names = sorted(dict.fromkeys(n for n in names if n), key=lambda n: -len(T.steps(rel, n)))[:3]
        for fn in names:
            if T.steps(rel, fn) and len(flows) < 4:
                flows.append(('ts', rel, fn))
        if not any(f[1] == rel for f in flows) and _main_func(rel):
            flows.append(('ts', rel, _main_func(rel)))
    for j in [x for x in java if x not in M.REPOS][:3]:
        meth = _java_main(j)
        if meth:
            flows.append(('java', j, meth))
    if not flows:
        out.append(':Usa a funcionalidade;')
        out.append('stop')
        out.append('@enduml')
        return '\n'.join(out)
    first = True
    for kind, unit, fn in flows[:3]:
        lane = _lane_of(unit) if kind == 'ts' else ('API (Spring Boot)' if unit in M.CONTROLLERS or unit in M.SERVICES
                                                     else 'Backend (Java)')
        out.append(f'|{lane}|')
        label = f'{_short(unit)} · {fn}()' if kind == 'ts' else f'{unit}.{fn}()'
        out.append(f'partition "{esc(label, 70)}" {{')
        steps = T.steps(unit, fn) if kind == 'ts' else M.analyzer(unit).steps(fn)
        count, guards_shown, guards_hidden = 0, 0, []
        for st in steps:
            if count >= max_steps:
                out.append(f'  :… e mais {len(steps) - count} passos no código;')
                break
            if st.kind == 'guard' and guards_shown >= 4:
                guards_hidden.append(st.cond if kind == 'ts' else st.code)
                continue
            if st.kind == 'guard':
                guards_shown += 1
                cond = esc(st.cond if kind == 'ts' else (human_code(st.code) if st.code not in ('ERRO', 'NAO_ENCONTRADO')
                                                         else st.cond), 50).replace('(', '[').replace(')', ']').replace(';', ',')
                out.append(f'  if ({cond}?) then (sim)')
                if kind == 'ts':
                    out.append(f'    :{"lança erro" if st.value == "throw" else "encerra este passo"};')
                else:
                    msg = wrap(st.text, 34) if st.text else ''
                    out.append(f'    :{st.status} {st.code}' + (f'\\n«{msg}»' if msg else '') + ';')
                out.append('    stop')
                out.append('  endif')
            elif kind == 'ts' and st.kind == 'call':
                prev = out[-1] if out else ''
                tag = f'<size:10>{esc(_short(st.target), 50)}</size>;'
                if prev.endswith(tag) and prev.count('()') < 4:
                    out[-1] = prev[:-len(tag)].rstrip('\\n').rstrip() + f', {esc(st.name, 30)}()\\n' + tag
                    continue
                out.append(f'  :{esc(st.name, 40)}()\\n{tag}')
            elif kind == 'ts' and st.kind == 'api':
                e = M.match_endpoint(st.verb, st.target)
                out.append(f'  :{st.verb} {esc(st.target, 50)}' + (f'\\n→ {e.controller}.{e.method}' if e else '') + ';')
            elif kind == 'ts' and st.kind == 'set':
                out.append(f'  :estado da tela: {esc(st.name[3:], 30)} = {esc(st.value, 30)};')
            elif kind == 'java' and st.kind == 'call':
                k = kind_of_dep(st.target)
                if k == 'repo':
                    tbl, db = table_of_repo(st.target)
                    out.append(f'  :{repo_op(st.method)} {tbl}' + (f' ({db})' if db != 'MySQL' else '') + ';')
                else:
                    out.append(f'  :{st.target}.{st.method}();')
            elif kind == 'java' and st.kind in ('ai', 'event', 'transition', 'create'):
                lbl = {'ai': f'IA: {st.target}', 'event': f'evento {st.target}', 'transition': f'{st.field} → {st.value}',
                       'create': f'cria {st.target}'}[st.kind]
                out.append(f'  :{lbl};')
            else:
                continue
            count += 1
        if count == 0:
            out.append('  :executa;')
        if guards_hidden:
            out.append(f'  note right\n  e mais {len(guards_hidden)} condições que encerram cedo:\n  {esc(", ".join(dict.fromkeys(guards_hidden)), 90)}\n  end note')
        out.append('}')
        first = False
    out.append('|Pessoa usuária|')
    out.append(':Vê o resultado;')
    out.append('stop')
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- sequência
def sequence(title, name, text, max_msgs=34):
    mods, java = cited_units(text)
    out = [header(name, title, 'sequência')]
    parts, order, lines = {}, [], []

    def part(key, decl):
        if key not in parts:
            parts[key] = decl
            order.append(key)
        return key

    U = part('U', 'actor "Pessoa usuária" as U')
    flows = []
    for r in mods[:2]:
        names = sorted(dict.fromkeys(cited_funcs(text, r)), key=lambda n: -len(T.steps(r, n)))[:2] or ([_main_func(r)] if _main_func(r) else [])
        flows += [('ts', r, n) for n in names if n and T.steps(r, n)][:2]
    flows += [('java', j, _java_main(j)) for j in java if j not in M.REPOS and _java_main(j)][:2 if not flows else 1]
    for kind, unit, fn in flows:
        A = alias(_short(unit) if kind == 'ts' else unit)
        part(A, ('boundary' if kind == 'ts' and _lane_of(unit) == 'Tela (React)' else 'participant')
             + f' "{esc(_short(unit) if kind == "ts" else unit, 50)}" as {A}')
        lines.append(f'== {esc(_short(unit) if kind == "ts" else unit, 50)} · {fn}() ==')
        lines.append(f'U -> {A} : {fn}()')
        lines.append(f'activate {A}')
        steps = T.steps(unit, fn) if kind == 'ts' else M.analyzer(unit).steps(fn)
        n = 0
        for st in steps:
            if n >= max_msgs:
                lines.append(f'note over {A} : … e mais {len(steps) - n} passos')
                break
            if kind == 'ts' and st.kind == 'call':
                B = alias(_short(st.target))
                part(B, f'participant "{esc(_short(st.target), 50)}" as {B}')
                lines.append(f'{A} -> {B} : {esc(st.name, 40)}()')
            elif kind == 'ts' and st.kind == 'api':
                e = M.match_endpoint(st.verb, st.target)
                C = part('API', 'participant "API (Spring Boot)" as API')
                lines.append(f'{A} -> API : {st.verb} {esc(st.target, 50)}' + (f'\\n{e.controller}.{e.method}' if e else ''))
                lines.append(f'API --> {A} : JSON')
            elif kind == 'ts' and st.kind == 'set':
                lines.append(f'{A} -> {A} : {esc(st.name, 30)}("{esc(st.value, 24)}")')
            elif kind == 'ts' and st.kind == 'guard':
                lines.append(f'opt {esc(st.cond, 50)}')
                lines.append(f'{A} --> U : {"erro" if st.value == "throw" else "encerra"}')
                lines.append('end')
            elif kind == 'java' and st.kind == 'guard':
                lines.append(f'alt {esc(human_code(st.code), 50)}')
                lines.append(f'{A} --> U : {st.status} {st.code}')
                lines.append('end')
            elif kind == 'java' and st.kind == 'call':
                k = kind_of_dep(st.target)
                if k == 'repo':
                    tbl, db = table_of_repo(st.target)
                    D = part('DB_' + db, f'database "{db}" as DB_{db}')
                    lines.append(f'{A} -> {D} : {sql_of(repo_op(st.method))} {tbl}')
                else:
                    B = alias(st.target)
                    part(B, f'participant "{st.target}" as {B}')
                    lines.append(f'{A} -> {B} : {st.method}()')
            elif kind == 'java' and st.kind == 'ai':
                part('AI', 'participant "AiEngine" as AI')
                lines.append(f'{A} -> AI : {st.target}')
            elif kind == 'java' and st.kind == 'event':
                part('EV', 'queue "Eventos de domínio" as EV')
                lines.append(f'{A} ->> EV : {st.target}')
            elif kind == 'java' and st.kind == 'transition':
                lines.append(f'{A} -> {A} : {st.field} = {st.value}')
            else:
                continue
            n += 1
        lines.append(f'deactivate {A}')
        lines.append(f'{A} --> U : resultado')
    if not flows:
        part('P', 'boundary "Tela" as P')
        lines.append('U -> P : usa')
    dedup = []
    for ln in lines:
        if dedup and dedup[-1][0] == ln and '->' in ln:
            dedup[-1][1] += 1
        else:
            dedup.append([ln, 1])
    out += [parts[k] for k in order]
    out += [ln + (f' (×{c})' if c > 1 else '') for ln, c in dedup]
    out.append('@enduml')
    return '\n'.join(out)


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


# --------------------------------------------------------------------------------------------- máquina de estados
def state_machine(title, name, text):
    mods, java = cited_units(text)
    best = None
    for rel in mods:
        mod = T.MODULES[rel]
        for setter, (var, typ, init) in mod.states.items():
            trans = []
            for f in mod.funcs.values():
                for st in T.steps(rel, f.name):
                    if st.kind == 'set' and st.name == setter:
                        trans.append((f.name, st.value))
            vals = []
            u = T.TYPES.get(typ)
            if u is not None and u.kind == 'union':
                vals = list(u.values)
            elif '|' in typ:
                vals = T._union_values(typ)
            init_v = init.strip('"\'') if re.match(r'^["\'][^"\']+["\']$', init) else (init if init in ('true', 'false', 'null') else None)
            if init in ('true', 'false') and not vals:
                vals = ['false', 'true']
            for _, v in trans:
                if v not in vals:
                    vals.append(v)
            if init_v and init_v not in vals:
                vals.insert(0, init_v)
            named = bool(re.search(r'\b(' + re.escape(var) + '|' + re.escape(setter) + r')\b', text))
            cited_vals = sum(1 for v in vals if v not in ('true', 'false', 'null') and re.search(r'\b' + re.escape(v) + r'\b', text))
            if not named and cited_vals < 2:
                continue
            score = len(set(v for _, v in trans)) * 3 + len(vals) + (10 if named else 0) + 4 * cited_vals - (4 if vals == ['false', 'true'] else 0)
            if len(vals) >= 2 and len(set(v for _, v in trans)) >= 1 and (best is None or score > best[0]):
                best = (score, rel, var, setter, vals, init_v, trans)
    if best is None:
        return None
    _, rel, var, setter, vals, init_v, trans = best
    rf = re.match(r'^(RF\d+[^—]*)—', title)
    ttl = (rf.group(1).strip() + ' — ' if rf else '') + f'estado de tela "{var}" ({os.path.basename(rel)})'
    out = [header(name, ttl, 'máquina de estados', f'useState em {rel}')]
    comp = alias('S_' + var)
    out.append(f'state "{esc(var, 40)}" as {comp} {{')
    for v in vals:
        out.append(f'  state {alias("v_" + v)} as "{esc(v, 30)}"')
    out.append('}')
    if init_v:
        out.append(f'[*] --> {alias("v_" + init_v)} : montagem')
    seen = set()
    for fn, v in trans:
        key = (fn, v)
        if key in seen:
            continue
        seen.add(key)
        out.append(f'{comp} --> {alias("v_" + v)} : {esc(fn, 40)}()')
    out.append(f'note right of {comp}\n  Setas que saem da borda: o componente troca o estado\n  a partir de qualquer valor anterior (o código não testa\n  o valor anterior antes de chamar {setter}).\nend note')
    out.append('@enduml')
    return '\n'.join(out)


def union_states(title, name, text):
    """Reserva para o frontend: um tipo-união de literais citado pelo diagrama ('idle' | 'loading' | …)."""
    mods, _ = cited_units(text)
    cands = []
    for rel in mods:
        for t in T.MODULES[rel].types.values():
            if t.kind == 'union' and len(t.values) >= 2:
                cited_vals = sum(1 for v in t.values if re.search(r'\b' + re.escape(v) + r'\b', text))
                if t.name in text or cited_vals >= 2:
                    cands.append((t.name in text, cited_vals, t))
    for tn, t in T.TYPES.items():
        if t.kind == 'union' and len(t.values) >= 2 and re.search(r'\b' + re.escape(tn) + r'\b', text):
            cands.append((True, len(t.values), t))
    if not cands:
        return None
    cands.sort(key=lambda c: (not c[0], -c[1]))
    t = cands[0][2]
    rf = re.match(r'^(RF\d+[^—]*)—', title)
    ttl = (rf.group(1).strip() + ' — ' if rf else '') + f'valores de {t.name} ({os.path.basename(t.module)})'
    out = [header(name, ttl, 'máquina de estados', f'tipo-união em {t.module}')]
    out.append(f'state "{t.name}" as U_{alias(t.name)} {{')
    for v in t.values:
        out.append(f'  state {alias("u_" + v)} as "{esc(v, 30)}"')
    out.append('}')
    out.append(f'[*] --> {alias("u_" + t.values[0])}')
    for a, b in zip(t.values, t.values[1:]):
        out.append(f'{alias("u_" + a)} -[dashed]-> {alias("u_" + b)}')
    out.append(f'note bottom of U_{alias(t.name)}\n  Ordem declarada no tipo (setas tracejadas). Nenhum useState\n  troca esse valor com literal no código citado.\nend note')
    out.append('@enduml')
    return '\n'.join(out)


GEN = {'atividades': activity, 'sequencia': sequence, 'componentes': components, 'classes': classes,
       'estados': state_machine}
