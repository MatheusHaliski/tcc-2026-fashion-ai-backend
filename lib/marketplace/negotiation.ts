export interface Negotiation {
  id: string;
  pieceId: string;
  storeId: string;
  ownerId: string;
  proposedBy: string;
  version: number;
  amount: number;
  currency: string;
  terms: string | null;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "REJECTED" | "EXPIRED";
}
