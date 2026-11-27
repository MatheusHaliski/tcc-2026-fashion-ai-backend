import type { HypeDimension } from "./types";
import { readSeen, writeSeen, type SeenHype } from "./hype-memory";

/**
 * Evento de mudança do Hype exibido (borda verde/vermelha, brilho da Metamorfose, deltas do painel dinâmico).
 *
 * Regras (docs/design/LOJA_E_METAMORFOSE_REGRAS.md e docs/aura/BORDA_HYPE_VIVA.md):
 * - a PRIMEIRA vez que a pessoa vê a entidade só grava a referência: primeiro carregamento não conta como ganho;
 * - score exibido maior que a referência = "up" (verde); menor = "down" (vermelho); igual = nada;
 * - a mudança fica pendente até o card estar visível; ao tocar, a referência passa a ser o valor atual
 *   (no máximo um sinal por mudança, mesmo com o mesmo card montado em duas superfícies);
 * - troca de versão do algoritmo re-baseia sem sinal.
 * Estado em memória por `<userId>|<entityKey>`; a referência durável fica em hype-memory.
 */
export const HYPE_SIGNAL_MS = 4000;
export type HypeSignalDirection = "up" | "down";
export type HypeDims = Partial<Record<HypeDimension, number>>;

/** O que a superfície sabe do Hype atual da entidade (vem de useAuraLive). */
export interface HypeLive {
  /** userId de quem vê; null = sem conta (memória só da sessão) */
  scope: string | null;
  /** `PIECE:<id>` / `SCHEME:<id>` */
  key: string;
  /** opção ativa (preferência auraHype ou modo AURA Hype da peça/look) E permissão AURA_DYNAMIC */
  enabled: boolean;
  dims?: HypeDims;
  version?: string;
}

export interface HypeSignal {
  seq: number;
  direction: HypeSignalDirection;
  /** diferença em pontos inteiros (positiva ou negativa) */
  delta: number;
  score: number;
  dims: HypeDims;
  /** referência anterior (a última visita ou o valor de antes na sessão) */
  from: SeenHype;
  at: number;
}

interface Pending { direction: HypeSignalDirection; delta: number; score: number; dims: HypeDims; from: SeenHype; v?: string }
interface Slot { pending?: Pending; signal?: HypeSignal; base?: SeenHype | null; listeners: Set<() => void> }

const slots = new Map<string, Slot>();
let seq = 0;

const slotKey = (scope: string | null, entityKey: string) => `${scope ?? ""}|${entityKey}`;

function slotOf(scope: string | null, entityKey: string): Slot {
  const id = slotKey(scope, entityKey);
  let slot = slots.get(id);
  if (!slot) slots.set(id, (slot = { listeners: new Set() }));
  return slot;
}

function emit(slot: Slot) {
  slot.listeners.forEach((listener) => listener());
}

const sameDims = (a: HypeDims, b: HypeDims) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<HypeDimension>;
  return [...keys].every((k) => a[k] === b[k]);
};

/** Registra o valor exibido agora. Não toca nada: só cria (ou cancela) a mudança pendente. */
export function observeHype(scope: string | null, entityKey: string, score: number, dims: HypeDims = {}, version?: string) {
  const slot = slotOf(scope, entityKey);
  const ref = readSeen(scope, entityKey);
  const firstInSession = slot.base === undefined;
  if (firstInSession) slot.base = ref && ref.v === version ? ref : null;
  if (applyObservation(slot, scope, entityKey, ref, { score, dims, version }) || firstInSession) emit(slot);
}

/** Decide a mudança pendente; devolve se ela mudou (para avisar quem assina). */
function applyObservation(slot: Slot, scope: string | null, entityKey: string, ref: SeenHype | undefined, current: { score: number; dims: HypeDims; version?: string }) {
  const { score, dims, version } = current;
  const now = Date.now();
  const hadPending = !!slot.pending;
  if (!ref || ref.v !== version) {
    // primeira vista (ou fórmula nova): só grava a referência
    writeSeen(scope, entityKey, { score, dims, at: now, v: version });
    slot.pending = undefined;
    return hadPending;
  }
  if (ref.score === score) {
    slot.pending = undefined;
    if (!sameDims(ref.dims, dims) || now - ref.at > 60_000) writeSeen(scope, entityKey, { ...ref, dims, at: now });
    return hadPending;
  }
  if (slot.pending && slot.pending.score === score && sameDims(slot.pending.dims, dims)) return false;
  const delta = score - ref.score;
  slot.pending = { direction: delta > 0 ? "up" : "down", delta, score, dims, from: ref, v: version };
  return true;
}

/** O card está visível: toca a mudança pendente (uma vez) e passa a referência para o valor atual. */
export function revealHype(scope: string | null, entityKey: string): HypeSignal | null {
  const slot = slotOf(scope, entityKey);
  const pending = slot.pending;
  if (!pending) return null;
  slot.pending = undefined;
  const at = Date.now();
  slot.signal = { seq: ++seq, direction: pending.direction, delta: pending.delta, score: pending.score, dims: pending.dims, from: pending.from, at };
  slot.base = pending.from;
  writeSeen(scope, entityKey, { score: pending.score, dims: pending.dims, at, v: pending.v });
  emit(slot);
  return slot.signal;
}

export const hasPendingHype = (scope: string | null, entityKey: string) => !!slots.get(slotKey(scope, entityKey))?.pending;

/** Sinal ainda em exibição (até HYPE_SIGNAL_MS depois de tocar). */
export function activeHypeSignal(scope: string | null, entityKey: string, now = Date.now()): HypeSignal | undefined {
  const signal = slots.get(slotKey(scope, entityKey))?.signal;
  return signal && now - signal.at < HYPE_SIGNAL_MS ? signal : undefined;
}

/** Referência para os deltas do painel: a última visita (ou o valor de antes da última mudança tocada). */
export function hypeBaseline(scope: string | null, entityKey: string): SeenHype | null {
  return slots.get(slotKey(scope, entityKey))?.base ?? null;
}

export function subscribeHypeSignal(scope: string | null, entityKey: string, listener: () => void) {
  const slot = slotOf(scope, entityKey);
  slot.listeners.add(listener);
  return () => {
    slot.listeners.delete(listener);
  };
}

/** Só para testes. */
export function __resetHypeSignals() {
  slots.clear();
  seq = 0;
}
