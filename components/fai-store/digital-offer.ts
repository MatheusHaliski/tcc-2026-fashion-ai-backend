import type { CatalogProduct } from "@/lib/api/catalog";
import type { SealDesign } from "@/components/seal-medallion";

export interface DigitalOffer {
  code: string;
  name: string;
  kind: "EXCLUSIVE_PIECE" | "ACERVO" | "SEAL";
  points: number;
  product?: CatalogProduct;
  pieceId?: string | null;
  design?: SealDesign;
  purchasedAt?: string;
  pointsPaid?: number;
}
