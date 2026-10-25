# Câmera de detalhe e rolagem inteligente do provador — 2026-10-25

## Câmera de detalhe

O painel no canto superior esquerdo do palco tem três enquadramentos:

| Enquadramento | O que a câmera faz |
| --- | --- |
| Corpo inteiro | A órbita de sempre em volta do avatar (1,4 m até 1,25 × a distância inicial). |
| Calçado | O alvo da órbita vai para o pé esquerdo do avatar, visto da frente e de fora (onde fica a marca do tênis). Arrastar gira em volta do tênis; a roda aproxima até 12 cm. |
| Percorrer o corpo | A câmera desliza pela superfície do corpo: gola e decote, ombro, peito e marca, cintura, quadril e bolso, joelho e caimento, barra, calçado. Deslizante, paradas em um toque ou a roda. |

As paradas são achadas nos vértices do corpo composto em repouso (`lib/scene3d/detail-camera.ts`), para qualquer
estatura e compleição, e seguem o corpo posado em cena pela pele de um vértice âncora (`posedStops` em
`components/three/fitting-camera.tsx`). Trocar de vista volta ao corpo inteiro. Com "reduzir movimento", a câmera chega
de uma vez.

## Rolagem inteligente

A roda do mouse ou do trackpad em cima do 3D não prende mais a página. Um ouvinte no palco, em fase de captura, decide
antes do OrbitControls (`components/try-on/use-smart-wheel.ts`, regras em `lib/scene3d/wheel-intent.ts`):

- **Câmera:** pinça no trackpad; a pessoa mexeu no palco há menos de 4 s (clique, arrasto, botão do painel); ou o ponteiro
  entrou ou se mexeu sobre o palco depois que a página parou e ficou ali 600 ms.
- **Página:** a página rolou há menos de 450 ms; rolagem "fria" sem nenhum dos sinais acima, que mostra uma dica breve;
  rolagem horizontal pura; roda sobre o painel ou os botões.
- **Limite:** quando a câmera chega ao limite (zoom máximo ou mínimo, fim do percurso), a roda volta para a página e o
  resto do gesto rola a página.

O arrasto e a pinça no toque continuam com o OrbitControls; o toque no celular não mudou.

## Verificação

- Testes: paradas no corpo real feminino e masculino, âncoras, percurso e roda; cena de verdade no renderizador de teste
  (foco no tênis, limite de aproximação, percurso, volta ao corpo); painel; rolagem com eventos de roda no DOM.
- Navegador (Chromium): `/lab/scenes?s=fitting-neutral&panel=1` mostra o painel e a rolagem inteligente sobre a cena do
  laboratório; `?size=390x460` simula o palco do celular. `window.__lab.detail("calcado")`,
  `__lab.detail("percurso", "gola")`, `__lab.travel(t)` e `__lab.wheel(dy)` servem às capturas.
