"""Bloco 3 — RF25 e RF27–RF39 (numeração do Trello)."""
import os
import datetime
from harness import step, sql, SCR

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
IMG = open(os.path.join(FIX, 'p1.jpg'), 'rb').read()
LOGO = open(os.path.join(FIX, 'b10_logo.png'), 'rb').read()
ART = open(os.path.join(FIX, 'b10_art.jpg'), 'rb').read()
JPG = lambda b=IMG: {'file': ('foto.jpg', b, 'image/jpeg')}
ADMIN, BRAND, CELEB, USER2, USER3 = 'demo_matheus3', 'atelier_lume3', 'luna_vega', 'ny_ava', 'paris_lea'
import zoneinfo
TODAY = datetime.datetime.now(zoneinfo.ZoneInfo('America/Sao_Paulo')).date().isoformat()
iso = lambda d: (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=d)).strftime('%Y-%m-%dT%H:%M:%SZ')


def run(C):
    U = C['U']
    # ================= RF25 selos e promoções
    step('RF25', 'CA03', 'catálogo do criador de selo', 'GET', '/api/seals/design-catalog', who=BRAND, ctx=C)
    step('RF25', 'CA03', 'enviar arte do selo', 'POST', '/api/seals/uploads', files={'file': ('selo.png', LOGO, 'image/png')}, who=BRAND, ctx=C,
         save=lambda c, b: c.__setitem__('seal_icon', b.get('url')))
    step('RF25', 'CA02', 'criar selo (com janela de validade)', 'POST', '/api/seals', who=BRAND, ctx=C,
         body=lambda c: dict(name='Selo E2E', tier='LOOK', policyText='Looks com linho e tons de terra.', iconUrl=c.get('seal_icon'), availableFrom=iso(-1), availableUntil=iso(90), usageLimit=50, status='ACTIVE'),
         save=lambda c, b: c.__setitem__('seal', b['id']))
    step('RF25', 'CA04', 'editar selo (expira em)', 'PUT', '/api/seals/{seal}', who=BRAND, ctx=C,
         body=lambda c: dict(name='Selo E2E', tier='LOOK', policyText='Looks com linho e tons de terra (editado).', availableFrom=iso(-1), availableUntil=iso(120), usageLimit=60, status='ACTIVE'))
    step('RF25', 'CA04', 'janela invertida é recusada', 'PUT', '/api/seals/{seal}', who=BRAND, ctx=C, expect=(400,),
         body=lambda c: dict(name='Selo E2E', tier='LOOK', policyText='x', availableFrom=iso(10), availableUntil=iso(5), status='ACTIVE'))
    step('RF25', 'CA05', 'selos do perfil (lista pública)', 'GET', '/api/users/{brand_id}/seals', who=U, ctx=C)
    step('RF25', 'CA06', 'criar promoção do selo (link da loja)', 'POST', '/api/promotions', who=BRAND, ctx=C,
         body=lambda c: dict(type='DESCONTO_ECOMMERCE', title='15% E2E', description='cupom de teste', rules='1 por pessoa', discountPercent=15, sealId=c['seal'],
                             startsAt=iso(-1), expiresAt=iso(60), totalQuota=100, perUserLimit=1, visibility='PUBLIC', storeUrl='https://example.com/loja'),
         save=lambda c, b: c.__setitem__('promo', b['id']))
    step('RF25', 'CA06', 'editar promoção', 'PUT', '/api/promotions/{promo}', who=BRAND, ctx=C,
         body=lambda c: dict(type='DESCONTO_ECOMMERCE', title='20% E2E', description='cupom de teste', rules='1 por pessoa', discountPercent=20, sealId=c['seal'],
                             startsAt=iso(-1), expiresAt=iso(60), totalQuota=100, perUserLimit=1, visibility='PUBLIC', storeUrl='https://example.com/loja'))
    step('RF25', 'CA06', 'desativar e reativar promoção', 'PUT', '/api/promotions/{promo}/status', {'status': 'REVOKED'}, who=BRAND, ctx=C)
    step('RF25', 'CA06', 'reativar promoção', 'PUT', '/api/promotions/{promo}/status', {'status': 'AVAILABLE'}, who=BRAND, ctx=C)
    step('RF25', 'CA06', 'promoções do perfil', 'GET', '/api/users/{brand_id}/promotions', who=U, ctx=C)
    step('RF25', 'CA07', 'resgatar promoção sem selo aprovado (deve recusar)', 'POST', '/api/promotions/{promo}/redemptions', who=USER3, ctx=C, expect=(403, 409, 422))
    step('RF25', 'CA08', 'métricas do emissor', 'GET', '/api/me/issuer-metrics', who=BRAND, ctx=C)

    # ================= RF27 Meu Quarto
    step('RF27', 'CA01', 'meu quarto (módulos, endereços, estados)', 'GET', '/api/me/room', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('room_mod', next((m['id'] for m in b['modules'] if m['id'].startswith('door')), 'door:1')))
    step('RF27', 'CA02', 'abrir porta/gaveta', 'GET', '/api/me/room/modules/{room_mod}', who=U, ctx=C)
    step('RF27', 'CA03', 'visão em lista', 'GET', '/api/me/room/list', who=U, ctx=C)
    step('RF27', 'CA04', 'endereço da peça no quarto', 'PUT', '/api/pieces/{p_top}/room-address', {'address': 'door:2/hanger:1'}, who=U, ctx=C)
    step('RF27', 'CA04', 'onde está a peça', 'GET', '/api/pieces/{p_top}/room-location', who=U, ctx=C)
    step('RF27', 'CA05', 'renomear gaveta', 'PUT', '/api/me/room/drawers/3', {'label': 'Gaveta E2E'}, who=U, ctx=C)
    step('RF27', 'CA06', 'etiqueta costurada da peça', 'GET', '/api/pieces/{p_top}/tag', who=U, ctx=C)
    step('RF27', 'CA06', 'diário de uso da peça', 'POST', '/api/pieces/{p_top}/diary', {'date': TODAY, 'occasion': 'casual', 'note': 'usei no teste E2E'}, who=U, ctx=C)
    step('RF27', 'CA07', 'baú de estação exige nível Penthouse (nível Estreia é recusado)', 'POST', '/api/me/room/season-storage', body=lambda c: {'pieceIds': [c['p_dress']], 'store': True}, who=U, ctx=C, expect=(409,))
    step('RF27', 'CA08', 'prévia da organização automática (IA opt-in)', 'GET', '/api/me/room/organization/preview?useAi=true', who=U, ctx=C, save=lambda c, b: c.__setitem__('org', b))
    step('RF27', 'CA08', 'aplicar organização', 'POST', '/api/me/room/organization', who=U, ctx=C,
         body=lambda c: {'labels': (c.get('org') or {}).get('labels') or {}, 'moves': (c.get('org') or {}).get('moves') or []})
    step('RF27', 'CA08', 'desfazer organização', 'DELETE', '/api/me/room/organization', who=U, ctx=C)
    step('RF27', 'CA09', 'monograma do quarto (Studio+)', 'PUT', '/api/me/room/monogram', {'initials': 'E2'}, who=ADMIN, ctx=C)
    step('RF27', 'CA11', 'ilha central (Atelier+) — nível insuficiente recusa', 'POST', '/api/me/room/island', body=lambda c: {'schemeIds': [c['s1']]}, who=U, ctx=C, expect=(200, 403, 409))
    step('RF27', 'CA12', 'dar a chave do quarto a um seguidor', 'POST', '/api/me/room/keys', body=lambda c: {'guestId': c['user2_id']}, who=U, ctx=C, expect=(200, 201, 403, 409))
    step('RF27', 'CA12', 'visitar o quarto de alguém (com chave)', 'GET', '/api/users/{e2e_id}/room-tour', who=USER2, ctx=C, expect=(200, 403))
    step('RF30', 'CA06', 'luz guiada (Studio+)', 'PUT', '/api/me/room/light', {'kelvin': 3200}, who=ADMIN, ctx=C)

    # ================= RF28 Smart Mirror + Vista-me
    step('RF28', 'CA01', 'estado do espelho', 'GET', '/api/me/mirror', who=U, ctx=C)
    step('RF28', 'CA02', 'vestir uma peça', 'POST', '/api/me/mirror/pieces', body=lambda c: {'pieceId': c['p_top']}, who=U, ctx=C)
    step('RF28', 'CA03', 'sugestões para o slot', 'GET', '/api/me/mirror/suggestions?slot=lower', who=U, ctx=C)
    step('RF28', 'CA02', 'tirar a peça', 'DELETE', '/api/me/mirror/pieces/{p_top}', who=U, ctx=C)
    step('RF28', 'CA04', 'Vista-me (pedido em linguagem natural)', 'POST', '/api/me/mirror/vista-me', {'prompt': 'algo leve para passear no sábado', 'keepMirror': False}, who=U, ctx=C)
    step('RF28', 'CA08', 'outro look com o mesmo pedido', 'POST', '/api/me/mirror/another', who=U, ctx=C)
    step('RF28', 'CA08', 'trocar só o calçado', 'POST', '/api/me/mirror/slots/shoes/swap', who=U, ctx=C, expect=(200, 409))
    step('RF28', 'CA09', 'tira uma coisa', 'POST', '/api/me/mirror/take-one-off', who=U, ctx=C, expect=(200, 409))
    step('RF28', 'CA12', 'storyboard GRWM', 'GET', '/api/me/mirror/grwm', who=U, ctx=C)
    step('RF28', 'CA11', 'salvar o look do espelho como esquema', 'POST', '/api/me/mirror/save', {'title': 'Espelho E2E', 'publish': False}, who=U, ctx=C)
    step('RF28', 'CA02', 'vestir de novo para usar', 'POST', '/api/me/mirror/vista-me', {'prompt': 'look para o trabalho', 'keepMirror': False}, who=U, ctx=C)
    step('RF28', 'CA10', 'usar o look hoje (Look do Dia + diário)', 'POST', '/api/me/mirror/use', who=U, ctx=C)
    step('RF28', 'CA11', 'levar ao editor de esquemas', 'POST', '/api/me/mirror/draft', {'origin': 'MIRROR'}, who=U, ctx=C)
    step('RF28', 'CA01', 'limpar o espelho', 'DELETE', '/api/me/mirror', who=U, ctx=C)

    # ================= RF29 Inventory Score
    step('RF29', 'CA01', 'destaques e Inventory Score', 'GET', '/api/me/highlights', who=ADMIN, ctx=C)
    step('RF29', 'CA02', 'progresso sem nota parcial (menos de 10 peças)', 'GET', '/api/me/highlights', who=U, ctx=C)
    step('RF29', 'CA03', 'explicar uma dimensão', 'GET', '/api/me/inventory-score/dimensions/V', who=ADMIN, ctx=C)
    step('RF29', 'CA04', 'dicas para melhorar', 'GET', '/api/me/inventory-score/hints', who=ADMIN, ctx=C)
    step('RF29', 'CA05', 'como o score é calculado', 'GET', '/api/inventory-score/method', ctx=C)
    step('RF29', 'CA06', 'álbum de snapshots', 'GET', '/api/me/album', who=ADMIN, ctx=C)
    step('RF29', 'CA07', 'retrospectiva anual', 'GET', f'/api/me/retrospective/{datetime.date.today().year}', who=ADMIN, ctx=C)
    step('RF29', 'CA08', 'entrar nos rankings (opt-in)', 'PUT', '/api/me/rankings/opt-in', {'optedIn': True, 'shareCity': False}, who=ADMIN, ctx=C)
    step('RF29', 'CA08', 'minha posição nos rankings', 'GET', '/api/me/rankings', who=ADMIN, ctx=C)

    # ================= RF30 FAI Points, loja e montagem
    step('RF30', 'CA01', 'saldo, nível e extrato', 'GET', '/api/me/points', who=U, ctx=C)
    step('RF30', 'CA02', 'conquistas', 'GET', '/api/me/achievements', who=U, ctx=C)
    step('RF30', 'CA03', 'loja do quarto', 'GET', '/api/points/shop', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('free_sku', next(x['sku'] for x in b if x['pricePoints'] == 0 and x['kind'] == 'COMPONENT' and x['slotType'] == 'DOOR' and x['levelOk'])))
    step('RF30', 'CA03', 'provar no quarto (prévia sem compra)', 'POST', '/api/points/shop/{free_sku}/try-on', {'moduleId': 'door:1'}, who=U, ctx=C)
    step('RF30', 'CA04', 'comprar com FAI Points', 'POST', '/api/points/shop/{free_sku}/purchase', who=U, ctx=C, save=lambda c, b: c.__setitem__('inv', b['inventoryId']))
    step('RF30', 'CA05', 'montar o item num módulo', 'POST', '/api/me/room-inventory/{inv}/apply', {'moduleId': 'door:1'}, who=U, ctx=C)
    step('RF30', 'CA05', 'módulo incompatível é recusado', 'POST', '/api/me/room-inventory/{inv}/apply', {'moduleId': 'rug'}, who=U, ctx=C, expect=(400, 409))

    # ================= RF31 já coberto no bloco 1 (flags); aqui o reflexo no quarto
    step('RF31', 'CA05', 'peça indisponível aparece no cesto do quarto', 'GET', '/api/me/room', who=U, ctx=C)

    # ================= RF32 desafios
    # limpeza (fora da tabela): o convidado sai dos desafios ativos de execuções anteriores (limite de 3 ativos)
    from harness import http as _h, login as _l
    _s, _b, _ = _h('GET', '/api/me/challenges', None, _l(USER2))
    for _c in (_b.get('active') or []) + (_b.get('waiting') or []):
        _h('POST', f"/api/challenges/{_c['id']}/leave", None, _l(USER2))
        _h('POST', f"/api/challenges/{_c['id']}/decline", None, _l(USER2))
    step('RF32', 'CA01', 'catálogo de desafios', 'GET', '/api/challenges/catalog', who=U, ctx=C)
    step('RF32', 'CA02', 'iniciar duelo (Runway Battle)', 'POST', '/api/challenges', body=lambda c: {'code': 'RUNWAY_BATTLE', 'mode': 'DUELO', 'invitees': [c['user2_id']], 'photoConsent': True}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('ch1', (b.get('challenge') or b)['id']))
    step('RF32', 'CA03', 'convidado aceita', 'POST', '/api/challenges/{ch1}/accept', {'photoConsent': True}, who=USER2, ctx=C)
    step('RF32', 'CA02', 'começar agora', 'POST', '/api/challenges/{ch1}/start', who=U, ctx=C, expect=(200, 409))
    step('RF32', 'CA04', 'detalhe do desafio', 'GET', '/api/challenges/{ch1}', who=U, ctx=C)
    step('RF32', 'CA05', 'enviar look como entrada', 'POST', '/api/challenges/{ch1}/entries', body=lambda c: {'schemeId': c['s1']}, who=U, ctx=C)
    step('RF32', 'CA06', 'feed de votação', 'GET', '/api/challenges/votes', who=USER3, ctx=C)
    step('RF32', 'CA06', 'votar numa entrada', 'POST', '/api/challenges/{ch1}/votes', body=lambda c: {'entrySchemeId': c['s1']}, who=USER3, ctx=C, expect=(200, 201, 403, 409))
    step('RF32', 'CA07', 'recado no mural', 'POST', '/api/challenges/{ch1}/notes', {'preset': 'Arrasou no look!'}, who=USER2, ctx=C)
    step('RF32', 'CA07', 'reagir com emoji', 'POST', '/api/challenges/{ch1}/reactions', {'emoji': '🔥'}, who=USER2, ctx=C)
    step('RF32', 'CA09', 'card de resultado', 'GET', '/api/challenges/{ch1}/result-card', who=U, ctx=C)
    # Espelho de Verdade: janela diária de 30 min (09h–21h, Brasília) derivada do id do desafio (ChallengeService.windowStart)
    def java_hash(txt):
        h = 0
        for ch in txt:
            h = (31 * h + ord(ch)) & 0xFFFFFFFF
        return h - (1 << 32) if h >= (1 << 31) else h
    def in_window(cid):
        import zoneinfo
        now = datetime.datetime.now(zoneinfo.ZoneInfo('America/Sao_Paulo'))
        day = now.date()
        h = abs(java_hash(cid + day.isoformat()))
        start = datetime.datetime.combine(day, datetime.time(0, 0), tzinfo=now.tzinfo) + datetime.timedelta(minutes=9 * 60 + h % (12 * 60))
        return start <= now <= start + datetime.timedelta(minutes=30), start
    for attempt in range(80):
        s_, b_ = step('RF32', 'CA08', 'desafio Espelho de Verdade em equipe', 'POST', '/api/challenges',
                      body=lambda c: {'code': 'REAL_MIRROR', 'mode': 'EQUIPE', 'invitees': [c['user2_id']], 'photoConsent': True}, who=U, ctx=C,
                      save=lambda c, b: c.__setitem__('ch2', (b.get('challenge') or b)['id']))
        ok, start = in_window(C['ch2'])
        if ok:
            C['ch2_window'] = start.strftime('%H:%M')
            break
        # janela de hoje não cobre agora: cancela e tenta outro id (cada desafio tem a sua janela)
        from harness import http, login
        http('POST', f"/api/challenges/{C['ch2']}/cancel", None, login(U))
        from harness import RESULTS
        RESULTS.pop()          # só a tentativa que vale entra na tabela
    step('RF32', 'CA03', 'convidado aceita (equipe)', 'POST', '/api/challenges/{ch2}/accept', {'photoConsent': True}, who=USER2, ctx=C)
    step('RF32', 'CA08', 'foto no espelho real dentro da janela do dia', 'POST', '/api/challenges/{ch2}/real-mirror', files=JPG(), who=U, ctx=C)
    step('RF32', 'CA08', 'outro participante confirma a evidência', 'POST', '/api/challenges/{ch2}/real-mirror/confirmations', body=lambda c: {'memberId': c['e2e_id'], 'day': TODAY}, who=USER2, ctx=C)
    step('RF32', 'CA02', 'rascunho de desafio (GRWM)', 'POST', '/api/challenges', {'code': 'GRWM', 'mode': 'SOLO', 'draft': True}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('ch3', (b.get('challenge') or b)['id']))
    step('RF32', 'CA02', 'lançar o rascunho', 'POST', '/api/challenges/{ch3}/launch', {'invitees': []}, who=U, ctx=C)
    step('RF32', 'CA02', 'cancelar (criador)', 'POST', '/api/challenges/{ch3}/cancel', who=U, ctx=C)
    step('RF32', 'CA03', 'sair do desafio', 'POST', '/api/challenges/{ch2}/leave', who=USER2, ctx=C)
    step('RF32', 'CA03', 'recusar convite', 'POST', '/api/challenges/{ch1}/decline', who=USER3, ctx=C, expect=(200, 403, 404, 409))
    step('RF32', 'CA04', 'meus desafios', 'GET', '/api/me/challenges', who=U, ctx=C)
    step('RF32', 'CA10', 'propor um desafio à comunidade', 'POST', '/api/challenges/proposals',
         {'name': 'Desafio E2E', 'blocks': [{'type': 'category', 'value': 'upper_piece'}], 'modes': ['SOLO'], 'durationDays': 7}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('proposal', b.get('code') or b.get('id')))
    step('RF32', 'CA10', 'admin promove a proposta ao catálogo', 'POST', '/api/admin/challenges/{proposal}/promotion', who=ADMIN, ctx=C)

    # ================= RF33 Passarela 3D
    for q in ('ranking=TOP100_GLOBAL&limit=12', 'ranking=TOP100_REGIONAL&region=EUROPA', 'ranking=TOP100_PAIS&country=BR', 'ranking=SEGUINDO',
              'ranking=EM_ALTA&colors=black', 'ranking=RECENTES&limit=5&offset=5', 'ranking=TOP100_GLOBAL&occasions=casual&styles=streetwear&sex=FEMININO'):
        step('RF33', 'CA10–12', f'passarela: {q}', 'GET', '/api/explorer/runway?' + q, who=U, ctx=C)
    step('RF33', 'CA12', 'ranking inválido é recusado', 'GET', '/api/explorer/runway?ranking=XYZ', who=U, ctx=C, expect=(400,))

    # ================= RF34 / RF35 Eras e Coleções
    step('RF34', 'CA02', 'eras da celebridade', 'GET', '/api/institutional/luna-vega/showcase/eras', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('era', ((b.get('groupings') or b.get('items') or [{}])[0]).get('id')))
    step('RF34', 'CA02', 'busca por era, texto e ano', 'GET', '/api/institutional/luna-vega/showcase/eras/items?q=neon', who=U, ctx=C)
    step('RF34', 'CA04', 'Insights de Eras', 'GET', '/api/institutional/luna-vega/showcase/eras/insights', who=U, ctx=C)
    step('RF34', 'CA06', 'My Stage 3D', 'GET', '/api/institutional/luna-vega/stage', who=U, ctx=C)
    step('RF34', 'CA01', 'celebridade cria uma era', 'POST', '/api/groupings', {'type': 'ERA', 'label': 'Era E2E', 'description': 'era de teste', 'periodFrom': 2026, 'periodTo': 2026, 'accentColor': '#5B6CFF'}, who=CELEB, ctx=C,
         save=lambda c, b: c.__setitem__('era_new', b['id']))
    step('RF34', 'CA03', 'foto da era', 'POST', '/api/groupings/{era_new}/cover', files=JPG(ART), who=CELEB, ctx=C)
    step('RF34', 'CA08', 'visitante não edita a era', 'PUT', '/api/groupings/{era_new}', {'type': 'ERA', 'label': 'invasão'}, who=U, ctx=C, expect=(403, 404))
    step('RF34', 'CA01', 'excluir a era de teste', 'DELETE', '/api/groupings/{era_new}', who=CELEB, ctx=C)
    step('RF35', 'CA02', 'coleções da marca', 'GET', '/api/institutional/atelier-lume-3/showcase/collections', who=U, ctx=C)
    step('RF35', 'CA02', 'busca por coleção', 'GET', '/api/institutional/atelier-lume-3/showcase/collections/items?q=linho', who=U, ctx=C)
    step('RF35', 'CA04', 'Collections Insights (mini lojas 3D)', 'GET', '/api/institutional/atelier-lume-3/showcase/collections/insights', who=U, ctx=C)
    step('RF35', 'CA01', 'marca cria uma coleção', 'POST', '/api/groupings', {'type': 'COLLECTION', 'label': 'Coleção E2E', 'periodFrom': 2026}, who=BRAND, ctx=C,
         save=lambda c, b: c.__setitem__('col_new', b['id']))
    step('RF35', 'CA03', 'arte da coleção', 'POST', '/api/groupings/{col_new}/cover', files=JPG(ART), who=BRAND, ctx=C)
    step('RF35', 'CA01', 'excluir a coleção de teste', 'DELETE', '/api/groupings/{col_new}', who=BRAND, ctx=C)
    step('RF34', 'CA05', 'aba de era inválida é recusada', 'GET', '/api/institutional/atelier-lume-3/showcase/eras', who=U, ctx=C, expect=(400, 404))

    # ================= RF36 Foto com meu manequim
    step('RF36', 'CA02', 'peça no manequim (look 3D)', 'GET', '/api/pieces/{p_top}/look3d', who=U, ctx=C)
    step('RF36', 'CA02', 'look inteiro no manequim', 'GET', '/api/schemes/{s1}/look3d', who=U, ctx=C)
    step('RF36', 'CA05', 'pedir 3D das peças do esquema (RF16)', 'POST', '/api/schemes/{s1}/model3d', who=U, ctx=C)
    step('RF36', 'CA06', 'salvar foto com manequim da peça', 'POST', '/api/pieces/{p_top}/mannequin-photo', files={'file': ('m.png', LOGO, 'image/png')}, who=U, ctx=C)
    step('RF36', 'CA06', 'salvar foto do look como capa', 'POST', '/api/schemes/{s1}/mannequin-photo?asCover=true', files={'file': ('m.png', LOGO, 'image/png')}, who=U, ctx=C)
    step('RF36', 'CA07', 'só o dono gera (outro usuário recusado)', 'POST', '/api/schemes/{s1}/mannequin-photo', files={'file': ('m.png', LOGO, 'image/png')}, who=USER2, ctx=C, expect=(403, 404))
    step('RF36', 'CA07', 'remover a foto com manequim', 'DELETE', '/api/pieces/{p_top}/mannequin-photo', who=U, ctx=C)
    step('RF36', 'CA03', 'ajuste do rosto do manequim', 'PATCH', '/api/me/profile', {'mannequinFace': {'offsetX': 0.05, 'offsetY': -0.02, 'scale': 1.1}}, who=U, ctx=C)

    # ================= RF37 FLAIR — jogador = usuário de teste recém-criado (estado limpo a cada execução)
    P = U
    step('RF37', 'CA01', 'meu perfil FLAIR', 'GET', '/api/flair/me', who=P, ctx=C)
    step('RF37', 'CA01', 'cartas e álbum', 'GET', '/api/flair/cards', who=P, ctx=C, save=lambda c, b: c.__setitem__('cards', [x['id'] for x in (b.get('cards') if isinstance(b, dict) else b)][:12]))
    step('RF37', 'CA01', 'decks', 'GET', '/api/flair/decks', who=P, ctx=C, save=lambda c, b: c.__setitem__('deck_scheme', (b[0] if isinstance(b, list) else b.get('decks', [{}])[0]).get('schemeId')))
    step('RF37', 'CA01', 'deck de um esquema', 'GET', '/api/flair/decks/{deck_scheme}', who=P, ctx=C)
    step('RF37', 'CA04', 'quests', 'GET', '/api/flair/quests', who=P, ctx=C, save=lambda c, b: c.__setitem__('quest', next((q['code'] for q in b if q.get('done') and not q.get('claimed')), (b[0]['code'] if b else 'X'))))
    step('RF37', 'CA04', 'resgatar quest', 'POST', '/api/flair/quests/{quest}/claim', who=P, ctx=C, expect=(200, 409))
    step('RF37', 'CA02', 'duelo 1×1 contra a Casa', 'POST', '/api/flair/duels', body=lambda c: {'schemeId': c['deck_scheme'], 'opponent': 'CASA'}, who=P, ctx=C)
    step('RF37', 'CA02', 'Arena do dia', 'GET', '/api/flair/arena', who=P, ctx=C)
    step('RF37', 'CA02', 'inscrever deck na Arena', 'POST', '/api/flair/arena', body=lambda c: {'schemeId': c['deck_scheme']}, who=P, ctx=C, expect=(200, 201, 409))
    step('RF37', 'CA03', 'liga de equipes', 'GET', '/api/flair/teams', who=U, ctx=C)
    step('RF37', 'CA03', 'criar equipe', 'POST', '/api/flair/teams', {'name': 'Equipe E2E', 'color': '#E9B949'}, who=U, ctx=C, save=lambda c, b: c.__setitem__('team_code', (b.get('mine') or {}).get('code')))
    step('RF37', 'CA03', 'entrar na equipe pelo código', 'POST', '/api/flair/teams/join', body=lambda c: {'code': c['team_code']}, who=CELEB, ctx=C)
    step('RF37', 'CA03', 'duelo de equipes (3×3)', 'POST', '/api/flair/teams/battles', {'code': 'ZZZZZZ'}, who=U, ctx=C, expect=(200, 404, 409))
    step('RF37', 'CA03', 'sair da equipe', 'DELETE', '/api/flair/teams/me', who=CELEB, ctx=C)
    step('RF37', 'CA03', 'última pessoa sai e encerra a equipe', 'DELETE', '/api/flair/teams/me', who=U, ctx=C)
    step('RF37', 'CA04', 'skin cosmética de carta', 'POST', '/api/flair/skins/BRAND_FRAME?activate=true', who=P, ctx=C, expect=(200, 409))
    step('RF37', 'CA05', 'catálogo dos 15 modos e 18 temas', 'GET', '/api/flair/modes', who=P, ctx=C)
    step('RF37', 'CA05', 'looks com os 10 atributos', 'GET', '/api/flair/modes/looks', who=P, ctx=C, save=lambda c, b: c.__setitem__('looks', [x['schemeId'] for x in b['looks']]))
    L = lambda n=1: (lambda c: c['looks'][:n])
    step('RF37', 'Battle', 'Battle of Looks contra @usuário e tema', 'POST', '/api/flair/modes/battle', body=lambda c: {'schemeId': c['looks'][0], 'opponent': 'paris_lea', 'theme': 'BUSINESS_MEETING'}, who=P, ctx=C)
    step('RF37', 'Squad', 'FLAIR Squad 5×5', 'POST', '/api/flair/modes/squad', {'schemeIds': [], 'opponent': 'ny_ava'}, who=P, ctx=C)
    step('RF37', 'League', 'escalação da liga', 'PUT', '/api/flair/modes/league/roster', body=lambda c: {'starters': c['looks'][:5], 'reserves': c['looks'][5:8], 'specials': []}, who=P, ctx=C)
    step('RF37', 'League', 'rodada da liga', 'POST', '/api/flair/modes/league/play', who=P, ctx=C)
    step('RF37', 'League', 'tabela da liga', 'GET', '/api/flair/modes/league', who=P, ctx=C)
    step('RF37', 'Runway', 'FLAIR Runway (tema do dia)', 'GET', '/api/flair/modes/runway', who=P, ctx=C)
    step('RF37', 'Runway', 'looks da celebridade', 'GET', '/api/flair/modes/looks', who=CELEB, ctx=C, save=lambda c, b: c.__setitem__('luna_looks', [x['schemeId'] for x in b['looks']]))
    step('RF37', 'Runway', 'inscrever look na Runway (1 por dia)', 'POST', '/api/flair/modes/runway', body=lambda c: {'schemeId': c['luna_looks'][0]}, who=CELEB, ctx=C, expect=(200, 201, 409))
    step('RF37', 'Tour', 'World Tour', 'GET', '/api/flair/modes/tour', who=P, ctx=C)
    step('RF37', 'Tour', 'rolar o dado', 'POST', '/api/flair/modes/tour/roll', who=P, ctx=C, save=lambda c, b: c.__setitem__('tour_pending', b.get('pending')))
    step('RF37', 'Tour', 'resolver a casa', 'POST', '/api/flair/modes/tour/resolve', body=lambda c: {'schemeId': c['looks'][0]}, who=P, ctx=C, expect=(200, 409))
    step('RF37', 'Conquest', 'mapa de conquista', 'GET', '/api/flair/modes/territories?map=CONQUEST', who=P, ctx=C)
    step('RF37', 'Conquest', 'atacar região (vence 2 de 3)', 'POST', '/api/flair/modes/territories/CONQUEST/STREETWEAR/attack', body=lambda c: {'schemeIds': c['looks'][:3]}, who=P, ctx=C)
    step('RF37', 'Monopoly', 'Fashion Monopoly', 'POST', '/api/flair/modes/territories/MONOPOLY/HARAJUKU/attack', body=lambda c: {'schemeIds': c['looks'][:1]}, who=P, ctx=C)
    step('RF37', 'Draft', 'iniciar draft (20 peças)', 'POST', '/api/flair/modes/draft', who=P, ctx=C, save=lambda c, b: (c.__setitem__('draft', b['id']), c.__setitem__('draft_state', b)))
    for i in range(10):
        if (C.get('draft_state') or {}).get('turn') != 'A':
            break
        step('RF37', 'Draft', f'escolha em serpente #{i + 1}', 'POST', '/api/flair/modes/draft/{draft}/pick', body=lambda c: {'pieceId': c['draft_state']['pool'][0]['id']}, who=P, ctx=C,
             save=lambda c, b: c.__setitem__('draft_state', b))
    step('RF37', 'Draft', 'montar 3 looks do draft', 'POST', '/api/flair/modes/draft/{draft}/looks', who=P, ctx=C,
         body=lambda c: (lambda m: {'looks': [m[0:3], m[3:6], m[6:9]]})([x['id'] for x in c['draft_state']['mine']]))
    DP = ADMIN   # o Deck Battle exige 12 cartas; o usuário descartável não tem acervo para isso
    step('RF37', 'Deck', 'deck de 12 cartas (sugestão)', 'GET', '/api/flair/modes/deck', who=DP, ctx=C, save=lambda c, b: c.__setitem__('deck12', b['suggestion']))
    step('RF37', 'Deck', 'salvar deck', 'PUT', '/api/flair/modes/deck', body=lambda c: {'pieceIds': c['deck12']}, who=DP, ctx=C)
    step('RF37', 'Deck', 'Deck Battle: desafio', 'POST', '/api/flair/modes/deck/battle', who=DP, ctx=C, save=lambda c, b: (c.__setitem__('dgame', b.get('id')), c.__setitem__('dhint', b.get('hint'))))
    if 'dgame' in C:
        step('RF37', 'Deck', 'Deck Battle: jogar a mão', 'POST', '/api/flair/modes/deck/battle/{dgame}/play', body=lambda c: {'pieceIds': c.get('dhint') or c['deck12'][:5]}, who=DP, ctx=C)
    step('RF37', 'Combo', 'Combo Battle', 'POST', '/api/flair/modes/combo', body=lambda c: {'schemeId': c['looks'][0]}, who=P, ctx=C)
    step('RF37', 'Tag', 'Tag Team 2×2', 'POST', '/api/flair/modes/tag-team', body=lambda c: {'schemeId': c['looks'][0], 'partner': 'ny_ava', 'opponents': ['paris_lea', 'tokyo_ren']}, who=P, ctx=C)
    step('RF37', 'Boss', 'Fashion Boss: The Minimalist', 'POST', '/api/flair/modes/bosses/MINIMALIST', body=lambda c: {'schemeIds': c['looks'][:3]}, who=P, ctx=C)
    step('RF37', 'Wars', 'Wardrobe Wars (7 categorias)', 'POST', '/api/flair/modes/wardrobe-wars', {'opponent': 'ny_ava'}, who=P, ctx=C)
    step('RF37', 'Chess', 'FLAIR Chess: sugestão de tabuleiro', 'GET', '/api/flair/modes/chess', who=P, ctx=C, save=lambda c, b: c.__setitem__('board', b['suggestion']))
    step('RF37', 'Chess', 'FLAIR Chess: jogar', 'POST', '/api/flair/modes/chess', body=lambda c: {'board': c['board']}, who=P, ctx=C)
    step('RF37', 'Ultimate', 'Ultimate Team: sugestão', 'GET', '/api/flair/modes/ultimate', who=P, ctx=C, save=lambda c, b: c.__setitem__('roles', b['suggestion']))
    step('RF37', 'Ultimate', 'Ultimate Team: salvar papéis', 'PUT', '/api/flair/modes/ultimate', body=lambda c: {'roles': c['roles']}, who=P, ctx=C)
    step('RF37', 'Ultimate', 'Ultimate Team: jogar', 'POST', '/api/flair/modes/ultimate/play', {'opponent': 'CASA'}, who=P, ctx=C)
    step('RF37', 'CA07', 'troféus', 'GET', '/api/flair/modes/trophies', who=P, ctx=C)
    # combinações da loja → cupom
    step('RF37', 'CA09', 'aba FLAIR da marca', 'GET', '/api/institutional/atelier-lume-3/flair', who=U, ctx=C)
    step('RF37', 'CA09', 'marca cria combinação', 'POST', '/api/flair/brand/combinations', who=BRAND, ctx=C,
         body=dict(name='Combo E2E', description='qualquer deck casual', gameType='COMBINACAO', requiredCategories=['upper_piece'], requiredOccasions=['casual'], minDeckPower=1,
                   couponTitle='10% E2E', discountPercent=10, validDays=30, stock=10, active=True, startsAt=iso(-1), endsAt=iso(30), storeUrl='https://example.com/loja'),
         save=lambda c, b: c.__setitem__('combo', b['id']))
    step('RF37', 'CA09', 'marca edita combinação', 'PUT', '/api/flair/brand/combinations/{combo}', who=BRAND, ctx=C,
         body=dict(name='Combo E2E 2', description='qualquer deck casual', gameType='COMBINACAO', requiredCategories=['upper_piece'], requiredOccasions=['casual'], minDeckPower=1,
                   couponTitle='12% E2E', discountPercent=12, validDays=30, stock=10, active=True, startsAt=iso(-1), endsAt=iso(30), storeUrl='https://example.com/loja'))
    step('RF37', 'CA10', 'combinações ativas com melhor deck', 'GET', '/api/flair/combinations', who=P, ctx=C,
         save=lambda c, b: c.__setitem__('combo_deck', next(((x.get('bestDeck') or {}).get('schemeId') for x in b if x['id'] == c['combo']), c['looks'][0])))
    step('RF37', 'CA10', 'conferir deck contra a combinação', 'GET', '/api/flair/combinations/{combo}/check?schemeId={combo_deck}', who=P, ctx=C)
    step('RF37', 'CA10', 'trocar o deck pelo cupom', 'POST', '/api/flair/combinations/{combo}/redeem?schemeId={combo_deck}', who=P, ctx=C, save=lambda c, b: c.__setitem__('voucher', b.get('code')))
    step('RF37', 'CA10', 'carteira de cupons', 'GET', '/api/flair/vouchers', who=P, ctx=C)
    step('RF37', 'CA12', 'loja valida o cupom no caixa', 'POST', '/api/flair/brand/redemptions/validate', body=lambda c: {'code': c.get('voucher') or 'X'}, who=BRAND, ctx=C)
    step('RF37', 'CA09', 'remover combinação (com cupom emitido só desativa)', 'DELETE', '/api/flair/brand/combinations/{combo}', who=BRAND, ctx=C)

    # ================= RF38 cupons
    step('RF38', 'CA07', 'meus cupons (direitos e resgatados)', 'GET', '/api/me/coupons', who=P, ctx=C,
         save=lambda c, b: c.__setitem__('right', next((r['id'] for r in (b.get('pending') or b.get('rights') or []) if r.get('status') in (None, 'PENDENTE')), None)))
    if C.get('right'):
        step('RF38', 'CA06', 'resgatar o cupom (Sim, resgatar)', 'POST', '/api/me/coupon-rights/{right}/redeem', who=P, ctx=C, save=lambda c, b: c.__setitem__('coupon_code', b.get('code')))
    step('RF38', 'CA05', 'direito a cupom criado por aprovação de selo', 'GET', '/api/me/coupons', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('right_u', next((r['id'] for r in (b.get('pending') or b.get('rights') or [])), None)))
    if C.get('right_u'):
        step('RF38', 'CA05', 'dispensar o cupom conquistado', 'POST', '/api/me/coupon-rights/{right_u}/dismiss', who=U, ctx=C)
    step('RF38', 'CA01', 'aba Meus cupons promocionais (marca)', 'GET', '/api/me/coupons/admin', who=BRAND, ctx=C)
    step('RF38', 'CA10', 'marca valida o código no caixa', 'POST', '/api/me/coupons/validate', body=lambda c: {'code': c.get('coupon_code') or 'CODIGO-INEXISTENTE'}, who=BRAND, ctx=C, expect=(200, 404))

    # ================= RF39 criar guarda-roupa 3D
    step('RF39', 'CA01', 'opções do criador (marca)', 'GET', '/api/room-creator/options', who=BRAND, ctx=C)
    step('RF39', 'CA01', 'usuário comum não acessa o criador', 'GET', '/api/room-creator/options', who=U, ctx=C, expect=(403,))
    step('RF39', 'CA05', 'enviar logo', 'POST', '/api/room-creator/uploads?kind=logo', files={'file': ('logo.png', LOGO, 'image/png')}, who=BRAND, ctx=C, save=lambda c, b: c.__setitem__('logo', b['url']))
    step('RF39', 'CA05', 'enviar arte', 'POST', '/api/room-creator/uploads?kind=art', files={'file': ('art.jpg', ART, 'image/jpeg')}, who=BRAND, ctx=C, save=lambda c, b: c.__setitem__('art', b['url']))
    step('RF39', 'CA02', 'criar componente (tapete de lã, grátis)', 'POST', '/api/room-creator/items', who=BRAND, ctx=C,
         body=lambda c: dict(kind='COMPONENT', name='Tapete Atelier E2E', slotType='RUG', moldId='TAP-RND', material='LA', colorName='Terracota', logoUrl=c['logo'], labelText='AL',
                             pricePoints=0, requiredLevel='ESTREIA', stock=5, perUserLimit=1, availableUntil=iso(30), active=True),
         save=lambda c, b: c.__setitem__('rug_sku', b['sku']))
    step('RF39', 'CA02', 'criar guarda-roupa inteiro', 'POST', '/api/room-creator/items', who=BRAND, ctx=C,
         body=lambda c: dict(kind='WARDROBE', name='Guarda-roupa E2E', labelText='Atelier E2E', logoUrl=c['logo'], artUrl=c['art'], pricePoints=100, requiredLevel='ESTREIA', active=True,
                             bundle=[dict(slotType='DOOR', moldId='PRT-AB60', material='FOSCO', colorName='Areia'), dict(slotType='RUG', moldId='TAP-RND', material='LA', colorName='Areia')]),
         save=lambda c, b: c.__setitem__('ward_sku', b['sku']))
    step('RF39', 'CA04', 'material não aceito pelo bloco é recusado', 'POST', '/api/room-creator/items', who=BRAND, ctx=C, expect=(400,),
         body=dict(kind='COMPONENT', name='Porta LED inválida', slotType='DOOR', moldId='PRT-AB60', material='LED', colorName='Quente 2700 K', pricePoints=10))
    step('RF39', 'CA06', 'editar condições (expira em)', 'PUT', '/api/room-creator/items/{rug_sku}', who=BRAND, ctx=C,
         body=lambda c: dict(kind='COMPONENT', name='Tapete Atelier E2E', slotType='RUG', moldId='TAP-RND', material='LA', colorName='Terracota', logoUrl=c['logo'], labelText='AL',
                             pricePoints=0, requiredLevel='ESTREIA', stock=5, perUserLimit=1, availableUntil=iso(45), active=True))
    step('RF39', 'CA08', 'minhas criações com vendas', 'GET', '/api/room-creator/items', who=BRAND, ctx=C)
    step('RF39', 'CA10', 'comprar o componente da marca', 'POST', '/api/points/shop/{rug_sku}/purchase', who=U, ctx=C, save=lambda c, b: c.__setitem__('rug_inv', b['inventoryId']))
    step('RF39', 'CA10', 'limite de 1 por pessoa', 'POST', '/api/points/shop/{rug_sku}/purchase', who=U, ctx=C, expect=(409,))
    step('RF39', 'CA11', 'montar o tapete no quarto', 'POST', '/api/me/room-inventory/{rug_inv}/apply', {'moduleId': 'rug'}, who=U, ctx=C, expect=(200, 409))
    step('RF39', 'CA08', 'excluir item vendido só retira da loja', 'DELETE', '/api/room-creator/items/{rug_sku}', who=BRAND, ctx=C)
    step('RF39', 'CA08', 'excluir guarda-roupa sem vendas', 'DELETE', '/api/room-creator/items/{ward_sku}', who=BRAND, ctx=C)
