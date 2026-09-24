# Especificação dos diagramas RF25–RF32 (numeração do Trello). Atividades e sequências escritas à mão a partir do código.
SPECS = {}

SPECS['RF25'] = dict(
    title='RF25 — Criar & editar selo de marca/celebridade (formulário + arte) e política de promoção',
    controllers=['SealController'],
    frontend=['brands/[slug] — aba Selos', 'brands/[slug] — aba Promoções', 'SealCreator + SealMedallion'],
    entities=['User', 'Seal', 'SealBond', 'Promotion', 'PromotionRedemption', 'CouponRight', 'Notification'],
    enums=['SealTier', 'SealStatus', 'SealBondStatus', 'PromotionType', 'PromotionStatus'],
    activity=r'''
|Marca/Celebridade|
start
:Abre o próprio perfil (RF14/RF22)\n→ aba "Selos";
if (É o dono do perfil?) then (não)
  :Vê só os selos públicos\n(disponíveis ou não, com motivo);
  stop
else (sim)
endif
:Toca em "Novo selo" ou "Editar";
:Preenche nome, tipo (PEÇA/LOOK),\npolítica, limite de emissões e status;
:Monta o medalhão no catálogo de desenhos\n(forma, cores, ícone) ou envia a arte;
:Define a janela de validade\n"Disponível a partir de" / "Expira em";
|Sistema (SealService)|
if (Fim antes do início?) then (sim)
  #FFE3E3:400 PERIODO_INVALIDO;
  stop
endif
:Salva o selo (MySQL · seals)\ne audita a alteração;
|Marca/Celebridade|
:Aba "Promoções" → "Nova promoção";
:Escolhe tipo, título, regras, desconto,\ncota, limite por pessoa, período,\nselo exigido e link da loja externa;
|Sistema (SealService)|
:Salva a promoção (MySQL · promotions);
|Usuário comum|
:Publica um look compatível com a política;
|Sistema (SealService)|
:SealBond Matcher (IA RF24) sugere o vínculo;
:A marca aprova o vínculo (RF20/RF21);
if (Selo dentro da janela e com emissões?) then (sim)
  :Emite o selo no look\n(seal_bonds APPROVED);
  :Publica CouponRightsCheck (AFTER_COMMIT);
  |Sistema (CouponService)|
  :Cria o direito ao cupom (coupon_rights)\ne notifica "Parabéns! Deseja resgatar o CUPOM?";
  note right: o resgate segue no RF38
else (não)
  :Selo indisponível (motivo exibido);
endif
stop
''',
    sequence=r'''
actor "Marca/Celebridade" as M
actor "Usuário" as U
participant "Frontend\nbrands/[slug]" as FE
participant "SealController" as C
participant "SealService" as S
participant "AiEngine (RF24)" as AI
participant "CouponService" as CS
database "MySQL" as DB
M -> FE: Novo selo (nome, tipo, política, arte,\ndisponível de / expira em)
FE -> C: POST /api/seals
C -> S: createSeal(user, SealForm)
S -> S: requireIssuer + valida janela
S -> DB: INSERT seals
S --> FE: 201 selo
M -> FE: Nova promoção (tipo, desconto, cota,\nselo exigido, storeUrl)
FE -> C: POST /api/promotions
C -> S: createPromotion(user, PromotionForm)
S -> DB: INSERT promotions
U -> FE: publica look
FE -> C: GET /api/schemes/{id}/seal-suggestions
C -> S: suggest(user, schemeId)
S -> AI: SealBond Matcher (política × look)
AI --> S: selos compatíveis
U -> FE: aceita sugestão
FE -> C: POST /api/schemes/{id}/seal-bonds
M -> FE: aprova na fila de revisão
FE -> C: POST /api/seal-bonds/{id}/review
C -> S: review(user, bondId, approve=true)
S -> DB: UPDATE seal_bonds (APPROVED)
S ->> CS: CouponRightsCheck (evento AFTER_COMMIT)
CS -> DB: INSERT coupon_rights (se houver promoção elegível)
CS -> DB: INSERT notifications (COUPON_AVAILABLE)
FE -> C: GET /api/users/{ownerId}/seals
C --> FE: selos com available, unavailableReason,\navailableFrom/Until e emissões
''')

SPECS['RF26'] = dict(
    title='RF26 — Explorador Global: painel por país, marcas & lojas e insights',
    controllers=['DiscoveryController'],
    frontend=['explorer — Painel global', 'explorer — Buscar marcas & lojas', 'explorer — Insights globais'],
    entities=['User', 'BrandProfile', 'WardrobeItem', 'Scheme', 'SealBond', 'HypeScoreMetric'],
    enums=['ProfileType'],
    activity=None, sequence=None)  # atividades e sequência já existem no pacote (RF26/); aqui entram classes e componentes

SPECS['RF27'] = dict(
    title='RF27 — Visualizar e organizar o guarda-roupa num quarto 3D interativo ("Meu Quarto")',
    controllers=['RoomController'],
    frontend=['room — Quarto 3D (RoomScene)', 'room — 2.5D e Lista', 'RoomProps (espelho, cesto, cadeira, arara)'],
    entities=['User', 'RoomLayout', 'RoomStorageEntry', 'RoomCatalogItem', 'RoomInventoryItem', 'WardrobeItem', 'Scheme', 'DailyLook', 'UserPreferences'],
    enums=['ProfileType'],
    activity=r'''
|Usuário|
start
:Meu Guarda-Roupa → "Meu Quarto";
|Sistema (RoomService)|
:Carrega o layout do nível (Estreia…Maison)\ne endereça cada peça (Porta 2, Gaveta 4 · Jeans);
:Calcula estados: esquecida (poeira),\nindisponível (cesto), favorita (cabide especial),\nPeça Ícone (vitrine), esquemas (caixas no maleiro);
if (WebGL disponível?) then (sim)
  |Usuário|
  :Quarto 3D: câmera 3/4 limitada,\nabre portas e gavetas;
else (não)
  :Visão 2.5D / Lista (fallback);
endif
|Usuário|
split
  :Toca numa peça → ficha / etiqueta costurada;
split again
  :Renomeia gaveta / monograma / luz guiada;
  |Sistema (RoomService)|
  :Salva em room_layouts;
split again
  |Usuário|
  :"Organizar" → prévia (com ou sem IA);
  |Sistema (RoomService)|
  :Gera movimentos e rótulos;
  |Usuário|
  if (Aplicar?) then (sim)
    |Sistema (RoomService)|
    :Aplica e guarda o mapa anterior\n(permite desfazer);
  else (não)
  endif
split again
  |Usuário|
  :Caixa de entrega (item comprado);
  |Sistema (RoomService)|
  :Monta sozinho no módulo compatível\n(guarda-roupa inteiro → todos os blocos);
end split
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\nroom/page + RoomScene" as FE
participant "RoomController" as C
participant "RoomService" as S
participant "AiEngine (RF24)" as AI
database "MySQL" as DB
U -> FE: abre Meu Quarto
FE -> C: GET /api/me/room
C -> S: room(user)
S -> DB: SELECT room_layouts, wardrobe_items,\nschemes, daily_looks, room_inventory
S --> FE: módulos (acabamentos), peças por endereço,\nnível, decorações, unboxing, luz
U -> FE: abre a Porta 2
FE -> C: GET /api/me/room/modules/door:2
C --> FE: peças do módulo
U -> FE: Organizar
FE -> C: GET /api/me/room/organization/preview?useAi=true
C -> S: preview
S -> AI: sugere rótulos/agrupamentos (opt-in)
S --> FE: movimentos + explicação
U -> FE: Aplicar
FE -> C: POST /api/me/room/organization
S -> DB: UPDATE room_layouts (+ previous_map_json)
U -> FE: renomeia gaveta
FE -> C: PUT /api/me/room/drawers/{n}
S -> DB: UPDATE room_layouts.drawer_labels_json
''')

SPECS['RF28'] = dict(
    title='RF28 — Montar looks no Smart Mirror e pedir sugestões ao "Vista-me" (só com peças do próprio guarda-roupa)',
    controllers=['MirrorController'],
    frontend=['mirror — Smart Mirror', 'room — Vista-me no espelho do quarto'],
    entities=['User', 'MirrorState', 'WardrobeItem', 'Scheme', 'SchemeItem', 'DailyLook', 'PieceUsageDiaryEntry', 'StyleDna'],
    enums=['PieceCategory'],
    activity=r'''
|Usuário|
start
:Abre o Smart Mirror (ou o espelho do quarto);
|Sistema (MirrorService)|
:Carrega o estado do espelho\n(slots, peças vestidas, restrições de desafio);
|Usuário|
if (Montar sozinho ou pedir ao Vista-me?) then (sozinho)
  :Veste/tira peças por slot;
  |Sistema (MirrorService)|
  :Sugestões para o slot\n(só peças disponíveis do próprio acervo);
else (Vista-me)
  |Usuário|
  :Pedido em linguagem natural\n("jantar sexta, frio, algo leve");
  |Sistema (MirrorService)|
  :Motor de IA (RF24) interpreta ocasião,\nclima e DNA de Estilo;
  if (IA indisponível?) then (sim)
    :Fallback determinístico\n(regras de ocasião + cores);
  endif
  :Monta look completo com peças\ndisponíveis do guarda-roupa;
endif
|Usuário|
repeat
  :Outro look / trocar só uma peça /\n"Tira uma coisa";
repeat while (Satisfeito?) is (não)
split
  :Usar hoje → Look do Dia + diário de uso;
split again
  :Salvar como esquema (RF5);
split again
  :Storyboard GRWM;
end split
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\nmirror" as FE
participant "MirrorController" as C
participant "MirrorService" as S
participant "AiEngine (RF24)" as AI
participant "DailyLookService" as DL
database "MySQL" as DB
U -> FE: abre o espelho
FE -> C: GET /api/me/mirror
C -> S: state(user)
S -> DB: SELECT mirror_state
U -> FE: "Vista-me: jantar sexta, frio"
FE -> C: POST /api/me/mirror/vista-me
C -> S: vistaMe(user, prompt, ...)
S -> AI: interpretar pedido + DNA (opt-in)
AI --> S: ocasião, clima, paleta\n(ou fallback local)
S -> DB: SELECT wardrobe_items disponíveis
S --> FE: look completo + explicação
U -> FE: trocar só o calçado
FE -> C: POST /api/me/mirror/slots/SHOES/swap
U -> FE: Usar hoje
FE -> C: POST /api/me/mirror/use
C -> S: useLook(user)
S -> DL: marca Look do Dia
DL -> DB: INSERT daily_looks + piece_usage_diary
''')

SPECS['RF29'] = dict(
    title='RF29 — FAI Inventory Score, destaques, evolução, conquistas e rankings do guarda-roupa',
    controllers=['HighlightsController'],
    frontend=['highlights — Destaques (Inventory Score)', 'highlights — Álbum e retrospectiva', 'highlights — Rankings'],
    entities=['User', 'InventoryScoreSnapshot', 'RankingOptIn', 'RankingPosition', 'UserAchievement', 'WardrobeItem', 'PieceUsageDiaryEntry', 'WardrobeAvailabilityChange'],
    enums=[],
    activity=r'''
|Usuário|
start
:Meu Guarda-Roupa → "Destaques";
|Sistema (InventoryScoreService)|
if (Tem ao menos 10 peças?) then (não)
  :Mostra o progresso ("faltam N peças"),\nsem nota parcial;
  stop
endif
:Calcula o FAI Inventory Score (0–1000) pelas\ndimensões Catalogação, Utilização, Versatilidade,\nDescoberta, Diversidade, Organização e Identidade;
:Faixa: Em Montagem → Organizado → Versátil →\nBem Curado → Closet Inteligente →\nSignature Closet → Maison Closet;
:Grava snapshots do dia e do mês\n(inventory_score_snapshots) e confere conquistas;
|Usuário|
split
  :Abre uma dimensão;
  |Sistema (InventoryScoreService)|
  :Explica o que puxa a nota para baixo;
split again
  |Usuário|
  :Pede dicas;
  |Sistema (InventoryScoreService)|
  :Dicas acionáveis (resgatar esquecidas etc.);
split again
  |Usuário|
  :Álbum / retrospectiva anual;
split again
  |Usuário|
  :Rankings;
  if (Entrou nos rankings (opt-in)?) then (sim)
    |Sistema (InventoryScoreService)|
    if (Segmento de cidade com ≥ 50 pessoas (k-anonimato)?) then (sim)
      :Mostra posição e percentil;
    else (não)
      :Oculta até haver 50 pessoas;
    endif
  else (não)
    |Usuário|
    :Convite para entrar (opt-in);
  endif
end split
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\nhighlights" as FE
participant "HighlightsController" as C
participant "InventoryScoreService" as S
database "MySQL" as DB
U -> FE: abre Destaques
FE -> C: GET /api/me/highlights
C -> S: highlightsTab(user)
S -> DB: SELECT wardrobe_items, piece_usage_diary,\navailability_changes, schemes
S -> DB: INSERT inventory_score_snapshots
S --> FE: score, dimensões, dicas, álbum
U -> FE: explicar uma dimensão
FE -> C: GET /api/me/inventory-score/dimensions/{code}
U -> FE: entrar nos rankings
FE -> C: PUT /api/me/rankings/opt-in
S -> DB: UPSERT ranking_opt_in
FE -> C: GET /api/me/rankings
S -> DB: SELECT ranking_positions (k ≥ 50)
''')

SPECS['RF30'] = dict(
    title='RF30 — Ganhar e usar FAI Points, evoluir o nível do "Meu Quarto" e comprar na loja do quarto',
    controllers=['HighlightsController'],
    frontend=['points — Saldo, níveis e extrato', 'points — Loja do quarto (RoomStore)', 'room — caixa de entrega'],
    entities=['User', 'FaiPointsLedgerEntry', 'FaiPointsRule', 'RoomCatalogItem', 'RoomInventoryItem', 'RoomLayout', 'UserAchievement'],
    enums=[],
    activity=r'''
|Usuário|
start
:Usa o app (cadastra bem, gera 3D,\ncria looks, resgata peças esquecidas…);
|Sistema (FaiPointsService)|
:Credita no ledger append-only e idempotente\n(limite diário por regra);
:Recalcula nível pelo acumulado vitalício\n(Estreia → Studio → Loft → Closet →\nAtelier → Penthouse → Maison);
|Usuário|
:Abre FAI Points → Loja do quarto;
:Filtra por tipo, bloco, material,\norigem, marca e cor;
if (Provar antes?) then (sim)
  :Prévia no módulo (nada é cobrado);
endif
:Comprar;
|Sistema (FaiPointsService)|
if (Nível, estoque, janela, limite\npor pessoa e selo OK?) then (sim)
  if (Saldo suficiente?) then (sim)
    :Debita (SHOP_PURCHASE, não conta no vitalício);
    :Cria unidade no inventário (serial se limitada);
  else (não)
    #FFE3E3:409 SALDO_INSUFICIENTE;
    stop
  endif
else (não)
  #FFE3E3:409 com o motivo do bloqueio;
  stop
endif
|Usuário|
:Escolhe o módulo (ou "guarda-roupa inteiro");
|Sistema (RoomService)|
:Aplica o acabamento no módulo;
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\npoints + RoomStore" as FE
participant "HighlightsController" as C
participant "FaiPointsService" as P
participant "WardrobeCreatorService" as W
participant "RoomService" as R
database "MySQL" as DB
U -> FE: abre FAI Points
FE -> C: GET /api/me/points
C -> P: account(user)
P -> DB: SUM fai_points_ledger (saldo e vitalício)
FE -> C: GET /api/points/shop
C -> P: shop(user)
P -> DB: SELECT room_catalog ativos + room_inventory
P -> W: view(item, buyer) + blocker
P -> R: compatibleModules
P --> FE: itens com condições e motivo do bloqueio
U -> FE: Comprar
FE -> C: POST /api/points/shop/{sku}/purchase
C -> P: buy(user, sku)
P -> W: blocker(buyer, item)
P -> DB: INSERT fai_points_ledger (−preço)\nINSERT room_inventory\nUPDATE room_catalog.sold_count
U -> FE: Montar em "Porta 1"
FE -> C: POST /api/me/room-inventory/{id}/apply
C -> P: apply
P -> R: applyFinish(user, moduleId, item)
R -> DB: UPDATE room_layouts.modules_json
''')

SPECS['RF31'] = dict(
    title='RF31 — Filtrar e marcar o estado dos itens do acervo (favorita, disponível, indisponível, à venda)',
    controllers=['WardrobeController'],
    frontend=['closet — filtros de estado', 'pieces/[id] — flags', 'room — cesto e cabide especial'],
    entities=['User', 'WardrobeItem', 'WardrobeAvailabilityChange', 'PieceUsageDiaryEntry'],
    enums=['PieceCategory'],
    activity=r'''
|Usuário|
start
:Closet → filtro (Todas, Favoritas,\nDisponíveis, Indisponíveis, À venda);
|Sistema (WardrobeService)|
:Lista as peças do filtro;
|Usuário|
:Abre uma peça e muda o estado;
|Sistema (WardrobeService)|
:Atualiza as flags da peça\n(favorita, disponível, à venda);
if (Disponibilidade mudou?) then (sim)
  :Publica AvailabilityChanged;
  |Sistema (WardrobeEventListeners)|
  :Após o commit, registra a mudança\n(histórico usado no Inventory Score);
endif
:Reflete no Meu Quarto\n(cesto, cabide especial, arara de venda)\ne no Smart Mirror (não sugere indisponível);
stop
''',
    sequence=r'''
actor Usuário as U
participant "Frontend\ncloset / pieces" as FE
participant "WardrobeController" as C
participant "WardrobeService" as S
database "MySQL" as DB
U -> FE: filtra "Indisponíveis"
FE -> C: GET /api/me/closet?state=indisponivel
C -> S: closet(filter)
S -> DB: SELECT wardrobe_items
U -> FE: marca "Indisponível"
FE -> C: PATCH /api/pieces/{id}/flags
C -> S: toggles(user, id, favorite,\ndisponivel, forSale)
S -> DB: UPDATE wardrobe_items
S ->> S: AvailabilityChanged (AFTER_COMMIT)
S -> DB: INSERT wardrobe_availability_changes\n(WardrobeEventListeners)
S --> FE: peça atualizada
''')

SPECS['RF32'] = dict(
    title='RF32 — Participar de desafios de moda solo, em equipe, em duelo ou da comunidade ("Desafios")',
    controllers=['ChallengeController'],
    frontend=['challenges — catálogo', 'challenges/[id] — progresso, mural e votação'],
    entities=['User', 'ChallengeTemplate', 'ChallengeInstance', 'ChallengeParticipant', 'ChallengeEvent', 'ChallengeNote', 'ChallengeVote', 'Scheme'],
    enums=[],
    activity=r'''
|Usuário|
start
:Abre "Desafios" → catálogo com elegibilidade;
:Escolhe modalidade: solo, duelo, grupo ou equipes;
|Sistema (ChallengeService)|
:Cria o desafio (rascunho) e convida;
|Convidados|
if (Aceitam?) then (sim)
  :Entram no desafio;
else (não)
  :Recusam (criador pode começar mesmo assim);
endif
|Usuário|
repeat
  :Envia look como entrada\n(só peças do próprio guarda-roupa);
  :Foto no espelho real como evidência (opcional);
  |Convidados|
  :Confirmam evidência, reagem e deixam recados;
repeat while (Prazo aberto?) is (sim)
|Comunidade|
:Vota nas entradas (feed de votação);
|Sistema (ChallengeService)|
:Apura resultado, credita FAI Points\ne gera o card de resultado;
stop
''',
    sequence=r'''
actor Usuário as U
actor Convidado as G
participant "Frontend\nchallenges" as FE
participant "ChallengeController" as C
participant "ChallengeService" as S
participant "FaiPointsService" as P
participant "NotificationService" as N
database "MySQL" as DB
U -> FE: iniciar duelo
FE -> C: POST /api/challenges
C -> S: start(template, mode, invitees)
S -> DB: INSERT challenge_instances + participants
S -> N: convite
G -> FE: aceitar
FE -> C: POST /api/challenges/{id}/accept
U -> FE: enviar look
FE -> C: POST /api/challenges/{id}/entries
S -> DB: INSERT challenge_events
G -> FE: votar
FE -> C: POST /api/challenges/{id}/votes
S -> DB: INSERT challenge_votes
S -> P: credita pontos ao encerrar
FE -> C: GET /api/challenges/{id}/result-card
''')
