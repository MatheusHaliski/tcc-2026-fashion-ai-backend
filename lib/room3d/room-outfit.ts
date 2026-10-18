/*
 * Roupa padrão do avatar no Meu Quarto (aba Configurações): o que ele veste quando o espelho não tem peça numa zona do
 * corpo. Um conjunto do FashionAI (Clássico = o look padrão de sempre; os outros em tecido liso, sem estampa nem logo)
 * e, por zona, uma peça do próprio guarda-roupa no lugar da peça do conjunto. Guardada no quarto
 * (PUT /api/me/room/outfit); sem a rota no servidor ainda, neste aparelho.
 */
import type { Look3dPiece } from "@/components/three/common";
import { DEFAULT_PIECES, missingZones, ZONES, type Zone } from "@/lib/avatar3d/human/default-outfit";

export type OutfitPreset = "classico" | "off_white" | "grafite" | "areia" | "oliva";
export const OUTFIT_PRESETS: OutfitPreset[] = ["classico", "off_white", "grafite", "areia", "oliva"];
/** Zonas como o servidor as chama (o pé é "shoes"). */
export type OutfitZone = "upper" | "lower" | "shoes";
export const OUTFIT_ZONES: OutfitZone[] = ["upper", "lower", "shoes"];
const ZONE_OF: Record<Zone, OutfitZone> = { upper: "upper", lower: "lower", feet: "shoes" };
/** Categorias de peça que servem em cada zona (as mesmas que o servidor confere). */
export const ZONE_CATEGORIES: Record<OutfitZone, string[]> = { upper: ["upper_piece", "full_body_piece"], lower: ["lower_piece"], shoes: ["shoes_piece"] };

export interface RoomOutfit { preset: OutfitPreset; choice: Partial<Record<OutfitZone, string>> }
export const DEFAULT_ROOM_OUTFIT: RoomOutfit = { preset: "classico", choice: {} };

/** Cores (camiseta, calça, tênis) dos conjuntos em tecido liso; o Clássico usa as fotos do look padrão. */
export const PRESET_COLORS: Record<Exclude<OutfitPreset, "classico">, [string, string, string]> = {
  off_white: ["#efe9de", "#cdbf9f", "#f4f1ea"],
  grafite: ["#3b3e44", "#1f2023", "#2b2b2b"],
  areia: ["#d8c3a0", "#b49a74", "#efe6d6"],
  oliva: ["#ece6d8", "#5f6b45", "#3a3328"],
};

/** A peça do conjunto numa zona (ids próprios por conjunto: trocar de conjunto troca a peça no 3D). */
export function presetPiece(preset: OutfitPreset, zone: Zone): Look3dPiece {
  const base = DEFAULT_PIECES[zone];
  if (preset === "classico") return base;
  const color = PRESET_COLORS[preset][ZONES.indexOf(zone)];
  // sem foto: o 3D veste o molde na cor do tecido (sem a estampa e o logo das fotos de referência)
  return { ...base, id: `${base.id}-${preset}`, name: `${base.name}-${preset}`, imageUrl: null, studioUrl: null, colorHex: color };
}

/**
 * O look do quarto: as peças do espelho e, em cada zona que ficaria sem roupa, a peça escolhida do guarda-roupa (se
 * ainda existir) ou a do conjunto. Um vestido escolhido para cima já cobre as pernas: a zona de baixo não recebe nada.
 */
export function withRoomOutfit(look: Look3dPiece[], outfit: RoomOutfit, owned: (id: string) => Look3dPiece | null): Look3dPiece[] {
  const out = [...look];
  for (const zone of ZONES) {
    if (!missingZones(out).includes(zone)) continue;
    const id = outfit.choice[ZONE_OF[zone]];
    out.push((id ? owned(id) : null) ?? presetPiece(outfit.preset, zone));
  }
  return out;
}

/** Lê a roupa padrão que veio do servidor (ou do aparelho) sem confiar: conjunto desconhecido vira o Clássico. */
export function sanitizeOutfit(raw: unknown): RoomOutfit {
  const r = (raw && typeof raw === "object" ? raw : {}) as { preset?: unknown; choice?: unknown };
  const preset = OUTFIT_PRESETS.includes(r.preset as OutfitPreset) ? (r.preset as OutfitPreset) : "classico";
  const choice: RoomOutfit["choice"] = {};
  const c = (r.choice && typeof r.choice === "object" ? r.choice : {}) as Record<string, unknown>;
  for (const z of OUTFIT_ZONES) if (typeof c[z] === "string" && c[z]) choice[z] = c[z] as string;
  return { preset, choice };
}

const STORAGE_KEY = "fai.room.outfit.v1";
export function loadLocalOutfit(): RoomOutfit | null {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? sanitizeOutfit(JSON.parse(raw)) : null; } catch { return null; }
}
export function saveLocalOutfit(o: RoomOutfit): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); } catch { /* sem armazenamento */ }
}
