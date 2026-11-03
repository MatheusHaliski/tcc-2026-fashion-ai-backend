/* MET Gala Heist v2 — tipos da planta: vetor no plano, salas, portas, formas, móveis e pontos de interação. */
export interface Vec { x: number; z: number }

/* ---------- planta ---------- */
/** Salas. `seguranca` fica dentro do labirinto de serviço; `beiral` é a cornija externa; `rua` e `beco` são o lado de fora. */
export type RoomId = "rua" | "beco" | "vestibulo" | "salao" | "galeria" | "lounge" | "terraco" | "beiral" | "bastidores" | "servico" | "seguranca" | "doca" | "cofre";
export type DoorId = "carpetGate" | "front" | "dockGate" | "side" | "main" | "service" | "staff" | "lounge" | "backstage" | "stage" | "gallery" | "vault" | "terrace" | "staffTerrace" | "vent" | "secDoor" | "windowT" | "windowC" | "fireEscape";
/** open: sempre aberta · invite: o convite (a recepcionista confere no portão do tapete) · wristband: a pulseira que o portão
 * dá · staff: leitor de crachá (só com uniforme da equipe) · key: chave física (keyId) que alguém da sala carrega · keypad:
 * código · keycard: cartão da segurança · vent: duto, só agachada · climb: janela/escada de incêndio, só escalando */
export type DoorLock = "open" | "invite" | "wristband" | "staff" | "key" | "keypad" | "keycard" | "vent" | "climb";
export type KeyId = "doca" | "servico";

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export type Shape = ({ type: "box" } & Rect) | { type: "circle"; x: number; z: number; r: number };
/** low: esconde só quem está agachado · tall: bloqueia a visão · glass: bloqueia o passo, não a visão */
export type Height = "low" | "tall" | "glass";
export type PropKind =
  // interior
  | "column" | "table" | "bar" | "crate" | "shelf" | "case" | "rack" | "stand" | "planter" | "desk" | "backdrop" | "stage" | "screen"
  | "panel" | "bench" | "rope" | "detector" | "locker" | "piano" | "sofa" | "floral" | "statue" | "railing" | "cart" | "mirror"
  | "mannequin" | "lamp" | "worktable" | "steamer" | "pedestal" | "safe" | "coatcheck" | "dumpster" | "monitor"
  // móvel próprio de uma área (lib/heist/areas/*): o desenho vem do módulo da área pelo `model`
  | "fixture"
  // exterior
  | "limo" | "suv" | "policeCar" | "cateringTruck" | "getawayCar" | "barrier" | "riser" | "podium" | "lampPost" | "tree"
  | "vendorStand" | "tent" | "hydrant" | "fireEscape";
export interface Prop {
  id: string; kind: PropKind; shape: Shape; height: Height; room: RoomId; yaw?: number; variant?: number;
  /** "fixture": qual móvel da área é (ex.: "djBooth", "dessertTable") — o módulo de cena da área desenha */
  model?: string;
}

/** public: convidados circulam · staff: equipe (com uniforme, tudo bem) · private: só a segurança · street: lado de fora */
export type Access = "public" | "staff" | "private" | "street";
export type Floor = "marble" | "carpet" | "concrete" | "parquet" | "stone" | "metal" | "asphalt" | "sidewalk";
export interface Room { id: RoomId; rect: Rect; access: Access; floor: Floor; tier: number; outdoor?: boolean }
export interface DoorDef {
  id: DoorId; rect: Rect; lock: DoorLock; between: [RoomId, RoomId]; keyId?: KeyId;
  /** a sala de onde a porta abre sem a tranca (barra antipânico, botão de saída) */
  freeFrom?: RoomId;
}

/* ---------- interação ---------- */
export type InteractKind =
  | "vendor" | "hostess" | "pickpocket" | "uniform" | "intercom" | "inspect" | "keypad" | "safe" | "fuses" | "pedestal"
  | "climb" | "rack" | "exit" | "door" | "pickup" | "stash" | "jewelCase" | "coatRack";
export interface InteractDef { id: string; kind: InteractKind; pos: Vec; room: RoomId; radius: number; ref?: string; yaw?: number }
