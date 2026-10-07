"""Escreve docs/diagramas/INDICE-2026-10.md a partir dos arquivos .puml e .png que existem."""
from __future__ import annotations

import datetime
import glob
import os
import re

import modelo as M

DIAG = os.path.join(M.ROOT, 'docs', 'diagramas')
KEPT_MARK = "' v5: diagrama do time mantido"
KINDS = [('atividades', 'Atividades'), ('sequencia', 'Sequência'), ('componentes', 'Componentes'),
         ('estados', 'Máquina de estados'), ('classes', 'Classes')]


def kind_of(path):
    b = os.path.basename(path).lower()
    if 'maquinadeestados' in b or 'estados' in b:
        return 'estados'
    for k in ('sequencia', 'componentes', 'classes', 'atividades', 'pipeline'):
        if k in b:
            return 'atividades' if k == 'pipeline' else k
    return None


def png_of(puml):
    src = open(puml, encoding='utf-8').read()
    m = re.search(r'^@startuml\s+(\S+)', src, re.M)
    if not m:
        return None
    p = os.path.join(os.path.dirname(puml), m.group(1) + '.png')
    return p if os.path.exists(p) else None


def title_of(puml):
    src = open(puml, encoding='utf-8').read()
    m = re.search(r'^title\s+(.+)$', src, re.M)
    return (m.group(1).split('\\n')[0].strip() if m else os.path.basename(puml)).replace('|', '¦')


def rel(p, base=DIAG):
    return os.path.relpath(p, base).replace(os.sep, '/')


def folders():
    out = []
    for d in sorted(glob.glob(DIAG + '/*/') + glob.glob(DIAG + '/*/*/'), key=lambda x: (len(x.split('/')), x)):
        files = sorted(glob.glob(d + '*.puml'))
        if files:
            out.append((rel(d.rstrip('/')), files))
    return out


def rf_key(key):
    m = re.match(r'RF(\d+)', key)
    return (0, int(m.group(1)), key) if m else (1, 0, key)


def esc_md(t, n):
    t = t.replace('|', '¦').replace('\\n', ' ')
    return t if len(t) <= n else t[:n - 1].rstrip() + '…'


def _titles():
    import escopo as E
    return {sc.key: sc.title for sc in E.all_scopes()}


TITLES = {}


def build():
    TITLES.update(_titles())
    today = datetime.date.today().isoformat()
    L = [f'# Diagramas — índice (gerado em {today})', '',
         'Todos os diagramas de **atividades, sequência, componentes, máquina de estados e classes** deste repositório são',
         'gerados do código atual por `scripts/diagramas/v5` (Java lido com tree-sitter; TypeScript do `app/`, `components/` e',
         '`lib/`). O escopo de cada diagrama (que RF, telas, rotas, serviços e entidades ele cobre) vem de',
         '`scripts/diagramas/v5/citacoes.json`, registrado a partir dos diagramas que o time já tinha. Fonte PlantUML (`.puml`)',
         'e imagem (`.png`) ficam lado a lado.', '',
         '**Regenerar tudo:**', '', '```bash',
         'pip install -r scripts/diagramas/v5/requirements.txt',
         'python3 scripts/diagramas/v5/gerar.py            # reescreve os .puml',
         'python3 scripts/diagramas/v5/gerar.py --render   # idem + PNG (precisa de java e do plantuml.jar; ver scripts/diagramas/v5/README.md)',
         'python3 scripts/diagramas/v5/indice.py           # este índice',
         '```', '',
         '| Funcionalidade | ' + ' | '.join(k[1] for k in KINDS) + ' |', '|---|' + '---|' * len(KINDS)]
    for key, files in sorted(folders(), key=lambda x: rf_key(x[0])):
        cells = {k: [] for k, _ in KINDS}
        title = None
        for f in files:
            k = kind_of(f)
            png = png_of(f)
            if k is None or png is None:
                continue
            t = title_of(f)
            if title is None:
                title = re.sub(r'\s*[—–-]\s*.*$', '', t) if t.startswith('RF') else key
            label = os.path.basename(png).replace('.png', '').replace('_', ' ')
            label = re.sub(r'^RF\d+\s*', '', label)
            kept = KEPT_MARK in open(f, encoding='utf-8').read()
            for kname, _ in KINDS:
                if kname == k:
                    cells[k].append(f'[{label.strip() or "png"}]({rel(png)})' + (' †' if kept else ''))
        head = re.sub(r'^RF\d+\s*[—–-]\s*', '', TITLES.get(key, '')).strip() or title or key
        L.append(f'| **{key}** — {esc_md(head, 90)} | ' + ' | '.join(' · '.join(cells[k]) or '—' for k, _ in KINDS) + ' |')
    kept = sorted(rel(f) for _, files in folders() for f in files if KEPT_MARK in open(f, encoding='utf-8').read())
    L += ['', f'† **{len(kept)} diagramas mantidos como o time escreveu.** O código atual não tem um campo, enum ou método',
          'de estado equivalente que o gerador consiga ler (ex.: o resgate em dinheiro do RF48 ainda não existe no código; o',
          'bloqueio por tentativas do RF49 vive num limitador de taxa genérico; o gate de acesso é do middleware do Next).',
          'Cada um leva uma legenda na própria imagem dizendo que não foi gerado nem verificado contra o código:', '']
    L += [f'- `{k}`' for k in kept]
    L += ['', '## Diagramas globais e fora de `docs/diagramas/`', '',
          '| Diagrama | Conteúdo | Arquivo |', '|---|---|---|']
    extras = [
        ('fashionai-classes-v5.puml', 'Classes de todas as entidades JPA, por área de negócio (mesmas áreas da taxonomia)'),
        ('fashionai-componentes-v5.puml', 'Componentes da arquitetura inteira: páginas → BFF/API → controllers por área → serviços → repositórios → bancos e serviços externos'),
    ]
    for f, desc in extras:
        p = os.path.join(DIAG, f)
        png = png_of(p) if os.path.exists(p) else None
        L.append(f'| {f} | {desc} | ' + (f'[png]({rel(png)})' if png else '—') + ' |')
    outside = [
        ('../taxonomia/taxonomia-de-entidades.puml', 'Taxonomia das entidades (gerada por `scripts/docs/taxonomia_entidades.py`)'),
        ('../entidades/taxonomia-contextos.puml', 'Entidades-chave por contexto delimitado (versão compacta das áreas)'),
        ('../anatomia/anatomia-de-esquemas-classes.puml', 'Anatomia do esquema (look): classes'),
        ('../anatomia/anatomia-de-esquemas-estados.puml', 'Ciclo de vida do esquema (look)'),
        ('../meu_guarda_roupa/RF33_Vista-me_Atividades.puml', 'Vista-me (RF28 no Trello): atividades'),
        ('../novos-rf/RF25_Selos_Promocoes_Cupons_Atividades.puml', 'Selo → direito promocional → cupom (RF25/RF38): atividades'),
        ('../avatar3d/auditoria-roupas-3d/pipeline-atual.puml', 'Pipeline atual de roupas 3D (gerado do código)'),
        ('../avatar3d/auditoria-roupas-3d/pipeline-proposto.puml', 'Pipeline proposto de roupas 3D (**proposta**, escrita à mão na auditoria; não é gerada do código)'),
        ('../../markdowns/RF33_Vista-me_Atividades.puml', 'Cópia do Vista-me em `markdowns/`'),
    ]
    for f, desc in outside:
        p = os.path.normpath(os.path.join(DIAG, f))
        png = png_of(p) if os.path.exists(p) else None
        L.append(f'| {f} | {desc} | ' + (f'[png]({rel(png)})' if png else '—') + ' |')
    L += ['', '## Diagramas em Mermaid dentro das especificações', '',
          'Os documentos de especificação (por exemplo `docs/novos-rf/RF15_Editor_de_Fotografia_da_Peca.md`, `RF54_FashionAI_Lens.md`)',
          'trazem fluxos em Mermaid que descrevem **propostas**, não o código atual; por isso não entram na geração automática.', '',
          '## Como ler', '',
          '- **Atividades:** fluxo principal do RF (tela → rota → controller → serviço), com as validações que o código faz',
          '  (código de erro + mensagem em português) e o que ele lê, grava, chama e publica; as outras ações do RF ficam num',
          '  bloco compacto.',
          '- **Sequência:** até duas rotas, com as chamadas reais a repositórios (tabela e operação), serviços, ports, IA e eventos.',
          '- **Componentes:** telas, `lib/api/client.ts`, controllers e rotas, serviços, ports com adaptadores, repositórios e bancos.',
          '- **Máquina de estados:** o campo de estado da entidade (enum, texto, booleano como `Comment.active` ou campo de',
          '  artefato vazio/preenchido como `mannequinImageUrl`) com as mudanças que o código faz; setas que saem da borda',
          '  valem a partir de qualquer estado. Estados que o código **calcula** em vez de gravar também saem do código:',
          '  níveis por limiar (`FaiPointsService.Level`), faixas declaradas (`InventoryScoreService.BANDS`), métodos',
          '  classificadores (`WardrobeCreatorService.availability`, `RoomService.statesOf`, `resolveEnvironment`), flags por',
          '  limiar (`sufficient = total >= MIN_DATA`), etapas de um pipeline (`dress()` da roupa no avatar) e o elemento de',
          '  vídeo do `ArtVideo`. No frontend, `useState` e tipos-união.',
          '- **Classes:** entidades JPA (tabela, campos, relações), enums de estado e o serviço principal com seus métodos.',
          '- Diagramas que o time escreveu sobre módulos internos (pipelines, filtros, componentes React) são gerados por',
          '  **unidade de código**: funções citadas, condições que encerram cedo, chamadas e mudanças de estado de tela.', '']
    return '\n'.join(L)


if __name__ == '__main__':
    out = os.path.join(DIAG, 'INDICE-2026-10.md')
    open(out, 'w', encoding='utf-8').write(build())
    print('índice escrito:', out)
