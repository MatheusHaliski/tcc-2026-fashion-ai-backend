/*
 * The MET Gala Afterparty Heist — planta do Museu Vesper de Moda na noite da Gala Lumière (ficcional). Nove áreas
 * internas e o beiral externo, cada uma com função na investigação:
 *
 *                 z −23 ═══════════════════ beiral (travessia pelo lado de fora) ═══════════════════
 *                 z −22 ┌──janela───┬────────────────────────┬──janela──┐
 *                       │CONSERVAÇÃO│    GALERIA DE MODA     │ TERRAÇO  │  caixas e luz UV · vitrines e placas · encontros
 *                 z −6  ├──duto─────┼────────┤ ├─────────────┼─equipe───┤
 *                       │ CORREDORES│                        │BASTIDORES│  equipe, araras, mesa da produção, monitores
 *                       │ DE SERVIÇO│     SALÃO PRINCIPAL    ├─porta────┤
 *                       │           │  (palco da apresentação)│ LOUNGE E │  bar, sofás, jornalista
 *                 z 14  │           ├──────┤credenc.├────────┤   BAR    │
 *                 z 16  ├─teclado───┤ │   ENTRADA E        │──────────┘
 *                       │   DOCA    ├ │   CREDENCIAMENTO   │
 *                 z 24  └───────────┘ └────────────────────┘
 *                     x −22       −12          0          12        22
 *
 * Móveis com contexto: cada mesa, arara, vitrine e caixa existe porque alguém trabalha, conversa ou guarda algo ali.
 */
import type { AreaId, CameraDef, DoorDef, InteractDef, Prop, PropKind, Room, RoomId, Shape, StaffSpawn, Vec } from "./types";

export const ROOMS: Room[] = [
  { id: "salao", rect: { x0: -12, z0: -6, x1: 12, z1: 14 }, access: "public", floor: "marble" },
  { id: "entrada", rect: { x0: -8, z0: 14.5, x1: 8, z1: 24 }, access: "public", floor: "marble" },
  { id: "doca", rect: { x0: -22, z0: 16.5, x1: -8.5, z1: 24 }, access: "staff", floor: "concrete" },
  { id: "servico", rect: { x0: -22, z0: -6, x1: -12.5, z1: 16 }, access: "staff", floor: "concrete" },
  { id: "lounge", rect: { x0: 12.5, z0: 4.5, x1: 22, z1: 14 }, access: "public", floor: "carpet" },
  { id: "bastidores", rect: { x0: 12.5, z0: -6, x1: 22, z1: 4 }, access: "staff", floor: "parquet" },
  { id: "galeria", rect: { x0: -12, z0: -22, x1: 12, z1: -6.5 }, access: "public", floor: "parquet" },
  { id: "conservacao", rect: { x0: -22, z0: -22, x1: -12.5, z1: -6.5 }, access: "private", floor: "metal" },
  { id: "terraco", rect: { x0: 12.5, z0: -22, x1: 22, z1: -6.5 }, access: "public", floor: "stone" },
  { id: "beiral", rect: { x0: -21, z0: -23.5, x1: 21, z1: -22.5 }, access: "private", floor: "stone" },
];

export const DOORS: DoorDef[] = [
  { id: "main", rect: { x0: -2, z0: 14, x1: 2, z1: 14.5 }, lock: "wristband", between: ["entrada", "salao"] },
  { id: "side", rect: { x0: -8.5, z0: 20, x1: -8, z1: 22.5 }, lock: "open", between: ["entrada", "doca"] },
  { id: "service", rect: { x0: -20, z0: 16, x1: -18, z1: 16.5 }, lock: "keypad", between: ["doca", "servico"] },
  { id: "staff", rect: { x0: -12.5, z0: 9, x1: -12, z1: 11 }, lock: "open", between: ["servico", "salao"] },
  { id: "lounge", rect: { x0: 12, z0: 9, x1: 12.5, z1: 11 }, lock: "open", between: ["salao", "lounge"] },
  { id: "backstage", rect: { x0: 16, z0: 4, x1: 18, z1: 4.5 }, lock: "open", between: ["lounge", "bastidores"] },
  { id: "stage", rect: { x0: 12, z0: -3, x1: 12.5, z1: -1 }, lock: "open", between: ["salao", "bastidores"] },
  { id: "gallery", rect: { x0: -2, z0: -6.5, x1: 2, z1: -6 }, lock: "open", between: ["salao", "galeria"] },
  { id: "conservation", rect: { x0: -12.5, z0: -16, x1: -12, z1: -14 }, lock: "keycard", between: ["galeria", "conservacao"] },
  { id: "terrace", rect: { x0: 12, z0: -16, x1: 12.5, z1: -14 }, lock: "open", between: ["galeria", "terraco"] },
  { id: "staffTerrace", rect: { x0: 16, z0: -6.5, x1: 18, z1: -6 }, lock: "open", between: ["bastidores", "terraco"] },
  { id: "vent", rect: { x0: -18, z0: -6.5, x1: -17, z1: -6 }, lock: "vent", between: ["servico", "conservacao"] },
  { id: "windowT", rect: { x0: 19, z0: -22.5, x1: 20, z1: -22 }, lock: "window", between: ["terraco", "beiral"] },
  { id: "windowC", rect: { x0: -20, z0: -22.5, x1: -19, z1: -22 }, lock: "window", between: ["beiral", "conservacao"] },
];

const box = (x0: number, z0: number, x1: number, z1: number): Shape => ({ type: "box", x0, z0, x1, z1 });
const circ = (x: number, z: number, r: number): Shape => ({ type: "circle", x, z, r });

/** Móveis e peças fixas de cada área. Colunas, estantes, araras e caixas altas bloqueiam a visão; mesas, balcões e caixas
 * baixas só escondem quem está agachado; o vidro das vitrines bloqueia o passo, não o olhar. */
export function baseProps(): Prop[] {
  let seq = 0;
  const out: Prop[] = [];
  const P = (kind: PropKind, room: RoomId, shape: Shape, height: Prop["height"], yaw?: number, variant?: number) => out.push({ id: `${kind}-${++seq}`, kind, room, shape, height, yaw, variant });
  // salão principal: colunata, arranjo floral, mesas da ceia, palco da apresentação final, telão, quarteto
  for (const x of [-9, -4.5, 4.5, 9]) for (const z of [-1, 10]) P("column", "salao", circ(x, z, 0.5), "tall");
  P("statue", "salao", circ(0, 4.5, 1.3), "tall", 0, 1);
  for (const [x, z] of [[-6.5, 2.5], [-6.5, 6.5], [6.2, 6.5]]) P("table", "salao", circ(x, z, 0.8), "low");
  for (const [x, z] of [[-2.8, 1.2], [2.8, 1.2], [5.6, 2.2]]) P("table", "salao", circ(x, z, 0.4), "low", 0, 1);
  P("stage", "salao", box(8.8, -4.5, 11.8, 2.5), "low", -Math.PI / 2, 0);
  P("screen", "salao", box(3.6, -6, 8.4, -5.6), "tall");
  P("desk", "salao", box(5, -4.6, 7, -3.8), "low", Math.PI, 3);
  P("stage", "salao", box(-11.6, 0.5, -9.6, 4.5), "low", Math.PI / 2, 1);
  P("stand", "salao", box(-6.5, 12.3, -5.5, 13), "low");
  P("sofa", "salao", box(-11.6, -5, -10.6, -2.5), "low", Math.PI / 2);
  P("cart", "salao", circ(-9.6, 12, 0.45), "low", 0, 1);
  for (const [x, z] of [[-11.3, 13.3], [11.3, 13.3]]) P("planter", "salao", circ(x, z, 0.45), "low");
  // entrada e credenciamento
  P("rope", "entrada", box(-2.2, 17.2, -2, 23), "low"); P("rope", "entrada", box(2, 17.2, 2.2, 23), "low");
  P("detector", "entrada", box(-2.5, 14.6, -2.05, 15.2), "tall"); P("detector", "entrada", box(2.05, 14.6, 2.5, 15.2), "tall");
  P("desk", "entrada", box(-5.6, 15.4, -3.2, 16.1), "low", Math.PI, 1);
  P("backdrop", "entrada", box(3, 23.4, 7.5, 23.8), "tall");
  for (const [x, z] of [[7.4, 15], [-7.4, 23.4]]) P("planter", "entrada", circ(x, z, 0.45), "low");
  // doca: a van da operação e a carga do bufê
  P("van", "doca", box(-21.5, 20.5, -17.5, 23.5), "tall");
  P("crate", "doca", box(-15, 17, -13.8, 18.2), "tall"); P("crate", "doca", box(-12, 17, -11, 18), "low");
  P("crate", "doca", box(-11, 22.6, -9.6, 23.8), "tall"); P("crate", "doca", box(-16, 22.8, -15, 23.8), "low");
  P("crate", "doca", box(-13.5, 20.5, -11.5, 21.6), "tall", 0, 2);
  // corredores de serviço: copa do bufê, estoque, quadro de luz
  P("shelf", "servico", box(-22, 8, -21.2, 14), "tall", Math.PI / 2); P("shelf", "servico", box(-22, -5, -21.2, 0), "tall", Math.PI / 2);
  P("panel", "servico", box(-22, 3, -21.6, 4.5), "tall", Math.PI / 2);
  P("worktable", "servico", box(-18.5, 9, -15.5, 10.2), "low", 0, 2); P("worktable", "servico", box(-18.5, 4, -15.5, 5.2), "low", 0, 2);
  P("cart", "servico", circ(-14.5, 12, 0.5), "low");
  P("locker", "servico", box(-13.1, 5.5, -12.5, 6.5), "tall", -Math.PI / 2, 1);
  // lounge e bar
  P("bar", "lounge", box(19.8, 6.5, 21, 12.5), "low", -Math.PI / 2);
  P("sofa", "lounge", box(13.2, 12.4, 15.8, 13.4), "low", Math.PI); P("sofa", "lounge", box(13, 6.4, 14, 9), "low", Math.PI / 2);
  for (const [x, z] of [[15.6, 8], [16.6, 11.2]]) P("table", "lounge", circ(x, z, 0.45), "low", 0, 1);
  P("mirror", "lounge", box(12.5, 4.6, 14, 4.9), "tall", 0, 1);
  P("piano", "lounge", box(17.6, 12.6, 19.2, 13.8), "low", Math.PI);
  // bastidores: araras, penteadeiras, vaporizador, mesa da produção, monitores da segurança, looks da apresentação
  P("mirror", "bastidores", box(21.6, -4, 22, 1), "tall", -Math.PI / 2); P("desk", "bastidores", box(20.4, -4, 21.6, 1), "low", -Math.PI / 2, 4);
  P("desk", "bastidores", box(14.4, 1.8, 16.8, 2.8), "low", 0, 2);
  P("desk", "bastidores", box(18.6, -5.6, 21.4, -4.8), "low", Math.PI, 1); P("screen", "bastidores", box(18.6, -6, 21.4, -5.7), "tall", 0, 1);
  P("steamer", "bastidores", circ(17.6, -1.8, 0.3), "low");
  for (const [x, z] of [[13.4, -4.6], [14.4, -4.6], [15.4, -4.6]]) P("mannequin", "bastidores", circ(x, z, 0.32), "tall");
  // galeria de moda: vitrines, plataformas, placas
  P("case", "galeria", box(-1, -18, 1, -16), "glass", 0, 1);
  P("case", "galeria", box(-7.4, -15.4, -5.6, -13.6), "glass", 0, 0); P("case", "galeria", box(5.6, -15.4, 7.4, -13.6), "glass", 0, 2);
  for (const [x0, z0, x1, z1] of [[-11.6, -20, -10.4, -18], [10.4, -20, 11.6, -18], [-11.6, -11, -10.4, -9], [10.4, -11, 11.6, -9]]) P("case", "galeria", box(x0, z0, x1, z1), "glass", 0, 3);
  P("bench", "galeria", box(-2, -11.4, 2, -10.8), "low");
  for (const [x, z] of [[-3.5, -20.5], [3.5, -20.5], [-9, -7.6], [9, -7.6]]) P("statue", "galeria", circ(x, z, 0.45), "tall");
  // sala de conservação: caixas de transporte, mesas de restauro, luminárias UV, estantes de acervo
  for (const x of [-20.5, -18.3, -16.1, -13.9]) P("crate", "conservacao", box(x - 0.6, -19.2, x + 0.6, -18.2), "tall", 0, 4);
  P("worktable", "conservacao", box(-20.5, -12, -17.5, -10.6), "low", 0, 1); P("worktable", "conservacao", box(-16.2, -12, -13.8, -10.6), "low", 0, 1);
  for (const x of [-20, -17.2, -14.4]) P("lamp", "conservacao", circ(x, -15, 0.25), "low");
  P("shelf", "conservacao", box(-22, -16, -21.2, -8), "tall", Math.PI / 2);
  // terraço
  P("planter", "terraco", circ(14, -20.5, 0.6), "low"); P("planter", "terraco", circ(20.8, -8, 0.6), "low"); P("planter", "terraco", circ(14, -8, 0.6), "low");
  P("sofa", "terraco", box(15, -12, 18, -11.2), "low", Math.PI);
  P("railing", "terraco", box(21.6, -22, 22, -6.5), "low");
  return out;
}

/** Araras com capas de roupa: esconderijo (entra e sai com a interação). */
export const RACKS: { id: string; pos: Vec; room: RoomId; yaw: number }[] = [
  { id: "rack-b1", pos: { x: 13.8, z: -1.6 }, room: "bastidores", yaw: Math.PI / 2 }, { id: "rack-b2", pos: { x: 19.2, z: 2.6 }, room: "bastidores", yaw: Math.PI },
  { id: "rack-s1", pos: { x: -14, z: 2 }, room: "servico", yaw: -Math.PI / 2 }, { id: "rack-s2", pos: { x: -19.6, z: -2.5 }, room: "servico", yaw: Math.PI / 2 },
  { id: "rack-d1", pos: { x: -15.8, z: 20 }, room: "doca", yaw: 0 }, { id: "rack-c1", pos: { x: -13.6, z: -9 }, room: "conservacao", yaw: -Math.PI / 2 },
  { id: "rack-e1", pos: { x: -7.2, z: 18.5 }, room: "entrada", yaw: Math.PI / 2 },
];

export const GUEST_SPOTS: { pos: Vec; room: RoomId }[] = [
  { pos: { x: -8.6, z: 4.5 }, room: "salao" }, { pos: { x: -4.4, z: 8.6 }, room: "salao" }, { pos: { x: -4.4, z: 0.6 }, room: "salao" },
  { pos: { x: 4.4, z: 0.6 }, room: "salao" }, { pos: { x: 4.4, z: 8.6 }, room: "salao" }, { pos: { x: 7.8, z: 9 }, room: "salao" },
  { pos: { x: -1.6, z: 12.1 }, room: "salao" }, { pos: { x: 1.8, z: 11.9 }, room: "salao" }, { pos: { x: -8.4, z: -3.4 }, room: "salao" },
  { pos: { x: 1.6, z: -2.6 }, room: "salao" }, { pos: { x: 0, z: 7.4 }, room: "salao" },
  { pos: { x: 17.6, z: 9.4 }, room: "lounge" }, { pos: { x: 14.6, z: 10.6 }, room: "lounge" },
  { pos: { x: -5, z: 20.4 }, room: "entrada" }, { pos: { x: 0, z: 19.4 }, room: "entrada" }, { pos: { x: 5.2, z: 21.2 }, room: "entrada" },
  { pos: { x: -4.6, z: -9.4 }, room: "galeria" }, { pos: { x: 4.2, z: -18.6 }, room: "galeria" }, { pos: { x: 17.4, z: -16.6 }, room: "terraco" },
];
/** Quarteto de cordas, garçons e equipe com posto fixo (o resto da equipe tem rotina em npcs.ts). */
export const MUSICIANS: Vec[] = [{ x: -10.2, z: 1.2 }, { x: -10.9, z: 2.1 }, { x: -10.9, z: 3.1 }, { x: -10.2, z: 3.9 }];
export const CREW_SPOTS: { pos: Vec; yaw: number; anim: "work" | "steam" }[] = [
  { pos: { x: 21, z: -2.6 }, yaw: Math.PI / 2, anim: "work" }, { pos: { x: 17.6, z: -1.1 }, yaw: Math.PI, anim: "steam" },
  { pos: { x: -17, z: 10.9 }, yaw: Math.PI, anim: "work" }, { pos: { x: -17, z: 3.4 }, yaw: 0, anim: "work" },
];

/** As oito áreas do jogo: a doca é parte dos corredores de serviço e o beiral, do terraço. */
export const AREA_OF: Record<RoomId, AreaId> = {
  entrada: "entrada", salao: "salao", galeria: "galeria", lounge: "lounge", terraco: "terraco", beiral: "terraco",
  bastidores: "bastidores", servico: "servico", doca: "servico", conservacao: "conservacao",
};

export const PLAYER_SPAWN: Vec = { x: 0, z: 22.8 };
/** Para onde a segurança acompanha quem foi pega onde não devia (o salão, perto da entrada). */
export const ESCORT_TO: Vec = { x: 0, z: 12.4 };
/** Palco da apresentação final, onde Ruth recebe o original na fuga e onde a revelação acontece. */
export const STAGE_POS: Vec = { x: 8.2, z: -1 };
export const AURORA_CASE: Vec = { x: 0, z: -17 };
/** A caixa C-17 na conservação (a segunda da esquerda) e a carga na doca depois do transporte antecipado. */
export const CRATE_C17: Vec = { x: -18.3, z: -18.7 };
export const VAN_CRATE: Vec = { x: -16.9, z: 19.6 };
/** Quadro de luz dos corredores de serviço: a segurança vai conferir quando falta luz. */
export const LIGHT_PANEL: Vec = { x: -21, z: 3.75 };

/** Segurança do museu (avisa e acompanha até o salão) e equipe de Brandt (avisa o produtor). Ninguém ataca. */
export const STAFF: StaffSpawn[] = [
  { id: "m1", kind: "seguranca", name: "Jonas", room: "entrada", post: { pos: { x: 2.7, z: 15.2 }, yaw: 0 } },
  { id: "m2", kind: "seguranca", name: "Marta", room: "salao", route: [{ x: -10, z: 12.5 }, { x: -10, z: -4 }, { x: -5, z: -4 }, { x: -5, z: 12.5 }] },
  { id: "m3", kind: "seguranca", name: "Téo", room: "galeria", route: [{ x: -9, z: -8.5 }, { x: -9, z: -20.5 }, { x: 9, z: -20.5 }, { x: 9, z: -8.5 }], blackoutCheck: true },
  { id: "m4", kind: "seguranca", name: "Bia", room: "terraco", route: [{ x: 14.5, z: -9 }, { x: 19.5, z: -9 }, { x: 19, z: -17 }, { x: 14.5, z: -17 }] },
  { id: "e1", kind: "equipe", name: "Sasha", room: "bastidores", route: [{ x: 15.6, z: 0.8 }, { x: 20, z: -3.6 }, { x: 16.4, z: -3.2 }] },
  { id: "e2", kind: "equipe", name: "Rui", room: "servico", route: [{ x: -17, z: 14.6 }, { x: -17, z: -4.6 }, { x: -14, z: 2 }] },
  { id: "e3", kind: "equipe", name: "Gil", room: "doca", route: [{ x: -10, z: 19 }, { x: -16.5, z: 18.6 }, { x: -14, z: 22.3 }] },
];

const Q = Math.PI / 4;
/** Câmeras da casa: só contam em áreas da equipe e privadas; a falta de luz desliga as da sala afetada. */
export const CAMERAS: CameraDef[] = [
  { id: "c1", pos: { x: -13, z: 15.6 }, yaw: Math.PI, sweep: 0.35, room: "servico" },
  { id: "c2", pos: { x: 12.9, z: 3.6 }, yaw: 3 * Q, sweep: 0.45, room: "bastidores" },
  { id: "c3", pos: { x: -12.9, z: -21.6 }, yaw: -Q, sweep: 0.4, room: "conservacao" },
];

export const INTERACTS: InteractDef[] = [
  { id: "placard1", kind: "inspect", ref: "placard1", pos: { x: -6.5, z: -12.7 }, room: "galeria", radius: 1.3 },
  { id: "placard2", kind: "inspect", ref: "placard2", pos: { x: 6.5, z: -12.7 }, room: "galeria", radius: 1.3 },
  { id: "placard3", kind: "inspect", ref: "placard3", pos: { x: -2.2, z: -15.2 }, room: "galeria", radius: 1.1 },
  { id: "placard4", kind: "inspect", ref: "placard4", pos: { x: -10, z: -12 }, room: "galeria", radius: 1.3 },
  { id: "case", kind: "case", pos: { x: 0, z: -15.2 }, room: "galeria", radius: 1.2 },
  { id: "sketchbook", kind: "inspect", ref: "sketchbook", pos: { x: 15.6, z: 7.3 }, room: "lounge", radius: 1.1 },
  { id: "styling", kind: "styling", pos: { x: 13.3, z: 5.7 }, room: "lounge", radius: 1.2 },
  { id: "callsheet", kind: "desk", pos: { x: 15.6, z: 1.2 }, room: "bastidores", radius: 1.3 },
  { id: "manifest", kind: "board", pos: { x: -16.5, z: 15.4 }, room: "servico", radius: 1.2 },
  { id: "keypad", kind: "keypad", ref: "service", pos: { x: -19, z: 17.1 }, room: "doca", radius: 1.3 },
  { id: "medcab", kind: "medcab", pos: { x: -13.4, z: 6 }, room: "servico", radius: 1.2 },
  { id: "crates", kind: "puzzle", ref: "lighting", pos: { x: -17.2, z: -16.4 }, room: "conservacao", radius: 1.8 },
  { id: "vanCrates", kind: "crate", pos: { x: -16.9, z: 19.6 }, room: "doca", radius: 1.4 },
  { id: "doorC", kind: "door", ref: "conservation", pos: { x: -11.3, z: -15 }, room: "galeria", radius: 1.1 },
  { id: "climbT", kind: "climb", ref: "beiral", pos: { x: 19.5, z: -21.4 }, room: "terraco", radius: 1.2 },
  { id: "climbTout", kind: "climb", ref: "terraco", pos: { x: 19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbC", kind: "climb", ref: "conservacao", pos: { x: -19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbCin", kind: "climb", ref: "beiral", pos: { x: -19.5, z: -21.4 }, room: "conservacao", radius: 1.2 },
  { id: "deliver", kind: "deliver", pos: STAGE_POS, room: "salao", radius: 1.6 },
];
/** Do ponto de escalada ao outro lado da janela (a travessia leva a jogadora pelo vão). */
export const CLIMB_TO: Record<string, Vec> = { climbT: { x: 19.5, z: -23 }, climbTout: { x: 19.5, z: -21.4 }, climbC: { x: -19.5, z: -21.4 }, climbCin: { x: -19.5, z: -23 } };

/** Pontos da fuga com o original (conservação → galeria → salão) onde a sabotagem arma os perigos. */
export const ESCAPE_HAZARDS: { kind: "rig" | "steam" | "sprinkler"; pos: Vec; r: number }[] = [
  { kind: "sprinkler", pos: { x: -16, z: -12.5 }, r: 1.6 }, { kind: "steam", pos: { x: -13.4, z: -15 }, r: 1.2 },
  { kind: "rig", pos: { x: -7.5, z: -15.5 }, r: 1.4 }, { kind: "rig", pos: { x: -3, z: -11.5 }, r: 1.4 }, { kind: "sprinkler", pos: { x: 3.6, z: -9 }, r: 1.7 },
  { kind: "rig", pos: { x: 0, z: -6.25 }, r: 1.3 }, { kind: "steam", pos: { x: 3, z: -3 }, r: 1.3 }, { kind: "rig", pos: { x: 6.5, z: 0.8 }, r: 1.4 },
];
