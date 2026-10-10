export interface SealReferencePiece {
  name?: string; quantifier: "AT_LEAST" | "EXACTLY" | "ALL" | "NONE"; count: number;
  category?: string; subcategory?: string; brand?: string; color?: string; material?: string;
  variation?: string; sex?: string; size?: string; market?: string;
  attributes?: Record<string, string[]>; background?: Record<string, unknown>;
}
export interface SealReferenceModel {
  version: 1; tier: "PERFIL" | "PECA" | "LOOK"; title: string; description: string; match: "ALL" | "ANY";
  target?: "PECA" | "LOOK" | "BOTH";
  earnedSeals?: { match: "ALL" | "ANY"; rules: { sealId: string; name?: string; scope: "PIECES" | "LOOK" | "ANY"; minCount: number }[] };
  pieces: SealReferencePiece[]; minPieces: number; maxPieces?: number; background?: Record<string, unknown>;
}
