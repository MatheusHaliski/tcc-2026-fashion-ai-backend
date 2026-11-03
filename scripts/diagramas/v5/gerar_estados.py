"""Máquina de estados por RF a partir das mudanças de estado do código (Entidade.campo enum ou texto) e, como
última reserva, de um enum citado pelo diagrama do time."""
from __future__ import annotations

import re

import modelo as M
from gerar_citacao import _cited, _rf_prefix, _snake
from gerar_consultas import callers_of
from gerar_estilo import alias, esc, header, wrap


# --------------------------------------------------------------------------------------------- máquina de estados
def pick_state_targets(sc, cited_text):
    """Campos de estado candidatos, do mais provável ao menos: campos de status (enum ou texto) e qualquer campo enum
    de que o diagrama do time cite ao menos dois valores (ex.: DailyLook.feedback). Só entra o que o texto do diagrama
    apoia (entidade, tabela, enum ou valores citados) — o escopo da pasta sozinho não basta."""
    cands = []
    ents = list(dict.fromkeys([e for e in M.ENTITIES if _cited(e, cited_text)] + sc.entities))
    for e in ents:
        e_c = _cited(e, cited_text)
        t_c = _cited(M.table_of(e) or '§', cited_text)
        for fname, ftype, rel, init in M.entity_fields(e):
            if rel is not None or not (ftype in M.ENUMS or (ftype == 'String' and M.STATUS_FIELD.match(fname))):
                continue
            is_status = bool(M.STATUS_FIELD.match(fname))
            trs = [t for t in M.TRANSITIONS if t[0] == e and t[1] == fname]
            vals = M.ENUMS.get(ftype, []) if ftype in M.ENUMS else sorted({t[4] for t in trs if not t[4].startswith('?')})
            cv = sum(1 for v in vals if _cited(v, cited_text))
            en_c = ftype in M.ENUMS and _cited(ftype, cited_text)
            if not is_status and (cv < 2 or not (e_c or t_c or en_c)):
                continue
            if not (e_c or t_c or en_c or cv >= 2):
                continue
            if not (trs or ftype in M.ENUMS):
                continue
            title = sc.title or ''
            in_title = (_cited(e, title) or _cited(M.table_of(e) or '§', title) or (ftype in M.ENUMS and _cited(ftype, title))
                        or (e_c and (_cited(fname, title) or _cited(_snake(fname), title))))
            score = (len(trs) + 6 * cv + 12 * e_c + 15 * en_c + 5 * t_c + 3 * _cited(fname, cited_text) + 20 * in_title
                     + 8 * (is_status and bool(trs)))
            cands.append((score, e, fname, ftype, init, cv, in_title))
    cands.sort(key=lambda x: -x[0])
    return cands


def _enum_region(ent, fld, ftype, init, comp):
    """Linhas de um estado composto para Entidade.campo (enum ou texto), com as mudanças que o código faz."""
    trs = [t for t in M.TRANSITIONS if t[0] == ent and t[1] == fld]
    states = list(M.ENUMS.get(ftype, [])) if ftype in M.ENUMS else []
    for t in trs:
        if not t[4].startswith('?') and t[4] not in states:
            states.append(t[4])
        for s0 in t[3]:
            s0 = s0.lstrip('!')
            if s0 not in states:
                states.append(s0)
    initial = None
    if init:
        m = re.search(r'([A-Z][A-Z0-9_]*)"?$', init.strip())
        initial = m.group(1) if m and m.group(1) in states else None
    if initial is None:
        initial = _initial_from_creation(ent, fld, states)
    out = [f'state "{ent}.{fld}" as {comp} {{']
    for st in states:
        out.append(f'  state {comp}_{alias(st)} as "{st}"')
    out.append('}')
    if initial:
        out.append(f'[*] --> {comp}_{alias(initial)} : criação')
    # uma seta por par (origem, destino); vários métodos vão juntos no rótulo
    edges, anyvalue, border = {}, [], False

    def add(a, b, svm):
        lst = edges.setdefault((a, b), [])
        if svm not in lst:
            lst.append(svm)
    for _, _, _, srcs, dst, svm in trs:
        if dst.startswith('?'):
            anyvalue.append(f'{svm.split(".", 1)[1]}({dst[1:]})')
            if len(states) <= 4:
                for st in states:
                    add('*', st, svm)
            continue
        req = [x for x in srcs if not x.startswith('!')]
        exc = [x[1:] for x in srcs if x.startswith('!')]
        if req:
            for s0 in req:
                if s0 in states:
                    add(s0, dst, svm)
        elif exc and len(states) - len(exc) <= 4:
            for s0 in states:
                if s0 not in exc and s0 != dst:
                    add(s0, dst, svm)
        else:
            add('*', dst, svm)
    for (a, b), svms in edges.items():
        if len(svms) == 1:
            lbl = label_of(svms[0])
        else:
            names = [v.split('.', 1)[1] + '()' for v in svms]
            lbl = wrap(', '.join(names[:5]) + (f' +{len(names) - 5}' if len(names) > 5 else ''), 36)
        src_node = comp if a == '*' else f'{comp}_{alias(a)}'
        border |= a == '*'
        out.append(f'{src_node} --> {comp}_{alias(b)} : {lbl}')
    reached = {t[4] for t in trs}
    unreached = [x for x in states if x != initial and x not in reached] if not anyvalue else []
    if unreached:
        out.append(f'note bottom of {comp}\n  Sem mudança explícita no código para: {", ".join(unreached[:8])}'
                   + ('…' if len(unreached) > 8 else '') + '\n  (valor vindo de importação, regra calculada ou dado legado)\nend note')
    if anyvalue and len(states) > 4:
        out.append(f'note bottom of {comp}\n  Recebe o valor escolhido em: {esc(", ".join(dict.fromkeys(anyvalue)), 80)}\nend note')
    return out, border


def _initial_from_creation(ent, fld, states):
    """Estado inicial: o valor que o método que cria a entidade grava primeiro no campo (new X(); x.setStatus(...))."""
    for n, t in M.TYPES.items():
        if t.module != 'application' or t.kind != 'class':
            continue
        for m in t.methods:
            if m.node is None:
                continue
            created = False
            for st in M.analyzer(n).steps(m.name):
                if st.kind == 'create' and st.target == ent:
                    created = True
                elif created and st.kind == 'transition' and st.field == fld and st.value in states:
                    return st.value
    return None


def label_of(svm):
    svc, meth = svm.split('.', 1)
    eps = callers_of(svc, meth)
    return f'{meth}()' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')


def state_machine(sc, name, cited_text):
    cands = pick_state_targets(sc, cited_text)
    if not cands:
        return None
    top = cands[0]
    # o campo de status da mesma entidade vem primeiro; o outro campo citado vira a segunda região (RF45, RF53)
    if not M.STATUS_FIELD.match(top[2]):
        st = next((c for c in cands[1:] if c[1] == top[1] and M.STATUS_FIELD.match(c[2])), None)
        if st is not None:
            cands = [st, top] + [c for c in cands[1:] if c is not st]
    _, ent, fld, ftype, init, _, _ = cands[0]
    # um segundo campo da mesma entidade quando o time também cita os valores dele (ex.: DailyLook source + feedback)
    extra = next((c for c in cands[1:] if c[1] == ent and c[2] != fld and c[5] >= 2
                  and c[2] not in ('type', 'kind', 'category', 'subcategory') and len(M.ENUMS.get(c[3], [])) <= 8
                  and (any(t[0] == ent and t[1] == c[2] for t in M.TRANSITIONS) or c[5] >= 3
                       or (M.STATUS_FIELD.match(c[2]) and _cited(c[3], sc.title or '')))), None)
    fields = [(fld, ftype, init)] + ([(extra[2], extra[3], extra[4])] if extra else [])
    ttl = _rf_prefix(sc) + f'ciclo de vida de {ent}.' + ' e '.join(f[0] for f in fields)
    sub = ' · '.join(f'enum {t}' if t != 'String' else 'campo texto' for _, t, _ in fields) + f' · tabela {M.table_of(ent)}'
    out = [header(name, ttl, 'máquina de estados', sub)]
    border = False
    for i, (f, t, ini) in enumerate(fields):
        lines, b = _enum_region(ent, f, t, ini, f'Ciclo_{alias(ent)}' + (f'_{alias(f)}' if i else ''))
        out += lines
        border |= b
    if border:
        out.append(f'note right of Ciclo_{alias(ent)}\n  Setas que saem da borda: a mudança vale\n  a partir de qualquer estado (o código não\n  testa o estado anterior).\nend note')
    out.append('@enduml')
    return '\n'.join(out)


def enum_states(sc, name, text):
    """Última reserva: um enum citado pelo diagrama (ou pela pasta), com os valores e o que o código faz com eles."""
    cands = []
    # nomes de estado em CAIXA ALTA que o diagrama do time usa: o enum tem de cobrir boa parte deles
    team = set(re.findall(r'\b[A-Z][A-Z0-9_]{3,}\b', text))
    for e, vals in M.ENUMS.items():
        if len(vals) < 2:
            continue
        hits = sum(1 for v in vals if _cited(v, text))
        if _cited(e, text) or (hits >= 2 and hits >= 0.4 * len(team)):
            cands.append((hits + 5 * _cited(e, text), e))
    if not cands:
        return None
    en = max(cands)[1]
    trs = [t for t in M.TRANSITIONS if t[2] == en]
    rf = re.match(r'^(RF\d+[^—]*)—', sc.title)
    ttl = (rf.group(1).strip() + ' — ' if rf else '') + f'valores de {en}'
    out = [header(name, ttl, 'máquina de estados', f'enum {en} · ' + (f'{len(trs)} mudanças no código' if trs else 'sem mudança explícita no código: valor calculado, importado ou definido na criação'))]
    out.append(f'state "{en}" as E_{alias(en)} {{')
    for v in M.ENUMS[en]:
        out.append(f'  state {alias(v)} as "{v}"')
    out.append('}')
    out.append(f'[*] --> {alias(M.ENUMS[en][0])}')
    seen = set()
    for ent, fld, _, srcs, dst, svm in trs:
        lbl = svm.split('.', 1)[1] + '()'
        req = [x for x in srcs if not x.startswith('!')]
        for src_ in (req or ['*']):
            key = (src_, dst, lbl)
            if key in seen or dst not in M.ENUMS[en]:
                continue
            seen.add(key)
            out.append((f'{alias(src_)} --> {alias(dst)} : {lbl}') if src_ != '*' else f'E_{alias(en)} --> {alias(dst)} : {lbl}')
    if not trs:
        vals = M.ENUMS[en]
        for a, b in zip(vals, vals[1:]):
            out.append(f'{alias(a)} -[dashed]-> {alias(b)}')
        out.append(f'note bottom of E_{alias(en)}\n  Ordem declarada no enum (setas tracejadas); o código não troca\n  este valor com setStatus — ele é calculado ou definido na criação.\nend note')
    out.append('@enduml')
    return '\n'.join(out)
