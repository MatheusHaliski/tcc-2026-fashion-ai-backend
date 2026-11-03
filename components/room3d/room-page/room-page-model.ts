import type { Dispatch, SetStateAction } from "react";
import { tr, type useI18n } from "@/lib/i18n/i18n";
import type { useApi } from "@/lib/hooks/use-api";
import type { useToast } from "@/components/ui";
import type { MirrorData, useMirrorPins } from "@/components/mirror/mirror-controls";
import type { useMirrorAvatar } from "@/components/mirror/mirror-stage";
import type { MirrorRackPiece } from "@/lib/mirror/mirror-list";
import type { MirrorPiece } from "@/components/mirror/mirror-stage";

/*
 * Modelo da página Meu Quarto (app/(site)/(app)/room/page.tsx): o que a API do quarto devolve, as tabelas da etiqueta
 * costurada e do modo foto, os parâmetros do espelho na URL e os tipos que os hooks e as seções da página trocam.
 */

/** Sem WebGL o quarto não monta a cena: ficam as Configurações do quarto e o espelho plano (palco 2D). */
export function webglOk(): boolean {
  if (typeof window === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
/** Os parâmetros do espelho numa URL (espelho|vestir|vista): o que separa um link novo do eco da URL que a página escreveu. */
export const linkKey = (q: { get: (k: string) => string | null }) => ["espelho", "vestir", "vista"].map((k) => q.get(k) ?? "").join("|");
export const keyOfPath = (path: string) => linkKey(new URLSearchParams(path.split("?")[1] ?? ""));
/** Ir ao espelho com a cena 3D ainda montando ou o avatar carregando: espera até isto (ms) para caminhar; depois, abre direto. */
export const WALK_WAIT_MS = 12000;

export interface RoomPiece { id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string; imageUrl?: string; thumbnailUrl?: string; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; costPerUse?: number | null; }
export interface Module { id: string; slotType: string; mold?: string; widthCm?: number; capacity?: number; label: string; sku?: string; finish?: { color?: string; texture?: string; roughness?: number; material?: string }; hangers?: { k: number; address: string; pieceId?: string | null }[]; slots?: { address: string; pieceId?: string | null }[]; pieceIds?: string[]; drawerLabel?: string; }
export interface Room { owner: boolean; level: string; levelInfo: { unlocks: string; aesthetic: string }; modules: Module[]; drawerLabels: Record<string, string>; pieces: Record<string, RoomPiece>; basket?: RoomPiece[]; saleRack?: { name: string; pieces: RoomPiece[] }; showcase?: unknown; chair?: RoomPiece[]; capacity?: { pieces: number; positions: number; overflow?: number }; forgottenCount?: number; mirrorDailyLook?: { schemeId: string; title: string } | null; celebrations?: { code: string; secret?: boolean }[]; decorations?: { name?: string; moduleId?: string; sku?: string }[]; ambient?: { period: string; seasonal?: string; sound?: boolean; haptics?: boolean; reduceMotion?: boolean }; monogram?: string; }
export interface MirrorState extends MirrorData { rack?: MirrorRackPiece[] }
export interface PieceTag { id: string; name: string; composition?: string | null; care?: string | null; origin?: string | null; garimpo: boolean; wearCount: number; thirtyWears: boolean; costPerUse?: number | null; location?: { address: string; label: string } | null; diary: { date: string; occasion: string }[]; }
export interface Unbox { inventoryId: string; sku: string; name: string; slotType: string; }
export const CARE: Record<string, string> = { get COTTON() { return tr("room.n30_medio_secar_a_sombra"); }, get WOOL() { return tr("room.lavar_a_mao_secadora_baixo"); }, get SILK() { return tr("room.a_mao_torcer_baixo"); }, get LEATHER() { return tr("room.agua_pano_umido_hidratar"); }, get POLYESTER() { return tr("room.n40_baixo"); }, get SYNTHETIC() { return tr("room.n30_baixo"); }, get BLEND() { return tr("room.n30_medio"); } };
export const ORIGIN: Record<string, string> = { COMPRADA: "comprada", GARIMPADA: "garimpada", HERDADA: "herdada", PRESENTE: "presente", get FEITA_A_MAO() { return tr("room.feita_a_mao"); }, TROCADA: "trocada" };
export const mirrorPieces = (m?: MirrorState | null) => Object.values(m?.slots ?? {}).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []));

/** DET-G04 — modo foto: 4 enquadramentos, profundidade de campo e 3 filtros; a exportação sai só com a cena (sem a interface). */
export type Framing = "overview" | "closet" | "mirror" | "shoes";
export type PhotoFilter = "none" | "editorial" | "filme" | "pb";
export const FRAMINGS: Framing[] = ["overview", "closet", "mirror", "shoes"];
export const PHOTO_FILTERS: PhotoFilter[] = ["none", "editorial", "filme", "pb"];
export const FILTER_CSS: Record<PhotoFilter, string> = { none: "none", editorial: "contrast(1.1) saturate(0.88) brightness(1.02)", filme: "sepia(0.22) contrast(1.05) brightness(1.04) saturate(1.05)", pb: "grayscale(1) contrast(1.15)" };

export const slotsOf = (m?: MirrorState | null) => (m?.slots ?? {}) as unknown as Record<string, MirrorPiece | MirrorPiece[] | null>;

/** Prévia da organização automática, estado do Vista-me e do Copilot (como a página os guarda). */
export type OrganizationPreview = { moves?: { pieceId: string; from?: string; to: string; why?: string }[]; labels?: Record<string, string>; message?: string; explanation?: unknown };
export type VistaState = { open: boolean; busy: boolean; result: MirrorState | null };
export type CopilotState = { open: boolean; q: string; busy: boolean; text: string | null; point: string | null };
/** Tipos que a página passa aos hooks e às seções (os mesmos dos hooks de origem). */
export type Api<T> = ReturnType<typeof useApi<T>>;
export type Toast = ReturnType<typeof useToast>;
export type Translate = ReturnType<typeof useI18n>["t"];
export type Pins = ReturnType<typeof useMirrorPins>;
export type Me3d = ReturnType<typeof useMirrorAvatar>;
export type SetState<T> = Dispatch<SetStateAction<T>>;
