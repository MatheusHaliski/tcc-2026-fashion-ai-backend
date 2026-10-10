"""Modelo do frontend (TypeScript/TSX) para os diagramas v5.

Por módulo (arquivo em lib/, components/ e app/): importações, declarações (funções, componentes React, classes,
interfaces, tipos e uniões de literais), e por função os passos em ordem — chamadas a funções importadas ou locais,
chamadas à API (api.get/post/...), condições que encerram cedo (if … return/throw) e mudanças de estado de tela
(setX("valor") de useState).
"""
from __future__ import annotations

import glob
import os
import re
from dataclasses import dataclass, field

import tree_sitter_typescript as tst
from tree_sitter import Language, Parser

import modelo as M

ROOT = M.ROOT
TSX = Parser(Language(tst.language_tsx()))
TS = Parser(Language(tst.language_typescript()))


@dataclass
class TsFunc:
    name: str
    module: str
    exported: bool
    kind: str               # function | component | method
    node: object = None
    line: int = 0


@dataclass
class TsType:
    name: str
    module: str
    kind: str               # interface | type | union | class
    props: list = field(default_factory=list)     # [(nome, tipo)]
    values: list = field(default_factory=list)    # literais da união


@dataclass
class TsModule:
    path: str               # relativo à raiz
    imports: dict           # identificador local -> (módulo relativo ou pacote, nome importado)
    funcs: dict
    types: dict
    src: bytes = b''
    states: dict = field(default_factory=dict)    # setter -> (variável, tipo/literais iniciais)


@dataclass
class TsStep:
    kind: str               # call | api | guard | set
    target: str = ''        # módulo da função chamada / rota
    name: str = ''          # função chamada / setter
    value: str = ''
    cond: str = ''
    verb: str = ''


def _t(node, src):
    return src[node.start_byte:node.end_byte].decode('utf-8', 'replace')


def _resolve(spec, from_rel):
    if spec.startswith('@/'):
        base = os.path.join(ROOT, spec[2:])
    elif spec.startswith('.'):
        base = os.path.normpath(os.path.join(ROOT, os.path.dirname(from_rel), spec))
    else:
        return spec
    for ext in ('.ts', '.tsx', '/index.ts', '/index.tsx', ''):
        if os.path.isfile(base + ext):
            return os.path.relpath(base + ext, ROOT)
    return os.path.relpath(base, ROOT)


def _union_values(text):
    vals = re.findall(r'"([^"]+)"|\'([^\']+)\'', text)
    vals = [a or b for a, b in vals]
    rest = re.sub(r'"[^"]*"|\'[^\']*\'|\|', '', text).strip()
    return vals if vals and not rest else []


def _parse(rel):
    path = os.path.join(ROOT, rel)
    src = open(path, 'rb').read()
    tree = (TSX if rel.endswith('.tsx') else TS).parse(src)
    mod = TsModule(rel, {}, {}, {}, src)
    root = tree.root_node
    for node in root.children:
        exported = False
        decl = node
        if node.type == 'export_statement':
            exported = True
            d = node.child_by_field_name('declaration')
            if d is None:
                continue
            decl = d
        if decl.type == 'import_statement':
            spec_node = decl.child_by_field_name('source')
            spec = _t(spec_node, src).strip('"\'') if spec_node is not None else ''
            target = _resolve(spec, rel)
            clause = _t(decl, src)
            m = re.search(r'import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)', clause)
            if m:
                mod.imports[m.group(1)] = (target, 'default')
            for mm in re.finditer(r'\{([^}]*)\}', clause):
                for part in mm.group(1).split(','):
                    part = part.strip().replace('type ', '')
                    if not part:
                        continue
                    if ' as ' in part:
                        a, b = [x.strip() for x in part.split(' as ')]
                        mod.imports[b] = (target, a)
                    else:
                        mod.imports[part] = (target, part)
            continue
        if decl.type in ('function_declaration', 'generator_function_declaration'):
            name = _t(decl.child_by_field_name('name'), src)
            kind = 'component' if name[:1].isupper() else 'function'
            mod.funcs[name] = TsFunc(name, rel, exported, kind, decl.child_by_field_name('body'), decl.start_point[0] + 1)
        elif decl.type == 'lexical_declaration':
            for d in decl.children:
                if d.type != 'variable_declarator':
                    continue
                name = _t(d.child_by_field_name('name'), src)
                v = d.child_by_field_name('value')
                if v is not None and v.type in ('arrow_function', 'function_expression', 'function'):
                    kind = 'component' if name[:1].isupper() else 'function'
                    mod.funcs[name] = TsFunc(name, rel, exported, kind, v.child_by_field_name('body'), d.start_point[0] + 1)
                elif v is not None and v.type == 'call_expression' and re.match(r'(React\.)?(memo|forwardRef)\(', _t(v, src)):
                    args = v.child_by_field_name('arguments')
                    fn = next((a for a in args.children if a.type in ('arrow_function', 'function_expression')), None) if args else None
                    if fn is not None:
                        mod.funcs[name] = TsFunc(name, rel, exported, 'component', fn.child_by_field_name('body'), d.start_point[0] + 1)
        elif decl.type == 'class_declaration':
            name = _t(decl.child_by_field_name('name'), src)
            body = decl.child_by_field_name('body')
            props = []
            for ch in body.children if body else []:
                if ch.type in ('public_field_definition', 'property_signature'):
                    n = ch.child_by_field_name('name')
                    ty = ch.child_by_field_name('type')
                    if n is not None:
                        props.append((_t(n, src), _t(ty, src).lstrip(': ') if ty is not None else ''))
                elif ch.type == 'method_definition':
                    n = _t(ch.child_by_field_name('name'), src)
                    mod.funcs[f'{name}.{n}'] = TsFunc(f'{name}.{n}', rel, exported, 'method', ch.child_by_field_name('body'),
                                                      ch.start_point[0] + 1)
            mod.types[name] = TsType(name, rel, 'class', props)
        elif decl.type == 'interface_declaration':
            name = _t(decl.child_by_field_name('name'), src)
            body = decl.child_by_field_name('body')
            props = []
            for ch in body.children if body else []:
                if ch.type in ('property_signature', 'method_signature'):
                    n = ch.child_by_field_name('name')
                    ty = ch.child_by_field_name('type')
                    if n is not None:
                        props.append((_t(n, src), _t(ty, src).lstrip(': ') if ty is not None else '()'))
            mod.types[name] = TsType(name, rel, 'interface', props)
        elif decl.type == 'type_alias_declaration':
            name = _t(decl.child_by_field_name('name'), src)
            val = decl.child_by_field_name('value')
            text = _t(val, src) if val is not None else ''
            vals = _union_values(text)
            if vals:
                mod.types[name] = TsType(name, rel, 'union', [], vals)
            elif val is not None and val.type == 'object_type':
                props = []
                for ch in val.children:
                    if ch.type in ('property_signature', 'method_signature'):
                        n = ch.child_by_field_name('name')
                        ty = ch.child_by_field_name('type')
                        if n is not None:
                            props.append((_t(n, src), _t(ty, src).lstrip(': ') if ty is not None else '()'))
                mod.types[name] = TsType(name, rel, 'type', props)
    # useState: setter -> (variável, tipo ou literal inicial)
    s = src.decode('utf-8', 'replace')
    for m in re.finditer(r'const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState(?:<([^>]+)>)?\(\s*([^)]*)\)', s):
        mod.states[m.group(2)] = (m.group(1), (m.group(3) or '').strip(), m.group(4).strip())
    return mod


def _files():
    out = []
    for base in ('lib', 'components', 'app'):
        for p in glob.glob(os.path.join(ROOT, base, '**', '*.ts*'), recursive=True):
            rel = os.path.relpath(p, ROOT)
            if '.test.' in rel or rel.endswith('.d.ts') or '/__' in rel:
                continue
            out.append(rel)
    for extra in ('middleware.ts',):
        if os.path.isfile(os.path.join(ROOT, extra)):
            out.append(extra)
    return sorted(out)


MODULES = {}
for _rel in _files():
    try:
        MODULES[_rel] = _parse(_rel)
    except Exception as ex:  # um arquivo que não parseia não derruba o modelo
        print('aviso: não li', _rel, ex)

TYPES = {}
for _m in MODULES.values():
    for _n, _ty in _m.types.items():
        TYPES.setdefault(_n, _ty)

FUNCS = {}   # nome exportado (função, componente ou classe) -> módulo
for _m in MODULES.values():
    for _n, _f in _m.funcs.items():
        if _f.exported and '.' not in _n:
            FUNCS.setdefault(_n, _m.path)
    for _n, _ty in _m.types.items():
        if _ty.kind == 'class':
            FUNCS.setdefault(_n, _m.path)

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


if __name__ == '__main__':
    print('módulos', len(MODULES), 'funções', sum(len(m.funcs) for m in MODULES.values()),
          'tipos', len(TYPES), 'uniões', sum(1 for t in TYPES.values() if t.kind == 'union'),
          'useState', sum(len(m.states) for m in MODULES.values()))
    for tok in ('garments.ts', 'lib/card-art.ts', 'mirror/page.tsx', 'seal-wizard.tsx', 'middleware.ts'):
        r = find_module(tok)
        print(tok, '->', r, len(MODULES[r].funcs) if r else 0)
