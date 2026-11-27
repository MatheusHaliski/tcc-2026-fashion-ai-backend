"""Diagramas fora de docs/diagramas (anatomia, guarda-roupa, avatar 3D, visões globais) e a renderização em PNG."""
from __future__ import annotations

import glob
import os

import escopo as E
import modelo as M
from gerar_estados import enum_states
from gerar_execucao import GEN, diagram_name
from gerar_ranking import choose_unit


# --------------------------------------------------------------------------------------------- fora de docs/diagramas
EXTRAS = [
    # (arquivo, chave do escopo, RF, tipo, gerador especial)
    ('docs/anatomia/anatomia-de-esquemas-classes.puml', 'RF5', 5, 'classes', None),
    ('docs/anatomia/anatomia-de-esquemas-estados.puml', 'RF5', 5, 'estados', None),
    ('docs/meu_guarda_roupa/RF33_Vista-me_Atividades.puml', 'RF28', 28, 'atividades', None),
    ('markdowns/RF33_Vista-me_Atividades.puml', 'RF28', 28, 'atividades', None),
    ('docs/novos-rf/RF25_Selos_Promocoes_Cupons_Atividades.puml', 'RF38', 38, 'atividades', None),
    ('docs/avatar3d/auditoria-roupas-3d/pipeline-atual.puml', 'RF40-roupa-no-avatar', 40, 'atividades', None),
    ('docs/entidades/taxonomia-contextos.puml', None, None, 'classes', 'contextos'),
    ('docs/diagramas/fashionai-classes-v5.puml', None, None, 'classes', 'classes-globais'),
    ('docs/diagramas/fashionai-componentes-v5.puml', None, None, 'componentes', 'componentes-globais'),
]


def run_extras(dry=False, saida=None):
    import unidades as U
    import globais as G
    report = []
    for relpath, key, rf, kind, special in EXTRAS:
        f = os.path.join(M.ROOT, relpath)
        if special == 'contextos':
            text = G.classes_by_area('Taxonomia_Contextos', 'FashionAI — entidades-chave por contexto delimitado (áreas da taxonomia)', compact=True)
        elif special == 'classes-globais':
            text = G.classes_by_area('FashionAI_Classes_v5', 'Fashion AI — Diagrama de Classes v5: todas as entidades JPA por área')
        elif special == 'componentes-globais':
            text = G.components_global('FashionAI_Componentes_v5', 'Fashion AI — Diagrama de Componentes v5: da tela aos bancos')
        else:
            cited = E.source_text(f) if os.path.exists(f) else ''
            folder = sorted(glob.glob(os.path.join(E.DIAG, key, '*.puml')))
            sc = E.build(key, folder + ([f] if os.path.exists(f) else []), rf)
            fsc = E.build(key, [f], rf) if os.path.exists(f) else sc
            for attr in ('endpoints', 'services', 'entities', 'pages', 'ports', 'enums'):
                if len(getattr(fsc, attr)) < 2:
                    setattr(fsc, attr, list(dict.fromkeys(getattr(fsc, attr) + getattr(sc, attr))))
            own = E.citacoes().get(relpath, {}).get('title', '')
            fsc.title = (own.split('\\n')[0].strip() if own else '') or sc.title
            name = diagram_name(f) if os.path.exists(f) else os.path.splitext(os.path.basename(f))[0]
            unit = choose_unit(key, kind, cited, fsc)
            text = U.GEN[kind](fsc.title, name, cited) if unit else GEN[kind](fsc, name, cited)
            if text is None and kind == 'estados':
                text = enum_states(fsc, name, cited) or U.union_states(fsc.title, name, cited)
        if text is None:
            report.append((f, 'sem alvo no código'))
            continue
        if not dry:
            dest = f if not saida else os.path.join(saida, relpath)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            open(dest, 'w', encoding='utf-8').write(text + '\n')
        report.append((f, 'ok'))
    return report


def render(paths):
    """Gera os PNG com o plantuml.jar (variável PLANTUML_JAR ou ~/.m2)."""
    import subprocess
    jar = os.environ.get('PLANTUML_JAR') or next(iter(glob.glob(os.path.expanduser('~/.m2/repository/net/sourceforge/plantuml/plantuml/*/plantuml-*.jar'))), None)
    if not jar:
        print('plantuml.jar não encontrado: defina PLANTUML_JAR')
        return
    for i in range(0, len(paths), 40):
        subprocess.run(['java', '-Djava.awt.headless=true', '-DPLANTUML_LIMIT_SIZE=8192', '-jar', jar, '-charset', 'UTF-8', '-tpng', '-nbthread', 'auto', *paths[i:i + 40]], check=False)
