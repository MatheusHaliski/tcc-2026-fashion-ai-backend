/** RF-PESQ-06 — amostra e lote de produção: revisão congelada, desvios, aprovação explícita. Sem cobrança. */
export type ProductionStatus = 'SAMPLE_REQUESTED' | 'SAMPLE_RECEIVED' | 'DEVIATIONS_RECORDED' | 'APPROVED' | 'RETURNED' | 'CANCELLED';
export interface SampleDeviation { id: string; measurementPoint: string; expected: string; measured: string; decision: 'PENDING' | 'ACCEPTED' | 'RETURNED'; justification: string | null; decidedBy: string | null; decidedAt: string | null; createdAt: string }
export interface ProductionRequest {
  id: string; projectId: string; revisionId: string; revisionNumber: number; producerId: string; producerName: string | null; quoteId: string | null; status: ProductionStatus;
  bomSnapshot: { id: string; kind: string; name: string; unit: string; quantity: number; notes: string | null }[]; tolerances: Record<string, string>; deviations: SampleDeviation[]; pendingDeviations: number;
  approvedBy: string | null; approvedAt: string | null; approvedProjectVersion: number | null; approvalValid: boolean; invalidatedByRevision: boolean; currentRevision: boolean;
  socialInterest: 'IGNORED'; commitment: 'NONE'; role: 'OWNER' | 'PRODUCER' | 'MEMBER'; version: number; createdAt: string; projectTitle?: string | null; specification?: Record<string, unknown> | null;
}
export interface ProductionDraft { revisionId: string; producerUsername: string; tolerances: Record<string, string>; quoteId: string | null }
