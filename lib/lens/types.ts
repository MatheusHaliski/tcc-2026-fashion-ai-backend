/**
 * FashionAI Lens (RF54) — tipos do contrato da API (docs/novos-rf/RF54_FashionAI_Lens.md §9.3 e o contrato do MVP).
 * Tudo é do dono: qualquer outra pessoa recebe 404. JSON camelCase, datas ISO-8601.
 */
import type { PieceView } from "@/lib/api/types";

export type LensScanStatus = "READY" | "PARTIAL" | "NO_FASHION_FOUND" | "FAILED";
export type LensErrorCode = "NO_FASHION_FOUND" | "CONSENT_REQUIRED" | "QUOTA" | "FAILED" | "REDACTION_UNCONFIRMED";
export type LensSource = "CAMERA" | "GALLERY" | "UPLOAD" | "IN_APP_PIECE" | "IN_APP_LOOK";
export type LensIntent = "IDENTIFY" | "RECREATE";
export type LensConfidenceBand = "HIGH" | "MEDIUM" | "LOW";
export type LensDetectionStatus = "DETECTED" | "CORRECTED" | "ADDED_BY_USER";
export type LensScope = "MY_CLOSET" | "COMMUNITY";
export type LensMode = "SAFE" | "DISCOVERY" | "EXPERIMENTAL";
export type LensSlotKind = "TOP" | "BOTTOM" | "FULL" | "SHOES" | "ACCESSORY";
export type LensSlotState = "own" | "alternative" | "gap";
export type LensDirection = "UP" | "DOWN" | "STABLE";
/** Códigos de motivo da semelhança (§9.2). */
export type LensReason = "SAME_SUBCATEGORY" | "SAME_CATEGORY" | "COLOR_CLOSE" | "SAME_PATTERN" | "SAME_MATERIAL" | "STYLE_OVERLAP" | "VISUAL_CLOSE";

/** Caixa da peça em % da imagem (0–100), canto superior esquerdo. */
export interface LensBox { x: number; y: number; w: number; h: number }
export interface LensColor { name: string; hex: string | null; share: number }

export interface LensDetectionView {
  id: string; ordinal: number; box: LensBox;
  /** nome descritivo ("Jaqueta jeans") */
  label: string;
  /** chaves da taxonomia (upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece) */
  category: string | null; subcategory: string | null;
  /** cor principal primeiro */
  colors: LensColor[];
  material: string | null; pattern: string | null;
  styles: string[]; occasions: string[];
  /** 0–1 */
  confidence: number; confidenceBand: LensConfidenceBand;
  status: LensDetectionStatus;
  wanted: boolean; ownedItemId: string | null;
  /** melhor correspondência no guarda-roupa */
  topMatch: { pieceId: string; similarity: number } | null;
}

export interface LensFit { score: number; parts: Record<string, number> }
export interface LensTrend {
  status: "AVAILABLE" | "INSUFFICIENT_DATA"; key: string | null; label: string | null; score: number | null;
  level: string | null; direction: LensDirection | null; items: number;
}
export interface LensImpact { ownedMatches: number; gaps: number; redundancy: number }
export interface LensReadingView {
  /** composição de estilo (soma ≈ 100) */
  styles: { key: string; share: number }[];
  palette: { name: string; hex: string | null }[];
  occasions: string[]; season: string | null;
  /** compatibilidade com o DNA (StyleCompatibility); null sem DNA */
  fit: LensFit | null;
  /** Hype do grupo de peças parecidas (≥ 5 itens públicos) */
  trend: LensTrend;
  impact: LensImpact;
}

export interface LensScanView {
  id: string; status: LensScanStatus; errorCode?: LensErrorCode | string | null;
  source: LensSource; intent: LensIntent;
  createdAt: string; expiresAt: string | null;
  /** salvo como inspiração (não expira) */
  savedAt: string | null;
  width: number; height: number; facesRedacted: number;
  /** "local" = leitura degradada (sem IA externa) — a UI avisa */
  aiSource: "ia" | "local";
  algorithmVersion: "LENS_V1" | string; modelVersion: string;
  /** DISMISSED não vem */
  detections: LensDetectionView[];
  reading: LensReadingView;
}

export interface LensMatchView {
  scope: LensScope; targetType: "PIECE"; targetId: string;
  /** 0–100 */
  similarity: number;
  components: { visual: number | null; attributes: number; color: number | null };
  reasons: (LensReason | string)[];
  piece: PieceView;
}

export interface LensScores { compatibility: number | null; hype: number | null; novelty: number | null; reuse: number | null; usage: number | null; sustainability: number | null }
export interface LensSlot { slot: LensSlotKind; detectionId: string | null; state: LensSlotState; piece: PieceView | null; alternatives: PieceView[] }
export interface LensRecreatePlan {
  mode: LensMode; slots: LensSlot[];
  /** peças próprias escolhidas */
  pieceIds: string[];
  scores: LensScores;
  /** "/schemes/new?pieces=a,b,c" */
  createHref: string;
}

export interface LensScanCard {
  id: string; createdAt: string; savedAt: string | null; status: LensScanStatus | string;
  detections: number; topStyle: string | null; owned: number; gaps: number;
}

/** PATCH de uma detecção: correção de atributos (grava lens_feedback e refaz as relações) ou "não é roupa". */
export interface LensDetectionPatch {
  category?: string; subcategory?: string; color?: string; material?: string; pattern?: string; styles?: string[]; dismissed?: boolean;
}

export interface LensCreateInput {
  image: Blob; source: LensSource; intent?: LensIntent;
  /** rostos borrados no aparelho antes do envio */
  facesRedacted: number;
  /**
   * a foto chega protegida: o borrão de rostos rodou no aparelho ou, sem detector, a pessoa confirmou que ela não mostra
   * rostos. Sem isso (false ou ausente) o servidor faz só a leitura local: a foto não vai à IA online
   */
  redactionConfirmed: boolean;
}
