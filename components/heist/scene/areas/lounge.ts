/*
 * MET Gala Heist v2 — Lounge e bar (Z05): o salão íntimo da gala, na linguagem dos salões fechados de um castelo de jogo
 * de terror gótico (referência de linguagem, nada copiado): espaço fechado com teto trabalhado, paredes em camadas, piso
 * com desenho, luz de fonte visível e mobiliário único.
 *
 *  · piso: parquet em espinha de peixe (lounge-tex) com frisa de nogueira e filete de latão junto às paredes, dois
 *    tapetes persas com franja sob os grupos de estar;
 *  · paredes: rodapé moldurado, lambri de nogueira com almofadas em bisel e capitel, damasco azul-petróleo (a casca) em
 *    quadros de filete dourado entre pilastras, friso com dentículos, cimalha e a sanca iluminada;
 *  · teto: escuro, em caixotões laqueados com filete de ouro entre vigas de nogueira, florão e o lustre art déco em
 *    três andares de vidro fosco com pingentes;
 *  · leste: a estante do bar de Davi (arco de ônix aceso por trás, prateleiras de vidro com garrafas de rótulos
 *    inventados, espelhos envelhecidos, armário baixo com tampo de ônix) e os pendentes de vidro âmbar sobre o balcão;
 *  · sul: três janelas em arco (vidro noturno, caixilhos de bronze) com cortinas de veludo presas, bandô e franja;
 *  · arandelas art déco de vidro fosco, a pintura com luz de quadro, o espelho envelhecido, o relógio solar dourado,
 *    luminária de pé, palmeiras em cachepôs de cerâmica e o giroflex do alarme sobre a porta.
 * Os móveis com colisão (bar, sofás, poltronas, mesas, banquetas, piano, trumeau, biombo) estão em lounge-mob.ts.
 */
import * as THREE from "three";
import { baseProps } from "@/lib/heist/level";
import { BOX0, geo, mat } from "../interior-batch";
import { type RoomsCtx, beacon, lightCone } from "./kit";
import type { AreaModule } from "./types";
import { areaMat, contactMat, profileRun, raisedPanel, footOf } from "./lounge-kit";
import { DAMASK_TILE, PARQUET_TILE, damaskSurface, parquetSurface } from "./lounge-tex";
import { armchair, barStool, coffeeTable, grandPiano, gueridon, lacquerScreen, loungeMats, loungeSofa, onyxBar, trumeau } from "./lounge-mob";
import { room, X0, X1, Z0, Z1, type Wall, wm, BASE_PROF } from "./lounge-planta";
import { panelledWall, cornice, overdoor, archWindow } from "./lounge-paredes";
import { ceiling, chandelierDeco, pendant, decoSconce } from "./lounge-teto";
import { backBar } from "./lounge-estante";
import { painting, wallMirror, sunburstClock, floorLamp, palm, pampasVase, rug, floorBorder } from "./lounge-decor";

/** Lounge e bar (decoração sem colisão, luzes): ver o cabeçalho. */
function lounge(c: RoomsCtx) {
  const L = loungeMats(c.q, c.P);
  // paredes: oeste (porta do salão em z 9–11), norte (bastidores em x 16–18), leste (estante do bar), sul (janelas)
  panelledWall(c, L, "W", Z0, 8.8); panelledWall(c, L, "W", 11.2, Z1);
  panelledWall(c, L, "N", X0, 15.8); panelledWall(c, L, "N", 18.2, X1);
  panelledWall(c, L, "E", Z0, 6.05); panelledWall(c, L, "E", 12.95, Z1);
  for (const [a0, a1] of [[X0, 13.15], [15.01, 16.32], [18.18, 19.49], [21.35, X1]] as [number, number][]) panelledWall(c, L, "S", a0, a1, { upper: a1 - a0 > 1 });
  for (const xc of [14.08, 17.25, 20.42]) {
    c.batch.add(room, L.walnut, profileRun("lounge-baseRun", BASE_PROF), wm("S", xc, 0, 0, 1.86, 1, 1));
    c.batch.add(room, L.walnut, BOX0(), wm("S", xc, 0.2, 0.008, 1.86, 0.78, 0.016));
    c.batch.add(room, L.walnut, raisedPanel(1.5, 0.56, 0.018, 0.035), wm("S", xc, 0.58, 0.016));
    archWindow(c, L, xc);
  }
  // sobre as portas: a parede até a cimalha ganha o friso inteiro (a guarnição das folhas é da área do vestíbulo)
  for (const w of ["W", "E"] as Wall[]) cornice(c, L, w, Z0, Z1);
  for (const w of ["N", "S"] as Wall[]) cornice(c, L, w, X0, X1);
  ceiling(c, L);
  chandelierDeco(c, L, 17.25, 9.25);
  for (const z of [7.5, 9.5, 11.5]) { pendant(c, L, 20.35, z, 2.32); lightCone(c, room, new THREE.Vector3(20.35, 2.2, z), new THREE.Vector3(20.3, 1.1, z), 0.42, "#ffb066", 0.05); }
  backBar(c, L);
  painting(c, L);
  wallMirror(c, L, "W", 12.6, 2.3, 0.62, 1.5);
  sunburstClock(c, L, "N", 20.95, 2.75);
  for (const [w, a, y] of [["W", 5.55, 2.25], ["W", 8.6, 2.25], ["W", 11.68, 2.3], ["W", 13.52, 2.3], ["N", 15.55, 2.3], ["N", 18.45, 2.3], ["E", 13.5, 2.35], ["S", 15.67, 2.45], ["S", 18.83, 2.45]] as [Wall, number, number][]) decoSconce(c, L, w, a, y);
  floorLamp(c, L, 13.3, 5.32);
  palm(c, 21.35, 5.1, 7, Math.atan2(17.25 - 21.35, 9.25 - 5.1)); pampasVase(c, 12.92, 13.6);
  // piso: frisa, tapetes persas sob os dois grupos e as sombras de contato dos móveis que pisam neles
  floorBorder(c, L);
  rug(c, "a", c.q, 13.45, 5.55, 16.6, 8.65, true, 1);
  rug(c, "b", c.q, 13.7, 11.25, 17.45, 13.35, true, 1.5);
  const shadow = contactMat(), flat = geo("lounge-shadowPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  for (const p of baseProps()) {
    if (p.room !== "lounge" || p.kind === "mirror" || p.kind === "bar" || p.kind === "piano") continue;
    const f = footOf(p);
    if (!((f.cx > 13.45 && f.cx < 16.6 && f.cz > 5.55 && f.cz < 8.65) || (f.cx > 13.7 && f.cx < 17.45 && f.cz > 11.25 && f.cz < 13.35))) continue;
    c.batch.add(room, shadow, flat, mat(f.cx, 0.0105, f.cz, f.yaw, f.w + 0.28, 1, f.d + 0.28), { receive: false });
  }
  overdoor(c, L, "W", 10, 2); overdoor(c, L, "N", 17, 2);
  // giroflex do alarme na parede oeste, ao lado da porta do salão
  beacon(c, room, 12.6, 3.55, 8.15, 1, 0);
}

/** Módulo da área (ver areas/types.ts): decoração, móveis próprios, piso/parede/teto e a luz principal. */
export const AREA: AreaModule = {
  id: "lounge", rooms: ["lounge"], dress: lounge,
  props: {
    bar: onyxBar, sofa: loungeSofa, table: gueridon, piano: grandPiano, mirror: trumeau,
    fixture: (p, c) => { switch (p.model) { case "loungeStool": return barStool(p, c); case "loungeArmchair": return armchair(p, c); case "loungeCoffee": return coffeeTable(p, c); case "loungeScreen": return lacquerScreen(p, c); } },
  },
  surfaces: {
    lounge: {
      floor: (q) => { const sf = parquetSurface(q); return areaMat(`lounge-floor-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 1, envMapIntensity: 0.85 })); },
      floorTile: [PARQUET_TILE, PARQUET_TILE], floorMirror: [0.42, 0.035],
      wall: (q) => { const sf = damaskSurface(q); return areaMat(`lounge-wall-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1), vertexColors: true, roughness: 1, envMapIntensity: 0.55 })); },
      wallTile: [DAMASK_TILE, DAMASK_TILE], ceil: null, trims: false,
    },
  },
  keys: {
    lounge: [
      { p: [17.25, 3.05, 9.25], aim: [16.6, 0, 9.4], angle: 1.15, i: 32, color: "#ffc98a" },
      { p: [19.9, 2.25, 9.5], aim: [19.4, 0, 9.5], angle: 1.05, i: 16, color: "#ffb466" },
    ],
  },
};
