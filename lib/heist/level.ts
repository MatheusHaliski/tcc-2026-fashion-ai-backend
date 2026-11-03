/*
 * MET Gala Heist v2 — planta do Museu Vesper na noite da Gala Lumière (ficcional). O jogo começa do outro lado da avenida,
 * entre os fãs, e o diamante de Celine Dion está na Sala das Joias, no fundo do prédio.
 *
 *  z −23 ═══════════════════ beiral (cornija externa) ═══════════════════
 *  z −22 ┌─janela──┬──────────────────────┬──janela──┐┌──────┐
 *        │  SALA   │  INSTITUTO DO TRAJE  │ TERRAÇO  ││      │ escada de incêndio
 *        │DAS JOIAS│  (exposição)         │ JARDIM   ├┤ BECO │ (só escalando)
 *  z −6  ├──duto───┼───────┤vão├──────────┼─equipe───┤│      │
 *        │LABIRINTO│                      │BASTIDORES││      │
 *        │   DE    │    GRANDE SALÃO      ├─porta────┤│      │
 *        │ SERVIÇO │ (arranjo floral)     │ LOUNGE   ││      │
 *  z 14  │ (sala da├────┤detector├────────┤ E BAR    ││      │
 *  z 16  ├─teclado─┤  VESTÍBULO E         └──────────┘│      │
 *        │  DOCA   │  CREDENCIAMENTO                  │      │
 *  z 24  └─portão──┴─────portas──────────────────────────────┘
 *  z 24.5          ESCADARIA (tapete, fotógrafos, imprensa)    calçada
 *  z 31            portão do tapete (recepcionista) · fila ─────
 *  z 33  ═══ meio-fio ═══ limusines ═══ caminhão do bufê ═══ viatura
 *  z 43  ═══ grades ═══ fãs ═══ (faixa de pedestre a oeste)
 *  z 50  barraca do revendedor · ponto de partida
 *       x −30      −22      −12       0        12       22   30
 *
 * Alturas: o prédio inteiro fica em y = 0; a calçada em −1,6 e a pista em −1,75. A escadaria sobe da calçada até as
 * portas e a doca tem uma rampa até a rua (floorY). Paredes internas do labirinto vêm de uma geração com semente
 * (sempre a mesma) com alguns laços, para haver mais de um caminho e rotas de ronda.
 */
import type { DoorDef, Room, RoomId, Vec } from "./types";

/** Ordem importa: a sala de segurança (dentro do labirinto) vem antes do serviço; roomAt devolve a primeira que contém. */
export const ROOMS: Room[] = [
  { id: "seguranca", rect: { x0: -22, z0: 2, x1: -18.5, z1: 7.5 }, access: "private", floor: "concrete", tier: 7 },
  { id: "servico", rect: { x0: -22, z0: -6, x1: -12.5, z1: 16 }, access: "staff", floor: "concrete", tier: 7 },
  { id: "cofre", rect: { x0: -22, z0: -22, x1: -12.5, z1: -6.5 }, access: "private", floor: "marble", tier: 9 },
  { id: "galeria", rect: { x0: -12, z0: -22, x1: 12, z1: -6.5 }, access: "public", floor: "parquet", tier: 5 },
  { id: "terraco", rect: { x0: 12.5, z0: -22, x1: 22, z1: -6.5 }, access: "public", floor: "stone", tier: 6, outdoor: true },
  { id: "bastidores", rect: { x0: 12.5, z0: -6, x1: 22, z1: 4 }, access: "staff", floor: "parquet", tier: 6 },
  { id: "lounge", rect: { x0: 12.5, z0: 4.5, x1: 22, z1: 14 }, access: "public", floor: "carpet", tier: 5 },
  { id: "salao", rect: { x0: -12, z0: -6, x1: 12, z1: 14 }, access: "public", floor: "marble", tier: 4 },
  { id: "vestibulo", rect: { x0: -8, z0: 14.5, x1: 8, z1: 24 }, access: "public", floor: "marble", tier: 3 },
  { id: "doca", rect: { x0: -22, z0: 16.5, x1: -8.5, z1: 24 }, access: "staff", floor: "concrete", tier: 4 },
  { id: "beiral", rect: { x0: -21, z0: -23.5, x1: 21, z1: -22.5 }, access: "private", floor: "stone", tier: 7, outdoor: true },
  { id: "beco", rect: { x0: 22.5, z0: -22, x1: 30, z1: 24.5 }, access: "street", floor: "asphalt", tier: 3, outdoor: true },
  { id: "rua", rect: { x0: -30, z0: 24.5, x1: 30, z1: 50.5 }, access: "street", floor: "sidewalk", tier: 3, outdoor: true },
];

/** Luz de cada sala (0–1): no escuro, quem está longe é reconhecido mais devagar (MH-06-03). A Sala das Joias fica na
 * penumbra quando o quadro de luz é cortado. */
export const ROOM_LIGHT: Record<RoomId, number> = {
  rua: 0.95, beco: 0.4, vestibulo: 1, salao: 0.85, galeria: 0.65, lounge: 0.7, terraco: 0.5, beiral: 0.3, bastidores: 0.9,
  servico: 0.55, seguranca: 0.9, doca: 0.6, cofre: 0.8,
};

/** Nome da sala para o HUD (chave de tradução) e o nível dos seguranças (tiros de pistola comum para derrubar). */
export const ROOM_TIER = Object.fromEntries(ROOMS.map((r) => [r.id, r.tier])) as Record<RoomId, number>;

export const DOORS: DoorDef[] = [
  { id: "carpetGate", rect: { x0: -1.5, z0: 31, x1: 1.5, z1: 31.5 }, lock: "invite", between: ["rua", "rua"] },
  { id: "front", rect: { x0: -2, z0: 24, x1: 2, z1: 24.5 }, lock: "open", between: ["rua", "vestibulo"] },
  { id: "dockGate", rect: { x0: -21, z0: 24, x1: -17, z1: 24.5 }, lock: "key", keyId: "doca", between: ["rua", "doca"] },
  { id: "side", rect: { x0: -8.5, z0: 20, x1: -8, z1: 22.5 }, lock: "staff", between: ["doca", "vestibulo"], freeFrom: "doca" },
  { id: "main", rect: { x0: -2, z0: 14, x1: 2, z1: 14.5 }, lock: "wristband", between: ["salao", "vestibulo"], freeFrom: "salao" },
  { id: "service", rect: { x0: -20, z0: 16, x1: -18, z1: 16.5 }, lock: "keypad", between: ["servico", "doca"], freeFrom: "servico" },
  { id: "staff", rect: { x0: -12.5, z0: 9, x1: -12, z1: 11 }, lock: "key", keyId: "servico", between: ["servico", "salao"], freeFrom: "servico" },
  { id: "lounge", rect: { x0: 12, z0: 9, x1: 12.5, z1: 11 }, lock: "open", between: ["salao", "lounge"] },
  { id: "backstage", rect: { x0: 16, z0: 4, x1: 18, z1: 4.5 }, lock: "open", between: ["bastidores", "lounge"] },
  { id: "stage", rect: { x0: 12, z0: -3, x1: 12.5, z1: -1 }, lock: "staff", between: ["salao", "bastidores"], freeFrom: "bastidores" },
  { id: "gallery", rect: { x0: -2, z0: -6.5, x1: 2, z1: -6 }, lock: "open", between: ["galeria", "salao"] },
  { id: "vault", rect: { x0: -12.5, z0: -16, x1: -12, z1: -14 }, lock: "keycard", between: ["cofre", "galeria"], freeFrom: "cofre" },
  { id: "terrace", rect: { x0: 12, z0: -16, x1: 12.5, z1: -14 }, lock: "open", between: ["galeria", "terraco"] },
  { id: "staffTerrace", rect: { x0: 16, z0: -6.5, x1: 18, z1: -6 }, lock: "open", between: ["terraco", "bastidores"] },
  { id: "vent", rect: { x0: -18, z0: -6.5, x1: -17, z1: -6 }, lock: "vent", between: ["cofre", "servico"] },
  { id: "secDoor", rect: { x0: -18.5, z0: 4, x1: -18, z1: 5.5 }, lock: "open", between: ["seguranca", "servico"] },
  { id: "windowT", rect: { x0: 19, z0: -22.5, x1: 20, z1: -22 }, lock: "climb", between: ["beiral", "terraco"] },
  { id: "windowC", rect: { x0: -20, z0: -22.5, x1: -19, z1: -22 }, lock: "climb", between: ["beiral", "cofre"] },
  { id: "fireEscape", rect: { x0: 22, z0: -15, x1: 22.5, z1: -13 }, lock: "climb", between: ["terraco", "beco"] },
];

/** Araras de roupa: esconderijo (entra e sai com a interação) e lugar para trocar de roupa sem ser vista. */
export const RACKS: { id: string; pos: Vec; room: RoomId; yaw: number }[] = [
  { id: "rack-b1", pos: { x: 13.8, z: -1.6 }, room: "bastidores", yaw: Math.PI / 2 }, { id: "rack-b2", pos: { x: 19.2, z: 2.6 }, room: "bastidores", yaw: Math.PI },
  { id: "rack-v1", pos: { x: 7.2, z: 18.6 }, room: "vestibulo", yaw: -Math.PI / 2 }, { id: "rack-d1", pos: { x: -15.8, z: 22.6 }, room: "doca", yaw: Math.PI },
  { id: "rack-r1", pos: { x: -25.4, z: 49.6 }, room: "rua", yaw: Math.PI },
];

/** Lasers da Sala das Joias em volta do pedestal: high = passa agachada; full = só desligado. Ligam e desligam em ciclo. */
export interface LaserDef { id: string; a: Vec; b: Vec; height: "high" | "full"; on: number; off: number; phase: number }
export const LASERS: LaserDef[] = [
  { id: "L1", a: { x: -20.6, z: -10.9 }, b: { x: -13.9, z: -10.9 }, height: "full", on: 2.6, off: 1.6, phase: 0 },
  { id: "L2", a: { x: -20.6, z: -17.6 }, b: { x: -13.9, z: -17.6 }, height: "full", on: 2.6, off: 1.6, phase: 2.1 },
  { id: "L3", a: { x: -13.9, z: -17.6 }, b: { x: -13.9, z: -10.9 }, height: "high", on: 99, off: 0, phase: 0 },
  { id: "L4", a: { x: -20.6, z: -17.6 }, b: { x: -20.6, z: -10.9 }, height: "full", on: 3.2, off: 1.4, phase: 1 },
  { id: "L5", a: { x: -16, z: -12.4 }, b: { x: -18.5, z: -16.1 }, height: "high", on: 1.8, off: 1.8, phase: 0.6 },
];

/* ---------- o resto da planta, por responsabilidade (level-*.ts) ---------- */
export { MAZE, mazeWalls, mazeCell, INNER_WALLS } from "./level-maze";
export { SIDEWALK_Y, ROAD_Y, CURB_Z, FAR_CURB_Z, STAIRS, DOCK_RAMP, floorY } from "./level-floor";
export { baseProps } from "./level-props";
export { PLAYER_SPAWN, PLAYER_SPAWN_YAW, DIAMOND_POS, VAULT_ENTRY, CHECKPOINTS, QUEUE_SLOTS, ENTRY_PATH, EXITS } from "./level-points";
export { GUARDS, CIVILIANS } from "./level-people";
export { INTERACTS, CLIMB_TO, STASH_REWARD, CODES, RING_SYMBOLS, VENDOR_OFFERS } from "./level-interacts";
