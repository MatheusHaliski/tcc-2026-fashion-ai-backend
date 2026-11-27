"""Análise de métodos dos serviços: os passos em ordem (guardas, chamadas, IA, eventos, criações e mudanças de
estado) e as dependências injetadas."""
from __future__ import annotations

import re

from modelo_dominio import ENTITIES, ENUMS, REPOS, TYPES, bool_fields, entity_fields, src_of
from modelo_java import _text, _type_text
from modelo_passos import Step, _error_of, _is_throw_branch, _status_of_cond
from modelo_rotas import _field_types
from modelo_tipos import TypeInfo


class MethodAnalyzer:
    def __init__(self, t: TypeInfo):
        self.t = t
        self.src = src_of(t)
        self.ftypes = _field_types(t)
        self.local_methods = {}
        for m in t.methods:
            self.local_methods.setdefault(m.name, m)

    def steps(self, method_name, depth=0, seen=None):
        m = self.local_methods.get(method_name)
        if m is None or m.node is None:
            return []
        seen = set() if seen is None else seen
        if method_name in seen:
            return []
        seen = seen | {method_name}
        out = []
        self._walk(m.node, out, depth, seen, [])
        return out

    def _walk(self, node, out, depth, seen, guards):
        src = self.src
        t = node.type
        if t == 'if_statement':
            cond = _text(node.child_by_field_name('condition'), src)
            cons = node.child_by_field_name('consequence')
            alt = node.child_by_field_name('alternative')
            if _is_throw_branch(cons):
                err = _error_of(_text(cons, src)) or ('ERRO', 500, '')
                req, exc = _status_of_cond(cond, ENUMS)
                out.append(Step('guard', cond=cond.strip('() '), code=err[0], status=err[1], text=err[2],
                                sources=tuple(sorted(req)), value=';'.join(f'{a}.{b}' for a, b in sorted(exc))))
                guards.append((req, exc))
                if alt is not None:
                    self._walk(alt, out, depth, seen, guards)
                return
            self._walk(node.child_by_field_name('condition'), out, depth, seen, guards)
            inner = []
            self._walk(cons, inner, depth, seen, list(guards))
            if alt is not None:
                self._walk(alt, inner, depth, seen, list(guards))
            if inner:
                out.append(Step('branch', cond=cond.strip('() ')))
                out.extend(inner)
            return
        if t == 'throw_statement':
            err = _error_of(_text(node, src))
            if err:
                out.append(Step('throw', code=err[0], status=err[1], text=err[2]))
            return
        if t == 'method_invocation':
            obj = node.child_by_field_name('object')
            name = _text(node.child_by_field_name('name'), src)
            args_node = node.child_by_field_name('arguments')
            args = _text(args_node, src) if args_node is not None else ''
            # primeiro os argumentos (são avaliados antes da chamada)
            if obj is not None:
                self._walk(obj, out, depth, seen, guards)
            if args_node is not None:
                self._walk(args_node, out, depth, seen, guards)
            objtxt = _text(obj, src) if obj is not None else ''
            if name == 'publishEvent':
                ev = re.search(r'new\s+(?:\w+\.)*(\w+)\s*[(<]', args)
                out.append(Step('event', target=ev.group(1) if ev else 'evento'))
                return
            if re.match(r'set\w*(Status|State|Stage|Phase)$', name) or name in ('setStatus', 'setState'):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                em = re.match(r'(\w+)\.([A-Z][A-Z0-9_]*)$', val)
                if em and em.group(1) in ENUMS:
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=em.group(2),
                                    enum=em.group(1), sources=self._sources(guards, em.group(1))))
                elif re.match(r'^"[A-Z][A-Z0-9_]*"$', val):
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=val.strip('"'),
                                    enum='String', sources=self._sources(guards, 'String')))
                elif val in self.t.static_strings:
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value=self.t.static_strings[val], enum='String', sources=self._sources(guards, 'String')))
                return
            if re.match(r'set[A-Z]\w*$', name):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                em = re.match(r'(\w+)\.([A-Z][A-Z0-9_]*)$', val)
                if em and em.group(1) in ENUMS and fld in ENUM_FIELD_NAMES:
                    # qualquer campo enum (ex.: DailyLook.feedback = DailyLookFeedback.ADOREI)
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=em.group(2),
                                    enum=em.group(1), sources=self._sources(guards, em.group(1))))
                    return
                if fld in ENUM_FIELD_NAMES and re.fullmatch(r'[a-z]\w*', val) and val not in ('null', 'true', 'false'):
                    # valor vindo de variável (ex.: dl.setFeedback(feedback)): qualquer valor do enum
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value='?' + val,
                                    enum='?enum'))
                    return
                if fld in PRESENCE_FIELD_NAMES and val:
                    # campo de artefato (URL, chave, data): vazio (null) ou preenchido
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value='null' if val == 'null' else 'set', enum='presence'))
                    return
            if re.match(r'set[A-Z]\w*$', name) and re.fullmatch(r'true|false|[a-z]\w*', args.strip('() ')):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                if fld in BOOL_FIELD_NAMES:
                    # literal: o novo valor; variável (ex.: setOptedIn(optedIn)): vale para os dois sentidos
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value=val if val in ('true', 'false') else '?' + val, enum='boolean'))
                    return
            if objtxt in self.ftypes:
                dep = self.ftypes[objtxt]
                if dep == 'AiEngine' or dep.endswith('AiEngine'):
                    cap = re.search(r'AiCapability\.([A-Z_]+)', args)
                    out.append(Step('ai', target=cap.group(1) if cap else 'IA', method=name))
                    return
                if dep in TYPES or dep in REPOS:
                    out.append(Step('call', target=dep, method=name, text=args[:80]))
                return
            if (obj is None or objtxt == 'this') and name in self.local_methods and depth < 3:
                out.extend(self.steps(name, depth + 1, seen))
            return
        if t == 'object_creation_expression':
            typ = _type_text(node.child_by_field_name('type'), src)
            base = re.sub(r'<.*', '', typ).split('.')[-1]
            args_node = node.child_by_field_name('arguments')
            if args_node is not None:
                self._walk(args_node, out, depth, seen, guards)
            if base in ENTITIES:
                out.append(Step('create', target=base))
            return
        for ch in node.children:
            self._walk(ch, out, depth, seen, guards)

    def _owner_type(self, objtxt):
        return objtxt

    @staticmethod
    def _sources(guards, enum):
        req, exc = set(), set()
        for r, e in guards:
            req |= {v for (en, v) in r if en == enum}
            exc |= {v for (en, v) in e if en == enum}
        if req:
            return tuple(sorted(req))
        if exc:
            return tuple('!' + v for v in sorted(exc))
        return ()


BOOL_FIELD_NAMES = {f for e in ENTITIES for f, _ in bool_fields(e)}
ENUM_FIELD_NAMES = {f for e in ENTITIES for f, t, r, _ in entity_fields(e) if r is None and t in ENUMS}
PRESENCE_FIELD = re.compile(r'^\w+(Url|Key|Path|Uri|At)$')
PRESENCE_FIELD_NAMES = {f for e in ENTITIES for f, t, r, _ in entity_fields(e)
                        if r is None and PRESENCE_FIELD.match(f) and f not in ('createdAt', 'updatedAt')}
SERVICES = {n: t for n, t in TYPES.items() if t.module == 'application' and t.kind == 'class'
            and ('Service' in t.annotations or 'Component' in t.annotations)}
_ANALYZERS = {}


def analyzer(type_name):
    if type_name not in _ANALYZERS:
        _ANALYZERS[type_name] = MethodAnalyzer(TYPES[type_name])
    return _ANALYZERS[type_name]


def deps_of(type_name):
    t = TYPES.get(type_name)
    if t is None:
        return []
    return [re.sub(r'<.*', '', typ) for typ, _ in t.ctor]
