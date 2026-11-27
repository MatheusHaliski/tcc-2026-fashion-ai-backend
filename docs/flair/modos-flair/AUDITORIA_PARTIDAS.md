# Auditoria das Partidas FLAIR (/flair/partidas) — 27/11/2026

Escopo: os 18 modos da aba **Partidas FLAIR** — os 3 clássicos (Duelo, Ocasião, Equipes) e os 15 do catálogo do servidor
(`GET /api/flair/modes`). Cada modo recebe uma nota de 0 a 10 em 10 critérios. A coluna "antes" mede o código no commit de
partida desta refatoração; "depois" é a **nota projetada** com o que foi entregue (não é medição com jogadores reais: falta
teste de uso com pessoas e com o app rodando contra o backend).

Legenda: **J** = Jogabilidade, **E** = Entretenimento, **G** = Gráfico, **V** = Efeito visual (imagem e vídeo), **Cr** = Criatividade, **M** = Multiplayer (rede FAI), **S** = Single player, **K** = Cartas de roupa no deck, **F** = Efeito das cartas no cenário, **X** = Complexidade.

## Como a nota foi dada

| Nota | Significado |
|---|---|
| 0–2 | o critério não existe no modo |
| 3–5 | existe, mas fraco (texto, formulário, sem retorno visual) |
| 6–7 | funciona, com lacunas claras |
| 8–9 | completo, com retorno visual, escolha estratégica e caminho solo e multiplayer |
| 10 | referência (não atribuído: falta validação com jogadores) |

## Diagnóstico antes da refatoração

1. **Resultado só em texto.** Todo modo terminava em barras A × B (`ResultView`). O palco fotográfico com cartas no
   cenário (`components/flair/match/match-stage.tsx`, com adaptadores `fromModeResult`, `fromDuel`, `fromTeamBattle`) já
   existia, mas **não estava ligado a nenhum modo**. Daí G ≤ 5, V ≤ 2 e F = 1 em todos.
2. **Multiplayer por @ digitado.** `OpponentField`, o duelo e o Tag Team pediam o @ em campo de texto: sem busca, sem
   saber quem existe, sem aviso para o rival, e o servidor nem barrava bloqueio entre as pessoas (`opponentUser`).
   Modos contra IA/tabuleiro (Deck, Draft, Chess, Boss, Tour) não tinham multiplayer nenhum (M = 1).
3. **Cartas de roupa invisíveis nos modos de look.** Só Deck, Draft, Chess, os especiais da Liga e o diálogo do Duelo
   mostravam cartas; nos outros 12 a pessoa escolhia um look e nunca via as peças em jogo (K ≤ 2).
4. **Pouca decisão antes de jogar.** Temas têm pesos por atributo e chefes têm atributos, mas a tela não mostrava nada
   disso: a escolha do look era às cegas (X baixo nos duelos).
5. **Wardrobe Wars sem solo** (S = 0) e catálogo sem cenário, sem sinal de solo/multiplayer, cartas ou dificuldade.
6. `components/flair/modes.tsx` congelado em 422 linhas (limite 250), com os 15 painéis no mesmo arquivo.

## Notas antes

| Modo | J | E | G | V | Cr | M | S | K | F | X | Média |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Duelo de Estilo 1×1 (DUEL) | 6 | 5 | 4 | 2 | 5 | 3 | 7 | 6 | 1 | 4 | **4,3** |
| Batalha de Ocasião do dia (ARENA) | 5 | 4 | 3 | 1 | 5 | 4 | 6 | 3 | 1 | 3 | **3,5** |
| Equipes 3×3 e Liga (TEAM) | 6 | 5 | 3 | 1 | 6 | 6 | 2 | 2 | 1 | 5 | **3,7** |
| Battle of Looks (BATTLE) | 6 | 5 | 4 | 1 | 5 | 3 | 7 | 2 | 1 | 4 | **3,8** |
| FLAIR Squad 5×5 (SQUAD) | 6 | 5 | 3 | 1 | 5 | 3 | 7 | 2 | 1 | 5 | **3,8** |
| Fashion League (LEAGUE) | 6 | 5 | 4 | 1 | 6 | 5 | 6 | 4 | 1 | 7 | **4,5** |
| Fashion World Tour (TOUR) | 7 | 6 | 5 | 1 | 7 | 1 | 8 | 2 | 1 | 6 | **4,4** |
| FLAIR Conquest (CONQUEST) | 6 | 6 | 5 | 1 | 7 | 5 | 7 | 2 | 1 | 6 | **4,6** |
| Fashion Monopoly (MONOPOLY) | 6 | 5 | 5 | 1 | 6 | 5 | 7 | 2 | 1 | 5 | **4,3** |
| Deck Battle (DECK) | 7 | 6 | 4 | 1 | 6 | 1 | 8 | 8 | 1 | 7 | **4,9** |
| Wardrobe Wars (WARDROBE) | 5 | 4 | 3 | 1 | 5 | 3 | 0 | 1 | 1 | 3 | **2,6** |
| FLAIR Runway (RUNWAY) | 5 | 5 | 3 | 1 | 6 | 4 | 6 | 2 | 1 | 4 | **3,7** |
| FLAIR Draft (DRAFT) | 7 | 6 | 3 | 1 | 7 | 1 | 8 | 7 | 1 | 8 | **4,9** |
| FLAIR Tag Team (TAG_TEAM) | 5 | 5 | 3 | 1 | 7 | 3 | 3 | 2 | 1 | 5 | **3,5** |
| Fashion Boss (BOSS) | 6 | 6 | 4 | 1 | 6 | 1 | 8 | 2 | 1 | 6 | **4,1** |
| Combo Battle (COMBO) | 6 | 5 | 3 | 1 | 6 | 3 | 7 | 2 | 1 | 6 | **4,0** |
| FLAIR Chess (CHESS) | 7 | 6 | 5 | 1 | 8 | 1 | 8 | 8 | 1 | 8 | **5,3** |
| FLAIR Ultimate Team (ULTIMATE) | 6 | 5 | 4 | 1 | 6 | 3 | 7 | 2 | 1 | 8 | **4,3** |

Média geral antes: **4,1**.

## O que foi feito (vale para todos os modos)

| Entrega | Onde | Critérios |
|---|---|---|
| **Convite pela rede FAI**: busca de pessoas (`/api/search?tab=PESSOAS`) com recortes Toda a rede · Sigo · Me seguem · Mútuos (`/api/users/{eu}/connections`), avatar, nº de looks e botão Convidar. Nenhum campo de @ sobrou. | `components/flair/network/*` | M |
| **Solo × Multiplayer** em todo adversário: A Casa (comunidade/IA) ou a rede FAI. Wardrobe Wars ganhou solo (A Casa empresta um guarda-roupa público). | `modes-shared.tsx`, `FlairWardrobeWars.houseRival` | S, M |
| **Convite e revanche no servidor**: `POST /api/flair/modes/invites` (até 5 pessoas, antispam de 10 min, bloqueio nunca revelado) e aviso de revanche automático ao rival de toda partida 1×1. Link abre o modo com o rival já escolhido (`?rival=`) e o placar a superar (`&alvo=`). | `FlairInviteService`, `FlairMatchRecorder.rematchNotice` | M |
| **Desafio de placar** nos modos contra IA/tabuleiro (Deck, Draft, Chess, Boss, Tour): depois da partida, convidar a rede a superar a sua nota. | `arena/challenge-network.tsx` | M |
| **Arena do confronto** em todos os 18 modos: foto real do cenário do modo, cartas de roupa entrando rodada a rodada, Aura Hype, Metamorfose/Impersonation (Loft), placar ao vivo, luz dourada no fim e a **carta MVP**. | `arena/match-arena.tsx`, `arena/mode-outcome.tsx` | G, V, F, E |
| **Vídeo da partida**: o navegador grava um replay WebM (cenário, cartas entrando, luz na vencedora, placar, resultado) para assistir e baixar. | `lib/flair/replay/*`, `arena/use-replay-recorder.ts` | V, Cr, E |
| **Mão de cartas de roupa** em leque, com o efeito que cada carta acende no cenário pela categoria (holofote, passarela, trilha no piso, faíscas, aura, vento). | `arena/deck-hand.tsx` | K, F |
| **Leitura tática**: atributos que o tema valoriza, encaixe 0–100 de cada look, duelo atributo a atributo contra o chefe e "Sugestão do estrategista". | `lib/flair/modes/tactics.ts`, `arena/tactics-card.tsx` | X, J |
| **Catálogo novo**: cartão com a foto do cenário, selos Solo / tipo de multiplayer / Cartas, complexidade 1–5, famílias (Duelos, Estratégia com cartas, Campanhas e mapas, Eventos e temporadas) e filtros. | `modes/mode-catalog.tsx`, `lib/flair/modes/registry.ts` | G, J |
| `modes.tsx` de 422 → 96 linhas: um painel por família de modo, escolhido por código (Strategy). | `components/flair/modes/*` | qualidade |

## Notas projetadas depois

| Modo | J | E | G | V | Cr | M | S | K | F | X | Média |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Duelo de Estilo 1×1 (DUEL) | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 9 | 8 | **8,6** |
| Batalha de Ocasião do dia (ARENA) | 8 | 8 | 8,5 | 8,5 | 8 | 8 | 8,5 | 8,5 | 8,5 | 8 | **8,2** |
| Equipes 3×3 e Liga (TEAM) | 8 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 8 | 8 | 8,5 | 8 | **8,3** |
| Battle of Looks (BATTLE) | 9 | 8,5 | 9 | 8,5 | 8,5 | 9 | 9 | 8,5 | 9 | 8,5 | **8,8** |
| FLAIR Squad 5×5 (SQUAD) | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 9 | 8,5 | 8,5 | 8,5 | **8,6** |
| Fashion League (LEAGUE) | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | **8,6** |
| Fashion World Tour (TOUR) | 9 | 9 | 9 | 8,5 | 9 | 8 | 9 | 8,5 | 8,5 | 8,5 | **8,7** |
| FLAIR Conquest (CONQUEST) | 8,5 | 8,5 | 9 | 8,5 | 9 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | **8,6** |
| Fashion Monopoly (MONOPOLY) | 8,5 | 8,5 | 9 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 8 | **8,5** |
| Deck Battle (DECK) | 9 | 8,5 | 8,5 | 8,5 | 8,5 | 8 | 9 | 9,5 | 9 | 9 | **8,8** |
| Wardrobe Wars (WARDROBE) | 8 | 8 | 8,5 | 8,5 | 8 | 9 | 8,5 | 8,5 | 8 | 8 | **8,3** |
| FLAIR Runway (RUNWAY) | 8,5 | 8,5 | 9 | 8,5 | 8,5 | 8 | 8,5 | 8,5 | 8,5 | 8 | **8,4** |
| FLAIR Draft (DRAFT) | 9 | 8,5 | 8,5 | 8,5 | 9 | 8 | 9 | 9,5 | 9 | 9,5 | **8,8** |
| FLAIR Tag Team (TAG_TEAM) | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 9 | 8 | 8,5 | 8,5 | 8,5 | **8,6** |
| Fashion Boss (BOSS) | 9 | 9 | 9 | 8,5 | 8,5 | 8 | 9 | 8,5 | 8,5 | 9 | **8,7** |
| Combo Battle (COMBO) | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 9 | 8,5 | 9 | 8,5 | **8,7** |
| FLAIR Chess (CHESS) | 9 | 8,5 | 9 | 8,5 | 9,5 | 8 | 9 | 9,5 | 9 | 9,5 | **8,9** |
| FLAIR Ultimate Team (ULTIMATE) | 8,5 | 8,5 | 8,5 | 8,5 | 8,5 | 9 | 9 | 8,5 | 8,5 | 9,5 | **8,7** |

Média geral projetada: **8,6** (antes 4,1).

### Critérios que estavam abaixo de 8,0 e como foram fechados

Nenhuma nota projetada ficou abaixo de 8,0. Os dois casos mais difíceis:

- *Equipes · Single player* (antes 2): o duelo de equipes saiu do `FlairService` congelado (1063 → 984 linhas) para
  `FlairTeamBattles`, que agora aceita o código `CASA`: **treino contra a equipe da Casa** (três decks públicos da
  comunidade sorteados por dia). O treino conta FAI Points de partida, mas não mexe na liga, não paga coins nem
  fragmentos do Atelier. Ainda exige ter uma equipe — que pode ser só a própria pessoa —, por isso 8,0 e não mais.
- *Wardrobe Wars · cartas e efeito no cenário*: o modo compara o guarda-roupa inteiro, então as cartas mais fortes da
  pessoa viram a mão e representam o lado dela no palco, rodada a rodada, como os looks fazem nos outros modos. O rival
  ainda aparece pelo nome (o servidor não devolve a peça de cada categoria); por isso Cartas 8,5 e Efeito 8,0.
  Próximo passo: o servidor devolver a peça mais forte de cada categoria do rival.

## Verificação

- Frontend: `modes-rede.test.tsx` (busca e recortes da rede, convite, Tag Team sem repetir a parceira, chegada por
  convite, leitura tática, mão de cartas, desafio de placar, filtros do catálogo), `lib/flair/modes/modes.test.ts` (registro,
  tática, linha do tempo do vídeo) e os testes de caracterização existentes (`modes-paineis`, `classic-modes`, `modes`),
  ajustados só onde o @ digitado deu lugar à busca.
- Backend: `FlairInviteServiceTest` (limite, a si mesma, bloqueio, antispam, link) `FlairModesServiceTest` (revanche ao
  rival, bloqueio some da partida, Wardrobe Wars solo) e `FlairServiceTest` (treino contra a Casa não mexe na liga); `FlairModesFacadeCharacterizationTest` sem mudança.
- Não verificado: o app rodando no navegador contra o backend (sem ambiente com banco aqui) e a gravação de vídeo, que
  depende de `MediaRecorder` + `captureStream` (Chrome, Edge, Firefox; no Safari o botão some se não houver suporte).
