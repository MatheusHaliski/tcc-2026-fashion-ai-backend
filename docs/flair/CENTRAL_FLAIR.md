# Central FLAIR — tela de seleção de jogos

Pedido de 10/10/2026: auditar, redesenhar e implementar a tela de seleção de jogos do FashionAI (`/flair`) no modelo
dos menus de jogos convencionais: **lista lateral por modo** e, ao lado, **painel do modo escolhido** com título,
demonstração gravada e a ação para começar. Este documento é o inventário antes × depois, a lista de arquivos, os
assets (ícones, vídeos, capas, capturas) e os testes executados.

Documentos relacionados: [FLAIR-UT](../plano/FLAIR_UT_Cartas_e_Desafios.md) (cartas por nível, Desafios de
Montagem), [Momentos](../momentos/MOMENTOS.md), [Orientação "Como funciona"](../ux/ORIENTACAO.md),
[gravação das demonstrações](../../scripts/flair-demos/README.md).

## 1. Auditoria: antes × depois

| | Antes (`/flair`, uma página de abas) | Depois |
|---|---|---|
| Estrutura | Cabeçalho + faixa de rank + 7 abas (Modos, Duelos e equipes, Cartas e álbum, Decks, Combinações das lojas, Carteira, Quests). A aba Modos abria uma **barra preta** (`.mode-arch`, `#111`) com blocos de texto "PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO" e um texto de abertura longo | **Central** (`/flair`): lista lateral com 9 modos em 4 grupos (Jogar · Calendário · Desafios · Coleção) e painel com título grande, objetivo em uma frase, demonstração gravada, "Jogar/Abrir/Continuar/Destravar", "Como funciona" e a situação do modo. Sem barra preta, sem texto de abertura |
| Modos jogáveis | 15 modos novos na aba Modos; duelo 1×1, ocasião e equipes numa aba separada | `/flair/partidas`: catálogo único com os 3 clássicos (ícones FAI) + 6 do núcleo + 9 especiais; "Jogar com este deck" leva direto ao duelo com o deck escolhido |
| Desafios de Montagem (CBC) | **Não existia tela.** O backend (`/api/flair/challenges`, `CbcRules`, `CbcStory`, V56 com 16 desafios) e o cenário SVG (`cbc-scene.tsx`) existiam, mas nada no frontend os chamava, e as chaves `cbc.*` não estavam nos catálogos | `/flair/desafios` (Agora, Sempre disponíveis, Em breve, Grupos, Memórias) e `/flair/desafios/[slug]` (mini mapa com vagas, escolha de carta por vaga, leitura do Momento, requisitos e sintonia conferidos pelo servidor a cada mudança, história, pontos previstos, entrega atômica, modal de recompensa, comunidade e memória). 410 chaves novas em pt-BR, en e es, incluindo os rótulos e as histórias dos 15 cenários |
| Momentos / Desafios | Páginas próprias (`/moments`, `/challenges`), sem entrada na área de jogos | Entram na central como **Calendário** e **Desafios** (função real: calendário da moda e metas com prazo), com situação (ativos, próximos, convites) e demonstração |
| Coleção | Abas | `/flair/cartas`, `/flair/decks`, `/flair/lojas`, `/flair/carteira`, `/flair/missoes`, cada uma com o caminho de volta à central e "Como funciona" |
| Links antigos | `/flair?tab=jogar`, `?tab=lojas`, `?tab=cartas` | Redirecionados pela central (`LEGACY_TABS`) e atualizados nos componentes que os usavam |
| Tutoriais | 1 tutorial (`games.hub`, "três áreas") | 10: `games.hub` (v2, a central), `flair.matches`, `flair.cbc`, `moments.calendar`, `challenges.progress`, `flair.cards`, `flair.decks`, `flair.shops`, `flair.wallet`, `flair.quests`. Na **primeira entrada** de cada modo pela central, "Jogar" abre a explicação com o ícone do modo, exemplo ilustrado, até 3 passos, **"Entendi, começar"** e **"Não mostrar novamente"** (por pessoa e por modo, no servidor; visitante sem conta, no navegador). Esc/X/clique fora fecham sem entrar. Nunca empilha e não reaparece a cada partida |
| Cores e superfícies | `#111`/`#fff` fixos em `.mode-arch`, `.mode-rating`, `.mode-team-rating`, `.mode-trophy-card`; `.mode-card` duplicada no CSS (colidia com outra `.mode-card` do app) | Só tokens do tema (`--ink`, `--surface`, `--thread`, `--chalk-soft`…): funciona em claro, escuro e alto contraste. Classes do catálogo renomeadas para `.fm-*` |
| Demonstrações | Nenhuma | 9 clipes gravados no app (ambiente de teste, API simulada), MP4 + WebM + capa, 10–20 s, sem áudio |

## 2. Modos da central (função real)

| Grupo | Modo | Rota | Ação | Situação mostrada | Indisponível quando |
|---|---|---|---|---|---|
| Jogar | Partidas FLAIR | `/flair/partidas` | Jogar | decks prontos | sem deck → "Destravar" leva a criar esquema |
| Jogar | Desafios de Montagem (Card Building Challenges) | `/flair/desafios` | Jogar | desafios abertos | nada aberto (só em breve / nenhum) |
| Calendário | Momentos | `/moments` | Abrir | momentos acontecendo / a caminho | nada no calendário |
| Desafios | Desafios | `/challenges` | Continuar (com ativos) / Abrir | ativos, convites, catálogo | — |
| Coleção | Minhas cartas | `/flair/cartas` | Abrir | cartas | sem cartas → converter uma peça |
| Coleção | Decks | `/flair/decks` | Abrir | decks | sem decks |
| Coleção | Combinações das lojas | `/flair/lojas` | Abrir | prontas para trocar / ativas | nenhuma loja ativa |
| Coleção | Carteira | `/flair/carteira` | Abrir | moedas e cupons | — |
| Coleção | Missões | `/flair/missoes` | Continuar / Abrir | concluídas/total | nenhuma missão |

A situação vem dos mesmos endpoints que as telas usam (`/api/flair/me`, `/decks`, `/api/me/flair/cards`,
`/api/flair/challenges`, `/api/moments`, `/api/me/challenges`, `/combinations`, `/quests`, `/vouchers`); sem
resposta, o modo fica "aberto" sem situação (nunca bloqueia por erro de rede).

## 3. Navegação

- **Mouse e toque**: a lista é um `tablist` vertical (horizontal rolável abaixo de 900 px); escolher um item só
  troca o painel. A escolha fica guardada por conta (`localStorage`, chave por `userId`) e a sub-rota devolve a pessoa
  ao mesmo item (`/flair?mode=…`).
- **Teclado**: setas movem e escolhem (ativação automática, padrão ARIA de abas), Home/End vão às pontas, Enter
  começa; foco visível com o anel do tema.
- **Controle** (Gamepad API, Chrome/Edge/Firefox/Safari com controle pareado): direcional ou analógico esquerdo
  movem; A começa. Só liga quando o navegador anuncia um controle; nada roda sem ele.
- **Celular**: a lista vira uma faixa horizontal de pílulas com ícone + nome; o painel ocupa a largura e as ações
  viram botões de linha inteira.

## 4. Ícones exclusivos

Fonte única: `lib/icons/flair-hub-icons.json` (24×24, traço 1,8 px, pontas redondas). O componente
`FlairHubIcon` desenha o mesmo traço em linha (`currentColor`) e `scripts/assets/flair-hub-icons.mjs` exporta os
arquivos finais em `public/flair/icons/<modo>-<estado>.svg` (27 arquivos: normal, selecionado, indisponível).

| Modo | Forma (reconhecível sem a cor) |
|---|---|
| Partidas FLAIR | duas cartas, a da frente com a estrela (a carta que vira FLAIR) |
| Desafios de Montagem | mosaico 2×2: três vagas vazias, a última preenchida (a carta que completa o mini mapa) |
| Momentos | calendário com um dia marcado por estrela |
| Desafios | bandeira de meta com a marca de concluído |
| Minhas cartas | três cartas empilhadas (álbum) |
| Decks | leque de três cartas |
| Combinações das lojas | vitrine com toldo |
| Carteira | carteira com fecho |
| Missões | prancheta com itens concluídos |

Estados: normal (traço na tinta), selecionado (disco preenchido com a tinta do tema e traço na superfície),
indisponível (anel tracejado, traço na cor "muted"). O nome fica sempre visível ao lado.

## 5. Demonstrações (vídeo)

Gravadas com o app de verdade sobre a API simulada (`scripts/flair-demos`), sem telas de abertura ou encerramento:
o clipe começa direto na interface, com cursor visível e cliques marcados. Só a mídia do modo selecionado é montada
(`DemoPlayer` trocado por `key`); as outras nunca são baixadas. Sem áudio; loop; capa durante o carregamento;
botão de pausa sempre visível; com movimento reduzido (sistema ou app) abre parado na capa com "Reproduzir"; se a
mídia falhar, fica a capa com o aviso. Assistir não chama a API.

| Modo | Sequência | Arquivos (`public/flair/demos`) |
|---|---|---|
| matches | abre a peça → Converter para FLAIR → prévia (Ouro · 78) → Gerar carta → carta pronta → Partidas → Duelo 1×1 → Treinar com a Casa → rodadas e vitória | `matches.mp4` · `.webm` · `.jpg` |
| cbc | Desafios de Montagem → Montar "Primavera no jardim" → carta em cada vaga do mini mapa → requisitos ✓ e sintonia → Entregar → modal de recompensa (creditado pelo servidor) | `cbc.*` |
| moments | Momentos → Calendário → Primavera 2026 → período, interpretações e requisitos → Participar | `moments.*` |
| challenges | Catálogo → Começar "7 dias sem repetir look" → modo → desafio aberto com progresso → Meus desafios | `challenges.*` |
| cards / decks / shops / wallet / quests | a tela da coleção em uso | `cards.*` … `quests.*` |

Durações finais (`encode.mjs` corta o carregamento inicial e, acima de 19,5 s, acelera de leve, até 1,6×, para o
clipe caber em 10–20 s): matches 19,5 s (1,36×) · cbc 19,5 s (1,49×) · challenges 19,5 s · moments 16,4 s ·
cards 10,5 s · decks 12,6 s · shops ≈10 s · wallet 11,8 s · quests 10,5 s. MP4 de 0,2 a 1,2 MB; capa JPG de 30 KB.

## 5.1 Central de FAI Points (`/points`), no mesmo formato

Pedido de 10/10 (continuação): a tela de FAI Points (Loja → FAI Points) ganhou a mesma navegação lateral com vídeo
em destaque. A tela de seleção virou um componente comum (`components/hub/mode-hub.tsx`), usado pelas duas centrais.

| Grupo | Lugar | Rota | Situação mostrada |
|---|---|---|---|
| Saldo | Saldo e níveis | `/points/saldo` | pontos e nível |
| Ganhar | Como ganhar | `/points/ganhar` | formas de ganhar (regras da API, com limite por dia e atalho "Ir" para a tela da ação) |
| Gastar | Loja do quarto | `/points/loja` (RoomStore, RF35 + RF39) | itens ao seu alcance / disponíveis; indisponível sem itens |
| Histórico | Extrato | `/notifications?cat=POINTS` | movimentos recentes |

Antes: uma página única com saldo, níveis, regras, extrato e a loja empilhados. Depois: central + três sub-rotas;
ícones próprios (`balance`, `earn`, `store`, `statement` no mesmo catálogo, exportados em `public/points/icons`);
tutoriais `points.fai` (v2), `points.balance`, `points.earn`, `points.statement` e `shop.room` com "Entendi, começar";
demonstrações gravadas em `public/points/demos`; testes em `components/points/hub.test.tsx`.

## 6. Arquivos

Novos: `lib/flair/hub.ts`, `lib/icons/flair-hub-icons.json`, `components/flair/hub.tsx`, `hub-icons.tsx`,
`demo-player.tsx`, `sections.tsx`, `classic-modes.tsx`, `cbc.tsx`, `hub.test.tsx`, `cbc.test.tsx`,
`app/(site)/(app)/flair/{partidas,desafios,desafios/[slug],cartas,decks,lojas,carteira,missoes}/page.tsx`,
`scripts/assets/flair-hub-icons.mjs`, `scripts/flair-demos/*`, `public/flair/icons/*.svg`,
`public/flair/demos/*`, `docs/flair/capturas/*.png`.

Alterados: `app/(site)/(app)/flair/page.tsx` (vira a central), `components/flair/modes.tsx` (sem barra preta,
modos clássicos no catálogo, `.fm-*`), `components/guide/guide.tsx` (`gate`, ícone do modo, "Entendi, começar"),
`guide-demos.tsx` (6 exemplos novos), `lib/guides/registry.ts`, `app/(site)/globals.css`,
`lib/i18n/messages/{pt-BR,en,es}.json`, `components/moments/flair-moments.tsx`, `components/coupons/my-coupons.tsx`,
`components/flair/brand-flair-tab.tsx`, `app/(site)/(app)/highlights/page.tsx` (links antigos),
`docs/ux/ORIENTACAO.md`.

## 7. Testes executados

- `npm run typecheck` (tsc) — sem erros.
- `node scripts/i18n/check.js --fail` — paridade pt-BR/en/es e ICU válidos (410 chaves novas).
- `node scripts/i18n/scan.js --fail` — nenhum texto embutido.
- `vitest`: `components/flair/hub.test.tsx` (modelo, disponibilidade, escolha persistida, `?mode=`, redirecionamento
  de `?tab=`, teclado, indisponível/destravar, modal da primeira entrada com Esc/"Não mostrar novamente"/segunda vez
  direto, um vídeo por vez, pausa/retomar, movimento reduzido, falha de reprodução), `components/flair/cbc.test.tsx`
  (lista por janela, montagem vaga a vaga com conferência no servidor sem gravar, entrega única com modal
  "Creditado", estado somente leitura, desafio em breve e sem cartas), além das suítes existentes (guia, modos,
  smoke das páginas).
- Gravação de ponta a ponta no Chromium (Playwright) sobre a API simulada: os 9 roteiros concluíram sem erro de
  página; as capturas de desktop e celular estão em `docs/flair/capturas`.

## 8. O que ficou de fora (registrado, não implementado)

- **Pedido anterior (jogos, cartas Special, modal de recompensa, "Minhas cartas especiais")**: deste pedido maior,
  o que existe hoje no repositório é a especificação (FLAIR-UT §9, §12) e o motor dos Desafios de Montagem. O modal de
  recompensa do CBC foi implementado aqui (estados previsto / creditado / teto diário, ícone oficial de FAI Points,
  foco inicial, uma abertura por entrega). **Não existem** ainda: programa de cartas Especiais com arte própria por
  carta, gestão de cartas especiais por marcas e celebridades (subaba "Minhas cartas especiais"), autorização por
  operação no servidor para essas cartas, nem o mercado de transferências. São a fase F7/F10 do plano mestre.
- A API dos Desafios de Montagem ainda não expõe `canSubmit`/`attemptsLeft` no `/check` de forma garantida em todos
  os caminhos; a tela trata a ausência como permitido e deixa o servidor recusar a entrega (422) quando for o caso.
- Legendas: os clipes não têm narração, então não há legendas; a alternativa textual de cada clipe é a descrição
  acessível do painel (`flair.hub.mode.<modo>.demo`).
