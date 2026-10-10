"""Gera os diagramas PlantUML (atividades, sequência, componentes, classes e máquina de estados) a partir do código.

Uso:  python3 scripts/diagramas/v5/gerar.py [--so RF27,RF28] [--data 2026-10-05]

Cada arquivo .puml que já existia em docs/diagramas é reescrito no mesmo caminho (os links continuam valendo), com o
conteúdo tirado do código atual pelo modelo (modelo.py) e o escopo do RF (escopo.py).
"""
from __future__ import annotations

import argparse
import datetime
import glob
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modelo as M  # noqa: E402
import escopo as E  # noqa: E402

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


def summary_label(e, n=48):
    s = re.sub(r'^(RNF?\d+(\.\w+)?(\s*[–—-]\s*\w+)*)\s*[—–-]\s*', '', e.summary or '').strip()
    s = re.sub(r'^RF\d+\S*\s*[—–-]\s*', '', s)
    if not s:
        s = f'{e.verb} {e.path}'
    return esc(s, n)


def repo_op(meth):
    m = meth.lower()
    if m.startswith(('save', 'insert', 'persist', 'upsert')):
        return 'grava'
    if m.startswith(('delete', 'remove', 'purge')):
        return 'apaga'
    if m.startswith(('update', 'increment', 'decrement', 'mark', 'set', 'touch', 'bump', 'reserve', 'claim', 'release')):
        return 'atualiza'
    return 'lê'


def sql_of(op):
    return {'grava': 'INSERT/UPDATE', 'apaga': 'DELETE', 'atualiza': 'UPDATE', 'lê': 'SELECT'}[op]


def table_of_repo(repo):
    ent, db = M.REPOS.get(repo, (None, 'MySQL'))
    return (M.table_of(ent) if ent else repo), db


def steps_for(e):
    """Passos do método de serviço chamado pela rota (o primeiro serviço que a rota chama)."""
    if not e.calls:
        return None, None, []
    svc, meth = e.calls[0]
    if svc not in M.TYPES or M.TYPES[svc].kind != 'class':
        return svc, meth, []
    return svc, meth, M.analyzer(svc).steps(meth)


NOT_COMPONENTS = {'Audit', 'AuditService', 'AiEngine', 'Guard', 'Clock', 'ObjectMapper', 'ApplicationEventPublisher'}


def kind_of_dep(t):
    if t in M.REPOS:
        return 'repo'
    if t in M.PORTS:
        return 'port'
    if t in M.SERVICES or (t in M.TYPES and M.TYPES[t].module == 'application'):
        return 'service'
    return 'other'


def _norm(t):
    import unicodedata
    return unicodedata.normalize('NFKD', t.lower()).encode('ascii', 'ignore').decode()


STOP = {'para', 'como', 'com', 'uma', 'pelo', 'pela', 'dos', 'das', 'que', 'por', 'mais', 'esta', 'este', 'seus', 'suas'}


# fluxo principal de cada RF (método do controller), quando a heurística não basta — conferido à mão
PRINCIPAL = {
    'RF1': 'AuthController.register', 'RF2': 'AuthController.login', 'RF3': 'MeController.updateSensitive',
    'RF4': 'WardrobeController.create', 'RF5': 'SchemeController.create', 'RF6': 'LookbookController.overview',
    'RF7': 'WardrobeController.detail', 'RF8': 'DiscoveryController.feed', 'RF9': 'SchemeController.update',
    'RF10': 'AutopilotController.ask', 'RF11': 'BackgroundController.saveScheme', 'RF12': 'PhotoController.list',
    'RF13': 'DnaController.create', 'RF14': 'ProfileController.brands', 'RF15': 'PhotoController.saveEdit',
    'RF16': 'WardrobeController.request3d', 'RF17': 'ProfileController.profile', 'RF18': 'TryOnController.render',
    'RF19': 'SocialController.react', 'RF20': 'SealController.accept', 'RF21': 'SealController.link',
    'RF22': 'ProfileController.celebrities', 'RF23': 'PreferencesController.update', 'RF26': 'DiscoveryController.global',
    'RF27': 'RoomController.move', 'RF28': 'MirrorController.place', 'RF28-espelho-vista-me': 'MirrorController.vistaMe',
    'RF29': 'HighlightsController.highlights', 'RF30': 'HighlightsController.buy', 'RF31': 'WardrobeController.flags',
    'RF32': 'ChallengeController.start', 'RF33': 'ShowcaseController.runway', 'RF34': 'ShowcaseController.list',
    'RF35': 'ShowcaseController.list', 'RF36': 'ShowcaseController.schemeMannequinPhoto', 'RF37': 'FlairController.duel',
    'RF38': 'CouponController.redeem', 'RF39': 'RoomCreatorController.create', 'RF40': 'Avatar3dController.save',
    'RF42': 'LookbookController.markDailyLook', 'RF43': 'AutopilotController.planWeek', 'RF44': 'HighlightsController.buy',
    'RF45': 'WardrobeController.studioPiece', 'RF46': 'BackgroundController.art', 'RF47': 'CatalogController.search',
    'RF48': 'HighlightsController.account', 'RF50': 'AdminController.decide', 'RF51': 'BackgroundController.saveScheme',
    'RF53': 'HypeController.look', 'RF54': 'LensController.create', 'RF25': 'SealController.createSeal',
    'RF25-criador-de-selos': 'SealController.draft', 'RF50/criador-de-selos': 'SealController.draft',
}


def _ca_of(e, nums):
    for n in nums:
        m = re.search(r'\bRF0?' + str(n) + r'(?:\.CA(\d+))?(?!\d)', e.summary or '')
        if m:
            return int(m.group(1)) if m.group(1) else 3
    return None


# pastas cujo comportamento mora no frontend ou em classes de infraestrutura: preferem o modo por unidades
UNIT_PREFERRED = {'RF40', 'RF40-roupa-no-avatar', 'RF52', 'RF51', 'RF28-espelho-vista-me', 'RF24', 'RF49', 'seguranca',
                  'dados-demo', 'RF25-criador-de-selos', 'RF50/criador-de-selos'}


def choose_unit(sc_key, kind, cited, fsc):
    import unidades as U
    top = sc_key.split('/')[0]
    if sc_key in UNIT_PREFERRED or top in UNIT_PREFERRED:
        mods, java = U.cited_units(cited)
        return bool(mods or java)
    has_principal = bool(PRINCIPAL.get(sc_key) or PRINCIPAL.get(top))
    if has_principal and kind in ('atividades', 'sequencia', 'componentes') and fsc.endpoints:
        return False
    return U.is_unit_mode(cited, kind) or (not fsc.endpoints and bool(U.cited_units(cited)[1]))


def _is_principal(sc, e):
    p = PRINCIPAL.get(sc.key) or PRINCIPAL.get(sc.key.split('/')[0])
    return p == f'{e.controller}.{e.method}'


def ranked_endpoints(sc, cited_text):
    """Ordem: o fluxo principal (tabela PRINCIPAL), depois as rotas do próprio RF com o menor critério de aceite (CA),
    escritas antes de leituras, o que o diagrama do time cita e a quantidade de passos."""
    n = max(len(cited_text), 1)
    low = _norm(cited_text)
    nums = ([sc.rf] + E.CODE_RF.get(sc.rf, [])) if sc.rf else []
    key = sc.key
    principal = PRINCIPAL.get(key) or PRINCIPAL.get(key.split('/')[0])

    def score(e):
        s = 0.0
        if principal and f'{e.controller}.{e.method}' == principal:
            s += 100
        ca = _ca_of(e, nums)
        if ca is not None:
            s += 6 + 6 * (1 - min(ca, 20) / 20)
        static = re.sub(r'/\{[^}]+\}', '', e.path)
        pos = [i for i in (cited_text.find(static) if len(static) > 8 else -1, cited_text.find(e.method + '(')) if i >= 0]
        if pos:
            s += 4 + 3 * (1 - min(pos) / n)
        words = [w for w in re.findall(r'[a-z]{4,}', _norm(summary_label(e, 200))) if w not in STOP]
        hits = [low.find(w) for w in words if low.find(w) >= 0]
        if hits:
            s += 2 * len(hits) / max(len(words), 1) + 2 * (1 - min(hits) / n)
        if e.verb != 'GET':
            s += 8
        _, _, st = steps_for(e)
        s += min(len(st), 30) / 30
        return -s
    return sorted(sc.endpoints, key=score)


def callers_of(svc, meth):
    return [e for e in M.ENDPOINTS if (svc, meth) in e.calls]


def page_of_endpoint(e, sc):
    for r in sc.pages:
        if any(c[2] is e for c in M.PAGES[r]['calls']):
            return r
    for r, p in M.PAGES.items():
        if any(c[2] is e for c in p['calls']):
            return r
    return None


def header(name, title, kind_label, extra=''):
    sub = f'Diagrama de {kind_label} — gerado do código em {TODAY} (scripts/diagramas/v5)'
    if extra:
        sub += '\\n' + extra
    return f'@startuml {name}\n' + STYLE[kind_of_label(kind_label)] + f'\ntitle {esc(title, 140)}\\n{sub}\n'


def kind_of_label(lbl):
    return {'atividades': 'atividades', 'sequência': 'sequencia', 'componentes': 'componentes', 'classes': 'classes',
            'máquina de estados': 'estados'}[lbl]


# --------------------------------------------------------------------------------------------- atividades
def _effects(steps, svc):
    reads, writes, ais, evs, trans, others = [], [], [], [], [], []
    for st in steps:
        if st.kind == 'call':
            k = kind_of_dep(st.target)
            if k == 'repo':
                tbl, db = table_of_repo(st.target)
                op = repo_op(st.method)
                (writes if op != 'lê' else reads).append(tbl + (f' ({db})' if db != 'MySQL' else ''))
            elif k in ('port', 'service') and st.target != svc and st.target not in ('Audit', 'AuditService'):
                others.append(f'{st.target}.{st.method}')
        elif st.kind == 'ai':
            ais.append(st.target)
        elif st.kind == 'event':
            evs.append(st.target)
        elif st.kind == 'transition':
            trans.append(f'{st.field} → {st.value}')
    return [(lbl, list(dict.fromkeys(items))) for lbl, items in
            (('Lê', reads), ('Usa', others), ('IA', ais), ('Grava', writes), ('Estado', trans), ('Evento', evs)) if items]


def _guard_label(g):
    if g.code not in ('ERRO', 'NAO_ENCONTRADO', 'ACESSO_NEGADO'):
        return human_code(g.code)
    return esc(g.text, 40) or human_code(g.code)


def activity(sc, name, cited_text, max_side=5, max_guards=5):
    out = [header(name, sc.title, 'atividades')]
    eps = ranked_endpoints(sc, cited_text)
    gets = [e for e in eps if e.verb == 'GET'][:4]
    acts = [e for e in eps if e.verb != 'GET']
    if eps and eps[0].verb == 'GET' and _is_principal(sc, eps[0]):
        acts = [eps[0]] + acts
        gets = [g for g in gets if g is not eps[0]]
    if not acts:
        acts, gets = gets[:1] + [e for e in eps if e.verb == 'GET'][4:], gets[1:]
    pages = sc.pages[:3]
    out.append('|Pessoa usuária|')
    out.append('start')
    out.append(f':Abre {wrap(", ".join(pages) if pages else "a tela do RF")};')
    out.append('|Tela (Next.js)|')
    out.append((':Carrega os dados da tela\\n' + '\\n'.join(f'GET {esc(g.path, 60)}' for g in gets) + ';') if gets
               else ':Monta a tela;')
    if not acts:
        out.append('|Pessoa usuária|')
        out.append(':Consulta as informações;')
        out.append('stop')
        out.append('@enduml')
        return '\n'.join(out)
    main = acts[0]
    svc, meth, steps = steps_for(main)
    out.append('|Pessoa usuária|')
    out.append(f':{wrap(summary_label(main, 60), 36)};')
    out.append('|Tela (Next.js)|')
    out.append(f':{main.verb} {esc(main.path, 70)};')
    out.append('|API (Spring Boot)|')
    out.append(f':{main.controller}.{main.method}\\n→ {svc or "—"}.{meth or ""};')
    guards = [g for g in steps if g.kind == 'guard']
    for g in guards[:max_guards]:
        msg = wrap(g.text, 34) if g.text else ''
        out.append(f'if ({esc(_guard_label(g), 44).replace("(", "[").replace(")", "]")}?) then (sim)')
        out.append(f'  :{g.status} {g.code}' + (f'\\n«{msg}»' if msg else '') + '\\n→ a tela mostra o aviso;')
        out.append('  stop')
        out.append('endif')
    if len(guards) > max_guards:
        rest = ', '.join(sorted({g.code for g in guards[max_guards:]}))
        out.append(f'note right\n  e mais {len(guards) - max_guards} validações:\n  {wrap(rest, 50).replace(chr(92) + "n", chr(10) + "  ")}\nend note')
    out.append('|Dados e serviços|')
    eff = _effects(steps, svc)
    if not eff:
        out.append(':Monta a resposta;')
    for lbl, items in eff:
        shown = items[:6]
        more = f' (+{len(items) - 6})' if len(items) > 6 else ''
        out.append(f':{lbl}: ' + '\\n'.join(wrap(x, 46) for x in shown) + more + ';')
    out.append('|Tela (Next.js)|')
    out.append(':Atualiza a tela com a resposta;')
    side = acts[1:1 + max_side]
    if side:
        out.append('|Pessoa usuária|')
        out.append('if (Faz outra ação?) then (sim)')
        out.append('  switch (Qual?)')
        for e in side:
            sv, me, st = steps_for(e)
            eff = _effects(st, sv)
            gs = sorted({g.code for g in st if g.kind == 'guard'})
            lines = [f'{e.verb} {esc(e.path, 56)}', f'→ {sv}.{me}']
            if gs:
                lines.append('valida: ' + wrap(', '.join(gs[:4]) + (' …' if len(gs) > 4 else ''), 44))
            for lbl, items in eff[:3]:
                lines.append(f'{lbl.lower()}: ' + wrap(', '.join(items[:3]) + (' …' if len(items) > 3 else ''), 44))
            out.append(f'  case ({esc(summary_label(e, 34)).replace("(", "[").replace(")", "]")})')
            out.append('    :' + '\\n'.join(lines) + ';')
        out.append('  endswitch')
        if len(acts) > 1 + max_side:
            more = ', '.join(summary_label(e, 30) for e in acts[1 + max_side:1 + max_side + 6])
            out.append(f'  note right\n  Outras ações deste RF:\n  {wrap(more, 50).replace(chr(92) + "n", chr(10) + "  ")}\n  end note')
        out.append('  |Tela (Next.js)|')
        out.append('  :Atualiza a tela;')
        out.append('endif')
    out.append('|Pessoa usuária|')
    out.append('stop')
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- sequência
class Seq:
    def __init__(self):
        self.parts, self.lines, self.order = {}, [], []

    def part(self, key, decl):
        if key not in self.parts:
            self.parts[key] = decl
            self.order.append(key)
        return key

    def msg(self, line):
        if self.lines and self.lines[-1][0] == line:
            self.lines[-1][1] += 1
        else:
            self.lines.append([line, 1])

    def raw(self, line):
        self.lines.append([line, 0])

    def render(self):
        out = [self.parts[k] for k in self.order]
        for line, n in self.lines:
            if n > 1 and ':' in line:
                line = line + f' (×{n})'
            out.append(line)
        return out


def sequence(sc, name, cited_text, max_eps=2, max_msgs=28):
    out = [header(name, sc.title, 'sequência')]
    eps = [e for e in ranked_endpoints(sc, cited_text) if e.calls][:max_eps]
    q = Seq()
    q.part('U', 'actor "Pessoa usuária" as U')
    expanded = set()
    for idx, e in enumerate(eps):
        svc, meth, steps = steps_for(e)
        if idx > 0 and len(q.lines) > 34:
            break
        page = page_of_endpoint(e, sc)
        q.part('P', f'boundary "Tela {esc(page or "(Next.js)", 40)}" as P')
        C = q.part(alias(e.controller), f'control "{e.controller}" as {alias(e.controller)}')
        S = q.part(alias(svc), f'participant "{svc}" as {alias(svc)}') if svc else C
        q.raw(f'== {esc(summary_label(e, 70))} ==')
        q.msg(f'U -> P : {esc(summary_label(e, 50))}')
        q.msg(f'P -> {C} : {e.verb} {esc(e.path, 60)}')
        q.msg(f'{C} -> {S} : {meth}()')
        q.raw(f'activate {S}')
        count, i = 0, 0
        for i, st in enumerate(steps):
            if count >= max_msgs:
                q.raw(f'note over {S} : … e mais {len(steps) - i} passos no código')
                break
            if st.kind == 'guard':
                q.raw(f'alt {esc(_guard_label(st), 50)}')
                q.msg(f'{S} --> {C} : {st.status} {st.code}')
                q.msg(f'{C} --> P : {st.status} + mensagem')
                q.raw('end')
                count += 2
            elif st.kind == 'call':
                k = kind_of_dep(st.target)
                if k == 'repo':
                    tbl, db = table_of_repo(st.target)
                    D = q.part('DB_' + db, f'database "{db}" as DB_{db}')
                    q.msg(f'{S} -> {D} : {sql_of(repo_op(st.method))} {tbl}')
                    count += 1
                elif k == 'service' and st.target != svc:
                    X = q.part(alias(st.target), f'participant "{st.target}" as {alias(st.target)}')
                    q.msg(f'{S} -> {X} : {st.method}()')
                    count += 1
                    key = (st.target, st.method)
                    if key in expanded or st.target in ('Audit', 'AuditService'):
                        continue
                    expanded.add(key)
                    inner = []
                    if st.target in M.TYPES and M.TYPES[st.target].kind == 'class':
                        inner = [x for x in M.analyzer(st.target).steps(st.method)
                                 if x.kind == 'call' and kind_of_dep(x.target) == 'repo'][:4]
                    for s2 in inner:
                        tbl, db = table_of_repo(s2.target)
                        D = q.part('DB_' + db, f'database "{db}" as DB_{db}')
                        q.msg(f'{X} -> {D} : {sql_of(repo_op(s2.method))} {tbl}')
                        count += 1
                    if inner:
                        q.msg(f'{X} --> {S}')
                elif k == 'port':
                    impl = ', '.join(M.ADAPTERS.get(st.target, [])[:2])
                    X = q.part(alias(st.target), f'participant "{st.target}' + (f'\\n({impl})' if impl else '') + f'" as {alias(st.target)}')
                    q.msg(f'{S} -> {X} : {st.method}()')
                    count += 1
            elif st.kind == 'ai':
                q.part('AI', 'participant "AiEngine\\n(provedor de IA + reserva local)" as AI')
                q.msg(f'{S} -> AI : {st.target}')
                q.msg(f'AI --> {S} : resposta (ou reserva local)')
                count += 2
            elif st.kind == 'event':
                q.part('EV', 'queue "Eventos de domínio" as EV')
                q.msg(f'{S} ->> EV : {st.target}')
                count += 1
            elif st.kind == 'transition':
                q.msg(f'{S} -> {S} : {st.field} = {st.value}')
                count += 1
            elif st.kind == 'create':
                q.msg(f'{S} -> {S} : new {st.target}()')
                count += 1
        q.raw(f'deactivate {S}')
        q.msg(f'{S} --> {C} : resultado')
        q.msg(f'{C} --> P : {"201" if e.verb == "POST" else "200"} JSON')
        q.msg('P --> U : atualiza a tela')
    if not eps:
        q.part('P', 'boundary "Tela (Next.js)" as P')
        q.msg('U -> P : usa a tela')
        q.raw('note right of P : sem rota de API própria neste RF')
    out += q.render()
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- componentes
def components(sc, name, cited_text):
    out = [header(name, sc.title, 'componentes')]
    eps = sc.endpoints
    ctrls = list(dict.fromkeys(e.controller for e in eps))[:6]
    primary = list(dict.fromkeys(s for e in eps for s, _ in e.calls if s in M.TYPES))[:6]
    secondary = []
    for p in primary:
        for d in M.deps_of(p):
            if kind_of_dep(d) == 'service' and d not in primary and d not in secondary and d not in NOT_COMPONENTS:
                secondary.append(d)
    secondary = secondary[:8]
    repos, ports, uses_ai, events = [], [], False, False
    for p in primary:
        for d in M.deps_of(p):
            if d in M.REPOS and d not in repos:
                repos.append(d)
            elif d in M.PORTS and d not in ports:
                ports.append(d)
            elif d == 'AiEngine':
                uses_ai = True
            elif d == 'ApplicationEventPublisher':
                events = True
    out.append('package "Frontend (Next.js)" {')
    for i, r in enumerate(sc.pages[:6]):
        out.append(f'  component "{esc(r)}\\n{esc(M.PAGES[r]["file"].replace("app/", ""), 60)}" as FE{i}')
    out.append('  component "lib/api/client.ts" as APIC')
    out.append('}')
    out.append('package "fai-web (REST)" {')
    for c in ctrls:
        paths = sorted({re.sub(r'/\{[^}]+\}', '/{…}', e.path) for e in eps if e.controller == c})
        shown = '\\n'.join(esc(p, 50) for p in paths[:4]) + (f'\\n(+{len(paths) - 4} rotas)' if len(paths) > 4 else '')
        out.append(f'  component "{c}\\n{shown}" as {alias(c)}')
    out.append('}')
    out.append('package "fai-application (casos de uso)" {')
    for s_ in primary:
        out.append(f'  component "{s_}" as {alias(s_)}')
    for s_ in secondary:
        out.append(f'  component "{s_}" as {alias(s_)} <<apoio>>')
    for p in ports:
        impl = ' / '.join(M.ADAPTERS.get(p, [])[:2])
        out.append(f'  component "{p}' + (f'\\n«{impl}»' if impl else '') + f'" as {alias(p)} <<port>>')
    out.append('}')
    dbs = {}
    for r in repos:
        tbl, db = table_of_repo(r)
        dbs.setdefault(db, []).append((r, tbl))
    if dbs:
        out.append('package "fai-domain (repositórios)" {')
        for db, items in dbs.items():
            out.append(f'  component "' + '\\n'.join(r for r, _ in items[:10]) + (f'\\n(+{len(items) - 10})' if len(items) > 10 else '') + f'" as REPO_{db}')
        out.append('}')
    for db, items in dbs.items():
        tl = sorted({t for _, t in items})
        out.append(f'database "{db}\\n' + '\\n'.join('• ' + t for t in tl[:12]) + (f'\\n(+{len(tl) - 12})' if len(tl) > 12 else '') + f'" as DB_{db}')
    if uses_ai:
        out.append('cloud "Motor de IA (RF24)\\nprovedores externos + reserva local" as AI')
    if events:
        out.append('component "Eventos de domínio\\n(@TransactionalEventListener)" as EV')
    clouds = {}
    for p in ports:
        for a in M.ADAPTERS.get(p, []):
            st = M.store_of_adapter(a)
            if st and st not in dbs:
                clouds.setdefault(st, set()).add(p)
    for c in clouds:
        out.append(f'cloud "{c}" as CL_{alias(c)}')
    for i, r in enumerate(sc.pages[:6]):
        out.append(f'FE{i} --> APIC')
    for c in ctrls:
        n = sum(1 for e in eps if e.controller == c)
        out.append(f'APIC --> {alias(c)} : HTTPS/JSON')
        for s_ in sorted({s_ for e in eps if e.controller == c for s_, _ in e.calls if s_ in primary}):
            out.append(f'{alias(c)} --> {alias(s_)}')
    for p in primary:
        for d in M.deps_of(p):
            if d in secondary or (d in primary and d != p):
                out.append(f'{alias(p)} ..> {alias(d)}')
            elif d in M.PORTS:
                out.append(f'{alias(p)} --> {alias(d)}')
        if any(d in M.REPOS for d in M.deps_of(p)):
            for db in {table_of_repo(d)[1] for d in M.deps_of(p) if d in M.REPOS}:
                out.append(f'{alias(p)} --> REPO_{db}')
        if uses_ai and 'AiEngine' in M.deps_of(p):
            out.append(f'{alias(p)} --> AI')
        if events and 'ApplicationEventPublisher' in M.deps_of(p):
            out.append(f'{alias(p)} --> EV')
    for db in dbs:
        out.append(f'REPO_{db} --> DB_{db} : JPA' + ('/Flyway' if db == 'MySQL' else ''))
    for c, ps in clouds.items():
        for p in sorted(ps):
            out.append(f'{alias(p)} --> CL_{alias(c)}')
    import unidades as U
    decl = [ln for ln in out if not re.match(r'^\S+\s+(-+>|\.\.>|\.\.\|>)\s+\S+', ln)]
    edges = [ln for ln in out if re.match(r'^\S+\s+(-+>|\.\.>|\.\.\|>)\s+\S+', ln)]
    out = decl + U.aggregate_edges(set(edges))
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- classes
def relations(names):
    out = []
    for n in [x for x in names if x in M.ENTITIES]:
        for fname, typ, rel, init in M.entity_fields(n):
            base = re.sub(r'^(List|Set)<(\w+)>$', r'\2', typ)
            if base in names and base != n and rel:
                arrow = '"*" --> "1"' if rel == 'many' else '"1" --> "1"' if rel == 'one' else '"1" --> "*"'
                out.append(f'{n} {arrow} {base} : {fname}')
            elif fname.endswith('Id') and fname != 'id' and rel is None and typ == 'UUID':
                target = fname[:-2][0].upper() + fname[:-2][1:]
                alias_ = {'Owner': 'User', 'Actor': 'User', 'Creator': 'User', 'Author': 'User', 'Issuer': 'User',
                          'Follower': 'User', 'Followee': 'User', 'Winner': 'User', 'Piece': 'WardrobeItem',
                          'WardrobeItem': 'WardrobeItem', 'Look': 'Scheme', 'Scheme': 'Scheme', 'Seal': 'Seal'}.get(target, target)
                if alias_ in names and alias_ != n:
                    out.append(f'{n} ..> {alias_} : {fname}')
            if typ in M.ENUMS and typ in names:
                out.append(f'{n} --> {typ}')
    return sorted(set(out))


HIDDEN_FIELDS = {'version', 'createdBy', 'lastModifiedBy', 'createdAt', 'updatedAt'}


def classes(sc, name, cited_text, max_ents=12, max_fields=10):
    out = [header(name, sc.title, 'classes')]
    ents = [e for e in sc.entities if e in cited_text] + [e for e in sc.entities if e not in cited_text]
    ents = list(dict.fromkeys(ents))[:max_ents]
    enums = []
    for e in ents:
        for fname, ftype, rel, init in M.entity_fields(e):
            if ftype in M.ENUMS and ftype not in enums and M.STATUS_FIELD.match(fname):
                enums.append(ftype)
    for e in ents:
        for fname, ftype, rel, init in M.entity_fields(e):
            if ftype in M.ENUMS and ftype not in enums and ftype in cited_text and len(enums) < 6:
                enums.append(ftype)
    enums = enums[:6]
    out.append('package "fai-domain (entidades JPA)" {')
    for e in ents:
        out.append(f'  class {e} <<{M.table_of(e)}>> {{')
        fs = [f for f in M.entity_fields(e) if f[0] not in HIDDEN_FIELDS]
        for fname, ftype, rel, init in fs[:max_fields]:
            out.append(f'    +{fname}: {esc(ftype.replace("java.util.", "").replace("java.time.", ""), 40)}')
        if len(fs) > max_fields:
            out.append(f'    .. +{len(fs) - max_fields} campos ..')
        out.append('  }')
    out.append('}')
    if enums:
        out.append('package "fai-domain (enums)" {')
        for en in enums:
            vals = M.ENUMS[en]
            out.append(f'  enum {en} {{\n' + '\n'.join('    ' + v for v in vals[:10]) + ('\n    ..' if len(vals) > 10 else '') + '\n  }')
        out.append('}')
    main = next((s_ for e in sc.endpoints for s_, _ in e.calls if s_ in M.SERVICES), None)
    if main:
        meths = list(dict.fromkeys(m for e in sc.endpoints for (sv, m) in e.calls if sv == main))[:10]
        out.append('package "fai-application" {')
        out.append(f'  class {main} <<service>> {{')
        for m in meths:
            out.append(f'    +{m}()')
        out.append('  }')
        out.append('}')
        used = sorted({M.REPOS[d][0] for d in M.deps_of(main) if d in M.REPOS and M.REPOS[d][0] in ents})
        for u in used[:6]:
            out.append(f'{main} ..> {u} : usa')
    out += relations(set(ents) | set(enums))
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- máquina de estados
def pick_state_targets(sc, cited_text):
    """Campos de estado candidatos, do mais provável ao menos: campos de status (enum ou texto) e qualquer campo enum
    de que o diagrama do time cite ao menos dois valores (ex.: DailyLook.feedback). Só entra o que o texto do diagrama
    apoia (entidade, tabela, enum ou valores citados) — o escopo da pasta sozinho não basta."""
    cands = []
    ents = list(dict.fromkeys([e for e in M.ENTITIES if _cited(e, cited_text)] + sc.entities))
    for e in ents:
        e_c = _cited(e, cited_text)
        t_c = _cited(M.table_of(e) or '§', cited_text)
        for fname, ftype, rel, init in M.entity_fields(e):
            if rel is not None or not (ftype in M.ENUMS or (ftype == 'String' and M.STATUS_FIELD.match(fname))):
                continue
            is_status = bool(M.STATUS_FIELD.match(fname))
            trs = [t for t in M.TRANSITIONS if t[0] == e and t[1] == fname]
            vals = M.ENUMS.get(ftype, []) if ftype in M.ENUMS else sorted({t[4] for t in trs if not t[4].startswith('?')})
            cv = sum(1 for v in vals if _cited(v, cited_text))
            en_c = ftype in M.ENUMS and _cited(ftype, cited_text)
            if not is_status and (cv < 2 or not (e_c or t_c or en_c)):
                continue
            if not (e_c or t_c or en_c or cv >= 2):
                continue
            if not (trs or ftype in M.ENUMS):
                continue
            title = sc.title or ''
            in_title = (_cited(e, title) or _cited(M.table_of(e) or '§', title) or (ftype in M.ENUMS and _cited(ftype, title))
                        or (e_c and (_cited(fname, title) or _cited(_snake(fname), title))))
            score = (len(trs) + 6 * cv + 12 * e_c + 15 * en_c + 5 * t_c + 3 * _cited(fname, cited_text) + 20 * in_title
                     + 8 * (is_status and bool(trs)))
            cands.append((score, e, fname, ftype, init, cv, in_title))
    cands.sort(key=lambda x: -x[0])
    return cands


def _enum_region(ent, fld, ftype, init, comp):
    """Linhas de um estado composto para Entidade.campo (enum ou texto), com as mudanças que o código faz."""
    trs = [t for t in M.TRANSITIONS if t[0] == ent and t[1] == fld]
    states = list(M.ENUMS.get(ftype, [])) if ftype in M.ENUMS else []
    for t in trs:
        if not t[4].startswith('?') and t[4] not in states:
            states.append(t[4])
        for s0 in t[3]:
            s0 = s0.lstrip('!')
            if s0 not in states:
                states.append(s0)
    initial = None
    if init:
        m = re.search(r'([A-Z][A-Z0-9_]*)"?$', init.strip())
        initial = m.group(1) if m and m.group(1) in states else None
    if initial is None:
        initial = _initial_from_creation(ent, fld, states)
    out = [f'state "{ent}.{fld}" as {comp} {{']
    for st in states:
        out.append(f'  state {comp}_{alias(st)} as "{st}"')
    out.append('}')
    if initial:
        out.append(f'[*] --> {comp}_{alias(initial)} : criação')
    # uma seta por par (origem, destino); vários métodos vão juntos no rótulo
    edges, anyvalue, border = {}, [], False

    def add(a, b, svm):
        lst = edges.setdefault((a, b), [])
        if svm not in lst:
            lst.append(svm)
    for _, _, _, srcs, dst, svm in trs:
        if dst.startswith('?'):
            anyvalue.append(f'{svm.split(".", 1)[1]}({dst[1:]})')
            if len(states) <= 4:
                for st in states:
                    add('*', st, svm)
            continue
        req = [x for x in srcs if not x.startswith('!')]
        exc = [x[1:] for x in srcs if x.startswith('!')]
        if req:
            for s0 in req:
                if s0 in states:
                    add(s0, dst, svm)
        elif exc and len(states) - len(exc) <= 4:
            for s0 in states:
                if s0 not in exc and s0 != dst:
                    add(s0, dst, svm)
        else:
            add('*', dst, svm)
    for (a, b), svms in edges.items():
        if len(svms) == 1:
            lbl = label_of(svms[0])
        else:
            names = [v.split('.', 1)[1] + '()' for v in svms]
            lbl = wrap(', '.join(names[:5]) + (f' +{len(names) - 5}' if len(names) > 5 else ''), 36)
        src_node = comp if a == '*' else f'{comp}_{alias(a)}'
        border |= a == '*'
        out.append(f'{src_node} --> {comp}_{alias(b)} : {lbl}')
    reached = {t[4] for t in trs}
    unreached = [x for x in states if x != initial and x not in reached] if not anyvalue else []
    if unreached:
        out.append(f'note bottom of {comp}\n  Sem mudança explícita no código para: {", ".join(unreached[:8])}'
                   + ('…' if len(unreached) > 8 else '') + '\n  (valor vindo de importação, regra calculada ou dado legado)\nend note')
    if anyvalue and len(states) > 4:
        out.append(f'note bottom of {comp}\n  Recebe o valor escolhido em: {esc(", ".join(dict.fromkeys(anyvalue)), 80)}\nend note')
    return out, border


def _initial_from_creation(ent, fld, states):
    """Estado inicial: o valor que o método que cria a entidade grava primeiro no campo (new X(); x.setStatus(...))."""
    for n, t in M.TYPES.items():
        if t.module != 'application' or t.kind != 'class':
            continue
        for m in t.methods:
            if m.node is None:
                continue
            created = False
            for st in M.analyzer(n).steps(m.name):
                if st.kind == 'create' and st.target == ent:
                    created = True
                elif created and st.kind == 'transition' and st.field == fld and st.value in states:
                    return st.value
    return None


def label_of(svm):
    svc, meth = svm.split('.', 1)
    eps = callers_of(svc, meth)
    return f'{meth}()' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')


def state_machine(sc, name, cited_text):
    cands = pick_state_targets(sc, cited_text)
    if not cands:
        return None
    top = cands[0]
    # o campo de status da mesma entidade vem primeiro; o outro campo citado vira a segunda região (RF45, RF53)
    if not M.STATUS_FIELD.match(top[2]):
        st = next((c for c in cands[1:] if c[1] == top[1] and M.STATUS_FIELD.match(c[2])), None)
        if st is not None:
            cands = [st, top] + [c for c in cands[1:] if c is not st]
    _, ent, fld, ftype, init, _, _ = cands[0]
    # um segundo campo da mesma entidade quando o time também cita os valores dele (ex.: DailyLook source + feedback)
    extra = next((c for c in cands[1:] if c[1] == ent and c[2] != fld and c[5] >= 2
                  and c[2] not in ('type', 'kind', 'category', 'subcategory') and len(M.ENUMS.get(c[3], [])) <= 8
                  and (any(t[0] == ent and t[1] == c[2] for t in M.TRANSITIONS) or c[5] >= 3
                       or (M.STATUS_FIELD.match(c[2]) and _cited(c[3], sc.title or '')))), None)
    fields = [(fld, ftype, init)] + ([(extra[2], extra[3], extra[4])] if extra else [])
    ttl = _rf_prefix(sc) + f'ciclo de vida de {ent}.' + ' e '.join(f[0] for f in fields)
    sub = ' · '.join(f'enum {t}' if t != 'String' else 'campo texto' for _, t, _ in fields) + f' · tabela {M.table_of(ent)}'
    out = [header(name, ttl, 'máquina de estados', sub)]
    border = False
    for i, (f, t, ini) in enumerate(fields):
        lines, b = _enum_region(ent, f, t, ini, f'Ciclo_{alias(ent)}' + (f'_{alias(f)}' if i else ''))
        out += lines
        border |= b
    if border:
        out.append(f'note right of Ciclo_{alias(ent)}\n  Setas que saem da borda: a mudança vale\n  a partir de qualquer estado (o código não\n  testa o estado anterior).\nend note')
    out.append('@enduml')
    return '\n'.join(out)


def enum_states(sc, name, text):
    """Última reserva: um enum citado pelo diagrama (ou pela pasta), com os valores e o que o código faz com eles."""
    cands = []
    # nomes de estado em CAIXA ALTA que o diagrama do time usa: o enum tem de cobrir boa parte deles
    team = set(re.findall(r'\b[A-Z][A-Z0-9_]{3,}\b', text))
    for e, vals in M.ENUMS.items():
        if len(vals) < 2:
            continue
        hits = sum(1 for v in vals if _cited(v, text))
        if _cited(e, text) or (hits >= 2 and hits >= 0.4 * len(team)):
            cands.append((hits + 5 * _cited(e, text), e))
    if not cands:
        return None
    en = max(cands)[1]
    trs = [t for t in M.TRANSITIONS if t[2] == en]
    rf = re.match(r'^(RF\d+[^—]*)—', sc.title)
    ttl = (rf.group(1).strip() + ' — ' if rf else '') + f'valores de {en}'
    out = [header(name, ttl, 'máquina de estados', f'enum {en} · ' + (f'{len(trs)} mudanças no código' if trs else 'sem mudança explícita no código: valor calculado, importado ou definido na criação'))]
    out.append(f'state "{en}" as E_{alias(en)} {{')
    for v in M.ENUMS[en]:
        out.append(f'  state {alias(v)} as "{v}"')
    out.append('}')
    out.append(f'[*] --> {alias(M.ENUMS[en][0])}')
    seen = set()
    for ent, fld, _, srcs, dst, svm in trs:
        lbl = svm.split('.', 1)[1] + '()'
        req = [x for x in srcs if not x.startswith('!')]
        for src_ in (req or ['*']):
            key = (src_, dst, lbl)
            if key in seen or dst not in M.ENUMS[en]:
                continue
            seen.add(key)
            out.append((f'{alias(src_)} --> {alias(dst)} : {lbl}') if src_ != '*' else f'E_{alias(en)} --> {alias(dst)} : {lbl}')
    if not trs:
        vals = M.ENUMS[en]
        for a, b in zip(vals, vals[1:]):
            out.append(f'{alias(a)} -[dashed]-> {alias(b)}')
        out.append(f'note bottom of E_{alias(en)}\n  Ordem declarada no enum (setas tracejadas); o código não troca\n  este valor com setStatus — ele é calculado ou definido na criação.\nend note')
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- estados derivados
def _cited(word, text):
    return bool(word) and re.search(r'(?<![\w])' + re.escape(word) + r'(?![\w])', text) is not None


def _up(s):
    """'Versátil Closet' -> 'VERSATIL CLOSET' (para comparar rótulos com o texto do diagrama do time)."""
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.split(r'[^A-Z0-9]+', s)).strip()


def _rf_prefix(sc):
    rf = re.match(r'^(RF\d+[^—]*)—', sc.title)
    return rf.group(1).strip() + ' — ' if rf else ''


def _snake(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def _flag_region(ent, fld, init, comp, presence=False):
    """Estado composto de um campo booleano (Comment.active: true/false) ou de um campo de artefato
    (WardrobeItem.mannequinImageUrl: vazio/preenchido), com a criação e cada setX(...) do código."""
    trs = [t for t in M.TRANSITIONS if t[0] == ent and t[1] == fld]
    T, F = f'{comp}_T', f'{comp}_F'
    yes, no = ('preenchido', 'vazio (null)') if presence else ('true', 'false')
    out = [f'state "{ent}.{fld}" as {comp} {{',
           f'  state "{fld} = {yes}" as {T}' if not presence else f'  state "{fld} {yes}" as {T}',
           f'  state "{fld} = {no}" as {F}' if not presence else f'  state "{fld} {no}" as {F}']
    start = T if (init or '').strip() == 'true' else F
    makers = []
    if not presence:
        makers = [f'{n}.{m.name}' for n, t in M.TYPES.items() if t.module == 'application' for m in t.methods
                  if m.node is not None and any(st.kind == 'create' and st.target == ent for st in M.analyzer(n).steps(m.name))][:2]
    lbl = 'criação' + (f'\\n{esc(", ".join(x.split(".", 1)[1] + "()" for x in makers), 50)}' if makers else '') \
        + (f'\\n(valor inicial {init or "false"})' if not presence else '')
    out.append(f'  [*] --> {start} : {lbl}')
    # uma seta por par de estados; com vários métodos, os nomes vão juntos no rótulo
    by_pair = {}
    for _, _, _, _, val, svm in trs:
        if val in ('false', 'null'):
            pairs = [(T, F)]
        elif val in ('true', 'set'):
            pairs = [(F, T)] if not presence else [(F, T), (T, T)]
        else:
            pairs = [(T, F), (F, T)]
        for xy in pairs:
            lst = by_pair.setdefault(xy, [])
            if svm not in lst:
                lst.append(svm)
    for (x, y), svms in by_pair.items():
        if len(svms) == 1:
            lab = label_of(svms[0])
        else:
            lab = wrap(', '.join(v.split('.', 1)[1] + '()' for v in svms), 40)
        val = next((t[4] for t in trs if t[5] in svms and t[4].startswith('?')), '')
        out.append(f'  {x} --> {y} : ' + ('substitui: ' if presence and x == y else '') + lab
                   + (f'\\n({val[1:]})' if val else ''))
    out.append('}')
    if not presence:
        cap = fld[0].upper() + fld[1:]
        qs = sorted({m.name for r, (e, db) in M.REPOS.items() if e == ent for m in M.TYPES[r].methods
                     if re.search(cap + r'(True|False)', m.name)})
        if qs:
            out.append(f'note bottom of {comp}\n  Consultas que filtram por {fld}:\n  '
                       + '\n  '.join(esc(q, 70) for q in qs[:5]) + ('\n  …' if len(qs) > 5 else '') + '\nend note')
    return out


def _flag_targets(text, ents=None, title=''):
    """(entidade, campo, inicial, presença?) dos booleanos e campos de artefato que o texto cita e o código muda."""
    out = []
    for e in (ents or M.ENTITIES):
        e_c = _cited(e, text) or _cited(M.table_of(e) or '§', text)
        for f, t, r, init in M.entity_fields(e):
            if r is not None:
                continue
            boolean = t in ('boolean', 'Boolean')
            presence = f in M.PRESENCE_FIELD_NAMES
            if not (boolean or presence):
                continue
            f_c = _cited(f, text) or (presence and _cited(_snake(f), text))
            trs = [x for x in M.TRANSITIONS if x[0] == e and x[1] == f]
            if not trs or not f_c:
                continue
            # a entidade (ou a tabela) tem de aparecer no texto; campo de artefato também vale se o título o nomeia
            if not (e_c or (presence and title and (_cited(f, title) or _cited(_snake(f), title)))):
                continue
            in_title = bool(title) and (_cited(f, title) or _cited(_snake(f), title))
            out.append((len(trs) + 12 * e_c + 20 * in_title, e, f, init, presence))
    out.sort(key=lambda x: -x[0])
    return out


def flag_states(sc, name, text):
    """Máquina de estados de booleanos/campos de artefato citados pelo diagrama do time (ex.: Comment.active;
    mannequinImageUrl da peça e do esquema)."""
    tg = _flag_targets(text, title=sc.title or '')
    if not tg:
        return None
    main = tg[0]
    # o mesmo campo em outras entidades e outros campos citados das mesmas entidades (até 3 regiões)
    chosen = [main] + [x for x in tg[1:] if x[2] == main[2] or x[1] == main[1]]
    chosen = chosen[:3]
    ttl = _rf_prefix(sc) + 'ciclo de vida de ' + ', '.join(f'{e}.{f}' for _, e, f, _, _ in chosen)
    kinds = sorted({'campo de artefato (vazio/preenchido)' if p else 'campo booleano' for *_, p in chosen})
    out = [header(name, ttl, 'máquina de estados', ' · '.join(kinds) + ' · tabela '
                  + ', '.join(dict.fromkeys(M.table_of(e) for _, e, *_ in chosen)))]
    for _, e, f, init, p in chosen:
        out += _flag_region(e, f, init, f'B_{alias(e)}_{alias(f)}', presence=p)
    out.append('@enduml')
    return '\n'.join(out)


def threshold_states(sc, name, text):
    """Enum com limiar numérico (ex.: FaiPointsService.Level, STUDIO(300, ...)): um estado por valor, setas na ordem
    dos limiares e o método que sobe de nível."""
    best = None
    for en in M.ENUMS:
        th = M.enum_thresholds(en)
        if not th:
            continue
        hits = sum(1 for v in M.ENUMS[en] if _cited(v, text))
        if hits >= 2:
            score = hits + (5 if _cited(en, text) else 0)
            if best is None or score > best[0]:
                best = (score, en, th)
    if best is None:
        return None
    _, en, (vals, var) = best
    t = M.TYPES[en]
    full = f'{t.outer}.{en}' if t.outer else en
    up = M.level_up(en)
    out = [header(name, _rf_prefix(sc) + f'{full}: níveis por limiar de {var}', 'máquina de estados',
                  f'enum {full} · {len(vals)} níveis · ' + (f'sobe em {up[0]}.{up[1]}()' if up else 'calculado'))]
    comp = f'N_{alias(en)}'
    out.append(f'state "{full} ({var})" as {comp} {{')
    for v, (n, desc) in vals.items():
        num = f'{n:,}'.replace(',', '.')
        out.append(f'  state "{v}\\n{var} ≥ {num}" as {alias(v)}')
        if desc:
            out.append(f'  {alias(v)} : {wrap(desc, 38)}')
    out.append('}')
    names = list(vals)
    out.append(f'[*] --> {alias(names[0])} : {var} = 0')
    for a, b in zip(names, names[1:]):
        lab = (f'{up[1]}()\\n' if up else '') + f'{var} ≥ {vals[b][0]:,}'.replace(',', '.')
        out.append(f'{alias(a)} --> {alias(b)} : {lab}')
    if up:
        cls, meth, notif, sets = up
        eff = []
        if sets:
            eff.append('grava o nível novo (' + ', '.join(f'{x}()' for x in sets) + ')')
        if notif:
            eff.append('notifica ' + ', '.join(notif))
        out.append(f'note right of {comp}\n  {cls}.{meth}() calcula o nível antes e depois do crédito\n'
                   f'  e só age quando after.ordinal() > before.ordinal():\n  ' + '\n  '.join(eff or ['—'])
                   + '\n  Não há caminho no código que desça de nível.\nend note')
    # o que conta para a variável comparada (ex.: FaiPointsLedgerEntry.countsLifetime)
    cnt = [(e, f) for e in M.ENTITIES for f, _ in M.bool_fields(e) if var.lower() in f.lower()]
    for e, f in cnt[:1]:
        trs = [x for x in M.TRANSITIONS if x[0] == e and x[1] == f]
        yes = sorted({x[5].split('.', 1)[1] + '()' for x in trs if x[4] == 'true'})
        no = sorted({x[5].split('.', 1)[1] + '()' for x in trs if x[4] == 'false'})
        if yes or no:
            out.append(f'note bottom of {comp}\n  {var} soma só os lançamentos com {e}.{f} = true\n'
                       + (f'  conta: {esc(", ".join(yes), 70)}\n' if yes else '')
                       + (f'  não conta: {esc(", ".join(no), 70)}\n' if no else '') + 'end note')
    out.append('@enduml')
    return '\n'.join(out)


def bands_states(sc, name, text):
    """Faixas declaradas no código (record (min, max, rótulo) numa lista, ex.: InventoryScoreService.BANDS), com a
    elegibilidade (boolean eligible = n >= MIN_PIECES) e, se o time citou, os booleanos das entidades envolvidas."""
    up_text = ' ' + _up(text) + ' '
    best = None
    for owner, b in M.SCORE_BANDS.items():
        hits = sum(1 for _, _, lb in b['bands'] if f' {_up(lb)} ' in up_text)
        score = hits + (10 if _cited(owner, text) else 0)
        if (hits >= 3 or (hits >= 2 and _cited(owner, text))) and (best is None or score > best[0]):
            best = (score, owner, b)
    if best is None:
        return None
    _, owner, b = best
    var = b['var']
    calc = M.method_containing(owner, r'boolean\s+\w+\s*=\s*\w+\s*>=') or M.method_containing(owner, b['field'])
    eps = _callers_deep(owner, calc) if calc else []
    out = [header(name, _rf_prefix(sc) + f'{owner}: elegibilidade e faixas de {var}', 'máquina de estados',
                  f'{owner}.{b["field"]} · {len(b["bands"])} faixas' + (f' · calculado em {calc}()' if calc else ''))]
    el = b['eligible']
    inner_prefix = ''
    if el:
        flag, cnt, const, n = el
        out.append(f'state "Inelegível\\n{flag} = false ({cnt} < {n})" as INELEGIVEL')
        out.append(f'state "Elegível — {flag} = true ({cnt} ≥ {const} = {n})" as ELEGIVEL {{')
        inner_prefix = '  '
    else:
        out.append(f'state "{owner}.{b["field"]}" as ELEGIVEL {{')
        inner_prefix = '  '
    keys = []
    for i, (lo, hi, lb) in enumerate(b['bands']):
        k = f'F{i}'
        keys.append(k)
        out.append(f'{inner_prefix}state "{esc(lb, 30)}\\n{var} {lo}–{hi}" as {k}')
    out.append(f'{inner_prefix}[*] --> {keys[0]}')
    for i in range(1, len(keys)):
        out.append(f'{inner_prefix}{keys[i - 1]} --> {keys[i]} : {var} ≥ {b["bands"][i][0]}')
    out.append('}')
    trig = (f'{calc}()' if calc else 'recálculo') + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
    if el:
        flag, cnt, const, n = el
        out.append(f'[*] --> INELEGIVEL')
        out.append(f'INELEGIVEL --> ELEGIVEL : {trig}\\n{cnt} ≥ {n}')
        out.append(f'ELEGIVEL --> INELEGIVEL : {calc + "()" if calc else "recálculo"}\\n{cnt} < {n}')
    out.append(f'note right of ELEGIVEL\n  A cada cálculo a faixa é a que contém o {var}\n  (sobe ou desce com o recálculo);'
               f'\n  as setas mostram a ordem crescente.\nend note')
    # booleanos citados das entidades envolvidas (ex.: RankingOptIn.optedIn, opt-in dos rankings)
    for _, e, f, init, p in _flag_targets(text)[:2]:
        if not p:
            out += _flag_region(e, f, init, f'B_{alias(e)}_{alias(f)}')
    out.append('@enduml')
    return '\n'.join(out)


def _callers_deep(svc, meth):
    """Rotas que chamam o método direto ou por um método público do mesmo serviço."""
    eps = list(callers_of(svc, meth))
    t = M.TYPES.get(svc)
    if t is not None and not eps:
        src = M.src_of(t)
        for m in t.methods:
            if m.node is not None and m.name != meth and re.search(r'\b' + re.escape(meth) + r'\(', M._text(m.node, src)):
                eps += callers_of(svc, m.name)
    return list(dict.fromkeys(eps))


def classifier_states(sc, name, text):
    """Estado calculado por um método classificador (ex.: WardrobeCreatorService.availability → EM_BREVE, ESGOTADO…;
    RoomService.statesOf → ESQUECIDA, FAVORITA…), quando o diagrama do time cita o método ou ao menos 3 rótulos."""
    best = None
    for svc, t in M.TYPES.items():
        if t.module != 'application' or t.kind != 'class':
            continue
        svc_c = _cited(svc, text)
        for m in t.methods:
            named = _cited(f'{svc}.{m.name}', sc.title or '')
            if not (named or svc_c):
                continue
            cl = M.classifier(svc, m.name)
            if not cl:
                continue
            hits = sum(1 for lb in {r[1] for r in cl[0]} if _cited(lb, text))
            if not (named or (svc_c and hits >= 3)):
                continue
            score = hits + 10 * named
            if best is None or score > best[0]:
                best = (score, svc, m.name, cl)
    if best is None:
        return None
    _, svc, meth, (rules, exclusive) = best
    eps = _callers_deep(svc, meth)
    out = [header(name, _rf_prefix(sc) + f'{svc}.{meth}(): estado calculado', 'máquina de estados',
                  ('rótulo único: vale a primeira regra verdadeira' if exclusive else 'marcadores acumuláveis')
                  + f' · {len(rules)} regras no código')]
    comp = f'C_{alias(meth)}'
    out.append(f'state "{svc}.{meth}()" as {comp} {{')
    out.append(f'  state {comp}_avaliar <<choice>>')
    labels = list(dict.fromkeys(r[1] for r in rules))
    for lb in labels:
        out.append(f'  state "{lb}" as {comp}_{alias(lb)}')
    out.append('}')
    trig = 'cada leitura' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
    out.append(f'[*] --> {comp}_avaliar : {trig}')
    for i, (cond, lb) in enumerate(rules, 1):
        c = cond if cond in ('caso contrário', 'senão') else wrap(cond, 40)
        out.append(f'{comp}_avaliar --> {comp}_{alias(lb)} : [{i}] {c}')
    note = ('O estado não é gravado: é recalculado a cada leitura.\n  Vale a primeira regra verdadeira, na ordem do código.'
            if exclusive else 'Os marcadores não são gravados nem exclusivos:\n  cada regra verdadeira acrescenta o seu.')
    out.append(f'note right of {comp}\n  {note}\nend note')
    out.append('@enduml')
    return '\n'.join(out)


def threshold_flag_states(sc, name, text, strict=False):
    """Flag calculada por limiar numa classe citada (ex.: ExplorerService.globalPanel: sufficient = total >= MIN_DATA).
    strict: só quando o título do diagrama nomeia Classe.método."""
    for svc, t in M.TYPES.items():
        if t.module != 'application' or not _cited(svc, text):
            continue
        for flag, var, const, n, meth in M.threshold_flags(svc):
            if not _cited(flag, text) or (strict and not _cited(f'{svc}.{meth}', sc.title or '')):
                continue
            eps = _callers_deep(svc, meth)
            out = [header(name, _rf_prefix(sc) + f'{svc}.{meth}(): {flag} por limiar', 'máquina de estados',
                          f'{flag} = {var} ≥ {const} ({n}) · recalculado a cada chamada')]
            comp = f'T_{alias(flag)}'
            out.append(f'state "{svc}.{meth}() — {flag}" as {comp} {{')
            out.append(f'  state "{flag} = false\\n{var} < {n}" as {comp}_F')
            out.append(f'  state "{flag} = true\\n{var} ≥ {n} ({const})" as {comp}_T')
            out.append('}')
            trig = f'{meth}()' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
            out.append(f'[*] --> {comp}_F : {trig}')
            out.append(f'{comp}_F --> {comp}_T : {var} chega a {n}')
            out.append(f'{comp}_T --> {comp}_F : {var} cai abaixo de {n}')
            out.append(f'note right of {comp}\n  Não é gravado: {meth}() recalcula a cada chamada\n  (por isso pode voltar a false).\nend note')
            out.append('@enduml')
            return '\n'.join(out)
    return None


DERIVED_STATES = (bands_states, threshold_states, classifier_states,
                  lambda sc, n, t: threshold_flag_states(sc, n, t, strict=True))


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
                  f'  contra o código em {TODAY}.\nendlegend\n')
        text = re.sub(r'(?m)^@enduml\s*$', legend + '@enduml', text, count=1)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(text)


def run(only=None, dry=False, saida=None):
    report = []
    for sc in E.all_scopes():
        if only and sc.key.split('/')[0] not in only and sc.key not in only:
            continue
        for f in sc.old_files:
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
        TODAY = a.data
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
