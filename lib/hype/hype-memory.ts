import type { HypeDimension } from "./types";

/**
 * Memória do Hype exibido, por pessoa e por entidade (tempo de vida do usuário, não só da sessão).
 *
 * Guarda a última pontuação EXIBIDA (inteiro arredondado) e as dimensões que a pessoa viu num card com AURA Hype ativa,
 * para que a borda sinalize verde/vermelho também quando o Hype mudou desde a última visita (outro dia, outra aba) e os
 * painéis dinâmicos mostrem deltas contra essa visita. Sem conta, a memória vale só para a sessão (nada é gravado).
 *
 * localStorage[`fai.hype.seen.v1:<userId>`] = { [entityKey]: { score, dims, at, v? } }, em ordem LRU (até 2000 entidades).
 * Toda leitura/escrita de storage fica em try/catch: modo privado, cota cheia ou storage bloqueado nunca quebram o card.
 */
export interface SeenHype {
  /** pontuação exibida (inteiro 0–100) */
  score: number;
  /** dimensões exibidas (inteiros 0–100); ausentes = indisponíveis */
  dims: Partial<Record<HypeDimension, number>>;
  /** quando a pessoa viu esse valor (epoch ms) */
  at: number;
  /** versão do algoritmo do snapshot: mudança de fórmula não é ganho nem perda */
  v?: string;
}

export const HYPE_MEMORY_PREFIX = "fai.hype.seen.v1:";
export const HYPE_MEMORY_LIMIT = 2000;
const SESSION_SCOPE = "";

/** Cache por escopo (userId; "" = sem conta). A ordem de inserção do Map é a ordem LRU (mais antiga primeiro). */
const scopes = new Map<string, Map<string, SeenHype>>();
const dirty = new Set<string>();
let flushScheduled = false;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const storageKey = (scope: string) => `${HYPE_MEMORY_PREFIX}${scope}`;

function isSeen(value: unknown): value is SeenHype {
  const entry = value as SeenHype | null;
  return !!entry && typeof entry === "object" && Number.isFinite(entry.score) && typeof entry.dims === "object" && !!entry.dims;
}

function load(scope: string): Map<string, SeenHype> {
  const cached = scopes.get(scope);
  if (cached) return cached;
  const map = new Map<string, SeenHype>();
  if (scope !== SESSION_SCOPE) {
    try {
      const raw = storage()?.getItem(storageKey(scope));
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      for (const [key, value] of Object.entries(parsed ?? {})) {
        if (isSeen(value)) map.set(key, value);
      }
    } catch {
      // storage ilegível: começa vazio, como uma primeira visita
    }
  }
  scopes.set(scope, map);
  return map;
}

/** Grava os escopos alterados de uma vez (vários cards no mesmo tick = uma serialização). */
export function flushHypeMemory() {
  flushScheduled = false;
  for (const scope of dirty) {
    const map = scopes.get(scope);
    if (!map || scope === SESSION_SCOPE) continue;
    try {
      storage()?.setItem(storageKey(scope), JSON.stringify(Object.fromEntries(map)));
    } catch {
      // cota cheia ou storage bloqueado: a memória continua valendo nesta sessão
    }
  }
  dirty.clear();
}

function scheduleFlush(scope: string) {
  dirty.add(scope);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushHypeMemory);
}

const scopeOf = (userId: string | null | undefined) => userId || SESSION_SCOPE;

/** Última referência vista por esta pessoa para a entidade (`PIECE:<id>` / `SCHEME:<id>`). */
export function readSeen(userId: string | null | undefined, entityKey: string): SeenHype | undefined {
  return load(scopeOf(userId)).get(entityKey);
}

/** Troca a referência da entidade e a move para o fim da fila LRU; descarta as mais antigas acima do limite. */
export function writeSeen(userId: string | null | undefined, entityKey: string, entry: SeenHype) {
  const scope = scopeOf(userId);
  const map = load(scope);
  map.delete(entityKey);
  map.set(entityKey, entry);
  for (const key of map.keys()) {
    if (map.size <= HYPE_MEMORY_LIMIT) break;
    map.delete(key);
  }
  scheduleFlush(scope);
}

/** Só para testes: esquece o cache em memória (o localStorage fica como estiver). */
export function __resetHypeMemory() {
  scopes.clear();
  dirty.clear();
  flushScheduled = false;
}
