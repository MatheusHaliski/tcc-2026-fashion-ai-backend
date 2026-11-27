"""O que cada diagrama por RF mostra primeiro: o fluxo principal do RF (tabela PRINCIPAL, conferida à mão), a
ordem das rotas e se a pasta prefere o modo por unidades de código."""
from __future__ import annotations

import re

import escopo as E
from gerar_consultas import steps_for, summary_label


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
    'RF45': 'WardrobeStudioController.studioPiece', 'RF46': 'BackgroundController.art', 'RF47': 'CatalogController.search',
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
