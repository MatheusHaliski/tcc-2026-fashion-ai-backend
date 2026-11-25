# Motor Blender no provador — deformações corrigidas (25/11/2026)

Laboratório (`/lab/scenes?s=fitting-neutral`, `sizes=letter:P|GG`), corpos de referência masculino e feminino.

| Arquivo | O que mostra |
|---|---|
| `antes-pontas-axila.jpg` | antes: camiseta em P e GG com pontas horizontais na lateral do peito, na altura da axila |
| `tamanhos-p-gg.jpg` | depois: camiseta GG/P (masc.), P (fem.), suéter GG (fem.), moletom P (masc.); frente e ¾ |

Causas e correções:

1. **Tamanho diferente do gerado** mudava tronco e manga separados, depois do encaixe: a parede do tronco atravessava a
   cabeça da manga. Agora o tamanho muda a própria peça antes do encaixe (`sizedGarment`, `lib/avatar3d/meshy/size.ts`).
2. **Alargamento do tronco** (`width.ts`) cobria os braços da axila para cima e tratava a faixa que só tinha o detalhe do
   peito como um tronco estreito (escala 1,6×). Na peça do motor (mangas rotuladas) o tronco não alarga acima da axila e
   faixas com menos da metade da largura do corpo são ignoradas.
3. **Axila da manga** sai na direção do braço, rente ao tronco (motor: `sleeves.py`).

Aceite offline (`meshy-real.test.ts`): camiseta, suéter, moletom, cargo e calça passam em P/M/GG (36/40/46); o
esticamento caiu de 1,30–1,52 para 1,10–1,33. Limite conhecido: a camiseta de corte masculino em P num corpo feminino
fica larga nos ombros (a peça tem 16 cm a mais de tórax que o corpo) — é tamanho, não defeito de malha.
