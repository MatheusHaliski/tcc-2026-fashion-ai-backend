/**
 * Camada de baixo debaixo da peça de cima, as duas de .glb: a calça larga da Meshy tem o cós mais largo que o tronco
 * e atravessa a barra do moletom. Como a pele debaixo da roupa (glb-garment/cover.ts), o que fica DEBAIXO da peça de
 * cima não é desenhado: os triângulos da calça inteiros acima da barra da peça de cima saem do índice. A geometria
 * (posições, pesos) não muda; o desmonte do provador descarta a malha como sempre.
 */
export const TUCK_MARGIN = 0.03;

/**
 * Índice sem os triângulos com os três vértices acima de `hemY + margin` (altura posada, `posedY` por vértice).
 * Devolve null quando nada muda.
 */
export function tuckedIndex(index: ArrayLike<number>, posedY: ArrayLike<number>, hemY: number, margin = TUCK_MARGIN): Uint32Array | null {
  const cut = hemY + margin, keep: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (posedY[a] > cut && posedY[b] > cut && posedY[c] > cut) continue;
    keep.push(a, b, c);
  }
  return keep.length === index.length ? null : Uint32Array.from(keep);
}

/** Barra da peça de cima: a menor altura posada do tronco dela (rótulo 0; manga e perna não contam). */
export function hemOf(posedY: ArrayLike<number>, part: ArrayLike<number>): number {
  let hem = Infinity;
  for (let v = 0; v < part.length; v++) if (part[v] === 0) hem = Math.min(hem, posedY[v]);
  return hem;
}
