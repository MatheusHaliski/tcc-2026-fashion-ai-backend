import { ROOM, w2ToWorld } from "@/lib/room3d/room-bounds";

/*
 * Medidas e posições do Meu Quarto 3D (room-scene.tsx), sem React: níveis, o móvel FAI Origem (larguras e alturas),
 * a cor da temperatura da luz, onde fica cada objeto por nível e a âncora/frente de cada módulo. Unidades em metros.
 */

export const LEVELS = ["ESTREIA", "STUDIO", "LOFT"];
export const atLeast = (level: string | undefined, want: string) => LEVELS.indexOf(level ?? "ESTREIA") >= LEVELS.indexOf(want);

export const W = 2.4, D = 0.6, DOOR_W = 0.6, EXT_W = 1.8;
export const Y = { base0: 0, base1: 0.3, drawers1: 0.96, doors1: 2.16, top1: 2.5 };
export const DRAWER_H = (Y.drawers1 - Y.base1) / 3, DRAWER_W = W / 8, EXT_DRAWER_W = EXT_W / 4;

/** Temperatura de cor (K) → RGB aproximado, para a iluminação guiada. */
export function kelvinColor(k: number) {
  const t = k / 100; let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** Onde a mão pega a peça pendurada (relativo ao gancho): o ombro da roupa, na borda virada para fora do varão. */
export const GRAB: [number, number, number] = [0, -0.15, 0.14];

/** Posições fixas dos objetos (dependem do nível). O guarda-roupa 1 tem sempre 2,4 m; o 2º fica na parede oeste (W2). */
export function layoutFor(level?: string) {
  const xr = W / 2, closet = atLeast(level, "STUDIO");
  return {
    xr, loft: atLeast(level, "LOFT"),
    showcase: [xr + 0.35, 0, -0.08] as [number, number, number],
    bags: [xr + 1.0, 0, -0.08] as [number, number, number],
    sale: [-0.95, 0, ROOM.maxZ - 0.42] as [number, number, number],   // arara na parede sul, de frente para o quarto
    basket: [xr + 0.5, 0, 0.55] as [number, number, number],
    window: [xr + (closet ? 1.5 : 1.3), 2.05, -D / 2 - 0.005] as [number, number, number],
    window2: [ROOM.maxX - 0.015, 2.05, 2.45] as [number, number, number],
    lamp: [xr + (closet ? 2.5 : 1.9), 0, 0.35] as [number, number, number],
    calendar: [xr + 0.35, 1.72, -D / 2 - 0.005] as [number, number, number],
    mirror: [xr + .75, 0, 1.1] as [number, number, number],
    chair: [-W / 2 - 0.75, 0, 1.75] as [number, number, number],
    bust: [-W / 2 - 0.45, 0, 0.0] as [number, number, number],
    switch: [-W / 2 - 0.2, 1.15, -D / 2 - 0.005] as [number, number, number],
    keys: [-W / 2 - 0.2, 1.5, -D / 2 - 0.005] as [number, number, number],
    // quadro entre o batente da porta (−2,29) e o guarda-roupa (−1,22)
    cork: [-1.74, 2.4, -D / 2 - 0.005] as [number, number, number],
    door: [-2.75, 0, ROOM.minZ] as [number, number, number],
    box: [0.95, 0, 1.45] as [number, number, number],
    island: [-0.45, 0, 1.55] as [number, number, number],
  };
}

/** O módulo fica no 2º guarda-roupa (parede oeste): portas 5–6 e gavetas 25–36. */
const inW2 = (id: string) => (id.startsWith("door:") && Number(id.split(":")[1]) >= 5) || (id.startsWith("drawer:") && Number(id.split(":")[1]) > 24);
/** Posição (em coordenadas da cena) de um módulo, para o enquadramento e para o busto apontar. */
export function moduleAnchor(id: string, level?: string): [number, number, number] {
  const L = layoutFor(level);
  if (id.startsWith("door:")) {
    const i = Number(id.split(":")[1]) - 1;
    if (i >= 4) return w2ToWorld(-EXT_W / 2 + (i - 4) * (EXT_W / 2) + EXT_W / 4, Y.drawers1 + 0.6, 0.2);
    return [-W / 2 + i * DOOR_W + DOOR_W / 2, Y.drawers1 + 0.6, 0.2];
  }
  if (id.startsWith("drawer:")) {
    const n = Number(id.split(":")[1]);
    if (n > 24) { const k = n - 25; return w2ToWorld(-EXT_W / 2 + (k % 4) * EXT_DRAWER_W + EXT_DRAWER_W / 2, Y.drawers1 - (Math.floor(k / 4) + 0.5) * DRAWER_H + 0.05, 0.6); }
    const col = (n - 1) % 8, row = Math.floor((n - 1) / 8); return [-W / 2 + col * DRAWER_W + DRAWER_W / 2, Y.drawers1 - (row + 0.5) * DRAWER_H + 0.05, 0.6];
  }
  if (id === "top" || id === "season") return [0, Y.doors1 + 0.17, 0.2];
  if (id === "base" || id === "shoe") return [0, 0.15, 0.3];
  if (id === "basket") return [L.basket[0], 0.3, L.basket[2]];
  if (id === "chair") return [L.chair[0], 0.6, L.chair[2]];
  if (id === "sale") return [L.sale[0], 1.0, L.sale[2]];
  if (id === "bags" || id === "jewelry") return [L.bags[0], 1.0, 0.1];
  if (id === "island") return [L.island[0], 0.5, L.island[2]];
  if (id === "mirror") return [L.mirror[0], 1.1, L.mirror[2]];
  return [0, 1.2, 0];
}
/** Para onde a frente do módulo olha, no chão (x, z): o 2º guarda-roupa olha para leste (+x), a arara (parede sul) para o norte; o resto, para a câmera. */
export function moduleFacing(id: string): [number, number] { return inW2(id) ? [1, 0] : id === "sale" ? [0, -1] : [0, 1]; }
