"""Máquina de estados por unidades: useState com literais e, como reserva, um tipo-união citado."""
from __future__ import annotations

import os
import re

import tsmodelo as T
from gerar_estilo import alias, esc, header
from unidades_citadas import cited_units


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
