"""Atividades e sequência por unidades: os passos das funções TS e dos métodos Java citados, na ordem do código."""
from __future__ import annotations

import modelo as M
import tsmodelo as T
from gerar_consultas import kind_of_dep, repo_op, sql_of, table_of_repo
from gerar_estilo import alias, esc, header, human_code, wrap
from unidades_citadas import _java_main, _lane_of, _main_func, _short, cited_funcs, cited_units


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
