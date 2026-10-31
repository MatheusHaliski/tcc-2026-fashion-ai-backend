import type { Inspection, SceneDocument } from "@/lib/atelier3d/document";
export interface Asset {
  id: string;
  filename: string;
  bytes: number;
  sha256: string;
  inspection: Inspection;
}
export interface GenderEvidence {
  sources: {
    id: string;
    name: string;
    gender: string | null;
    normalized: string | null;
  }[];
  status: "READY" | "CONFLICT" | "INCOMPLETE";
  suggestion: string | null;
  hash: string;
  options: { id: string; codigo: string; nome: string }[];
}
export interface SceneVersion {
  id: string;
  sequence: number;
  assetId: string;
  author: string;
  createdAt: string;
  document: SceneDocument;
  gender: GenderEvidence;
  confirmedTipoLookId: string | null;
}
export interface SceneResponse {
  title: string;
  edit: boolean;
  export: boolean;
  manageGuests: boolean;
  asset: Asset | null;
  current: SceneVersion | null;
  history: Pick<
    SceneVersion,
    "id" | "sequence" | "assetId" | "author" | "createdAt"
  >[];
}
export interface SaveCommand {
  expectedSequence: number;
  assetId: string;
  requestId: string;
  document: SceneDocument;
  productIds: string[];
  confirmedTipoLookId: string | null;
  genderEvidenceHash: string | null;
}
export interface GuestInvite {
  id: string;
  label: string;
  role: "EDITOR" | "VIEWER";
  expiresAt: string;
  revoked: boolean;
  allowExport: boolean;
}
