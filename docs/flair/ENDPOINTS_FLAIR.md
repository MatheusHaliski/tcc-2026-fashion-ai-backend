# Rotas e endpoints FLAIR: inventário e conjunto mínimo

Levantamento de 15/11/2026, feito no código (branch de trabalho a partir de `claude/adoring-davinci-mufbri`), para a
decisão da dona do projeto sobre as duas áreas chamadas "FLAIR 3D" (auditoria de 14/11, seções 9 e 10): "Crie
endpoints mínimos e necessários para funcionamento, delete redundantes."

Houve duas passadas no mesmo dia:

1. **Inventário e o que era só redundante.** A Central e as Partidas passaram a levar o "FLAIR 3D" aos núcleos e saiu
   o resumo duplicado `GET /api/flair/games/summary`. A área antiga ficou, com o nome Cidade de Vidro, porque não era só
   redundante (seção 1.1).
2. **Saída B, escolhida pela dona.** O quarto 3D foi para o Atelier › Quarto e, depois, a área antiga e a API dela
   saíram por inteiro. A dona aceitou perder as recompensas que só os capítulos davam.

Como os chamadores foram achados: busca do caminho de cada rota e de cada `@*Mapping` em `app/`, `components/`, `lib/`
e `hooks/` (inclusive caminhos montados com constante `BASE`, como em `lib/flair/nucleos/api.ts`), nos testes
(`*.test.ts(x)`, `fai-web/src/test`, `fai-application/src/test`), em `scripts/` (`e2e`, `flair-games`, `flair-demos`,
`diagramas`) e em `docs/` (inclusive `docs/testes/TABELA_ENDPOINTS_POR_RF.md`), além dos links de navegação
(`lib/flair/hub.ts`, `components/flair/modes.tsx`, `components/atelier/room-panel.tsx`) e do registro de tutoriais
(`lib/guides/registry.ts`).

Vereditos: **manter** (o app usa), **redundante** (repete outra rota ou outro endpoint), **sem uso** (nenhum chamador
no app), **removido**. "Guardado" = fica no código, sem entrada na navegação, por decisão anterior da dona.

## 1. As duas áreas "FLAIR 3D"

| | `/flair/3d` | `/flair/jogos` (removida) |
| --- | --- | --- |
| O que é | os 15 núcleos (A Passarela, Dress Fighter, …, Batalha de Looks), um jogo 3D por núcleo | 5 capítulos de um desenho anterior (1 Espelho Partido, 31 Prova com a Estrela, 43 Rooftop ao Pôr do Sol, 70 Cinco Clientes, 96 Chefe: Vellard), cada um um Desafio de Montagem com série, nível de XP e de guarda-roupa |
| Na estrutura final (`ESTRUTURA_FLAIR.md`, 08/11) | é o segmento FLAIR 3D | não aparece |
| API | `/api/flair/3d/...` (`Flair3dNucleoController`) | `/api/flair/games/...` (`FlairGameController`, removido) |
| Dados | `flair3d_matches` (V101) | linhas de `flair_challenges` com `series` (V98), `flair_game_rewards` (V98), 4 itens de `room_catalog` `F3D-*` (V98, inativos na loja) |
| Como se chegava (antes) | só pelo endereço | Central FLAIR (modo "FLAIR 3D"), Partidas (cartão "FLAIR 3D"), Atelier › Quarto ("Jogar na Suíte de Vidro"), `/room` e o "Abrir meu quarto" do Inventory Score |
| Como se chega (agora) | Central FLAIR (modo FLAIR 3D) e Partidas › FLAIR 3D | os endereços antigos redirecionam (seção 4.3) |

### 1.1 Por que `/flair/jogos` não era só redundante

O inventário mostrou duas coisas que a pessoa só tinha nessa área:

1. **O quarto em 3D.** O capítulo 1 (série A, distrito `SUITE`) desenhava o quarto da pessoa (`GET /api/me/room`) com
   `components/room3d/room-scene.tsx`, por `components/flair/games/room-scenario.tsx`. Era o **único lugar do app** que
   mostrava o quarto: `/room` virou redirecionamento em 05/11, e a aba Quarto do Atelier instalava itens nos módulos
   (`POST /api/me/room-inventory/{id}/apply`) mas mandava a pessoa ver o resultado na "Suíte de Vidro"
   (`/flair/jogos?district=SUITE`).
2. **Recompensas exclusivas.** As recompensas dos 5 capítulos (`flair_game_rewards`: 4 colecionáveis de quarto
   `F3D-A01-MOLDURA-PRISMA` etc., `active = FALSE` e preço 0 na loja, e as Cartas Especiais) só saíam da entrega desses
   capítulos (`Flair3dRewards`). Nenhum dos 15 núcleos as concede.

Por isso a primeira passada parou antes de apagar a área e propôs duas saídas: **A** (aceitar as duas perdas) e **B**
(levar a visão do quarto para o Atelier › Quarto e, depois, apagar).

### 1.2 Saída B: o que foi feito

- **O quarto 3D mudou de casa.** A cena virou `components/room3d/room-view.tsx` (`RoomView`), com o mesmo contrato
  caracterizado antes da mudança (`room-view.test.tsx`: sem WebGL ou com erro mostra o fallback sem buscar o quarto;
  com WebGL busca `GET /api/me/room` uma vez; à noite o período vira `night`) e mais duas coisas: o módulo em foco
  (`focusModule`, que também acende) e "reduzir movimento" do app ou do sistema (`ambient.reduceMotion`).
- **Atelier › Quarto** (`components/atelier/room-panel.tsx`, `room-3d-section.tsx`): "Ver o quarto em 3D" abre a visão ao
  lado da instalação; cada objeto instalado tem "Ver … em 3D" com a câmera no módulo; instalar abre a visão já no
  módulo escolhido. Sem WebGL, um aviso em texto (a lista diz onde cada objeto está). No celular a visão fica em 4:5.
  O endereço é `/atelier?tab=room&quarto=3d[&modulo=…]` (`lib/atelier/room-3d.ts`), e é para lá que levam `/room`, o
  botão do cabeçalho do Atelier e o "Abrir meu quarto" do Inventory Score.
- **A área antiga saiu** (seção 4.2), com redirecionamentos para os endereços guardados (seção 4.3).
- **As rotas do CBC deixaram de aceitar os capítulos.** `GET /api/flair/challenges/{idOrSlug}` e `POST .../check` e
  `.../submit` aceitavam os 5 slugs (o `find` do `FlairChallengeService` não filtrava `series`), sem o bloqueio por
  nível da API antiga. Agora, pelo slug ou pelo id, a resposta é o mesmo 404 de um desafio que não existe
  (`FlairChallengeCapitulosTest`, escrito antes da correção e falhando nela).
- **Elencos e FLAIR 3D MAKE UP ganharam entrada na Central** (seção 2).

## 2. Rotas do frontend

Antes: 20 rotas (19 em `/flair` + `/room`). Depois: 18 (saíram `/flair/jogos` e `/flair/jogos/[slug]`, que agora
redirecionam).

| Rota | Arquivo | Quem leva até ela | Testes | Veredito |
| --- | --- | --- | --- | --- |
| `/flair` | `flair/page.tsx` → `FlairHub` | menu principal | `components/flair/hub.test.tsx` | manter |
| `/flair/partidas` | `flair/partidas/page.tsx` | Central (Partidas FLAIR) | `classic-modes.test.tsx`, `modes*.test.tsx` | manter |
| `/flair/desafios` | `flair/desafios/page.tsx` | Central (Desafios de Montagem) | `cbc.test.tsx` | manter |
| `/flair/desafios/[slug]` | `flair/desafios/[slug]/page.tsx` | lista dos desafios | `cbc.test.tsx` | manter |
| `/flair/elencos` | `flair/elencos/page.tsx` | **antes:** só pelo endereço; **agora:** Central (Elencos) | `elencos/elencos.test.tsx` | manter (FLAIR CBC) |
| `/flair/elencos/[elenco]` | `flair/elencos/[elenco]/page.tsx` | lista dos elencos | `elencos/elencos.test.tsx` | manter |
| `/flair/3d` | `flair/3d/page.tsx` → `NucleoList` | Central (FLAIR 3D) e Partidas › FLAIR 3D | `nucleos/*.test.tsx` | manter (o FLAIR 3D) |
| `/flair/3d/[nucleo]` | `flair/3d/[nucleo]/page.tsx` | lista dos núcleos | `nucleos/*.test.tsx`, `esporte/`, `detetive/` | manter |
| `/flair/make-up` | `flair/make-up/page.tsx` | **antes:** só pelo endereço; **agora:** Central (FLAIR 3D MAKE UP) | `make-up/makeup.test.tsx` | manter (FLAIR 3D MAKE UP) |
| `/flair/make-up/[brief]` | `flair/make-up/[brief]/page.tsx` | carreira do MAKE UP | `make-up/makeup.test.tsx` | manter |
| `/flair/jogos` | — | — | `lib/nav/legacy-redirects.test.ts` | **removida**; redireciona (4.3) |
| `/flair/jogos/[slug]` | — | — | idem | **removida**; redireciona (4.3) |
| `/flair/cartas` | `flair/cartas/page.tsx` | Central (Cartas) | `flair-collection.test.tsx`, `sections.test.tsx` | manter |
| `/flair/decks` | `flair/decks/page.tsx` | Central (Decks) | `sections.test.tsx` | manter |
| `/flair/lojas` | `flair/lojas/page.tsx` | Central (Lojas) | `sections.test.tsx` | manter |
| `/flair/carteira` | `flair/carteira/page.tsx` | Central (Carteira) | `sections.test.tsx` | manter |
| `/flair/missoes` | `flair/missoes/page.tsx` | Central (Missões) | `sections.test.tsx` | manter |
| `/flair/aventura` | `flair/aventura/page.tsx` → `AfterpartyAdventure` | nenhum link | `afterparty-*.test.tsx` | guardado para o Glass Empire |
| `/flair/heist` | `flair/heist/page.tsx` → `GalaHeist` | nenhum link | `heist-deck.test.tsx` | guardado para o Glass Empire |
| `/room` | `room/page.tsx` (só redireciona) | links antigos | `app/mirror-redirect.test.tsx` | manter; leva ao quarto em 3D do Atelier (`/atelier?tab=room&quarto=3d`) |

Central FLAIR (`lib/flair/hub.ts`), grupo Jogar, na ordem dos segmentos de `ESTRUTURA_FLAIR.md`: Partidas FLAIR,
Desafios de Montagem, **Elencos** (`/flair/elencos`, novo), FLAIR 3D (`/flair/3d`), **FLAIR 3D MAKE UP**
(`/flair/make-up`, novo). Cada modo novo tem tutorial (`flair.squads`, `flair.makeup`), ícone próprio
(`lib/icons/flair-hub-icons.json`, SVGs em `public/flair/icons`) e demonstração ainda por gravar (`recorded: false`,
como a do FLAIR 3D).

## 3. Endpoints do backend

Antes: 94 endpoints com `flair` no caminho (88 em `/api/flair`, 1 em `/api/me/flair` e 5 de leitura pública e
administração: `GET /api/users/{ownerId}/flair/cards`, `GET /api/institutional/{slug}/flair` e os 3 de
`/api/admin/flair/challenges`). Depois da primeira passada: 93. Agora: **89** (83 em `/api/flair`, 1 em
`/api/me/flair` e os mesmos 5). Fora da conta: o `/api/admin/catalog/flair-games` do `AdminCatalogController`, que
lista partidas clássicas para a administração.

Colunas: **App** = arquivo do frontend que chama; **Testes** = testes Java/Vitest que exercitam a rota; **Scripts** =
`scripts/e2e`, `flair-demos`.

### 3.1 FLAIR 3D (`Flair3dNucleoController`, `/api/flair/3d`)

| Método e caminho | App | Testes | Veredito |
| --- | --- | --- | --- |
| `GET /api/flair/3d/nucleos` | `lib/flair/nucleos/api.ts` (`listarNucleos`: `nucleo-list.tsx` e a Central, `hub.tsx`) | `Flair3dControllersTest`, `hub.test.tsx` | manter |
| `GET /api/flair/3d/nucleos/{codigo}` | `buscarNucleo` (`use-nucleo-match.ts`) | `Flair3dControllersTest`, `nucleos/*.test.tsx` | manter |
| `POST /api/flair/3d/nucleos/{codigo}/efeitos` | `efeitosDasCartas` (`use-nucleo-effects.ts`) | idem | manter |
| `POST /api/flair/3d/nucleos/{codigo}/partidas` | `abrirPartida` | idem | manter |
| `POST /api/flair/3d/partidas/{id}/previa` | `previaPartida` (`use-nucleo-preview.ts`) | idem | manter |
| `POST /api/flair/3d/partidas/{id}/entrega` | `entregarPartida` | idem | manter |
| `POST /api/flair/3d/partidas/{id}/acionar` | `acionarPartida` | idem | manter |

Os sete são usados e nenhum repete outro: lista, definição, prévia dos efeitos antes da partida, abrir, prévia do
resultado, entregar e acionar (Fashion Sports e Detetive).

### 3.2 Cidade de Vidro, o antigo "FLAIR 3D" (`FlairGameController`, `/api/flair/games`): removida

| Método e caminho | Quem chamava | Veredito |
| --- | --- | --- |
| `GET /api/flair/games/summary` | só a Central | redundante; removido na primeira passada (a Central usa `GET /api/flair/3d/nucleos`) |
| `GET /api/flair/games` | catálogo `/flair/jogos` | removido (saída B) |
| `GET /api/flair/games/{slug}` | tela do capítulo | removido (saída B) |
| `POST /api/flair/games/{slug}/check` | tela do capítulo | removido (saída B) |
| `POST /api/flair/games/{slug}/submit` | tela do capítulo | removido (saída B) |

### 3.3 FLAIR CBC (desafios e elencos)

| Método e caminho | Controller | App | Testes / scripts | Veredito |
| --- | --- | --- | --- | --- |
| `GET /api/flair/challenges` | `FlairChallengeController` | `cbc.tsx`, `hub.tsx`, `lib/flair/cbc.ts` | `cbc.test.tsx`, `hub.test.tsx`, `flair-demos/mock-api.mjs` | manter |
| `GET /api/flair/challenges/{idOrSlug}` | idem | `use-cbc-mesa.ts` | `cbc.test.tsx`, `FlairChallengeCapitulosTest` | manter; os capítulos dão 404 |
| `POST /api/flair/challenges/{idOrSlug}/check` | idem | `use-cbc-mesa.ts` | idem | manter; os capítulos dão 404 |
| `POST /api/flair/challenges/{idOrSlug}/submit` | idem | `use-cbc-mesa.ts` | idem | manter; os capítulos dão 404 |
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

### 4.1 Primeira passada (inventário)

- Central FLAIR: o modo FLAIR 3D leva a `/flair/3d`, com a situação "15 jogos" vinda de `GET /api/flair/3d/nucleos`;
  a chamada a `/api/flair/games/summary` saiu. O tutorial do modo (`guide.flair.games`) descreve os 15 jogos (versão 2).
- Partidas FLAIR: o cartão "FLAIR 3D" leva a `/flair/3d`.
- Saiu `GET /api/flair/games/summary` (controller, serviço, regra pública no `SecurityConfig`, testes e mock).

### 4.2 Saída B: o que foi apagado

| Lado | Arquivos |
| --- | --- |
| Telas | `app/(site)/(app)/flair/jogos/page.tsx`, `app/(site)/(app)/flair/jogos/[slug]/page.tsx` |
| Componentes e hooks | `components/flair/games/`: `game-card`, `game-filters`, `game-lock`, `game-play` (e teste), `game-side-panel`, `games-catalog`, `games.test`, `use-game-play`, `use-game-texts`; `room-scenario` virou `components/room3d/room-view.tsx` |
| Libs | `lib/flair/games.ts` e o teste (ficou só o que a cena fotográfica usa, em `lib/flair/photo-scene.ts`) |
| Estilo e imagens | `app/(site)/_styles/25-flair-3d-catalogo.css`; as 5 miniaturas `public/flair/games/<slug>.webp` |
| Traduções | 100 chaves de tela (90 `games.*`, 10 `cbc.*` do banco de cartas da partida) e 16 mensagens do backend (`flair3d.level_required`, `flair3d.wardrobe_required`, `flair3d.tier.*`, `flair3d.wardrobe.*`, `flair3d.reward.*`, `flair3d.line.*`), iguais nos três idiomas |
| Backend | `FlairGameController`, `FlairGameService`, `FlairGameViews`, `FlairGame3dScore`, `Flair3dAccess`, `Flair3dRewards`, `Flair3dEffects`, `Flair3dPenalties`, a entidade `FlairGameReward` e `FlairGameRewardRepository`; as regras públicas `/api/flair/games` e `/api/flair/games/*` do `SecurityConfig` |
| Testes Java | `FlairGameControllerTest`, `FlairGameServiceTest`, `Flair3dRewardsTest`, `Flair3dAccessTest`, `Flair3dEffectsTest`, `Flair3dPenaltiesTest`, `Flair3dSeedTest` |
| Scripts | `scripts/flair-games/` inteiro (gerador da V98, dados das séries e o arquivo dos 95 jogos, fixture, mocks, evidências, fotos e prévias), menos `match-preview.mjs`, que foi para `scripts/flair-match/` |

Ficaram, mudando de pasta: a cena fotográfica (`components/flair/match/photo-scene*.tsx` e o teste dela) e os tipos
dela (`lib/flair/photo-scene.ts`), porque o palco dos confrontos (`components/flair/match/`, `lib/flair/match-*.ts`)
as usa; as fotos dos cenários (`public/flair/games/scenes/`) e o CSS da cena (`26-flair-3d-photo.css`,
`27-flair-3d-fx.css`) também ficam.

Números da saída B: 73 arquivos apagados (2 telas, 1 CSS, 10 componentes e hooks mais o `room-scenario` que virou
`room-view`, 2 libs, 5 imagens, 10 classes Java, 7 testes Java, 35 scripts e dados) e 17 criados (a visão do quarto, a
seção do Atelier e os testes delas; o endereço do quarto; os rótulos e os tipos da cena e o teste deles; os
redirecionamentos e o teste deles; `FlairChallengeCapitulosTest`; os 6 SVGs dos ícones novos). Cerca de 5.570 linhas
de código a menos, mais 51.188 linhas de dados do gerador.

### 4.3 Redirecionamentos

Em `lib/nav/legacy-redirects.ts` (lido por `next.config.ts`, testado em `legacy-redirects.test.ts`), todos temporários:

| Endereço antigo | Vai para |
| --- | --- |
| `/flair/jogos?district=SUITE` | `/atelier?tab=room&quarto=3d` (o quarto) |
| `/flair/jogos/a01-espelho-partido` (o capítulo da Suíte de Vidro) | `/atelier?tab=room&quarto=3d` |
| `/flair/jogos` (com outros filtros ou sem) | `/flair/3d` |
| `/flair/jogos/<qualquer outro>` | `/flair/3d` |
| `/room` | `/atelier?tab=room&quarto=3d` (a página `room/page.tsx`; `?espelho=1` e `?piece=` continuam indo ao Espelho e ao Guarda-roupa) |

### 4.4 Tabelas de endpoints

`docs/testes/TABELA_ENDPOINTS_POR_RF.md` não listava `/api/flair/games` nem `/api/flair/3d` (nenhum dos dois tem passo
no e2e), e o inventário do e2e (`scripts/e2e/inventory.py`) lê os controllers, então a remoção entra sozinha na
próxima geração. `docs/plataforma/BACKEND_PARA_APP_NATIVO.md` foi atualizado à mão. Os inventários gerados de
`docs/refactoring/gof/` (`java-ast.json`, `full-call-graph.md` e companhia) ainda citam as classes apagadas até a
próxima geração.

## 5. Dados que ficaram sem uso

Nada foi apagado do banco nem das migrações já lançadas. Ficam sem leitor no código (apagar é um passo separado, que
depende da aprovação da dona):

| Onde | O quê |
| --- | --- |
| Tabela `flair_game_rewards` (V98) | inteira: as recompensas dos capítulos já entregues e o estado delas |
| `flair_challenges` (colunas da V98) | `series`, `game_number`, `district`, `rarity`, `required_level`, `required_wardrobe_level`, `deck_json`, `hype_json`, `ficha_json`, `scene_json`, `rewards_json`, `thumbnail`; `series` ainda é lida pela lista do CBC e pelo `find`, só para esconder as linhas abaixo |
| `flair_challenges` (linhas) | as 5 linhas com `series` (slugs `a01-espelho-partido`, `b31-prova-com-a-estrela`, `c43-rooftop-ao-por-do-sol`, `d70-cinco-clientes`, `e96-chefe-vellard`) e as entregas delas em `flair_challenge_submissions`, que seguem no histórico de quem jogou |
| `room_catalog` (linhas) | os 4 itens `F3D-*` (inativos na loja); as unidades já ganhas continuam no inventário de quem as ganhou, instaláveis e visíveis no quarto 3D |
| `fai_points_rules` (linhas) | `FLAIR_3D` e `FLAIR_3D_PERFECT`: ninguém mais lança esses pontos (o CBC lança sempre `FLAIR_CBC`); os lançamentos antigos seguem no extrato |

As recompensas já entregues ficam com os donos: nada as remove, e as cartas e itens continuam nas coleções.

Proposta de migração para o texto "FLAIR 3D" das regras (não incluída; só com a aprovação da dona, no próximo número
livre depois de `V102`):

```sql
-- os capítulos antigos saíram do app em 15/11/2026: as regras deixam de aparecer e não lançam mais pontos
UPDATE fai_points_rules
   SET active = FALSE,
       description = 'Capítulo antigo encerrado (sem novos pontos)'
 WHERE action_code IN ('FLAIR_3D', 'FLAIR_3D_PERFECT');
```

## 6. Guardados para o Glass Empire

Sem entrada na navegação, arquivos mantidos e intactos: `app/(site)/(app)/flair/aventura/page.tsx`,
`app/(site)/(app)/flair/heist/page.tsx`, `components/flair/afterparty-adventure.tsx`, `afterparty-scene.tsx`,
`gala-heist.tsx`, `heist-mods.tsx`, `lib/flair/afterparty.ts`, `lib/heist/`, `FlairAdventureController`,
`AfterpartyEngine`, `AfterpartyMods` e os testes deles.

Também sem chamador, e mantido: o palco fotográfico dos confrontos (`components/flair/match/`,
`lib/flair/match-*.ts`), em andamento desde 06/11.
