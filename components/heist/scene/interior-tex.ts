/*
 * MET Gala Heist v2 — texturas procedurais do interior, desenhadas no navegador (nenhuma imagem baixada): pisos (terrazzo
 * com filetes de mármore amarelo do Grande Salão, xadrez de mármore do vestíbulo, assoalho escuro da exposição, carpete
 * adamascado do lounge, concreto, mármore negro da Sala das Joias, lajotas do terraço), paredes (calcário em blocos,
 * pintura de galeria, veludo adamascado, lambri, drywall, bloco de concreto) e os mapas de relevo e rugosidade de cada
 * uma. Todo ruído é periódico: a textura repete sem emenda. Também desenha os cartazes, placas e telas (canvas 2D).
 *
 * Este módulo é a fachada: o ruído (interior-tex-noise), o gerador de superfícies (interior-tex-surface), as famílias
 * de superfície (interior-tex-floors, -walls, -misc) e os desenhos em canvas (interior-tex-drawn) ficam nos arquivos
 * ao lado; aqui fica a tabela de repetição no mundo (TILE) e o que os outros arquivos importam.
 *
 * Nos testes (jsdom, contexto 2D falso) as texturas saem com 8 px: a cena monta igual, sem custo.
 */
import type { FloorKey } from "./interior-tex-floors";
import type { WallKey } from "./interior-tex-walls";
import type { MiscKey } from "./interior-tex-misc";

export type { Quality, Surface } from "./interior-tex-surface";
export { fbm, rand } from "./interior-tex-noise";
export { floorSurface, type FloorKey } from "./interior-tex-floors";
export { wallSurface, type WallKey } from "./interior-tex-walls";
export { miscSurface, type MiscKey } from "./interior-tex-misc";
export { HAND, SANS, SERIF, drawGown, drawSymbol, drawnTexture, fit, paper, spaced } from "./interior-tex-drawn";

/** Metros que uma repetição da textura cobre no mundo (u = x / tamanho). */
export const TILE: Record<FloorKey | WallKey | MiscKey, [number, number]> = {
  terrazzo: [2, 2], checker: [1.2, 1.2], parquet: [2, 2], carpet: [1.2, 1.2], stage: [3, 3], concrete: [3, 3], marbleBlack: [1.2, 1.2], pavers: [2.4, 2.4], galleryMarble: [2, 2],
  limestone: [2.4, 1.2], galleryPaint: [2, 2], damaskGreen: [0.8, 0.8], woodPanel: [1, 1.1], blackPaint: [2, 2], drywall: [2, 2], cmu: [1.6, 0.8], damaskPlum: [0.8, 0.8], damaskTeal: [0.8, 0.8],
  plaster: [2, 2], acoustic: [1.2, 1.2], marbleWhite: [1, 1], fabric: [0.5, 0.5], brushed: [1, 1], grain: [1, 1], leather: [0.4, 0.4], crate: [1.2, 1.2], hedge: [0.6, 0.6],
};
