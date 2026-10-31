/*
 * MET Gala Heist v2 — o que a cena 3D lê da simulação a cada quadro (sem React a cada passo): pessoas, portas, lasers,
 * tiros e o estado do alarme. A simulação escreve neste objeto depois de cada passo (sim.ts → writeView) e os componentes
 * de cena leem dentro do useFrame. Nada aqui volta para a simulação.
 */
import type { Anim, DoorId, Hold, LookId, RoomId } from "./types";

export interface ActorView {
  id: string; kind: "player" | "guard" | "civ";
  /** aparência (catálogo looks.ts) e semente da variação (pele, cabelo, cor do vestido, altura) */
  look: LookId | "player"; seed: number;
  /** posição dos pés (y = piso ou o que a pessoa pisa) e direção do corpo */
  x: number; y: number; z: number; yaw: number;
  /** velocidade no plano (m/s): a passada da caminhada/corrida acompanha */
  speed: number;
  anim: Anim; animT: number;
  hold: Hold;
  /** inclinação da mira (rad, + para cima) e para onde a cabeça olha (convidados olham a jogadora) */
  aimPitch: number; lookAt: { x: number; y: number; z: number } | null;
  /** instante (tempo da simulação) do último tiro levado — recuo/estremecer; −1 = nunca */
  hitAt: number;
  /** cansaço 0–1 (vida baixa): passada arrastada, ombros caídos, respiração pesada */
  tired: number;
  room: RoomId; visible: boolean;
}
export interface ShotFx { at: number; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; hit: boolean; by: "player" | "guard"; silenced: boolean }
export interface SceneView {
  time: number; actors: ActorView[]; player: ActorView; playerRoom: RoomId;
  /** portas fisicamente abertas (folha aberta) */
  doors: Record<DoorId, boolean>;
  /** lasers da Sala das Joias: ligados agora (por id) e se o quadro de luz foi cortado */
  lasers: Record<string, boolean>; lasersPowered: boolean;
  alarm: boolean; alarmAt: number;
  /** Visão (carta de óculos): contorno das pessoas e lasers através das paredes */
  vision: boolean;
  shots: ShotFx[];
  /** itens no chão (chave, cartão, pistola de quem caiu) e o diamante no pedestal */
  drops: { id: string; kind: string; x: number; y: number; z: number }[]; diamondOnPedestal: boolean;
  /** câmera da cena (a simulação/controle escreve; a cena só lê) */
  slowMo: number;
  /** opção "reduzir clarões" (escrita pelo jogo, não pela simulação): alarme aceso sem piscar, clarões fracos */
  calm: boolean;
}

export function emptyView(): SceneView {
  const player: ActorView = { id: "player", kind: "player", look: "player", seed: 0, x: 0, y: 0, z: 0, yaw: 0, speed: 0, anim: "idle", animT: 0, hold: null, aimPitch: 0, lookAt: null, hitAt: -1, tired: 0, room: "rua", visible: true };
  return { time: 0, actors: [], player, playerRoom: "rua", doors: {} as Record<DoorId, boolean>, lasers: {}, lasersPowered: true, alarm: false, alarmAt: -1, vision: false, shots: [], drops: [], diamondOnPedestal: true, slowMo: 1, calm: false };
}
