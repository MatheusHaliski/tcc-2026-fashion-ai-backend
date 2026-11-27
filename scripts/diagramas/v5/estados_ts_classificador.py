"""Estado calculado por uma função classificadora do frontend (ex.: resolveEnvironment)."""
from __future__ import annotations

import os
import re

import tsmodelo as T
from estados_ts_apoio import _balanced, _cited, _func, _rf_prefix
from gerar_estilo import alias, esc, header, wrap


# --------------------------------------------------------------------------------------------- classificador
def _returns(body):
    """[(condição, rótulo)] dos returns de um rótulo: return "x" / return { kind: "x" } / kind: c ? "a" : "b"."""
    out = []
    for m in re.finditer(r'\bif\s*\(', body):
        end = _balanced(body, m.end() - 1)
        cond = body[m.end():end - 1].strip()
        rest = body[end:end + 300]
        r = re.match(r'\s*\{?\s*return\s*(?:\{\s*\w+\s*:\s*)?"([\w-]+)"', rest)
        if r:
            out.append((cond, r.group(1)))
    for r in re.finditer(r'return\s*\{\s*(\w+)\s*:\s*([^?,{}]+?)\s*\?\s*"([\w-]+)"\s*:\s*"([\w-]+)"', body):
        out.append((r.group(2).strip(), r.group(3)))
        out.append(('senão', r.group(4)))
    return out


def classifier_states(title, name, text):
    for fname in re.findall(r'[A-Za-z_]\w+', title or ''):
        mod, f = _func(fname)
        if f is None or f.node is None:
            continue
        body = T._t(f.node, mod.src)
        rules = _returns(body)
        if len({r[1] for r in rules}) < 2:
            continue
        hits = sum(1 for lb in {r[1] for r in rules} if _cited(lb, text))
        if hits < 2:
            continue
        out = [header(name, _rf_prefix(title) + f'{fname}(): estado calculado', 'máquina de estados',
                      f'{mod.path} · vale a primeira regra verdadeira')]
        comp = f'C_{alias(fname)}'
        out.append(f'state "{fname}()" as {comp} {{')
        out.append(f'  state {comp}_avaliar <<choice>>')
        for lb in dict.fromkeys(r[1] for r in rules):
            out.append(f'  state "{lb}" as {comp}_{alias(lb)}')
        out.append('}')
        callers = [r for r in T.importers_of(mod.path) if re.search(r'\b' + fname + r'\(', T.MODULES[r].src.decode('utf-8', 'replace'))]
        out.append(f'[*] --> {comp}_avaliar : a cada mudança das peças vestidas' if 'items' in body[:200]
                   else f'[*] --> {comp}_avaliar : cada chamada')
        for i, (cond, lb) in enumerate(rules, 1):
            out.append(f'{comp}_avaliar --> {comp}_{alias(lb)} : [{i}] {wrap(cond, 40) if cond != "senão" else cond}')
        # parâmetros cujo tipo é uma união nomeada (ex.: mode: EnvironmentMode = "auto" | "neutral" | { pinned })
        sig = mod.src.decode('utf-8', 'replace')
        sm = re.search(r'function\s+' + fname + r'\s*\(([^)]*)\)', sig)
        notes = []
        if sm:
            for pn, pt in re.findall(r'(\w+)\s*:\s*(\w+)(?:\s*=\s*[^,]+)?', sm.group(1)):
                tm = re.search(r'type\s+' + pt + r'\s*=\s*([^;]+);', sig)
                if tm and '|' in tm.group(1):
                    notes.append(f'{pn}: {esc(tm.group(1), 70)}')
        if callers:
            notes.append('chamado por: ' + ', '.join(os.path.basename(c) for c in callers[:4]))
        notes.append('Não é gravado: recalculado a cada chamada.')
        out.append(f'note right of {comp}\n  ' + '\n  '.join(notes) + '\nend note')
        out.append('@enduml')
        return '\n'.join(out)
    return None
