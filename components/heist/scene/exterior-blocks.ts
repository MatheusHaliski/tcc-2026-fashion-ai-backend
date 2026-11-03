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
import { boxGeo, moldingSouth } from "./exterior-geometry";
import { INT } from "./exterior-citytex";
import { prng } from "./exterior-tex-core";
import { buildingHeight, FLOOR_H, GF_H, WALL, type Building } from "./exterior-blocks-layout";
import { CityKit, iuv, L, quad } from "./exterior-blocks-kit";
import { groundFloor } from "./exterior-blocks-shop";
import { upperDetailed, upperFlat } from "./exterior-blocks-upper";
import { cityPlan } from "./exterior-blocks-plan";

/* traçado, kit, peças, térreo, andares e plano ficam em módulos próprios; este monta o prédio e a quadra */
export { CITY_X, CROSS, CROSS_Z1, FAR_LINE, FLOOR_H, GF_H, NEAR_LINE, buildingHeight, type Building, type Style, type Wall } from "./exterior-blocks-layout";
export { CityKit, type Anchor, type Glow, type Pool } from "./exterior-blocks-kit";
export { PARTS } from "./exterior-blocks-parts";
export { cityPlan, type CityPlan } from "./exterior-blocks-plan";

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

/** Constrói a quadra inteira (prédios, laterais de esquina) num kit. No "low" só a quadra em frente ao museu e o prédio do
 * beco têm a fachada com vãos de verdade e as lojas mobiliadas; o resto vira parede com janela rente. */
export function buildCity(lowDetail = false): CityKit {
  const kit = new CityKit(), plan = cityPlan();
  for (const b of plan.buildings) { if (lowDetail && Math.abs(b.origin.x - (b.theta === Math.PI ? b.width / 2 : -b.width / 2)) > 47) b.detailed = false; buildBuilding(kit, b); }
  for (const s of plan.sides) sideFace(kit, s.origin, s.theta, s.width, s.b, s.detailed && !lowDetail);
  return kit;
}
