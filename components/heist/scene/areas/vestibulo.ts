/*
 * MET Gala Heist v2 — Vestíbulo e credenciamento (Z02), escadaria e galeria (Z14), circulação nobre (Z03). O módulo da
 * área troca a casca da sala (piso de granito em losangos, cantaria de calcário, teto próprio, sem rodapé nem sanca da
 * casca), desenha os móveis da planta no lugar dos genéricos (balcão curvo, chapelaria, detector, cordões, arara, banco)
 * e os móveis próprios pelo `model` (escadas, mesa floral, aparador, painel dos pavimentos, totem), e veste a sala:
 * faixa de borda, rosácea, soleiras e tapete; lambri, pilastras, cimalha, nichos, portal e bandeira da porta da rua,
 * placas, arandelas e cartazes; caixotões, medalhão e lustre; a galeria sobre a porta do salão; guarda-volumes e objetos.
 * As portas (de todas as salas) ficam em interior-doors.ts, também desta área.
 */
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { type RoomsCtx, beacon } from "./kit";
import type { AreaModule } from "./types";
import { FIELD_TILE, buildFloor, floorMaterial } from "./vestibulo-floor";
import { WALL_TILE, buildWalls, wallMaterial } from "./vestibulo-walls";
import { CHANDELIER, buildCeiling } from "./vestibulo-ceiling";
import { buildGallery, buildStair } from "./vestibulo-stair";
import { bench, cloakWall, coatCheck, desk, detector, directory, floralTable, rack, rope, smallProps, totem, welcomeConsole } from "./vestibulo-furniture";

/** Decoração sem colisão: piso, paredes, teto e lustre, galeria, guarda-volumes, objetos soltos e os giroflex. */
function vestibulo(c: RoomsCtx) {
  buildFloor(c);
  buildWalls(c);
  buildCeiling(c);
  buildGallery(c);
  cloakWall(c);
  smallProps(c);
  beacon(c, "vestibulo", -7.9, 4.75, 19.0, 1, 0); beacon(c, "vestibulo", 7.9, 4.75, 23.4, -1, 0);
}

/** Móveis próprios da área (kind "fixture"), pelo model. */
function fixture(p: Prop, c: PropsCtx) {
  switch (p.model) {
    case "vestStair": return buildStair(p, c);
    case "vestFloral": return floralTable(p, c);
    case "vestConsole": return welcomeConsole(p, c);
    case "vestDirectory": return directory(p, c);
    case "vestTotem": return totem(p, c);
  }
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "vestibulo",
  rooms: ["vestibulo"],
  dress: vestibulo,
  props: { desk, coatcheck: coatCheck, detector, rope, rack, bench, fixture },
  surfaces: {
    vestibulo: { floor: floorMaterial, floorTile: FIELD_TILE, floorMirror: [0.85, 0.05], wall: wallMaterial, wallTile: WALL_TILE, ceil: null, trims: false },
  },
  // a luz principal com sombra desce do lustre (pessoas, balcão e escadas assentam no granito)
  keys: { vestibulo: [{ p: [CHANDELIER.x, CHANDELIER.y - 0.2, CHANDELIER.z], aim: [0, 0, 19.6], angle: 1.25, i: 58, color: "#ffd9a8" }] },
};
