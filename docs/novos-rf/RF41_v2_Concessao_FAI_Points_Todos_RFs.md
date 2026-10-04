# RF41 v2 — Concessão de FAI Points em todos os RFs (criadores de peças e de looks em destaque)

**Data:** 2026-10-04 · **Status:** proposta para calibração · **Numeração:** Trello.
**Substitui/estende:** RF41 v1 ([RF40-RF41.md](RF40-RF41.md) §RF41) e a tabela §5.2 de
[`01-especificacao-meu-quarto.md`](../meu_guarda_roupa/01-especificacao-meu-quarto.md) (RF30; no código RF35).
**Relaciona-se com:** [RF48 — resgate e doações](RF48_FAI_Points_Resgate_e_Doacoes.md): cada regra aqui ganha a flag
**sacável** (`cashable`), que decide se o ponto pode virar dinheiro pelo Fundo de Criadores.

## 1. Pedido do fundador

> "Tente ser criativo e propor formas de conceder FAI points nos criadores de peças e looks. Basicamente, todo RF poderia
> ter concessão de FAI points, seguindo critérios profissionais de usabilidade do app."

## 2. Situação atual (código)

| Regra (`fai_points_rules`) | Pts | Teto | Disparo no código |
|---|---|---|---|
| `PIECE_CATALOGED` | 25 | 10/dia | `WardrobeEventListeners.onPieceCreated` / `onPieceUpdated` quando `InventoryScoreService.catalogReady` (completude ≥ 60%, imagem não padrão) |
| `PIECE_COMPLETED` | 10 | **sem teto diário** (1×/peça) | `onPieceUpdated` com completude ≥ 90% |
| `PIECE_3D` | 15 | **sem teto diário** (1×/peça) | `Model3dService`, `onModel3d` |
| `SCHEME_CREATED` | 40 | 5/dia | `onSchemeSaved` (criação) |
| `FORGOTTEN_RESCUED` | 30 | 3/dia | `recordUse` / `onPieceWorn` (peça sem uso há ≥ `RoomService.FORGOTTEN_DAYS` = 60 dias) |
| `VISTA_ME_DAILY_LOOK` | 15 | 1/dia | `onDailyLook` só com `source = VISTA_ME` |
| `ROOM_ORGANIZED` | 20 | 1/semana | `onRoomOrganized` |
| `ACHIEVEMENT` | 100–500 (override) | 1× cada | `AchievementService` (10 conquistas, soma 2.050 pts) |
| `LIKE_RECEIVED` / `COMMENT_RECEIVED` / `REMIX_RECEIVED` | 1 / 2 / 10 | **50/dia cada** | `onInteraction`, ref `<alvo>:<autor>`, autointeração excluída |
| `CHALLENGE_COMPLETED` | override (recompensa × progresso) | 1×/desafio | `ChallengeService` |
| `GAME_PLAYED` / `GAME_WON` / `FLAIR_QUEST` | 5 / 10 / 10 | 6 / 4 / 3 por dia | `FaiPointsService.game`, `FlairService`, `FlairModesService`, `ChallengeService` (V26) |
| `SHOP_PURCHASE` | débito | — | `FaiPointsService.buy` |

### 2.1 Divergências encontradas

1. **Teto social:** a especificação (§5.2) diz "curtida / comentário / remix recebidos — 50/dia **no total**"; o código
   (V5) aplica **50/dia por ação** → até 50 + 100 + 500 = **650 pts/dia** só de interações. Proposta: grupo de teto
   `SOCIAL` com 60 pts/dia somados (§5).
2. **Texto de `PIECE_CATALOGED`:** a V26 mudou a descrição para "Cadastrar peça **com foto real** e dados básicos". Desde
   o RF47 o criador de peça não tem foto: a peça vem da busca no catálogo, e `catalogReady` aceita a imagem do catálogo
   (`imageUrl` não nula e não padrão). O texto não bate mais com a regra. Proposta de novo critério em §4.1.
3. `PIECE_COMPLETED` e `PIECE_3D` não têm teto diário: quem importa 200 peças de uma vez ganha 2.000 + 3.000 pts no dia.
4. `award()` não usa `Guard.requireCanCreate` (e-mail verificado, conta não suspensa) e não trava a linha do usuário: os
   tetos diários podem ser furados por chamadas simultâneas (RF48 §9.4).
5. Look do dia só pontua quando vem do Vista-me; o Look do dia manual, do Copilot ou do Autopiloto não pontua.
6. Numeração: o código chama os pontos de RF35; no Trello são RF30 (ver [README](README.md)).

## 3. Princípios de concessão

1. **Premiar o resultado útil, não o clique.** Peça pontua quando é confirmada no catálogo, completada e **usada**; look
   pontua pela **qualidade** e por ser vestido e aprovado, não por existir.
2. **Qualidade antes de volume.** Bônus de qualidade (Look Quality Score, curadoria aceita) valem mais que a base.
3. **Retornos decrescentes.** As primeiras ações de cada tipo valem o valor cheio; depois caem (ex.: a partir da 51ª peça
   cadastrada no mês, 50%; da 201ª, 20%). Um teto global diário suave (600 pts; acima disso, 50%) e duro (1.000 pts).
4. **Tetos por regra e por grupo.** Grupos `PIECE`, `LOOK`, `SOCIAL`, `GAMES`, `CURATION` com teto diário somado.
5. **Nunca pontuar autointeração** (já é assim) nem interação entre contas com sinal de vínculo (mesmo dispositivo, par
   recíproco — RF48 §11). Interações só contam se o autor tiver conta com ≥ 7 dias e e-mail verificado.
6. **Validação por terceiros vale mais** (remix, vínculo aceito por marca, curadoria do catálogo, votação de desafio).
7. **Sequências (streaks) com folga.** Look do dia em dias seguidos gera bônus em 7 e 30 dias, com 1 "dia de folga" por
   semana para não punir quem descansa (evita compulsão).
8. **Onboarding de primeira vez.** Bônus únicos e pequenos que ensinam o app (primeiro look, primeiro 2FA, primeira prova
   no provador). Nunca sacáveis.
9. **Nada por consentimento.** Não se dá ponto por aceitar consentimentos (LGPD: consentimento tem de ser livre) nem por
   dados sensíveis (medidas corporais, biometria do avatar, treino de IA). As ações correspondentes ficam com 0 pts.
10. **Nada por gastar.** Comprar na loja, resgatar cupom ou subir de nível não gera pontos (evita circuito
    gasto → ganho).
11. **Sacável só quando há valor real e baixa fraude.** `cashable = true` exige: (a) qualidade verificável ou validação de
    terceiros, (b) teto baixo, (c) nenhum componente de sorte (FLAIR fica de fora), (d) nenhum custo direto para a
    empresa (3D e Background Studio ficam de fora). Sacáveis amadurecem 30 dias (RF48).
12. **Transparência.** Toda regra aparece na tela de Pontos com valor, teto, se é sacável e o motivo quando não pontuou
    ("limite do dia", "peça ainda não usada").

## 4. Criativo: criador de peças e criador de looks

### 4.1 Criador de peças (catalog-first, RF47)

Desde o RF47 a peça nasce de uma busca no catálogo global (`catalog_products`/`catalog_variants`, ligação por
`wardrobe_items.catalog_product_id` e `catalog_variant_id`) ou, se não houver produto, de formulário manual; a foto do
usuário é opcional (`imageOrigin = USER_PHOTO`). Os pontos passam a acompanhar o **ciclo de vida da peça**:

| Etapa | Regra | Critério objetivo | Pts | Teto | Sacável |
|---|---|---|---|---|---|
| 1. Entrou no acervo com correspondência confirmada | `PIECE_CATALOGED` (revista) | Peça ligada a `catalog_product_id` **e** variante (cor/tamanho) confirmada pelo usuário, **ou** peça manual com completude ≥ 60% e categoria + cor + marca | 15 | 10/dia, retornos decrescentes no mês | Não |
| 2. Dados completos | `PIECE_COMPLETED` | Completude ≥ 90% (tamanho, composição, estação, ocasião, preço pago opcional) | 10 | 10/dia | Não |
| 3. Primeira vez usada de verdade | `PIECE_FIRST_WORN` *(nova)* | Primeiro registro no diário de uso (`piece_usage_diary`) via Look do dia, espelho ou "usei hoje" | 15 | 5/dia | **Sim** |
| 4. Peça versátil | `PIECE_VERSATILE` *(nova)* | Peça presente em 5, 15 e 30 looks **distintos** (marcos; 1× por marco por peça) | 25 | 2/dia | **Sim** |
| 5. Peça pioneira no catálogo | `CATALOG_PIONEER` *(nova)* | O usuário trouxe um produto que **não existia** no catálogo (busca sem resultado → formulário) e a curadoria/ingestão o validou (`CatalogIngestionStatus` `VALIDATED`/`PERSISTABLE`) | 40 | 3/dia, 1× por produto (o primeiro a trazer) | **Sim** |
| 6. Primeira peça de uma marca no catálogo | `CATALOG_NEW_BRAND` *(nova)* | Marca nova resolvida pelo buscador web de marcas (RF4 v3) e aceita (logo filtrado + alias) | 30 | 2/semana | **Sim** |
| 7. Correção de dados aceita | `CATALOG_CORRECTION_ACCEPTED` *(nova)* | Sugestão de correção do produto do catálogo (nome, cor oficial, composição, GTIN, imagem errada) aceita pela curadoria | 20 | 5/dia | **Sim** |
| 8. Foto real aprovada (opcional) | `PIECE_USER_PHOTO_APPROVED` *(nova)* | Foto própria que passa no pipeline RF45 (sem pessoa, peça centralizada, qualidade ≥ limiar) — útil quando o catálogo não tem a cor | 10 | 3/dia | Não |
| 9. Pedido de captura atendido | `CAPTURE_REQUEST_FULFILLED` *(nova)* | Captura adaptativa (RF45) pediu um ângulo/detalhe e o usuário enviou e foi aceito | 5 | 5/dia | Não |
| 10. Modelo 3D | `PIECE_3D` | Mantida | 15 | **5/dia** (novo teto) | Não (custo de API) |
| 11. Resgate de peça esquecida | `FORGOTTEN_RESCUED` | Mantida (≥ 60 dias sem uso) | 30 | 3/dia | **Sim** |
| 12. Circularidade | `PIECE_CIRCULATED` *(nova)* | Peça marcada "à venda" (RF31) e depois arquivada como vendida/doada | 10 | 2/semana | Não |

**Por que assim:** cadastrar em massa a partir do catálogo ficou trivial (uma busca, um toque). O ponto de volume
(`PIECE_CATALOGED`) cai de 25 para 15 e não é sacável; o que é sacável é o que prova que a peça é **real e usada**
(etapas 3, 4, 11) ou que o usuário **melhorou o catálogo** para todo mundo (5, 6, 7), sempre com validação.

### 4.2 Criador de looks (RF5, RF9, RF13, RF42)

**Look Quality Score (LQS, 0–100)** — calculado ao salvar o esquema, reaproveitando atributos que já existem no código
(`FlairLooks`: Color Harmony, Occasion Fit, Originality; `ColorMath`: harmonia de cores):

| Componente | Peso | Como medir |
|---|---|---|
| Cobertura equilibrada | 25 | Parte de cima + parte de baixo (ou peça única) + calçado; acessório conta bônus; penaliza slots duplicados incoerentes |
| Harmonia de cor | 20 | `ColorMath` (análogas, complementares, neutros + 1 destaque); penaliza > 3 cores saturadas |
| Coerência ocasião/estação | 15 | Tags de ocasião/estação das peças compatíveis com as do look (`Season`, ocasião) |
| Originalidade | 15 | Similaridade de embedding < 0,92 com os próprios looks dos últimos 90 dias; remix precisa trocar ≥ 2 peças |
| Rotatividade do guarda-roupa | 15 | ≥ 1 peça de baixa frequência ou sem uso há 30+ dias |
| Apresentação | 10 | Nome, ocasião, fundo (Background Studio) ou capa definidos |

| Ação | Regra | Critério | Pts | Teto | Sacável |
|---|---|---|---|---|---|
| Criar look | `SCHEME_CREATED` (revista) | Look salvo com ≥ 2 peças reais do acervo | 20 (era 40) | 5/dia | Não |
| Look de qualidade | `LOOK_QUALITY` *(nova)* | LQS ≥ 70 → +20; LQS ≥ 85 → +30 (override) | 20–30 | 5/dia | **Sim** |
| Melhorar um look | `LOOK_IMPROVED` *(nova)* | Edição (RF9) que sobe o LQS em ≥ 15 pontos | 10 | 3/dia | Não |
| Look do dia registrado | `DAILY_LOOK_LOGGED` *(nova)* | Qualquer origem (manual, Copilot, Autopiloto, Vista-me, espelho) | 5 | 1/dia | Não |
| Look vestido e aprovado | `LOOK_WORN_LOVED` *(nova)* | Look do dia com feedback **ADOREI** no mesmo dia ou no seguinte | 20 | 1/dia | **Sim** |
| Feedback do look do dia | `DAILY_FEEDBACK_GIVEN` *(nova)* | Qualquer feedback (ADOREI / NAO_USEI / NAO_GOSTEI) — melhora o Copilot | 3 | 1/dia | Não |
| Sequência de 7 dias | `LOOK_STREAK_7` *(nova)* | 7 looks do dia em 8 dias (1 folga), com peças reais | 40 | 1/semana | Não |
| Sequência de 30 dias | `LOOK_STREAK_30` *(nova)* | 26 looks do dia em 30 dias | 150 | 1/mês | Não |
| Tema da semana | `LOOK_THEME_WEEK` *(nova)* | Look publicado no tema editorial da semana (ex.: "Monocromático", "Uma peça esquecida") com LQS ≥ 70 | 50 | 1/semana | **Sim** |
| Cápsula completa | `CAPSULE_COMPLETED` *(nova)* | Cápsula (aba "Minha cápsula") com ≤ 12 peças gerando ≥ 20 looks distintos com LQS ≥ 60 | 150 | 1/mês | **Sim** |
| Remix recebido | `REMIX_RECEIVED` | Mantida, mas só remixadores únicos com conta ≥ 7 dias e remix que troca ≥ 2 peças | 10 | 10/dia (era 50) | **Sim** |
| Look salvo por outros | `SAVE_RECEIVED` *(nova)* | Outra pessoa salva o look (RF6/RF19) | 2 | grupo `SOCIAL` | Não |
| DNA publicado | `DNA_PUBLISHED` *(nova)* | DNA de Estilo (RF13) com ≥ 6 looks distintos de LQS ≥ 60 | 50 | 1/semana | **Sim** |
| Look aceito por marca/celebridade | `SEAL_BOND_ACCEPTED` *(nova)* | Vínculo do look com selo (RF20/RF21) aceito/aprovado pelo dono do selo | 40 | 2/semana | **Sim** |
| Look em destaque | `EXPLORER_FEATURED` *(nova)* | Look escolhido para destaque editorial do Explorador (RF26) | 50 | 1/semana | **Sim** |
| Top 100 da Passarela | `RUNWAY_TOP100` *(nova)* | Look do dia entra no Top 100 do país na Passarela 3D (RF33), contando só reações de contas elegíveis | 50 | 1/semana | **Sim** |

## 5. Grupos de teto e teto global

| Grupo | Regras | Teto diário somado |
|---|---|---|
| `PIECE` | `PIECE_CATALOGED`, `PIECE_COMPLETED`, `PIECE_USER_PHOTO_APPROVED`, `CAPTURE_REQUEST_FULFILLED`, `PIECE_3D` | 300 |
| `LOOK` | `SCHEME_CREATED`, `LOOK_QUALITY`, `LOOK_IMPROVED` | 300 |
| `SOCIAL` | `LIKE_RECEIVED`, `COMMENT_RECEIVED`, `SAVE_RECEIVED`, `COMMENT_HELPFUL` | **60** (corrige a divergência 2.1-1) |
| `CURATION` | `CATALOG_PIONEER`, `CATALOG_NEW_BRAND`, `CATALOG_CORRECTION_ACCEPTED`, `AI_CORRECTION_ACCEPTED` | 200 |
| `GAMES` | `GAME_PLAYED`, `GAME_WON`, `FLAIR_QUEST`, `CHALLENGE_VOTE_CAST` | 110 |
| Global | todas, exceto `ACHIEVEMENT`, `CHALLENGE_COMPLETED`, onboarding e streaks | suave 600 (acima: 50%), duro 1.000 |
| Sacável por mês | todas com `cashable = true` | 10.000 pts/usuário/mês (o excedente vira `EARNED_STANDARD`) |

## 6. Matriz por RF (RF1–RF47)

Legenda: **S** = sacável (RF48), **N** = não sacável, **—** = sem pontos (com motivo). "(ex.)" = regra existente.

| RF | Requisito | Ação que pontua | Regra | Pts | Teto | Sac. | Justificativa |
|---|---|---|---|---|---|---|---|
| RF1 | Cadastrar conta | Perfil completo (foto, bio, nome de usuário, estilo preferido) | `ONBOARD_PROFILE` | 20 | 1× | N | Onboarding; perfil completo melhora descoberta |
| RF1 | | E-mail verificado | `ONBOARD_EMAIL_VERIFIED` | 10 | 1× | N | Pré-requisito de criar (Guard) e de RF48 |
| RF2 | Autenticar | Ativar 2FA | `SECURITY_2FA_ON` | 30 | 1× | N | Segurança; exigido em RF48; desativar não estorna, reativar não repete |
| RF2 | | Login diário | — | — | — | — | Recompensa vazia; o hábito é premiado pelo Look do dia |
| RF3 | Conta, LGPD, notificações | Revisão de privacidade (checklist de visibilidade e sessões) | `PRIVACY_CHECKUP` | 10 | 1×/ano | N | Educa sobre privacidade sem tocar em consentimento |
| RF3 | | Aceitar consentimentos | — | — | — | — | LGPD: consentimento livre, sem incentivo |
| RF4 | Adicionar peça (formulário + buscador de marcas) | Ver §4.1 (etapas 1, 2, 6, 8) | `PIECE_CATALOGED` (rev.), `PIECE_COMPLETED`, `CATALOG_NEW_BRAND`, `PIECE_USER_PHOTO_APPROVED` | 15 / 10 / 30 / 10 | ver §4.1 | N/N/S/N | Volume não sacável; marca nova validada melhora o app |
| RF5 | Criar look | Ver §4.2 | `SCHEME_CREATED` (rev.), `LOOK_QUALITY` | 20 / 20–30 | 5/dia | N / S | Qualidade medida pelo LQS |
| RF6 | Lookbook | Curar um grupo/cápsula (≥ 5 itens, capa, nome) | `LOOKBOOK_CURATED` | 15 | 1/semana | N | Organização aumenta reuso |
| RF6 | | Cápsula completa | `CAPSULE_COMPLETED` | 150 | 1/mês | S | Guarda-roupa enxuto e versátil |
| RF7 | Detalhe da peça | Registrar uso no diário ("usei hoje") | `PIECE_WEAR_LOGGED` | 2 | 3/dia | N | Dado de uso para Inventory Score |
| RF7 | | Primeira vez usada / versátil | `PIECE_FIRST_WORN`, `PIECE_VERSATILE` | 15 / 25 | 5/dia, 2/dia | S | Prova de peça real e usada |
| RF8 | Buscar esquemas e peças | Buscar, seguir | — | — | — | — | Volume puro, fácil de automatizar |
| RF8 | | Primeiro look de outra pessoa salvo | `ONBOARD_FIRST_SAVE` | 5 | 1× | N | Ensina a salvar inspiração |
| RF9 | Editar esquema | Edição que sobe o LQS ≥ 15 | `LOOK_IMPROVED` | 10 | 3/dia | N | Incentiva refinar em vez de duplicar |
| RF10 | Copilot | Sugestão do Copilot usada como Look do dia | `COPILOT_SUGGESTION_WORN` | 10 | 1/dia | N | Fecha o ciclo de recomendação |
| RF10 | | Feedback do look do dia | `DAILY_FEEDBACK_GIVEN` | 3 | 1/dia | N | Treina o Copilot com dado do próprio usuário |
| RF11 | Background Studio | Primeiro fundo aplicado | `ONBOARD_FIRST_BACKGROUND` | 10 | 1× | N | Onboarding; recorrente não (custo de IA) |
| RF12 | Minhas fotos | Foto com peças marcadas e confirmadas | `PHOTO_TAGGED` | 5 | 5/dia | N | Liga foto ↔ peça (melhora busca) |
| RF13 | DNA de Estilo | DNA publicado com ≥ 6 looks de LQS ≥ 60 | `DNA_PUBLISHED` | 50 | 1/semana | S | Criação autoral de alto esforço |
| RF13 | | DNA remixado | `REMIX_RECEIVED` (ex.) | 10 | 10/dia | S | Validação de terceiros |
| RF14 | Aba Marcas | Seguir marcas | — | — | — | — | Consumo; evita "seguir por pontos" |
| RF15 | Editor Canvas 2D | Refinar imagem própria aprovada no pipeline | `PIECE_IMAGE_REFINED` | 5 | 3/dia | N | Só para foto própria (opcional) |
| RF16 | Geração 3D | Modelo 3D gerado | `PIECE_3D` (ex.) | 15 | 5/dia (novo) | N | Custo de API: nunca vira dinheiro |
| RF17 | Perfil de outros | Marcos de seguidores (25/100/500/1.000 únicos, contas ≥ 7 dias) | `FOLLOWER_MILESTONE` | 25–150 | 1× por marco | N | Seguidores são fáceis de fabricar |
| RF18 | Provador virtual de lojas | Prova salva que vira look | `TRYON_SAVED_TO_LOOK` | 10 | 3/dia | N | Consumo que gera criação |
| RF18 | | Primeira prova | `ONBOARD_FIRST_TRYON` | 10 | 1× | N | Onboarding |
| RF18 | | "Já tenho esta peça" → peça adicionada | `PIECE_CATALOGED` (rev.) | 15 | grupo `PIECE` | N | Reusa a regra da peça |
| RF19 | Interações sociais | Curtida / comentário / salvamento recebidos | `LIKE_RECEIVED` (ex.), `COMMENT_RECEIVED` (ex.), `SAVE_RECEIVED` | 1 / 2 / 2 | grupo `SOCIAL` 60/dia | N | Fácil de fabricar; só autores elegíveis |
| RF19 | | Comentário marcado "útil" pelo autor do look | `COMMENT_HELPFUL` | 5 | 3/dia | N | Premia quem comenta bem, não quem comenta muito |
| RF19 | | Remix recebido | `REMIX_RECEIVED` (ex., rev.) | 10 | 10/dia | S | Exige criação de outra pessoa |
| RF20 | Esquema vinculado a marca | Vínculo aceito pela marca | `SEAL_BOND_ACCEPTED` | 40 | 2/semana | S | Validação de terceiro com reputação |
| RF21 | Esquema vinculado a celebridade | Vínculo aceito pela celebridade | `SEAL_BOND_ACCEPTED` | 40 | 2/semana (mesmo teto) | S | Idem |
| RF22 | Aba Celebridades | Navegar | — | — | — | — | Consumo |
| RF23 | Preferências | Tamanhos e sistema de medidas preenchidos (não sensíveis) | `PREFS_COMPLETED` | 10 | 1× | N | Melhora o provador; medidas corporais **não** pontuam (consentimento `BODY_MEASUREMENTS`) |
| RF24 | Motor de IA | Correção de rótulo da IA (categoria, cor, marca) aceita | `AI_CORRECTION_ACCEPTED` | 3 | 10/dia, grupo `CURATION` | N | Melhora modelos; consentimento de treino **não** pontua |
| RF25 | Selo & promoção (marcas/celebridades) | Primeiro selo publicado | `ONBOARD_FIRST_SEAL` | 30 | 1× | N | Contas institucionais não sacam |
| RF26 | Explorador Global | Look em destaque editorial | `EXPLORER_FEATURED` | 50 | 1/semana | S | Curadoria humana |
| RF27 | Meu Quarto 3D | Organizar o quarto | `ROOM_ORGANIZED` (ex.) | 20 | 1/semana | N | Mantida |
| RF27 | | Primeira montagem do quarto | `ONBOARD_ROOM_SETUP` | 30 | 1× | N | Onboarding |
| RF28 | Smart Mirror + Vista-me | Look do Vista-me como Look do dia | `VISTA_ME_DAILY_LOOK` (ex.) | 15 | 1/dia | N | Mantida (soma com `DAILY_LOOK_LOGGED`; considerar reduzir para 10) |
| RF29 | Inventory Score, rankings | Conquistas | `ACHIEVEMENT` (ex.) | 100–500 | 1× | N | Bônus únicos previsíveis |
| RF29 | | Score sobe ≥ 50 pontos no mês | `SCORE_IMPROVED` | 30 | 1/mês | S | Uso real e sustentável do guarda-roupa |
| RF29 | | Revisão mensal do acervo (disponibilidade das peças) | `ACERVO_REVIEWED` | 15 | 1/mês | N | Dado fresco para Inventory Score |
| RF30 | Pontos, níveis, loja | Comprar, subir de nível | — | — | — | — | Nada por gastar (princípio 10) |
| RF31 | Estados do acervo | Peça circulada (à venda → vendida/doada) | `PIECE_CIRCULATED` | 10 | 2/semana | N | Circularidade |
| RF32 | Desafios | Desafio concluído | `CHALLENGE_COMPLETED` (ex.) | override 30–200 | 1×/desafio | S (sem inscrição paga e com julgamento por mérito) | Concurso de habilidade |
| RF32 | | Votar em desafio da comunidade | `CHALLENGE_VOTE_CAST` | 2 | 5/dia, grupo `GAMES` | N | Participação; ponto independe do voto |
| RF32 | | Criar desafio da comunidade com ≥ 10 participantes | `CHALLENGE_HOSTED` | 30 | 1/semana | S | Criação de conteúdo que engaja |
| RF32 | | Jogar | `GAME_PLAYED` (ex.) | 5 | 6/dia | N | Mantida |
| RF33 | Passarela 3D | Look do dia no Top 100 do país | `RUNWAY_TOP100` | 50 | 1/semana | S | Mérito reconhecido pela comunidade elegível |
| RF34 | Eras da celebridade | Era publicada com ≥ 5 looks | `ERA_PUBLISHED` | 30 | 1/mês | N | Conteúdo institucional |
| RF35 | Coleções da marca | Coleção publicada com ≥ 5 looks | `COLLECTION_PUBLISHED` | 30 | 1/mês | N | Conteúdo institucional |
| RF36 | Foto com meu manequim | Primeira foto | `ONBOARD_FIRST_MANNEQUIN` | 10 | 1× | N | Onboarding |
| RF37 | FLAIR | Jogar / vencer / quest | `GAME_PLAYED`, `GAME_WON`, `FLAIR_QUEST` (ex.) | 5 / 10 / 10 | 6 / 4 / 3 por dia | **N** | Aleatoriedade das cartas: não pode virar dinheiro (RF48 §13.2–13.3) |
| RF37 | | Combinação de loja resgatada | — | — | — | — | Já rende FLAIR Coins e cupom |
| RF38 | Cupons | Resgatar ou usar cupom | — | — | — | — | Nada por consumir/gastar |
| RF39 | Criar guarda-roupa 3D (marcas) | Item publicado na loja | `ROOM_ITEM_PUBLISHED` | 20 | 1/semana | N | Institucional; vendas não geram pontos ao vendedor |
| RF40 | Meu Avatar 3D | Criar avatar | — | — | — | — | Dado biométrico (LGPD art. 11): sem incentivo |
| RF41 | FAI Points em todos os jogos e criações | Motor desta tabela; sequências | `LOOK_STREAK_7`, `LOOK_STREAK_30` | 40 / 150 | 1/semana, 1/mês | N | Hábito saudável, com folga |
| RF42 | Look do dia | Registrar / vestido e aprovado / feedback | `DAILY_LOOK_LOGGED`, `LOOK_WORN_LOVED`, `DAILY_FEEDBACK_GIVEN` | 5 / 20 / 3 | 1/dia cada | N / S / N | Uso real; ADOREI fecha o ciclo |
| RF42 | | Receber doação (RF48) | bucket `DONATION_RECEIVED` | variável | limites do RF48 | parcial | Transferência P2P, não prêmio do sistema |
| RF43 | Autopiloto | Semana planejada cumprida (≥ 5 de 7 dias usados) | `WEEK_PLAN_COMPLETED` | 40 | 1/semana | N | Planejamento que vira uso |
| RF44 | Marcas vendem itens do quarto | Venda | — | — | — | — | A loja é ralo; vendedor não recebe pontos |
| RF45 | Imagens canônicas | Pedido de captura atendido | `CAPTURE_REQUEST_FULFILLED` | 5 | 5/dia | N | Melhora a imagem canônica |
| RF46 | FAI Creative Engine | (não implementado) | futuro `CREATIVE_ASSET_APPROVED` | — | — | N | Custo de IA; avaliar quando existir |
| RF47 | Acervo & Busca Catalogada | Pioneira / correção / peça do catálogo confirmada | `CATALOG_PIONEER`, `CATALOG_CORRECTION_ACCEPTED`, `PIECE_CATALOGED` (rev.) | 40 / 20 / 15 | 3/dia, 5/dia, 10/dia | S / S / N | Curadoria melhora o catálogo para todos |

## 7. Implementação (resumo técnico)

- `fai_points_rules` ganha `cashable`, `maturation_days` (V33, RF48) e, na V34, `cap_group`, `monthly_cap`,
  `min_account_age_days`, `diminishing_json` (ex.: `{"50":0.5,"200":0.2}` por mês) e a tabela `fai_points_cap_groups`.
- `FaiPointsService.award()`:
  1. `Guard`: conta ativa e e-mail verificado (não lança erro; só não pontua);
  2. trava `lockOwner` quando a regra é sacável ou tem grupo de teto;
  3. checa teto da regra, do grupo, global e mensal sacável; aplica retornos decrescentes;
  4. grava no bucket certo com `mature_at` (RF48).
- Novos disparos: `PIECE_FIRST_WORN`, `PIECE_VERSATILE` e `LOOK_WORN_LOVED` em `WardrobeEventListeners`
  (`recordUse`, `onDailyLook`, feedback do `DailyLookService`); `LOOK_QUALITY` em `onSchemeSaved` com o LQS calculado por
  um `LookQualityScorer` (reusa `FlairLooks`/`ColorMath`); curadoria (`CATALOG_*`) no fluxo de revisão do catálogo
  (RF47) e da fila `ai_review_items` (RF45); streaks num job diário.
- Mensagem da tela de Pontos: cada regra mostra pts, teto, "sacável" e o motivo de não pontuar.

## 8. Checagem da economia de pontos

### 8.1 Máximo por usuário por dia

| Grupo | Hoje (código) | Proposta |
|---|---|---|
| Peças | 250 + `PIECE_COMPLETED` e `PIECE_3D` **sem teto** (ex.: 100 peças = +2.500) | grupo `PIECE` 300 + `PIECE_FIRST_WORN` 75 + `PIECE_VERSATILE` 50 + `FORGOTTEN_RESCUED` 90 |
| Looks | 200 + 90 (esquecidas) + 15 | grupo `LOOK` 300 + 5 + 20 + 3 |
| Social | 650 (50 por ação) | 60 + remix 100 |
| Curadoria | — | 200 |
| Jogos | 100 | 110 |
| **Total teórico** | **≈ 1.300/dia + ilimitado** em peças completadas/3D | soma ≈ 1.400, **limitada pelo teto global: ~800/dia (600 + 50% de 400), duro 1.000** |

### 8.2 Usuário típico (estado estável, 1 mês)

| Atividade | Pts | Sacáveis |
|---|---|---|
| 6 peças novas (15) + 4 completadas (10) | 130 | 0 |
| 8 primeiras vezes usadas (15) + 2 marcos de versatilidade (25) | 170 | 170 |
| 12 looks (20) + bônus de qualidade médio 15 | 420 | 180 |
| 4 peças esquecidas resgatadas (30) | 120 | 120 |
| 18 looks do dia (5) + 15 feedbacks (3) + 6 ADOREI (20) + 1 streak de 7 (40) | 295 | 120 |
| 8 Vista-me (15) + 2 quartos organizados (20) | 160 | 0 |
| Social (60 curtidas, 10 comentários, 2 remixes) | 100 | 20 |
| Jogos (12 partidas, 4 vitórias, 5 quests) | 150 | 0 |
| 1 desafio concluído | 60 | 60 |
| **Total** | **≈ 1.600/mês** | **≈ 670/mês** |

Criador intenso (catálogo + looks de qualidade + remixes + tema da semana): ≈ 6.000/mês, dos quais ≈ 3.000 sacáveis.

### 8.3 Contra os níveis e a loja

- Níveis: Studio (300) em ~1 semana, Closet (2.000) em ~5 semanas, Maison (12.000) em ~7–8 meses para o usuário típico —
  próximo da calibração original (§5.3: "~1 semana até Studio, ~2 meses até Closet"). O criador intenso chega a Maison em
  ~2 meses: aceitável, pois nível só libera funções do quarto.
- Loja: itens de 0 a 1.200 pts (`room_catalog`; Signature 380–900, Edição Limitada 1.200). O típico compra 2–4 itens por
  mês. **Risco de inflação:** em 6 meses o típico acumula ~9.600 pts e esgota o catálogo atual. Recomendações: itens
  sazonais e edições limitadas mensais, preços que crescem com o nível, temas de quarto e fundos exclusivos (ralos sem
  efeito em ranking), e ajuste trimestral das regras com base no "pontos emitidos ÷ pontos gastos" (meta 1,2–1,5).

### 8.4 Contra o resgate (RF48)

- Taxa de referência do RF48: R$ 0,005/pt (piso R$ 0,002, teto R$ 0,010). Usuário típico: 670 sacáveis → **≈ R$ 3,35/mês**
  (chega ao mínimo de R$ 20 em ~6 meses). Criador intenso: 3.000 → **≈ R$ 15/mês** (R$ 30 no teto). Teto mensal sacável
  de 10.000 pts → no máximo R$ 50–100/mês por pessoa: o programa é reconhecimento, não renda, e a fraude rende pouco.
- Emissão sacável estimada: 10.000 criadores ativos × 670 = 6,7 M pts/mês; com fundo de R$ 20.000 → taxa bruta
  R$ 0,003, dentro da faixa. Se a emissão crescer mais rápido que a receita, a taxa cai até o piso e os pedidos excedentes
  são adiados (RF48 RN48.28) — o passivo nunca passa do fundo.

## 9. Seeds propostas

> Ordem: **V33** (RF48) cria `cashable`/`maturation_days` e os buckets; **V34** (este documento) cria grupos de teto e as
> regras novas. Valores são a calibração inicial.

```sql
-- V34__fai_points_regras_rf41_v2.sql
ALTER TABLE fai_points_rules
  ADD COLUMN cap_group VARCHAR(20) NULL,
  ADD COLUMN monthly_cap INT NULL,
  ADD COLUMN min_account_age_days INT NOT NULL DEFAULT 0,
  ADD COLUMN diminishing_json JSON NULL;

CREATE TABLE fai_points_cap_groups (
  group_code VARCHAR(20) PRIMARY KEY,
  daily_cap INT NOT NULL,
  description VARCHAR(200) NULL
);
INSERT INTO fai_points_cap_groups (group_code, daily_cap, description) VALUES
('PIECE',300,'Cadastro e completude de peças'),
('LOOK',300,'Criação e qualidade de looks'),
('SOCIAL',60,'Interações recebidas (curtida, comentário, salvamento) — 60/dia no total'),
('CURATION',200,'Curadoria do catálogo e correções de IA'),
('GAMES',110,'Jogos, quests e votos'),
('GLOBAL_SOFT',600,'Acima disso, 50%'),
('GLOBAL_HARD',1000,'Teto absoluto diário');

-- Revisões de regras existentes
UPDATE fai_points_rules SET points = 15, cap_group = 'PIECE', diminishing_json = '{"50":0.5,"200":0.2}',
       description = 'Peça ligada a produto do catálogo com variante confirmada, ou peça manual com completude >= 60%'
 WHERE action_code = 'PIECE_CATALOGED';
UPDATE fai_points_rules SET daily_cap = 10, cap_group = 'PIECE' WHERE action_code = 'PIECE_COMPLETED';
UPDATE fai_points_rules SET daily_cap = 5,  cap_group = 'PIECE' WHERE action_code = 'PIECE_3D';
UPDATE fai_points_rules SET points = 20, cap_group = 'LOOK',
       description = 'Criar look com pelo menos 2 peças reais do acervo' WHERE action_code = 'SCHEME_CREATED';
UPDATE fai_points_rules SET cap_group = 'SOCIAL', min_account_age_days = 0 WHERE action_code IN ('LIKE_RECEIVED','COMMENT_RECEIVED');
UPDATE fai_points_rules SET daily_cap = 10, cashable = TRUE, maturation_days = 30 WHERE action_code = 'REMIX_RECEIVED';
UPDATE fai_points_rules SET cap_group = 'GAMES' WHERE action_code IN ('GAME_PLAYED','GAME_WON','FLAIR_QUEST');
UPDATE fai_points_rules SET cashable = TRUE, maturation_days = 30 WHERE action_code IN ('FORGOTTEN_RESCUED','CHALLENGE_COMPLETED');

-- Regras novas (min_account_age_days vale para quem GANHA; a elegibilidade de quem interage é checada no listener)
INSERT INTO fai_points_rules
 (action_code, points, daily_cap, weekly_cap, once_per_ref, active, description, cashable, maturation_days, cap_group, monthly_cap, min_account_age_days) VALUES
-- peças (RF4, RF7, RF31, RF45, RF47)
('PIECE_FIRST_WORN',15,5,NULL,TRUE,TRUE,'Primeira vez que a peça é usada (diário de uso)',TRUE,30,NULL,NULL,7),
('PIECE_VERSATILE',25,2,NULL,TRUE,TRUE,'Peça presente em 5, 15 e 30 looks distintos (marcos)',TRUE,30,NULL,NULL,7),
('CATALOG_PIONEER',40,3,NULL,TRUE,TRUE,'Produto novo trazido ao catálogo e validado pela curadoria',TRUE,30,'CURATION',NULL,14),
('CATALOG_NEW_BRAND',30,NULL,2,TRUE,TRUE,'Marca nova resolvida e aceita no catálogo',TRUE,30,'CURATION',NULL,14),
('CATALOG_CORRECTION_ACCEPTED',20,5,NULL,TRUE,TRUE,'Correção de dados do catálogo aceita pela curadoria',TRUE,30,'CURATION',NULL,14),
('PIECE_USER_PHOTO_APPROVED',10,3,NULL,TRUE,TRUE,'Foto própria aprovada no pipeline de imagem',FALSE,0,'PIECE',NULL,0),
('CAPTURE_REQUEST_FULFILLED',5,5,NULL,TRUE,TRUE,'Pedido de captura adaptativa atendido',FALSE,0,'PIECE',NULL,0),
('PIECE_CIRCULATED',10,NULL,2,TRUE,TRUE,'Peça à venda arquivada como vendida/doada',FALSE,0,NULL,NULL,0),
('PIECE_WEAR_LOGGED',2,3,NULL,TRUE,TRUE,'Uso registrado no diário da peça',FALSE,0,NULL,NULL,0),
('PIECE_IMAGE_REFINED',5,3,NULL,TRUE,TRUE,'Imagem própria refinada no editor 2D',FALSE,0,'PIECE',NULL,0),
-- looks (RF5, RF6, RF9, RF13, RF20, RF21, RF26, RF33, RF42, RF43)
('LOOK_QUALITY',20,5,NULL,TRUE,TRUE,'Look com Look Quality Score >= 70 (override 30 se >= 85)',TRUE,30,'LOOK',NULL,7),
('LOOK_IMPROVED',10,3,NULL,TRUE,TRUE,'Edição que sobe o Look Quality Score em 15+',FALSE,0,'LOOK',NULL,0),
('DAILY_LOOK_LOGGED',5,1,NULL,TRUE,TRUE,'Look do dia registrado (qualquer origem)',FALSE,0,NULL,NULL,0),
('LOOK_WORN_LOVED',20,1,NULL,TRUE,TRUE,'Look do dia avaliado com ADOREI',TRUE,30,NULL,NULL,7),
('DAILY_FEEDBACK_GIVEN',3,1,NULL,TRUE,TRUE,'Feedback do look do dia',FALSE,0,NULL,NULL,0),
('LOOK_STREAK_7',40,NULL,1,TRUE,TRUE,'7 looks do dia em 8 dias',FALSE,0,NULL,NULL,0),
('LOOK_STREAK_30',150,NULL,NULL,TRUE,TRUE,'26 looks do dia em 30 dias',FALSE,0,NULL,1,0),
('LOOK_THEME_WEEK',50,NULL,1,TRUE,TRUE,'Look no tema da semana com qualidade >= 70',TRUE,30,NULL,NULL,7),
('CAPSULE_COMPLETED',150,NULL,NULL,TRUE,TRUE,'Cápsula de até 12 peças com 20+ looks distintos',TRUE,30,NULL,1,14),
('LOOKBOOK_CURATED',15,NULL,1,TRUE,TRUE,'Grupo/cápsula curado com capa e 5+ itens',FALSE,0,NULL,NULL,0),
('DNA_PUBLISHED',50,NULL,1,TRUE,TRUE,'DNA de Estilo publicado com 6+ looks de qualidade',TRUE,30,NULL,NULL,14),
('SEAL_BOND_ACCEPTED',40,NULL,2,TRUE,TRUE,'Vínculo do look aceito por marca ou celebridade',TRUE,30,NULL,NULL,14),
('EXPLORER_FEATURED',50,NULL,1,TRUE,TRUE,'Look em destaque editorial no Explorador',TRUE,30,NULL,NULL,0),
('RUNWAY_TOP100',50,NULL,1,TRUE,TRUE,'Look do dia no Top 100 do país na Passarela 3D',TRUE,30,NULL,NULL,14),
('COPILOT_SUGGESTION_WORN',10,1,NULL,TRUE,TRUE,'Sugestão do Copilot usada como look do dia',FALSE,0,NULL,NULL,0),
('WEEK_PLAN_COMPLETED',40,NULL,1,TRUE,TRUE,'Semana planejada cumprida (5 de 7 dias)',FALSE,0,NULL,NULL,0),
('TRYON_SAVED_TO_LOOK',10,3,NULL,TRUE,TRUE,'Prova do provador salva como look',FALSE,0,'LOOK',NULL,0),
-- social e comunidade (RF17, RF19, RF32)
('SAVE_RECEIVED',2,NULL,NULL,TRUE,TRUE,'Look salvo por outra pessoa',FALSE,0,'SOCIAL',NULL,0),
('COMMENT_HELPFUL',5,3,NULL,TRUE,TRUE,'Comentário marcado como útil pelo autor do look',FALSE,0,'SOCIAL',NULL,0),
('FOLLOWER_MILESTONE',0,NULL,NULL,TRUE,TRUE,'Marcos de seguidores únicos (25/100/500/1000; override)',FALSE,0,NULL,NULL,0),
('CHALLENGE_VOTE_CAST',2,5,NULL,TRUE,TRUE,'Voto em desafio da comunidade',FALSE,0,'GAMES',NULL,0),
('CHALLENGE_HOSTED',30,NULL,1,TRUE,TRUE,'Desafio da comunidade criado com 10+ participantes',TRUE,30,NULL,NULL,30),
-- conta, onboarding e qualidade de dados (RF1, RF2, RF3, RF6, RF8, RF11, RF12, RF18, RF23, RF24, RF25, RF27, RF29, RF34–RF36, RF39, RF45)
('ONBOARD_PROFILE',20,NULL,NULL,TRUE,TRUE,'Perfil completo',FALSE,0,NULL,NULL,0),
('ONBOARD_EMAIL_VERIFIED',10,NULL,NULL,TRUE,TRUE,'E-mail verificado',FALSE,0,NULL,NULL,0),
('SECURITY_2FA_ON',30,NULL,NULL,TRUE,TRUE,'Verificação em duas etapas ativada',FALSE,0,NULL,NULL,0),
('PRIVACY_CHECKUP',10,NULL,NULL,TRUE,TRUE,'Revisão anual de privacidade',FALSE,0,NULL,NULL,0),
('ONBOARD_FIRST_SAVE',5,NULL,NULL,TRUE,TRUE,'Primeiro look de outra pessoa salvo',FALSE,0,NULL,NULL,0),
('ONBOARD_FIRST_BACKGROUND',10,NULL,NULL,TRUE,TRUE,'Primeiro fundo do Background Studio',FALSE,0,NULL,NULL,0),
('ONBOARD_FIRST_TRYON',10,NULL,NULL,TRUE,TRUE,'Primeira prova no provador',FALSE,0,NULL,NULL,0),
('ONBOARD_FIRST_MANNEQUIN',10,NULL,NULL,TRUE,TRUE,'Primeira foto com o manequim',FALSE,0,NULL,NULL,0),
('ONBOARD_ROOM_SETUP',30,NULL,NULL,TRUE,TRUE,'Primeira montagem do quarto',FALSE,0,NULL,NULL,0),
('ONBOARD_FIRST_SEAL',30,NULL,NULL,TRUE,TRUE,'Primeiro selo publicado (marca/celebridade)',FALSE,0,NULL,NULL,0),
('PHOTO_TAGGED',5,5,NULL,TRUE,TRUE,'Foto com peças marcadas e confirmadas',FALSE,0,NULL,NULL,0),
('PREFS_COMPLETED',10,NULL,NULL,TRUE,TRUE,'Tamanhos e sistema de medidas preenchidos',FALSE,0,NULL,NULL,0),
('AI_CORRECTION_ACCEPTED',3,10,NULL,TRUE,TRUE,'Correção de rótulo da IA aceita',FALSE,0,'CURATION',NULL,0),
('SCORE_IMPROVED',30,NULL,NULL,TRUE,TRUE,'Inventory Score subiu 50+ no mês',TRUE,30,NULL,1,30),
('ACERVO_REVIEWED',15,NULL,NULL,TRUE,TRUE,'Revisão mensal de disponibilidade do acervo',FALSE,0,NULL,1,0),
('ERA_PUBLISHED',30,NULL,NULL,TRUE,TRUE,'Era da celebridade publicada (5+ looks)',FALSE,0,NULL,1,0),
('COLLECTION_PUBLISHED',30,NULL,NULL,TRUE,TRUE,'Coleção da marca publicada (5+ looks)',FALSE,0,NULL,1,0),
('ROOM_ITEM_PUBLISHED',20,NULL,1,TRUE,TRUE,'Item do guarda-roupa 3D publicado na loja',FALSE,0,NULL,NULL,0);
```

Observações sobre a seed:
- Regras de 1× (onboarding) usam `once_per_ref = TRUE` com `ref_id` fixo (ex.: `"ONBOARD"`), assim a chave de
  idempotência `user:ação:ref` garante uma única concessão.
- `monthly_cap = 1` exige que `award()` passe a contar no mês (hoje só conta dia e semana).
- `FOLLOWER_MILESTONE` usa override (25, 50, 100, 150 por marco), como `ACHIEVEMENT`.

## 10. Critérios de aceite (RF41 v2)

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF41v2.CA01 | usuária recebe 40 curtidas e 15 comentários de contas elegíveis no dia | o listener processa | ganha no máximo 60 pts no grupo `SOCIAL` |
| RF41v2.CA02 | usuária adiciona 30 peças do catálogo num dia | o listener processa | `PIECE_CATALOGED` paga 10 vezes (teto) e o grupo `PIECE` nunca passa de 300 |
| RF41v2.CA03 | look salvo com LQS 88 | o esquema é criado | ganha `SCHEME_CREATED` 20 (não sacável) e `LOOK_QUALITY` 30 (sacável, em maturação por 30 dias) |
| RF41v2.CA04 | look idêntico (similaridade ≥ 0,92) a outro dos últimos 90 dias | é salvo | não ganha `LOOK_QUALITY` e a tela explica o motivo |
| RF41v2.CA05 | peça usada pela primeira vez num look do dia | o diário registra | `PIECE_FIRST_WORN` +15 uma única vez por peça |
| RF41v2.CA06 | correção de catálogo enviada | a curadoria aceita | `CATALOG_CORRECTION_ACCEPTED` +20 para quem enviou primeiro; recusada não pontua |
| RF41v2.CA07 | usuária aceita consentimento de treino de IA ou cria avatar 3D | a ação conclui | nenhum ponto é concedido |
| RF41v2.CA08 | usuária já ganhou 600 pts no dia | ganha mais uma regra de 20 | recebe 10 (50%); acima de 1.000 no dia recebe 0 |
| RF41v2.CA09 | partida de FLAIR vencida | `game()` roda | os pontos caem em `EARNED_STANDARD` (não sacáveis) |
| RF41v2.CA10 | duas chamadas simultâneas de uma regra sacável na última vaga do teto | ambas rodam | só uma pontua (trava do usuário) |
| RF41v2.CA11 | conta suspensa ou com e-mail não verificado | faz ação elegível | a ação acontece, sem pontos, e a tela diz por quê |

## 11. Decisões em aberto

1. Valores e tetos finais (calibrar com dados reais de 30 dias de uso).
2. Se `VISTA_ME_DAILY_LOOK` (15) deve somar com `DAILY_LOOK_LOGGED` (5) ou ser substituída.
3. Fórmula final do LQS e limiar (70/85).
4. Se desafios de comunidade com votação aberta são sacáveis já na F2 do RF48 ou só depois de medir fraude de votos.
5. Retornos decrescentes: por mês corrido ou janela móvel de 30 dias.
