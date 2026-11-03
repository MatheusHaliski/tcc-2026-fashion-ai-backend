"""Controllers e rotas HTTP: verbo, caminho, resumo do @Operation e métodos de serviço chamados; e a rota que
casa com uma chamada do frontend."""
from __future__ import annotations

import re
from dataclasses import dataclass

from modelo_dominio import TYPES, src_of
from modelo_java import _text
from modelo_tipos import TypeInfo


MAPPINGS = {'GetMapping': 'GET', 'PostMapping': 'POST', 'PutMapping': 'PUT', 'PatchMapping': 'PATCH',
            'DeleteMapping': 'DELETE'}


# --------------------------------------------------------------------------------------------- controllers
@dataclass(eq=False)
class Endpoint:
    controller: str
    method: str
    verb: str
    path: str
    summary: str
    calls: list            # [(ServiceType, metodo)]
    line: int


def _first_string(args):
    m = re.search(r'(?:value|path)\s*=\s*\{?\s*"([^"]*)"', args or '') or re.search(r'^\(\s*\{?\s*"([^"]*)"', args or '')
    return m.group(1) if m else ''


def _summary(args):
    m = re.search(r'summary\s*=\s*"((?:[^"\\]|\\.)*)"', args or '')
    if not m:
        return ''
    return m.group(1).replace('\\"', '"')


CONTROLLERS = {n: t for n, t in TYPES.items() if 'RestController' in t.annotations or 'Controller' in t.annotations}
ENDPOINTS = []


def _field_types(t: TypeInfo):
    out = {f.name: re.sub(r'<.*', '', f.type) for f in t.fields}
    for typ, name in t.ctor:
        out.setdefault(name, re.sub(r'<.*', '', typ))
    return out


for _n, _t in CONTROLLERS.items():
    base = _first_string(_t.annotations.get('RequestMapping', ''))
    tag = _t.annotations.get('Tag', '')
    ftypes = _field_types(_t)
    src = src_of(_t)
    for m in _t.methods:
        verb = None
        for a, v in MAPPINGS.items():
            if a in m.annotations:
                verb, sub = v, _first_string(m.annotations[a])
                break
        if verb is None and 'RequestMapping' in m.annotations:
            args = m.annotations['RequestMapping']
            vm = re.search(r'RequestMethod\.(\w+)', args)
            verb, sub = (vm.group(1) if vm else 'GET'), _first_string(args)
        if verb is None:
            continue
        calls = []
        if m.node is not None:
            body = _text(m.node, src)
            for fm in re.finditer(r'\b(\w+)\.(\w+)\s*\(', body):
                obj, meth = fm.group(1), fm.group(2)
                if obj in ftypes and (ftypes[obj] in TYPES):
                    calls.append((ftypes[obj], meth))
        path = ('/' + '/'.join(x for x in (base.strip('/'), sub.strip('/')) if x)) if (base or sub) else '/'
        ENDPOINTS.append(Endpoint(_n, m.name, verb, path, _summary(m.annotations.get('Operation', '')),
                                  list(dict.fromkeys(calls)), m.line))


def endpoint_regex(path):
    return re.compile('^' + re.sub(r'\\\{[^}]+\\\}', '[^/]+', re.escape(path)) + '$')


_EP_RX = [(endpoint_regex(e.path), e) for e in ENDPOINTS]


def _strip_templates(path):
    """Troca ${...} (com chaves aninhadas) por X quando é um segmento e remove quando é um sufixo de query."""
    out, i = [], 0
    while i < len(path):
        if path.startswith('${', i):
            depth, j = 0, i + 1
            while j < len(path):
                if path[j] == '{':
                    depth += 1
                elif path[j] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            if out and out[-1] == '/':
                out.append('X')
            i = j + 1
            continue
        out.append(path[i])
        i += 1
    return ''.join(out)


def match_endpoint(verb, path):
    path = _strip_templates(path)
    path = re.sub(r'\?.*', '', path).rstrip('/') or '/'
    verbs = ('POST', 'PUT') if verb == 'UPLOAD' else (verb,)
    for v in verbs:
        for rx, e in _EP_RX:
            if e.verb == v and rx.match(path):
                return e
    return None
