/*
 * The MET Gala Afterparty Heist (título de trabalho) — tipos da simulação. Evento, museu e personagens são ficcionais:
 * a afterparty da Gala Lumière no Museu Vesper de Moda, onde o Vestido Aurora (Casa Orvalho, 1957) está exposto.
 *
 * Tudo é dado simples (sem classes): o estado inteiro cabe num structuredClone (checkpoint e salvamento) e o mundo
 * estático (salas, paredes, grade de navegação) fica fora dele, compartilhado.
 *
 * Eixos: x para leste, z para sul, metros. Direção `yaw` θ aponta para (sin θ, cos θ) — o mesmo que rotation.y de um
 * modelo que olha para +z no three.js.
 */
export interface Vec { x: number; z: number }

/** Salas da planta. A doca faz parte dos corredores de serviço e o beiral, do terraço (as oito áreas do jogo: AREA_OF). */
export type RoomId = "entrada" | "salao" | "galeria" | "lounge" | "terraco" | "beiral" | "bastidores" | "servico" | "doca" | "conservacao";
export type AreaId = "entrada" | "salao" | "galeria" | "lounge" | "terraco" | "bastidores" | "servico" | "conservacao";
export type DoorId = "main" | "side" | "service" | "staff" | "lounge" | "backstage" | "stage" | "gallery" | "conservation" | "terrace" | "staffTerrace" | "vent" | "windowT" | "windowC";
/** open: sempre aberta · wristband: pulseira do credenciamento · keypad: código da doca (ou decodificador) ·
 * keycard: credencial da curadoria · vent: duto, só agachada · window: janela do beiral, escalando */
export type DoorLock = "open" | "wristband" | "keypad" | "keycard" | "vent" | "window";

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export type Shape = ({ type: "box" } & Rect) | { type: "circle"; x: number; z: number; r: number };
/** low: esconde só quem está agachado · tall: bloqueia a visão · glass: bloqueia o passo, não a visão */
export type Height = "low" | "tall" | "glass";
export type PropKind = "column" | "table" | "bar" | "crate" | "shelf" | "case" | "rack" | "stand" | "planter" | "desk" | "backdrop" | "van"
  | "stage" | "screen" | "panel" | "bench" | "rope" | "detector" | "locker" | "piano" | "sofa" | "statue" | "railing" | "cart" | "mirror"
  | "mannequin" | "lamp" | "worktable" | "steamer";
export interface Prop { id: string; kind: PropKind; shape: Shape; height: Height; room: RoomId; yaw?: number; variant?: number }

/** public: convidados circulam · staff: equipe (com crachá de produção, tudo bem) · private: só a curadoria */
export type Access = "public" | "staff" | "private";
export interface Room { id: RoomId; rect: Rect; access: Access; floor: "marble" | "carpet" | "concrete" | "parquet" | "stone" | "metal" }
export interface DoorDef { id: DoorId; rect: Rect; lock: DoorLock; between: [RoomId, RoomId] }

/* ---------- personagens ---------- */
/** Elenco ficcional: Helena (anfitriã), Íris (curadora), Caio (estilista), Valéria (jornalista), Ruth (chefe de segurança
 * do museu), Otto Brandt (produtor da gala), Lia (assistente de produção), Davi (bartender) e Nina (convidada). */
export type CharacterId = "helena" | "iris" | "caio" | "valeria" | "ruth" | "brandt" | "lia" | "davi" | "nina";
export type ActivityAnim = "talk" | "inspect" | "drink" | "phone" | "work" | "idle" | "serve" | "watch" | "speech" | "steam" | "carry" | "write";
/** Uma parada da rotina: onde, fazendo o quê, por quanto tempo (s) e com quem conversa ali (para ouvir escondido). */
export interface Activity { id: string; pos: Vec; yaw?: number; anim: ActivityAnim; dur: [number, number]; with?: CharacterId; overhear?: string }
/** Rotina: blocos do relógio da festa (minutos depois das 21:00) e as paradas que a pessoa percorre em cada um. */
export interface RoutineBlock { from: number; to: number; stops: Activity[] }
export type Mood = "calm" | "warm" | "wary" | "alarmed";
export interface Character {
  id: CharacterId; pos: Vec; vel: Vec; yaw: number; look: number; anim: ActivityAnim | "walk";
  block: number; stop: number; activityUntil: number; path: Vec[]; pathIdx: number; target: Vec | null;
  /** conversando com a jogadora: a rotina pausa e depois retoma de onde parou */
  talking: boolean; paused: { until: number; reason: string } | null;
  noticedAt: number; greeted: boolean; lastBarkAt: number; mood: Mood;
  /** distração pedida a outra pessoa (entrevista da jornalista): fica presa até lá */
  busyUntil: number; busyWith: CharacterId | null;
}

/** Equipe: segurança do museu (avisa e acompanha até o salão — nunca ataca) e a equipe de Brandt (avisa o chefe). */
export type StaffKind = "seguranca" | "equipe";
export type StaffState = "PATROL" | "POST" | "NOTICE" | "INVESTIGATE" | "WARN" | "ESCORT" | "RETURN" | "DISTRACTED" | "CHECK";
export interface StaffSpawn { id: string; kind: StaffKind; name: string; room: RoomId; post?: { pos: Vec; yaw: number }; route?: Vec[]; blackoutCheck?: boolean }
export interface Staff {
  id: string; kind: StaffKind; name: string; pos: Vec; vel: Vec; yaw: number; look: number;
  state: StaffState; stateT: number; route: Vec[]; routeIdx: number; waitUntil: number; post: { pos: Vec; yaw: number } | null;
  path: Vec[]; pathIdx: number; goal: Vec | null; replanAt: number;
  sees: boolean; awareness: number; lastKnown: Vec | null; until: number; warned: number; barkAt: number; anim: ActivityAnim | "walk";
}

export type GuestState = "IDLE" | "WALK" | "WATCH" | "GATHER";
export interface Guest { id: string; pos: Vec; vel: Vec; yaw: number; state: GuestState; stateT: number; target: Vec | null; path: Vec[]; pathIdx: number; seed: number; anim: ActivityAnim | "walk"; role: "guest" | "musician" | "waiter" | "crew"; home: Vec; wander: boolean; group: number }

export interface CameraDef { id: string; pos: Vec; yaw: number; sweep: number; room: RoomId }
export interface CameraState extends CameraDef { aim: number; off: boolean }

/* ---------- interação ---------- */
export type InteractKind = "inspect" | "talk" | "keypad" | "case" | "puzzle" | "door" | "climb" | "rack" | "desk" | "styling" | "medcab" | "board" | "crate" | "deliver";
export interface InteractDef { id: string; kind: InteractKind; pos: Vec; room: RoomId; radius: number; ref?: string; yaw?: number }
export interface InteractState extends InteractDef { used: boolean }

/* ---------- cartas FLAIR na missão ---------- */
export type CardTier = "BRONZE" | "PRATA" | "OURO" | "ESPECIAL" | "INICIAL";
export type CardEffectKind = "VITALIDADE" | "RECUPERACAO" | "PERCEPCAO" | "PRESENCA" | "MOBILIDADE" | "RECURSOS" | "ESPECIALIDADE" | "SINERGIA";
/** Condição para o efeito valer (ativo) ou contar (passivo). */
export type CardCondition = "SEMPRE" | "EXPLORANDO" | "EM_DIALOGO" | "EM_PUZZLE" | "EM_TRAVESSIA" | "EM_FUGA";
export type ToolId = "chamada" | "decodificador";
export type PuzzleKind = "inspection" | "quiz" | "lighting" | "route" | "contradiction" | "styling" | "evidence";
export interface CardEffect {
  /** identificador estável do efeito (ex.: VIT-OURO) e versão da regra — sobe quando o balanceamento muda */
  id: string; version: number; kind: CardEffectKind; mode: "PASSIVO" | "ATIVO";
  /** intensidade na unidade do efeito: +PV, cargas, segundos, % ou opções de diálogo/dica */
  magnitude: number; unit: "pv" | "cargas" | "s" | "%" | "opcao";
  duration: number; cooldown: number; condition: CardCondition;
  cost: number; stack: "SOMA" | "MAIOR" | "UNICO"; cap: number;
  /** cura por carga (RECUPERACAO), ferramenta (RECURSOS) ou quebra-cabeça facilitado (ESPECIALIDADE) */
  heal?: number; tool?: ToolId; puzzle?: PuzzleKind | "any";
  /** efeito exclusivo das cartas Especiais (criadas por marcas, celebridades e administradores) */
  unique?: string;
  feedback: { icon: string; sfx: string; haptic: "leve" | "medio" | "forte" };
}
export interface LoadoutCard { cardId: string; name: string; tier: CardTier; imageUrl?: string | null; brandName?: string | null; position?: string | null; effect: CardEffect; source: "COLECAO" | "INICIAL" }
export interface Synergy { id: string; cards: string[]; hp?: number; presence?: number; tool?: number }
/** O que o loadout dá na partida. O servidor (FlairHeistCards.java) valida e calcula; o jogo só aplica. */
export interface HeistLoadout {
  version: number; budget: number; spent: number; cards: LoadoutCard[]; synergies: Synergy[];
  maxHp: number; heal: { charges: number; amount: number; cooldown: number };
  perception: { seconds: number; cooldown: number } | null;
  /** % a mais de confiança ganha em conversas e quantas opções de diálogo extras (Presença) */
  presence: number; presenceOptions: number;
  /** % mais rápido em travessias: escalada do beiral, duto e esconderijos */
  mobility: number;
  tools: Record<ToolId, number>;
  /** dicas gratuitas por tipo de quebra-cabeça (Especialidade); "any" vale para todos */
  specialty: Partial<Record<PuzzleKind | "any", number>>;
  uniques: string[];
}

/* ---------- jogadora ---------- */
export type PlayerMode = "WALK" | "CLIMB" | "HIDDEN";
export interface PlayerAction { kind: "inspect" | "talk" | "climb" | "heal" | "dodge" | "stumble" | "pickup" | "hide" | "tool"; t: number; dur: number; from?: Vec; to?: Vec; ref?: string }
export interface Inventory { invite: boolean; wristband: boolean; lanyard: boolean; keycard: boolean; code: boolean; gown: boolean }
export interface Player {
  pos: Vec; vel: Vec; yaw: number; hp: number; maxHp: number; crouch: boolean; sprint: boolean; mode: PlayerMode;
  action: PlayerAction | null; inv: Inventory; hidden: string | null; lastHitAt: number; iframesUntil: number; dodgeReadyAt: number;
  /** recursos das cartas */
  heals: number; healReadyAt: number; tools: Record<ToolId, number>; perceiveUntil: number; perceiveReadyAt: number;
  /** integridade do Vestido Aurora original enquanto está com a jogadora (0–100) */
  gownIntegrity: number;
}

/* ---------- narrativa ---------- */
/** Evidências: o que prova, de onde veio e a quem se relaciona ficam no diário (heist.evidence.<id>.*). */
export type EvidenceId = "E_INVITE" | "E_REPLICA" | "E_PHOTO" | "E_CONTRADICTION" | "E_CALLSHEET" | "E_MANIFEST" | "E_ROUTE" | "E_ORIGINAL" | "E_SKETCH";
/** Depoimentos (versões das testemunhas) que o confronto de horários compara. */
export type StatementId = "S_IRIS" | "S_BRANDT" | "S_LIA" | "S_HELENA" | "S_CAIO";
export interface EvidenceEntry { id: EvidenceId; at: number; room: RoomId; source: string; relates: CharacterId[] }
export interface StatementEntry { id: StatementId; who: CharacterId; at: number }
export type ObjectiveId = "CHECKIN" | "INSPECT" | "CURATOR" | "WITNESSES" | "BACKSTAGE" | "ROUTE" | "CONSERVATION" | "RESOLVE" | "FINALE";
export type Approach = "persuasao" | "investigacao" | "furtividade" | "puzzles" | "acao";
export type Resolution = "" | "SOCIAL" | "ACAO";
export interface Narrative {
  facts: string[]; evidence: EvidenceEntry[]; statements: StatementEntry[]; trust: Record<CharacterId, number>;
  /** suspeita geral (0–100) e o piso que ela não perde enquanto alguém lembra da jogadora */
  suspicion: number; notoriety: number;
  done: ObjectiveId[]; approaches: Record<Approach, number>;
  /** relógio da festa em minutos depois das 21:00 (começa 21:30; a apresentação final é às 23:30) */
  clock: number; resolution: Resolution; dialoguesSeen: string[];
  /** onde está o original: na caixa C-17 da conservação, na doca (transporte antecipado) ou com a jogadora */
  gownAt: "conservacao" | "doca" | "player" | "palco";
  hintsUsed: number; assists: number;
}

/* ---------- diretor de eventos ---------- */
export type DirectorEventId = "recognized" | "performance" | "spill" | "blackout" | "reroute" | "earlyTransport" | "legitClue";
export interface DirectorState { active: { id: DirectorEventId; until: number; data?: Record<string, number | string> } | null; fired: { id: DirectorEventId; at: number }[]; lastAt: number }

/* ---------- ação: a sabotagem durante a fuga com o original ---------- */
export type HazardKind = "rig" | "steam" | "sprinkler";
export interface Hazard { id: string; kind: HazardKind; pos: Vec; r: number; warnAt: number; fireAt: number; endAt: number; hit: boolean }
export interface ActionState { phase: "OFF" | "ESCAPE" | "DONE"; startedAt: number; hazards: Hazard[]; nextAt: number; wave: number; blockedDoor: DoorId | null }

/* ---------- quebra-cabeças ---------- */
export interface PuzzleSession { kind: PuzzleKind; id: string; hints: number; freeHints: number; mistakes: number; state: unknown; solved: boolean; assisted: boolean }

export interface Stats { puzzles: number; hints: number; mistakes: number; assists: number; spotted: number; warned: number; escorted: number; damage: number; dodges: number; dialogues: number; inspected: number; overheard: number; healsUsed: number; toolsUsed: number; checkpoints: number }

export type GameStatus = "EXPLORE" | "DIALOGUE" | "PUZZLE" | "ENDED";
export type HeistEvent =
  | { t: "line"; who: string; key: string; vars?: Record<string, string | number> }
  | { t: "sfx"; id: string; pos?: Vec; gain?: number }
  | { t: "toast"; key: string; vars?: Record<string, string | number> }
  | { t: "objective"; id: ObjectiveId; done: boolean }
  | { t: "evidence"; id: EvidenceId } | { t: "statement"; id: StatementId }
  | { t: "trust"; who: CharacterId; delta: number }
  | { t: "suspicion"; level: "notice" | "warn" | "escort" }
  | { t: "checkpoint"; reason: string }
  | { t: "director"; id: DirectorEventId; phase: "start" | "end" }
  | { t: "hit"; damage: number; pos: Vec } | { t: "dodge" }
  | { t: "puzzle"; kind: PuzzleKind; id: string; result: "start" | "solved" | "hint" | "mistake" | "assist" | "close" }
  | { t: "status"; status: GameStatus }
  | { t: "rumble"; strong: number; weak: number; ms: number }
  | { t: "card"; effect: CardEffectKind; id: string };

/** Entrada de um quadro, já traduzida do teclado/mouse/controle. Bordas (…Press) valem um quadro. */
export interface HeistInput {
  /** analógico: x à direita, y para a frente (−1 a 1), relativo à câmera */
  move: { x: number; y: number }; camYaw: number;
  sprint: boolean; crouchPress: boolean; interact: boolean; interactPress: boolean;
  dodgePress: boolean; perceivePress: boolean; healPress: boolean; toolPress: boolean;
}

export interface SimState {
  version: number; seed: number; rng: number; time: number; tick: number; status: GameStatus; endedAt: number;
  player: Player; characters: Character[]; staff: Staff[]; guests: Guest[]; cameras: CameraState[]; interacts: InteractState[];
  doors: Record<DoorId, boolean>; n: Narrative; director: DirectorState; action: ActionState;
  dialogue: { who: CharacterId; node: string; at: number } | null;
  puzzle: PuzzleSession | null;
  lights: { blackout: RoomId[]; until: number };
  /** convidados juntos no palco (apresentação) até este instante */
  gatherUntil: number;
  tutorial: { step: number; done: boolean };
  /** quem fala o quê por último (nada se repete em seguida) e quando cada categoria pode falar de novo */
  lineLast: Record<string, string>; lineAt: Record<string, number>;
  stats: Stats; nextId: number; events: HeistEvent[];
}
