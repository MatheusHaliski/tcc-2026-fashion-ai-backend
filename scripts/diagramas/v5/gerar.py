"""Gera os diagramas PlantUML (atividades, sequência, componentes, classes e máquina de estados) a partir do código.

Uso:  python3 scripts/diagramas/v5/gerar.py [--so RF27,RF28] [--data 2026-10-05]

Cada arquivo .puml que já existia em docs/diagramas é reescrito no mesmo caminho (os links continuam valendo), com o
conteúdo tirado do código atual pelo modelo (modelo.py) e o escopo do RF (escopo.py).

Este arquivo é a linha de comando; o código fica nos módulos gerar_* (estilo, consultas ao modelo, ranking das rotas,
um módulo por tipo de diagrama, estados derivados, orquestração e extras), reexportados aqui para quem importa gerar.
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modelo as M  # noqa: E402
import escopo as E  # noqa: E402,F401
import gerar_estilo  # noqa: E402
from gerar_estilo import (  # noqa: E402,F401
    ACCENTS,
    STYLE,
    STYLE_COMMON,
    TODAY,
    alias,
    esc,
    header,
    human_code,
    kind_of_label,
    wrap,
)
from gerar_consultas import (  # noqa: E402,F401
    NOT_COMPONENTS,
    callers_of,
    kind_of_dep,
    page_of_endpoint,
    repo_op,
    sql_of,
    steps_for,
    summary_label,
    table_of_repo,
)
from gerar_ranking import (  # noqa: E402,F401
    PRINCIPAL,
    STOP,
    UNIT_PREFERRED,
    _ca_of,
    _is_principal,
    _norm,
    choose_unit,
    ranked_endpoints,
)
from gerar_atividades import _effects, _guard_label, activity  # noqa: E402,F401
from gerar_sequencia import Seq, sequence  # noqa: E402,F401
from gerar_componentes import components  # noqa: E402,F401
from gerar_classes import HIDDEN_FIELDS, classes, relations  # noqa: E402,F401
from gerar_estados import (  # noqa: E402,F401
    _enum_region,
    _initial_from_creation,
    enum_states,
    label_of,
    pick_state_targets,
    state_machine,
)
from gerar_citacao import _cited, _rf_prefix, _snake, _up  # noqa: E402,F401
from gerar_flags import _flag_region, _flag_targets, flag_states  # noqa: E402,F401
from gerar_derivados import (  # noqa: E402,F401
    DERIVED_STATES,
    _callers_deep,
    bands_states,
    classifier_states,
    threshold_flag_states,
    threshold_states,
)
from gerar_execucao import (  # noqa: E402,F401
    GEN,
    KEPT_MARK,
    MANUAL_MARK,
    diagram_name,
    keep_team_diagram,
    kind_of_file,
    run,
)
from gerar_extras import EXTRAS, render, run_extras  # noqa: E402,F401


if __name__ == '__main__':
    # a ordem de iteração de conjuntos de texto muda a cada execução; com a semente fixa a saída é sempre a mesma
    if os.environ.get('PYTHONHASHSEED') != '0':
        os.environ['PYTHONHASHSEED'] = '0'
        os.execv(sys.executable, [sys.executable] + sys.argv)
    import glob
    ap = argparse.ArgumentParser()
    ap.add_argument('--so', default='')
    ap.add_argument('--data', default='')
    ap.add_argument('--seco', action='store_true')
    ap.add_argument('--saida', default='')
    ap.add_argument('--render', action='store_true')
    a = ap.parse_args()
    if a.data:
        gerar_estilo.TODAY = a.data
    only = set(x for x in a.so.split(',') if x) or None
    rep = run(only, a.seco, a.saida or None)
    if not only:
        rep += run_extras(a.seco, a.saida or None)
    for f, st in rep:
        if st != 'ok':
            print(st, '—', f.replace(M.ROOT + '/', ''))
    print('arquivos', len(rep), 'reescritos', sum(1 for _, s in rep if s == 'ok'))
    if a.render and not a.seco:
        base = a.saida or M.ROOT
        render([os.path.join(base, os.path.relpath(f, M.ROOT)) for f, st in rep if st == 'ok' or st.startswith('mantido')])
