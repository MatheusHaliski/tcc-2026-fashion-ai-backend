/*
 * The MET Gala Afterparty Heist — estado narrativo validado. Fatos, evidências, depoimentos, confiança, suspeita e
 * objetivos só mudam por aqui: cada evidência tem pré-requisitos conferidos (nenhuma fala, evento ou texto gerado pode
 * entregar uma prova que a investigação ainda não sustenta) e a conclusão da missão depende só deste estado.
 *
 * A história (ficcional): às 21:30 a caixa C-17 chega à doca com uma réplica do Vestido Aurora; às 21:40 a equipe de
 * Otto Brandt a leva pelo corredor de serviço; às 21:45 a réplica vai para a vitrine e o original entra na C-17, que fica
 * na conservação "para checar a umidade"; às 23:10 a C-17 sai pela doca. Brandt diz que a peça só saiu às 22:30 e que o
 * estilista Caio, autor da réplica de turnê, é o culpado.
 */
import type { Approach, CharacterId, EvidenceEntry, EvidenceId, Narrative, ObjectiveId, RoomId, StatementId } from "./types";

export const START_CLOCK = 30, FINAL_CLOCK = 150, HOLD_CLOCK = 140;
export const CHARACTERS: CharacterId[] = ["helena", "iris", "caio", "valeria", "ruth", "brandt", "lia", "davi", "nina"];
/** Confiança inicial: a anfitriã recebe bem; a curadoria e a segurança são formais; o produtor desconfia de quem pergunta. */
export const TRUST0: Record<CharacterId, number> = { helena: 40, iris: 20, caio: 25, valeria: 25, ruth: 30, brandt: 20, lia: 15, davi: 35, nina: 30 };

/** Fatos (marcos da investigação e escolhas de diálogo) usados nas condições. */
export const F = {
  CHECKIN: "F_CHECKIN", PLACARD: (n: number) => `F_PLACARD${n}`, INSPECTED: "F_INSPECTED", QUIZ: "F_QUIZ", IRIS_MET: "F_IRIS_MET", IRIS_TRUSTS: "F_IRIS_TRUSTS",
  CAIO_MET: "F_CAIO_MET", CAIO_DETAILS: "F_CAIO_DETAILS", CAIO_ORDER: "F_CAIO_ORDER", CAIO_TIP: "F_CAIO_TIP", STYLED: "F_STYLED",
  VAL_MET: "F_VAL_MET", RUMOR_CRATE: "F_RUMOR_CRATE", VALERIA_FAVOR: "F_VALERIA_FAVOR", LIA_MET: "F_LIA_MET", LIA_LANYARD: "F_LIA_LANYARD",
  BRANDT_MET: "F_BRANDT_MET", BRANDT_ALERTED: "F_BRANDT_ALERTED", RUTH_MET: "F_RUTH_MET", HELENA_TOLD: "F_HELENA_TOLD",
  LEGIT: "F_LEGIT", OVERHEARD: "F_OVERHEARD", DAVI_RUMOR: "F_DAVI_RUMOR", ACCUSED_CAIO: "F_ACCUSED_CAIO",
  CONTRADICTION: "F_CONTRADICTION_SOLVED", ROUTE: "F_ROUTE_SOLVED", LIGHTING: "F_LIGHTING_SOLVED", DOCK_FOUND: "F_DOCK_FOUND",
  RECOGNIZED: "F_RECOGNIZED", MEDCAB: "F_MEDCAB", KEYPAD: "F_KEYPAD_OPEN", TOOK_GOWN: "F_TOOK_GOWN",
} as const;

export interface EvidenceRule { essential: boolean; weight: number; relates: CharacterId[]; requires: (n: Narrative) => boolean }
/** O que cada prova exige antes de existir. Pesos somam 100 com os depoimentos (STATEMENT_WEIGHT). */
export const EVIDENCE: Record<EvidenceId, EvidenceRule> = {
  E_INVITE: { essential: false, weight: 1, relates: ["helena"], requires: () => true },
  E_REPLICA: { essential: true, weight: 16, relates: ["iris", "caio"], requires: (n) => has(n, F.INSPECTED) },
  E_PHOTO: { essential: false, weight: 2, relates: ["valeria", "brandt"], requires: (n) => has(n, F.VAL_MET) },
  E_CONTRADICTION: { essential: true, weight: 16, relates: ["brandt", "iris", "lia"], requires: (n) => has(n, F.CONTRADICTION) && hasStatement(n, "S_BRANDT") && hasStatement(n, "S_IRIS") && (hasStatement(n, "S_LIA") || hasEvidence(n, "E_PHOTO")) },
  E_CALLSHEET: { essential: true, weight: 16, relates: ["brandt", "lia"], requires: () => true },
  E_MANIFEST: { essential: false, weight: 2, relates: ["brandt"], requires: () => true },
  E_ROUTE: { essential: true, weight: 16, relates: ["brandt"], requires: (n) => has(n, F.ROUTE) && hasEvidence(n, "E_CALLSHEET") && hasEvidence(n, "E_CONTRADICTION") },
  E_ORIGINAL: { essential: true, weight: 16, relates: ["iris", "ruth"], requires: (n) => hasEvidence(n, "E_CALLSHEET") && (has(n, F.LIGHTING) || has(n, F.DOCK_FOUND)) },
  E_SKETCH: { essential: false, weight: 2, relates: ["caio", "iris"], requires: () => true },
};
export const STATEMENT_WEIGHT: Record<StatementId, number> = { S_IRIS: 4, S_BRANDT: 4, S_LIA: 3, S_HELENA: 1, S_CAIO: 1 };
export const STATEMENT_WHO: Record<StatementId, CharacterId> = { S_IRIS: "iris", S_BRANDT: "brandt", S_LIA: "lia", S_HELENA: "helena", S_CAIO: "caio" };
export const ESSENTIAL: EvidenceId[] = (Object.keys(EVIDENCE) as EvidenceId[]).filter((id) => EVIDENCE[id].essential);

export function newNarrative(): Narrative {
  return { facts: [], evidence: [], statements: [], trust: { ...TRUST0 }, suspicion: 0, notoriety: 0, done: [],
    approaches: { persuasao: 0, investigacao: 0, furtividade: 0, puzzles: 0, acao: 0 }, clock: START_CLOCK, resolution: "", dialoguesSeen: [],
    gownAt: "conservacao", hintsUsed: 0, assists: 0 };
}

export const has = (n: Narrative, fact: string) => n.facts.includes(fact);
export const hasEvidence = (n: Narrative, id: EvidenceId) => n.evidence.some((e) => e.id === id);
export const hasStatement = (n: Narrative, id: StatementId) => n.statements.some((e) => e.id === id);
export function addFact(n: Narrative, fact: string): boolean { if (has(n, fact)) return false; n.facts.push(fact); return true; }

/** Concede a evidência só se a investigação a sustenta; devolve false (e nada muda) quando falta pré-requisito. */
export function grantEvidence(n: Narrative, id: EvidenceId, room: RoomId, source: string): EvidenceEntry | null {
  if (hasEvidence(n, id) || !EVIDENCE[id].requires(n)) return null;
  const e: EvidenceEntry = { id, at: Math.round(n.clock), room, source, relates: EVIDENCE[id].relates };
  n.evidence.push(e);
  return e;
}
export function addStatement(n: Narrative, id: StatementId): boolean {
  if (hasStatement(n, id)) return false;
  n.statements.push({ id, who: STATEMENT_WHO[id], at: Math.round(n.clock) });
  return true;
}

/** Confiança (0–100): Presença aumenta os ganhos (nunca as perdas). Devolve a variação aplicada. */
export function changeTrust(n: Narrative, who: CharacterId, delta: number, presencePct = 0): number {
  const before = n.trust[who], d = delta > 0 ? delta * (1 + presencePct / 100) : delta;
  n.trust[who] = Math.max(0, Math.min(100, before + d));
  return n.trust[who] - before;
}
/** Suspeita (0–100) nunca desce abaixo da notoriedade: quem reconheceu a jogadora continua lembrando. */
export function changeSuspicion(n: Narrative, delta: number) { n.suspicion = Math.max(n.notoriety, Math.min(100, n.suspicion + delta)); }
export function addApproach(n: Narrative, a: Approach, k = 1) { n.approaches[a] += k; }

/** Progresso da investigação (0–100): evidências e depoimentos pesados pela importância. */
export function investigation(n: Narrative): number {
  let p = 0;
  for (const e of n.evidence) p += EVIDENCE[e.id].weight;
  for (const s of n.statements) p += STATEMENT_WEIGHT[s.id];
  return Math.min(100, p);
}

/** Objetivos: concluídos pelo estado (nunca marcados à mão) e liberados em ordem parcial (vários ao mesmo tempo). */
export const OBJECTIVES: { id: ObjectiveId; done: (n: Narrative) => boolean; open: (n: Narrative) => boolean }[] = [
  { id: "CHECKIN", done: (n) => has(n, F.CHECKIN), open: () => true },
  { id: "INSPECT", done: (n) => hasEvidence(n, "E_REPLICA"), open: (n) => has(n, F.CHECKIN) },
  { id: "CURATOR", done: (n) => has(n, F.IRIS_TRUSTS), open: (n) => has(n, F.CHECKIN) },
  { id: "WITNESSES", done: (n) => hasEvidence(n, "E_CONTRADICTION"), open: (n) => hasEvidence(n, "E_REPLICA") || has(n, F.IRIS_TRUSTS) },
  { id: "BACKSTAGE", done: (n) => hasEvidence(n, "E_CALLSHEET"), open: (n) => hasEvidence(n, "E_REPLICA") || has(n, F.IRIS_TRUSTS) },
  { id: "ROUTE", done: (n) => hasEvidence(n, "E_ROUTE"), open: (n) => hasEvidence(n, "E_CONTRADICTION") && hasEvidence(n, "E_CALLSHEET") },
  { id: "CONSERVATION", done: (n) => hasEvidence(n, "E_ORIGINAL"), open: (n) => hasEvidence(n, "E_CALLSHEET") },
  { id: "RESOLVE", done: (n) => n.resolution !== "", open: (n) => hasEvidence(n, "E_ORIGINAL") },
  { id: "FINALE", done: (n) => n.clock >= FINAL_CLOCK && n.resolution !== "", open: (n) => n.resolution !== "" },
];
/** Recalcula os objetivos; devolve os que acabaram de ser concluídos (para o aviso e o checkpoint). */
export function refreshObjectives(n: Narrative): ObjectiveId[] {
  const now: ObjectiveId[] = [];
  for (const o of OBJECTIVES) if (!n.done.includes(o.id) && o.done(n)) { n.done.push(o.id); now.push(o.id); }
  return now;
}
export const openObjectives = (n: Narrative) => OBJECTIVES.filter((o) => !n.done.includes(o.id) && o.open(n)).map((o) => o.id);

/** Resolução social: provas da troca, da mentira, da rota e do original, com a chefe de segurança disposta a ouvir. */
export function canResolveSocial(n: Narrative): boolean {
  return ESSENTIAL.every((id) => hasEvidence(n, id)) && (n.trust.ruth >= 40 || (has(n, F.HELENA_TOLD) && n.trust.helena >= 50));
}

/** O relógio avança devagar e espera a jogadora antes da apresentação final: nenhuma derrota por tempo. */
export function advanceClock(n: Narrative, minutes: number) {
  const cap = n.resolution ? FINAL_CLOCK : HOLD_CLOCK;
  n.clock = Math.min(cap, n.clock + minutes);
}
export const clockLabel = (clock: number) => { const m = Math.floor(clock); return `${21 + Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
