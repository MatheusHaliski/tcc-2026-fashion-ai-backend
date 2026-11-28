export interface MarketplaceMap {
  slug: string;
  name: string;
  kind: "SHOPPING" | "OUTLET" | "SHOPPING_STREET";
  city: string;
  region: string;
  imageUrl: string | null;
}
