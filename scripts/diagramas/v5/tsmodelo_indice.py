"""Índices do frontend lidos uma vez: módulos por caminho, tipos por nome e funções exportadas por nome."""
from __future__ import annotations

from tsmodelo_leitura import _files, _parse


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
