import { api } from '@/lib/api/client';
/** RF — passaporte digital da peça (ficha agregada, somente leitura) com procedência por campo. */
export type Provenance = 'VERIFIED' | 'SOURCE_DECLARED' | 'OWNER_DECLARED' | 'ESTIMATED' | 'NOT_INFORMED';
export interface SheetField { value: unknown; provenance: Provenance; informed: boolean }
export interface SizeMeasurement { region: string; protocol: string; min: number | null; max: number | null; unit: 'cm'; provenance: 'OFFICIAL' | 'OTHER_METHOD'; sourceName: string | null; sourceUrl: string | null; sourceRevision: string | null; chartRevision: number }
export interface SizeRow { label: string; source: 'GRID' | 'STORE' | 'CHART' | 'OWNER'; availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN'; measurements: SizeMeasurement[]; ownerDeclared: boolean; representation: 'VISUAL_APPROXIMATION' | 'NONE' }
export interface Representation3d { kind: 'APPROVED_ASSET' | 'SHOWCASE_GLB' | 'NONE'; approvedForTryOn: boolean; quarantine: string | null; origin: string | null; reviewStatus: string; provenance: Provenance; sizeVariants: 'RELATIVE_VISUAL_APPROXIMATION' | 'NONE' }
export interface SizeOptions { grid: 'letter' | 'numeric' | 'shoes' | null; sizes: SizeRow[]; representation3d: Representation3d; availabilityKnown: boolean; measurementsKnown: boolean; visualApproximationNote: string; avatarMeasurementsChanged: false; fitClaim: 'NONE' }
export interface DigitalPassport {
  identifier: string; pieceId: string; catalogProductId: string | null; access: 'OWNER' | 'VIEWER';
  identification: Record<'name' | 'brand' | 'category' | 'subcategory' | 'description' | 'productCode' | 'gtin' | 'catalogVerifiedAt', SheetField>;
  images: Record<'reference' | 'sourceUrl' | 'sourceDomain', SheetField>;
  materials: Record<'composition' | 'catalogMaterial' | 'care' | 'washing' | 'condition' | 'origin' | 'manufacturing', SheetField>;
  sizes: SizeOptions; model3d: Representation3d & { viewerUrl: SheetField; status: string | null; displayAllowed: boolean; tryOnApproved: boolean; generatedAt: string | null };
  provenanceLegend: Provenance[]; notices: string[]; lastUpdated: string | null;
}
const part = encodeURIComponent;
export const digitalPassportApi = {
  sheet: (pieceId: string, signal?: AbortSignal) => api.get<DigitalPassport>(`/api/pieces/${part(pieceId)}/digital-passport`, { signal }),
  productSizes: (productId: string, signal?: AbortSignal) => api.get<SizeOptions>(`/api/catalog/products/${part(productId)}/size-options`, { signal }),
};
