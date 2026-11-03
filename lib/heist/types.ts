/*
 * MET Gala Heist v2 — tipos da simulação. O evento é a Gala Lumière no Museu Vesper (ficcional, com a cara de uma gala de
 * moda num museu de avenida: fachada neoclássica, escadaria com tapete, Grande Salão com o arranjo floral, exposição de
 * moda). O objetivo final é o diamante de Celine Dion (US$ 15 mil), emprestado para a exposição.
 *
 * Tudo é dado simples (sem classes): o estado inteiro cabe num structuredClone (checkpoint) e o mundo estático (salas,
 * paredes, grade de navegação) fica fora dele, compartilhado.
 *
 * Eixos: x para leste, z para sul (a avenida fica ao sul da fachada), metros, y para cima. Direção `yaw` θ aponta para
 * (sin θ, cos θ) — o mesmo que rotation.y de um modelo que olha para +z no three.js.
 */
import type { DoorId, KeyId, RoomId, Vec } from "./types-level";
import type { Civilian, DetectReason, Guard, LootItem } from "./types-people";

/* ---------- planta e personagens (types-level.ts, types-people.ts) ---------- */
export type { Vec, RoomId, DoorId, DoorLock, KeyId, Rect, Shape, Height, PropKind, Prop, Access, Floor, Room, DoorDef, InteractKind, InteractDef } from "./types-level";
export type { LookId, CivRole, Persona, JewelKind, Jewel, LootItem, Anim, Hold, GuardRole, GuardState, GuardSpawn, Guard, DetectReason, CivSpawn, Civilian } from "./types-people";

/* ---------- cartas, roupa e itens ---------- */
export type CardTier = "BRONZE" | "PRATA" | "OURO" | "ESPECIAL";
/** O que a carta é na partida: peça para vestir (com disfarce), acessório com uso próprio ou só valor de troca. */
export type CardUse =
  | "WEAR"        // roupa e calçado: veste a jogadora (com a animação de troca)
  | "VISION"      // óculos: Visão (seguranças, lasers e marcas através das paredes)
  | "PICK"        // joias: grampo (abre teclado, cofre e a trava da vitrine)
  | "AMMO"        // bolsas: pentes escondidos (recarrega a munição)
  | "KNIFE"       // cinto: coldre com faca
  | "TIME"        // relógio: cronômetro (tempo mais lento por alguns segundos)
  | "BANDAGE"     // lenço: curativo (recupera vida)
  | "HOOD"        // chapéu, boné, gorro: rosto coberto (reconhecem mais de perto)
  | "TRADE";      // sem uso direto: só valor de troca
export interface HeistCard {
  id: string; name: string; tier: CardTier; value: number; use: CardUse; category: string; subcategory: string;
  imageUrl?: string | null; colorHex?: string | null; brandName?: string | null; rarity: string;
  /** peça para vestir: o que ela vira no corpo (Look3dPiece do provador) */
  slot?: "TOP" | "BOTTOM" | "FULL" | "SHOES" | "ACCESSORY";
  /** disfarce que a peça dá e o calçado (salto faz barulho e não escala) */
  dress?: "gala" | "casual" | "staff"; shoes?: "heels" | "flat" | "sneakers" | "boots";
  /** carta especial/inicial: veio do kit da partida, não da coleção */
  starter?: boolean;
}
export type CardState = "DECK" | "WORN" | "USED" | "TRADED";
export type WeaponId = "hands" | "knife" | "pistol" | "pistolS" | "guardPistol";
export type DialogueId = "hostess" | "curator" | "bartender" | "cateringChief" | "celebrity";
export type Difficulty = "facil" | "normal" | "dificil" | "lenda";
/** Desafios (MH-12): Ghost Heist (sem ser detectada), Diamond Run (diamante em 6 min), Midnight Escape (fuga em 2 min depois
 * do alarme), Social Chameleon (chegar à Sala das Joias sem combate e trocando de roupa). */
export type ChallengeId = "ghost" | "diamondRun" | "midnight" | "chameleon";
export type OptionalId = "loot3" | "noKills" | "unseen" | "clues" | "ownLook" | "secrets";
export type EndingId = "fantasma" | "profissional" | "implacavel" | "barulhenta";
export type ItemId = "medkit" | "medkitXL" | "ammo" | "knife" | "pistol" | "pistolS" | "uniform" | "invite" | "decoder" | "bottle" | "vest";
export type VendorId = "street" | "bar";
export interface VendorOffer { item: ItemId; price: number; minPiece?: number; stock: number }
export type Disguise = "gala" | "casual" | "staff";

/* ---------- jogadora ---------- */
export type PlayerMode = "WALK" | "CLIMB" | "CRAWL" | "HIDDEN" | "CHANGE" | "CUTSCENE" | "DOWNED";
export interface PlayerAction { kind: "change" | "climb" | "pickpocket" | "takedown" | "melee" | "reload" | "heal" | "interact" | "celebrate" | "pickup" | "dodge" | "loot"; t: number; dur: number; from?: Vec; to?: Vec; ref?: string; fromY?: number; toY?: number; done?: boolean; item?: string }
export interface Inventory {
  invite: boolean; wristband: boolean; keycard: boolean; keys: KeyId[]; diamond: boolean;
  medkit: number; medkitXL: number; bandage: number; bottles: number; decoder: number; vest: number;
  weapons: WeaponId[]; ammo: number; mag: number; uniform: boolean;
  loot: LootItem[];
}
export interface Player {
  pos: Vec; vel: Vec; y: number; yaw: number; hp: number; maxHp: number; armor: number;
  crouch: boolean; sprint: boolean; discreet: boolean; aiming: boolean; mode: PlayerMode; action: PlayerAction | null;
  weapon: WeaponId; nextFireAt: number; reloadUntil: number; meleeUntil: number; combo: number; lastHitAt: number; lastShotAt: number;
  inv: Inventory; hidden: string | null; disguise: Disguise; shoes: "heels" | "flat" | "sneakers" | "boots"; hood: boolean;
  /** peças vestidas: ids das cartas (ou das peças da partida) por lugar */
  outfit: { base: "arrival" | "uniform"; worn: string[] };
  visionUntil: number; slowUntil: number; credits: Record<VendorId, number>;
  /** tropeço/recuo quando leva tiro */
  staggerUntil: number; noiseAt: number; noise: number; changeSeen: boolean;
  /** última sala fora das portas (de que lado da porta ela está) e a velocidade real no plano */
  lastRoom: RoomId; speed: number;
  /** esquiva: invulnerável a tiro até iframesUntil; pronta de novo em dodgeReadyAt */
  iframesUntil: number; dodgeReadyAt: number;
  /** quem acertou o último tiro (a tela de game over diz a causa) */
  lastDamageBy: string | null;
}

/* ---------- puzzles ---------- */
export type PuzzleKind = "keypad" | "safe" | "fuses" | "rings";
export interface PuzzleSession { kind: PuzzleKind; id: string; input: string; lights: boolean[]; rings: number[]; mistakes: number; hints: number; solved: boolean; startedAt: number }

/* ---------- objetivos ---------- */
export type ObjectiveId = "ENTER" | "ROUTE" | "LASERS" | "DIAMOND" | "ESCAPE" | "DONE";
export type Phase = "INFILTRATE" | "CUTSCENE" | "ESCAPE" | "WON" | "LOST";

export type HeistEvent =
  | { t: "line"; who: string; key: string; vars?: Record<string, string | number> }
  | { t: "toast"; key: string; vars?: Record<string, string | number> }
  | { t: "sfx"; id: string; pos?: Vec; gain?: number }
  | { t: "shot"; from: Vec; to: Vec; fromY: number; toY: number; hit: boolean; by: "player" | "guard"; silenced?: boolean }
  | { t: "hit"; damage: number; on: "player" | string; head?: boolean; pos: Vec }
  | { t: "down"; id: string; killed: boolean }
  | { t: "outfit"; pieces: string[] }
  | { t: "objective"; id: ObjectiveId }
  | { t: "alarm"; on: boolean }
  | { t: "checkpoint"; reason: string }
  | { t: "rumble"; strong: number; weak: number; ms: number }
  | { t: "puzzle"; kind: PuzzleKind; result: "start" | "solved" | "mistake" | "close" }
  | { t: "door"; id: DoorId; open: boolean }
  | { t: "phase"; phase: Phase }
  | { t: "beat"; step: string; via: string }
  | { t: "detected"; by: string; reason: DetectReason }
  | { t: "loot"; item: LootItem }
  | { t: "challenge"; id: ChallengeId; result: "failed" | "done"; reason?: string };

/** Entrada de um quadro, já traduzida do teclado/mouse/controle. Bordas (…Press) valem um quadro. */
export interface HeistInput {
  /** analógico: x à direita, y para a frente (−1 a 1), relativo à câmera */
  move: { x: number; y: number }; camYaw: number; camPitch: number;
  /** direção do tiro da arma até o ponto sob a mira (a câmera fica sobre o ombro: o raio da mira não sai da arma) */
  aimYaw?: number; aimPitch?: number;
  sprint: boolean; crouchPress: boolean; discreet: boolean; interactPress: boolean; aim: boolean; fire: boolean; firePress: boolean;
  reloadPress: boolean; meleePress: boolean; healPress: boolean; throwPress: boolean;
  dodgePress?: boolean;
}

export interface Stats { shots: number; hits: number; headshots: number; kills: number; takedowns: number; damage: number; heals: number; traded: number; worn: number; spotted: number; puzzles: number; mistakes: number; time: number; route: string }

/** Enquadramento de câmera de uma cena curta (metros no mundo; de `from` para `to`, olhando de `look` para `lookTo`). */
export interface Shot { from: [number, number, number]; to: [number, number, number]; look: [number, number, number]; lookTo?: [number, number, number]; dur: number; fov?: number }
/** Cena curta de subobjetivo: enquadramentos em sequência e as falas com o segundo em que entram. */
export interface Beat { shots: Shot[]; lines: { at: number; who: string; key: string }[] }

export interface SimState {
  version: number; seed: number; rng: number; time: number; tick: number; phase: Phase; phaseAt: number;
  player: Player; guards: Guard[]; civs: Civilian[];
  doors: Record<DoorId, boolean>; /** portas destrancadas para a jogadora (a chave abre de vez) */ unlocked: DoorId[];
  cards: HeistCard[]; cardState: Record<string, CardState>; offers: Record<VendorId, VendorOffer[]>;
  puzzle: PuzzleSession | null; solved: PuzzleKind[]; fusesCut: boolean; lasersOn: boolean; alarm: boolean; alarmAt: number;
  objective: ObjectiveId; checkpoint: string; cutscene: { t: number; step: number } | null;
  /** pickups no chão (chave, cartão, pistola de quem caiu) */
  drops: { id: string; kind: "key" | "keycard" | "guardPistol" | "ammo"; keyId?: KeyId; pos: Vec; taken: boolean }[];
  /** ruídos que ainda vão soar (garrafa jogada cai depois de voar) */
  pending: { pos: Vec; at: number; r: number }[];
  /** usos que sobram de cada carta (Visão, Cronômetro) e pistas lidas */
  cardUses: Record<string, number>; clues: string[]; visited: RoomId[]; lockdown: boolean;
  /** quando a fila da calçada anda de novo */
  queueAt: number;
  /** nível de alerta do prédio (0–3): sobe com detecção, furto descoberto e corpo achado; cai devagar sem incidentes */
  alertLevel: number; alertAt: number;
  difficulty: Difficulty; challenge: ChallengeId | null; challengeFailed: string | null; challengeAt: number;
  /** opções que mudam a simulação (acessibilidade) */
  options: { slowLasers: boolean; regen: boolean; beats: boolean };
  /** esconderijos com recompensa já abertos e a conversa em andamento */
  stashes: string[]; dialogue: { npc: string; id: DialogueId; node: string } | null;
  /** marcos da missão (subobjetivos cumpridos, em ordem) e o caminho de cada um */
  mission: { step: number; via: Record<string, string> };
  /** cena curta de subobjetivo em andamento: a jogadora fica sem controle e ninguém a percebe nem atira até `until` */
  beat: (Beat & { step: string; via: string; at: number; until: number }) | null;
  /** fatos da partida (entrou vestindo carta, trocou de roupa, lutou antes da Sala das Joias…) */
  flags: string[];
  /** quem fala o quê por último e quando cada um pode falar de novo */
  lineAt: Record<string, number>; stats: Stats; nextId: number; events: HeistEvent[];
}
