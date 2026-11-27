import type { HypeEntity, HypeLevel } from "@/lib/hype/types";

/** Circuito Aura — resposta de GET /api/hype/{type}/{id}/unlocks ("O que este card destrava"). */
export type AuraUnlockKind = "COUPON" | "SEAL_CAMPAIGN" | "FLAIR_BAND" | "MILESTONE_POINTS" | "AURA_REWARD";
export type AuraFamily = "COMMON" | "ELECTRO" | "SPLASH" | "HYPE" | "METAMORPHOSE" | "IMPERSONATION";

export interface AuraUnlockItem {
  kind: AuraUnlockKind; family: AuraFamily; title: string; detail?: string | null; href?: string | null;
  requiredLevel?: HypeLevel | null; met: boolean;
}

export interface AuraUnlocks {
  entityType: HypeEntity; entityId: string;
  status: "AVAILABLE" | "INSUFFICIENT_DATA" | "NOT_CALCULATED" | string;
  /** nulos quando o Hype não tem nota: nunca tratar como zero */
  score: number | null; level: HypeLevel | null;
  publicEligible: boolean; stale: boolean;
  /** o Hype conta para destravar (tem nota, é público e está atualizado) */
  counts: boolean;
  unlocked: AuraUnlockItem[]; next: AuraUnlockItem[];
  nextLevel: { level: HypeLevel; missingPoints: number } | null;
}

/** Parâmetro de URL que abre a análise do card já no painel ("?destrava=<id do card>"), usado pelo aviso de marco. */
export const UNLOCKS_PARAM = "destrava";

export const unlocksPath = (type: HypeEntity, id: string) => `/api/hype/${type}/${encodeURIComponent(id)}/unlocks`;

/** O endereço atual pede o painel deste card? (só no navegador; no servidor nunca abre) */
export function unlocksRequested(id: string, search = typeof window === "undefined" ? "" : window.location.search): boolean {
  return new URLSearchParams(search).get(UNLOCKS_PARAM) === id;
}

/** Só caminhos internos do app viram link; qualquer outra coisa vinda da API fica como texto. */
export const internalHref = (href?: string | null): string | null => (href && href.startsWith("/") && !href.startsWith("//") ? href : null);
