/*
 * MET Gala Heist v2 — registro das áreas do cenário (ver areas/types.ts). A ordem é a da montagem (a mesma de antes da
 * divisão de interior-rooms.ts). Para uma área nova: um arquivo em areas/ que exporta AREA e uma linha aqui.
 */
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import type { RoomsCtx } from "./kit";
import type { AreaModule, KeyDef, SurfaceOverride } from "./types";
import { AREA as vestibulo } from "./vestibulo";
import { AREA as galeria } from "./galeria";
import { AREA as lounge } from "./lounge";
import { AREA as bastidores } from "./bastidores";
import { AREA as servico } from "./servico";
import { AREA as seguranca } from "./seguranca";
import { AREA as doca } from "./doca";
import { AREA as cofre } from "./cofre";
import { AREA as terraco } from "./terraco";
import { AREA as salao } from "./salao";

export const AREAS: AreaModule[] = [vestibulo, galeria, lounge, bastidores, servico, seguranca, doca, cofre, terraco, salao];

const byRoom = (room: string) => AREAS.find((a) => (a.rooms as string[]).includes(room));
/** Decoração de todas as áreas. */
export function dressAreas(c: RoomsCtx) { for (const a of AREAS) a.dress(c); }
/** Construtor do móvel pela área da sala dele (ou null: fica o genérico de interior-props). */
export function areaProp(p: Prop): ((p: Prop, c: PropsCtx) => void) | null { return byRoom(p.room)?.props?.[p.kind] ?? null; }
/** Acabamento próprio da casca da sala (ou null: o de STYLE). */
export function areaSurface(room: InteriorRoom): SurfaceOverride | null { return byRoom(room)?.surfaces?.[room] ?? null; }
/** Luz principal da sala pedida pela área (ou null: a de interior-fx). */
export function areaKeys(room: InteriorRoom): KeyDef[] | null { return byRoom(room)?.keys?.[room] ?? null; }
export type { RoomsCtx };
