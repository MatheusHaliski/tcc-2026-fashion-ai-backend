import { api, qs } from '@/lib/api/client';
/** RF-PESQ-08 — atributos de acessibilidade de uso declarados pela marca; filtros por requisição, sem perfil. */
export type Tri = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type AccessibilityStatus = 'DECLARED' | 'REVIEWED' | 'UNKNOWN';
export interface AccessibilityValues { closureType: string; openingPosition: string; magneticClosure: Tri; taglessLabel: Tri; flatSeams: Tri; fabricContact: string; oneHandDressing: Tri }
export interface AccessibilityInfo { productId: string; status: AccessibilityStatus; declarationSource?: string; values: Partial<AccessibilityValues>; descriptionKeys: string[]; notes?: string | null; reviewedAt?: string | null; updatedAt?: string | null; version?: number; clinicalClaim: 'NONE'; validatedWithUsers: false }
export interface AccessibilityFilters { easyClosure: boolean; frontOpening: boolean; magneticClosure: boolean; taglessLabel: boolean; flatSeams: boolean; softFabric: boolean; oneHandDressing: boolean }
export interface AccessibilityResult { product: { id: string; productName: string; imageUrl?: string | null; brand?: { name?: string } | null }; accessibility: AccessibilityInfo; unknownFilters: (keyof AccessibilityFilters)[] }
export interface AccessibilitySearch { filters: AccessibilityFilters; results: AccessibilityResult[]; withoutInformation: AccessibilityResult[]; withoutInformationCount: number; notice: 'NO_DATA_IS_NOT_UNSUITABLE'; preferencesStored: false }
export interface Declaration { declarationSource: 'BRAND_SPEC' | 'PHYSICAL_SAMPLE' | 'SUPPLIER_SHEET'; closureType: string; openingPosition: string; magneticClosure: Tri; taglessLabel: Tri; flatSeams: Tri; fabricContact: string; oneHandDressing: Tri; notes: string; expectedVersion?: number | null }
export const FILTER_KEYS: (keyof AccessibilityFilters)[] = ['easyClosure', 'frontOpening', 'magneticClosure', 'taglessLabel', 'flatSeams', 'softFabric', 'oneHandDressing'];
export const EMPTY_FILTERS: AccessibilityFilters = { easyClosure: false, frontOpening: false, magneticClosure: false, taglessLabel: false, flatSeams: false, softFabric: false, oneHandDressing: false };
const part = encodeURIComponent;
export const accessibilityApi = {
  search: (filters: AccessibilityFilters, category: string, signal?: AbortSignal) => api.get<AccessibilitySearch>(`/api/catalog/accessibility/search${qs({ ...filters, category: category || undefined })}`, { signal }),
  product: (productId: string, signal?: AbortSignal) => api.get<AccessibilityInfo>(`/api/catalog/products/${part(productId)}/accessibility`, { signal }),
  declare: (productId: string, body: Declaration) => api.put<AccessibilityInfo>(`/api/catalog/products/${part(productId)}/accessibility`, body),
  mine: (signal?: AbortSignal) => api.get<AccessibilityInfo[]>('/api/me/catalog/accessibility', { signal }),
};
