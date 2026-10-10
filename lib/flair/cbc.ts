/**
 * FLAIR-UT F5 · §14 — Desafios de Montagem (Card Building Challenges) dentro dos Momentos.
 * Contrato com /api/flair/challenges e o kit dos cenários 2D (paleta, objetos e posição de cada vaga), que é dado e
 * não página: um desafio novo num cenário existente nasce na administração, sem deploy. Cenário sem arte conhecida
 * ("livre") ganha um arranjo automático das vagas.
 */
import type { MomentTheme, MomentTimeView } from "@/lib/moments/types";

export type CbcStatus = "OPEN" | "UPCOMING" | "ENDED";
export type CbcDifficulty = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
export type CbcPosition = "SUP" | "INF" | "CAL" | "ACE" | "VES" | "LOOK" | "ANY";

export interface CbcRequirement { type: string; [k: string]: unknown }
export interface CbcOwnWindow { status: CbcStatus; now: string; always?: boolean; startAt?: string | null; endAt?: string | null; startsInSeconds: number; endsInSeconds: number; daysLeft?: number | null }
export interface CbcMomentRef { id: string; slug: string; name: string; type: string; nature: string; theme: MomentTheme; groupId?: string | null }

export interface CbcSummary {
  id: string; slug: string; name: string; description?: string | null; scenario: string; difficulty: CbcDifficulty; status: CbcStatus;
  time: MomentTimeView | CbcOwnWindow; slotsCount: number; points: number; multiplier: number; pointsPreview: number; requirements: CbcRequirement[];
  levelOpen: boolean; groupCode?: string | null; locksCards: boolean; repeatLimit: number; official: boolean; moment?: CbcMomentRef | null;
  mine?: { submissions: number; attemptsLeft: number; done: boolean } | null;
}

export interface CbcGroup { code: string; name: string; description?: string | null; points: number; badgeCode?: string | null; challenges: { id: string; slug: string; name: string; done: boolean }[]; done: number; total: number; completed: boolean }
export interface CbcList { now: CbcSummary[]; upcoming: CbcSummary[]; always: CbcSummary[]; memories: CbcSummary[]; groups: CbcGroup[]; season: string }

export interface CbcSlot { key: string; position: CbcPosition; label?: string | null }
export interface CbcInterpretation { key: string; label?: string | null; styleTags: string[]; colorTags: string[] }

/** Linha da história: chave + variáveis (ou texto por idioma no cenário livre). */
export interface CbcStoryLine { key: string | null; vars: Record<string, string>; text?: Record<string, string>; slot?: string; sintonia?: number }
export interface CbcCardSnap { slot: string; cardId?: string; name?: string; brandName?: string | null; tier: string; ovr?: number; rare?: boolean; position: string; imageUrl?: string | null; sintonia?: number; hidden?: boolean }
export interface CbcSubmission { id: string; attempt: number; createdAt: string; interpretation?: string | null; sintonia: number; sintoniaMax: number; points?: number | null; story: CbcStoryLine[]; cards: CbcCardSnap[]; user?: { id: string; username: string } | null }
export interface CbcMemory { builds: number; people: number; averageSintonia?: number | null; readings?: { key: string; label?: string | null; count: number; pct: number; rare: boolean }[] | null; season?: string | null }

export interface CbcDetail extends CbcSummary {
  slots: CbcSlot[]; themeTags: string[]; interpretations: CbcInterpretation[]; suggestedInterpretation?: string | null;
  mySubmissions: CbcSubmission[]; communityOpen: boolean; community: CbcSubmission[]; memory: CbcMemory; group?: CbcGroup;
}

export interface CbcSlotResult { slot: string; position: string; cardId?: string | null; positionOk: boolean; neighbor: boolean; theme: boolean; sintonia: number }
export interface CbcRequirementResult { type: string; ok: boolean; have: number; need: number; args: Record<string, unknown> }
export interface CbcPointsLine { action: string; points: number; ref: string; label: string; granted?: boolean; capReached?: boolean }
export interface CbcCheck {
  status: CbcStatus; interpretation: string; story: CbcStoryLine[]; canSubmit?: boolean; attemptsLeft?: number;
  evaluation: { slots: CbcSlotResult[]; requirements: CbcRequirementResult[]; sintonia: number; sintoniaMax: number; filled: number; complete: boolean; ok: boolean; rediscovered: string[] };
  points: { lines: CbcPointsLine[]; total: number };
}
export interface CbcSubmitResult extends CbcCheck { submission: CbcSubmission; group?: { code: string; name: string; done: number; total: number; completed: boolean } | null; locked: boolean }

export const OWN_READING = "own";
export const DIFFICULTIES: CbcDifficulty[] = ["EASY", "MEDIUM", "HARD", "LEGENDARY"];

// ================================================================== cenários (arte 2D em camadas)
export type PropKind = "sun" | "moon" | "waves" | "umbrella" | "building" | "tree" | "flower" | "stage" | "lights" | "arch" | "table" | "tower" | "river"
  | "mountain" | "snow" | "fire" | "pumpkin" | "house" | "confetti" | "runway" | "rack" | "mirror" | "carpet" | "stairs" | "door" | "window" | "calendar" | "bag";

/** Objeto do cenário: tipo, posição (viewBox 160×100) e escala. */
export interface SceneProp { k: PropKind; x: number; y: number; s?: number }
export interface Scene { sky: [string, string]; ground: string; horizon: number; accent: string; props: SceneProp[]; slots: Record<string, [number, number]> }

/** Paletas e objetos de cada cenário. As vagas ficam onde a cena acontece (x, y em % da largura e da altura). */
export const SCENES: Record<string, Scene> = {
  ipanema: { sky: ["#9FD3F5", "#FDF2DC"], ground: "#F1D9A8", horizon: 60, accent: "#F28C38",
    props: [{ k: "sun", x: 132, y: 18 }, { k: "waves", x: 0, y: 56 }, { k: "umbrella", x: 74, y: 66 }, { k: "building", x: 6, y: 60, s: 0.8 }],
    slots: { calcadao: [18, 82], guarda_sol: [47, 58], quiosque: [80, 74] } },
  estagio: { sky: ["#DCE6F2", "#F7F7F5"], ground: "#C9CED6", horizon: 72, accent: "#3B5B8C",
    props: [{ k: "building", x: 8, y: 72, s: 1.4 }, { k: "door", x: 66, y: 72 }, { k: "table", x: 100, y: 80 }, { k: "window", x: 124, y: 30 }],
    slots: { recepcao: [16, 62], elevador: [42, 46], mesa: [66, 76], reuniao: [88, 56] } },
  brecho: { sky: ["#F6E7D7", "#FBF6EF"], ground: "#B98E5E", horizon: 74, accent: "#8C4A2F",
    props: [{ k: "rack", x: 14, y: 74 }, { k: "mirror", x: 60, y: 74 }, { k: "table", x: 104, y: 82 }, { k: "bag", x: 138, y: 86 }],
    slots: { arara: [14, 56], provador: [33, 42], espelho: [50, 62], caixa: [69, 74], sacola: [88, 60] } },
  festival: { sky: ["#2B2350", "#E8735A"], ground: "#3E5B3A", horizon: 70, accent: "#FFD166",
    props: [{ k: "stage", x: 60, y: 62 }, { k: "lights", x: 0, y: 10 }, { k: "tree", x: 10, y: 70 }, { k: "tree", x: 150, y: 70 }],
    slots: { portao: [12, 80], palco: [42, 40], food_truck: [62, 76], area_vip: [78, 52], saida: [92, 82] } },
  casamento: { sky: ["#CFE7D9", "#FFF8EC"], ground: "#9CC28B", horizon: 66, accent: "#C98BA0",
    props: [{ k: "arch", x: 36, y: 66 }, { k: "tree", x: 128, y: 66, s: 1.3 }, { k: "table", x: 92, y: 80 }, { k: "flower", x: 20, y: 84 }, { k: "flower", x: 150, y: 88 }],
    slots: { cerimonia: [22, 48], fotos: [36, 76], jantar: [56, 56], pista: [74, 78], despedida: [90, 50] } },
  paris: { sky: ["#BFD4E8", "#F4EBDD"], ground: "#9AA3AE", horizon: 64, accent: "#2F4B7C",
    props: [{ k: "tower", x: 100, y: 64, s: 1.2 }, { k: "river", x: 0, y: 76 }, { k: "building", x: 6, y: 64 }, { k: "table", x: 48, y: 68, s: 0.8 }],
    slots: { aeroporto: [10, 78], cafe: [27, 56], museu: [42, 36], sena: [56, 86], metro: [74, 70], terraco: [90, 40] } },
  gala: { sky: ["#1C1530", "#4B2A4D"], ground: "#2A1E2E", horizon: 70, accent: "#D6B25E",
    props: [{ k: "carpet", x: 0, y: 70 }, { k: "stairs", x: 116, y: 70 }, { k: "lights", x: 0, y: 8 }, { k: "door", x: 140, y: 52 }],
    slots: { chegada: [8, 84], tapete: [24, 70], parede: [38, 46], escadaria: [54, 74], salao: [70, 50], camarim: [84, 72], after: [94, 38] } },
  desfile: { sky: ["#141414", "#3A3A3A"], ground: "#232323", horizon: 58, accent: "#F2F2F2",
    props: [{ k: "runway", x: 80, y: 58 }, { k: "lights", x: 0, y: 6 }],
    slots: { backstage: [8, 40], maquiagem: [8, 72], passarela_1: [36, 82], passarela_2: [44, 64], passarela_3: [52, 48], passarela_4: [60, 34], final: [76, 48], imprensa: [92, 76] } },
  popup: { sky: ["#F9E3D2", "#FFF7F0"], ground: "#D8C3B0", horizon: 74, accent: "#E0367E",
    props: [{ k: "building", x: 18, y: 74, s: 1.6 }, { k: "window", x: 30, y: 40, s: 1.4 }, { k: "rack", x: 112, y: 74 }, { k: "tree", x: 150, y: 74 }],
    slots: { vitrine: [16, 48], balcao: [32, 72], arara: [48, 52], provador: [62, 74], caixa: [74, 50], calcada: [86, 84], vizinhanca: [94, 56] } },
  primavera: { sky: ["#DFF1E3", "#FFF5F7"], ground: "#A9D18E", horizon: 64, accent: "#E07BA0",
    props: [{ k: "tree", x: 20, y: 64, s: 1.3 }, { k: "flower", x: 50, y: 82 }, { k: "flower", x: 64, y: 88 }, { k: "river", x: 92, y: 74 }, { k: "sun", x: 140, y: 16, s: 0.8 }, { k: "flower", x: 140, y: 86 }],
    slots: { jardim: [18, 50], banco: [42, 74], lago: [66, 58], caminho: [86, 80] } },
  armario: { sky: ["#EDE5DA", "#F8F4EE"], ground: "#B6A58F", horizon: 80, accent: "#7A5C3E",
    props: [{ k: "rack", x: 40, y: 80, s: 1.4 }, { k: "mirror", x: 120, y: 80, s: 1.2 }, { k: "door", x: 8, y: 80, s: 1.3 }],
    slots: { fundo: [22, 52], cabide: [50, 40], espelho: [78, 56] } },
  halloween: { sky: ["#140F24", "#4B2B5E"], ground: "#21182B", horizon: 70, accent: "#F28C28",
    props: [{ k: "moon", x: 128, y: 20 }, { k: "house", x: 18, y: 70 }, { k: "house", x: 108, y: 70, s: 0.8 }, { k: "pumpkin", x: 60, y: 86 }, { k: "pumpkin", x: 142, y: 88, s: 0.8 }, { k: "tree", x: 82, y: 70, s: 0.9 }],
    slots: { convite: [10, 46], rua: [24, 80], festa: [42, 52], fotos: [58, 74], pista: [74, 54], volta: [90, 80] } },
  carnaval: { sky: ["#FFD24D", "#FF6F91"], ground: "#5A3FA8", horizon: 70, accent: "#1BB5A5",
    props: [{ k: "confetti", x: 0, y: 0 }, { k: "lights", x: 0, y: 14 }, { k: "building", x: 4, y: 70 }, { k: "building", x: 132, y: 70, s: 0.9 }],
    slots: { concentracao: [10, 80], bloco: [26, 56], bateria: [42, 78], camarote: [58, 46], dispersao: [74, 76], ressaca: [90, 54] } },
  serra: { sky: ["#C9D6EA", "#EEF2F8"], ground: "#E8EEF4", horizon: 66, accent: "#2B3A67",
    props: [{ k: "mountain", x: 40, y: 66, s: 1.4 }, { k: "mountain", x: 110, y: 66, s: 1.1 }, { k: "snow", x: 0, y: 0 }, { k: "house", x: 18, y: 72, s: 0.8 }, { k: "fire", x: 34, y: 84 }],
    slots: { estrada: [12, 84], lareira: [26, 56], trilha: [50, 76], fondue: [70, 58], mirante: [88, 38] } },
  semana: { sky: ["#EEF0F4", "#FAFAFB"], ground: "#DADDE3", horizon: 86, accent: "#1C9C6B",
    props: [{ k: "calendar", x: 8, y: 14 }],
    slots: { seg: [10, 60], ter: [23, 60], qua: [36, 60], qui: [49, 60], sex: [62, 60], sab: [75, 60], dom: [88, 60] } },
};

export const FALLBACK_SCENE: Scene = { sky: ["#EEF0F4", "#FAFAFB"], ground: "#DADDE3", horizon: 72, accent: "#1C9C6B", props: [], slots: {} };

/** Posição da vaga: a do cenário; sem ela, um arco automático (cenário livre ou vaga nova). */
export function slotPosition(scene: Scene, key: string, index: number, total: number): [number, number] {
  const known = scene.slots[key];
  if (known) return known;
  const x = total <= 1 ? 50 : 10 + (80 * index) / (total - 1);
  const y = 62 + Math.sin((index / Math.max(1, total - 1)) * Math.PI) * -18;
  return [x, y];
}

export function sceneOf(scenario: string): Scene {
  return SCENES[scenario] ?? FALLBACK_SCENE;
}

/** Variáveis da história prontas para o texto: cor pelo nome traduzido, "none" vira sem marca/sem cor no modelo ICU. */
export function storyVars(vars: Record<string, string>, colorLabel: (c: string) => string): Record<string, string> {
  const out: Record<string, string> = { ...vars };
  if (out.color && out.color !== "none") out.colorName = colorLabel(out.color);
  else out.colorName = "";
  return out;
}

export function isOwnWindow(t: MomentTimeView | CbcOwnWindow): t is CbcOwnWindow {
  return !("localStart" in t);
}
