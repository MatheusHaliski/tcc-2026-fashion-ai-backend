# Retirada do Quarto 3D (Meu Quarto) — inventário e decisões

Data: 15/11/2026. Pedido da dona, nas palavras dela: **"Retire totalmente o Quarto 3D do app FashionAI."** Esclarecimento
seguinte: **"Mantenha apenas o Acervo (nova opção para visualizar guarda-roupa em perspectiva)."**

Leitura do pedido: o quarto da pessoa (a tela `/room`, a visão em 3D que estava no Atelier › Quarto, a loja de móveis e
acabamentos vendidos por FAI Points, o criador de guarda-roupas das marcas, os assets do quarto no painel admin e a API
do quarto) sai do produto. O **ACERVO** (`/acervo`, `docs/acervo/ACERVO.md`) passa a ser o único lugar para ver o
guarda-roupa em perspectiva. Ficam: o Espelho (`/mirror`), o Guarda-roupa e as listas de peças (`/closet`, `/pieces/…`),
o Provador (`/try-on`), o visualizador e o editor 3D da peça, o editor de roupas do FAI Atelier, os jogos FLAIR e o
código do Heist/Afterparty (jogo de console Glass Empire). As "salas" dos jogos são cenas de jogo, não o quarto.

Este documento foi escrito **antes** de apagar qualquer coisa (inventário primeiro) e é atualizado no fim com os números
finais (seção 16). Veredito: **remover**, **manter** (com quem usa) ou **mover** (para onde).

## 1. Rotas do frontend

| Rota | O que é hoje | Veredito |
|---|---|---|
| `/room` (`app/(site)/(app)/room/page.tsx`) | Página que só redireciona: sem parâmetro → `/atelier?tab=room&quarto=3d`; `?espelho=1[&vestir][&vista]` → `/mirror…`; `?piece=` → `/closet` | **manter como redirecionamento**: sem parâmetro passa a levar a `/acervo`; espelho e peça continuam como hoje |
| `/atelier?tab=room[&quarto=3d][&modulo=…]` | Aba "Conquistas & Quarto" do Atelier: quarto em 3D, recompensas e instalação de objetos comprados | **remover a aba do quarto**; `/atelier?tab=room…` → `/acervo` (redirecionamento do servidor, `lib/nav/legacy-redirects.ts`). As recompensas (troféus habitáveis, poder de direção, obra coletiva, convites de temporada) **mudam** para a nova aba "Conquistas" (`/atelier?tab=rewards`), sem a parte do quarto |
| `/admin/room-assets` | Painel admin de assets 3D do quarto (gerar com Meshy, importar, revisar, publicar na loja) | **remover** (e o link no painel do admin) |
| `/points/loja` | Loja física (resgate de produtos) + "Loja do quarto" (RoomStore) | **manter a rota**; sai só o cartão "Loja do quarto" |
| `/brands/[slug]?tab=GUARDA_ROUPA` | Aba da marca: criador de guarda-roupas (dona/admin) ou loja da marca (visitante) | **remover a aba** (a marca continua com as outras abas) |
| `/flair/jogos?district=SUITE`, `/flair/jogos/a01-espelho-partido` | Redirecionavam para o quarto em 3D do Atelier | **mudar destino** para `/acervo` |

## 2. Endpoints

`RoomController` (tag "RF32 — Meu Quarto"), todos **remover**:

| Método | Caminho | Observação |
|---|---|---|
| GET | `/api/me/room` | Quarto: módulos, nível, decorações, peças por endereço |
| GET | `/api/users/{ownerId}/room-tour` | Visitar o quarto de alguém com a chave |
| POST | `/api/me/room/keys` | Dar a chave do quarto |
| GET | `/api/me/room/list` | Visão em lista do quarto |
| GET | `/api/me/room/modules/{moduleId}` | Abrir porta/gaveta |
| PUT | `/api/pieces/{pieceId}/room-address` | Mover peça para um endereço do quarto |
| PUT | `/api/me/room/drawers/{drawer}` | Renomear gaveta |
| GET | `/api/pieces/{pieceId}/room-location` | Onde está a peça no quarto |
| POST | `/api/me/room/season-storage` | Baú de estação |
| GET | `/api/me/room/organization/preview` | Prévia da organização automática |
| POST | `/api/me/room/organization` | Aplicar organização |
| DELETE | `/api/me/room/organization` | Desfazer organização |
| GET | `/api/pieces/{pieceId}/tag` | Etiqueta da peça (composição, cuidados, diário, local no quarto). **Limítrofe**: nenhuma tela chama; só `scripts/e2e/suite_3.py` |
| POST | `/api/pieces/{pieceId}/diary` | Registro manual de uso no diário. **Limítrofe**: nenhuma tela chama; "usei" continua por `POST /api/pieces/{id}/worn` e pela lavanderia |
| POST | `/api/me/room/island` | Ilha central (comparar esquemas, Loft) |
| PUT | `/api/me/room/light` | Luz do quarto |
| PUT | `/api/me/room/monogram` | Monograma do quarto |

`RoomCreatorController` (criador de guarda-roupas das marcas), todos **remover**: `GET /api/room-creator/options`,
`GET /api/room-creator/items`, `POST /api/room-creator/items`, `PUT /api/room-creator/items/{sku}`,
`DELETE /api/room-creator/items/{sku}`, `POST /api/room-creator/uploads`.

`AdminRoomAssetController`, todos **remover**: `GET /api/admin/room-assets`, `POST /api/admin/room-assets`,
`POST /api/admin/room-assets/import-meshy`, `POST /api/admin/room-assets/{id}/review`,
`POST /api/admin/room-assets/{id}/publish`.

`HighlightsController` (a loja do quarto), **remover** só estes: `GET /api/points/shop`,
`POST /api/points/shop/{sku}/try-on`, `POST /api/points/shop/{sku}/purchase`,
`POST /api/me/room-inventory/{inventoryId}/apply`, `DELETE /api/me/room-inventory/{inventoryId}/apply`. O resto do
controller (Destaques, Inventory Score, `/api/me/points`, conquistas) **manter**.

`AdminCatalogController`, **remover** só os itens da loja do quarto: `GET /api/admin/catalog/store`,
`GET /api/admin/catalog/store/{sku}`, `PATCH /api/admin/catalog/store/{sku}`,
`POST /api/admin/catalog/store/{sku}/activate`, `POST /api/admin/catalog/store/{sku}/deactivate`,
`GET /api/admin/catalog/room-items`. Nenhuma tela chama esses seis. O resto do catálogo admin **manter**.

Total: 17 + 6 + 5 + 5 + 6 = **39 endpoints removidos**. Quem chamava: as telas listadas na seção 3,
`scripts/e2e/suite_3.py`, `scripts/e2e/shoot22.js`, `scripts/e2e/table.py`, `scripts/flair-demos/mock-api.mjs` e as
tabelas de endpoints dos docs (seção 13).

## 3. Frontend: componentes, libs e hooks

| Arquivo | Veredito |
|---|---|
| `components/room3d/room-scene.tsx`, `room-view.tsx`, `room-avatar-controller.tsx`, `room-furniture.tsx`, `room-scene-controls.tsx`, `room-settings-panel.tsx`, `room-controls-tutorial.tsx`, `room-store.tsx`, `wardrobe-creator.tsx`, `wardrobe-preview.tsx`, `hung-garment.tsx`, `approved-asset.tsx`, `mirror-hands.tsx` e os testes deles | **remover**. `hung-garment` e `approved-asset` só servem à cena do quarto; `mirror-hands` só é importado pelo próprio teste |
| `components/room3d/piece-model-viewer.tsx` (+ teste) | **mover** para `components/piece3d/piece-model-viewer.tsx`: é o visualizador 3D da peça, usado pela peça expandida (`components/expanded-card/expanded-piece.tsx`), pelo catálogo (`components/catalog/catalog-model3d.tsx`) e pelo passaporte digital (`components/passport/digital-passport.tsx`) |
| `components/room3d/room-props.tsx` | **mover** o que o Afterparty usa (`FaiNeonSign`, `FaiRug`, `Label3D`, `Lamp`, `RoomDoor`, `RoomWindow`, `Sparkles`) para `components/three/scene-props.tsx`; o resto (móveis do quarto) **remover** |
| `lib/room3d/mirror-session.ts` | **mover** `assetStateOf` (estado do modelo 3D/foto da peça, usado por `components/mirror/mirror-controls.tsx` e `mirror-part-sheet.tsx`) para `lib/mirror/asset-state.ts`; a sessão do espelho dentro do quarto **remover** |
| `lib/room3d/camera-views.ts`, `cloth-motion.ts`, `interaction.ts`, `room-bounds.ts`, `room-settings.ts` e testes | **remover** (motor do quarto) |
| `components/atelier/room-panel.tsx`, `room-3d-section.tsx` (+ teste), `lib/atelier/room-3d.ts` | **remover**; as recompensas do painel vão para `components/atelier/rewards-panel.tsx` |
| `components/atelier/atelier-hub.tsx`, `components/atelier-projects/atelier-workspace.tsx`, `lib/atelier/types.ts` | **manter**, trocando a aba `room` por `rewards` e o link "Ver o quarto em 3D" por "Abrir o ACERVO" (`/acervo`) |
| `app/(site)/(app)/admin/room-assets/page.tsx` (+ teste) | **remover** |
| `app/(site)/(app)/brands/[slug]/page.tsx` | **manter**, sem a aba Guarda-roupa |
| `components/points/sections.tsx`, `components/points/hub.tsx`, `lib/points/hub.ts` | **manter**, sem a loja do quarto: `/points/loja` mostra a loja física; o modo "Loja" da Central de pontos deixa de contar itens do quarto e usa o guia geral de FAI Points |
| `components/mirror/mirror-controls.tsx`, `mirror-part-sheet.tsx` | **manter**; sai a opção "Mostrar no quarto" (`showInRoom`), que só o quarto preenchia |
| `app/(site)/(app)/challenges/page.tsx` | **manter**; sai o texto "decoração no quarto" do desafio |
| `app/(site)/(app)/admin/dashboard/page.tsx` | **manter**; sai o link "Assets do quarto" |
| `app/(site)/(app)/settings/page.tsx` | **manter**; o "som do quarto" (`soundEnabled`) é preferência do servidor usada por outras telas: só o texto muda se citar o quarto |
| `components/guide/guide-demos.tsx`, `lib/guides/registry.ts` | **manter**; sai o guia `shop.room` (Loja do quarto) e o exemplo `ShopDemo` |
| `components/studio.tsx` | **manter**; usa chaves `room3d.wardrobeCreator.*`/`room.composicao` como rótulos: as que o estúdio usa ficam |
| `lib/fashion-card/aura-gating.ts` (`RoomTier`) | **manter**: é o nome do tipo dos níveis de FAI XP (Básico/Studio/Loft), não o quarto |
| `lib/mirror/mirror-list.ts`, `lib/nav/mirror-href.ts`, `lib/nav/active-override.ts`, `lib/input/gamepad.ts` | **manter**; comentários que tratam o quarto como atual são corrigidos |

Hooks: o quarto não tem hook próprio fora de `components/room3d` (o estado vivia nos componentes e em `lib/room3d`).

## 4. Backend: serviços, entidades, repositórios, eventos

| Item | Veredito |
|---|---|
| `RoomService` (1436 linhas), `RoomPlacementRules`, `application/room/RoomAddress` | **remover** depois de desembaraçar (seção 5) |
| `WardrobeCreatorService` | **remover**; `identity(User)` (nome, logo e slug de marca/celebridade) **mover** para `SellerIdentity` (usada pela loja física em `PhysicalStoreViews`) |
| `RoomAssetService` | **remover** (assets do quarto) |
| Entidades `RoomCatalogItem`, `RoomInventoryItem`, `RoomLayout`, `RoomStorageEntry` e repositórios | **remover** do código (as tabelas ficam: seção 15) |
| `FaiPointsService` | **manter** saldo, níveis, extrato, jogos; **remover** a loja (`shop`, `tryOn`, `buy`, `apply`, `unapply`, `releaseDisplaced`, `RoomLayoutAccess`). Subir de nível deixa de gravar o nível no `room_layouts` |
| `DomainEvents.RoomOrganized`, `WardrobeEventListeners.onRoomOrganized` (pontos `ROOM_ORGANIZED`), `InventoryScoreService.invalidate(RoomOrganized)` | **remover** (só o quarto publicava) |
| `NotificationType.ROOM_LEVEL_UP` | **manter a constante** (notificações antigas no banco ainda têm esse tipo); a notificação de nível passa a dizer "Você chegou ao nível X" sem citar o quarto |
| `PipelineJobType.ROOM_ASSET_GENERATION` | **manter a constante** (linhas antigas de `pipeline_jobs`); ninguém mais cria esse tipo |
| `ChallengeTemplate.roomDecoration` (coluna `challenge_templates.room_decoration`) | **manter o campo** (dado); a API e a tela deixam de mostrar a decoração no quarto |
| `MysqlDemoDataAdminAdapter` (dados de demonstração) | **manter**; deixa de semear/limpar `room_catalog` |
| Chaves `room.*` dos `messages*.properties` | **remover** as que só o quarto usa; as do Espelho e do Copilot ficam ou mudam para um nome neutro |

## 5. Funcionalidades que liam dados do quarto (desembaraço)

Cada uma ganha (ou reaproveita) um teste de caracterização antes da mudança. O que muda é só a parte do quarto.

| Funcionalidade | O que lia do quarto | Como fica |
|---|---|---|
| Espelho (`MirrorService`) | Endereço da peça no quarto (`address`, `addressLabel`, `moduleId`) na lista, no Vista-me e no "Arrume-se Comigo"; peças no baú de estação ficavam fora do Vista-me; `OUTERWEAR` de `RoomPlacementRules` | O lugar da peça vem do **ACERVO** (compartimento, caminho "Ambiente / Móvel / Compartimento" e móvel), com as mesmas chaves no JSON; peça sem lugar no ACERVO fica sem endereço, como antes. O baú de estação era do quarto: **sai** (nenhuma peça fica de fora por estação). `OUTERWEAR` passa para uma constante própria do espelho |
| Copilot (`CopilotService`) | "Onde está meu tênis?" respondia com o endereço do quarto (e criava um endereço automático se faltava) e `roomHighlight`; chips com endereço; peças esquecidas pela régua do quarto; sugestões da vista `QUARTO` | Responde com o lugar no **ACERVO** ("está em Closet / Armário 01 / Gaveta 1"; sem lugar: "posição desconhecida"). `roomHighlight` e as sugestões da vista `QUARTO` **saem**. A régua de "esquecida" (60 dias) passa para `ForgottenPieces`, sem mudança |
| Inventory Score (`InventoryScoreService`) | Dimensão O (Organização): coerência do endereço no quarto (50%) + gavetas com rótulo (30%) + revisão de indisponíveis (20%); ação "Mostrar no quarto"; "Abrir Meu Quarto" | Coerência passa a ser medida no **ACERVO** (o tipo do compartimento onde a peça está bate com o tipo que o ACERVO espera para a peça; peça sem lugar não conta, como antes). Rótulo de gaveta era do quarto: a parte vale 100% (o ACERVO sempre tem nome no compartimento) e a dica "gavetas sem rótulo" sai. As ações viram "Ver no ACERVO" e "Abrir o ACERVO" (`/acervo`) |
| Desafios (`ChallengeService`) | Decoração do desafio no quarto (`DecorationsProvider`, `roomDecoration`); convite permitido a quem segue **ou** a quem tem a chave do quarto; datas do diário de uso | Decoração **sai** da API e da tela; convite só para quem a pessoa segue (a chave era do quarto); as datas de uso vêm de `PieceUsageDiary` (mesma consulta ao diário) |
| Guarda-roupa (`WardrobeEventListeners`, `WardrobeService`) | `FORGOTTEN_DAYS`; pontos `ROOM_ORGANIZED` | Régua em `ForgottenPieces`; o ouvinte de `RoomOrganized` **sai** |
| Hype (`HypeQueryService`) | `RoomService.FORGOTTEN_DAYS` | `ForgottenPieces.FORGOTTEN_DAYS` (mesmo valor) |
| Insights (`PersonalInsights`) | `forgotten`, `FORGOTTEN_DAYS`, `ZONE` | `ForgottenPieces` e `FaiPointsService.ZONE` (mesmos valores) |
| Destaques (`HighlightsController`) | Endpoints da loja do quarto | Saem os cinco endpoints da loja; o resto fica igual |
| Catálogo admin (`AdminCatalogService`) | Itens da loja e inventário do quarto | Saem os seis endpoints; o resto fica igual |
| Loja física (`PhysicalStoreViews`) | `WardrobeCreatorService.identity` | `SellerIdentity.identity` (mesmo código) |
| Página da marca (`brands/[slug]`) | Aba Guarda-roupa (criador e loja da marca) | Aba **sai** |
| FAI Points (`/points`, `FaiPointsService`) | Loja do quarto; nível gravado no quarto; notificação "seu quarto evoluiu" | Loja do quarto **sai**; nível continua (aura, loja física, FLAIR usam); a notificação fala do nível |

## 6. FAI Points: regras e loja

- Regras ligadas ao quarto em `fai_points_rules`: `ROOM_ORGANIZED` (20 pts, organizar o quarto), `SHOP_PURCHASE` e
  `SHOP_SALE` (compra e venda na loja do quarto). Nenhum código passa a usá-las; **a migração que as desliga é só
  proposta** (seção 15).
- Itens da loja: tabela `room_catalog` (fábrica FAI semeada no início do servidor por `WardrobeCreatorService.seedFactory`,
  itens de marcas e os itens criados pela V98 para a Cidade de Vidro). A semeadura sai junto com o serviço.
- Itens comprados: `room_inventory`. Ficam como estão nas contas; nada é reembolsado automaticamente.
- Níveis (Básico/ESTREIA, Studio, Loft) **ficam**: além do quarto, liberam auras (`AuraPermissionsService`), itens da loja
  física (`PhysicalStoreService`) e a metamorfose FLAIR (`FlairAdventureService`). Os textos de "o que o nível libera" que
  citam o quarto são revisados.

## 7. Notificações, guias, onboarding e menus

| Item | Veredito |
|---|---|
| Notificação `ROOM_LEVEL_UP` "Seu quarto evoluiu" | **manter o tipo**, novo texto sem o quarto |
| Notificação de extrato `faiPoints.extrato.SHOP_PURCHASE`/`SHOP_SALE`/`ROOM_ORGANIZED` | **manter** as chaves (o extrato antigo continua legível) |
| Guia `shop.room` ("Loja do quarto") e o exemplo `ShopDemo` | **remover**; o modo Loja da Central de pontos usa o guia `points.fai` |
| Demonstração gravada `public/points/demos/store.{mp4,webm,jpg}` (mostra a loja do quarto) | **remover**; o modo Loja fica sem vídeo ("demonstração indisponível") até gravar a loja física |
| Tutorial de controles do quarto (`room-controls-tutorial.tsx`) | **remover** |
| Menu lateral | `/room` já não estava no menu; o Guarda-roupa já tem `/acervo` (`lib/nav/nav-items.ts`): sem mudança |
| Ícone `lib/icons/fai-icons.json` (glyph `room`, rota `/room`; ação `showInRoom`) | **manter** o ícone (catálogo de ícones), rota trocada para `/acervo` |
| Onboarding (`components/onboarding.tsx`) | Não cita o quarto: sem mudança |

## 8. i18n

Namespaces do frontend: `room.*` (282 chaves), `room3d.*` (166), `roomAssets.*` (30), `atelier.room.*` (20), `guide.shop.room.*`
(6), `points.loja_do_quarto` e chaves soltas (`atelier.visitRoom`, `atelier.tab.room`, `atelier.help.room`,
`mirror.sheet.mostrar_no_quarto`, `pieces.id.mostrar_no_quarto`, `nav.room`, `fitting.backToRoom`…). **Remover** só as que
nenhum código sobrevivente usa — o Espelho usa `room.mirror.*`, o estúdio usa `room.composicao` e algumas
`room3d.wardrobeCreator.*`, e essas **ficam**. As três línguas recebem as mesmas chaves (`node scripts/i18n/check.js
--fail`). Backend (`messages*.properties`): sai o que só `RoomService`, `WardrobeCreatorService`, `RoomAssetService` e a
loja usavam.

## 9. CSS

`app/(site)/_styles/07-meu-quarto.css`: **remover** as regras do quarto (`.room3d*`, `.room-pad-*`, `.room-gamepad`,
`.room-settings*`, `.room-key`, `.room-context-prompt`, `.room-view*`, `.mirror-hands*`, `.atelier-room-3d*`). As regras
que não são do quarto e moravam no mesmo arquivo (`.feed-compact-grid` do feed e `.blocks-plate`/`.brick-*` das anatomias
e do cartão DNA) **ficam**, e o arquivo passa a se chamar `07-feed-e-blocos.css`. `.room3d-stage[data-filter]` e
`.room3d-dof` em `10-dashboard-detalhes.css` (modo foto do quarto): **remover**. `.room-flat-mirror*` em
`15-provador-espelho.css` é o palco do Espelho em `/mirror`: **manter**.

## 10. Assets

| Arquivo | Tamanho | Veredito |
|---|---|---|
| `public/models/fai-room/bed-fai.glb` | 11.290.744 bytes | **remover** (cama do quarto) |
| `public/models/fai-room/rack-fai.glb` | 9.904.832 bytes | **remover** (arara do quarto) |
| `public/points/demos/store.mp4`, `store.webm`, `store.jpg` | 366.747 + 350.942 + 92.869 bytes | **remover** (gravação da loja do quarto) |
| `public/flair/games/scenes/quarto-noite.webp`, `showroom.webp`, `suite-espelho` (créditos) | — | **não é do quarto**: cenários de jogo FLAIR (fora deste trabalho) |
| `docs/room/screenshots/*`, `docs/evidencias/quarto-espelho-2026-10-10/*` e outras imagens em `docs/` | — | **manter** (história; os docs ganham a nota de retirado) |

## 11. Testes

Frontend: os testes de `components/room3d` (exceto `piece-model-viewer.test.tsx`, que vai junto para
`components/piece3d`), de `lib/room3d`, `components/atelier/room-3d-section.test.tsx`,
`app/(site)/(app)/admin/room-assets/page.test.tsx` e `components/catalog/fitting-room.test.tsx` só se ele testar o quarto
(é do Provador: **manter**). Atualizados: `app/mirror-redirect.test.tsx`, `components/atelier/atelier-hub-tendencias.test.tsx`,
`components/atelier/atelier-panels.test.tsx`, `components/atelier-projects/atelier-projects.test.tsx`,
`components/points/hub.test.tsx`, `app/notifications-points.test.tsx`, `components/guide/guide-demos.test.tsx`,
`lib/nav/legacy-redirects.test.ts`, `components/mirror/*`.

Backend: **remover** `RoomServiceTest`, `RoomPlacementRulesTest`, `RoomPlacementCharacterizationTest`,
`RoomInventoryApplyTest`, `RoomAssetServiceTest`, `RoomAddressTest`, `WardrobeCatalogTest`, `WardrobeCreatorServiceTest`,
`FaiPointsShopTest`. **Atualizar** `FaiPointsServiceContaTest`, `FaiPointsStatementTest`, `MirrorServiceTest`,
`MirrorScoresTest`, `MirrorWardrobePickerTest`, `CopilotAnswerTest`, `ChallengeServiceTest`, `InventoryScoreServiceTest`,
`HypePersonalDataTest`, `InsightServiceTest`, `InsightNewContextsTest`, `WardrobeEventListenersTest`,
`PhysicalStore*Test`, `MemoryRepository`, `ServiceFakes`/`ControllerDelegacaoTest`.

## 12. Scripts e fixtures

| Script | Veredito |
|---|---|
| `scripts/e2e/suite_3.py` (passos RF27/RF30/RF39 do quarto, da loja e do criador) | **remover os passos do quarto**; o resto fica |
| `scripts/e2e/shoot22.js` (telas `ui_quarto`, `ui_fai_points_loja`, `ui_marca_guarda_roupa_3d`) | **remover** as entradas do quarto e do criador; a loja fica sem o endpoint da loja do quarto |
| `scripts/e2e/table.py` (`room_layouts` → `GET /api/me/room`) | **remover** a linha |
| `scripts/flair-demos/mock-api.mjs` (loja e aplicar item) | **remover** as rotas da loja do quarto |
| `scripts/avatar3d/nunca-sem-roupa-e2e.mjs`, `scripts/diagramas/*`, `scripts/rubricas/*`, `scripts/docs/*`, `scripts/refactoring/*` | Citam o quarto em texto ou em listas de inventário de documentação: **manter** (geram documentação histórica) salvo o que quebrar |

## 13. Documentação

Docs do quarto (ganham "retirado em 15/11/2026" no topo, a história fica): `docs/room/GAMEPLAY_FAI_ASSETS.md`,
`docs/room/ROOM_STORAGE_500.md`, `docs/meu-quarto/05-elementos-do-quarto.md`, `docs/meu-quarto/06-prova-no-espelho.md`,
`docs/meu_guarda_roupa/01-especificacao-meu-quarto.md`, `markdowns/01-especificacao-meu-quarto.md`,
`docs/aura/AUDITORIA_LOJA_QUARTO_SELOS_2026-10-25.md`, `docs/aurora_cps/digital-twin-do-quarto-real.md`,
`docs/banco-de-dados/solucoes/07-iluminacao-quarto.md`, `docs/refactoring/gof/reducao/R90-flair-3d-quarto.md`.
Atualizados por descreverem o quarto como atual: `docs/flair/ENDPOINTS_FLAIR.md` (a saída B levou o quarto ao Atelier),
`docs/auditoria/AUDITORIA_APP_2026-11-14.md` ("FAI Points e Loja do quarto"), `docs/acervo/ACERVO.md`,
`docs/flair/ESTRUTURA_FLAIR.md`. Os outros ~140 docs que citam o quarto (diagramas RF27/RF30/RF39, aulas, tabelas de
estudo, evidências) são registros datados: ficam como estão.

## 14. Outras vistas do guarda-roupa em perspectiva (esclarecimento da dona)

| Vista | Onde | Veredito |
|---|---|---|
| Quarto 3D (guarda-roupa FAI Origem, gavetas, araras, cama) | `components/room3d/room-scene.tsx` | **remover** |
| Prévia 3D do guarda-roupa da loja/criador | `components/room3d/wardrobe-preview.tsx`, `wardrobe-creator.tsx` | **remover** |
| Visão em lista do quarto (endereços) | `GET /api/me/room/list` | **remover** |
| Guarda-roupa / Minhas peças (`/closet`), página da peça (`/pieces/[id]`) | grade e listas planas | **manter** |
| Espelho (`/mirror`), Provador (`/try-on`, cabine e rua de lojas em `components/three`) | prova de roupa, não vista do guarda-roupa | **manter** |
| Visualizador/editor 3D da peça (`piece-model-viewer`, `components/piece3d`, `components/atelier3d`) | uma peça, não o guarda-roupa | **manter** |
| Exemplos dos guias ("Como funciona") | nenhum mostra um guarda-roupa em 3D; o da Loja do quarto sai | — |
| ACERVO › Meu espaço (perspectiva dos móveis) | `/acervo` | **manter: é a única** |

Nenhuma outra vista em perspectiva do guarda-roupa foi achada em `app/`, `components/` ou `lib/` (busca por
perspectiva/3D/guarda-roupa/closet fora do quarto, do ACERVO e dos jogos).

## 15. Dados que ficam sem uso e migração proposta

Nada é apagado e nenhuma migração lançada é editada. Tabelas e colunas que nenhum código passa a ler ou gravar:

| Tabela / coluna | Conteúdo |
|---|---|
| `room_layouts` | Um quarto por pessoa: nível, módulos (com acabamentos, chaves do quarto, luz, monograma), rótulos de gaveta, mapa anterior à organização |
| `room_storage_map` | Endereço de cada peça no quarto (inclui o baú de estação `season:`) |
| `room_catalog` | Itens da loja do quarto (fábrica, marcas, itens da Cidade de Vidro) |
| `room_inventory` | Itens comprados por cada pessoa e onde estavam aplicados |
| `challenge_templates.room_decoration` | Decoração do desafio no quarto |
| `fai_points_rules` linhas `ROOM_ORGANIZED`, `SHOP_PURCHASE`, `SHOP_SALE` | Regras de pontos do quarto e da loja |
| `pipeline_jobs` com `type = 'ROOM_ASSET_GENERATION'` | Gerações de assets do quarto |
| `notifications` com `type = 'ROOM_LEVEL_UP'` | Avisos antigos de nível (continuam visíveis) |

Contagens (a dona roda no banco; este trabalho não se conecta a banco nenhum):

```sql
SELECT COUNT(*) FROM room_layouts;
SELECT COUNT(*) FROM room_storage_map;
SELECT COUNT(*), SUM(active) FROM room_catalog;
SELECT COUNT(*), COUNT(DISTINCT user_id) FROM room_inventory;
-- FAI Points já gastos na loja do quarto (débitos de compra) e recebidos por marcas (vendas)
SELECT COALESCE(-SUM(delta), 0) AS pontos_gastos, COUNT(*) AS compras FROM fai_points_ledger WHERE action_code = 'SHOP_PURCHASE';
SELECT COALESCE(SUM(delta), 0) AS pontos_recebidos FROM fai_points_ledger WHERE action_code = 'SHOP_SALE';
SELECT COALESCE(SUM(delta), 0) FROM fai_points_ledger WHERE action_code = 'ROOM_ORGANIZED';
```

Os pontos gastos e os itens comprados continuam nas contas como estão. Não há reembolso automático.

**Migração proposta (não adicionada; depende da aprovação da dona):**

```sql
-- V1xx__quarto_retirado.sql (proposta) — o Quarto 3D saiu do app em 15/11/2026 (docs/quarto/RETIRADA_DO_QUARTO_3D.md).
-- Só desliga; não apaga linha nenhuma nem devolve pontos.
UPDATE room_catalog SET active = FALSE WHERE active = TRUE;
UPDATE fai_points_rules SET active = FALSE WHERE action_code IN ('ROOM_ORGANIZED', 'SHOP_PURCHASE', 'SHOP_SALE');
```

Apagar as tabelas `room_*` fica para depois, numa migração própria, só se a dona decidir (exige cópia de segurança antes).

## 16. Casos limítrofes

- **Etiqueta e diário da peça** (`GET /api/pieces/{id}/tag`, `POST /api/pieces/{id}/diary`): eram do Meu Quarto e
  nenhuma tela os chama. Saem com o quarto. O registro de uso continua por "Usei" (`POST /api/pieces/{id}/worn`), pela
  lavanderia e pelos looks; o diário (`piece_usage_diary`) continua sendo lido pelo Copilot, desafios e Inventory Score.
- **Convite para desafio por chave do quarto**: sai; só quem a pessoa segue pode ser convidado.
- **Baú de estação**: sai; o Vista-me volta a considerar todas as peças disponíveis.
- **Recompensas do Atelier** (troféus habitáveis e as outras três categorias): não são o quarto; mudam para a aba
  "Conquistas".
- **Chave de sessão `sai_room_look_draft`** (rascunho de look do Espelho e do Copilot para o Criar Look): o nome cita o
  quarto, mas é o contrato com o Criar Look; **fica**.
- **Nível de FAI XP**: os nomes Básico/Studio/Loft vieram do quarto, mas os níveis liberam outras coisas; **ficam**.
