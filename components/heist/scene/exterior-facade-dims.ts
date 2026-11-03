/*
 * MET Gala Heist v2 — fachada do museu: medidas da fachada do museu (planos das paredes, pavilhão central, colunas, alturas do
 * entablamento e do ático, arcos, alas, vão da doca) e os perfis de moldura.
 */
/* ---------- medidas da fachada (m) ---------- */
export const FACADE_Z = 24.5;
export const WALL_BACK = 24.05;                      // a face interna (z = 24) é do interior
export const EAST_X = 22.5, NORTH_Z = -22.5, WEST_END = -60;
export const HALF = 15.6;                            // meia largura do pavilhão central
export const PAIRS = [-13.4, -4.6, 4.6, 13.4];       // centros dos pares de colunas
export const PAIR_GAP = 0.65;                         // meia distância entre as duas colunas do par
export const COL_R = 0.48;
export const isFree = (x: number) => Math.abs(x) < 10;   // os pares de dentro ficam soltos no patamar; os de fora, encostados
export const colZ = (x: number) => (isFree(x) ? 25.15 : FACADE_Z + 0.2);
export const Y_PED = 1.7, Y_SHAFT = Y_PED + 0.42, Y_CAP = 8.9, CAP_H = 1.1, Y_ENT = Y_CAP + CAP_H, Y_FRIEZE = Y_ENT + 0.6, Y_CORN = Y_FRIEZE + 0.6, Y_ENT_TOP = Y_CORN + 0.6;
export const Y_ATTIC_TOP = 14.6, Y_TOP = 15.35;
export const ARCHES = [{ cx: -9, w: 4.2, spring: 5.9 }, { cx: 0, w: 4.2, spring: 5.9 }, { cx: 9, w: 4.2, spring: 5.9 }];
export const WING_TOP = 11.0, WING_CORNICE = 11.6, WING_BAL = 12.55;
/** Janelas das alas: vão de 3,6 m, janela do piso nobre com frontão e a de cima, menor. */
export const BAY = 3.6;
/** Vão do portão da doca na ala oeste. */
export const DOCK_X0 = -21.1, DOCK_X1 = -16.9, DOCK_H = 4.45;

/* perfis de moldura (z para fora, y para cima) */
export const P_CORNICE: [number, number][] = [[0, 0], [0.08, 0], [0.1, 0.06], [0.16, 0.1], [0.18, 0.18], [0.42, 0.24], [0.5, 0.3], [0.62, 0.36], [0.62, 0.46], [0, 0.46]];
export const P_ARCHITRAVE: [number, number][] = [[0, 0], [0.18, 0], [0.18, 0.18], [0.21, 0.2], [0.21, 0.38], [0.25, 0.42], [0.25, 0.6], [0, 0.6]];
export const P_WATER: [number, number][] = [[0, 0], [0.14, 0], [0.14, 0.05], [0.06, 0.16], [0, 0.18]];
export const P_BIGCORNICE: [number, number][] = [[0, 0], [0.1, 0], [0.14, 0.08], [0.22, 0.14], [0.26, 0.24], [0.6, 0.32], [0.7, 0.42], [0.86, 0.5], [0.86, 0.66], [0.7, 0.72], [0, 0.75]];
export const P_SILL: [number, number][] = [[0, 0], [0.16, 0.02], [0.18, 0.1], [0.12, 0.14], [0, 0.14]];
