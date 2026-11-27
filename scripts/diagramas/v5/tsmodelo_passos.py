"""Consultas ao modelo do frontend: passos de uma função, quem importa um módulo e o módulo citado num diagrama."""
from __future__ import annotations

import re

from tsmodelo_indice import MODULES
from tsmodelo_leitura import _t
from tsmodelo_tipos import TsStep


API_RX = re.compile(r'\bapi\.(get|post|put|patch|delete|upload|blobUrl)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*([`"\'])(/[^`"\']*)\2')


def steps(module_rel, func_name, depth=0, seen=None):
    """Passos de uma função: chamadas a funções conhecidas (do próprio módulo ou importadas), API, guardas e setters."""
    mod = MODULES.get(module_rel)
    if mod is None or func_name not in mod.funcs:
        return []
    fn = mod.funcs[func_name]
    if fn.node is None:
        return []
    seen = set() if seen is None else seen
    key = (module_rel, func_name)
    if key in seen:
        return []
    seen = seen | {key}
    out = []
    src = mod.src

    def walk(n):
        t = n.type
        if t == 'if_statement':
            cond = n.child_by_field_name('condition')
            cons = n.child_by_field_name('consequence')
            ctext = _t(cons, src) if cons is not None else ''
            body = ctext.strip()
            early = re.match(r'^\{?\s*(return\b[^;]*;?|throw\b[^;]*;?)\s*\}?$', body, re.S)
            if early and cond is not None:
                out.append(TsStep('guard', cond=_t(cond, src).strip('() '), value='throw' if 'throw' in body else 'return'))
                alt = n.child_by_field_name('alternative')
                if alt is not None:
                    walk(alt)
                return
        if t == 'call_expression':
            fnode = n.child_by_field_name('function')
            ftxt = _t(fnode, src) if fnode is not None else ''
            whole = _t(n, src)
            m = API_RX.match(whole)
            if m:
                verb = {'get': 'GET', 'post': 'POST', 'put': 'PUT', 'patch': 'PATCH', 'delete': 'DELETE', 'upload': 'POST',
                        'blobUrl': 'GET'}[m.group(1)]
                out.append(TsStep('api', target=m.group(3), verb=verb))
            elif re.match(r'^set[A-Z]\w*$', ftxt) and ftxt in mod.states:
                args = n.child_by_field_name('arguments')
                a = _t(args, src).strip('() ') if args is not None else ''
                lit = re.match(r'^["\']([^"\']+)["\']$', a) or re.match(r'^(true|false|null)$', a)
                if lit:
                    out.append(TsStep('set', name=ftxt, value=lit.group(1)))
            else:
                base = ftxt.split('.')[0]
                name = ftxt.split('.')[-1]
                if base in mod.imports and not mod.imports[base][0].startswith(('react', 'next', 'three', '@react-three')):
                    target, imported = mod.imports[base]
                    called = imported if ftxt == base else f'{imported}.{name}' if imported != 'default' else name
                    out.append(TsStep('call', target=target, name=called if ftxt == base else name))
                elif ftxt in mod.funcs and depth < 2:
                    out.extend(steps(module_rel, ftxt, depth + 1, seen))
        for ch in n.children:
            walk(ch)
    walk(fn.node)
    return out


def importers_of(rel):
    return [m.path for m in MODULES.values() if any(v[0] == rel for v in m.imports.values())]


def imports_of(rel):
    mod = MODULES.get(rel)
    if mod is None:
        return []
    return sorted({v[0] for v in mod.imports.values() if v[0] in MODULES})


def find_module(token):
    """Acha o módulo citado num diagrama ('garments.ts', 'lib/card-art.ts', 'mirror/page.tsx')."""
    token = token.lstrip('n')  # '\nlib/...' perdeu a barra no texto do diagrama
    hits = [p for p in MODULES if p.endswith(token)]
    if not hits:
        hits = [p for p in MODULES if p.endswith('/' + token.split('/')[-1])]
    return sorted(hits, key=len)[0] if hits else None
