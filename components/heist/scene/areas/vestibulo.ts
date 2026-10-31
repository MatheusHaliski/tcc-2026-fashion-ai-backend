/*
 * MET Gala Heist v2 — Vestíbulo e credenciamento (Z02): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import { BOX0, mat } from "../interior-batch";
import { fabric, solid } from "../interior-mats";
import { chandelier } from "../interior-hall";
import { type RoomsCtx, A, B, wallPlane, signMat, exhibitPoster, framedPoster, sconce, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Vestíbulo: tapete vermelho da porta da rua ao detector, viga do detector, lustre, letreiros e cartazes. */
function vestibulo(c: RoomsCtx) {
  const P = c.P, room = "vestibulo";
  // tapete vermelho com debrum dourado (deitado no piso)
  B(c, room, fabric("redCarpet", "#7d0b16", c.q), 0, 0.004, 19.25, 2.6, 0.012, 9.3);
  for (const s of [-1, 1]) B(c, room, P.gold, s * 1.33, 0.004, 19.25, 0.06, 0.014, 9.3);
  // viga que une as colunas do detector, com a faixa de LED e o selo
  B(c, room, solid("detectorGrey", "#c9cbcd", { rough: 0.4 }), 0, 2.25, 14.9, 5.0, 0.18, 0.6);
  c.inst.add(room, "detBeamLed", BOX0(), P.ledGreen, mat(0, 2.32, 15.205, 0, 1.6, 0.04, 0.004));
  // letreiro da gala sobre a porta do salão e placas do credenciamento e da chapelaria
  wallPlane(c, room, signMat(c.copy.bannerA, "gala", c.copy.exhibitTitle, 0.6), 0, 5.1, 14.53, 0, 5, 1.25);
  // placa do credenciamento pendurada sobre a mesa, virada para quem entra pela rua
  wallPlane(c, room, signMat(c.copy.credentials, "brass"), -4.4, 3.3, 21.0, 0, 2.2, 0.55);
  for (const dx of [-0.9, 0.9]) B(c, room, P.brass, -4.4 + dx, 3.55, 21.0, 0.012, 2.95, 0.012);
  wallPlane(c, room, signMat(c.copy.coatCheck, "brass"), 7.97, 2.9, 19, -Math.PI / 2, 2.2, 0.55);
  // cartazes da exposição nas paredes leste e oeste
  framedPoster(c, room, exhibitPoster(c.copy, 0), -7.97, 2.6, 17.4, Math.PI / 2, 1.2, 1.8);
  framedPoster(c, room, exhibitPoster(c.copy, 1), -7.97, 2.6, 23.0, Math.PI / 2, 1.0, 1.5);
  framedPoster(c, room, exhibitPoster(c.copy, 2), 7.97, 2.6, 23.0, -Math.PI / 2, 1.0, 1.5);
  // lustre central e arandelas
  chandelier(room, 0, 4.6, 19.5, 6.5, c.q, P, c.batch, c.inst, [], 1.15);
  A(c, room, 0, 4.9, 19.5, "#ffd7a3", 30, 11);
  for (const [x, z, ry] of [[-7.97, 16.2, Math.PI / 2], [-7.97, 19.4, Math.PI / 2], [7.97, 16.2, -Math.PI / 2], [7.97, 22.3, -Math.PI / 2]] as [number, number, number][]) sconce(c, room, x, 2.7, z, ry);
  beacon(c, room, -7.9, 4.8, 15.4, 1, 0); beacon(c, room, 7.9, 4.8, 23.4, -1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "vestibulo", rooms: ["vestibulo"], dress: vestibulo };
