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

/** Setores (10°) em volta do eixo do corpo: a barra é medida em cada um. */
const SECTORS = 36;

/** Barra da peça de cima por setor em volta do corpo; `Infinity` onde a peça não tem pano (a frente aberta do blazer). */
export interface HemProfile { cx: number; cz: number; hem: Float32Array }

const sectorOf = (x: number, z: number, p: { cx: number; cz: number }) =>
  Math.min(SECTORS - 1, Math.floor(((Math.atan2(z - p.cz, x - p.cx) + Math.PI) / (2 * Math.PI)) * SECTORS));

/**
 * Barra por setor: a blusa de barra torta (mais comprida de um lado) e o blazer de frente aberta não têm UMA altura
 * de barra — com a mais baixa, a saia sumia também onde a blusa é curta e sobrava um vão com o forro à vista.
 * `posed`: xyz posado da peça de cima; só o tronco (rótulo 0) conta. Null se a peça não tem tronco.
 */
export function hemProfile(posed: ArrayLike<number>, part: ArrayLike<number>): HemProfile | null {
  let cx = 0, cz = 0, n = 0;
  for (let v = 0; v < part.length; v++) if (part[v] === 0) { cx += posed[v * 3]; cz += posed[v * 3 + 2]; n++; }
  if (!n) return null;
  const p = { cx: cx / n, cz: cz / n, hem: new Float32Array(SECTORS).fill(Infinity) };
  for (let v = 0; v < part.length; v++) {
    if (part[v] !== 0) continue;
    const s = sectorOf(posed[v * 3], posed[v * 3 + 2], p); p.hem[s] = Math.min(p.hem[s], posed[v * 3 + 1]);
  }
  return p;
}

/** Como `tuckedIndex`, com a barra do setor de cada vértice da peça de baixo (`posed`: xyz posado dela). */
export function tuckedBySector(index: ArrayLike<number>, posed: ArrayLike<number>, profile: HemProfile, margin = TUCK_MARGIN): Uint32Array | null {
  const under = (v: number) => posed[v * 3 + 1] > profile.hem[sectorOf(posed[v * 3], posed[v * 3 + 2], profile)] + margin, keep: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (under(a) && under(b) && under(c)) continue;
    keep.push(a, b, c);
  }
  return keep.length === index.length ? null : Uint32Array.from(keep);
}
