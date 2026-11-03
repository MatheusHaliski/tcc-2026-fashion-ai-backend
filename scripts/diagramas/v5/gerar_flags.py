"""Estados de campos booleanos (Comment.active) e de campos de artefato (vazio/preenchido) que o diagrama do time
cita e o código muda."""
from __future__ import annotations

import re

import modelo as M
from gerar_citacao import _cited, _rf_prefix, _snake
from gerar_estados import label_of
from gerar_estilo import alias, esc, header, wrap


def _flag_region(ent, fld, init, comp, presence=False):
    """Estado composto de um campo booleano (Comment.active: true/false) ou de um campo de artefato
    (WardrobeItem.mannequinImageUrl: vazio/preenchido), com a criação e cada setX(...) do código."""
    trs = [t for t in M.TRANSITIONS if t[0] == ent and t[1] == fld]
    T, F = f'{comp}_T', f'{comp}_F'
    yes, no = ('preenchido', 'vazio (null)') if presence else ('true', 'false')
    out = [f'state "{ent}.{fld}" as {comp} {{',
           f'  state "{fld} = {yes}" as {T}' if not presence else f'  state "{fld} {yes}" as {T}',
           f'  state "{fld} = {no}" as {F}' if not presence else f'  state "{fld} {no}" as {F}']
    start = T if (init or '').strip() == 'true' else F
    makers = []
    if not presence:
        makers = [f'{n}.{m.name}' for n, t in M.TYPES.items() if t.module == 'application' for m in t.methods
                  if m.node is not None and any(st.kind == 'create' and st.target == ent for st in M.analyzer(n).steps(m.name))][:2]
    lbl = 'criação' + (f'\\n{esc(", ".join(x.split(".", 1)[1] + "()" for x in makers), 50)}' if makers else '') \
        + (f'\\n(valor inicial {init or "false"})' if not presence else '')
    out.append(f'  [*] --> {start} : {lbl}')
    # uma seta por par de estados; com vários métodos, os nomes vão juntos no rótulo
    by_pair = {}
    for _, _, _, _, val, svm in trs:
        if val in ('false', 'null'):
            pairs = [(T, F)]
        elif val in ('true', 'set'):
            pairs = [(F, T)] if not presence else [(F, T), (T, T)]
        else:
            pairs = [(T, F), (F, T)]
        for xy in pairs:
            lst = by_pair.setdefault(xy, [])
            if svm not in lst:
                lst.append(svm)
    for (x, y), svms in by_pair.items():
        if len(svms) == 1:
            lab = label_of(svms[0])
        else:
            lab = wrap(', '.join(v.split('.', 1)[1] + '()' for v in svms), 40)
        val = next((t[4] for t in trs if t[5] in svms and t[4].startswith('?')), '')
        out.append(f'  {x} --> {y} : ' + ('substitui: ' if presence and x == y else '') + lab
                   + (f'\\n({val[1:]})' if val else ''))
    out.append('}')
    if not presence:
        cap = fld[0].upper() + fld[1:]
        qs = sorted({m.name for r, (e, db) in M.REPOS.items() if e == ent for m in M.TYPES[r].methods
                     if re.search(cap + r'(True|False)', m.name)})
        if qs:
            out.append(f'note bottom of {comp}\n  Consultas que filtram por {fld}:\n  '
                       + '\n  '.join(esc(q, 70) for q in qs[:5]) + ('\n  …' if len(qs) > 5 else '') + '\nend note')
    return out


def _flag_targets(text, ents=None, title=''):
    """(entidade, campo, inicial, presença?) dos booleanos e campos de artefato que o texto cita e o código muda."""
    out = []
    for e in (ents or M.ENTITIES):
        e_c = _cited(e, text) or _cited(M.table_of(e) or '§', text)
        for f, t, r, init in M.entity_fields(e):
            if r is not None:
                continue
            boolean = t in ('boolean', 'Boolean')
            presence = f in M.PRESENCE_FIELD_NAMES
            if not (boolean or presence):
                continue
            f_c = _cited(f, text) or (presence and _cited(_snake(f), text))
            trs = [x for x in M.TRANSITIONS if x[0] == e and x[1] == f]
            if not trs or not f_c:
                continue
            # a entidade (ou a tabela) tem de aparecer no texto; campo de artefato também vale se o título o nomeia
            if not (e_c or (presence and title and (_cited(f, title) or _cited(_snake(f), title)))):
                continue
            in_title = bool(title) and (_cited(f, title) or _cited(_snake(f), title))
            out.append((len(trs) + 12 * e_c + 20 * in_title, e, f, init, presence))
    out.sort(key=lambda x: -x[0])
    return out


def flag_states(sc, name, text):
    """Máquina de estados de booleanos/campos de artefato citados pelo diagrama do time (ex.: Comment.active;
    mannequinImageUrl da peça e do esquema)."""
    tg = _flag_targets(text, title=sc.title or '')
    if not tg:
        return None
    main = tg[0]
    # o mesmo campo em outras entidades e outros campos citados das mesmas entidades (até 3 regiões)
    chosen = [main] + [x for x in tg[1:] if x[2] == main[2] or x[1] == main[1]]
    chosen = chosen[:3]
    ttl = _rf_prefix(sc) + 'ciclo de vida de ' + ', '.join(f'{e}.{f}' for _, e, f, _, _ in chosen)
    kinds = sorted({'campo de artefato (vazio/preenchido)' if p else 'campo booleano' for *_, p in chosen})
    out = [header(name, ttl, 'máquina de estados', ' · '.join(kinds) + ' · tabela '
                  + ', '.join(dict.fromkeys(M.table_of(e) for _, e, *_ in chosen)))]
    for _, e, f, init, p in chosen:
        out += _flag_region(e, f, init, f'B_{alias(e)}_{alias(f)}', presence=p)
    out.append('@enduml')
    return '\n'.join(out)
