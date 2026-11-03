"""Etapas de um pipeline do frontend (ex.: dress() da roupa no avatar), um estado por chamada encadeada."""
from __future__ import annotations

import os
import re

import tsmodelo as T
from estados_ts_apoio import _cited, _rf_prefix
from gerar_estilo import alias, esc, header, wrap


# --------------------------------------------------------------------------------------------- pipeline
def _calls(mod, node, enclosing=None, out=None):
    """Chamadas a funções (identificadores) na ordem de avaliação — argumentos antes da própria chamada — como
    (nome, chamada que a contém nos argumentos, texto dos argumentos)."""
    out = [] if out is None else out
    if node.type == 'call_expression':
        fn = node.child_by_field_name('function')
        a = node.child_by_field_name('arguments')
        name = T._t(fn, mod.src) if fn is not None and fn.type == 'identifier' else None
        if a is not None:
            _calls(mod, a, name or enclosing, out)
        if name:
            out.append((name, enclosing, T._t(a, mod.src) if a is not None else ''))
        elif fn is not None:
            _calls(mod, fn, enclosing, out)
        return out
    for c in node.children:
        _calls(mod, c, enclosing, out)
    return out


def _team_word(func, text):
    """Nome que o time deu à etapa: a palavra com inicial maiúscula logo antes do nome da função no diagrama."""
    m = re.search(r'([A-ZÀ-Ý][\wÀ-ÿ]+)\s+' + re.escape(func) + r'\b', text)
    return m.group(1) if m and m.group(1) not in T.FUNCS else None


def pipeline_states(title, name, text):
    """Etapas de uma peça num pipeline: a função que mais encadeia as funções citadas; cada chamada que recebe o
    resultado da primeira etapa (ex.: gg = garmentGeometry(...) → relaxGarment(gg), foldGarment(gg), …) é uma etapa."""
    cited = {f for f in T.FUNCS if _cited(f, text)}
    best = None
    for rel, mod in T.MODULES.items():
        for fn, f in mod.funcs.items():
            if f.node is None:
                continue
            calls = _calls(mod, f.node)
            hit = {c[0] for c in calls if c[0] in cited}
            if len(hit) >= 3 and (best is None or len(hit) > best[0]):
                best = (len(hit), rel, fn, calls)
    if best is None:
        return None
    _, rel, fn, calls = best
    mod = T.MODULES[rel]
    body = T._t(mod.funcs[fn].node, mod.src)
    known = lambda c: c in mod.imports and mod.imports[c][0] in T.MODULES  # noqa: E731
    # funções citadas que o módulo chama antes, em outra função (ex.: kindOf em outfitOf): primeira etapa
    pre = []
    for ofn, of in mod.funcs.items():
        if ofn != fn and of.node is not None and of.line < mod.funcs[fn].line:
            pre += [(c[0], ofn) for c in _calls(mod, of.node) if c[0] in cited and (c[0], ofn) not in pre]
    pre_names = {p[0] for p in pre}
    seq = [c for c in calls if known(c[0]) and c[0] not in pre_names]
    seen, uniq = set(), []
    for c in seq:
        if c[0] not in seen:
            seen.add(c[0])
            uniq.append(c)
    # a variável que guarda o resultado da primeira função citada (ex.: const gg = garmentGeometry(...))
    var = None
    for c in uniq:
        if c[0] in cited:
            m = re.search(r'(?:const|let)\s+(\w+)\s*=\s*' + re.escape(c[0]) + r'\(', body)
            if m:
                var = m.group(1)
                break
    heads = [c[0] for c in uniq if c[0] in cited or (var and re.search(r'\b' + var + r'\b', c[2]))]
    stages = [[p, [], [ofn]] for p, ofn in pre]
    prep, cur, pending = [], None, {}
    for c in uniq:
        if c[0] in heads:
            cur = [c[0], pending.pop(c[0], []), []]
            stages.append(cur)
        elif c[1] in heads and c[1] not in [st[0] for st in stages]:
            pending.setdefault(c[1], []).append(c[0])   # argumento de uma etapa que ainda vem: fica com ela
        elif cur is None:
            prep.append(c[0])
        else:
            cur[1].append(c[0])
    if prep:
        first = len(pre)
        stages.insert(first, ['preparação', prep, []])
    out = [header(name, _rf_prefix(title) + f'{fn}(): etapas de uma peça', 'máquina de estados',
                  f'{rel} · {len(uniq) + len(pre)} funções chamadas em ordem · etapas = chamadas que recebem '
                  + (f'"{var}"' if var else 'o resultado anterior'))]
    keys = []
    for i, (head, helpers, where) in enumerate(stages):
        k = f'E{i}_{alias(head)}'
        keys.append(k)
        if head == 'preparação':
            out.append(f'state "preparação" as {k}')
        else:
            word = _team_word(head, text)
            label = (word + '\\n' if word else '') + f'{head}()' + (f' em {where[0]}()' if where else '')
            out.append(f'state "{label}" as {k}')
        if helpers:
            out.append(f'{k} : {wrap(", ".join(x + "()" for x in helpers), 46)}')
        if head != 'preparação':
            origin = os.path.basename(mod.imports[head][0]) if head in mod.imports else os.path.basename(rel)
            out.append(f'{k} : <size:9>{esc(origin, 40)}</size>')
    out.append(f'[*] --> {keys[0]}')
    for a_, b_ in zip(keys, keys[1:]):
        out.append(f'{a_} --> {b_}')
    out.append(f'{keys[-1]} --> [*]')
    out.append(f'note right of {keys[0]}\n  Ordem das chamadas em {fn}() ({os.path.basename(rel)}).\n'
               + (f'  Cada etapa é uma chamada que recebe "{var}"\n  (a geometria da peça); as outras funções\n  aparecem dentro da etapa em que são chamadas.\n' if var else '')
               + '  Nomes em destaque: os que o time deu às etapas.\nend note')
    out.append('@enduml')
    return '\n'.join(out)
