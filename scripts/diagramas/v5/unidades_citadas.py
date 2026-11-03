"""Unidades de código que o diagrama do time cita (módulos TS e classes Java), se o diagrama está no modo por
unidades e a função principal de cada unidade."""
from __future__ import annotations

import os
import re

import modelo as M
import tsmodelo as T


JAVA_SKIP = {'Override', 'String', 'List', 'Map', 'Set', 'UUID', 'Instant', 'Optional'}


# --------------------------------------------------------------------------------------------- unidades citadas
NOISE = ('i18n.tsx', 'i18n.ts', 'ui.tsx', 'utils.ts', 'fai-icon.tsx', 'client.ts', 'cn.ts', 'types.ts', 'labels-pt.ts',
         'labels-en.ts', 'labels-es.ts')


def _ident_tokens(text):
    return [t for t in re.findall(r'\b[A-Z][A-Za-z0-9]{4,}\b', text)]


def cited_units(text, limit=6):
    """(módulos TS, classes Java) citados no texto do diagrama do time.

    Módulos entram por nome de arquivo ('garments.ts', 'mirror/page.tsx') e também por identificador exportado
    ('ArtVideo', 'HumanOutfit', 'CardArtLayer'), na ordem em que aparecem."""
    mods = []
    for tok in re.findall(r'[A-Za-z0-9_\-\[\]()/.]+\.tsx?\b', text):
        r = T.find_module(tok)
        if r and r not in mods:
            mods.append(r)
    for ident in _ident_tokens(text):
        r = T.FUNCS.get(ident) or (T.TYPES[ident].module if ident in T.TYPES and T.TYPES[ident].kind != 'union' else None)
        if r and r not in mods and os.path.basename(r) not in NOISE and len(mods) < limit:
            mods.append(r)
    java = []
    for name, t in M.TYPES.items():
        if name in JAVA_SKIP or t.kind not in ('class', 'record', 'interface') or t.outer:
            continue
        if t.module in ('domain',) and name in M.ENTITIES:
            continue
        if re.search(r'\b' + re.escape(name) + r'\b', text):
            java.append(name)
    return mods, java


def cited_funcs(text, rel):
    """Funções do módulo citadas pelo nome no texto, na ordem."""
    mod = T.MODULES[rel]
    out = []
    for ident in re.findall(r'\b[A-Za-z_$][\w$]{3,}\b', text):
        if ident in mod.funcs and ident not in out:
            out.append(ident)
    return out


def is_unit_mode(text, kind=None):
    """Modo por unidades quando o diagrama do time fala sobretudo de módulos do frontend (fora das páginas) ou de
    classes Java que não são controllers nem serviços (pipelines, filtros, adaptadores). Diagramas de componentes ficam
    no modo RF sempre que citam algum controller ou serviço."""
    mods, java = cited_units(text)
    lib_mods = [m for m in mods if not m.startswith('app/')]
    std = [j for j in java if j in M.CONTROLLERS or j in M.SERVICES]
    other = [j for j in java if j not in std and j not in M.REPOS and M.TYPES[j].module != 'domain'
             and len(j) >= 6 and not j.endswith(('Request', 'Response', 'View', 'Dto', 'Exception'))]
    units = len(lib_mods) + len(other)
    if units == 0:
        return False
    if not std:
        return True
    if kind == 'componentes':
        return False
    return (len(lib_mods) >= 2 and len(lib_mods) >= len(std)) or (len(other) >= 3 and len(std) <= 2)


def _main_func(rel, prefer=()):
    mod = T.MODULES[rel]
    if not mod.funcs:
        return None
    for name in prefer:
        if name in mod.funcs and T.steps(rel, name):
            return name
    exported = [f for f in mod.funcs.values() if f.exported]
    pool = exported or list(mod.funcs.values())
    default = [f for f in pool if f.kind == 'component']
    pool = default or pool
    return max(pool, key=lambda f: len(T.steps(rel, f.name))).name


def _java_main(name):
    t = M.TYPES[name]
    best, n = None, -1
    an = M.analyzer(name) if t.kind == 'class' else None
    for m in t.methods:
        if m.node is None or 'private' in (M._text(m.node.parent, M.src_of(t))[:40] if m.node.parent else ''):
            continue
        k = len(an.steps(m.name)) if an else 0
        if k > n:
            best, n = m.name, k
    return best


def _short(rel):
    return rel.replace('app/(site)/(app)/', 'app/').replace('components/', 'c/').replace('lib/', 'lib/')


def _lane_of(rel):
    if rel.startswith('app/') or rel.startswith('components/'):
        return 'Tela (React)'
    if rel == 'middleware.ts':
        return 'Borda (middleware Next.js)'
    return 'Lógica no navegador (lib)'
