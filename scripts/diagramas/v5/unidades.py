"""Diagramas "por unidades de código": para o que não é rota → serviço → repositório.

Uma unidade é um módulo TypeScript (lib/, components/, app/) ou uma classe Java citada pelo diagrama (pipelines de
imagem, filtros de segurança, serviços de demonstração). Os cinco tipos de diagrama saem das próprias unidades:
passos das funções (atividades e sequência), tipos e campos (classes), importações e pacotes (componentes) e mudanças de
estado de tela ou de enum (máquina de estados).

O código fica nos módulos unidades_* (unidades citadas, fluxos, estrutura e estados), reexportados aqui.
"""
from __future__ import annotations

from unidades_citadas import (  # noqa: F401
    JAVA_SKIP,
    NOISE,
    _ident_tokens,
    _java_main,
    _lane_of,
    _main_func,
    _short,
    cited_funcs,
    cited_units,
    is_unit_mode,
)
from unidades_fluxo import activity, sequence  # noqa: F401
from unidades_estrutura import aggregate_edges, classes, components  # noqa: F401
from unidades_estados import state_machine, union_states  # noqa: F401


GEN = {'atividades': activity, 'sequencia': sequence, 'componentes': components, 'classes': classes,
       'estados': state_machine}
