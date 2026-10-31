/*
 * MET Gala Heist v2 — Grande Salão — extras fora de interior-hall.ts (Z04/Z05): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import { RACKS } from "@/lib/heist/level";
import { M } from "../interior-mats";
import { SANS, SERIF } from "../interior-tex";
import { candelabra, roseGeometry } from "../interior-hall";
import { type RoomsCtx, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Extras do salão que não são arquitetura: o quarteto (luz própria), castiçais nas mesas — já nos móveis —, giroflex. */
function salaoExtras(c: RoomsCtx) {
  beacon(c, "salao", -11.9, 4.6, 6.0, 1, 0); beacon(c, "salao", 11.9, 4.6, 6.4, -1, 0);
}

/** As araras de RACKS ficam em interior-props (são móveis); isto só garante o import das constantes usadas. */
void RACKS; void candelabra; void roseGeometry; void M; void SERIF; void SANS;

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "salao", rooms: ["salao"], dress: salaoExtras };
