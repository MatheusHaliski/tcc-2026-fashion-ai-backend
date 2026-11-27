# Entrada de console dos jogos FLAIR

Problema: cada tela de jogo lia o teclado e o controle do seu jeito (`use-nucleo-controls`, `use-mao-controle` do
Fashion Sports, o Z do CBC e do elenco, o direcional do hub e do MET Gala Heist). Eram 10 ações em 18 teclas e 14
botões, metade delas enfeite (girar, zoom, posar), e as ações que decidiam a partida só existiam como clique. A dona
pediu o padrão de console: mover no teclado ou analógico e X, O, quadrado e triângulo para agir no cenário, sem
comandos além dos necessários (auditoria de 25/11/2026, `docs/flair/flair-3d/AUDITORIA_2026-11-25.md`).

Decisão:

- **Adapter** (`lib/flair/entrada/teclado.ts`, `gamepad.ts`): cada aparelho vira as mesmas cinco ações
  (`INTERAGIR`, `CANCELAR`, `ACAO`, `INVENTARIO`, `PAUSAR`) e dois eixos (mover e câmera). O jogo nunca lê tecla nem
  número de botão. O teclado usa `KeyboardEvent.code`, então WASD vale em qualquer layout.
- **Tabela de dados** (`mapa-por-jogo.ts`) no lugar de uma classe por jogo: o que muda entre jogos é só o que o
  quadrado faz e se o analógico anda, salta entre pontos ou move o foco. Derivada das ações que o servidor já manda,
  sem mudar o contrato.
- **Glifos** (`glifos.ts`) pelo último aparelho usado: símbolos do PlayStation, letras do Xbox, tecla do teclado.

Etapa 4 (feita): as telas dos 15 jogos já usam o padrão. `lib/flair/nucleos/controls.ts` traduz teclado e controle
para os comandos da tela — setas/WASD e analógico esquerdo movem o foco, ✕ (Espaço/E) veste, ○ (Shift/Backspace) tira,
□ (F) é o gesto do jogo (desfilar, ou posar onde não há desfile), △ (I) troca a aba das roupas, Start (Esc) abre a pausa
com o objetivo. Saíram zoom, girar e posar em tecla própria, LB/RB, gatilhos e Select. Na pausa, ✕ entrega o look e ○
volta (`use-nucleo-comandos.ts`); na ação, o foco passa pelos botões da faixa de baixo e ✕ aperta o que está em foco
(`foco-da-acao.ts`), então jogar a carta, seguir sem carta e ver o resultado têm comando. Ampliar a carta passou de I
para Z. O Fashion Sports mantém a mão de cartas própria (`use-mao-controle.ts`), com o mesmo mapa.

Etapa 15 (feita): andar livre na preparação de Passarela, Dress the Star, Personagem de Filme, Boutique 3D, Labirinto,
Around the World e Batalha de Looks (`mapa-por-jogo.ts`, movimento LIVRE). WASD e o analógico esquerdo levam a
personagem pela sala (`use-eixo-de-andar.ts` publica o eixo; `scene/andarilho.tsx` anda; `lib/flair/nucleos/movimento/
andar.ts` faz a conta pura com colisão nos móveis e a área do palco ou da passarela); as setas e o direcional
continuam no menu. A velocidade é a agilidade do look (regra peça-recurso). Fora da preparação, a personagem volta à
marca, de onde as sequências do diretor partem.

Ainda não feito: um provedor único com camadas (hoje cada tela liga o próprio `keydown`), a tela de toque com o losango
de botões e os símbolos de cada controle na ajuda (`glifos.ts` existe, falta ligar).
