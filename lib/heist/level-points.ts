/* MET Gala Heist v2 — pontos da planta: início, diamante, entrada dos reforços, checkpoints, fila, caminho de entrada e os carros da fuga. */
import type { RoomId, Vec } from "./types";

export const PLAYER_SPAWN: Vec = { x: -18, z: 47.6 };
export const PLAYER_SPAWN_YAW = Math.PI;
/** Onde a cena do diamante acontece e de onde os seguranças entram. */
export const DIAMOND_POS: Vec = { x: -17.25, z: -14.25 };
export const VAULT_ENTRY: Vec = { x: -11.4, z: -15 };
/** Pontos de checkpoint (ao entrar na sala, a partida salva ali). */
export const CHECKPOINTS: Record<string, { room: RoomId; pos: Vec; yaw: number }> = {
  start: { room: "rua", pos: PLAYER_SPAWN, yaw: PLAYER_SPAWN_YAW },
  vestibulo: { room: "vestibulo", pos: { x: 0, z: 22.6 }, yaw: Math.PI },
  salao: { room: "salao", pos: { x: 0, z: 12.6 }, yaw: Math.PI },
  servico: { room: "servico", pos: { x: -19.2, z: 15.2 }, yaw: Math.PI },
  terraco: { room: "terraco", pos: { x: 20.6, z: -14 }, yaw: -Math.PI / 2 },
  cofre: { room: "cofre", pos: { x: -14, z: -15 }, yaw: -Math.PI / 2 },
  fuga: { room: "cofre", pos: { x: -16.2, z: -13.4 }, yaw: Math.PI / 2 },
};

/** Fila na calçada (do portão para o leste) e o caminho de quem entra: portão → tapete → portas → salão. */
export const QUEUE_SLOTS: Vec[] = Array.from({ length: 9 }, (_, i) => ({ x: 2.9 + i * 1.3, z: 31.95 }));
export const ENTRY_PATH: Vec[] = [{ x: 0, z: 32.2 }, { x: 0, z: 30.6 }, { x: 0, z: 25 }, { x: 0, z: 22.6 }, { x: 0, z: 16 }, { x: 0, z: 13.2 }];

/** Os dois carros da fuga. Chegar a qualquer um com o diamante encerra a missão. */
export const EXITS: { id: string; pos: Vec; room: RoomId }[] = [{ id: "carWest", pos: { x: -25.3, z: 37.9 }, room: "rua" }, { id: "carEast", pos: { x: 25.5, z: 8.5 }, room: "beco" }];
