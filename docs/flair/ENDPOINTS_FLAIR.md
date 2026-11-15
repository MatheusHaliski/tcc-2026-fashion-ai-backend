# Rotas e endpoints FLAIR: inventário e conjunto mínimo

Levantamento de 15/11/2026, feito no código (branch de trabalho a partir de `claude/adoring-davinci-mufbri`), para a
decisão da dona do projeto sobre as duas áreas chamadas "FLAIR 3D" (auditoria de 14/11, seções 9 e 10): "Crie
endpoints mínimos e necessários para funcionamento, delete redundantes."

Como os chamadores foram achados: busca do caminho de cada rota e de cada `@*Mapping` em `app/`, `components/`, `lib/`
e `hooks/` (inclusive caminhos montados com constante `BASE`, como em `lib/flair/nucleos/api.ts`), nos testes
(`*.test.ts(x)`, `fai-web/src/test`, `fai-application/src/test`), em `scripts/` (`e2e`, `flair-games`, `flair-demos`,
`diagramas`) e em `docs/` (inclusive `docs/testes/TABELA_ENDPOINTS_POR_RF.md`), além dos links de navegação
(`lib/flair/hub.ts`, `components/flair/modes.tsx`, `components/atelier/room-panel.tsx`) e do registro de tutoriais
(`lib/guides/registry.ts`).

Vereditos: **manter** (o app usa), **redundante** (repete outra rota ou outro endpoint), **sem uso** (nenhum chamador
no app). "Guardado" = fica no código, sem entrada na navegação, por decisão anterior da dona.

## 1. As duas áreas "FLAIR 3D"

| | `/flair/3d` | `/flair/jogos` |
| --- | --- | --- |
| O que é | os 15 núcleos (A Passarela, Dress Fighter, …, Batalha de Looks), um jogo 3D por núcleo | 5 capítulos de um desenho anterior (1 Espelho Partido, 31 Prova com a Estrela, 43 Rooftop ao Pôr do Sol, 70 Cinco Clientes, 96 Chefe: Vellard), cada um um Desafio de Montagem com série, nível de XP e de guarda-roupa |
| Na estrutura final (`ESTRUTURA_FLAIR.md`, 08/11) | é o segmento FLAIR 3D | não aparece |
| API | `/api/flair/3d/...` (`Flair3dNucleoController`) | `/api/flair/games/...` (`FlairGameController`) |
| Dados | `flair3d_partidas` (V101) | linhas de `flair_challenges` com `series` (V98), `flair_game_rewards` (V98), 4 itens de `room_catalog` `F3D-*` (V98, inativos na loja) |
| Como se chegava | só pelo endereço: nenhum menu levava a `/flair/3d` | Central FLAIR (modo "FLAIR 3D"), modos clássicos (seção "FLAIR 3D"), Atelier › Quarto ("Jogar na Suíte de Vidro"), `/room` e o link "Abrir meu quarto" do Inventory Score |

### 1.1 Por que `/flair/jogos` **não** é só redundante

O inventário mostrou duas coisas que a pessoa só tem nessa área:

1. **O quarto em 3D.** O capítulo 1 (série A, distrito `SUITE`) desenha o quarto da pessoa (`GET /api/me/room`) com
   `components/room3d/room-scene.tsx`, por `components/flair/games/room-scenario.tsx`. É o **único lugar do app** que
   mostra o quarto: `/room` virou redirecionamento em 05/11, e a aba Quarto do Atelier instala itens nos módulos
   (`POST /api/me/room-inventory/{id}/apply`) mas manda a pessoa ver o resultado na "Suíte de Vidro"
   (`/flair/jogos?district=SUITE`). `RoomScene` não tem outro importador.
2. **Recompensas exclusivas.** As recompensas dos 5 capítulos (`flair_game_rewards`: 4 colecionáveis de quarto
   `F3D-A01-MOLDURA-PRISMA` etc., `active = FALSE` e preço 0 na loja, e as Cartas Especiais) só saem da entrega desses
   capítulos (`Flair3dRewards`). Nenhum dos 15 núcleos as concede.

Pela regra combinada ("se a área antiga não for simplesmente redundante, parar antes de apagar essa parte"), **a área
`/flair/jogos` e a sua API foram mantidas**. O que era redundante nela saiu (seção 4), e ela deixou de se chamar
FLAIR 3D: agora é **Cidade de Vidro** (o nome dos distritos no estudo original,
`flair-3d/arquivo-100-jogos/README.md` §2), e a única área chamada FLAIR 3D é `/flair/3d`.

Para apagar `/flair/jogos` de vez, falta uma decisão de produto, com duas saídas:

- **A.** Aceitar a perda: o quarto deixa de ser visto em 3D e as recompensas dos capítulos deixam de ser ganhas (as
  já ganhas continuam no inventário). Aí saem as rotas, os componentes de `components/flair/games/` (menos a cena
  fotográfica, que o palco dos confrontos usa), `lib/flair/games.ts`, `FlairGameController`, `FlairGameService`,
  `FlairGameViews`, `FlairGame3dScore`, `Flair3dAccess`, `Flair3dRewards`, `Flair3dEffects`, `Flair3dPenalties`,
  `FlairGameReward(Repository)`, os testes deles e `scripts/flair-games/` (menos `match-preview.mjs`).
- **B.** Dar casa ao quarto antes: levar a visão 3D do quarto (`RoomScenario` sem as vagas) para a aba Quarto do Atelier
  e decidir o destino das recompensas; depois, o mesmo corte de A.

## 2. Rotas do frontend

Antes: 20 rotas (19 em `/flair` + `/room`). Depois: as mesmas 20; nenhuma rota precisou sair (seção 1.1).

| Rota | Arquivo | Quem leva até ela | Testes | Veredito |
| --- | --- | --- | --- | --- |
| `/flair` | `flair/page.tsx` → `FlairHub` | menu principal | `components/flair/hub.test.tsx` | manter |
| `/flair/partidas` | `flair/partidas/page.tsx` | Central (Partidas FLAIR) | `classic-modes.test.tsx`, `modes*.test.tsx` | manter |
| `/flair/desafios` | `flair/desafios/page.tsx` | Central (CBC) | `cbc.test.tsx` | manter |
| `/flair/desafios/[slug]` | `flair/desafios/[slug]/page.tsx` | lista dos desafios | `cbc.test.tsx` | manter |
| `/flair/elencos` | `flair/elencos/page.tsx` | só pelo endereço e pela tela do elenco | `elencos/elencos.test.tsx` | manter (FLAIR CBC, elencos) |
| `/flair/elencos/[elenco]` | `flair/elencos/[elenco]/page.tsx` | lista dos elencos | `elencos/elencos.test.tsx` | manter |
| `/flair/3d` | `flair/3d/page.tsx` → `NucleoList` | **antes:** nenhum menu; **depois:** Central (FLAIR 3D) e Partidas › FLAIR 3D | `nucleos/*.test.tsx` | manter (o FLAIR 3D) |
| `/flair/3d/[nucleo]` | `flair/3d/[nucleo]/page.tsx` | lista dos núcleos | `nucleos/*.test.tsx`, `esporte/`, `detetive/` | manter |
| `/flair/make-up` | `flair/make-up/page.tsx` | só pelo endereço | `make-up/makeup.test.tsx` | manter (FLAIR 3D MAKE UP) |
| `/flair/make-up/[brief]` | `flair/make-up/[brief]/page.tsx` | carreira do MAKE UP | `make-up/makeup.test.tsx` | manter |
| `/flair/jogos` | `flair/jogos/page.tsx` → `GamesCatalog` | **depois:** Atelier › Quarto, `/room`, Inventory Score | `games/games.test.tsx` | manter como Cidade de Vidro (1.1) |
| `/flair/jogos/[slug]` | `flair/jogos/[slug]/page.tsx` → `GamePlay` | catálogo | `games/game-play.test.tsx` | manter (1.1) |
| `/flair/cartas` | `flair/cartas/page.tsx` | Central (Cartas) | `flair-collection.test.tsx`, `sections.test.tsx` | manter |
| `/flair/decks` | `flair/decks/page.tsx` | Central (Decks) | `sections.test.tsx` | manter |
| `/flair/lojas` | `flair/lojas/page.tsx` | Central (Lojas) | `sections.test.tsx` | manter |
| `/flair/carteira` | `flair/carteira/page.tsx` | Central (Carteira) | `sections.test.tsx` | manter |
| `/flair/missoes` | `flair/missoes/page.tsx` | Central (Missões) | `sections.test.tsx` | manter |
| `/flair/aventura` | `flair/aventura/page.tsx` → `AfterpartyAdventure` | nenhum link | `afterparty-*.test.tsx` | guardado para o Glass Empire |
| `/flair/heist` | `flair/heist/page.tsx` → `GalaHeist` | nenhum link | `heist-deck.test.tsx` | guardado para o Glass Empire |
| `/room` | `room/page.tsx` (só redireciona) | links antigos | `app/mirror-redirect.test.tsx` | manter (redireciona para a Suíte de Vidro, `/flair/jogos?district=SUITE`, o único lugar do quarto) |

Navegação que apontava "FLAIR 3D" para a área errada: o modo `games` da Central (`lib/flair/hub.ts`, rota
`/flair/jogos`, situação vinda de `/api/flair/games/summary`) e o cartão "FLAIR 3D" em Partidas
(`components/flair/modes.tsx`). Os dois passam a levar a `/flair/3d`.

## 3. Endpoints do backend

Antes: 94 endpoints com `flair` no caminho (88 em `/api/flair`, 1 em `/api/me/flair` e 5 de leitura pública e
administração: `GET /api/users/{ownerId}/flair/cards`, `GET /api/institutional/{slug}/flair` e os 3 de
`/api/admin/flair/challenges`). Depois: 93 (saiu `GET /api/flair/games/summary`). Fora da conta: o
`/api/admin/catalog/flair-games` do `AdminCatalogController`, que lista partidas clássicas para a administração.

Colunas: **App** = arquivo do frontend que chama; **Testes** = testes Java/Vitest que exercitam a rota; **Scripts** =
`scripts/e2e`, `flair-demos`, `flair-games`.

### 3.1 FLAIR 3D (`Flair3dNucleoController`, `/api/flair/3d`)

| Método e caminho | App | Testes | Veredito |
| --- | --- | --- | --- |
| `GET /api/flair/3d/nucleos` | `lib/flair/nucleos/api.ts` (`listarNucleos`, `nucleo-list.tsx`) e, depois, a Central (`hub.tsx`) | `Flair3dControllersTest` | manter |
| `GET /api/flair/3d/nucleos/{codigo}` | `buscarNucleo` (`use-nucleo-match.ts`) | `Flair3dControllersTest`, `nucleos/*.test.tsx` | manter |
| `POST /api/flair/3d/nucleos/{codigo}/efeitos` | `efeitosDasCartas` (`use-nucleo-effects.ts`) | idem | manter |
| `POST /api/flair/3d/nucleos/{codigo}/partidas` | `abrirPartida` | idem | manter |
| `POST /api/flair/3d/partidas/{id}/previa` | `previaPartida` (`use-nucleo-preview.ts`) | idem | manter |
| `POST /api/flair/3d/partidas/{id}/entrega` | `entregarPartida` | idem | manter |
| `POST /api/flair/3d/partidas/{id}/acionar` | `acionarPartida` | idem | manter |

Os sete são usados e nenhum repete outro: lista, definição, prévia dos efeitos antes da partida, abrir, prévia do
resultado, entregar e acionar (Fashion Sports e Detetive).

### 3.2 Cidade de Vidro, antigo "FLAIR 3D" (`FlairGameController`, `/api/flair/games`)

| Método e caminho | App | Testes | Scripts | Veredito |
| --- | --- | --- | --- | --- |
| `GET /api/flair/games/summary` | só a Central (`hub.tsx`), para a situação do modo FLAIR 3D | `FlairGameControllerTest`, `FlairGameServiceTest`, `hub.test.tsx` | `flair-games/mock-games-api.mjs` | **redundante, removido**: a Central passa a mostrar o FLAIR 3D (núcleos) e o total/liberados já vem em `GET /api/flair/games` (`games[].access`) |
| `GET /api/flair/games` | `games-catalog.tsx` | idem, `games.test.tsx` | mock | manter (1.1) |
| `GET /api/flair/games/{slug}` | `use-game-play.ts` | idem, `game-play.test.tsx` | mock, `evidence-play.mjs` | manter (1.1) |
| `POST /api/flair/games/{slug}/check` | `use-game-play.ts` | idem | — | manter (1.1) |
| `POST /api/flair/games/{slug}/submit` | `use-game-play.ts` | idem | — | manter (1.1) |

Achado para a dona (não mexido, é do CBC): `POST /api/flair/challenges/{slug}/check|submit` também aceitam os 5 slugs
dos capítulos (o `find` do `FlairChallengeService` não filtra `series`), sem o bloqueio por nível que
`/api/flair/games/{slug}/*` aplica. Só a lista do CBC esconde os capítulos.

### 3.3 FLAIR CBC (desafios e elencos)

| Método e caminho | Controller | App | Testes / scripts | Veredito |
| --- | --- | --- | --- | --- |
| `GET /api/flair/challenges` | `FlairChallengeController` | `cbc.tsx`, `hub.tsx`, `lib/flair/cbc.ts` | `cbc.test.tsx`, `hub.test.tsx`, `flair-demos/mock-api.mjs` | manter |
| `GET /api/flair/challenges/{idOrSlug}` | idem | `use-cbc-mesa.ts` | `cbc.test.tsx` | manter |
| `POST /api/flair/challenges/{idOrSlug}/check` | idem | `use-cbc-mesa.ts` | `cbc.test.tsx` | manter |
| `POST /api/flair/challenges/{idOrSlug}/submit` | idem | `use-cbc-mesa.ts` | `cbc.test.tsx` | manter |
| `POST /api/flair/moments/{momentId}/challenges` | idem | nenhum | só docs (RF de Momentos de grupo) | sem uso no app; mantido: é a única forma de o criador de um Momento privado pôr um desafio nele |
| `GET/POST /api/admin/flair/challenges`, `PUT /api/admin/flair/challenges/{id}` | idem | nenhum | só docs | sem tela; mantidos: criar e editar desafios sem migração é operação da administração |
| `GET /api/flair/elencos` | `FlairCbcSquadController` | `lib/flair/elencos/api.ts` | `Flair3dControllersTest`, `elencos.test.tsx` | manter |
| `GET /api/flair/elencos/{codigo}` | idem | idem | idem | manter |
| `POST /api/flair/elencos/{codigo}/conferir` | idem | idem | idem | manter |
| `POST /api/flair/elencos/{codigo}/entrega` | idem | idem | idem | manter |

### 3.4 FLAIR 3D MAKE UP (`FlairMakeUpController`, `/api/flair/make-up`)

| Método e caminho | App | Testes | Veredito |
| --- | --- | --- | --- |
| `GET /api/flair/make-up/carreira` | `lib/flair/make-up/api.ts` (`makeup-career.tsx`) | `Flair3dControllersTest`, `makeup.test.tsx` | manter |
| `GET /api/flair/make-up/briefs` | idem | idem | manter |
| `GET /api/flair/make-up/briefs/{codigo}` | `use-makeup-brief.ts` | idem | manter |
| `POST /api/flair/make-up/briefs/{codigo}/entrega` | idem | idem | manter |

### 3.5 Modos clássicos, coleção, lojas e carteira

Todos com chamador no app, menos dois (abaixo). Testes: `classic-modes.test.tsx`, `modes*.test.tsx`,
`sections.test.tsx`, `flair-collection.test.tsx`, `brand-flair-tab.test.tsx`, `FlairServiceTest`; e2e em
`scripts/e2e/suite_3.py` (RF37) e `suite_4.py`.

| Controller | Endpoints | App | Veredito |
| --- | --- | --- | --- |
| `FlairController` | `GET /api/flair/me`, `GET /api/flair/cards`, `GET /api/flair/decks`, `GET /api/flair/quests`, `POST /api/flair/quests/{code}/claim`, `POST /api/flair/duels`, `GET/POST /api/flair/arena`, `GET/POST /api/flair/teams`, `POST /api/flair/teams/join`, `DELETE /api/flair/teams/me`, `POST /api/flair/teams/battles`, `GET /api/flair/combinations`, `POST /api/flair/combinations/{id}/redeem`, `GET /api/flair/vouchers`, `POST /api/flair/skins/{skin}`, `GET /api/institutional/{slug}/flair`, `POST/PUT/DELETE /api/flair/brand/combinations[/{id}]`, `POST /api/flair/brand/redemptions/validate` | `hub.tsx`, `sections.tsx`, `classic-modes.tsx`, `modes.tsx`, `brand-flair-tab.tsx`, `gala-heist.tsx`, `afterparty-adventure.tsx`, `pieces/new/page.tsx` | manter |
| `FlairController` | `GET /api/flair/decks/{schemeId}` | nenhum (só `suite_3.py`, RF37 CA01) | sem uso no app; mantido: é modo clássico, fora deste corte, e o e2e do RF37 o cobre |
| `FlairController` | `GET /api/flair/combinations/{id}/check` | nenhum (só `suite_3.py`, RF38 CA10) | sem uso no app; mantido pelo mesmo motivo (a lista de combinações já traz o checklist) |
| `FlairModesController` | 19 endpoints em `/api/flair/modes` (catálogo, looks, troféus, batalha, esquadrão, liga, passarela, turnê, territórios, combo, tag-team, chefes, guerra de guarda-roupa) | `modes.tsx` | manter |
| `FlairCardModesController` | 12 endpoints em `/api/flair/modes/{draft,deck,chess,ultimate}` | `modes.tsx` | manter |
| `FlairCollectionController` | `POST /api/flair/cards/preview`, `POST /api/flair/cards`, `GET /api/me/flair/cards`, `GET /api/users/{ownerId}/flair/cards` | `pieces/new/page.tsx`, `flair-collection.tsx`, `use-cbc-mesa.ts`, `use-elenco.ts`, `use-makeup-brief.ts`, núcleos | manter |
| `MomentController` | `GET/POST /api/flair/groups/{groupId}/moments` | `components/moments/flair-moments.tsx` | manter |
| `FlairAdventureController` | 5 endpoints em `/api/flair/adventure` | `afterparty-adventure.tsx` (rota `/flair/aventura`, sem link) | guardado para o Glass Empire |

## 4. O que mudou

- Central FLAIR: o modo FLAIR 3D leva a `/flair/3d`, com a situação "15 jogos" vinda de `GET /api/flair/3d/nucleos`
  (pública, já usada pela lista dos núcleos); a chamada a `/api/flair/games/summary` saiu. O tutorial do modo
  (`guide.flair.games`) descreve os 15 jogos e subiu de versão.
- Partidas FLAIR: o cartão "FLAIR 3D" leva a `/flair/3d`.
- Cidade de Vidro: o catálogo e a tela de um capítulo deixaram de dizer "FLAIR 3D" (título, faixa, pontuação).
- Backend: saiu `GET /api/flair/games/summary` (controller, `FlairGameService.summary`, a regra em
  `SecurityConfig`, os testes dela e a rota do mock `scripts/flair-games/mock-games-api.mjs`).

Redirecionamentos: nenhuma rota do frontend saiu, então não há endereço antigo para redirecionar; `/room` continua
levando à Suíte de Vidro.

Tabelas: nenhuma ficou sem uso (`flair_game_rewards`, as colunas de série de `flair_challenges` e os itens `F3D-*` de
`room_catalog` continuam lidos pela Cidade de Vidro). Se a dona escolher a saída A ou B da seção 1.1, ficam sem uso
`flair_game_rewards`, as colunas `series`, `game_number`, `district`, `rarity`, `required_level`,
`required_wardrobe_level`, `deck_json`, `hype_json`, `ficha_json`, `scene_json`, `rewards_json` e `thumbnail` de
`flair_challenges`, as 5 linhas com `series` e os 4 itens `F3D-*` de `room_catalog`; apagá-los é um passo separado.

Guardados para o Glass Empire (sem entrada na navegação, arquivos mantidos): `app/(site)/(app)/flair/aventura/page.tsx`,
`app/(site)/(app)/flair/heist/page.tsx`, `components/flair/afterparty-adventure.tsx`, `afterparty-scene.tsx`,
`gala-heist.tsx`, `heist-mods.tsx`, `lib/flair/afterparty.ts`, `lib/heist/`, `FlairAdventureController`,
`AfterpartyEngine`, `AfterpartyMods` e os testes deles.

Também sem chamador, e mantido: o palco fotográfico dos confrontos (`components/flair/match/`,
`lib/flair/match-*.ts`), em andamento desde 06/11, que reaproveita a cena fotográfica de `components/flair/games/`.
