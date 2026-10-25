/*
 * Estado das peças vestidas no 3D (PROVADOR-3D): o corpo (carregando/pronto/erro) e, por peça, o estado da foto usada
 * na prévia. O Canvas do three.js não herda contexto React de fora, então a cena publica aqui e a página lê com
 * useGarmentStatus. Só ids de peça e estados — nenhuma imagem, medida ou dado pessoal.
 */
import { useSyncExternalStore } from "react";
import type { BackEvidence, PhotoState } from "@/lib/tryon/garment-asset";

export type BodyState = "carregando" | "pronto" | "erro";
export interface GarmentStatus { body: BodyState; photos: Record<string, PhotoState>; backs: Record<string, BackEvidence> }

let current: GarmentStatus = { body: "carregando", photos: {}, backs: {} };
let photoRetries: Readonly<Record<string, number>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function publishBodyState(body: BodyState) {
  if (current.body === body) return; current = { ...current, body }; emit();
}
const sameRecord = <T,>(a: Record<string, T>, b: Record<string, T>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
export function publishPhotoStates(photos: Record<string, PhotoState>, backs: Record<string, BackEvidence> = current.backs) {
  if (sameRecord(photos, current.photos) && sameRecord(backs, current.backs)) return; current = { ...current, photos, backs }; emit();
}
/** Retry only the selected photograph; never creates a remote model-generation job. */
export function requestPhotoRetry(id: string) {
  if (!id || current.photos[id] === "carregando") return;
  photoRetries = { ...Object.fromEntries(Object.entries(photoRetries).filter(([key]) => key in current.photos)), [id]: (photoRetries[id] ?? 0) + 1 };
  current = { ...current, photos: { ...current.photos, [id]: "carregando" } }; emit();
}

/** Canvas and page share retry revisions without a React context crossing the renderer boundary. */
export function useGarmentPhotoRetries() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => photoRetries, () => photoRetries);
}

export function garmentStatusSnapshot(): GarmentStatus { return current; }
/** só para testes */
export function resetGarmentStatus() { current = { body: "carregando", photos: {}, backs: {} }; photoRetries = {}; emit(); }

export function useGarmentStatus(): GarmentStatus {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => current);
}
