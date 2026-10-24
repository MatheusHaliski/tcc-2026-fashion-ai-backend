"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { HypeEntity, HypeSummaries, HypeSummary } from "./types";

/**
 * HypeScore v2 — leitura em lote para os cards. Cada card pede o Hype da sua entidade; os pedidos do mesmo "tick" viram
 * UMA requisição (`/api/hype/summaries`, até 100 ids). O resultado fica num cache de módulo com TTL e cada card assina só
 * a própria chave (useSyncExternalStore): virar um card ou chegar o Hype de outro não re-renderiza a grade inteira.
 * O backend nunca recalcula num GET — lê o snapshot do job.
 */
interface Entry { summary?: HypeSummary; loading: boolean; error: boolean; at: number }

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 600;
const BATCH = 100;
const entries = new Map<string, Entry>();
const awaitingRecalculation = new Map<string,string>();
const listeners = new Map<string, Set<() => void>>();
const pending: Record<HypeEntity, Set<string>> = { PIECE: new Set(), SCHEME: new Set() };
let timer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (type: HypeEntity, id: string) => `${type}:${id}`;

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function put(key: string, entry: Entry) {
  const current = entries.get(key)?.summary;
  if(current?.status === "AVAILABLE" && entry.summary?.status === "AVAILABLE" && current.calculatedAt && entry.summary.calculatedAt
      && Date.parse(entry.summary.calculatedAt) < Date.parse(current.calculatedAt)) {
    entry = { ...entry, summary: current };
  }
  const waiting=awaitingRecalculation.get(key);
  if(waiting&&entry.summary){
    if(entry.summary.calculatedAt&&Date.parse(entry.summary.calculatedAt)>Date.parse(waiting))awaitingRecalculation.delete(key);
    else entry={...entry,summary:{...entry.summary,stale:true}};
  }
  entries.set(key, entry);
  if (entries.size > MAX_ENTRIES) {
    // descarta as mais antigas que ninguém está olhando (sem vazamento em listas longas/virtualizadas)
    for (const k of entries.keys()) {
      if (entries.size <= MAX_ENTRIES) break;
      if (!listeners.get(k)?.size) entries.delete(k);
    }
  }
  emit(key);
}

async function flush() {
  timer = null;
  for (const type of ["PIECE", "SCHEME"] as HypeEntity[]) {
    const ids = [...pending[type]];
    pending[type].clear();
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        const r = await api.get<HypeSummaries>(`/api/hype/summaries?type=${type}&ids=${chunk.join(",")}`);
        const now = Date.now();
        // id fora da resposta = sem permissão para ver ou sem cálculo: mostra "não calculado", nunca 0
        chunk.forEach((id) => put(keyOf(type, id), { summary: r.items?.[id] ?? { status: "NOT_CALCULATED" }, loading: false, error: false, at: now }));
      } catch {
        const now = Date.now();
        chunk.forEach((id) => { const old = entries.get(keyOf(type, id)); put(keyOf(type, id), { summary: old?.summary, loading: false, error: true, at: now }); });
      }
    }
  }
}

/** Prefixo dos IDs de exemplo (tutoriais "Como funciona"): nunca vão à API — a demonstração traz os próprios números. */
export const DEMO_ID_PREFIX = "demo-";

/** Pede o Hype de uma entidade (entra no próximo lote; respeita o TTL e pedidos em andamento). */
export function requestHype(type: HypeEntity, id: string) {
  if (id.startsWith(DEMO_ID_PREFIX)) return;
  const key = keyOf(type, id);
  const e = entries.get(key);
  if (e && (e.loading || Date.now() - e.at < TTL_MS)) return;
  put(key, { summary: e?.summary, loading: true, error: false, at: e?.at ?? 0 });   // mantém o valor antigo enquanto revalida
  pending[type].add(id);
  if (!timer) timer = setTimeout(flush, 0);
}

/** Editing invalidates the cached snapshot; only a newer server snapshot clears stale. */
export function invalidateHype(type:HypeEntity,id:string){
 const key=keyOf(type,id),old=entries.get(key);
 awaitingRecalculation.set(key,old?.summary?.calculatedAt??"1970-01-01T00:00:00Z");
 if(old)put(key,{...old,summary:old.summary?{...old.summary,stale:true}:undefined,at:0});
 requestHype(type,id);
}

/** Respostas que já trazem o Hype (ranking, insights) alimentam o cache — o card não pede de novo. */
export function primeHype(type: HypeEntity, items: Record<string, HypeSummary | undefined>) {
  const now = Date.now();
  Object.entries(items).forEach(([id, summary]) => { if (summary) put(keyOf(type, id), { summary, loading: false, error: false, at: now }); });
}

// One live timer for all mounted AURA cards; requests still use the existing batched reader.
const live = new Map<string, { type: HypeEntity; id: string; count: number }>();
let liveTimer: ReturnType<typeof setInterval> | null = null;
function watchLive(type: HypeEntity, id: string) {
  const key = keyOf(type,id), old = live.get(key);
  live.set(key,{type,id,count:(old?.count ?? 0)+1});
  if(!liveTimer) liveTimer=setInterval(()=>{
    if(typeof document !== "undefined" && document.visibilityState === "hidden") return;
    live.forEach(({type,id})=>{
      const key=keyOf(type,id), old=entries.get(key);
      if(old?.loading) return;
      if(old) put(key,{...old,at:0});
      requestHype(type,id);
    });
  },30_000);
  return ()=>{
    const current=live.get(key);
    if(current && current.count>1) live.set(key,{...current,count:current.count-1}); else live.delete(key);
    if(!live.size && liveTimer) { clearInterval(liveTimer); liveTimer=null; }
  };
}

/** Só para testes: zera o cache e os lotes pendentes. */
export function __resetHypeStore() {
  if(liveTimer) clearInterval(liveTimer);
  liveTimer=null; live.clear();
  entries.clear(); awaitingRecalculation.clear();
  pending.PIECE.clear();
  pending.SCHEME.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}

export function useHypeSummary(type: HypeEntity, id: string | null | undefined, enabled = true, liveUpdates = false) {
  const key = id ? keyOf(type, id) : "";
  const subscribe = useCallback((cb: () => void) => {
    if (!key) return () => undefined;
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(cb);
    return () => { set!.delete(cb); if (!set!.size) listeners.delete(key); };
  }, [key]);
  const entry = useSyncExternalStore(subscribe, () => (key ? entries.get(key) : undefined), () => undefined);
  useEffect(() => { if (enabled && id) requestHype(type, id); }, [type, id, enabled]);
  useEffect(()=>{if(!enabled||!id)return;const changed=(event:Event)=>{const value=(event as CustomEvent<{type:HypeEntity;id:string}>).detail;if(value?.type===type&&value.id===id)invalidateHype(type,id);};window.addEventListener('fai:hype-source-updated',changed);return ()=>window.removeEventListener('fai:hype-source-updated',changed);},[type,id,enabled]);
  useEffect(()=>{ if(enabled && (liveUpdates || entry?.summary?.stale) && id && !id.startsWith(DEMO_ID_PREFIX)) return watchLive(type,id); },[enabled,liveUpdates,type,id,entry?.summary?.stale]);
  return { summary: entry?.summary, loading: entry ? entry.loading && !entry.summary : enabled && !!id, error: !!entry?.error && !entry?.summary };
}
