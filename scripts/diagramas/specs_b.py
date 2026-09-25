# Especificação dos diagramas RF33–RF39 (numeração do Trello).
SPECS = {}

SPECS['RF33'] = dict(
    title='RF33 — Passarela 3D: Look do Dia desfilando em manequins, Top 100 Global/Regional/País e filtros',
    controllers=['ShowcaseController'],
    frontend=['explorer — RunwayPanel (filtros, rankings, lotes)', 'Runway3D (manequins no palco)', 'Tabela Top 100'],
    entities=['User', 'DailyLook', 'Scheme', 'SchemeItem', 'WardrobeItem', 'Follow', 'UserPreferences'],
    enums=['MannequinSex'],
    activity=r'''
|Usuário|
start
:Explorar → "Passarela 3D";
:Escolhe o ranking: Top 100 Global, Top 100 Regional,\nTop 100 do país, Seguindo, Em alta ou Recentes;
:Aplica filtros: região do mundo, país,\ncores, ocasiões, estilos, sexo do manequim;
|Sistema (ShowcaseService)|
:Pool = Looks do Dia de hoje, contas ativas,\nperfis visíveis e sem opt-out da passarela;
:Escopo do ranking (região padrão = do próprio usuário;\npaís padrão = do próprio usuário);
:Aplica filtros e ordena\n(Hype Score · curtidas + 2× salvamentos · recência);
:Corta nos 100 primeiros (desfile limitado);
:Monta o lote pedido (12 por padrão, máx. 24)\n+ facetas com contagem + tabela Top 100;
|Usuário|
if (WebGL e movimento permitidos?) then (sim)
  :Desfile 3D: manequim pelo sexo do RF1,\ncabeça com a foto de perfil, peças nos slots;
else (não)
  :Fila 2D de cards com as mesmas ações;
endif
repeat
  :Próximo lote / lote anterior;
repeat while (Mais manequins?) is (sim)
:Toca num manequim → card do look (RF7/RF19);
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\nRunwayPanel" as FE
participant "ShowcaseController" as C
participant "ShowcaseService" as S
participant "WorldRegions" as WR
database "MySQL" as DB
U -> FE: ranking=TOP100_REGIONAL, region=EUROPA,\ncolors=preto, limit=12
FE -> C: GET /api/explorer/runway?...
C -> S: runway(viewer, RunwayFilter)
S -> DB: SELECT daily_looks do dia\nJOIN users, schemes, scheme_items, wardrobe_items
S -> WR: of(user.country) → região
S -> S: filtros + ordenação + corte Top 100
S -> S: lote (offset, limit ≤ 24) + facetas
S --> FE: looks[] (posição, manequim, peças),\nbatch, facets, table (Top 100), you
FE -> FE: RF33 desfile 3D do lote
U -> FE: próximo lote
FE -> C: GET /api/explorer/runway?...&offset=12
''')

SPECS['RF34'] = dict(
    title='RF34 — Explorar as "Eras" de uma celebridade: busca por era, Insights de Eras e My Stage 3D',
    controllers=['ShowcaseController', 'LookbookController'],
    frontend=['brands/[slug] — aba Eras (ErasTab)', 'Insights de Eras (palcos 2D)', 'My Stage 3D'],
    entities=['User', 'CelebrityProfile', 'SchemeGrouping', 'Scheme', 'WardrobeItem', 'UserPreferences'],
    enums=['GroupingType'],
    activity=r'''
|Visitante|
start
:Abre o perfil da celebridade (RF22) → aba "Eras";
|Sistema (ShowcaseService)|
:Lista as eras (agrupamentos type=ERA)\ncom foto, período e contagem;
|Visitante|
split
  :Busca por era, texto e ano;
  |Sistema (ShowcaseService)|
  :Esquemas e peças da era;
split again
  |Visitante|
  :"Insights de Eras";
  |Sistema (ShowcaseService)|
  :Ranking das eras (hype, looks, salvamentos)\nem palcos 2D;
split again
  |Visitante|
  :My Stage 3D;
  |Sistema (ShowcaseService)|
  :Foto da celebridade no manequim, no palco 3D;
end split
|Celebridade (dona)|
:Cria/edita era, adiciona looks\ne envia a foto da era;
|Sistema (LookbookService)|
:Salva o agrupamento e os itens;
stop
''',
    sequence=r'''
actor Visitante as V
actor "Celebridade" as CEL
participant "Frontend\nErasTab" as FE
participant "ShowcaseController" as C
participant "LookbookController" as LC
participant "ShowcaseService" as S
database "MySQL" as DB
database "Storage de mídia" as MS
V -> FE: aba Eras
FE -> C: GET /api/institutional/{slug}/showcase/eras
C -> S: list(viewer, slug, ERAS)
S -> DB: SELECT scheme_groupings (ERA) + schemes
V -> FE: busca "Tour 2024"
FE -> C: GET .../showcase/eras/items?q=&year=
V -> FE: Insights de Eras
FE -> C: GET .../showcase/eras/insights
V -> FE: My Stage 3D
FE -> C: GET /api/institutional/{slug}/stage
CEL -> FE: nova era + looks
FE -> LC: POST /api/groupings ; POST /api/groupings/{id}/items
CEL -> FE: foto da era
FE -> C: POST /api/groupings/{id}/cover
C -> MS: put(imagem)
''')

SPECS['RF35'] = dict(
    title='RF35 — Explorar as "Coleções" de uma marca: busca por coleção, Collections Insights e mini lojas 3D',
    controllers=['ShowcaseController', 'LookbookController'],
    frontend=['brands/[slug] — aba Coleções (CollectionsTab)', 'Collections Insights (mini lojas 3D)'],
    entities=['User', 'BrandProfile', 'SchemeGrouping', 'Scheme', 'WardrobeItem'],
    enums=['GroupingType'],
    activity=r'''
|Visitante|
start
:Abre o perfil da marca (RF14) → aba "Coleções";
|Sistema (ShowcaseService)|
:Lista as coleções (type=COLLECTION)\ncom arte, temporada e contagem;
|Visitante|
split
  :Busca por coleção, texto e ano;
  |Sistema (ShowcaseService)|
  :Esquemas e peças da coleção;
split again
  |Visitante|
  :"Collections Insights";
  |Sistema (ShowcaseService)|
  :Ranking das coleções como mini lojas 3D\n(vitrine com a arte da coleção);
end split
|Marca (dona)|
:Cria/edita coleção, adiciona peças/looks\ne envia a arte da coleção;
|Sistema (LookbookService)|
:Salva o agrupamento e os itens;
stop
''',
    sequence=r'''
actor Visitante as V
actor Marca as M
participant "Frontend\nCollectionsTab" as FE
participant "ShowcaseController" as C
participant "LookbookController" as LC
participant "ShowcaseService" as S
database "MySQL" as DB
V -> FE: aba Coleções
FE -> C: GET /api/institutional/{slug}/showcase/collections
C -> S: list(viewer, slug, COLLECTIONS)
S -> DB: SELECT scheme_groupings (COLLECTION)
V -> FE: Collections Insights
FE -> C: GET .../showcase/collections/insights
S --> FE: ranking + mini lojas 3D
M -> FE: nova coleção
FE -> LC: POST /api/groupings
M -> FE: arte da coleção
FE -> C: POST /api/groupings/{id}/cover
''')

SPECS['RF36'] = dict(
    title='RF36 — "Foto com meu manequim": peça (RF4) ou look inteiro (RF5) no manequim com rosto 3D da foto de perfil',
    controllers=['ShowcaseController'],
    frontend=['pieces/[id] e schemes/[id] — botão "Foto com meu manequim"', 'MannequinPhotoDialog + LookViewer (Three.js)', 'edit-profile — ajuste do rosto'],
    entities=['User', 'UserPreferences', 'WardrobeItem', 'Scheme', 'SchemeItem'],
    enums=['MannequinSex', 'PieceCategory'],
    activity=r'''
|Usuário (dono)|
start
:Abre a peça (parte de cima / peça inteira)\nou o esquema → "Foto com meu manequim";
|Sistema (ShowcaseService)|
:Monta o Look 3D: sexo do RF1 → preferência\ndo manequim → maioria das peças → feminino;
if (Tem foto de perfil?) then (sim)
  :Cabeça com rosto 3D da foto\n(ajuste offsetX/offsetY/scale salvo);
else (não)
  :Manequim padrão masc./fem.\n(nunca manequim fantasma);
endif
|Usuário (dono)|
if (WebGL?) then (sim)
  :Gira o manequim e ajusta o rosto;
  :"Gerar foto" (render no cliente);
else (não)
  :Botão desabilitado + explicação;
  stop
endif
|Sistema (ShowcaseService)|
:Valida a imagem e grava no storage;
:Salva mannequinImageUrl na peça/esquema;
if (Esquema e "usar como capa"?) then (sim)
  :A foto vira a capa do post;
endif
stop
''',
    sequence=r'''
actor "Usuário (dono)" as U
participant "Frontend\nMannequinPhotoDialog" as FE
participant "ShowcaseController" as C
participant "ShowcaseService" as S
database "MySQL" as DB
database "Storage de mídia" as MS
U -> FE: Foto com meu manequim
FE -> C: GET /api/schemes/{id}/look3d
C -> S: look3d(viewer, schemeId)
S -> DB: SELECT users (sexo, avatar), user_preferences\n(rosto), scheme_items, wardrobe_items (GLB/recorte)
S --> FE: manequim + peças por slot
FE -> FE: Three.js renderiza, usuário ajusta o rosto
U -> FE: Gerar foto (usar como capa)
FE -> C: POST /api/schemes/{id}/mannequin-photo?asCover=true
C -> S: schemeMannequinPhoto(bytes, asCover)
S -> MS: put(users/…/schemes/{id}.png)
S -> DB: UPDATE schemes.mannequin_image_url (+ capa)
FE -> C: PUT /api/me/preferences (mannequinFace)
''')

SPECS['RF37'] = dict(
    title='RF37 — FLAIR: jogo de cartas de moda (peça → carta → look → time/deck → competição), 15 modos e combinações das lojas',
    controllers=['FlairController', 'FlairModesController'],
    frontend=['flair — Modos de jogo (15)', 'flair — Duelos, equipes, cartas, decks, quests, carteira', 'brands/[slug] — aba FLAIR (combinações da loja)'],
    entities=['User', 'FlairProfile', 'FlairCoinEntry', 'FlairMatch', 'FlairMatchEntry', 'FlairTeam', 'FlairTeamMember', 'FlairCombination', 'FlairRedemption', 'FlairModeState', 'FlairTerritory', 'FlairTrophy', 'Scheme', 'WardrobeItem'],
    enums=[],
    activity=r'''
|Jogador|
start
:Abre o FLAIR;
|Sistema (FlairService)|
:Gera cartas das peças (EDGE, RANGE, CLOUT,\nGLOW, ART, SYNC) e decks dos esquemas;
|Sistema (FlairLooks)|
:Look = 10 atributos (HYPE, STYLE, COLOR, OCCASION,\nORIGINALITY, BRAND, RARITY, TREND, COMMUNITY, AI)\n+ sinergias (Streetwear, Classic Formal,\nMonocromático, Brand Loyalty, Mix & Match, Vintage);
|Jogador|
:Escolhe um dos 15 modos;
note right
Battle of Looks · Squad · League · Runway ·
World Tour · Monopoly · Conquest · Draft ·
Deck Battle · Combo · Tag Team · Boss ·
Wardrobe Wars · Chess · Ultimate Team
end note
:Monta a escalação (looks, deck, time, tabuleiro…);
|Sistema (FlairModesService)|
:Pontua pelo tema de ocasião (18 temas com pesos);
:Registra a partida e o estado do modo;
if (Partida premiada do dia (até 3 por modo)?) then (sim)
  :Credita coins: vitória 20 · empate 8 · derrota 3\n(sem apostas);
endif
if (Conquista?) then (sim)
  :Troféu (Runway Winner, Boss derrotado,\nregião conquistada…);
  :CouponRightsCheck → direito a cupom (RF38);
endif
|Loja (marca/celebridade)|
:Publica combinação (requisitos + cupom + link);
|Jogador|
:Confere o melhor deck contra o checklist;
if (Completa a combinação?) then (sim)
  |Sistema (FlairService)|
  :Troca o deck pelo cupom da loja;
endif
stop
''',
    sequence=r'''
actor Jogador as J
actor Loja as L
participant "Frontend\nflair" as FE
participant "FlairModesController" as MC
participant "FlairController" as C
participant "FlairModesService" as MS
participant "FlairService" as S
participant "CouponService" as CS
database "MySQL" as DB
J -> FE: FLAIR Runway (tema do dia)
FE -> MC: GET /api/flair/modes/runway
MC -> MS: runwayState(user)
MS -> DB: SELECT flair_mode_states, schemes
J -> FE: inscreve look
FE -> MC: POST /api/flair/modes/runway
MC -> MS: enterRunway(user, schemeId)
MS -> MS: FlairLooks.score (40% IA, 30% tema,\n20% votos, 10% originalidade)
MS -> DB: INSERT flair_matches + entries\nUPSERT flair_mode_states
MS -> DB: INSERT flair_coin_entries (MODE_RUNWAY,\nsó as 3 primeiras partidas do dia)
MS -> DB: INSERT flair_trophies (se vencer)
MS ->> CS: CouponRightsCheck (AFTER_COMMIT)
L -> FE: nova combinação (requisitos + cupom)
FE -> C: POST /api/flair/brand/combinations
C -> S: saveCombination
S -> DB: INSERT flair_combinations
J -> FE: trocar deck pelo cupom
FE -> C: POST /api/flair/combinations/{id}/redeem
S -> DB: INSERT flair_redemptions (código único)
''')

SPECS['RF38'] = dict(
    title='RF38 — Cupons Fashion AI: "Meus cupons promocionais" (marca/celebridade) e "Meus cupons resgatados" (lookbook)',
    controllers=['CouponController'],
    frontend=['brands/[slug] — aba Meus cupons promocionais', 'lookbook?tab=cupons — Meus cupons resgatados', 'FaiCoupon (desenho com logo FAI)', 'notifications — "Parabéns! Deseja resgatar o CUPOM?"'],
    entities=['User', 'CouponRight', 'Promotion', 'PromotionRedemption', 'FlairCombination', 'FlairRedemption', 'Notification', 'BrandProfile', 'CelebrityProfile'],
    enums=['PromotionType', 'PromotionStatus', 'RedemptionStatus', 'NotificationType'],
    activity=r'''
|Loja (marca/celebridade)|
start
:Cadastra selo com promoção (RF25)\nou jogo/combinação FLAIR (RF37);
|Usuário|
:Conquista direitos usando o app\n(selo aprovado num look, vitória no FLAIR…);
|Sistema (CouponService)|
:CouponRightsCheck (após o commit)\n→ procura promoções elegíveis;
if (Já existe direito para esta fonte?) then (sim)
  :Não duplica;
  stop
endif
:Cria o direito (coupon_rights PENDENTE);
:Notifica COUPON_AVAILABLE:\n"Parabéns! Deseja resgatar o CUPOM?";
|Usuário|
if (Resgatar?) then (sim)
  |Sistema (CouponService)|
  :Emite o cupom Fashion AI\n(código único, desconto, validade, storeUrl);
  |Usuário|
  :Cupom aparece em "Meus cupons resgatados"\n(desenho sempre com o logo do FAI);
  :Toca no cupom → abre a loja externa\n(fora do app);
  |Loja (marca/celebridade)|
  :Confere o código no caixa;
  |Sistema (CouponService)|
  :Marca o cupom como usado;
else (não)
  |Sistema (CouponService)|
  :Direito dispensado;
endif
|Loja (marca/celebridade)|
:"Meus cupons promocionais":\ncupons emitidos, direitos pendentes\ne "Todas as promoções" (ativas/inativas);
stop
''',
    sequence=r'''
actor Usuário as U
actor Loja as L
participant "Frontend" as FE
participant "CouponController" as C
participant "CouponService" as S
participant "SealService / FlairService" as SRC
participant "NotificationService" as N
database "MySQL" as DB
SRC ->> S: CouponRightsCheck(userId) (AFTER_COMMIT)
S -> SRC: eligiblePromotions(userId)
S -> DB: INSERT coupon_rights (sem duplicar)
S -> N: COUPON_AVAILABLE
N -> DB: INSERT notifications
U -> FE: notificação → "Sim, resgatar"
FE -> C: POST /api/me/coupon-rights/{id}/redeem
C -> S: redeem(user, id)
S -> DB: INSERT promotion_redemptions / flair_redemptions\nUPDATE coupon_rights (RESGATADO)
S --> FE: cupom (código, desconto, validade, storeUrl)
U -> FE: Meus cupons resgatados
FE -> C: GET /api/me/coupons
U -> FE: toca no cupom → abre storeUrl (nova aba)
L -> FE: Meus cupons promocionais
FE -> C: GET /api/me/coupons/admin
L -> FE: valida código no caixa
FE -> C: POST /api/me/coupons/validate
S -> DB: UPDATE status = USED
''')

SPECS['RF39'] = dict(
    title='RF39 — "Criar guarda-roupa 3D": componentes ou guarda-roupa inteiro de marca/celebridade vendidos na loja do quarto',
    controllers=['RoomCreatorController', 'HighlightsController'],
    frontend=['brands/[slug] — aba Criar guarda-roupa 3D (WardrobeCreatorTab)', 'WardrobePreview (criador de blocos 3D)', 'points — RoomStore', 'room — RoomScene (acabamentos, arte, placa de logo)'],
    entities=['User', 'RoomCatalogItem', 'RoomInventoryItem', 'RoomLayout', 'Seal', 'SealBond', 'FaiPointsLedgerEntry', 'BrandProfile', 'CelebrityProfile'],
    enums=['ProfileType', 'SealBondStatus'],
    activity=r'''
|Marca/Celebridade|
start
:Perfil → "Criar guarda-roupa 3D";
|Sistema (WardrobeCreatorService)|
if (Perfil MARCA ou CELEBRIDADE?) then (não)
  #FFE3E3:403 ACESSO_NEGADO;
  stop
endif
:Opções: 13 blocos, 22 materiais com cores,\nníveis, identidade e selos ativos;
|Marca/Celebridade|
if (Componente ou guarda-roupa inteiro?) then (componente)
  :Escolhe um bloco (modelo, material, cor);
else (inteiro)
  :Toca nos blocos da pré-visualização 3D\ne define material/cor de cada um;
endif
:Envia logo (PNG) e arte da marca;
:Nome gravado na placa e selo de identidade (RF25);
:Condições: preço (sugerido), nível, estoque,\nlimite por pessoa, disponível de / expira em,\nexige selo;
|Sistema (WardrobeCreatorService)|
if (Material aceito pelo bloco, janela e preço válidos?) then (sim)
  :Calcula o nível final\n(maior entre escolhido, bloco e material);
  :Salva no catálogo (room_catalog, kind\nCOMPONENT/WARDROBE, bundle_json);
else (não)
  #FFE3E3:400 com o erro;
  stop
endif
|Usuário comum|
:Loja do quarto → filtra e compra;
|Sistema (FaiPointsService)|
if (Condições OK?) then (sim)
  :Debita FAI Points e cria a unidade;
  |Sistema (RoomService)|
  :Monta no módulo (ou em todos: moduleId=ALL);
else (não)
  #FFE3E3:409 com o motivo;
endif
stop
''',
    sequence=r'''
actor "Marca/Celebridade" as M
actor Comprador as U
participant "Frontend\nWardrobeCreatorTab" as FE
participant "RoomCreatorController" as RC
participant "WardrobeCreatorService" as W
participant "HighlightsController" as HC
participant "FaiPointsService" as P
participant "RoomService" as R
database "MySQL" as DB
database "Storage de mídia" as MS
M -> FE: aba Criar guarda-roupa 3D
FE -> RC: GET /api/room-creator/options
RC -> W: options(user)
M -> FE: envia logo e arte
FE -> RC: POST /api/room-creator/uploads?kind=logo|art
W -> MS: put(png/jpg)
M -> FE: Publicar (bundle de blocos + condições)
FE -> RC: POST /api/room-creator/items
RC -> W: save(user, null, ItemForm)
W -> DB: INSERT room_catalog (BRD-…)
U -> FE: Loja do quarto
FE -> HC: GET /api/points/shop
HC -> P: shop(user)
P -> W: view + blocker
U -> FE: Comprar
FE -> HC: POST /api/points/shop/{sku}/purchase
P -> DB: INSERT fai_points_ledger, room_inventory
U -> FE: Montar (guarda-roupa inteiro)
FE -> HC: POST /api/me/room-inventory/{id}/apply {moduleId: ALL}
P -> R: applyFinish → todos os módulos de cada bloco
R -> DB: UPDATE room_layouts.modules_json
''')
