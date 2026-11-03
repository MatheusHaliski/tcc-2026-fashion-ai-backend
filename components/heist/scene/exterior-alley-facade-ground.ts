/*
 * MET Gala Heist v2 — beco (Z15): térreo comercial do vizinho — parede com as aberturas, barrado e viga, porta da cozinha com
 * o exaustor, portão de garagem, saída de emergência, janelinhas com grade, quadro de medidores e o cano de gás.
 */
import * as THREE from "three";
import type { Rect01 } from "./exterior-alley-tex";
import { Bag, box, cyl0, quadWest, rod, tm } from "./exterior-alley-geo";
import { Y0 } from "./exterior-alley-props";
import { BAND, GF, GLASS_X, GROUND, holedWall, PARAPET, reveals, WALL_G, WALL_U, Z_END, Z_MOUTH } from "./exterior-alley-facade-plan";

/** Térreo do vizinho (até a viga do 1º andar), em `bag`; `signs` = placas; `r` = o sorteio da fachada (segue a mesma
 * sequência de neighborFacade). */
export function groundFloor(bag: Bag, signs: Record<string, Rect01>, r: () => number) {
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
}
