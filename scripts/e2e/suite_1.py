"""Bloco 1 — identidade, conta, peças, esquemas, lookbook (RF1–RF16, RF31)."""
import glob, os, re, time
from harness import step, sql, SCR, http, login

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
IMG = open(os.path.join(FIX, 'p1.jpg'), 'rb').read()
IMG2 = open(os.path.join(FIX, 'p2.jpg'), 'rb').read()
LOGO = open(os.path.join(FIX, 'b10_logo.png'), 'rb').read()
# RF4 — foto que segue os critérios de aceite (peça inteira, de frente, fundo liso); as fotos de pessoa acima são recusadas
PIECE = open(os.path.join(FIX, 'peca_camiseta.jpg'), 'rb').read()
JPG = lambda b=IMG: {'file': ('foto.jpg', b, 'image/jpeg')}


def latest_code(email):
    logs = sorted(glob.glob(os.environ.get('FAI_BACKEND_LOG_GLOB', SCR + '/app*.log')), key=os.path.getmtime)
    txt = open(logs[-1], encoding='utf-8', errors='ignore').read()
    blocks = [b for b in txt.split('[e-mail:') if f'para={email}' in b]
    if not blocks:
        return None
    m = re.findall(r'\b(\d{6})\b', blocks[-1])
    return m[0] if m else None


def run(C):
    run_id = C['run']
    U = f'e2e_{run_id}'
    C['e2e_user'] = U
    # ---------------- RF1 cadastro
    step('RF1', 'CA01', 'foto de perfil antes do cadastro (upload público)', 'POST', '/api/auth/uploads?kind=avatar', files=JPG(), ctx=C,
         save=lambda c, b: c.__setitem__('avatar_url', b['url']))
    step('RF1', 'CA03', 'sugestões de username', 'GET', f'/api/auth/username-suggestions?name=Teste%20E2E', ctx=C)
    step('RF1', 'CA01', 'cadastro de conta pessoal', 'POST', '/api/auth/register', ctx=C,
         body=lambda c: dict(profileType='PESSOAL', fullName='Teste E2E', username=U, email=f'{U}@example.com', password='SenhaForte#2026',
                             confirmPassword='SenhaForte#2026', acceptTerms=True, birthDate='1995-03-10', country='BR', avatarUrl=c.get('avatar_url'), sex='FEMININO'),
         save=lambda c, b: (c.__setitem__('e2e_id', b['user']['id']), c.__setitem__('e2e_tok_reg', b.get('accessToken'))))
    code = latest_code(f'{U}@example.com')
    C['e2e_code'] = code
    if C.get('e2e_tok_reg'):
        from harness import _tokens
        _tokens['__reg'] = C['e2e_tok_reg']
    step('RF1', 'CA05', 'verificar e-mail com o código enviado', 'POST', '/api/auth/email-verification', {'code': code or '000000'}, who='__reg' if C.get('e2e_tok_reg') else None, ctx=C)
    step('RF1', 'CA05', 'reenviar código de verificação', 'POST', '/api/auth/email-verification/resend', who='__reg' if C.get('e2e_tok_reg') else None, ctx=C, expect=(200, 201, 202, 204, 429))
    st = sql(f"select status from fashionai_app.users where username='{U}'")
    if st and st[0][0] != 'ACTIVE':
        sql(f"update fashionai_app.users set status='ACTIVE', email_verified=1 where username='{U}'")
    # ---------------- RF2 autenticação
    s, b = step('RF2', 'CA01', 'login com e-mail e senha', 'POST', '/api/auth/login', {'identifier': f'{U}@example.com', 'password': 'SenhaForte#2026', 'rememberMe': True, 'deviceName': 'e2e'}, ctx=C,
                save=lambda c, b: (c.__setitem__('e2e_refresh', b.get('refreshToken')),))
    from harness import _tokens
    if s == 200:
        _tokens[U] = b['accessToken']
    step('RF2', 'CA02', 'renovar sessão (refresh token com rotação)', 'POST', '/api/auth/refresh', {'refreshToken': C.get('e2e_refresh', 'x')}, ctx=C,
         save=lambda c, b: _tokens.__setitem__(U, b['accessToken']))
    step('RF2', 'CA04', 'pedir redefinição de senha', 'POST', '/api/auth/password-reset/request', {'email': f'{U}@example.com'}, ctx=C, expect=(200, 202, 204))
    step('RF2', 'CA04', 'confirmar redefinição com token inválido (deve recusar)', 'POST', '/api/auth/password-reset/confirm',
         {'token': 'invalido', 'newPassword': 'SenhaForte#2027', 'confirmPassword': 'SenhaForte#2027'}, ctx=C, expect=(400, 404, 410, 422))
    # ---------------- RF3 conta
    step('RF3', 'CA01', 'dados da conta autenticada', 'GET', '/api/me', who=U, ctx=C)
    step('RF3', 'CA02', 'editar perfil (nome, bio, pronomes, links)', 'PATCH', '/api/me/profile',
         {'displayName': 'Teste E2E', 'bio': 'Conta de teste ponta a ponta', 'pronouns': 'ela/dela', 'links': [{'label': 'site', 'url': 'https://example.com'}]}, who=U, ctx=C)
    step('RF3', 'CA02', 'trocar username', 'PUT', '/api/me/username', {'username': U + 'x'}, who=U, ctx=C)
    step('RF3', 'CA02', 'enviar foto de perfil', 'POST', '/api/me/avatar', files=JPG(), who=U, ctx=C)
    step('RF3', 'CA02', 'enviar capa do perfil', 'POST', '/api/me/cover', files=JPG(IMG2), who=U, ctx=C)
    step('RF3', 'CA06', 'privacidade da conta', 'PUT', '/api/me/privacy', {'visibility': 'PUBLIC'}, who=U, ctx=C)
    step('RF3', 'CA05', 'trocar senha', 'PUT', '/api/auth/password', {'currentPassword': 'SenhaForte#2026', 'newPassword': 'SenhaForte#2026', 'confirmPassword': 'SenhaForte#2026'}, who=U, ctx=C, expect=(200, 204))
    step('RF3', 'CA07', 'dados sensíveis (2FA desligado)', 'PATCH', '/api/me/sensitive', {'password': 'SenhaForte#2026', 'twoFactorEnabled': False}, who=U, ctx=C)
    step('RF3', 'CA08', 'sessões ativas', 'GET', '/api/auth/sessions', who=U, ctx=C, save=lambda c, b: c.__setitem__('session_id', (b[0] if isinstance(b, list) else b.get('sessions', [{}])[0]).get('id')))
    step('RF3', 'CA09', 'consentimento LGPD por finalidade', 'PUT', '/api/me/consents/AI_RECOMMENDATION', {'granted': True}, who=U, ctx=C)
    step('RF3', 'CA10', 'consentimentos', 'GET', '/api/me/consents', who=U, ctx=C)
    step('RF3', 'CA12', 'exportar meus dados (LGPD)', 'POST', '/api/me/exports', who=U, ctx=C, save=lambda c, b: c.__setitem__('export_id', b.get('id')))
    step('RF3', 'CA14', 'prova de controle de acesso por dono', 'GET', '/api/rf3/users/{e2e_id}/privacy-probe', who=U, ctx=C)
    step('RNF10', 'CA01', 'preferências de notificação', 'PUT', '/api/notifications/preferences', {'changes': {'NEW_FOLLOWER': True}, 'master': True}, who=U, ctx=C)
    step('RF23', 'CA01', 'preferências de interface (tema, idioma, cor do container)', 'PUT', '/api/me/preferences',
         {'theme': 'LIGHT', 'language': 'PT_BR', 'contentContainerColor': '#FFFFFF', 'reduceMotion': False}, who=U, ctx=C)
    step('RNF7', 'CA01', 'opções de preferências', 'GET', '/api/preferences/options', who=U, ctx=C)

    # ---------------- RF4 peças (usuário e2e)
    step('RF4', 'CA01', 'taxonomia (categorias, cores, ocasiões)', 'GET', '/api/taxonomy', ctx=C)
    # a rota de uma foto (POST /api/pieces/analysis) saiu com o criador sem foto (RF47): a análise segue pelo lote
    BATCH = lambda b: {'files': ('foto.jpg', b, 'image/jpeg')}
    step('RF4', 'CA02', 'analisar foto (critérios de aceite, remoção de fundo, subtipo por semelhança, marca, pré-preenchimento)', 'POST',
         '/api/pieces/analysis/batch', files=BATCH(PIECE), fields={'category': 'upper_piece'}, who=U, ctx=C,
         save=lambda c, b: c.__setitem__('draft_id', (b[0] if isinstance(b, list) and b else {}).get('draftId')))
    step('RF4', 'CA02', 'foto recusada: pessoa com a roupa cortada pela borda (rascunho volta com rejection FOTO_RECUSADA)', 'POST',
         '/api/pieces/analysis/batch', files=BATCH(IMG), fields={'category': 'upper_piece'}, who=U, ctx=C)
    # RF4 · buscador web de marcas (sem catálogo local): nome + logo filtrado (fundo branco, letras pretas)
    def keep_brand(key):
        def f(c, b):
            hit = next((r for r in b['results'] if r.get('logoUrl')), None)
            c[key] = dict(brandName=hit['name'], brandLogoUrl=hit['logoUrl'], brandSource=hit['source'], brandRef=hit.get('ref')) if hit else dict(brandName=None)
        return f
    for key, q in (('b_zara', 'zar'), ('b_hm', 'h%26m'), ('b_nike', 'nike'), ('b_adidas', 'adidas')):
        step('RF4', 'CA03', f'buscar marca na internet ({q.replace("%26", "&")})', 'GET', f'/api/brand-search?q={q}', who=U, ctx=C, save=keep_brand(key))
    step('RF4', 'CA03', 'marca sem logo na web (fica como texto livre)', 'GET', '/api/brand-search?q=osklen', who=U, ctx=C)
    C['b_free'] = dict(brandName='Osklen', brandLogoUrl=None, brandSource='TEXTO_LIVRE', brandRef=None)
    step('RF4', 'CA05', 'cadastrar peça a partir do rascunho (marca Zara escolhida na busca web)', 'POST', '/api/pieces', who=U, ctx=C,
         body=lambda c: dict(draftId=c.get('draft_id'), name='Camisa E2E', category='upper_piece', subcategory='shirt', sex='UNISSEX', color='white', material='COTTON',
                             size='m', occasion=['casual'], style=['basic'], visibility='PUBLIC', price=120, **c['b_zara']),
         save=lambda c, b: c.__setitem__('p_top', b['id']))
    for key, (name, cat, sub, color, mat, size, occ, style, brand) in dict(
            p_bottom=('Calça E2E', 'lower_piece', 'jeans', 'blue', 'COTTON', 'm', ['casual'], ['basic'], 'b_hm'),
            p_shoes=('Tênis E2E', 'shoes_piece', 'high_top_sneakers', 'white', 'LEATHER', 'shoe_38', ['casual'], ['streetwear'], 'b_nike'),
            p_acc=('Boné E2E', 'accessory_piece', 'cap', 'black', 'COTTON', 'one_size', ['casual'], ['streetwear'], 'b_adidas'),
            p_dress=('Vestido E2E', 'full_body_piece', 'dress', 'red', 'COTTON', 'm', ['party'], ['glam'], 'b_zara'),
            p_shoes2=('Mocassim E2E', 'shoes_piece', 'loafers', 'black', 'LEATHER', 'shoe_38', ['casual'], ['classic'], 'b_free')).items():
        step('RF4', 'CA05', f'cadastrar peça ({name}) com imagem padrão e marca {C[brand]["brandName"]}', 'POST', '/api/pieces', who=U, ctx=C,
             body=dict(useDefaultImage=True, name=name, category=cat, subcategory=sub, sex='UNISSEX', color=color, material=mat, size=size, occasion=occ, style=style, visibility='PUBLIC', price=99, **C[brand]),
             save=lambda c, b, k=key: c.__setitem__(k, b['id']))
    step('RF4', 'CA11', 'analisar várias fotos de uma vez', 'POST', '/api/pieces/analysis/batch', files={'files': ('a.jpg', PIECE, 'image/jpeg')},
         fields={'category': 'upper_piece'}, who=U, ctx=C)
    step('RF4', 'CA11', 'cadastrar peças em lote', 'POST', '/api/pieces/batch', who=U, ctx=C,
         body=[dict(useDefaultImage=True, name='Meia E2E', category='accessory_piece', subcategory='socks', sex='UNISSEX', color='white', material='COTTON', size='one_size', occasion=['casual'], style=['basic'], visibility='PRIVATE', price=15)])
    step('RF4', 'CA02', 'reprocessar remoção de fundo', 'POST', '/api/pieces/{p_top}/background-removal', who=U, ctx=C)
    step('RF4', 'EST', 'fundos do estúdio', 'GET', '/api/studio/backdrops', who=U, ctx=C)
    step('RF4', 'EST', 'foto de estúdio da peça', 'POST', '/api/pieces/{p_top}/studio?backdrop=WHITE', who=U, ctx=C, expect=(200, 201, 202))
    step('RF4', 'EST', 'estúdio para peças sem foto de estúdio', 'POST', '/api/me/pieces/studio', who=U, ctx=C, expect=(200, 201, 202))
    step('RF4', 'EST', 'estúdio do rascunho com outro fundo', 'POST', '/api/pieces/analysis/{draft_id}/studio?backdrop=WHITE', who=U, ctx=C, expect=(200, 201, 202, 404, 409, 410))
    step('RF4', 'CA09', 'substituir a foto da peça', 'PUT', '/api/pieces/{p_top}/image', files=JPG(IMG2), who=U, ctx=C)
    # ---------------- RF7 / RF31 / RF15 / RF16
    step('RF7', 'CA01', 'meu closet com filtros', 'GET', '/api/me/closet?category=upper_piece&size=24', who=U, ctx=C)
    step('RF7', 'CA02', 'detalhe da peça', 'GET', '/api/pieces/{p_top}', who=U, ctx=C)
    step('RF7', 'CA05', 'editar a peça', 'PUT', '/api/pieces/{p_top}', who=U, ctx=C,
         body=dict(name='Camisa E2E editada', category='upper_piece', subcategory='shirt', sex='UNISSEX', color='white', material='COTTON', size='m', occasion=['casual', 'work'], style=['basic'], visibility='PUBLIC', price=130))
    step('RF31', 'CA01', 'favoritar peça', 'PATCH', '/api/pieces/{p_top}/flags', {'favorite': True}, who=U, ctx=C)
    step('RF31', 'CA02', 'marcar peça indisponível', 'PATCH', '/api/pieces/{p_acc}/flags', {'disponivel': False}, who=U, ctx=C)
    step('RF31', 'CA03', 'marcar peça à venda', 'PATCH', '/api/pieces/{p_dress}/flags', {'forSale': True}, who=U, ctx=C)
    step('RF31', 'CA04', 'filtrar indisponíveis', 'GET', '/api/me/closet?state=indisponivel', who=U, ctx=C)
    step('RF7', 'CA06', 'registrar uso da peça hoje', 'POST', '/api/pieces/{p_top}/worn', who=U, ctx=C)
    step('RF7', 'CA07', 'impacto antes de excluir', 'GET', '/api/pieces/{p_acc}/deletion-impact', who=U, ctx=C)
    step('RF16', 'CA01', 'pedir modelo 3D da peça', 'POST', '/api/pieces/{p_top}/model3d', who=U, ctx=C, expect=(200, 201, 202))
    step('RF16', 'CA02', 'status do modelo 3D', 'GET', '/api/pieces/{p_top}/model3d', who=U, ctx=C)
    step('RF11', 'CA01', 'fundo do card da peça', 'PUT', '/api/pieces/{p_top}/background', {'type': 'SOLID', 'color': '#F4F2EF'}, who=U, ctx=C)
