"""Orquestração da reescrita de docs/diagramas: tipo de cada arquivo, escolha do gerador (por RF, por unidades,
estados derivados) e escrita do resultado ou do diagrama do time mantido com legenda."""
from __future__ import annotations

import os
import re

import escopo as E
import gerar_estilo as estilo
import modelo as M
from gerar_atividades import activity
from gerar_citacao import _cited, _snake
from gerar_classes import classes
from gerar_componentes import components
from gerar_derivados import DERIVED_STATES, threshold_flag_states
from gerar_estados import enum_states, pick_state_targets, state_machine
from gerar_flags import _flag_targets, flag_states
from gerar_ranking import choose_unit
from gerar_sequencia import sequence


# --------------------------------------------------------------------------------------------- orquestração
def kind_of_file(path):
    b = os.path.basename(path).lower()
    if 'maquinadeestados' in b or 'estados' in b:
        return 'estados'
    if 'sequencia' in b:
        return 'sequencia'
    if 'componentes' in b:
        return 'componentes'
    if 'classes' in b:
        return 'classes'
    if 'atividades' in b or 'pipeline' in b:
        return 'atividades'
    return None


GEN = {'atividades': activity, 'sequencia': sequence, 'componentes': components, 'classes': classes,
       'estados': state_machine}


def diagram_name(path):
    src = open(path, encoding='utf-8').read()
    m = re.search(r'^@startuml\s+(\S+)', src, re.M)
    return m.group(1) if m else os.path.splitext(os.path.basename(path))[0]


KEPT_MARK = "' v5: diagrama do time mantido (sem alvo no código)"


def keep_team_diagram(src, dest):
    """O código não tem um estado/fluxo equivalente que o gerador leia: o diagrama do time fica, com uma legenda
    dizendo que não foi gerado nem verificado contra o código."""
    text = open(src, encoding='utf-8').read()
    if KEPT_MARK not in text:
        legend = (f'{KEPT_MARK}\nlegend bottom right\n  <b>Diagrama escrito pelo time e mantido como está.</b>\n'
                  f'  O código atual não tem um campo, enum ou método de estado equivalente\n'
                  f'  que scripts/diagramas/v5 consiga ler — não foi gerado nem verificado\n'
                  f'  contra o código em {estilo.TODAY}.\nendlegend\n')
        text = re.sub(r'(?m)^@enduml\s*$', legend + '@enduml', text, count=1)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(text)


# Diagramas escritos à mão sobre código que o gerador não lê (o worker e a GPU em Python de services/): ficam como estão.
MANUAL_MARK = "' v5: escrito à mão"


def run(only=None, dry=False, saida=None):
    report = []
    for sc in E.all_scopes():
        if only and sc.key.split('/')[0] not in only and sc.key not in only:
            continue
        for f in sc.old_files:
            if MANUAL_MARK in open(f, encoding='utf-8').read():
                if not dry and saida:
                    dest = os.path.join(saida, os.path.relpath(f, M.ROOT))
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    open(dest, 'w', encoding='utf-8').write(open(f, encoding='utf-8').read())
                report.append((f, 'mantido (escrito à mão)'))
                continue
            kind = kind_of_file(f)
            if kind is None:
                report.append((f, 'tipo desconhecido'))
                continue
            cited = E.source_text(f)
            fsc = E.build(sc.key, [f], sc.rf)
            # o escopo do arquivo herda o da pasta quando o arquivo cita pouco
            for attr in ('endpoints', 'services', 'entities', 'pages', 'ports', 'enums'):
                cur = getattr(fsc, attr)
                if len(cur) < 2:
                    setattr(fsc, attr, list(dict.fromkeys(cur + getattr(sc, attr))))
            own = E.citacoes().get(os.path.relpath(f, M.ROOT), {}).get('title', '')
            own = own.split('\\n')[0].strip() if own else ''
            fsc.title = own or sc.title
            import unidades as U
            unit = choose_unit(sc.key, kind, cited, fsc)
            text = None
            if kind == 'estados':
                # estados que o código deriva (faixas, limiares, booleanos) só quando o diagrama do time os cita
                text = next((x for x in (g(fsc, diagram_name(f), cited) for g in DERIVED_STATES) if x), None)
                if text is None:
                    import estados_ts as ETS
                    text = next((x for x in (g(fsc.title, diagram_name(f), cited) for g in ETS.TS_DERIVED) if x), None)
                picks = pick_state_targets(fsc, cited)
                # campo de artefato/booleano nomeado no título vence um enum que o título não nomeia (RF36)
                title_flag = any(_cited(x[2], fsc.title) or _cited(_snake(x[2]), fsc.title)
                                 for x in _flag_targets(cited, title=fsc.title))
                if text is None and (not picks or (title_flag and not picks[0][6])):
                    text = flag_states(fsc, diagram_name(f), cited) or threshold_flag_states(fsc, diagram_name(f), cited)
            if text is None and kind == 'estados' and unit:
                picks = pick_state_targets(fsc, cited)
                if picks and picks[0][6]:   # o título nomeia a entidade/enum: a máquina da entidade vem antes da tela
                    text = GEN['estados'](fsc, diagram_name(f), cited)
            if text is None:
                text = U.GEN[kind](fsc.title, diagram_name(f), cited) if unit else GEN[kind](fsc, diagram_name(f), cited)
            if text is None and kind == 'estados':
                # reservas: unidades do próprio arquivo, depois o texto da pasta inteira, depois um enum citado
                # só alvos que o próprio diagrama cita; sem nenhum, o arquivo do time fica, marcado como não gerado
                text = (U.state_machine(fsc.title, diagram_name(f), cited)
                        or (GEN['estados'](fsc, diagram_name(f), cited) if unit else None)
                        or enum_states(fsc, diagram_name(f), cited)
                        or U.union_states(fsc.title, diagram_name(f), cited))
            if text is None:
                if not dry:
                    keep_team_diagram(f, f if not saida else os.path.join(saida, os.path.relpath(f, M.ROOT)))
                report.append((f, 'mantido (sem alvo no código)'))
                continue
            if not dry:
                dest = f if not saida else os.path.join(saida, os.path.relpath(f, M.ROOT))
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                open(dest, 'w', encoding='utf-8').write(text + '\n')
            report.append((f, 'ok'))
    return report
