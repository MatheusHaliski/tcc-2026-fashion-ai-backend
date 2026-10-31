/*
 * MET Gala Heist v2 — a geometria da quadra em volta da avenida (sem React): cada prédio é uma fachada montada peça por
 * peça num referencial local (x para a direita de quem olha da rua, y para cima a partir da calçada, z para fora da parede)
 * e levada ao mundo por uma matriz. Térreo com lojas de verdade: vão com caixilho, rodapé, porta, bandeira, vidro recuado,
 * o interior (parede do fundo do ramo, paredes laterais, teto e piso do atlas), os móveis da loja, o letreiro (caixa de luz
 * ou neon), o toldo com sanefa, a porta de enrolar da loja fechada com cartazes colados. Andares de cima com janelas em vão
 * real (peitoril, verga, ombreira, vidro recuado com a variante do atlas), caixilho, peitoril de pedra, verga com aduela,
 * ar-condicionado, sacadas, frisos, cornija, platibanda e, no telhado, caixa d'água, casa de máquinas e antenas.
 *
 * Tudo cai num CityKit: geometrias por material (fundidas depois numa malha por material) e matrizes das peças repetidas
 * (instâncias), mais as âncoras de luz das vitrines e as poças de luz delas na calçada.
 */
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, lathe, merge, moldingSouth } from "./exterior-geometry";
import { cellUV, flyerUV, INT, INT_COLS, INT_ROWS, SHOP_KINDS, SHOPS, SIGN, SIGN_COLS, SIGN_ROWS, WIN_COLS, WIN_LIT, WIN_ROWS, type ShopKind } from "./exterior-citytex";
import { prng } from "./exterior-textures";

/** Alinhamento das fachadas: do outro lado da avenida (z) e do lado do museu. */
export const FAR_LINE = 51.3, NEAR_LINE = 24.5;
/** Ruas transversais (só do lado de lá da avenida): pista e calçadas. */
export const CROSS = [{ walk0: -44, road0: -41, road1: -34, walk1: -31 }, { walk0: 44, road0: 47, road1: 54, walk1: 57 }] as const;
export const CITY_X = 140;                  // até onde a avenida segue com prédios (some na névoa)
export const CROSS_Z1 = 170;                // até onde as transversais seguem

export type Wall = "limestone" | "brick" | "brickDark" | "stucco" | "concrete" | "castIron" | "curtain";
export type Style = "prewar" | "brick" | "deco" | "loft" | "modern";
const WALL: Record<Style, Wall> = { prewar: "limestone", brick: "brick", deco: "stucco", loft: "castIron", modern: "concrete" };

export interface Anchor { pos: THREE.Vector3; color: string; i: number }
export interface Pool { pos: THREE.Vector3; rx: number; rz: number; color: string; s: number; rot: number }
export interface Glow { pos: THREE.Vector3; size: number; color: string; blink?: number }

export class CityKit {
  geos = new Map<string, THREE.BufferGeometry[]>();
  inst = new Map<string, THREE.Matrix4[]>();
  /** cor por instância (vestidos, cadeiras…) */
  tint = new Map<string, THREE.Color[]>();
  anchors: Anchor[] = []; pools: Pool[] = []; glows: Glow[] = [];
  add(key: string, g: THREE.BufferGeometry, m?: THREE.Matrix4) { if (m) g.applyMatrix4(m); const l = this.geos.get(key); if (l) l.push(g); else this.geos.set(key, [g]); }
  put(key: string, m: THREE.Matrix4, color?: THREE.Color) {
    const l = this.inst.get(key); if (l) l.push(m); else this.inst.set(key, [m]);
    if (color) { const c = this.tint.get(key); if (c) c.push(color); else this.tint.set(key, [color]); }
  }
  merged(): Map<string, THREE.BufferGeometry> { const out = new Map<string, THREE.BufferGeometry>(); for (const [k, l] of this.geos) out.set(k, merge(l)); return out; }
}

/** Quad em z constante (local), de (x0, y0) a (x1, y1), com o retângulo de UV dado; virado para +z (ou −z com flip). */
function quad(x0: number, y0: number, x1: number, y1: number, z: number, uv: [number, number, number, number], flip = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), [u0, v0, u1, v1] = uv;
  const p = flip ? [x1, y0, z, x0, y0, z, x0, y1, z, x1, y0, z, x0, y1, z, x1, y1, z] : [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z];
  const t = flip ? [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1] : [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
  const n = flip ? -1 : 1;
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(t, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n], 3));
  return g;
}
/** Quad em x constante (parede lateral de dentro da loja), de z0 a z1 e y0 a y1, virado para +x (ou −x). */
function quadX(x: number, z0: number, z1: number, y0: number, y1: number, uv: [number, number, number, number], towardPlusX: boolean) {
  const [u0, v0, u1, v1] = uv, g = new THREE.BufferGeometry();
  const za = towardPlusX ? z1 : z0, zb = towardPlusX ? z0 : z1;                       // da esquerda para a direita de quem olha de frente
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, za, x, y0, zb, x, y1, zb, x, y0, za, x, y1, zb, x, y1, za], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  const n = towardPlusX ? 1 : -1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute([n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0], 3));
  return g;
}
/** Quad horizontal (teto/piso), de x0…x1 e z0…z1 na altura y, virado para cima (piso) ou para baixo (teto). */
function quadY(x0: number, x1: number, z0: number, z1: number, y: number, uv: [number, number, number, number], up: boolean) {
  const [u0, v0, u1, v1] = uv, g = new THREE.BufferGeometry();
  // de cima: direita = +x, para cima na tela = −z; de baixo: direita = −x
  const P = up ? [[x0, z1], [x1, z1], [x1, z0], [x0, z0]] : [[x1, z1], [x0, z1], [x0, z0], [x1, z0]];
  const pos: number[] = [], uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], t: number[] = [];
  for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k][0], y, P[k][1]); t.push(uvs[k][0], uvs[k][1]); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(t, 2));
  const n = up ? 1 : -1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0], 3));
  return g;
}
const L = (x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));

/* ---------- peças repetidas (instâncias), em metros, no referencial local da fachada (frente para +z) ---------- */
export const PARTS = {
  /** ar-condicionado de janela: gabinete bege com grelha e o suporte */
  ac: () => merge([boxGeo(-0.32, 0, 0, 0.32, 0.4, 0.5), boxGeo(-0.3, 0.04, 0.5, 0.3, 0.36, 0.52), boxGeo(-0.26, -0.25, 0.05, -0.22, 0, 0.45), boxGeo(0.22, -0.25, 0.05, 0.26, 0, 0.45)]),
  /** grade de sacadinha (balconete) de ferro, 1,4 m */
  balconette: () => { const parts: THREE.BufferGeometry[] = [boxGeo(-0.72, 0.9, 0, 0.72, 0.94, 0.28), boxGeo(-0.72, 0, 0.24, 0.72, 0.04, 0.28), boxGeo(-0.72, 0, 0, -0.68, 0.94, 0.28), boxGeo(0.68, 0, 0, 0.72, 0.94, 0.28)]; for (let x = -0.6; x <= 0.61; x += 0.12) parts.push(boxGeo(x - 0.008, 0.04, 0.255, x + 0.008, 0.9, 0.27)); return merge(parts); },
  /** laje de sacada (2,6 m) e o guarda-corpo de vidro com perfil */
  balconySlab: () => boxGeo(-1.3, -0.16, 0, 1.3, 0, 1.2),
  balconyRail: () => merge([boxGeo(-1.3, 0, 1.16, 1.3, 1.0, 1.2), boxGeo(-1.3, 0, 0, -1.26, 1.0, 1.2), boxGeo(1.26, 0, 0, 1.3, 1.0, 1.2)]),
  railTop: () => merge([boxGeo(-1.32, 1.0, 1.14, 1.32, 1.05, 1.22), boxGeo(-1.32, 1.0, 0, -1.24, 1.05, 1.22), boxGeo(1.24, 1.0, 0, 1.32, 1.05, 1.22)]),
  /** caixa d'água de madeira com teto cônico e as pernas de aço */
  tank: () => merge([lathe([[0, 0], [1.6, 0], [1.6, 3.2], [1.66, 3.25], [0.2, 4.3], [0, 4.35]], 18)]),
  tankLegs: () => { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; parts.push(boxGeo(Math.cos(a) * 1.3 - 0.08, -3, Math.sin(a) * 1.3 - 0.08, Math.cos(a) * 1.3 + 0.08, 0, Math.sin(a) * 1.3 + 0.08)); } parts.push(boxGeo(-1.5, -0.12, -1.5, 1.5, 0, 1.5)); return merge(parts); },
  antenna: () => merge([boxGeo(-0.04, 0, -0.04, 0.04, 9, 0.04), boxGeo(-0.6, 6, -0.02, 0.6, 6.05, 0.02), boxGeo(-0.4, 7.5, -0.02, 0.4, 7.55, 0.02)]),
  /** manequim de vitrine (busto, pescoço e cabeça lisos, na haste com base) e o vestido longo dele */
  mannequin: () => merge([lathe([[0, 0], [0.18, 0], [0.18, 0.02], [0.02, 0.04], [0.015, 0.95], [0.11, 1.0], [0.15, 1.12], [0.13, 1.3], [0.16, 1.42], [0.12, 1.5], [0.05, 1.53], [0.045, 1.6], [0.07, 1.66], [0.08, 1.74], [0.05, 1.8], [0, 1.82]], 16)]),
  gown: () => lathe([[0, 0.02], [0.52, 0.02], [0.5, 0.1], [0.38, 0.5], [0.24, 0.85], [0.14, 1.02], [0.12, 1.12], [0.15, 1.26], [0.14, 1.42], [0, 1.44]], 22),
  /** mesa de bistrô (tampo redondo de mármore, coluna e pé de ferro) e cadeira thonet */
  table: () => merge([lathe([[0, 0], [0.24, 0], [0.24, 0.03], [0.04, 0.06], [0.03, 0.72], [0.3, 0.72], [0.3, 0.75], [0, 0.75]], 18)]),
  /** peça pendurada na arara (cabide em cima, caimento até ~1 m) */
  garment: () => merge([boxGeo(-0.22, -1.0, -0.025, 0.22, -0.05, 0.025), boxGeo(-0.2, -0.06, -0.006, 0.2, 0.0, 0.006)]),
  chair: () => merge([boxGeo(-0.2, 0.44, -0.2, 0.2, 0.47, 0.2), ...[[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].map(([x, z]) => boxGeo(x - 0.015, 0, z - 0.015, x + 0.015, 0.44, z + 0.015)), boxGeo(-0.18, 0.47, -0.2, -0.15, 0.9, -0.17), boxGeo(0.15, 0.47, -0.2, 0.18, 0.9, -0.17), boxGeo(-0.18, 0.72, -0.2, 0.18, 0.86, -0.18)]),
};

/* ---------- prédio ---------- */
export interface Building {
  /** fachada: origem (canto esquerdo de quem olha, no nível da calçada) e o giro (0 = virada para +z) */
  origin: THREE.Vector3; theta: number; width: number; depth: number;
  floors: number; style: Style; shops: ShopKind[]; detailed: boolean; seed: number;
  /** recuo do topo (art déco) e o que vai no telhado */
  crown?: boolean; tank?: boolean; antennaRed?: boolean; tint?: Wall;
  /** recuo da massa no lado esquerdo/direito (local) quando esse lado é fachada de esquina */
  insetL?: number; insetR?: number;
}
export const GF_H: Record<Style, number> = { prewar: 4.6, brick: 4.3, deco: 4.8, loft: 4.4, modern: 5 };
export const FLOOR_H: Record<Style, number> = { prewar: 3.3, brick: 3.1, deco: 3.25, loft: 3.7, modern: 3.2 };
export const buildingHeight = (b: Pick<Building, "style" | "floors">) => GF_H[b.style] + FLOOR_H[b.style] * (b.floors - 1);

function frameOf(b: Building) { return new THREE.Matrix4().makeRotationY(b.theta).setPosition(b.origin); }

/** Monta um prédio inteiro no kit. */
export function buildBuilding(kit: CityKit, b: Building) {
  const M = frameOf(b), W = b.width, GF = GF_H[b.style], FH = FLOOR_H[b.style], H = buildingHeight(b), D = b.depth, r = prng(b.seed);
  const wall = `wall:${b.tint ?? WALL[b.style]}`;
  // massa do prédio: em cima do térreo até a parede da frente; atrás das lojas no térreo; as laterais do térreo fechadas.
  // Na esquina (fachada lateral desenhada por sideFace) a massa recua 0,3 m daquele lado.
  const iL = b.insetL ?? 0, iR = b.insetR ?? 0;
  kit.add(wall, boxGeo(iL, GF, -D, W - iR, H, -0.3), M);
  kit.add(wall, boxGeo(iL, -0.3, -D, W - iR, GF, -3.4), M);
  if (!iL) kit.add(wall, boxGeo(0, -0.3, -3.4, 0.3, GF, -0.3), M);
  if (!iR) kit.add(wall, boxGeo(W - 0.3, -0.3, -3.4, W, GF, -0.3), M);
  kit.add("roof", boxGeo(iL + 0.25, H, -D + 0.25, W - iR - 0.25, H + 0.08, -0.35), M);
  // térreo
  groundFloor(kit, M, b, W, GF, r);
  // andares
  if (b.detailed) upperDetailed(kit, M, b, W, GF, FH, H, r); else upperFlat(kit, M, b, W, GF, FH, H, r);
  // coroamento: cornija, platibanda e o telhado
  if (b.style === "prewar" || b.style === "loft") {
    kit.add("trim:stone", moldingSouth([[0, 0], [0.12, 0], [0.16, 0.1], [0.3, 0.18], [0.36, 0.32], [0.62, 0.42], [0.7, 0.55], [0.7, 0.68], [0, 0.72]], -0.2, W + 0.2, 0, H - 0.72), M);
    kit.add(wall, boxGeo(-0.05, H, -0.35, W + 0.05, H + 1.0, 0.02), M);
  } else if (b.style === "brick") {
    kit.add("trim:dark", moldingSouth([[0, 0], [0.08, 0], [0.1, 0.12], [0.28, 0.22], [0.32, 0.4], [0, 0.42]], -0.05, W + 0.05, 0, H - 0.42), M);
    kit.add(wall, boxGeo(0, H, -0.35, W, H + 0.8, 0), M);
  } else if (b.style === "deco") {
    kit.add(wall, boxGeo(0, H, -0.35, W, H + 1.2, 0.05), M);
    if (b.crown) { const w2 = W * 0.6, x2 = (W - w2) / 2; kit.add(wall, boxGeo(x2, H, -D * 0.7, x2 + w2, H + 9, -3), M); kit.add(wall, boxGeo(x2 + w2 * 0.2, H + 9, -D * 0.6, x2 + w2 * 0.8, H + 15, -4), M); kit.glows.push({ pos: new THREE.Vector3(W / 2, H + 15.6, -6).applyMatrix4(M), size: 1.1, color: "#ff2a1a", blink: 0 }); }
  } else {
    kit.add("trim:dark", boxGeo(-0.05, H - 0.5, -0.35, W + 0.05, H + 1.1, 0.06), M);
  }
  // telhado: casa de máquinas, caixa d'água, antenas
  kit.add(wall, boxGeo(W * 0.55, H, -D * 0.6, W * 0.55 + 4, H + 3.2, -D * 0.6 + 3.5), M);
  if (b.tank ?? (b.style === "prewar" || b.style === "brick")) {
    const p = new THREE.Vector3(W * (0.2 + r() * 0.2), H + 3, -D * 0.5);
    kit.put("tank", M.clone().multiply(L(p.x, p.y, p.z, r() * 3, 0.9 + r() * 0.2))); kit.put("tankLegs", M.clone().multiply(L(p.x, p.y, p.z, r() * 3)));
  }
  if (b.antennaRed || H > 55) { const p = new THREE.Vector3(W * 0.7, H + 3.2, -D * 0.45); kit.put("antenna", M.clone().multiply(L(p.x, p.y, p.z))); kit.glows.push({ pos: new THREE.Vector3(p.x, p.y + 9.1, p.z).applyMatrix4(M), size: 1.4, color: "#ff2a1a", blink: r() < 0.5 ? 0 : 0.5 }); }
}

/* ---------- térreo: lojas, portaria e pilares ---------- */
function slots(W: number, kinds: ShopKind[]): [number, number][] {
  const edge = 0.55, gap = 0.45, n = kinds.length;
  const lobbyW = 2.6, lobbies = kinds.filter((k) => k === "lobby").length;
  const shopW = (W - edge * 2 - gap * (n - 1) - lobbyW * lobbies) / Math.max(1, n - lobbies);
  const out: [number, number][] = []; let x = edge;
  for (const k of kinds) { const w = k === "lobby" ? lobbyW : shopW; out.push([x, x + w]); x += w + gap; }
  return out;
}
function groundFloor(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, r: () => number) {
  const wall = `wall:${b.tint ?? WALL[b.style]}`;
  const kinds = b.shops.length ? b.shops : (["closed"] as ShopKind[]);
  const sl = slots(W, kinds);
  // pilares entre as lojas e nas pontas (salientes 0,22 m), com base de granito e o friso acima do térreo
  let prev = 0;
  for (const [a, c] of sl) { kit.add(wall, boxGeo(prev, 0, -0.3, a, GF, 0.22), M); kit.add("trim:granite", boxGeo(prev - 0.02, 0, -0.3, a + 0.02, 0.5, 0.25), M); prev = c; }
  kit.add(wall, boxGeo(prev, 0, -0.3, W, GF, 0.22), M); kit.add("trim:granite", boxGeo(prev - 0.02, 0, -0.3, W + 0.02, 0.5, 0.25), M);
  kit.add("trim:stone", moldingSouth([[0, 0], [0.26, 0], [0.3, 0.06], [0.3, 0.16], [0.24, 0.22], [0, 0.24]], -0.02, W + 0.02, 0.0, GF), M);
  kinds.forEach((k, i) => { const [a, c] = sl[i]; if (k === "lobby") lobby(kit, M, a, c, GF, b.detailed); else shop(kit, M, a, c, GF, k, b.detailed, r); });
}

const SIDE_CELL: Partial<Record<ShopKind, number>> = { pharmacy: INT.sideCool, optics: INT.sideCool, gallery: INT.sideCool, jewelry: INT.sideDark, bar: INT.sideDark, bistro: INT.sideDark, closed: INT.sideDark, florist: INT.sideDark };
const FLOOR_CELL: Partial<Record<ShopKind, number>> = { pharmacy: INT.floorStone, optics: INT.floorStone, gallery: INT.floorStone, cafe: INT.floorTile, bistro: INT.floorTile, bar: INT.floorWood, fashion: INT.floorStone, jewelry: INT.floorWood, lobby: INT.floorStone };
const COOL = new Set<ShopKind>(["pharmacy", "optics", "gallery"]);
const LIGHT: Partial<Record<ShopKind, string>> = { pharmacy: "#e8f4ff", optics: "#eef4ff", gallery: "#fff6e8", jewelry: "#ffe8c0", bar: "#ff9a6a", cafe: "#ffc98a", bistro: "#ffb874", florist: "#fff0d0", closed: "#000000" };
const iuv = (k: number) => cellUV(k, INT_COLS, INT_ROWS);
const suv = (k: number) => cellUV(k, SIGN_COLS, SIGN_ROWS);

function shop(kit: CityKit, M: THREE.Matrix4, a: number, c: number, GF: number, kind: ShopKind, detailed: boolean, r: () => number) {
  const w = c - a, D = 3.2, OH = 3.4, s = SHOPS[kind], mid = (a + c) / 2, frame = kind === "fashion" || kind === "jewelry" || kind === "perfume" || kind === "atelier" ? "trim:bronze" : "trim:dark";
  // letreiro na faixa acima do vão (caixa de luz ou placa) e a moldura dele
  const sy0 = OH + 0.12, sy1 = GF - 0.3, sw = Math.min(w - 0.3, (sy1 - sy0) * 4.2);
  kit.add("sign", quad(mid - sw / 2, sy0, mid + sw / 2, sy1, 0.27, suv(SHOP_KINDS.indexOf(kind))), M);
  kit.add(frame, boxGeo(mid - sw / 2 - 0.05, sy0 - 0.05, 0.12, mid + sw / 2 + 0.05, sy1 + 0.05, 0.26), M);
  kit.add("wall:fascia", boxGeo(a, OH, -0.3, c, GF, 0.12), M);
  if (kind === "closed") {
    // porta de enrolar abaixada, a caixa do rolo e os cartazes colados
    kit.add("gate", boxGeo(a, 0, 0.02, c, OH, 0.06), M);
    kit.add("trim:dark", boxGeo(a, OH - 0.05, 0.02, c, OH + 0.32, 0.3), M);
    for (let k = 0; k < 9; k++) { const fw = 0.42 + r() * 0.12, fx = a + 0.3 + r() * (w - 0.6 - fw), fy = 0.7 + r() * 1.7; kit.add("poster", quad(fx, fy, fx + fw, fy + fw / 0.707, 0.065 + k * 0.0012, flyerUV(Math.floor(r() * 16))), M); }
    kit.add("trim:dark", boxGeo(mid - 0.06, 0.04, 0.06, mid + 0.06, 0.18, 0.1), M);       // cadeado
    return;
  }
  // caixilho da vitrine: rodapé, peitoril, montantes, travessa da bandeira, verga e a porta
  kit.add("trim:granite", boxGeo(a, 0, -0.26, c, 0.48, -0.08), M);
  kit.add(frame, boxGeo(a, 0.48, -0.3, c, 0.54, -0.04), M);
  kit.add(frame, boxGeo(a, OH - 0.08, -0.22, c, OH, -0.06), M);
  kit.add(frame, boxGeo(a, 2.72, -0.2, c, 2.78, -0.08), M);
  const doorW = 1.05, doorX = kind === "fashion" ? mid - doorW / 2 : (r() < 0.5 ? a + 0.25 : c - 0.25 - doorW);
  const bars = [a, a + 0.06, doorX - 0.04, doorX + doorW, c - 0.06].sort((p, q) => p - q);
  for (const x of new Set(bars)) kit.add(frame, boxGeo(Math.max(a, x), 0.48, -0.22, Math.min(c, x + 0.06), OH, -0.06), M);
  for (let x = a + 2.2; x < c - 1.2; x += 2.2) if (x < doorX - 0.5 || x > doorX + doorW + 0.5) kit.add(frame, boxGeo(x, 0.54, -0.2, x + 0.05, 2.72, -0.08), M);
  // porta de vidro: folha com quadro, puxador vertical
  kit.add(frame, boxGeo(doorX, 0, -0.2, doorX + 0.07, 2.72, -0.1), M); kit.add(frame, boxGeo(doorX + doorW - 0.07, 0, -0.2, doorX + doorW, 2.72, -0.1), M);
  kit.add(frame, boxGeo(doorX, 0, -0.2, doorX + doorW, 0.16, -0.1), M);
  kit.add("trim:brass", boxGeo(doorX + doorW - 0.2, 0.9, -0.08, doorX + doorW - 0.17, 1.6, -0.04), M);
  // vidros (vitrine, porta e bandeira), recuados
  kit.add("shopGlass", quad(a + 0.06, 0.54, c - 0.06, OH - 0.08, -0.15, [0, 0, 1, 1]), M);
  // interior: parede do fundo do ramo, laterais, teto e piso
  kit.add("shopInt", quad(a, 0, c, OH - 0.05, -D, iuv(SHOP_KINDS.indexOf(kind))), M);
  const side = SIDE_CELL[kind] ?? INT.sideWarm;
  kit.add("shopInt", quadX(a, -D, -0.25, 0, OH - 0.05, iuv(side), true), M);
  kit.add("shopInt", quadX(c, -D, -0.25, 0, OH - 0.05, iuv(side), false), M);
  kit.add("shopInt", quadY(a, c, -D, -0.25, OH - 0.05, iuv(COOL.has(kind) ? INT.ceilCool : INT.ceilWarm), false), M);
  kit.add("shopInt", quadY(a, c, -D, -0.25, 0.01, iuv(FLOOR_CELL[kind] ?? INT.floorWood), true), M);
  // luz da vitrine: âncora (luz de verdade quando perto da câmera) e a poça dela na calçada
  const col = LIGHT[kind] ?? "#ffd9a0";
  kit.anchors.push({ pos: new THREE.Vector3(mid, 2.4, 0.5).applyMatrix4(M), color: col, i: COOL.has(kind) ? 16 : 13 });
  kit.pools.push({ pos: new THREE.Vector3(mid, 0, 1.3).applyMatrix4(M), rx: w * 0.62, rz: 1.9, color: col, s: COOL.has(kind) ? 0.17 : 0.15, rot: Math.atan2(M.elements[8], M.elements[10]) });
  if (s.neon) kit.glows.push({ pos: new THREE.Vector3(mid, (sy0 + sy1) / 2, 0.5).applyMatrix4(M), size: sw * 0.9, color: s.neon });
  // toldo: lona inclinada (0,9 m para fora), sanefa e as abas, presos acima da vitrine
  if (s.awning !== undefined) {
    const y0 = OH + 0.02, y1 = OH - 0.5, out = 1.0, x0 = a + 0.05, x1 = c - 0.05;
    const cloth = new THREE.BufferGeometry(), [u0, v0, u1, v1] = suv(SIGN.cloth(s.awning));
    cloth.setAttribute("position", new THREE.Float32BufferAttribute([x0, y0, 0.25, x1, y0, 0.25, x1, y1, out, x0, y0, 0.25, x1, y1, out, x0, y1, out], 3));
    cloth.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v1, u1, v1, u1, v0, u0, v1, u1, v0, u0, v0], 2)); cloth.computeVertexNormals();
    kit.add("sign", cloth, M);
    kit.add("sign", quad(x0, y1 - 0.3, x1, y1, out, suv(SIGN.valance(s.awning))), M);
    for (const x of [x0, x1]) { const cheek = new THREE.BufferGeometry(); cheek.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, 0.25, x, y1, out, x, y1 - 0.3, out], 3)); const [cu0, cv0, cu1, cv1] = suv(SIGN.cloth(s.awning)); cheek.setAttribute("uv", new THREE.Float32BufferAttribute([cu0, cv1, cu1, cv0, cu1, (cv0 + cv1) / 2], 2)); cheek.computeVertexNormals(); kit.add("sign", cheek, M); }
    kit.add("trim:dark", boxGeo(x0, y0 - 0.03, 0.16, x1, y0 + 0.03, 0.28), M);
  }
  if (detailed) shopProps(kit, M, a, c, D, kind, r);
}

/** Móveis e mercadoria de cada ramo, dentro da vitrine (só nos prédios de perto). */
function shopProps(kit: CityKit, M: THREE.Matrix4, a: number, c: number, D: number, kind: ShopKind, r: () => number) {
  const w = c - a, mid = (a + c) / 2, P = (x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1) => M.clone().multiply(L(x, y, z, ry, s));
  const shelf = (x0: number, x1: number, z: number, h: number, cell: number, deep = 0.4) => {
    kit.add("trim:paint", boxGeo(x0, 0, z - deep, x1, h, z - deep + 0.04), M);
    for (let k = 0; k <= 4; k++) kit.add("trim:paint", boxGeo(x0, (h * k) / 4, z - deep, x1, (h * k) / 4 + 0.03, z), M);
    kit.add("shopInt", quad(x0 + 0.02, 0.05, x1 - 0.02, h - 0.03, z - 0.02, iuv(cell)), M);
  };
  switch (kind) {
    case "fashion": case "atelier": {
      const n = Math.max(2, Math.min(4, Math.floor(w / 1.6)));
      kit.add("trim:stone", boxGeo(a + 0.3, 0, -1.25, c - 0.3, 0.18, -0.4), M);                     // estrado da vitrine
      const gowns = ["#7a0c1c", "#0f3d2e", "#141418", "#c9a24a", "#e8e0d4", "#1d2a4a"];
      for (let k = 0; k < n; k++) { const x = a + ((k + 0.5) * w) / n, ry = (r() - 0.5) * 0.6; kit.put("mannequin", P(x, 0.18, -0.85, ry)); kit.put("gown", P(x, 0.18, -0.85, ry), new THREE.Color(kind === "atelier" ? "#f4efe6" : gowns[(k + Math.floor(r() * 6)) % 6])); }
      // arara cromada no fundo com as peças penduradas (cor por peça)
      if (kind === "fashion") {
        kit.add("trim:brass", merge([boxGeo(a + 0.6, 1.72, -D + 0.5, c - 0.6, 1.75, -D + 0.53), boxGeo(a + 0.6, 0, -D + 0.5, a + 0.63, 1.75, -D + 0.53), boxGeo(c - 0.63, 0, -D + 0.5, c - 0.6, 1.75, -D + 0.53)]), M);
        const cols = ["#7a0c1c", "#0f3d2e", "#141418", "#c9a24a", "#e8e0d4", "#1d2a4a", "#5a2a4a", "#b3122e"];
        for (let x = a + 0.8; x < c - 0.8; x += 0.16) kit.put("garment", P(x, 1.7, -D + 0.515, Math.PI / 2 + (r() - 0.5) * 0.25, [1, 0.75 + r() * 0.5, 1]), new THREE.Color(cols[Math.floor(r() * cols.length)]));
      }
      break;
    }
    case "jewelry": case "perfume": case "optics": {
      for (const x of [a + w * 0.28, a + w * 0.72]) {
        kit.add("trim:wood", boxGeo(x - 0.55, 0, -1.6, x + 0.55, 0.92, -1.05), M);
        kit.add("shopInt", quadY(x - 0.5, x + 0.5, -1.55, -1.1, 0.93, iuv(kind === "perfume" ? INT.bottleShelf : INT.magazines), true), M);
        kit.add("shopGlass", boxGeo(x - 0.53, 0.93, -1.58, x + 0.53, 1.18, -1.07), M);
      }
      break;
    }
    case "cafe": case "bistro": case "bar": {
      for (let k = 0; k < Math.floor(w / 1.6); k++) {
        const x = a + 0.8 + k * 1.6, z = -1.0 - (k % 2) * 0.3;
        kit.put("table", P(x, 0, z)); kit.put("chair", P(x - 0.45, 0, z, Math.PI / 2 + (r() - 0.5) * 0.4), new THREE.Color(kind === "bar" ? "#2a1a14" : "#3a2a1c")); kit.put("chair", P(x + 0.45, 0, z, -Math.PI / 2 + (r() - 0.5) * 0.4), new THREE.Color(kind === "bar" ? "#2a1a14" : "#3a2a1c"));
      }
      kit.add("trim:wood", boxGeo(a + 0.3, 0, -D + 0.3, c - 0.3, 1.05, -D + 0.9), M);                   // balcão
      kit.add("trim:stone", boxGeo(a + 0.25, 1.05, -D + 0.25, c - 0.25, 1.1, -D + 0.95), M);
      if (kind === "cafe") kit.add("trim:brass", boxGeo(mid - 0.3, 1.1, -D + 0.4, mid + 0.3, 1.5, -D + 0.8), M);   // máquina de café
      break;
    }
    case "pharmacy": case "books": case "shoes": {
      const cell = kind === "pharmacy" ? INT.pharmacyShelf : kind === "books" ? INT.bookShelf : INT.shoeShelf;
      shelf(a + 0.25, mid - 0.4, -1.4, 1.6, cell); shelf(mid + 0.4, c - 0.25, -1.4, 1.6, cell);
      if (kind === "books") { for (let k = 0; k < 6; k++) kit.add("shopInt", boxGeo(mid - 0.35 + (k % 3) * 0.24, 0.75, -0.75 - Math.floor(k / 3) * 0.3, mid - 0.15 + (k % 3) * 0.24, 0.75 + 0.06 + r() * 0.18, -0.5 - Math.floor(k / 3) * 0.3), M); kit.add("trim:wood", boxGeo(mid - 0.45, 0, -1.15, mid + 0.45, 0.75, -0.45), M); }
      break;
    }
    case "bakery": {
      kit.add("trim:wood", boxGeo(a + 0.4, 0, -1.4, c - 0.4, 0.9, -0.8), M);
      kit.add("shopInt", quadY(a + 0.45, c - 0.45, -1.35, -0.85, 0.91, iuv(INT.bread), true), M);
      kit.add("shopGlass", boxGeo(a + 0.42, 0.91, -1.38, c - 0.42, 1.25, -0.82), M);
      shelf(a + 0.3, c - 0.3, -D + 0.45, 1.9, INT.bread, 0.4);
      break;
    }
    case "florist": {
      // baldes de flores também na calçada, encostados na loja (fora da área andável)
      for (let k = 0; k < Math.floor(w / 0.5); k++) { const x = a + 0.3 + k * 0.5, z = 0.35 + (k % 2) * 0.22; kit.add("trim:galv", lathe([[0, 0], [0.15, 0], [0.18, 0.38], [0, 0.38]], 10).translate(x, 0, z), M); kit.add("shopInt", quadY(x - 0.17, x + 0.17, z - 0.17, z + 0.17, 0.42, iuv(INT.flowers), true), M); }
      shelf(a + 0.3, c - 0.3, -1.3, 1.2, INT.flowers, 0.5);
      break;
    }
    case "gallery": {
      kit.add("trim:stone", boxGeo(mid - 0.3, 0, -1.6, mid + 0.3, 1.0, -1.0), M);
      kit.add("trim:bronze", lathe([[0, 0], [0.2, 0.05], [0.12, 0.45], [0.22, 0.8], [0, 0.95]], 12).translate(mid, 1.0, -1.3), M);
      break;
    }
  }
}

/** Portaria do prédio residencial: porta dupla de vidro com quadro de latão, número, saguão aceso e a marquise. */
function lobby(kit: CityKit, M: THREE.Matrix4, a: number, c: number, GF: number, detailed: boolean) {
  const w = c - a, mid = (a + c) / 2, OH = 3.0;
  kit.add("wall:fascia", boxGeo(a, OH, -0.3, c, GF, 0.12), M);
  kit.add("trim:brass", boxGeo(a + 0.1, 0, -0.5, a + 0.18, OH, -0.38), M); kit.add("trim:brass", boxGeo(c - 0.18, 0, -0.5, c - 0.1, OH, -0.38), M); kit.add("trim:brass", boxGeo(a + 0.1, OH - 0.1, -0.5, c - 0.1, OH, -0.38), M);
  kit.add("trim:brass", boxGeo(mid - 0.03, 0, -0.5, mid + 0.03, OH - 0.1, -0.4), M);
  kit.add("shopGlass", quad(a + 0.18, 0, c - 0.18, OH - 0.1, -0.45, [0, 0, 1, 1]), M);
  kit.add("shopInt", quad(a, 0, c, OH, -3.2, iuv(SHOP_KINDS.indexOf("lobby"))), M);                    // saguão
  kit.add("shopInt", quadX(a, -3.2, -0.5, 0, OH, iuv(INT.sideWarm), true), M); kit.add("shopInt", quadX(c, -3.2, -0.5, 0, OH, iuv(INT.sideWarm), false), M);
  kit.add("shopInt", quadY(a, c, -3.2, -0.5, OH, iuv(INT.ceilWarm), false), M); kit.add("shopInt", quadY(a, c, -3.2, -0.5, 0.01, iuv(INT.floorStone), true), M);
  // marquise verde do porteiro (balanço de 1,4 m, sem postes na calçada) com a luz embaixo
  kit.add("sign", quad(a - 0.2, OH + 0.05, c + 0.2, OH + 0.4, 1.465, suv(SIGN.valance(SHOPS.lobby.awning!))), M);
  kit.add("trim:awning", boxGeo(a - 0.2, OH + 0.4, -0.3, c + 0.2, OH + 0.5, 1.45), M);
  kit.add("trim:awning", boxGeo(a - 0.2, OH + 0.05, 1.38, c + 0.2, OH + 0.4, 1.45), M);
  kit.glows.push({ pos: new THREE.Vector3(mid, OH + 0.02, 0.8).applyMatrix4(M), size: 1.6, color: "#ffd9a0" });
  kit.anchors.push({ pos: new THREE.Vector3(mid, OH - 0.2, 0.9).applyMatrix4(M), color: "#ffd9a0", i: 12 });
  kit.pools.push({ pos: new THREE.Vector3(mid, 0, 1.0).applyMatrix4(M), rx: w * 0.8, rz: 1.6, color: "#ffd9a0", s: 0.16, rot: Math.atan2(M.elements[8], M.elements[10]) });
  void detailed;
}

/* ---------- andares de cima ---------- */
interface WinSpec { bay: number; ww: number; wh: number; sill: number; frame: "trim:paint" | "trim:dark" | "trim:bronze"; ac: number; balconette: number; balcony: boolean; keystone: boolean; belts: number[] }
const WINS: Record<Style, WinSpec> = {
  prewar: { bay: 2.6, ww: 1.15, wh: 1.9, sill: 0.8, frame: "trim:paint", ac: 0.12, balconette: 0.12, balcony: false, keystone: true, belts: [1, 4] },
  brick: { bay: 2.4, ww: 1.0, wh: 1.75, sill: 0.85, frame: "trim:paint", ac: 0.28, balconette: 0, balcony: false, keystone: false, belts: [] },
  deco: { bay: 2.2, ww: 1.25, wh: 1.95, sill: 0.75, frame: "trim:dark", ac: 0.06, balconette: 0, balcony: false, keystone: false, belts: [2] },
  loft: { bay: 3.0, ww: 1.9, wh: 2.55, sill: 0.6, frame: "trim:dark", ac: 0.1, balconette: 0, balcony: false, keystone: false, belts: [] },
  modern: { bay: 3.0, ww: 2.6, wh: 2.2, sill: 0.55, frame: "trim:dark", ac: 0, balconette: 0, balcony: true, keystone: false, belts: [] },
};
/** Sorteia a célula da janela: apartamentos de duas janelas com a mesma luz; ~38 % acesas. */
function winCell(r: () => number, last: { k: number; n: number }) {
  if (last.n > 0) { last.n--; return last.k; }
  const lit = r() < 0.38; let k = Math.floor(r() * 32); let guard = 0;
  while (WIN_LIT[k] !== lit && guard++ < 64) k = Math.floor(r() * 32);
  last.k = k; last.n = r() < 0.6 ? 1 : 0; return k;
}
function upperDetailed(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, FH: number, H: number, r: () => number) {
  const S = WINS[b.style], wall = `wall:${b.tint ?? WALL[b.style]}`;
  const n = Math.max(1, Math.floor((W - 0.8) / S.bay)), margin = (W - n * S.bay) / 2, last = { k: 0, n: 0 };
  for (let f = 1; f < b.floors; f++) {
    const y0 = GF + (f - 1) * FH, wy0 = y0 + S.sill, wy1 = wy0 + S.wh;
    // peitoril corrido, verga corrida e os pilares entre as janelas (a parede tem espessura: vão de verdade)
    kit.add(wall, boxGeo(0, y0, -0.3, W, wy0, 0), M);
    kit.add(wall, boxGeo(0, wy1, -0.3, W, y0 + FH, 0), M);
    let px = 0;
    for (let i = 0; i < n; i++) {
      const cx = margin + S.bay * (i + 0.5), x0 = cx - S.ww / 2, x1 = cx + S.ww / 2;
      kit.add(wall, boxGeo(px, wy0, -0.3, x0, wy1, 0), M); px = x1;
      // vidro recuado com a variante, caixilho (quadro, travessa do meio) e o peitoril de pedra
      const k = winCell(r, last);
      kit.add("win", quad(x0, wy0, x1, wy1, -0.17, cellUV(k, WIN_COLS, WIN_ROWS)), M);
      kit.add(S.frame, merge([boxGeo(x0, wy0, -0.22, x1, wy0 + 0.06, -0.14), boxGeo(x0, wy1 - 0.06, -0.22, x1, wy1, -0.14), boxGeo(x0, wy0, -0.22, x0 + 0.06, wy1, -0.14), boxGeo(x1 - 0.06, wy0, -0.22, x1, wy1, -0.14), b.style === "modern" || b.style === "loft" ? boxGeo(cx - 0.03, wy0, -0.2, cx + 0.03, wy1, -0.15) : boxGeo(x0, (wy0 + wy1) / 2 - 0.03, -0.2, x1, (wy0 + wy1) / 2 + 0.03, -0.14)]), M);
      if (b.style !== "modern") kit.add("trim:stone", boxGeo(x0 - 0.08, wy0 - 0.07, -0.04, x1 + 0.08, wy0, 0.07), M);
      if (b.style === "prewar" || b.style === "brick") kit.add("trim:stone", boxGeo(x0 - 0.12, wy1, -0.01, x1 + 0.12, wy1 + 0.2, 0.03), M);
      if (S.keystone) kit.add("trim:stone", boxGeo(cx - 0.1, wy1 - 0.04, -0.01, cx + 0.1, wy1 + 0.3, 0.07), M);
      if (r() < S.ac && WIN_LIT[k] === false) kit.put("ac", M.clone().multiply(L(cx, wy0 + 0.05, -0.22)));
      if (f === 2 && r() < S.balconette * 3) kit.put("balconette", M.clone().multiply(L(cx, wy0 - 0.02, 0.0)));
      if (S.balcony && i % 2 === 0 && f > 1) { kit.put("balconySlab", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); kit.put("balconyRail", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); kit.put("railTop", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); }
    }
    kit.add(wall, boxGeo(px, wy0, -0.3, W, wy1, 0), M);
    if (S.belts.includes(f)) kit.add("trim:stone", moldingSouth([[0, 0], [0.1, 0], [0.12, 0.08], [0.12, 0.2], [0, 0.22]], -0.02, W + 0.02, 0, y0 - 0.11), M);
    // art déco: pilares verticais salientes entre os vãos
    if (b.style === "deco") for (let i = 0; i <= n; i++) { const x = margin + S.bay * i; kit.add(wall, boxGeo(x - 0.16, y0, 0, x + 0.16, y0 + FH, 0.14), M); }
    // loft: colunas de ferro fundido pintado com capitel entre os vãos
    if (b.style === "loft") for (let i = 0; i <= n; i++) { const x = margin + S.bay * i; kit.add("trim:paint", boxGeo(x - 0.14, y0, 0, x + 0.14, y0 + FH - 0.25, 0.12), M); kit.add("trim:paint", boxGeo(x - 0.2, y0 + FH - 0.25, 0, x + 0.2, y0 + FH, 0.18), M); }
  }
  void H;
}
/** Prédio de longe: parede lisa com as janelas (vidro com a variante do atlas, rente) e um friso por andar. */
function upperFlat(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, FH: number, H: number, r: () => number) {
  const S = WINS[b.style], wall = `wall:${b.tint ?? WALL[b.style]}`;
  kit.add(wall, boxGeo(0, GF, -0.3, W, H, 0), M);
  const n = Math.max(1, Math.floor((W - 0.8) / S.bay)), margin = (W - n * S.bay) / 2, last = { k: 0, n: 0 };
  for (let f = 1; f < b.floors; f++) {
    const y0 = GF + (f - 1) * FH + S.sill;
    for (let i = 0; i < n; i++) { const cx = margin + S.bay * (i + 0.5); kit.add("win", quad(cx - S.ww / 2, y0, cx + S.ww / 2, y0 + S.wh, 0.02, cellUV(winCell(r, last), WIN_COLS, WIN_ROWS)), M); }
  }
}

/** Fachada lateral (rua transversal) de um prédio de esquina: janelas na parede, sem lojas. */
export function sideFace(kit: CityKit, origin: THREE.Vector3, theta: number, width: number, b: Pick<Building, "style" | "floors" | "seed" | "tint">, detailed: boolean) {
  const M = new THREE.Matrix4().makeRotationY(theta).setPosition(origin), GF = GF_H[b.style], FH = FLOOR_H[b.style], H = buildingHeight(b), r = prng(b.seed + 7);
  const wall = `wall:${b.tint ?? WALL[b.style]}`;
  kit.add(wall, boxGeo(0, 0, -0.3, width, GF, 0.15), M);
  kit.add("trim:granite", boxGeo(-0.02, 0, -0.3, width + 0.02, 0.5, 0.2), M);
  // janelas altas do térreo (a loja da esquina vira a rua), com a vitrine acesa
  for (let x = 1.2; x < width - 2; x += 3.2) { kit.add("shopGlass", quad(x, 0.6, x + 2.2, 3.2, 0.16, [0, 0, 1, 1]), M); kit.add("shopInt", quad(x, 0.6, x + 2.2, 3.2, 0.155, iuv(INT.sideWarm)), M); }
  const fake: Building = { origin, theta, width, depth: 1, floors: b.floors, style: b.style, shops: [], detailed, seed: b.seed + 7, tint: b.tint };
  if (detailed) upperDetailed(kit, M, fake, width, GF, FH, H, r); else upperFlat(kit, M, fake, width, GF, FH, H, r);
}

/* ---------- a quadra: quem fica onde ---------- */
export interface CityPlan { buildings: Building[]; sides: { origin: THREE.Vector3; theta: number; width: number; b: Building; detailed: boolean }[] }
const far = (x0: number, x1: number, o: Omit<Building, "origin" | "theta" | "width">): Building => ({ origin: new THREE.Vector3(x1, SIDEWALK_Y, FAR_LINE), theta: Math.PI, width: x1 - x0, ...o });
const near = (x0: number, x1: number, o: Omit<Building, "origin" | "theta" | "width">): Building => ({ origin: new THREE.Vector3(x0, SIDEWALK_Y, NEAR_LINE), theta: 0, width: x1 - x0, ...o });
/** Lojas da quadra na ordem de oeste para leste (a fachada de lá corre de leste para oeste no referencial local). */
const westToEast = (k: ShopKind[]) => [...k].reverse();

export function cityPlan(): CityPlan {
  const B: Building[] = [];
  // quadra em frente ao museu (x −31…44): desenhada loja por loja (é a que a jogadora vê de perto)
  B.push(far(-31, -17, { depth: 20, floors: 11, style: "prewar", shops: westToEast(["bistro", "lobby", "florist"]), detailed: true, seed: 11 }));
  B.push(far(-17, -6, { depth: 18, floors: 7, style: "brick", shops: westToEast(["pharmacy", "bakery"]), detailed: true, seed: 12 }));
  B.push(far(-6, 4, { depth: 18, floors: 6, style: "loft", shops: ["fashion"], detailed: true, seed: 13 }));
  B.push(far(4, 16, { depth: 20, floors: 15, style: "deco", shops: westToEast(["jewelry", "lobby", "perfume"]), detailed: true, seed: 14, crown: true }));
  B.push(far(16, 27, { depth: 18, floors: 9, style: "prewar", shops: westToEast(["closed", "cafe"]), detailed: true, seed: 15, tint: "brickDark" }));
  B.push(far(27, 44, { depth: 22, floors: 23, style: "modern", shops: westToEast(["books", "optics", "gallery"]), detailed: true, seed: 16 }));
  // lado do museu, depois do beco (o de tijolo é o mesmo volume do beco: fachada sul na avenida) e para oeste da ala
  B.push(near(30, 46, { depth: 58.5, floors: 5, style: "brick", shops: ["bar", "shoes"], detailed: true, seed: 21 }));
  const r = prng(77);
  const styles: Style[] = ["prewar", "brick", "deco", "loft", "modern", "prewar", "brick"];
  const shopsPool: ShopKind[][] = [["cafe", "lobby", "shoes"], ["pharmacy", "books"], ["bistro", "florist"], ["optics", "lobby", "bakery"], ["bar", "closed"], ["perfume", "gallery"], ["jewelry", "cafe"], ["atelier", "lobby", "shoes"]];
  const run = (x0: number, x1: number, side: "far" | "near", detailUntil: number, seed: number) => {
    const rr = prng(seed);
    for (let x = x0; x < x1 - 4;) {
      const w = Math.min(x1 - x, 11 + Math.floor(rr() * 12)), st = styles[Math.floor(rr() * styles.length)], fl = st === "modern" ? 14 + Math.floor(rr() * 14) : st === "deco" ? 10 + Math.floor(rr() * 10) : 5 + Math.floor(rr() * 8);
      const detailed = Math.abs(x + w / 2) < detailUntil;
      const o = { depth: side === "near" ? 34 : 24, floors: fl, style: st, shops: shopsPool[Math.floor(rr() * shopsPool.length)], detailed, seed: seed * 100 + Math.round(x), crown: st === "deco" && rr() < 0.5 } as Omit<Building, "origin" | "theta" | "width">;
      B.push(side === "far" ? far(x, x + w, { ...o, shops: westToEast(o.shops) }) : near(x, x + w, o));
      x += w + (rr() < 0.15 ? 0.6 : 0);
    }
  };
  void r;
  run(-CITY_X, CROSS[0].walk0, "far", 70, 31); run(CROSS[1].walk1, CITY_X, "far", 70, 32);
  run(46, CITY_X, "near", 75, 33); run(-CITY_X, -60, "near", 75, 34);
  // ruas transversais: as fachadas laterais dos prédios de esquina e a fileira que segue para o sul
  const sides: CityPlan["sides"] = [];
  const a1 = B[0], a6 = B[5];
  a1.insetR = 0.3; a6.insetL = 0.3;                         // (lado de lá: o x local cresce para o oeste)
  sides.push({ origin: new THREE.Vector3(CROSS[0].walk1, SIDEWALK_Y, FAR_LINE), theta: -Math.PI / 2, width: a1.depth, b: a1, detailed: true });
  sides.push({ origin: new THREE.Vector3(CROSS[1].walk0, SIDEWALK_Y, FAR_LINE + a6.depth), theta: Math.PI / 2, width: a6.depth, b: a6, detailed: true });
  const bW = B.find((b) => b.origin.x === CROSS[0].walk0 && b.theta === Math.PI), bE = B.find((b) => b.theta === Math.PI && Math.abs(b.origin.x - b.width - CROSS[1].walk1) < 0.01);
  if (bW) bW.insetL = 0.3;
  if (bE) bE.insetR = 0.3;
  if (bW) sides.push({ origin: new THREE.Vector3(CROSS[0].walk0, SIDEWALK_Y, FAR_LINE + bW.depth), theta: Math.PI / 2, width: bW.depth, b: bW, detailed: false });
  if (bE) sides.push({ origin: new THREE.Vector3(CROSS[1].walk1, SIDEWALK_Y, FAR_LINE), theta: -Math.PI / 2, width: bE.depth, b: bE, detailed: false });
  // fileiras das transversais (fachadas viradas para a rua, de z ≈ 72 até CROSS_Z1)
  const rr = prng(91);
  for (const cs of CROSS) for (const [x, th] of [[cs.walk0, Math.PI / 2], [cs.walk1, -Math.PI / 2]] as const) {
    for (let z = FAR_LINE + 21; z < CROSS_Z1;) {
      const w = 12 + Math.floor(rr() * 12), st = styles[Math.floor(rr() * styles.length)];
      const o: Building = { origin: th > 0 ? new THREE.Vector3(x, SIDEWALK_Y, z + w) : new THREE.Vector3(x, SIDEWALK_Y, z), theta: th, width: w, depth: 16, floors: st === "modern" ? 12 + Math.floor(rr() * 12) : 5 + Math.floor(rr() * 8), style: st, shops: shopsPool[Math.floor(rr() * shopsPool.length)], detailed: false, seed: Math.round(z * 10 + x) };
      B.push(o); z += w + 0.3;
    }
  }
  return { buildings: B, sides };
}

/** Constrói a quadra inteira (prédios, laterais de esquina) num kit. No "low" só a quadra em frente ao museu e o prédio do
 * beco têm a fachada com vãos de verdade e as lojas mobiliadas; o resto vira parede com janela rente. */
export function buildCity(lowDetail = false): CityKit {
  const kit = new CityKit(), plan = cityPlan();
  for (const b of plan.buildings) { if (lowDetail && Math.abs(b.origin.x - (b.theta === Math.PI ? b.width / 2 : -b.width / 2)) > 47) b.detailed = false; buildBuilding(kit, b); }
  for (const s of plan.sides) sideFace(kit, s.origin, s.theta, s.width, s.b, s.detailed && !lowDetail);
  return kit;
}
