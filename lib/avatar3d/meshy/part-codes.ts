/**
 * Rótulo da parte por vértice gravado pelo motor Blender (services/garment_blender, blender_io.PART_CODE) na cor do
 * vértice (COLOR_0, canal vermelho): 0 tronco (e capuz, detalhes do tronco, a cava), 0,25 manga do lado +x, 0,5 manga
 * do lado −x, 0,75 perna +x, 1 perna −x. Vira o rótulo do encaixe (align.ts): 0 tronco, ±1 manga, ±2 perna. Com ele,
 * a peça em escala real não depende da rotulagem por posição (parts.ts), feita para a malha fundida da Meshy.
 */
const LABELS = [0, 1, -1, 2, -2] as const;

export function partOfColor(red: number): number {
  return LABELS[Math.min(4, Math.max(0, Math.round(red * 4)))];
}

/** Rótulos de todos os vértices a partir do canal vermelho (passo `stride` entre vértices). */
export function partsOfColors(colors: ArrayLike<number>, stride: number): Int8Array {
  const out = new Int8Array(Math.floor(colors.length / stride));
  for (let v = 0; v < out.length; v++) out[v] = partOfColor(colors[v * stride]);
  return out;
}
