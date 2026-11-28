"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";

const root = "/api/me/saved-catalog-products";
const snapshots = new Map<string, ReadonlySet<string>>();
const requests = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function load(owner: string) {
  if (snapshots.has(owner)) return Promise.resolve();
  const pending = requests.get(owner);
  if (pending) return pending;
  const request = api.get<string[]>(root + "/ids").then((ids) => {
    snapshots.set(owner, new Set(ids));
    notify();
  }).finally(() => requests.delete(owner));
  requests.set(owner, request);
  return request;
}

export function useSavedCatalogProduct(id: string) {
  const { user } = useAuth();
  const owner = user?.id;
  const ids = useSyncExternalStore(subscribe, () => owner ? snapshots.get(owner) : undefined, () => undefined);
  useEffect(() => {
    if (owner) void load(owner).catch(() => undefined);
  }, [owner]);

  async function toggle() {
    if (!owner) return;
    await load(owner);
    const path = root + "/" + encodeURIComponent(id);
    const next = !snapshots.get(owner)?.has(id);
    if (next) await api.put(path, {});
    else await api.delete(path);
    const updated = new Set(snapshots.get(owner));
    if (next) updated.add(id);
    else updated.delete(id);
    snapshots.set(owner, updated);
    notify();
    return next;
  }

  return { saved: ids?.has(id) ?? false, toggle };
}
