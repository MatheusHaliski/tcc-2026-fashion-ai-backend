"""Estilo e texto dos diagramas v5: skinparams por tipo de diagrama, acentos dos códigos de erro, data de geração,
escape e quebra de linha dos rótulos, apelidos PlantUML e o cabeçalho (@startuml + título) de cada diagrama."""
from __future__ import annotations

import datetime
import re


STYLE_COMMON = '''skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "DejaVu Sans"
skinparam defaultFontSize 12
skinparam titleFontSize 15
skinparam roundcorner 14
skinparam ArrowColor #52606D
skinparam note {
  BackgroundColor #FFFDEB
  BorderColor #D8CE78
  FontColor #554F24
}'''
STYLE = {
    'atividades': STYLE_COMMON + '''
skinparam activity {
  BackgroundColor #F8F4FF
  BorderColor #B695F5
  FontColor #2D2438
  DiamondBackgroundColor #FFF5F8
  DiamondBorderColor #F08DB1
  StartColor #20A77A
  EndColor #4B5563
}
skinparam swimlane {
  BorderColor #CBC6BE
  TitleFontColor #2D2438
}''',
    'sequencia': STYLE_COMMON + '''
skinparam sequence {
  ArrowColor #4A4852
  LifeLineBorderColor #CBC6BE
  ParticipantBackgroundColor #F4F2EF
  ParticipantBorderColor #4A4852
  ActorBorderColor #4A4852
  GroupBorderColor #CBC6BE
  GroupBackgroundColor #FAF8F5
}
autonumber "<b>0."''',
    'componentes': '!pragma layout smetana\n' + STYLE_COMMON + '''
skinparam component {
  BackgroundColor #F4F2EF
  BorderColor #4A4852
}
skinparam package {
  BorderColor #CBC6BE
  FontColor #4A4852
}
skinparam database {
  BackgroundColor #EEF6FF
  BorderColor #4A4852
}
skinparam cloud {
  BackgroundColor #F0FBF6
  BorderColor #4A4852
}
left to right direction''',
    'classes': '!pragma layout smetana\n' + STYLE_COMMON + '''
skinparam class {
  BackgroundColor #F4F2EF
  BorderColor #4A4852
  ArrowColor #4A4852
  StereotypeFontColor #6B6470
}
hide empty members
left to right direction''',
    'estados': '!pragma layout smetana\n' + STYLE_COMMON + '''
skinparam state {
  BackgroundColor #F8F4FF
  BorderColor #B695F5
  FontColor #2D2438
  StartColor #20A77A
  EndColor #4B5563
}''',
}

ACCENTS = {'invalido': 'inválido', 'invalida': 'inválida', 'nao': 'não', 'codigo': 'código', 'sessao': 'sessão',
           'peca': 'peça', 'pecas': 'peças', 'esta': 'está', 'ja': 'já', 'proprio': 'próprio', 'propria': 'própria',
           'usuario': 'usuário', 'midia': 'mídia', 'maximo': 'máximo', 'minimo': 'mínimo', 'versao': 'versão',
           'acao': 'ação', 'permissao': 'permissão', 'publicacao': 'publicação', 'saida': 'saída', 'periodo': 'período',
           'unico': 'único', 'unica': 'única', 'disponivel': 'disponível', 'indisponivel': 'indisponível',
           'obrigatorio': 'obrigatório', 'obrigatoria': 'obrigatória', 'nivel': 'nível', 'conteudo': 'conteúdo',
           'catalogo': 'catálogo', 'politica': 'política', 'expiracao': 'expiração', 'aprovacao': 'aprovação',
           'verificacao': 'verificação', 'revisao': 'revisão', 'configuracao': 'configuração', 'invalidos': 'inválidos',
           'inexistente': 'inexistente', 'proibido': 'proibido', 'tamanho': 'tamanho', 'slot': 'slot',
           'imagem': 'imagem', 'audio': 'áudio', 'video': 'vídeo', 'numero': 'número', 'senha': 'senha',
           'email': 'e-mail', 'nao_encontrado': 'não encontrado', 'duplicado': 'duplicado', 'conexao': 'conexão',
           'situacao': 'situação', 'combinacao': 'combinação', 'colecao': 'coleção', 'edicao': 'edição',
           'criacao': 'criação', 'operacao': 'operação', 'transacao': 'transação', 'moderacao': 'moderação',
           'resolucao': 'resolução', 'pontuacao': 'pontuação', 'regiao': 'região', 'opcao': 'opção', 'mao': 'mão'}

TODAY = datetime.date.today().isoformat()


# --------------------------------------------------------------------------------------------- utilitários
def esc(s, n=None):
    s = (s or '').replace('"', "'").replace('\n', ' ').strip()
    s = re.sub(r'\s+', ' ', s)
    if n and len(s) > n:
        s = s[:n - 1].rstrip() + '…'
    return s


def wrap(s, width=34):
    words, lines, cur = esc(s).split(' '), [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        lines.append(cur)
    return '\\n'.join(lines)


def human_code(code):
    words = code.lower().split('_')
    return ' '.join(ACCENTS.get(w, w) for w in words)


def alias(name):
    return re.sub(r'[^A-Za-z0-9_]', '_', name)


def header(name, title, kind_label, extra=''):
    sub = f'Diagrama de {kind_label} — gerado do código em {TODAY} (scripts/diagramas/v5)'
    if extra:
        sub += '\\n' + extra
    return f'@startuml {name}\n' + STYLE[kind_of_label(kind_label)] + f'\ntitle {esc(title, 140)}\\n{sub}\n'


def kind_of_label(lbl):
    return {'atividades': 'atividades', 'sequência': 'sequencia', 'componentes': 'componentes', 'classes': 'classes',
            'máquina de estados': 'estados'}[lbl]
