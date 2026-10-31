/**
 * RF23 — ordem do menu lateral escolhida pela pessoa: quais grupos vêm primeiro e a ordem dos itens dentro de cada grupo.
 * Fica no navegador (vale na hora, inclusive antes do login carregar) e no perfil (`user_preferences.nav_order_json`),
 * de onde é reaplicada ao entrar em outro dispositivo. A ordem guardada pode estar incompleta ou desatualizada: o que ela
 * não conhece é ignorado e item novo do app entra no fim, na ordem padrão.
 */
import { useSyncExternalStore } from "react";
import { api, tokenStore } from "@/lib/api/client";
import type { NavGroup } from "./nav-items";

export interface NavOrder { groups: string[]; items: Record<string, string[]> }

const STORAGE_KEY = "fai.navOrder";

/** Ordena `list` pelas chaves conhecidas em `keys`; o resto mantém a ordem original e vai para o fim. */
export function orderBy<T>(list: T[], keys: string[] | undefined, keyOf: (t: T) => string): T[] {
  if (!keys?.length) return list;
  const rank = new Map(keys.map((k, i) => [k, i]));
  const known = list.filter((t) => rank.has(keyOf(t))).sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!);
  return [...known, ...list.filter((t) => !rank.has(keyOf(t)))];
}

/** Grupos e itens na ordem da pessoa (sem ordem salva, a padrão). */
export function applyNavOrder(groups: NavGroup[], order: NavOrder | null): NavGroup[] {
  if (!order) return groups;
  return orderBy(groups, order.groups, (g) => g.key).map((g) => ({ ...g, items: orderBy(g.items, order.items?.[g.key], (n) => n.href) }));
}

/** Troca o elemento de posição com o vizinho (delta -1 sobe, +1 desce); fora dos limites, devolve a lista igual. */
export function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Leva o elemento de `from` para a posição `to` (arrastar e soltar); índices inválidos devolvem a lista igual. */
export function moveTo<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A ordem completa (todos os grupos e itens) do menu como está agora, pronta para salvar. */
export function snapshot(groups: NavGroup[]): NavOrder {
  return { groups: groups.map((g) => g.key), items: Object.fromEntries(groups.map((g) => [g.key, g.items.map((n) => n.href)])) };
}

export function isNavOrder(v: unknown): v is NavOrder {
  if (!v || typeof v !== "object") return false;
  const o = v as Partial<NavOrder>;
  return Array.isArray(o.groups) && o.groups.every((g) => typeof g === "string")
    && (o.items === undefined || (typeof o.items === "object" && o.items !== null
      && Object.values(o.items).every((l) => Array.isArray(l) && l.every((h) => typeof h === "string"))));
}

function read(): NavOrder | null {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); return isNavOrder(v) ? { groups: v.groups, items: v.items ?? {} } : null; } catch { return null; }
}

let current: NavOrder | null | undefined;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getNavOrder = (): NavOrder | null => { if (current === undefined) current = typeof window === "undefined" ? null : read(); return current; };

/**
 * Aplica a nova ordem no menu na hora e a guarda no navegador; com `persist` (padrão) e sessão ativa, também no perfil.
 * `null` volta à ordem padrão.
 */
export function setNavOrder(order: NavOrder | null, opts: { persist?: boolean } = {}): Promise<void> {
  current = order;
  try { if (order) localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); else localStorage.removeItem(STORAGE_KEY); } catch { /* storage indisponível */ }
  listeners.forEach((l) => l());
  if (opts.persist === false || !tokenStore.access) return Promise.resolve();
  return api.put("/api/me/preferences", { navOrder: order ?? {}, clientUpdatedAt: new Date().toISOString() }).then(() => undefined);
}

/** A ordem salva, reativa: o menu e o editor das Configurações mudam juntos. */
export function useNavOrder(): NavOrder | null {
  return useSyncExternalStore(subscribe, getNavOrder, () => null);
}
