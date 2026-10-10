/*
 * Estado das peças vestidas no 3D (PROVADOR-3D): o corpo (carregando/pronto/erro) e, por peça, o estado da foto usada
 * na prévia. O Canvas do three.js não herda contexto React de fora, então a cena publica aqui e a página lê com
 * useGarmentStatus. Só ids de peça e estados — nenhuma imagem, medida ou dado pessoal.
 */
import { useSyncExternalStore } from "react";
import type { PhotoState } from "@/lib/tryon/garment-asset";

export type BodyState = "carregando" | "pronto" | "erro";
export interface GarmentStatus { body: BodyState; photos: Record<string, PhotoState> }

let current: GarmentStatus = { body: "carregando", photos: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function publishBodyState(body: BodyState) {
  if (current.body === body) return; current = { ...current, body }; emit();
}
export function publishPhotoStates(photos: Record<string, PhotoState>) {
  const same = Object.keys(photos).length === Object.keys(current.photos).length && Object.entries(photos).every(([k, v]) => current.photos[k] === v);
  if (same) return; current = { ...current, photos }; emit();
}
export function garmentStatusSnapshot(): GarmentStatus { return current; }
/** só para testes */
export function resetGarmentStatus() { current = { body: "carregando", photos: {} }; emit(); }

export function useGarmentStatus(): GarmentStatus {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => current);
}
