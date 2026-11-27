import { api } from '@/lib/api/client';
/** RF-PESQ-09 — plano de compras por lacunas e orçamento. Calculado sob demanda; nunca executa compra. */
export interface Gap { occasion: string; slot: string }
export interface Candidate { product: { id: string; productName: string; imageUrl?: string | null; brand?: { name?: string } | null }; slot: string; coversOccasions: string[]; complements: { id: string; name: string; category: string }[]; price: number | null; currency: string | null; priceSource: string | null; priceCheckedAt: string | null; priceConfirmed: boolean; withinBudget: boolean; reason: 'FILLS_GAP' }
export interface ShoppingPlan { occasions: string[]; coverage: Record<string, string[]>; gaps: Gap[]; candidates: Candidate[]; budget: number; currency: string; guaranteedTotal: number; remainingBudget: number; outsideGuaranteedTotal: number; computedAt: string; purchaseExecuted: false; evidenceScope: 'OWN_WARDROBE_ONLY' }
export interface PlanRequest { occasions: string[]; budget: number; currency: string; excludedCategories: string[] }
const part = encodeURIComponent;
export const shoppingPlanApi = {
  plan: (body: PlanRequest) => api.post<ShoppingPlan>('/api/me/shopping-plan', body),
  dismissals: (signal?: AbortSignal) => api.get<{ productId: string; kind: 'OWNED' | 'NOT_NEEDED' }[]>('/api/me/shopping-plan/dismissals', { signal }),
  dismiss: (productId: string, kind: 'OWNED' | 'NOT_NEEDED') => api.put(`/api/me/shopping-plan/dismissals/${part(productId)}`, { kind }),
  undismiss: (productId: string) => api.delete(`/api/me/shopping-plan/dismissals/${part(productId)}`),
};
