/*
 * MET Gala Heist v2 — Grande Salão (Z04 gala, Z05 pista e DJ, Z06 camarotes) — o módulo da área. A arquitetura de base
 * (cúpulas, colunata, mezanino, arcos, estandartes, instalação floral) é de interior-hall.ts; aqui entram o piso de
 * mármore com frisos e a rosácea, a cantaria das paredes com lambri e molduras, os lustres novos e os camarotes
 * (salao-walls.ts), a festa — cabine do DJ, caixas, pista, treliça, moving heads, globos (salao-dj.ts) —, a mesa de
 * doces, o bufê e o aparador (salao-food.ts) e as mesas dos patronos (salao-dining.ts).
 * Móveis com colisão vêm da planta (lib/heist/level.ts → baseProps, kind "fixture" com o model); este módulo os desenha.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { CYL0, mat } from "../interior-batch";
import { type RoomsCtx, A, beacon } from "./kit";
import type { AreaModule } from "./types";
import { dressWalls, floorMaterialSalao, wallMaterialSalao } from "./salao-walls";
import { djBooth, djSpeaker, dressDj } from "./salao-dj";
import { buffetTable, dessertTable, serviceBuffet } from "./salao-food";
import { patronTable } from "./salao-dining";
import { BeamSet, ROOM, tinting } from "./salao-kit";

/** Móveis próprios do salão (Prop.model). */
function fixture(p: Prop, c0: PropsCtx) {
  const c = tinting(c0);                                                  // peças lisas pequenas: um lote por acabamento
  switch (p.model) {
    case "djBooth": djBooth(p, c); break;
    case "djSpeaker": djSpeaker(p, c); break;
    case "dessertTable": dessertTable(p, c); break;
    case "buffetTable": buffetTable(p, c); break;
    case "serviceBuffet": serviceBuffet(p, c); break;
    case "patronTable": patronTable(p, c); break;
  }
  c.done();
}

function dress(c0: RoomsCtx) {
  const c = tinting(c0);
  const pins = new BeamSet();
  dressWalls(c);
  dressDj(c, pins);
  // pin spots sob a laje do mezanino sobre os doces e o bufê (latas pretas + feixe fraco + luz)
  for (const x of [-8, 8]) for (const dx of [-1.2, 1.2]) {
    c.batch.add(ROOM, c.P.black, CYL0(12), mat(x + dx, 4.86, 13.45, 0, 0.06, 0.14, 0.06));
    pins.add(new THREE.Vector3(x + dx, 4.86, 13.45), new THREE.Vector3(x + dx * 0.4, 0.95, 13.4), 0.32, "#fff1dc", 0.05);
  }
  // foco na passarela: dois refletores na borda do mezanino norte apontados para o fim da passarela
  for (const x of [9.8, 11.4]) {                                          // a coluna de x 9 fica de fora
    c.batch.add(ROOM, c.P.black, CYL0(12), mat(x, 4.78, -0.75, 0, 0.08, 0.2, 0.08));
    pins.add(new THREE.Vector3(x, 4.78, -0.75), new THREE.Vector3(10.3, 0.6, -2.6), 0.55, "#fff2e2", 0.07);
  }
  A(c, ROOM, 10.3, 3.2, -2.2, "#fff0dc", 7, 6.5);
  pins.flush(c.group);
  A(c, ROOM, -8, 4.6, 13.1, "#fff0d8", 9, 5.5); A(c, ROOM, 8, 4.6, 13.1, "#fff0d8", 9, 5.5);
  // giroflex (o do leste saiu de trás do painel do DJ)
  beacon(c, ROOM, -11.9, 4.6, 6.0, 1, 0); beacon(c, ROOM, 11.9, 4.6, 12.45, -1, 0);
  c.done();
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "salao", rooms: ["salao"], dress, props: { fixture },
  surfaces: { salao: { floor: floorMaterialSalao, floorTile: [2.4, 2.4], floorMirror: [0.8, 0.05], wall: wallMaterialSalao, wallTile: [2.4, 1.2], trims: false } },
  // luz principal com sombra: sobre a pista, o jantar a oeste, a entrada (doces e bufê) e a nave norte
  keys: {
    salao: [
      { p: [6.6, 9.0, 4.5], aim: [6.6, 0, 4.5], angle: 0.78, i: 70, color: "#ffd9b0" },
      { p: [-6.6, 9.0, 3.0], aim: [-6.6, 0, 3.2], angle: 0.85, i: 75, color: "#ffd29a" },
      { p: [0, 9.2, 11.6], aim: [0, 0, 12.2], angle: 0.85, i: 70, color: "#ffdcae" },
      { p: [-2.0, 9.2, -3.0], aim: [-2.0, 0, -3.2], angle: 0.85, i: 65, color: "#ffdcae" },
    ],
  },
};
