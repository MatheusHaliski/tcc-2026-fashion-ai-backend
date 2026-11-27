"""Leitura de um arquivo TS/TSX com tree-sitter-typescript: importações, funções, componentes, classes,
interfaces, tipos e uniões de literais, e os useState; e a lista de arquivos lidos."""
from __future__ import annotations

import glob
import os
import re

import tree_sitter_typescript as tst
from tree_sitter import Language, Parser

import modelo as M
from tsmodelo_tipos import TsFunc, TsModule, TsType


ROOT = M.ROOT
TSX = Parser(Language(tst.language_tsx()))
TS = Parser(Language(tst.language_typescript()))


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
