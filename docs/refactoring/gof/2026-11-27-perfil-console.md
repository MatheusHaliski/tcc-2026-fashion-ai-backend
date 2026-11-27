# Perfil de controles "console" por jogo (FLAIR 3D)

Problema: a dona jogou o Fashion Detective em 27/11/2026 e pediu tela cheia, HUD mínimo de console (estilo PS5), setas
para andar, mira no A, roda de recursos e armas no X com P para pegar. O mapa comum (`lib/flair/nucleos/controls.ts`)
usa as setas e o A para navegar cartas, o E para vestir e o F para desfilar, e os outros 14 jogos dependem dele. Trocar
o mapa de uma vez quebraria esses jogos no meio de outras frentes.

Decisão:

- **Strategy por tabela de dados** (`lib/flair/nucleos/controle/perfil-console.ts`, `PERFIL_POR_JOGO`): cada jogo
  escolhe o perfil "legado" (o mapa de `controls.ts`, intocado, com teste de caracterização em
  `perfil-legado.test.ts`) ou "console". Só o Fashion Detective está no console. Sem classe por jogo: o que muda é só
  qual tabela de teclas vale.
- **Adapter** (`components/flair/nucleos/console/use-controle-console.ts`): teclado e Gamepad API viram as mesmas
  ações do console (`INTERAGIR`, `MIRAR`, `DISPARAR`, `RODA`, `PEGAR`, `RECARREGAR`, `TELA_CHEIA`, `PAUSA`, `AJUDA`,
  `PAINEL_ESQUERDO`, `PAINEL_DIREITO`), com "desce" e "sobe" para as seguradas (A e X). O vetor de andar vai para
  `estado-do-console.ts`, lido pela cena a cada quadro (o mesmo desenho do `eixo-de-andar.ts`).
- O jogo no perfil console liga `telaPropria` em `use-modo-por-cartas.tsx`: a tela de jogo esconde a faixa de baixo
  e desliga o teclado legado (`useNucleoComandos` com `ativo` falso), para nenhuma tecla valer duas vezes.

Componentes reutilizáveis (outros jogos adotam trocando o perfil na tabela e montando o palco):
`RodaRadial`, `PainelLateral` + `usePaineisLaterais`, `AjudaDeControles`, `useTelaCheia`, `useAvisoCurto`,
`IconeConsole` e o CSS `60-flair3d-console.css` e `62-flair3d-console-paineis.css`.

Descartado: um Command por tecla (o jogo já recebe a ação nomeada; um objeto por tecla não tira nenhum `if`) e mudar o
mapa legado (quebraria os 14 jogos; a frente A0 migra um por vez).
