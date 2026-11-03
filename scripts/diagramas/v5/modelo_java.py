"""Leitura do Java com tree-sitter-java: anotações, tipos (inclusive aninhados), campos, construtores, métodos e
constantes de enum de todos os módulos fai-*."""
from __future__ import annotations

import glob
import os
import re

import tree_sitter_java as tsj
from tree_sitter import Language, Parser

from modelo_tipos import Field, Method, TypeInfo


ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
JAVA = Language(tsj.language())
_parser = Parser(JAVA)


# --------------------------------------------------------------------------------------------- leitura do Java
def _text(node, src):
    return src[node.start_byte:node.end_byte].decode('utf-8')


def _annotations(mods, src):
    out = {}
    if mods is None:
        return out
    for ch in mods.children:
        if ch.type in ('annotation', 'marker_annotation'):
            name_node = ch.child_by_field_name('name')
            name = _text(name_node, src).split('.')[-1]
            args = ch.child_by_field_name('arguments')
            out[name] = _text(args, src) if args is not None else ''
    return out


def _modifiers(node):
    for ch in node.children:
        if ch.type == 'modifiers':
            return ch
    return None


def _module_of(path):
    p = path.replace(ROOT + '/', '')
    if p.startswith('fai-domain'):
        return 'domain'
    if p.startswith('fai-application'):
        return 'application'
    if p.startswith('fai-web'):
        return 'web'
    if 'persistence-cassandra' in p:
        return 'infra-cassandra'
    if p.startswith('fai-infrastructure'):
        return 'infra-mysql'
    if p.startswith('fai-bootstrap'):
        return 'bootstrap'
    return 'other'


def _type_text(node, src):
    return re.sub(r'\s+', '', _text(node, src)) if node is not None else ''


def _collect_types(node, src, path, package, outer, acc):
    for ch in node.children:
        if ch.type in ('class_declaration', 'interface_declaration', 'record_declaration', 'enum_declaration'):
            acc.append(_read_type(ch, src, path, package, outer))
            body = ch.child_by_field_name('body')
            if body is not None:
                _collect_types(body, src, path, package, _text(ch.child_by_field_name('name'), src), acc)


def _read_type(node, src, path, package, outer):
    kind = node.type.replace('_declaration', '')
    name = _text(node.child_by_field_name('name'), src)
    mods = _modifiers(node)
    ann = _annotations(mods, src)
    sup = node.child_by_field_name('superclass')
    superclass = _type_text(sup, src).replace('extends', '') if sup is not None else None
    interfaces = []
    for ch in node.children:
        if ch.type in ('super_interfaces', 'extends_interfaces'):
            for t in ch.children:
                if t.type == 'type_list':
                    interfaces += [_type_text(x, src) for x in t.children if x.type != ',']
    fields, methods, ctor, consts, statics, cargs, sints = [], [], [], [], {}, {}, {}
    body = node.child_by_field_name('body')
    if kind == 'record':
        params = node.child_by_field_name('parameters')
        if params is not None:
            for p in params.children:
                if p.type == 'formal_parameter':
                    fields.append(Field(_text(p.child_by_field_name('name'), src),
                                        _type_text(p.child_by_field_name('type'), src), {}))
    if body is not None:
        for ch in body.children:
            if ch.type == 'enum_body_declarations':
                inner = ch.children
            else:
                inner = [ch]
            for m in inner:
                if m.type == 'enum_constant':
                    cname = _text(m.child_by_field_name('name'), src)
                    consts.append(cname)
                    a = m.child_by_field_name('arguments')
                    if a is not None:
                        cargs[cname] = _text(a, src)[1:-1]   # separado depois por enum_args()
                elif m.type == 'field_declaration':
                    fmods = _modifiers(m)
                    fann = _annotations(fmods, src)
                    ftype = _type_text(m.child_by_field_name('type'), src)
                    is_static = fmods is not None and 'static' in _text(fmods, src)
                    for d in m.children:
                        if d.type == 'variable_declarator':
                            fname = _text(d.child_by_field_name('name'), src)
                            v = d.child_by_field_name('value')
                            init = _text(v, src) if v is not None else None
                            if is_static:
                                if ftype == 'String' and init and init.startswith('"'):
                                    statics[fname] = init.strip('"')
                                elif ftype in ('int', 'long') and init and re.fullmatch(r'-?\d+', init.replace('_', '')):
                                    sints[fname] = int(init.replace('_', ''))
                                continue
                            fields.append(Field(fname, ftype, fann, init))
                elif m.type == 'constructor_declaration':
                    params = m.child_by_field_name('parameters')
                    ps = []
                    for p in params.children:
                        if p.type == 'formal_parameter':
                            ps.append((_type_text(p.child_by_field_name('type'), src),
                                       _text(p.child_by_field_name('name'), src)))
                    if len(ps) >= len(ctor):
                        ctor = ps
                elif m.type == 'method_declaration':
                    mmods = _modifiers(m)
                    params = m.child_by_field_name('parameters')
                    ps = []
                    for p in params.children:
                        if p.type in ('formal_parameter', 'spread_parameter'):
                            pn = p.child_by_field_name('name')
                            ps.append((_type_text(p.child_by_field_name('type'), src),
                                       _text(pn, src) if pn is not None else '',
                                       _annotations(_modifiers(p), src)))
                    methods.append(Method(_text(m.child_by_field_name('name'), src), _annotations(mmods, src), ps,
                                          _type_text(m.child_by_field_name('type'), src), m.child_by_field_name('body'),
                                          m.start_point[0] + 1))
    return TypeInfo(name, kind, package, path, _module_of(path), ann, superclass, interfaces, fields, ctor, methods,
                    consts, statics, outer, cargs, sints)


SOURCES = {}
ALL_TYPES = []   # inclui tipos aninhados de mesmo nome em arquivos diferentes (ex.: dois records Band)


def parse_java():
    types = {}
    for path in sorted(glob.glob(ROOT + '/fai-*/**/src/main/java/**/*.java', recursive=True)):
        src = open(path, 'rb').read()
        tree = _parser.parse(src)
        pkg = re.search(rb'^package\s+([\w.]+);', src, re.M)
        package = pkg.group(1).decode() if pkg else ''
        acc = []
        _collect_types(tree.root_node, src, path, package, None, acc)
        for t in acc:
            SOURCES[(t.name, t.file)] = src
            ALL_TYPES.append(t)
            # tipos aninhados com o mesmo nome em arquivos diferentes: o de nível superior vence
            if t.name in types and t.outer is not None:
                continue
            types[t.name] = t
    return types
