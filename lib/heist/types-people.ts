/* MET Gala Heist v2 — tipos de quem está em cena: aparências, joias e espólio, animações, seguranças e civis. */
import type { KeyId, RoomId, Vec } from "./types-level";
import type { CardTier, DialogueId, VendorId } from "./types";

/* ---------- personagens ---------- */
/** Aparência de quem está em cena: o catálogo (lib/heist/looks.ts) monta humanos realistas a partir destas chaves e do seed. */
export type LookId =
  | "guestF" | "guestM" | "guard" | "guardHeavy" | "police" | "waiter" | "waitress" | "hostess" | "paparazzo" | "fan"
  | "catering" | "vendor" | "curator" | "bartender" | "musician" | "crew" | "driver" | "dj" | "chef";
export type CivRole = "guest" | "queue" | "fan" | "paparazzo" | "waiter" | "hostess" | "catering" | "vendor" | "curator" | "bartender" | "musician" | "crew" | "driver" | "celebrity" | "dancer" | "dj" | "chef";
/** Jeito de cada convidado (MH-05-03): tagarela puxa conversa, desconfiada vira quando alguém fica atrás, distraída não
 * percebe nada, crítica de moda comenta a roupa. */
export type Persona = "chatty" | "wary" | "dreamy" | "critic";
/** Joias que convidados usam (furtáveis), a peça guardada na chapelaria e as joias expostas nas vitrines da Sala das Joias. */
export type JewelKind = "colar" | "brincos" | "pulseira" | "relogio" | "anel" | "broche" | "tiara" | "estola";
export interface Jewel { id: string; kind: JewelKind; value: number; tier: CardTier; taken: boolean; missAt: number; noticed: boolean }
/** Espólio: o que a jogadora levou, de quem/onde e quanto vale (dólares do universo do jogo). */
export interface LootItem { id: string; kind: JewelKind | "diamante"; value: number; tier: CardTier; from: "worn" | "stored" | "exposed"; owner: CivRole | "vitrine" | "chapelaria"; room: RoomId; at: number }
/** Animações que a cena sabe desenhar (procedurais, no esqueleto do corpo humano). */
export type Anim =
  | "idle" | "walk" | "run" | "sneak" | "crouch" | "discreet" | "tired" | "talk" | "phone" | "drink" | "photo" | "cheer"
  | "serve" | "guard" | "aim" | "shoot" | "reload" | "melee" | "stab" | "takedown" | "knockedOut" | "dead" | "downed"
  | "change" | "pickpocket" | "interact" | "climb" | "crawl" | "celebrate" | "dance" | "wave" | "sit" | "queue" | "look"
  | "point" | "cower" | "flee" | "play" | "dj" | "eat";
export type Hold = "pistol" | "knife" | "camera" | "tray" | "phone" | "glass" | "flashlight" | "tablet" | "diamond" | "violin" | "plate" | "headphones" | null;

/* ---------- seguranças ---------- */
/** GRABBED: agarrado por trás durante o nocaute (não vê nem age; cai no fim da ação). */
/** guard comum · chief (chefe: rádio para o prédio e chama reforço) · heavy (equipe especial: avança, mira mais rápido,
 * não recua com tiro) · police (segura a posição e chama apoio) */
export type GuardRole = "guard" | "chief" | "heavy" | "police";
export type GuardState = "PATROL" | "POST" | "SUSPICIOUS" | "ALERT" | "SEARCH" | "GRABBED" | "DOWN";
export interface GuardSpawn {
  /** callsign: nome próprio do segurança no rádio (não se traduz) */
  id: string; callsign: string; room: RoomId; look: "guard" | "guardHeavy" | "police";
  post?: { pos: Vec; yaw: number }; route?: Vec[];
  /** carrega a chave da sala (cai quando a pessoa é derrubada) */
  carries?: KeyId | "keycard";
  /** entra em cena só no alarme do diamante (reforço) e fica plantado na passagem */
  lockdown?: boolean; blocker?: boolean;
  role?: GuardRole;
  /** posto crítico: ouve o ruído e olha, mas não sai do lugar (MH-06-16) */
  critical?: boolean;
  /** reserva: entra quando um chefe ou a polícia pede reforço */
  reserve?: boolean;
}
export interface Guard {
  id: string; callsign: string; look: GuardSpawn["look"]; room: RoomId; tier: number;
  pos: Vec; vel: Vec; yaw: number; look2: number; hp: number; maxHp: number;
  state: GuardState; stateT: number; route: Vec[]; routeIdx: number; waitUntil: number; post: { pos: Vec; yaw: number } | null;
  path: Vec[]; pathIdx: number; goal: Vec | null; replanAt: number;
  /** suspeita sobre a jogadora (0–1); em 1 ela foi reconhecida */
  suspicion: number; sees: boolean; lastKnown: Vec | null; lastSeenAt: number;
  aimStart: number; nextShotAt: number; shots: number; hitAt: number; downAt: number; killed: boolean;
  carries: GuardSpawn["carries"] | null; active: boolean; blocker: boolean; barkAt: number; anim: Anim; animAt: number;
  role: GuardRole; critical: boolean; reserve: boolean;
  /** o que mais pesou no reconhecimento (o HUD explica a detecção: MH-06-14) */
  reason: DetectReason | null;
  /** ponto de flanco e de cobertura no combate; arara que ele foi conferir na busca */
  flank: Vec | null; cover: Vec | null; searched: string[];
}
export type DetectReason = "close" | "weapon" | "running" | "casual" | "restricted" | "private" | "crouching" | "changing" | "theft" | "noise" | "body" | "laser" | "alarm" | "seen";

/* ---------- civis ---------- */
export interface CivSpawn {
  id: string; role: CivRole; look: LookId; pos: Vec; yaw: number; anim: Anim; room: RoomId; hold?: Hold; wander?: Vec[]; group?: number; vendor?: VendorId; talk?: DialogueId;
  /** altura de quem fica sobre um móvel (fotógrafos na arquibancada); sem ela, o piso (floorY) */
  y?: number;
}
export interface Civilian {
  id: string; role: CivRole; look: LookId; room: RoomId; pos: Vec; vel: Vec; y: number | null; yaw: number; anim: Anim; baseAnim: Anim; hold: Hold; vendor: VendorId | null;
  home: Vec; homeYaw: number; wander: Vec[]; wanderIdx: number; path: Vec[]; pathIdx: number; waitUntil: number;
  /** pânico depois de tiros (corre para longe ou se abaixa) até este instante */
  panicUntil: number; panicFrom: Vec | null;
  /** quando o pânico começa (reação ao alarme fora de sincronia: cada um percebe num instante) */
  panicAt?: number;
  /** reação à jogadora: olhar, comentar, pedir bebida ao "garçom", estranhar */
  reactUntil: number; reactKind: "look" | "order" | "stare" | "greet" | "point" | null; barkAt: number; seed: number; queueIdx: number;
  hasInvite: boolean; animAt: number;
  persona: Persona; jewel: Jewel | null;
  /** viu a jogadora fazer algo errado (instante; −1 = nunca) e quando apontou para ela por último */
  knowsPlayer: number; pointedAt: number;
  /** desde quando a jogadora está colada nela (espaço pessoal) */
  nearSince: number;
  /** passeio pelo salão (troca de roda de conversa) */
  hopAt: number; talkId: DialogueId | null;
}
