"""Bloco 2 — esquemas, lookbook, social, busca, DNA, Copilot/Autopilot, fotos, perfis, provador, fundos,
vínculos de selo, explorador, notificações, admin e dashboard (RF5–RF26, RNF)."""
import os
import datetime
from harness import step, sql, SCR

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
IMG = open(os.path.join(FIX, 'p1.jpg'), 'rb').read()
JPG = lambda: {'file': ('foto.jpg', IMG, 'image/jpeg')}
ADMIN, BRAND, CELEB, USER2 = 'demo_matheus3', 'atelier_lume3', 'luna_vega', 'ny_ava'


def sid(b):
    return (b.get('scheme') or b)['id']


def run(C):
    U = C['e2e_user'] + 'x'          # username trocado no bloco 1 (RF3)
    from harness import _tokens
    _tokens[U] = _tokens.get(C['e2e_user'])
    C['U'] = U
    for k, u in (('brand_id', BRAND), ('celeb_id', CELEB), ('user2_id', USER2), ('admin_id', ADMIN)):
        C[k] = sql(f"select id from fashionai_app.users where username='{u}'")[0][0]
    items = lambda *ks: [dict(wardrobeItemId=C[k], slot=s, sortOrder=i) for i, (k, s) in enumerate(ks)]
    # ---------------- RF5 criar esquema
    step('RF5', 'CA01', 'dados do construtor de esquema', 'GET', '/api/schemes/builder', who=U, ctx=C)
    step('RF5', 'CA04', 'gerar combinações com IA (fallback local)', 'POST', '/api/schemes/compositions', {'occasion': ['casual'], 'style': ['basic'], 'prompt': 'look leve para o dia'}, who=U, ctx=C)
    step('RF5', 'CA06', 'pré-visualizar o card', 'POST', '/api/schemes/preview', who=U, ctx=C,
         body=lambda c: dict(title='Prévia E2E', occasion=['casual'], style=['basic'], visibility='PUBLIC', items=items(('p_top', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES')), creationMode='MANUAL'))
    for key, title, its in (('s1', 'Look E2E casual', (('p_top', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES'))),
                            ('s2', 'Look E2E festa', (('p_dress', 'FULL_BODY'), ('p_shoes', 'SHOES'))),
                            ('s3', 'Look E2E street', (('p_top', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES')))):
        step('RF5', 'CA07', f'salvar e publicar esquema ({title})', 'POST', '/api/schemes', who=U, ctx=C,
             body=lambda c, t=title, it=its: dict(title=t, occasion=['casual'], style=['streetwear'], season='SUMMER', visibility='PUBLIC', items=items(*it), creationMode='MANUAL', publish=True),
             save=lambda c, b, k=key: c.__setitem__(k, sid(b)))
    step('RF5', 'CA03', 'peça indisponível não entra no esquema (deve recusar)', 'POST', '/api/schemes', who=U, ctx=C, expect=(400,),
         body=lambda c: dict(title='Look com peça indisponível', occasion=['casual'], style=['basic'], visibility='PUBLIC', items=items(('p_top', 'TOP'), ('p_acc', 'ACCESSORY')), creationMode='MANUAL', publish=True))
    step('RF5', 'CA09', 'foto do look (post)', 'POST', '/api/schemes/photos', files=JPG(), who=U, ctx=C)
    step('RF5', 'CA08', 'publicar com visibilidade', 'POST', '/api/schemes/{s1}/publication', {'visibility': 'PUBLIC'}, who=U, ctx=C)
    step('RF7', 'CA03', 'abrir esquema (detalhe)', 'GET', '/api/schemes/{s1}', who=USER2, ctx=C)
    step('RF6', 'CA02', 'meus esquemas', 'GET', '/api/me/schemes?size=24', who=U, ctx=C)
    step('RF11', 'CA05', 'card renderizado (PNG)', 'GET', '/api/schemes/{s1}/card.png?expanded=true', who=U, ctx=C)
    # ---------------- RF9 editar
    step('RF9', 'CA01', 'editar esquema', 'PUT', '/api/schemes/{s3}', who=U, ctx=C,
         body=lambda c: dict(title='Look E2E street editado', occasion=['casual'], style=['streetwear'], visibility='PUBLIC', items=items(('p_top', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES')), creationMode='MANUAL'))
    step('RF9', 'CA05', 'pedir melhoria por instrução (Edit Assistant)', 'POST', '/api/schemes/{s3}/improvements', {'instruction': 'deixe mais formal'}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('improve', b))
    step('RF9', 'CA05', 'aplicar o diff aceito', 'POST', '/api/schemes/{s3}/improvements/apply', who=U, ctx=C,
         body=lambda c: {x.get('field'): x.get('to', x.get('after', x.get('proposed'))) for x in ((c.get('improve') or {}).get('changes') or []) if x.get('field')} or {'title': 'Look E2E street (melhorado)'})
    step('RF6', 'CA04', 'favoritar esquema', 'PATCH', '/api/schemes/{s3}/flags', {'favorite': True}, who=U, ctx=C)
    # ---------------- RF11 fundo
    step('RF11', 'CA01', 'catálogo de fundos', 'GET', '/api/backgrounds/catalog', who=U, ctx=C, save=lambda c, b: c.__setitem__('bg_cat', b))
    step('RF11', 'CA02', 'recomendações de fundo', 'GET', '/api/backgrounds/recommendations?styles=streetwear&occasions=casual', who=U, ctx=C)
    step('RF11', 'CA03', 'combinação aura × material', 'GET', '/api/backgrounds/combination?aura=AURORA&material=CHROME', who=U, ctx=C)
    step('RF11', 'CA04', 'aplicar fundo ao esquema', 'PUT', '/api/schemes/{s1}/background', {'config': {'type': 'SOLID', 'color': '#EFE9DF'}}, who=U, ctx=C)
    step('RF11', 'CA04', 'voltar ao fundo padrão', 'DELETE', '/api/schemes/{s1}/background', who=U, ctx=C)
    step('RF11', 'CA07', 'arte de fundo por IA (fallback local)', 'POST', '/api/backgrounds/art', {'prompt': 'neon suave', 'direction': 'CENTER', 'passePartout': False, 'target': 'SCHEME'}, who=U, ctx=C)
    step('RF11', 'CA08', 'enviar imagem de fundo', 'POST', '/api/backgrounds/uploads?target=SCHEME', files=JPG(), who=U, ctx=C)
    for p in ('/api/assets/manifest', '/api/assets/chrome', '/api/assets/skins', '/api/assets/mosaics'):
        step('RF11' if 'skins' in p or 'mosaics' in p else 'RF23', 'ASSETS', 'catálogo de assets', 'GET', p, ctx=C)
    # ---------------- RF6 lookbook
    step('RF6', 'CA01', 'visão geral do lookbook', 'GET', '/api/users/{e2e_id}/lookbook', who=USER2, ctx=C)
    step('RF6', 'CA05', 'marcar Look do Dia', 'POST', '/api/me/daily-look', body=lambda c: {'schemeId': c['s1']}, who=U, ctx=C)
    step('RF6', 'CA05', 'aba Look do Dia + painel de Hype', 'GET', '/api/me/daily-look-tab', who=U, ctx=C)
    step('RF6', 'CA05', 'histórico de Looks do Dia', 'GET', '/api/me/daily-looks', who=U, ctx=C)
    step('RF6', 'CA06', 'versões do painel de Hype', 'GET', '/api/hype/panel-versions', who=U, ctx=C)
    step('RF6', 'CA06', 'escolher versão do painel', 'PUT', '/api/me/hype-panel-version', {'version': 'PASSARELA'}, who=U, ctx=C)
    step('RF6', 'CA07', 'como o Hype Score é calculado', 'GET', '/api/hype/method', ctx=C)
    step('RF6', 'CA07', 'HypeGroups globais', 'GET', '/api/hype/groups?type=SCHEME', ctx=C)
    step('RF6', 'CA07', 'sugerir HypeGroups (acervo grande)', 'POST', '/api/me/hype-groups/suggestions?type=PIECE', who=CELEB, ctx=C, expect=(200, 201, 422))
    step('RF6', 'CA07', 'meus HypeGroups', 'GET', '/api/me/hype-groups?type=PIECE', who=U, ctx=C, save=lambda c, b: c.__setitem__('hg', (b[0]['id'] if isinstance(b, list) and b else None)))
    step('RF6', 'CA08', 'cápsula por categoria', 'GET', '/api/me/capsule?category=upper_piece', who=U, ctx=C)
    step('RF10', 'CA07', 'look do dia aguardando feedback', 'GET', '/api/me/daily-looks/pending-feedback', who=U, ctx=C)
    step('RF10', 'CA07', 'feedback do look do dia', 'PUT', '/api/me/daily-looks/' + datetime.date.today().isoformat() + '/feedback', {'feedback': 'ADOREI'}, who=U, ctx=C)
    step('RF6', 'CA09', 'criar agrupamento', 'POST', '/api/groupings', {'type': 'SEASON', 'label': 'Verão E2E', 'description': 'agrupamento de teste', 'periodFrom': 2026, 'periodTo': 2026}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('grp', b['id']))
    step('RF6', 'CA09', 'editar agrupamento', 'PUT', '/api/groupings/{grp}', {'type': 'SEASON', 'label': 'Verão E2E 26', 'periodFrom': 2026, 'periodTo': 2026}, who=U, ctx=C)
    step('RF6', 'CA09', 'adicionar esquemas ao agrupamento', 'POST', '/api/groupings/{grp}/items', body=lambda c: {'schemeIds': [c['s1'], c['s2']], 'pieceIds': [c['p_top']]}, who=U, ctx=C)
    step('RF6', 'CA09', 'agrupamentos do usuário', 'GET', '/api/users/{e2e_id}/groupings', who=U, ctx=C)
    step('RF6', 'CA09', 'esquemas do agrupamento', 'GET', '/api/groupings/{grp}/schemes', who=U, ctx=C)
    # ---------------- RF8 / RF19 social (usuário 2 interage com o look do e2e)
    step('RF8', 'CA01', 'feed', 'GET', '/api/feed?size=12', who=USER2, ctx=C)
    step('RF8', 'CA02', 'busca', 'GET', '/api/search?term=E2E&tab=LOOKS', who=USER2, ctx=C)
    step('RF15', 'CA01', 'peças públicas', 'GET', '/api/public-pieces?size=12', who=USER2, ctx=C)
    step('RF8', 'CA03', 'passarela de quem sigo', 'GET', '/api/runway?size=12', who=USER2, ctx=C)
    step('RF19', 'CA01', 'reagir ao esquema', 'POST', '/api/interactions/SCHEME/{s1}/reactions', {'reaction': 'LIKE'}, who=USER2, ctx=C)
    step('RF19', 'CA02', 'comentar no esquema', 'POST', '/api/interactions/SCHEME/{s1}/comments', {'content': 'Adorei o look (E2E)'}, who=USER2, ctx=C,
         save=lambda c, b: c.__setitem__('comment', b['id']))
    step('RF19', 'CA02', 'listar comentários', 'GET', '/api/interactions/SCHEME/{s1}/comments', who=U, ctx=C)
    step('RF19', 'CA03', 'salvar o esquema', 'POST', '/api/interactions/SCHEME/{s1}/saves', who=USER2, ctx=C)
    step('RF19', 'CA03', 'favoritar o salvo', 'PUT', '/api/interactions/SCHEME/{s1}/saves/favorite', {'favorite': True}, who=USER2, ctx=C)
    step('RF19', 'CA04', 'compartilhar no feed', 'POST', '/api/interactions/SCHEME/{s1}/shares', {'channel': 'FEED', 'caption': 'olha esse'}, who=USER2, ctx=C)
    step('RF19', 'CA05', 'remixar (interação)', 'POST', '/api/interactions/SCHEME/{s1}/remixes', who=USER2, ctx=C)
    step('RF19', 'CA05', 'remixar para o meu guarda-roupa', 'POST', '/api/schemes/{s1}/remix', who=USER2, ctx=C)
    step('RF8', 'CA04', 'contadores do esquema', 'GET', '/api/interactions/SCHEME/{s1}/counters', who=U, ctx=C)
    step('RF6', 'CA03', 'looks salvos', 'GET', '/api/me/saved-looks', who=USER2, ctx=C)
    step('RF6', 'CA03', 'favoritar look salvo', 'PUT', '/api/me/saved-looks/{s1}/favorite', {'favorite': True}, who=USER2, ctx=C)
    step('RF6', 'CA03', 'peças salvas', 'GET', '/api/me/saved-pieces', who=USER2, ctx=C)
    step('RF19', 'CA02', 'excluir comentário', 'DELETE', '/api/comments/{comment}', who=USER2, ctx=C)
    step('RF6', 'CA03', 'remover dos salvos', 'DELETE', '/api/me/saved-looks/{s1}', who=USER2, ctx=C)
    step('RF15', 'CA02', 'copiar peça pública para o meu guarda-roupa', 'POST', '/api/pieces/{p_top}/copy', who=USER2, ctx=C)
    step('RF7', 'CA04', 'voltar ao esquema de origem', 'POST', '/api/pieces/{p_top}/return-to-origin?fromScheme={s1}', who=U, ctx=C)
    step('RF7', 'CA02', 'closet de outro usuário', 'GET', '/api/users/{e2e_id}/closet', who=USER2, ctx=C)
    # ---------------- RF17 perfis e seguir
    step('RF17', 'CA01', 'perfil de outro usuário', 'GET', '/api/profiles/{U}', who=USER2, ctx=C)
    step('RF17', 'CA02', 'seguir', 'POST', '/api/users/{e2e_id}/followers', who=USER2, ctx=C)
    step('RF17', 'CA02', 'seguidores e seguindo', 'GET', '/api/users/{e2e_id}/connections', who=USER2, ctx=C)
    step('RF17', 'CA03', 'pedidos para me seguir', 'GET', '/api/me/follow-requests', who=U, ctx=C, save=lambda c, b: c.__setitem__('freq', (b[0].get('id') if isinstance(b, list) and b else None)))
    step('RF17', 'CA04', 'deixar de seguir', 'DELETE', '/api/users/{e2e_id}/followers/me', who=USER2, ctx=C)
    step('RF17', 'CA05', 'bloquear e desbloquear', 'PUT', '/api/users/{e2e_id}/block', {'blocked': False}, who=USER2, ctx=C)
    step('RF1', 'CA03', 'disponibilidade de username', 'GET', '/api/usernames/{U}/availability', ctx=C)
    # ---------------- RF12 fotos
    step('RF12', 'CA01', 'minhas fotos', 'GET', '/api/me/photos?size=24', who=U, ctx=C, save=lambda c, b: c.__setitem__('photo', next((x['id'] for g in b['groups'].values() for x in g), None)))
    step('RF12', 'CA02', 'linha do tempo das fotos', 'GET', '/api/me/photos/timeline', who=U, ctx=C)
    step('RF12', 'CA03', 'marcar momento-chave', 'PUT', '/api/photos/{photo}/key-moment', {'key': True}, who=U, ctx=C)
    step('RF12', 'CA04', 'editar foto (nova versão)', 'POST', '/api/photos/{photo}/edits', files=JPG(), who=U, ctx=C)
    step('RF12', 'CA05', 'baixar a foto original', 'GET', '/api/photos/{photo}/file', who=U, ctx=C)
    step('RF12', 'CA06', 'curadoria "Para você"', 'POST', '/api/me/photos/curation', who=U, ctx=C)
    step('RF15', 'CA03', 'remover fundo de uma foto', 'POST', '/api/photos/background-removal', files=JPG(), who=U, ctx=C)
    # ---------------- RF13 DNA
    step('RF13', 'CA01', 'meu DNA de Estilo', 'GET', '/api/me/dna', who=U, ctx=C)
    step('RF13', 'CA02', 'formulário de vida', 'POST', '/api/me/dna', {'fields': {'places': ['praia'], 'objects': ['câmera']}, 'privateFields': [], 'skip': False}, who=U, ctx=C)
    step('RF13', 'CA02', 'editar formulário de vida', 'PUT', '/api/me/dna/life', {'fields': {'places': ['praia', 'serra'], 'people': ['amigos']}, 'privateFields': ['people']}, who=U, ctx=C)
    step('RF13', 'CA03', 'campos privados', 'PUT', '/api/me/dna/private-fields', {'privateFields': ['people']}, who=U, ctx=C)
    step('RF13', 'CA04', 'cartela sazonal', 'PUT', '/api/me/dna/color-season', {'season': 'SUMMER'}, who=U, ctx=C)
    step('RF13', 'CA05', 'card de compartilhamento do DNA', 'POST', '/api/me/dna/share-card', who=U, ctx=C)
    step('RF13', 'CA06', 'construtor de esquema de DNA', 'GET', '/api/dna-schemes/builder', who=U, ctx=C)
    dna = lambda c, t='DNA E2E': dict(title=t, cells=[dict(schemeId=c['s1'], eraLabel='2025'), dict(schemeId=c['s2'], eraLabel='2026', milestone=True)], narrativeType='TIMELINE', visibility='PUBLIC', publish=True)
    step('RF13', 'CA06', 'pré-visualizar esquema de DNA', 'POST', '/api/dna-schemes/preview', body=dna, who=U, ctx=C)
    step('RF13', 'CA07', 'compor DNA com IA (fallback local)', 'POST', '/api/dna-schemes/compositions', {'prompt': 'minha evolução', 'narrativeType': 'TIMELINE'}, who=U, ctx=C)
    step('RF13', 'CA08', 'criar esquema de DNA', 'POST', '/api/dna-schemes', body=dna, who=U, ctx=C, save=lambda c, b: c.__setitem__('dna', b['id']))
    step('RF13', 'CA08', 'editar esquema de DNA', 'PUT', '/api/dna-schemes/{dna}', body=lambda c: dna(c, 'DNA E2E 2'), who=U, ctx=C)
    step('RF13', 'CA08', 'abrir esquema de DNA', 'GET', '/api/dna-schemes/{dna}', who=U, ctx=C)
    step('RF13', 'CA08', 'meus esquemas de DNA', 'GET', '/api/me/dna-schemes', who=U, ctx=C)
    # ---------------- RF10 Copilot e Autopilot
    step('RF10', 'CA01', 'sugestões do Copilot', 'GET', '/api/copilot/suggestions?city=S%C3%A3o%20Paulo', who=U, ctx=C)
    step('RF10', 'CA02', 'contexto do Copilot', 'GET', '/api/copilot/context?view=CLOSET', who=U, ctx=C)
    step('RF10', 'CA03', 'perguntar ao Copilot', 'POST', '/api/copilot/messages', {'message': 'monte um look casual', 'view': 'CLOSET'}, who=U, ctx=C)
    step('RF10', 'CA04', 'aceitar look do Copilot', 'POST', '/api/copilot/looks', body=lambda c: {'pieceIds': [c['p_top'], c['p_bottom'], c['p_shoes']], 'title': 'Copilot E2E', 'occasion': ['casual']}, who=U, ctx=C)
    step('RF10', 'CA05', 'Autopilot diário', 'POST', '/api/autopilot/daily', {'occasion': ['casual'], 'mood': 'COMFORTABLE', 'city': 'São Paulo'}, who=U, ctx=C)
    step('RF10', 'CA05', 'confirmar look do Autopilot', 'POST', '/api/autopilot/daily/confirmation', body=lambda c: {'pieceIds': [c['p_top'], c['p_bottom'], c['p_shoes']], 'title': 'Autopilot E2E', 'occasion': ['casual']}, who=U, ctx=C)
    monday = datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())
    step('RF10', 'CA06', 'planejar a semana', 'POST', '/api/autopilot/weeks', {'weekStart': monday.isoformat(), 'days': [{'date': monday.isoformat(), 'event': 'trabalho', 'occasion': 'work'}], 'city': 'São Paulo'}, who=U, ctx=C)
    step('RF10', 'CA06', 'semana atual', 'GET', '/api/autopilot/weeks/current', who=U, ctx=C, save=lambda c, b: c.__setitem__('day', (b.get('days') or [{}])[0].get('id')))
    step('RF10', 'CA06', 'trocar as peças de um dia', 'PUT', '/api/autopilot/days/{day}', body=lambda c: {'pieceIds': [c['p_top'], c['p_bottom']]}, who=U, ctx=C)
    step('RF10', 'CA06', 'usar o look do dia planejado', 'POST', '/api/autopilot/days/{day}/use', who=U, ctx=C)
    step('RF10', 'CA06', 'descartar a semana', 'DELETE', '/api/autopilot/weeks/current', who=U, ctx=C)
    # ---------------- RF18 provador
    step('RF18', 'CA01', 'provador 2D', 'GET', '/api/try-on?sex=FEMININO', who=U, ctx=C)
    step('RF18', 'CA02', 'preferências do manequim', 'PUT', '/api/try-on/preferences', {'sex': 'FEMININO', 'skinTone': 'clara', 'build': 'MEDIUM'}, who=U, ctx=C)
    step('RF18', 'CA03', 'renderizar prova', 'POST', '/api/try-on/renders', body=lambda c: {'sex': 'FEMININO', 'pieceIds': [c['p_top'], c['p_bottom']]}, who=U, ctx=C, save=lambda c, b: c.__setitem__('tryon_url', b.get('url') or b.get('tryOnUrl') or b.get('imageUrl')))
    step('RF18', 'CA04', 'salvar a prova como esquema', 'POST', '/api/try-on/schemes', body=lambda c: {'pieceIds': [c['p_top'], c['p_bottom']], 'title': 'Provador E2E', 'tryOnUrl': c.get('tryon_url')}, who=U, ctx=C)
    # ---------------- RF14 / RF22 marcas e celebridades
    step('RF14', 'CA01', 'feed de marcas', 'GET', '/api/brands', who=U, ctx=C)
    step('RF22', 'CA01', 'feed de celebridades', 'GET', '/api/celebrities', who=U, ctx=C)
    step('RF14', 'CA02', 'perfil institucional da marca', 'GET', '/api/institutional/atelier-lume-3', who=U, ctx=C)
    step('RF14', 'CA03', 'aba do perfil institucional', 'GET', '/api/institutional/atelier-lume-3/tabs/CATALOGO', who=U, ctx=C)
    step('RF22', 'CA02', 'loja/links oficiais', 'GET', '/api/institutional/atelier-lume-3/store', who=U, ctx=C)
    step('RF14', 'CA04', 'marca edita dados institucionais', 'PATCH', '/api/me/brand-profile', {'bio': 'Ateliê de linho e terra (E2E)'}, who=BRAND, ctx=C)
    step('RF22', 'CA03', 'celebridade edita dados institucionais', 'PATCH', '/api/me/celebrity-profile', {'professionalHistory': 'Cantora e compositora (E2E)'}, who=CELEB, ctx=C)
    # ---------------- RF20 / RF21 vínculo de selo (máquina de estados real: SUGGESTED → ACCEPTED/REFUSED → PENDING_REVIEW → APPROVED)
    step('RF20', 'CA01', 'peça da marca Atelier Lume (para o matcher sugerir o selo)', 'POST', '/api/pieces', who=U, ctx=C,
         body=dict(useDefaultImage=True, name='Blusa Atelier Lume E2E', category='upper_piece', subcategory='blouse', sex='UNISSEX', brandName='Atelier Lume', color='white',
                   material='COTTON', size='m', occasion=['casual'], style=['minimalist'], visibility='PUBLIC', price=240),
         save=lambda c, b: c.__setitem__('p_brand', b['id']))
    for key in ('s4', 's5'):
        step('RF20', 'CA01', f'esquema com peça da marca ({key}) — resposta traz sugestões de selo', 'POST', '/api/schemes', who=U, ctx=C,
             body=lambda c, k=key: dict(title=f'Look Atelier E2E {k}', occasion=['casual'], style=['minimalist'], visibility='PUBLIC',
                                         items=items(('p_brand', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES')), creationMode='MANUAL', publish=True),
             save=lambda c, b, k=key: (c.__setitem__(k, sid(b)), c.__setitem__(k + '_sug', next((x.get('bondId') or x.get('id') for x in ((b.get('sealSuggestions') or {}).get('suggestions') or [])), None))))
    step('RF21', 'CA01', 'sugestões de selo do look (SealBond Matcher)', 'GET', '/api/schemes/{s4}/seal-suggestions', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('s4_sug', next((x.get('bondId') or x.get('id') for x in (b.get('suggestions') or [])), c.get('s4_sug'))))
    step('RF20', 'CA02', 'aceitar a sugestão de vínculo', 'POST', '/api/seal-bonds/{s4_sug}/accept', {'imageRightsConsent': True}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('bond_status', b.get('status')))
    step('RF20', 'CA03', 'fila de revisão da marca', 'GET', '/api/seal-bonds/review-queue', who=BRAND, ctx=C)
    if C.get('bond_status') == 'PENDING_REVIEW':
        step('RF20', 'CA04', 'marca aprova o vínculo', 'POST', '/api/seal-bonds/{s4_sug}/review', {'approve': True, 'reason': 'E2E'}, who=BRAND, ctx=C)
    step('RF21', 'CA02', 'meus selos conquistados', 'GET', '/api/me/seals', who=U, ctx=C)
    step('RF21', 'CA04', 'recusar sugestão de vínculo', 'POST', '/api/seal-bonds/{s5_sug}/refuse', who=U, ctx=C)
    step('RF21', 'CA05', 'recusar todas as sugestões do esquema', 'POST', '/api/schemes/{s5}/seal-bonds/refuse-all', who=U, ctx=C)
    step('RF21', 'CA06', 'vínculo manual com celebridade (consentimento de imagem)', 'POST', '/api/schemes/{s2}/seal-bonds', body=lambda c: {'targetOwnerId': c['celeb_id'], 'imageRightsConsent': True}, who=U, ctx=C,
         save=lambda c, b: (c.__setitem__('bond2', b.get('id') or b.get('bondId')), c.__setitem__('bond2_status', b.get('status'))))
    step('RF21', 'CA07', 'celebridade revisa (aprova) o vínculo', 'POST', '/api/seal-bonds/{bond2}/review', {'approve': True, 'reason': 'E2E'}, who=CELEB, ctx=C, expect=(200, 201, 409))
    step('RF20', 'CA05', 'marca revoga o selo concedido', 'POST', '/api/seal-bonds/{s4_sug}/revoke', {'reason': 'teste de revogação (E2E)'}, who=BRAND, ctx=C)
    # ---------------- RF26 explorador global
    step('RF26', 'CA01', 'painel global por país', 'GET', '/api/explorer/global', who=U, ctx=C)
    step('RF26', 'CA02', 'buscar marcas e lojas', 'GET', '/api/explorer/brands?country=BR', who=U, ctx=C)
    step('RF26', 'CA03', 'insights globais', 'GET', '/api/explorer/insights', who=U, ctx=C)
    # ---------------- RF24 IA / logos de marca
    step('RF24', 'CA01', 'logo de marca pelo nome', 'GET', '/api/brand-logos?name=Nike', who=U, ctx=C)
    step('RF24', 'CA01', 'logos em lote', 'GET', '/api/brand-logos/batch?names=Nike,Adidas', who=U, ctx=C)
    step('RF24', 'CA02', 'catálogo de logos (admin)', 'GET', '/api/admin/brand-logos', who=ADMIN, ctx=C)
    step('RF24', 'CA02', 'atualizar logo (admin)', 'POST', '/api/admin/brand-logos/refresh?name=Nike', who=ADMIN, ctx=C)
    step('RF24', 'CA02', 'enviar logo (admin)', 'POST', '/api/admin/brand-logos/upload?name=Marca%20E2E', files={'file': ('logo.png', open(os.path.join(FIX, 'b10_logo.png'), 'rb').read(), 'image/png')}, who=ADMIN, ctx=C)
    step('RF24', 'CA02', 'atualizar logos pendentes (admin)', 'POST', '/api/admin/brand-logos/refresh-pending', who=ADMIN, ctx=C)
    step('RF24', 'CA03', 'painel de IA (admin)', 'GET', '/api/admin/ai', who=ADMIN, ctx=C)
    # ---------------- RNF10 notificações
    step('RNF10', 'CA02', 'notificações', 'GET', '/api/notifications', who=U, ctx=C, save=lambda c, b: c.__setitem__('notif', ((b if isinstance(b, list) else b.get('items', [])) or [{}])[0].get('id')))
    step('RNF10', 'CA03', 'contador de não lidas', 'GET', '/api/notifications/unread-count', who=U, ctx=C)
    step('RNF10', 'CA04', 'marcar como lida', 'POST', '/api/notifications/read', body=lambda c: {'ids': [c['notif']] if c.get('notif') else []}, who=U, ctx=C)
    step('RNF10', 'CA04', 'marcar todas como lidas', 'POST', '/api/notifications/read-all', who=U, ctx=C)
    step('RNF10', 'CA01', 'preferências de notificação', 'GET', '/api/notifications/preferences', who=U, ctx=C)
    # ---------------- admin, auditoria e dashboard gerencial
    step('RF1', 'CA08', 'aprovações pendentes (admin)', 'GET', '/api/admin/approvals', who=ADMIN, ctx=C)
    step('RF4', 'CA10', 'fila de moderação (admin)', 'GET', '/api/admin/moderation', who=ADMIN, ctx=C)
    step('ADM', 'CA01', 'usuários (admin)', 'GET', '/api/admin/users?term=e2e', who=ADMIN, ctx=C)
    step('ADM', 'CA02', 'papel do usuário (admin)', 'PUT', '/api/admin/users/{e2e_id}/role', {'role': 'USER'}, who=ADMIN, ctx=C)
    step('ADM', 'CA03', 'suspender e reativar (admin)', 'PUT', '/api/admin/users/{e2e_id}/status', {'suspend': False, 'reason': 'E2E'}, who=ADMIN, ctx=C)
    step('RNF5', 'CA01', 'trilha de auditoria (admin)', 'GET', '/api/admin/audit', who=ADMIN, ctx=C)
    step('ADM', 'CA04', 'backups (admin)', 'GET', '/api/admin/backups', who=ADMIN, ctx=C)
    step('ADM', 'CA04', 'gerar backup (admin)', 'POST', '/api/admin/backups', who=ADMIN, ctx=C)
    step('ADM', 'CA05', 'rodar job de Hype (admin)', 'POST', '/api/admin/jobs/hype', who=ADMIN, ctx=C)
    step('RF6', 'CA10', 'recalibrar Hype Score (admin)', 'POST', '/api/admin/hype/recalibration', who=ADMIN, ctx=C)
    step('RF11', 'CA09', 'thumbnail de skin (admin)', 'POST', '/api/admin/skins/atelier/thumbnail', who=ADMIN, ctx=C)
    step('DASH', 'CA01', 'dashboard gerencial com filtros', 'GET', '/api/admin/dashboard?country=BR', who=ADMIN, ctx=C)
    step('DASH', 'CA02', 'dashboard da marca', 'GET', '/api/me/issuer-dashboard', who=BRAND, ctx=C)
    step('DASH', 'CA03', 'salvar layout do dashboard', 'PUT', '/api/me/dashboard-layout', {'widgets': ['kpis', 'series'], 'hidden': [], 'defaultFilter': {'country': 'BR'}}, who=ADMIN, ctx=C)
