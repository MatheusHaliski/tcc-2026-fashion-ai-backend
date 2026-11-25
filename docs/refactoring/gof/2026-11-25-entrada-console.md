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

Próximos passos (etapa 4 do plano): um provedor único por tela (um `keydown` e um laço do controle, com camadas
jogo, inventário, pausa e diálogo — **Observer** e **State**), o menu de pausa e a migração das telas. Até lá,
`lib/flair/nucleos/controls.ts` continua valendo; nada do comportamento atual mudou nesta etapa.
