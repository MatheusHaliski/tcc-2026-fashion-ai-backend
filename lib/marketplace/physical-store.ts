export interface PhysicalStore {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  country: string;
  brand: string;
  brandProfileSlug: string | null;
  brandLogoUrl: string | null;
  mapSlug: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  floor: string | null;
  mapX: number | null;
  mapY: number | null;
}
