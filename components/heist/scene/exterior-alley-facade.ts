/*
 * MET Gala Heist v2 — beco (Z15): a fachada do prédio vizinho que dá para o beco (face oeste, x ≈ 30; o volume do prédio
 * é da cidade, exterior-city.tsx — esta é a pele dele do lado do beco, um pouco à frente do volume). Um prédio de tijolo
 * aparente velho de cinco pavimentos:
 *
 *  - térreo comercial (4 m): barrado de cimento, a porta de serviço da cozinha do restaurante (com o exaustor subindo pela
 *    fachada), a porta de garagem de enrolar, a saída de emergência de aço, janelinhas altas com grade, o quadro de
 *    medidores, o cano amarelo do gás;
 *  - quatro andares de apartamentos: vigas de concreto pintadas em cada laje, janelas recuadas (vergas, peitoris com
 *    pingadeira, caixilhos de ferro, vidro escuro ou aceso com cortina/persiana/TV), aparelhos de ar de janela e
 *    condensadoras em mãos-francesas, as duas escadas de incêndio de ferro;
 *  - platibanda com rufo, as gárgulas e os canos de descida até o chão, a fiação presa na parede e os cabos velhos que
 *    cruzam o beco no fundo, a antena e a caixa d'água no telhado;
 *  - os decalques de parede (pichações, reboco caído, lambe-lambes, escorridos, fuligem, eflorescência), que leem o
 *    relevo do tijolo pelo segundo UV.
 */
import * as THREE from "three";
import { Bag, box, cyl0, quadWest, rod, sagging, tm, tube } from "./exterior-alley-geo";
import { rng, type Rect01 } from "./exterior-alley-tex";
import { Y0 } from "./exterior-alley-props";

/** Faces: térreo, andares (recuados 8 cm em relação ao volume da cidade), vidro e o fim/boca do beco. */
export const WALL_G = 29.93, WALL_U = 29.85, GLASS_X = 29.982, Z_END = -22.4, Z_MOUTH = 24.5;
/* alturas iguais às do volume do prédio na cidade (exterior-blocks: tijolo, térreo de 4,3 m e andares de 3,1 m) */
const GF = 2.7, BAND = 0.25, FLOOR_H = 3.1, ROOF = 15.1, PARAPET = 15.9;
const storeyBase = (k: number) => GF + k * FLOOR_H;
/** Vãos dos andares: centros a cada 3 m. */
export const BAYS = Array.from({ length: 15 }, (_, k) => 23 - 3 * k);
/** Escadas de incêndio do vizinho (centro em z) e os andares (base da laje). */
export const NEIGHBOR_ESCAPES = [12.5, -8.5];

type Hole = { z0: number; z1: number; y0: number; y1: number };
/** Aberturas do térreo. */
export const GROUND = {
  kitchen: { z0: 17.95, z1: 18.95, y0: Y0, y1: 0.55 },
  garage: { z0: 1.6, z1: 5.4, y0: Y0, y1: 1.7 },
  exit: { z0: -5.6, z1: -4.6, y0: Y0, y1: 0.55 },
  win1: { z0: -12.6, z1: -11.4, y0: 0.4, y1: 1.3 },
  win2: { z0: -18.4, z1: -17.2, y0: 0.4, y1: 1.3 },
};

/** Parede plana com furos, voltada para −x em `x`, a partir de um retângulo (z, y) e furos; UV em metros (z, y). */
function holedWall(x: number, z0: number, z1: number, y0: number, y1: number, holes: Hole[]): THREE.BufferGeometry {
  const sh = new THREE.Shape(); sh.moveTo(z0, y0); sh.lineTo(z1, y0); sh.lineTo(z1, y1); sh.lineTo(z0, y1); sh.closePath();
  for (const h of holes) { const p = new THREE.Path(); p.moveTo(h.z0, h.y0); p.lineTo(h.z0, h.y1); p.lineTo(h.z1, h.y1); p.lineTo(h.z1, h.y0); p.closePath(); sh.holes.push(p); }
  const g = new THREE.ShapeGeometry(sh, 1);
  g.rotateY(-Math.PI / 2); g.translate(x, 0, 0);
  return g;
}
/** Contorno do vão (recuo do tijolo até o caixilho): ombreiras, verga e peitoril por dentro. */
function reveals(bag: Bag, key: string, h: Hole, xFace: number, xIn: number, color?: THREE.ColorRepresentation) {
  const o = { color, worldUv: true };
  bag.add(key, box(xFace, h.y0, h.z0 - 0.02, xIn, h.y1, h.z0), o); bag.add(key, box(xFace, h.y0, h.z1, xIn, h.y1, h.z1 + 0.02), o);
  bag.add(key, box(xFace, h.y1, h.z0, xIn, h.y1 + 0.02, h.z1), o); if (h.y0 > Y0 + 0.01) bag.add(key, box(xFace, h.y0 - 0.02, h.z0, xIn, h.y0, h.z1), o);
}

export interface FacadeOut { litWindows: THREE.Vector3[]; sensorAt: THREE.Vector3; flickerAt: THREE.Vector3; cageAt: THREE.Vector3 }

/** Monta a fachada do vizinho em `bag` (peças por material) e `decals` (com o segundo UV). `win` = retângulos da folha de
 * interiores das janelas acesas; `wd` = folha de decalques; `signs` = placas. */
export function neighborFacade(bag: Bag, decals: Bag, win: Record<string, Rect01>, wd: Record<string, Rect01>, signs: Record<string, Rect01>): FacadeOut {
  const r = rng(2026), lit: THREE.Vector3[] = [];
  /* ---------- térreo ---------- */
  const gHoles = Object.values(GROUND);
  bag.add("brick", holedWall(WALL_G, Z_END, Z_MOUTH, Y0, GF, gHoles));
  // barrado de cimento (0,6 m) e a viga do térreo (aba que avança sobre a calçada do beco)
  for (const [a, b] of [[Z_END, GROUND.exit.z0], [GROUND.exit.z1, GROUND.garage.z0], [GROUND.garage.z1, GROUND.kitchen.z0], [GROUND.kitchen.z1, Z_MOUTH]]) bag.add("paintedConcrete", box(WALL_G - 0.025, Y0, a, WALL_G, Y0 + 0.6, b), { worldUv: true });
  bag.add("paintedConcrete", box(WALL_U - 0.06, GF, Z_END, WALL_G, GF + BAND, Z_MOUTH), { worldUv: true });
  for (const h of gHoles) reveals(bag, "paintedConcrete", h, WALL_G - 0.001, GLASS_X);
  // porta da cozinha: folha de aço verde gasta, chute de inox, grelha de ventilação, olho mágico, maçaneta, campainha
  {
    const h = GROUND.kitchen, x = GLASS_X - 0.03;
    bag.add("paint", box(x, h.y0, h.z0, GLASS_X, h.y1, h.z1), { color: "#2f4a3c" });
    bag.add("galv", box(x - 0.004, h.y0 + 0.02, h.z0 + 0.04, x, h.y0 + 0.32, h.z1 - 0.04));
    bag.add("iron", box(x - 0.006, h.y0 + 0.45, h.z0 + 0.25, x, h.y0 + 0.7, h.z1 - 0.25));
    for (let k = 0; k < 6; k++) bag.add("paint", box(x - 0.01, h.y0 + 0.47 + k * 0.035, h.z0 + 0.26, x - 0.005, h.y0 + 0.48 + k * 0.035, h.z1 - 0.26), { color: "#1d2a24" });
    bag.add("galv", rod([x - 0.08, h.y0 + 1.0, h.z1 - 0.12], [x - 0.08, h.y0 + 1.0, h.z1 - 0.26], 0.012, 8));
    bag.add("galv", rod([x, h.y0 + 1.0, h.z1 - 0.12], [x - 0.08, h.y0 + 1.0, h.z1 - 0.12], 0.012, 8));
    bag.add("galv", cyl0(0.012, 0.012, 0.01, 10), { m: tm(x - 0.005, h.y0 + 1.55, (h.z0 + h.z1) / 2, 0, 1, 1, 1, 0, Math.PI / 2) });
    bag.add("plastic", box(WALL_G - 0.03, h.y0 + 1.35, h.z1 + 0.12, WALL_G, h.y0 + 1.45, h.z1 + 0.2), { color: "#e8e3d4" });
    bag.add("signs", quadWest(WALL_G - 0.004, h.z0 - 0.15, h.z1 + 0.15, h.y1 + 0.12, h.y1 + 0.4, [signs.kitchen.u0, signs.kitchen.v0, signs.kitchen.u1, signs.kitchen.v1]));
    // capacho de borracha na soleira (as bitucas no chão mostram que a cozinha fuma ali)
    bag.add("rubber", box(WALL_G - 0.75, Y0, h.z0 + 0.05, WALL_G - 0.05, Y0 + 0.015, h.z1 - 0.05));
  }
  // exaustor da cozinha: duto galvanizado saindo acima da porta, cotovelo e subindo a fachada até acima da platibanda
  {
    const z = 18.45, x = WALL_G - 0.34;
    bag.add("galv", rod([WALL_G, 1.3, z], [x, 1.3, z], 0.19, 16));
    bag.add("galv", new THREE.SphereGeometry(0.19, 16, 10), { m: tm(x, 1.3, z) });
    bag.add("galv", rod([x, 1.3, z], [x, PARAPET + 0.6, z], 0.19, 16));
    for (let y = 2.9; y < PARAPET; y += 2.4) { bag.add("rusty", box(x - 0.22, y, z - 0.23, WALL_U, y + 0.05, z - 0.19), { color: "#3a3430" }); bag.add("rusty", box(x - 0.22, y, z + 0.19, WALL_U, y + 0.05, z + 0.23), { color: "#3a3430" }); }
    bag.add("galv", cyl0(0.3, 0.3, 0.04, 16), { m: tm(x, PARAPET + 0.78, z) });                   // chapéu
    for (const s of [-1, 1]) bag.add("galv", rod([x + s * 0.15, PARAPET + 0.6, z], [x + s * 0.15, PARAPET + 0.78, z], 0.01, 4));
  }
  // portão de garagem de enrolar: lâminas, guias, caixa do rolo, cadeado no chão e a placa
  {
    const h = GROUND.garage, x = GLASS_X - 0.02;
    for (let y = h.y0 + 0.08; y < h.y1 - 0.02; y += 0.1) bag.add("paint", box(x - (Math.round((y - h.y0) / 0.1) % 2 ? 0.006 : 0), y, h.z0, x + 0.012, y + 0.09, h.z1), { color: new THREE.Color("#8b8f93").multiplyScalar(0.85 + r() * 0.2) });
    bag.add("galv", box(x - 0.03, h.y0, h.z0, x + 0.012, h.y0 + 0.08, h.z1));
    for (const z of [h.z0, h.z1 - 0.08]) bag.add("galv", box(WALL_G - 0.05, h.y0, z, x, h.y1 + 0.2, z + 0.08));
    bag.add("paint", box(WALL_G - 0.32, h.y1 + 0.02, h.z0 - 0.1, WALL_G, h.y1 + 0.5, h.z1 + 0.1), { color: "#5c6064" });
    bag.add("paintGloss", box(x - 0.06, h.y0 + 0.02, (h.z0 + h.z1) / 2 - 0.03, x - 0.02, h.y0 + 0.1, (h.z0 + h.z1) / 2 + 0.03), { color: "#c9a23a" });
    bag.add("signs", quadWest(WALL_G - 0.33, h.z0 + 0.6, h.z1 - 0.6, h.y1 + 0.08, h.y1 + 0.44, [signs.garage.u0, signs.garage.v0, signs.garage.u1, signs.garage.v1]));
  }
  // saída de emergência do vizinho: porta de aço cinza, placa verde e a luminária velha que pisca em cima
  {
    const h = GROUND.exit, x = GLASS_X - 0.03;
    bag.add("paint", box(x, h.y0, h.z0, GLASS_X, h.y1, h.z1), { color: "#5a5e62" });
    for (const y of [h.y0 + 0.4, h.y0 + 1.7]) bag.add("galv", box(x - 0.012, y, h.z0 + 0.02, x, y + 0.12, h.z0 + 0.06));
    bag.add("signs", quadWest(WALL_G - 0.004, h.z0 - 0.05, h.z1 + 0.05, h.y1 + 0.1, h.y1 + 0.47, [signs.exitGreen.u0, signs.exitGreen.v0, signs.exitGreen.u1, signs.exitGreen.v1]));
  }
  // janelinhas altas do térreo: vidro aramado escuro e grade de barras
  for (const h of [GROUND.win1, GROUND.win2]) {
    bag.add("frosted", box(GLASS_X - 0.01, h.y0, h.z0, GLASS_X, h.y1, h.z1));
    for (let z = h.z0 + 0.1; z < h.z1; z += 0.12) bag.add("iron", box(WALL_G - 0.05, h.y0 - 0.05, z, WALL_G - 0.035, h.y1 + 0.05, z + 0.015));
    for (const y of [h.y0 - 0.04, h.y1 + 0.02]) bag.add("iron", box(WALL_G - 0.06, y, h.z0 - 0.04, WALL_G - 0.03, y + 0.03, h.z1 + 0.04));
  }
  // quadro de medidores (caixa de aço com visor) e os eletrodutos subindo
  {
    const z0 = 5.7, z1 = 6.6, y0 = -0.75, y1 = 0.55, x = WALL_G - 0.24;
    bag.add("paint", box(x, y0, z0, WALL_G, y1, z1), { color: "#8c9196" });
    bag.add("frosted", box(x - 0.005, y0 + 0.62, z0 + 0.1, x, y1 - 0.12, z1 - 0.1));
    bag.add("signs", quadWest(x - 0.007, z0 + 0.14, z1 - 0.14, y0 + 0.66, y1 - 0.16, [signs.meter.u0, signs.meter.v0, signs.meter.u1, signs.meter.v1]));
    bag.add("paintGloss", box(x - 0.01, y0 + 0.4, z1 - 0.12, x, y0 + 0.48, z1 - 0.08), { color: "#c9a23a" });
    for (const dz of [0.2, 0.45, 0.7]) bag.add("galv", rod([WALL_G - 0.05, y1, z0 + dz], [WALL_G - 0.05, GF + 0.3, z0 + dz], 0.016, 6));
  }
  // cano de gás amarelo (vem do abrigo e entra na parede no 1º andar)
  bag.add("paintGloss", rod([WALL_G - 0.05, -0.02, 21.25], [WALL_G - 0.05, GF + 1.2, 21.25], 0.022, 8), { color: "#e2b322" });
  for (let y = 0.5; y < GF + 1.1; y += 1.0) bag.add("rusty", box(WALL_G - 0.08, y, 21.21, WALL_G, y + 0.03, 21.29), { color: "#3a3430" });
  bag.add("paintGloss", rod([WALL_G - 0.05, GF + 1.2, 21.25], [WALL_U, GF + 1.2, 21.25], 0.022, 8), { color: "#e2b322" });

  // quinas: pilastra de tijolo na boca do beco (cobre a emenda com o volume da cidade) e no fundo
  bag.add("brick", box(WALL_U - 0.1, Y0, 24.22, 29.999, PARAPET + 0.12, 24.49), { worldUv: true });
  bag.add("brick", box(WALL_U - 0.1, Y0, Z_END - 0.3, 29.999, PARAPET + 0.12, Z_END), { worldUv: true });

  /* ---------- andares ---------- */
  const escape = (z: number) => NEIGHBOR_ESCAPES.some((c) => Math.abs(z - c) < 3.3);
  for (let k = 0; k < 4; k++) {
    const b = storeyBase(k), y0 = b + 1.0, y1 = b + 2.45, top = k === 3 ? ROOF : storeyBase(k + 1);
    const holes: Hole[] = BAYS.map((zc) => ({ z0: zc - 0.6, z1: zc + 0.6, y0, y1 }));
    bag.add("brick", holedWall(WALL_U, Z_END, Z_MOUTH, b + BAND, top, holes));
    bag.add("paintedConcrete", box(WALL_U - 0.05, top, Z_END, WALL_U, top + BAND, Z_MOUTH), { worldUv: true });   // viga da laje de cima
    BAYS.forEach((zc, i) => {
      const h = holes[i];
      reveals(bag, "brick", h, WALL_U - 0.001, GLASS_X);
      bag.add("paintedConcrete", box(WALL_U - 0.07, y0 - 0.07, zc - 0.72, WALL_U, y0, zc + 0.72), { worldUv: true });      // peitoril com pingadeira
      bag.add("paintedConcrete", box(WALL_U - 0.02, y1, zc - 0.7, WALL_U, y1 + 0.14, zc + 0.7), { worldUv: true });        // verga
      // caixilho de ferro (cor por janela), montante e travessa
      const frame = ["#3b2a1e", "#1f2a24", "#d9d6cc", "#2a2f36", "#5a2a20"][Math.floor(r() * 5)], xf = GLASS_X - 0.03;
      for (const [za, zb, ya, yb] of [[zc - 0.6, zc - 0.55, y0, y1], [zc + 0.55, zc + 0.6, y0, y1], [zc - 0.6, zc + 0.6, y0, y0 + 0.05], [zc - 0.6, zc + 0.6, y1 - 0.05, y1], [zc - 0.02, zc + 0.02, y0, y1], [zc - 0.6, zc + 0.6, y0 + 1.0, y0 + 1.04]] as [number, number, number, number][]) bag.add("paint", box(xf, ya, za, GLASS_X, yb, zb), { color: frame });
      // vidro: aceso (interior com cortina/persiana/TV) ou escuro; alguns com cortina de pano atrás do vidro
      const isLit = r() < 0.28 && !(escape(zc) && k === 0);
      if (isLit) { const cell = win[`w${Math.floor(r() * 4)}`]; bag.add("glassLit", quadWest(GLASS_X + 0.006, zc - 0.56, zc + 0.56, y0 + 0.04, y1 - 0.04, [cell.u0, cell.v0, cell.u1, cell.v1])); lit.push(new THREE.Vector3(WALL_U - 0.4, (y0 + y1) / 2, zc)); }
      else if (r() < 0.35) {
        bag.add("fabric", quadWest(GLASS_X + 0.01, zc - 0.56, zc + 0.56, y0 + 0.04, y1 - 0.04), { color: ["#5a4a3a", "#6a2a2a", "#3a4a5a", "#7a7060"][Math.floor(r() * 4)] });
        bag.add("glassSheen", quadWest(GLASS_X + 0.004, zc - 0.56, zc + 0.56, y0 + 0.04, y1 - 0.04));
      } else bag.add("glassDark", quadWest(GLASS_X + 0.006, zc - 0.56, zc + 0.56, y0 + 0.04, y1 - 0.04));
      // ar-condicionado de janela (caixa saindo pela parte de baixo) ou condensadora em mãos-francesas sob o peitoril
      const ac = r();
      if (ac < 0.16 && !escape(zc)) {
        bag.add("plastic", box(WALL_U - 0.42, y0 + 0.02, zc - 0.32, GLASS_X, y0 + 0.42, zc + 0.32), { color: "#d6d2c6" });
        for (let j = 0; j < 7; j++) bag.add("iron", box(WALL_U - 0.425, y0 + 0.07 + j * 0.045, zc - 0.28, WALL_U - 0.42, y0 + 0.085 + j * 0.045, zc + 0.28));
        bag.add("rusty", box(WALL_U - 0.5, y0 - 0.02, zc - 0.34, WALL_U, y0 + 0.02, zc - 0.3), { color: "#3a3430" }); bag.add("rusty", box(WALL_U - 0.5, y0 - 0.02, zc + 0.3, WALL_U, y0 + 0.02, zc + 0.34), { color: "#3a3430" });
        decals.add("wallDecal", quadWest(WALL_U - 0.002, zc - 0.25, zc + 0.25, y0 - 1.3, y0 - 0.05, [wd.rustStreak.u0, wd.rustStreak.v0, wd.rustStreak.u1, wd.rustStreak.v1]), { uv1: [[zc - 0.25, y0 - 1.3], [zc + 0.25, y0 - 1.3], [zc + 0.25, y0 - 0.05], [zc - 0.25, y0 - 1.3], [zc + 0.25, y0 - 0.05], [zc - 0.25, y0 - 0.05]] });
      } else if (ac < 0.3 && !escape(zc)) {
        const yb = y0 - 0.75;
        bag.add("plastic", box(WALL_U - 0.36, yb, zc - 0.42, WALL_U - 0.04, yb + 0.58, zc + 0.42), { color: "#e3e1da" });
        bag.add("iron", new THREE.TorusGeometry(0.2, 0.01, 4, 24).rotateY(Math.PI / 2), { m: tm(WALL_U - 0.365, yb + 0.29, zc - 0.1) });
        for (let j = 1; j < 4; j++) bag.add("iron", new THREE.TorusGeometry(0.05 * j, 0.004, 4, 20).rotateY(Math.PI / 2), { m: tm(WALL_U - 0.367, yb + 0.29, zc - 0.1) });
        for (const s of [-1, 1]) { bag.add("rusty", box(WALL_U - 0.42, yb - 0.03, zc + s * 0.36 - 0.02, WALL_U, yb, zc + s * 0.36 + 0.02), { color: "#2e2a26" }); bag.add("rusty", rod([WALL_U - 0.4, yb - 0.02, zc + s * 0.36], [WALL_U, yb - 0.4, zc + s * 0.36], 0.012, 4), { color: "#2e2a26" }); }
        bag.add("rubber", tube([[WALL_U - 0.2, yb + 0.1, zc + 0.42], [WALL_U - 0.1, yb + 0.05, zc + 0.5], [WALL_U - 0.02, yb + 0.4, zc + 0.5], [WALL_U - 0.02, y0 + 0.3, zc + 0.62]], 0.015, 12, 5));
        decals.add("wallDecal", quadWest(WALL_U - 0.002, zc - 0.4, zc + 0.4, yb - 0.8, yb, [wd.waterStreak.u0, wd.waterStreak.v0, wd.waterStreak.u1, wd.waterStreak.v1]), { uv1: [[zc - 0.4, yb - 0.8], [zc + 0.4, yb - 0.8], [zc + 0.4, yb], [zc - 0.4, yb - 0.8], [zc + 0.4, yb], [zc - 0.4, yb]] });
      } else if (r() < 0.4) {
        // escorrido de água sob o peitoril
        const yb = y0 - 0.07;
        decals.add("wallDecal", quadWest(WALL_U - 0.002, zc - 0.55, zc + 0.55, yb - 1.1, yb, [wd.waterStreak.u0, wd.waterStreak.v0, wd.waterStreak.u1, wd.waterStreak.v1]), { uv1: [[zc - 0.55, yb - 1.1], [zc + 0.55, yb - 1.1], [zc + 0.55, yb], [zc - 0.55, yb - 1.1], [zc + 0.55, yb], [zc - 0.55, yb]] });
      }
      // grade nas janelas do 1º andar (fora das escadas de incêndio)
      if (k === 0 && !escape(zc) && r() < 0.6) {
        for (let z = zc - 0.55; z <= zc + 0.56; z += 0.11) bag.add("iron", box(WALL_U - 0.06, y0 - 0.02, z, WALL_U - 0.045, y1 + 0.02, z + 0.014));
        for (const y of [y0, (y0 + y1) / 2, y1]) bag.add("iron", box(WALL_U - 0.07, y, zc - 0.62, WALL_U - 0.04, y + 0.025, zc + 0.62));
      }
      // vaso no peitoril (alguns)
      if (r() < 0.1) { bag.add("plastic", cyl0(0.09, 0.11, 0.16, 12), { m: tm(WALL_U - 0.06, y0, zc + 0.3), color: "#a0522d" }); bag.add("fabric", new THREE.SphereGeometry(0.14, 8, 6), { m: tm(WALL_U - 0.08, y0 + 0.22, zc + 0.3, 0, 1, 0.8, 1), color: "#2f5a2a" }); }
    });
  }
  // platibanda, rufo, gárgulas e os canos de descida
  bag.add("brick", holedWall(WALL_U, Z_END, Z_MOUTH, ROOF + BAND, PARAPET, []));
  bag.add("paintedConcrete", box(WALL_U - 0.08, PARAPET, Z_END, WALL_U + 0.3, PARAPET + 0.12, Z_MOUTH), { worldUv: true });
  const pipes = [24.15, 7.0, 0.5, -22.1];
  for (const z of pipes) {
    const x = WALL_U - 0.09;
    bag.add("galv", box(x - 0.14, ROOF + 0.35, z - 0.14, WALL_U, ROOF + 0.6, z + 0.14));                                 // funil
    bag.add("galv", rod([x, ROOF + 0.35, z], [x, Y0 + 0.4, z], 0.05, 10));
    bag.add("galv", rod([x, Y0 + 0.4, z], [x - 0.25, Y0 + 0.12, z], 0.05, 10));                                          // bica (sapata)
    for (let y = Y0 + 1.6; y < ROOF; y += 2.2) bag.add("rusty", box(x - 0.06, y, z - 0.07, WALL_U, y + 0.04, z + 0.07), { color: "#3d3a36" });
    if (z > 23 || z < -21.5) continue;
    decals.add("wallDecal", quadWest(WALL_U - 0.002, z - 0.35, z + 0.35, GF + 0.3, ROOF, [wd.waterStreak.u0, wd.waterStreak.v0, wd.waterStreak.u1, wd.waterStreak.v1]), { uv1: [[z - 0.35, GF + 0.3], [z + 0.35, GF + 0.3], [z + 0.35, ROOF], [z - 0.35, GF + 0.3], [z + 0.35, ROOF], [z - 0.35, ROOF]] });
  }
  // telhado: antena, parabólica e a caixa d'água (vistas de baixo, sobre a platibanda)
  bag.add("galv", rod([31.2, PARAPET, 6], [31.2, PARAPET + 3.4, 6], 0.025, 6));
  for (let k = 0; k < 5; k++) bag.add("galv", rod([31.2, PARAPET + 2.0 + k * 0.32, 5.4], [31.2, PARAPET + 2.0 + k * 0.32, 6.6], 0.008, 4));
  bag.add("plastic", new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3).rotateZ(Math.PI / 2 + 0.4), { m: tm(30.9, PARAPET + 0.9, -4), color: "#d9d8d2" });
  bag.add("plastic", cyl0(0.9, 0.95, 1.3, 18), { m: tm(32.4, PARAPET + 1.2, -12), color: "#2f5f8a" });
  bag.add("plastic", cyl0(0.92, 0.6, 0.25, 18), { m: tm(32.4, PARAPET + 2.5, -12), color: "#2a5a84" });

  /* ---------- escadas de incêndio do vizinho ---------- */
  for (const zc of NEIGHBOR_ESCAPES) {
    const zA = zc - 3.2, zB = zc + 3.2, xo = WALL_U - 0.95;
    for (let k = 0; k < 4; k++) {
      const y = storeyBase(k) + BAND;
      bag.add("grate", box(xo, y - 0.04, zA, WALL_U - 0.01, y, zB), { worldUv: true });
      bag.add("iron", tube([[WALL_U - 0.02, y + 0.95, zA], [xo, y + 0.95, zA], [xo, y + 0.95, zB], [WALL_U - 0.02, y + 0.95, zB]], 0.018, 18, 5));
      bag.add("iron", rod([xo, y + 0.48, zA], [xo, y + 0.48, zB], 0.01, 4));
      for (let z = zA; z <= zB + 0.01; z += 0.4) bag.add("iron", rod([xo, y, z], [xo, y + 0.95, z], 0.008, 4));
      bag.add("iron", box(xo - 0.005, y - 0.12, zA, xo, y - 0.04, zB));                                                // saia do balcão
      for (const z of [zA + 0.3, zc, zB - 0.3]) bag.add("iron", rod([WALL_U - 0.02, y - 0.85, z], [xo + 0.06, y - 0.05, z], 0.02, 5));   // mãos-francesas
      // lance até o balcão de cima (alternando) com degraus de grade
      if (k < 3) {
        const ya = y, yb = storeyBase(k + 1) + BAND, za = k % 2 ? zA + 0.35 : zB - 0.35, zb = k % 2 ? zA + 3.6 : zB - 3.6, xa = xo + 0.12, xb = WALL_U - 0.12;
        for (const x of [xa, xb]) bag.add("iron", rod([x, ya, za], [x, yb, zb], 0.025, 5));
        bag.add("iron", rod([xa - 0.04, ya + 0.9, za], [xa - 0.04, yb + 0.9, zb], 0.014, 4));
        const n = Math.round((yb - ya) / 0.2);
        for (let s = 1; s < n; s++) { const t = s / n; bag.add("grate", box(xa, ya + (yb - ya) * t - 0.02, za + (zb - za) * t - 0.11, xb, ya + (yb - ya) * t, za + (zb - za) * t + 0.11), { worldUv: true }); }
      }
      decals.add("wallDecal", quadWest(WALL_U - 0.002, zc - 0.4, zc + 0.4, y - 1.6, y - 0.1, [wd.rustStreak.u0, wd.rustStreak.v0, wd.rustStreak.u1, wd.rustStreak.v1]), { uv1: [[zc - 0.4, y - 1.6], [zc + 0.4, y - 1.6], [zc + 0.4, y - 0.1], [zc - 0.4, y - 1.6], [zc + 0.4, y - 0.1], [zc - 0.4, y - 0.1]] });
    }
    // escada de mão recolhida (contrapeso) pendurada sob o primeiro balcão
    const y = storeyBase(0) + BAND, lx = xo + 0.05;
    for (const z of [zc - 0.25, zc + 0.25]) bag.add("iron", rod([lx, y - 2.3, z], [lx, y, z], 0.016, 5));
    for (let yy = y - 2.2; yy < y; yy += 0.3) bag.add("iron", rod([lx, yy, zc - 0.25], [lx, yy, zc + 0.25], 0.011, 4));
  }

  /* ---------- fiação ---------- */
  // cabo correndo na parede acima do térreo, preso por grampos (catenárias curtas), e o maço de telefone mais acima
  for (const [y, sag, rad] of [[GF + 0.4, 0.06, 0.012], [GF + 0.48, 0.09, 0.008], [GF + FLOOR_H + 0.6, 0.12, 0.014]] as [number, number, number][]) {
    for (let z = Z_MOUTH - 0.2; z > Z_END + 1.5; z -= 1.6) { if (escape(z) || escape(z - 1.6)) continue; bag.add("cable", sagging([WALL_U - 0.04, y, z], [WALL_U - 0.04, y, z - 1.6], sag, rad, 8)); }
  }
  for (const z of [16.0, 6.1, -16.0]) bag.add("plastic", box(WALL_U - 0.1, GF + 0.2, z - 0.12, WALL_U, GF + 0.55, z + 0.12), { color: "#d8d4c8" });   // caixas de passagem
  bag.add("cable", tube([[WALL_U - 0.04, GF + 0.42, 6.1], [WALL_U - 0.08, GF + 0.12, 6.12], [WALL_U - 0.08, GF - 0.1, 6.14], [WALL_G - 0.03, GF - 0.4, 6.2], [WALL_G - 0.03, 0.62, 6.3]], 0.014, 16, 5));
  // cabos velhos cruzando o beco lá no fundo (do vizinho até a quina do museu)
  bag.add("cable", sagging([WALL_U - 0.05, 5.4, -21.6], [22.55, 6.3, -21.2], 0.7, 0.013, 24));
  bag.add("cable", sagging([WALL_U - 0.05, 5.2, -21.0], [22.55, 6.0, -20.9], 0.9, 0.01, 24));
  // tênis pendurado no cabo (clássico de beco)
  for (const [x, dz] of [[26.25, 0], [26.05, -0.04]] as [number, number][]) {
    bag.add("fabric", box(x - 0.06, 4.3, -21.42 + dz, x + 0.06, 4.4, -21.17 + dz), { color: "#e8e6e0" });
    bag.add("rubber", box(x - 0.065, 4.28, -21.43 + dz, x + 0.065, 4.31, -21.16 + dz));
    bag.add("cable", rod([x, 4.4, -21.3 + dz], [26.15, 5.13, -21.38], 0.004, 3));
  }

  /* ---------- decalques das paredes (térreo) ---------- */
  const put = (cell: string, x: number, z0: number, z1: number, y0: number, y1: number) => {
    const c = wd[cell]; decals.add("wallDecal", quadWest(x, z0, z1, y0, y1, [c.u0, c.v0, c.u1, c.v1]), { uv1: [[z0, y0], [z1, y0], [z1, y1], [z0, y0], [z1, y1], [z0, y1]] });
  };
  const xg = WALL_G - 0.003, xb = WALL_G - 0.028, xu = WALL_U - 0.003;
  // reboco caído (manchas de reboco velho que sobraram): nos panos de parede entre as janelas (antes das pichações, que
  // ficam por cima)
  for (const [cell, z, y, w, h] of [["plasterA", 21.5, 4.6, 1.5, 1.6], ["plasterB", 15.5, 8.0, 1.2, 1.3], ["plasterA", 3.5, 10.8, 1.5, 1.5], ["plasterB", -2.5, 4.4, 1.2, 1.2], ["plasterA", -14.5, 13.4, 1.4, 1.2], ["plasterB", -20.5, 7.4, 1.3, 1.6], ["plasterA", 0.4, -0.9, 1.3, 0.8], ["plasterB", 9.5, 13.4, 1.0, 1.0], ["plasterA", -17.5, 4.2, 1.4, 1.0]] as [string, number, number, number, number][]) {
    put(cell, y < GF ? (y - h / 2 < Y0 + 0.6 ? xb : xg) : xu, z - w / 2, z + w / 2, y - h / 2, y + h / 2);
  }
  put("posters", xg, 22.45, 24.0, -0.35, 0.5);
  put("gasPaint", xg, 20.95, 21.95, 0.55, 1.05); put("chalk", xg, 20.3, 20.7, -0.3, 0.1);
  put("grease", xb, 17.55, 19.35, -1.45, 0.45); put("houseNumber", xg, 19.05, 19.3, 0.25, 0.5);
  put("noTrash", xg, 16.45, 17.75, -0.05, 0.6); put("tagsSmall", xg, 14.4, 15.4, 0.0, 1.0);
  put("tagRun", xg, 11.0, 14.3, -0.35, 0.28); put("pieceSun", xb, 7.4, 11.45, -1.25, 0.45);
  put("tagNox", xg, -0.35, 1.45, -0.6, 0.3); put("throwVulto", xg, -3.95, -1.75, -0.15, 0.95);
  put("tagsSmall", xg, -7.4, -6.4, -0.15, 0.85); put("stencilCorvo", xg, -11.25, -10.55, 0.2, 0.9);
  put("tagTrama", xg, -15.3, -13.4, 0.15, 1.1); put("tagVert", xb, -19.25, -18.75, -1.3, 0.2);
  put("soot", xu, 17.85, 19.05, PARAPET - 2.2, PARAPET - 0.1);
  // eflorescência e umidade no pé da parede (faixas com variação), fora das portas
  for (let z = Z_END + 0.3; z < Z_MOUTH - 1.5; z += 2.6 + r() * 1.2) {
    const len = 1.4 + r() * 1.4; if ([GROUND.kitchen, GROUND.garage, GROUND.exit].some((h) => z + len > h.z0 && z < h.z1)) continue;
    put("efflor", xb - 0.001, z, z + len, Y0, Y0 + 0.45 + r() * 0.4);
  }
  return {
    litWindows: lit,
    sensorAt: new THREE.Vector3(WALL_G, 0.95, 17.6),
    flickerAt: new THREE.Vector3(WALL_G, GROUND.exit.y1 + 0.75, (GROUND.exit.z0 + GROUND.exit.z1) / 2),
    cageAt: new THREE.Vector3(WALL_G, 1.6, -18.9),
  };
}
