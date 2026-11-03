"""Frontend no modelo Java: páginas do Next, os arquivos que cada uma importa e as rotas da API que chamam."""
from __future__ import annotations

import glob
import os
import re

from modelo_java import ROOT
from modelo_rotas import match_endpoint


# --------------------------------------------------------------------------------------------- frontend
FRONT_API = re.compile(r'\bapi\.(get|post|put|patch|delete|upload|blobUrl)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*([`"\'])(/[^`"\']*)\2')


def route_of(page_path):
    rel = page_path.replace(ROOT + '/app', '')
    parts = [p for p in rel.split('/')[:-1] if p and not (p.startswith('(') and p.endswith(')'))]
    return '/' + '/'.join(parts)


def _resolve_import(spec, from_file):
    if spec.startswith('@/'):
        base = ROOT + '/' + spec[2:]
    elif spec.startswith('.'):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    else:
        return None
    for ext in ('.tsx', '.ts', '/index.tsx', '/index.ts'):
        if os.path.exists(base + ext):
            return base + ext
    return None


def _imports(path):
    src = open(path, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'from\s+["\']([^"\']+)["\']', src):
        r = _resolve_import(m.group(1), path)
        if r and ('/components/' in r or '/app/' in r):
            out.append(r)
    return out


def api_calls_of(path):
    src = open(path, encoding='utf-8').read()
    out = []
    for m in FRONT_API.finditer(src):
        verb = {'get': 'GET', 'post': 'POST', 'put': 'PUT', 'patch': 'PATCH', 'delete': 'DELETE', 'upload': 'UPLOAD',
                'blobUrl': 'GET'}[m.group(1)]
        out.append((verb, m.group(3)))
    return out


PAGES = {}
for _p in sorted(glob.glob(ROOT + '/app/**/page.tsx', recursive=True)):
    files, frontier = [_p], [_p]
    for _ in range(2):
        nxt = []
        for f in frontier:
            for imp in _imports(f):
                if imp not in files:
                    files.append(imp)
                    nxt.append(imp)
        frontier = nxt
    calls = []
    for f in files:
        for verb, path in api_calls_of(f):
            e = match_endpoint(verb, path)
            calls.append((verb, path, e, f.replace(ROOT + '/', '')))
    PAGES[route_of(_p)] = dict(file=_p.replace(ROOT + '/', ''), files=[f.replace(ROOT + '/', '') for f in files],
                               calls=calls)

BFF_ROUTES = sorted(route_of(p).replace('/route', '') for p in glob.glob(ROOT + '/app/**/route.ts', recursive=True))
