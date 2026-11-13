# R91 — FLAIR 3D: momentos da partida (State) e efeitos das cartas (Observer)

Contrato: `docs/flair/flair-3d/DESENHO_DA_TELA.md`, seções 1 e 4.

**Problema concreto 1.** A tela de jogo tinha dois estados implícitos (jogo ou resultado) e aceitava qualquer comando a
qualquer hora. O desenho pede quatro momentos (deck, preparação, ação, resultado), cada um com o que a pessoa pode fazer
com a carta, e o mesmo comando (Enter, Espaço, toque) muda de sentido conforme o momento.

**Decisão: State, como tabela de transições.** `lib/flair/nucleos/moments.ts` guarda o estado (`Momento`), a transição
(`proximoMomento`) e o que vale em cada estado (`permitido`, `comandoPermitido`, `ACIONAMENTOS`). É uma função pura e
não uma classe por estado porque os estados não têm comportamento próprio além de "o que é permitido"; a tela
(`use-nucleo-moments.ts`, `nucleo-game.tsx`) só pergunta. Alternativa descartada: `if (resultado)` espalhado pelos
componentes, que era o que existia e não tinha onde pôr a ação nem os acionamentos.

**Problema concreto 2.** Os efeitos das cartas aparecem em dois lugares que têm donos diferentes: a camada sobre o palco
(DOM) e o interior da cena 3D (luz atrás do avatar, LED da passarela, espelho). A tela de jogo não pode importar a cena
nem a cena importar a tela.

**Decisão: Observer.** `lib/flair/nucleos/fx-events.ts` (`assinarFx`, `emitirFx`) publica cada fato da partida que tem
efeito visual: troca de momento, carta vestida, passo da ação, fim da ação e acionamento. A camada sobre o palco
desenha a partir do mesmo dado; a cena assina se quiser. Os eventos carregam só o que o servidor já calculou, então
nenhum assinante consegue mudar a nota. Alternativa descartada: props novas em `NucleoScene` para cada efeito, que
acoplaria a cena a cada jogo e a cada mudança do desenho.

**Onde não há padrão (NENHUM).** `quadro.ts`, `card-fx.ts`, `action-fx.ts` e `deck-row.ts` são tabelas e funções puras;
`fx-sound.ts` é um módulo com um `AudioContext` preguiçoso, sem hierarquia.
