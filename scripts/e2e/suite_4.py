"""Bloco 4 — endpoints restantes: exclusões, sessões, aprovações, moderação, direitos a cupom e logout (sempre no fim)."""
import datetime, random, time
from harness import step, sql, http, login, _tokens, PW
from suite_1 import latest_code, LOGO, JPG

ADMIN, BRAND, USER2 = 'demo_matheus3', 'atelier_lume3', 'ny_ava'


def cnpj():
    base = [random.randint(0, 9) for _ in range(8)] + [0, 0, 0, 1]
    for w in ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]):
        s = sum(a * b for a, b in zip(base, w)) % 11
        base.append(0 if s < 2 else 11 - s)
    return ''.join(map(str, base))


def iso(days):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=days)).isoformat()


def run(C):
    U = C['U']
    run_id = C['run']
    # ---------------- RNF7 / RF23 preferências
    step('RNF7', 'CA01', 'ler preferências de interface', 'GET', '/api/me/preferences', who=U, ctx=C)

    # ---------------- RF3 exportação (LGPD)
    for _ in range(20):
        s, b, _ = http('GET', '/api/me/exports', None, login(U))
        if s == 200 and b and str(b[0].get('status')) == 'READY':
            break
        time.sleep(1.5)
    step('RF3', 'CA12', 'minhas exportações', 'GET', '/api/me/exports', who=U, ctx=C, save=lambda c, b: c.__setitem__('export_id', b[0]['id']))
    step('RF3', 'CA12', 'baixar o pacote exportado (.zip)', 'GET', '/api/me/exports/{export_id}/file', who=U, ctx=C)

    # ---------------- RF3 troca de e-mail com código
    new_mail = f'e2e_{run_id}b@example.com'
    step('RF3', 'CA05', 'pedir troca de e-mail (código vai ao novo endereço)', 'PATCH', '/api/me/sensitive', {'password': PW, 'email': new_mail}, who=U, ctx=C)
    C['mail_code'] = latest_code(new_mail) or '000000'
    step('RF3', 'CA05', 'confirmar troca de e-mail com o código', 'POST', '/api/me/email-change/confirm', body=lambda c: {'code': c['mail_code']}, who=U, ctx=C)

    # ---------------- RF17 pedido para seguir (conta privada)
    step('RF17', 'CA02', 'conta passa a ser privada', 'PUT', '/api/me/privacy', {'visibility': 'PRIVATE'}, who=U, ctx=C)
    http('DELETE', f"/api/users/{C['e2e_id']}/followers/me", None, login(USER2))
    step('RF17', 'CA02', 'pedido para seguir conta privada', 'POST', '/api/users/{e2e_id}/followers', who=USER2, ctx=C)
    step('RF17', 'CA02', 'pedidos pendentes', 'GET', '/api/me/follow-requests', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('freq', next((x.get('followId') or x.get('id') for x in (b if isinstance(b, list) else b.get('requests', []))), None)))
    step('RF17', 'CA02', 'aceitar o pedido', 'POST', '/api/follow-requests/{freq}', {'accept': True}, who=U, ctx=C)
    step('RF17', 'CA02', 'conta volta a ser pública', 'PUT', '/api/me/privacy', {'visibility': 'PUBLIC'}, who=U, ctx=C)

    # ---------------- RF6 HypeGroups de looks (sem mínimo) e descarte: 3 looks parecidos formam um grupo
    its = [dict(wardrobeItemId=C[k], slot=sl, sortOrder=i) for i, (k, sl) in enumerate((('p_top', 'TOP'), ('p_bottom', 'BOTTOM'), ('p_shoes', 'SHOES')))]
    for n in (1, 2):
        step('RF5', 'CA07', f'salvar look parecido {n} (para agrupar)', 'POST', '/api/schemes', who=U, ctx=C,
             body=dict(title=f'Grupo E2E {n}', occasion=['casual'], style=['streetwear'], season='SUMMER', visibility='PUBLIC', items=its, creationMode='MANUAL', publish=True))
    step('RF6', 'CA07', 'sugerir HypeGroups de looks', 'POST', '/api/me/hype-groups/suggestions?type=SCHEME', who=U, ctx=C)
    step('RF6', 'CA07', 'HypeGroups de looks', 'GET', '/api/me/hype-groups?type=SCHEME', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('hg', (b if isinstance(b, list) else b.get('groups', []))[0]['id']))
    step('RF6', 'CA07', 'descartar um HypeGroup', 'DELETE', '/api/me/hype-groups/{hg}', who=U, ctx=C)

    # ---------------- RF38 direitos a cupom (FLAIR): resgatar e dispensar
    for k, name in (('combo_r', 'Combo E2E Resgate'), ('combo_d', 'Combo E2E Dispensa')):
        step('RF38', 'CA05', f'marca cria a combinação "{name}"', 'POST', '/api/flair/brand/combinations', who=BRAND, ctx=C,
             body=dict(name=name, description='qualquer look casual', gameType='COMBINACAO', requiredCategories=['upper_piece'], requiredOccasions=['casual'], minDeckPower=1,
                       couponTitle=name, discountPercent=10, validDays=30, stock=10, active=True, startsAt=iso(-1), endsAt=iso(30), storeUrl='https://example.com/loja'),
             save=lambda c, b, k=k: c.__setitem__(k, b['id']))
    step('RF38', 'CA05', 'cupons conquistados aparecem como pendentes', 'GET', '/api/me/coupons', who=U, ctx=C,
         save=lambda c, b: (c.__setitem__('right_r', next(r['id'] for r in b['pending'] if r.get('title') == 'Combo E2E Resgate')),
                            c.__setitem__('right_d', next(r['id'] for r in b['pending'] if r.get('title') == 'Combo E2E Dispensa'))))
    step('RF38', 'CA06', 'resgatar o cupom conquistado', 'POST', '/api/me/coupon-rights/{right_r}/redeem', who=U, ctx=C, save=lambda c, b: c.__setitem__('coupon_code', b.get('code')))
    step('RF38', 'CA05', 'dispensar o outro cupom (Agora não)', 'POST', '/api/me/coupon-rights/{right_d}/dismiss', who=U, ctx=C)
    for k in ('combo_r', 'combo_d'):
        http('DELETE', f"/api/flair/brand/combinations/{C[k]}", None, login(BRAND))

    # ---------------- RF1 aprovação de marca pelo admin
    brand_user = f'e2e_{run_id}m'
    step('RF1', 'CA02', 'enviar logo da marca no cadastro', 'POST', '/api/auth/uploads?kind=logo', files={'file': ('logo.png', LOGO, 'image/png')}, ctx=C,
         save=lambda c, b: c.__setitem__('reg_logo', b['url']))
    step('RF1', 'CA02', 'cadastro de conta de marca (fica pendente)', 'POST', '/api/auth/register', ctx=C,
         body=lambda c: dict(profileType='MARCA', fullName='Marca E2E', username=brand_user, email=f'{brand_user}@example.com', password=PW, confirmPassword=PW,
                             acceptTerms=True, birthDate='1990-01-01', country='BR', avatarUrl=c['reg_logo'],
                             brand=dict(razaoSocial='Marca E2E Ltda', cnpj=cnpj(), nomeFantasia='Marca E2E', logoUrl=c['reg_logo'], fashionCategory='casual',
                                        storeUrl='https://example.com', commercialContact='contato@example.com', officialHashtag='#marcae2e', activityProofUrl=c['reg_logo'])),
         save=lambda c, b: c.__setitem__('brand_new_id', b['user']['id']))
    step('RF1', 'CA08', 'fila de aprovações (admin)', 'GET', '/api/admin/approvals', who=ADMIN, ctx=C)
    # política de verificação (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md): sem e-mail confirmado não há aprovação
    step('RF1', 'CA08', 'aprovar sem e-mail confirmado é bloqueado pela política', 'POST', '/api/admin/approvals/{brand_new_id}',
         {'decision': 'APROVAR', 'checklist': {'CNPJ_ATIVO': True, 'ATIVIDADE_MODA': True, 'COMPROVANTE_ATIVIDADE': True, 'PRESENCA_OFICIAL': True,
                                               'REPRESENTACAO': True, 'SEM_CONFLITO': True}}, who=ADMIN, ctx=C, expect=(409,))
    step('RF1', 'CA08', 'admin pede ajustes com motivo padronizado', 'POST', '/api/admin/approvals/{brand_new_id}',
         {'decision': 'AJUSTES', 'reasons': ['DOCUMENTO_ILEGIVEL'], 'notes': 'Comprovante de teste (E2E)'}, who=ADMIN, ctx=C)

    # ---------------- RNF moderação
    step('RF4', 'CA10', 'fila de moderação (admin)', 'GET', '/api/admin/moderation', who=ADMIN, ctx=C, save=lambda c, b: c.__setitem__('mod_item', b[0]['id']))
    step('RF4', 'CA10', 'admin aprova item da fila de moderação', 'POST', '/api/admin/moderation/{mod_item}', {'approve': True, 'reason': 'revisado no teste E2E'}, who=ADMIN, ctx=C)

    # ---------------- exclusões e arquivamento
    step('RF13', 'CA08', 'excluir esquema de DNA', 'DELETE', '/api/dna-schemes/{dna}', who=U, ctx=C)
    step('RF9', 'CA05', 'arquivar esquema', 'POST', '/api/schemes/{s3}/archive', who=U, ctx=C)
    step('RF12', 'CA01', 'minhas fotos', 'GET', '/api/me/photos?size=24', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('photo_ids', [x['id'] for g in b['groups'].values() for x in g]))
    C['photo_a'] = C['photo_ids'][0]
    C['photo_bulk'] = C['photo_ids'][1:3]
    step('RF12', 'CA03', 'excluir foto (confirmada)', 'DELETE', '/api/photos/{photo_a}?confirmed=true', who=U, ctx=C)
    step('RF12', 'CA03', 'excluir várias fotos', 'POST', '/api/photos/bulk-deletion', body=lambda c: {'ids': c['photo_bulk'], 'confirmed': True}, who=U, ctx=C)
    step('RF7', 'CA07', 'excluir peça', 'DELETE', '/api/pieces/{p_shoes2}', who=U, ctx=C)

    # ---------------- RF3 sessões, exclusão agendada e RF2 logout
    for dev in ('e2e-celular', 'e2e-tablet', 'e2e-logout'):
        s, b, _ = http('POST', '/api/auth/login', {'identifier': new_mail, 'password': PW, 'deviceName': dev})
        _tokens[dev] = b['accessToken']
    step('RF3', 'CA08', 'dispositivos conectados', 'GET', '/api/auth/sessions', who=U, ctx=C,
         save=lambda c, b: c.__setitem__('other_session', next(x['sessionId'] for x in b if x.get('device') == 'e2e-celular')))
    step('RF3', 'CA08', 'encerrar uma sessão específica', 'DELETE', '/api/auth/sessions/{other_session}', who=U, ctx=C)
    step('RF2', 'CA06', 'sair (encerra a sessão atual)', 'POST', '/api/auth/logout', who='e2e-logout', ctx=C)
    step('RF3', 'CA08', 'sair de todos os outros dispositivos', 'DELETE', '/api/auth/sessions', who=U, ctx=C)
    step('RF3', 'CA13', 'agendar exclusão da conta (30 dias)', 'POST', '/api/me/deletion', {'password': PW}, who=U, ctx=C)
    step('RF3', 'CA13', 'cancelar a exclusão agendada', 'DELETE', '/api/me/deletion', who=U, ctx=C)
