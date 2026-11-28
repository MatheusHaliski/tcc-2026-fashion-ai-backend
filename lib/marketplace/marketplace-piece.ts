export interface MarketplacePiece {
  id: string;
  name: string;
  imageUrl: string | null;
  expiresAt: string | null;
  forSale: boolean;
  price: number | null;
  status: "STANDARD" | "SPECIAL";
}
