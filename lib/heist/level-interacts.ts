/* MET Gala Heist v2 — pontos de interação fixos, travessias de escalada, esconderijos com recompensa, códigos e as ofertas dos revendedores. */
import type { InteractDef, Vec, VendorId, VendorOffer } from "./types";
import { EXITS } from "./level-points";

/* ---------- interações fixas ---------- */
export const INTERACTS: InteractDef[] = [
  { id: "vendorStreet", kind: "vendor", ref: "street", pos: { x: -28.2, z: 46.4 }, room: "rua", radius: 1.5 },
  { id: "vendorBar", kind: "vendor", ref: "bar", pos: { x: 19.2, z: 9.5 }, room: "lounge", radius: 1.4 },
  { id: "hostess", kind: "hostess", pos: { x: 0, z: 32.3 }, room: "rua", radius: 1.6 },
  { id: "uniformTruck", kind: "uniform", ref: "truck", pos: { x: -22.8, z: 34.9 }, room: "rua", radius: 1.2 },
  { id: "lockerUniform", kind: "uniform", ref: "locker", pos: { x: -12.95, z: 0.75 }, room: "servico", radius: 1 },
  { id: "dockIntercom", kind: "intercom", ref: "dockGate", pos: { x: -16.4, z: 25.1 }, room: "rua", radius: 1.2 },
  { id: "posterAurora", kind: "inspect", ref: "posterAurora", pos: { x: -11.4, z: 7 }, room: "salao", radius: 1.4 },
  { id: "callsheet", kind: "inspect", ref: "callsheet", pos: { x: 15.6, z: 1.2 }, room: "bastidores", radius: 1.3 },
  { id: "placardStars", kind: "inspect", ref: "placardStars", pos: { x: -6.5, z: -12.7 }, room: "galeria", radius: 1.3 },
  { id: "keypadService", kind: "keypad", ref: "service", pos: { x: -19, z: 17.1 }, room: "doca", radius: 1.3 },
  { id: "safe", kind: "safe", pos: { x: -19.7, z: 3.1 }, room: "seguranca", radius: 1.1 },
  { id: "fuses", kind: "fuses", pos: { x: -21.2, z: 4.75 }, room: "seguranca", radius: 1.1 },
  { id: "pedestal", kind: "pedestal", pos: { x: -16.2, z: -14.25 }, room: "cofre", radius: 1.2 },
  { id: "doorVault", kind: "door", ref: "vault", pos: { x: -11.4, z: -15 }, room: "galeria", radius: 1.1 },
  { id: "doorStaff", kind: "door", ref: "staff", pos: { x: -11.4, z: 10 }, room: "salao", radius: 1.1 },
  { id: "doorDock", kind: "door", ref: "dockGate", pos: { x: -19, z: 25.2 }, room: "rua", radius: 1.4 },
  { id: "fireUp", kind: "climb", ref: "fireUp", pos: { x: 23.6, z: -14 }, room: "beco", radius: 1.2 },
  { id: "fireDown", kind: "climb", ref: "fireDown", pos: { x: 21.4, z: -14 }, room: "terraco", radius: 1.2 },
  { id: "climbT", kind: "climb", ref: "climbT", pos: { x: 19.5, z: -21.4 }, room: "terraco", radius: 1.2 },
  { id: "climbTout", kind: "climb", ref: "climbTout", pos: { x: 19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbC", kind: "climb", ref: "climbC", pos: { x: -19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbCin", kind: "climb", ref: "climbCin", pos: { x: -19.5, z: -21.4 }, room: "cofre", radius: 1.2 },
  // esconderijos com recompensa para quem explora (MH-02-13)
  { id: "stashBeco", kind: "stash", ref: "stashBeco", pos: { x: 27.8, z: -2.8 }, room: "beco", radius: 1.1 },
  { id: "stashMakeup", kind: "stash", ref: "stashMakeup", pos: { x: 19.9, z: -1.5 }, room: "bastidores", radius: 1 },
  { id: "stashMaze", kind: "stash", ref: "stashMaze", pos: { x: -21.25, z: -5.25 }, room: "servico", radius: 1 },
  { id: "stashTerrace", kind: "stash", ref: "stashTerrace", pos: { x: 14.9, z: -19.7 }, room: "terraco", radius: 1 },
  { id: "stashDock", kind: "stash", ref: "stashDock", pos: { x: -10.3, z: 22.1 }, room: "doca", radius: 1 },
  // joias expostas (vitrines da Sala das Joias, com sensor enquanto há energia) e a peça guardada na chapelaria
  { id: "caseJ1", kind: "jewelCase", ref: "caseJ1", pos: { x: -20.5, z: -18.5 }, room: "cofre", radius: 1 },
  { id: "caseJ2", kind: "jewelCase", ref: "caseJ2", pos: { x: -20.5, z: -10.5 }, room: "cofre", radius: 1 },
  { id: "caseJ3", kind: "jewelCase", ref: "caseJ3", pos: { x: -13.55, z: -20.5 }, room: "cofre", radius: 1 },
  { id: "caseJ4", kind: "jewelCase", ref: "caseJ4", pos: { x: -19.75, z: -20.6 }, room: "cofre", radius: 1 },
  { id: "coatRack", kind: "coatRack", ref: "coatRack", pos: { x: 7.2, z: 20.4 }, room: "vestibulo", radius: 1 },
  { id: "carWest", kind: "exit", ref: "carWest", pos: EXITS[0].pos, room: "rua", radius: 1.6 },
  { id: "carEast", kind: "exit", ref: "carEast", pos: EXITS[1].pos, room: "beco", radius: 1.6 },
];
/** De cada ponto de escalada até o outro lado (a travessia leva a jogadora pela janela ou pela escada de incêndio). */
export const CLIMB_TO: Record<string, { to: Vec; dur: number }> = {
  fireUp: { to: { x: 21.4, z: -14 }, dur: 3.2 }, fireDown: { to: { x: 23.6, z: -14 }, dur: 2.6 },
  climbT: { to: { x: 19.5, z: -23 }, dur: 1.6 }, climbTout: { to: { x: 19.5, z: -21.4 }, dur: 1.6 },
  climbC: { to: { x: -19.5, z: -21.4 }, dur: 1.6 }, climbCin: { to: { x: -19.5, z: -23 }, dur: 1.6 },
};

/** O que cada esconderijo guarda. */
export const STASH_REWARD: Record<string, { ammo?: number; bottles?: number; medkit?: number; decoder?: number; bandage?: number }> = {
  stashBeco: { ammo: 12, bottles: 1 }, stashMakeup: { medkit: 1 }, stashMaze: { decoder: 1 }, stashTerrace: { bandage: 1 }, stashDock: { bottles: 2 },
};

/** Códigos (pistas na planta: cartaz do Aurora no salão e a folha de chamada nos bastidores) e a combinação da vitrine
 * do diamante (placa da exposição). */
export const CODES = { service: "1957", safe: "0412", rings: [2, 0, 3] as number[] };
/** Símbolos dos anéis da vitrine do diamante (a placa da exposição mostra a ordem: estrela, lua, coroa). */
export const RING_SYMBOLS = ["lua", "coracao", "estrela", "coroa"] as const;

/* ---------- revendedores: troca de roupa por recursos ---------- */
/** Preço em créditos (o valor das peças entregues) e, para as armas, o valor mínimo de uma única peça ("só troco a
 * pistola por peça de grife"). O revendedor da rua não vende o que o detector do vestíbulo pegaria? Vende — e avisa. */
export const VENDOR_OFFERS: Record<VendorId, VendorOffer[]> = {
  street: [
    { item: "medkit", price: 25, stock: 3 }, { item: "ammo", price: 20, stock: 4 }, { item: "knife", price: 40, minPiece: 30, stock: 1 },
    { item: "pistol", price: 90, minPiece: 55, stock: 1 }, { item: "uniform", price: 30, stock: 1 }, { item: "invite", price: 70, minPiece: 45, stock: 1 },
    { item: "bottle", price: 8, stock: 4 },
  ],
  bar: [
    { item: "medkit", price: 25, stock: 2 }, { item: "medkitXL", price: 50, stock: 1 }, { item: "ammo", price: 20, stock: 4 },
    { item: "pistolS", price: 130, minPiece: 75, stock: 1 }, { item: "vest", price: 70, minPiece: 50, stock: 1 }, { item: "decoder", price: 35, stock: 1 },
  ],
};
