"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";

/** Resposta de /api/brand-logos: logo guardado (ou null) + monograma para quando a busca na internet não achou nada. */
export interface BrandLogoInfo { name: string; url: string | null; status: "FOUND" | "GENERATED"; source: string; domain?: string | null; monogram: { initials: string; color: string }; note?: string; }

const PALETTE = ["#1F7A76", "#C6275E", "#B8862B", "#5B6B7A", "#7C5FC0", "#2F3E46", "#D2691E", "#3B6EA8"];
export const logoKey = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** Mesmo monograma do backend (iniciais + cor estável), para não piscar enquanto a resposta chega. */
export function localMonogram(name: string): { initials: string; color: string } {
  const initials = name.trim().split(/[\s\-_/.]+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  // String.hashCode do Java sobre a chave normalizada → mesma cor do servidor
  let h = 0; for (const ch of logoKey(name)) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return { initials, color: PALETTE[((h % PALETTE.length) + PALETTE.length) % PALETTE.length] };
}

const cache = new Map<string, Promise<BrandLogoInfo>>();
let queue: { name: string; resolve: (v: BrandLogoInfo) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Junta os pedidos de uma mesma renderização (grades e listas) numa chamada só ao /batch. */
function flush() {
  const batch = queue.splice(0, 40); timer = null;
  if (queue.length) timer = setTimeout(flush, 30);
  if (!batch.length) return;
  const params = new URLSearchParams(); batch.forEach((b) => params.append("names", b.name));
  api.get<Record<string, BrandLogoInfo>>(`/api/brand-logos/batch?${params}`, { anonymous: true })
    .then((res) => batch.forEach((b) => b.resolve(res[b.name] ?? fallback(b.name))))
    .catch(() => batch.forEach((b) => { cache.delete(logoKey(b.name)); b.resolve(fallback(b.name)); }));
}
const fallback = (name: string): BrandLogoInfo => ({ name, url: null, status: "GENERATED", source: "MONOGRAMA", monogram: localMonogram(name) });

export function fetchBrandLogo(name: string): Promise<BrandLogoInfo> {
  const key = logoKey(name);
  if (!key) return Promise.resolve(fallback(name));
  let p = cache.get(key);
  if (!p) {
    p = new Promise<BrandLogoInfo>((resolve) => { queue.push({ name, resolve }); if (!timer) timer = setTimeout(flush, 30); });
    cache.set(key, p);
  }
  return p;
}

/** Logo da marca: usa a URL conhecida (catálogo/perfil) e, se ela faltar ou quebrar, pergunta ao buscador de logos. */
export function useBrandLogo(name: string | null | undefined, known?: string | null) {
  const [info, setInfo] = useState<BrandLogoInfo | null>(null);
  const [knownBroken, setKnownBroken] = useState(false);
  const knownUrl = known && !knownBroken && !/example\.(com|org)/.test(known) ? mediaUrl(known) : null;
  useEffect(() => {
    setInfo(null);
    if (!name || knownUrl) return;
    let alive = true; fetchBrandLogo(name).then((i) => alive && setInfo(i));
    return () => { alive = false; };
  }, [name, knownUrl]);
  const url = knownUrl ?? (info?.url ? mediaUrl(info.url) : null);
  return { url, info, monogram: info?.monogram ?? localMonogram(name ?? "?"), onKnownError: () => setKnownBroken(true), fromKnown: !!knownUrl };
}
