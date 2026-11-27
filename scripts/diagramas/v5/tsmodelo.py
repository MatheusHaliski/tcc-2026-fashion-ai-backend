"""Modelo do frontend (TypeScript/TSX) para os diagramas v5.

Por módulo (arquivo em lib/, components/ e app/): importações, declarações (funções, componentes React, classes,
interfaces, tipos e uniões de literais), e por função os passos em ordem — chamadas a funções importadas ou locais,
chamadas à API (api.get/post/...), condições que encerram cedo (if … return/throw) e mudanças de estado de tela
(setX("valor") de useState).

O código fica nos módulos tsmodelo_* (registros, leitura, índices e consultas), reexportados aqui.
"""
from __future__ import annotations

from tsmodelo_tipos import TsFunc, TsModule, TsStep, TsType  # noqa: F401
from tsmodelo_leitura import ROOT, TS, TSX, _files, _parse, _resolve, _t, _union_values  # noqa: F401
from tsmodelo_indice import FUNCS, MODULES, TYPES  # noqa: F401
from tsmodelo_passos import API_RX, find_module, importers_of, imports_of, steps  # noqa: F401


if __name__ == '__main__':
    print('módulos', len(MODULES), 'funções', sum(len(m.funcs) for m in MODULES.values()),
          'tipos', len(TYPES), 'uniões', sum(1 for t in TYPES.values() if t.kind == 'union'),
          'useState', sum(len(m.states) for m in MODULES.values()))
    for tok in ('garments.ts', 'lib/card-art.ts', 'mirror/page.tsx', 'seal-wizard.tsx', 'middleware.ts'):
        r = find_module(tok)
        print(tok, '->', r, len(MODULES[r].funcs) if r else 0)
