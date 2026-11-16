export type PassportField = 'NAME' | 'ORIGIN' | 'COMPOSITION' | 'CARE' | 'HISTORY' | 'MANUFACTURING';
export type PassportOrigin = 'UNKNOWN' | 'COMPRADA' | 'GARIMPADA' | 'HERDADA' | 'PRESENTE' | 'FEITA_A_MAO' | 'TROCADA' | 'SOB_ENCOMENDA';
export type PassportEventKind = 'PURCHASE' | 'CARE' | 'REPAIR' | 'ALTERATION' | 'CORRECTION' | 'TRANSFER' | 'DECLARATION' | `FACTORY_${string}`;
export type EventProvenance = 'OWNER_DECLARED' | 'SYSTEM_RECORDED';
/** Registro de fabricação de uma peça da Fábrica FashionAI (fictícia); o link público recebe só parte dele. */
export type ManufacturingRecord = Record<string, unknown> & { provenance: 'SYSTEM_RECORDED' };
export interface PassportEvent { id: string; kind: PassportEventKind; occurredOn: string; notes: string | null; provenance: EventProvenance; correctsEventId: string | null }
export interface PassportEvidence { id: string; kind: string; status: 'PRESENTED_UNVERIFIED' | 'EXPIRED'; expiresAt: string; version: number }
export interface PassportShare { id: string; fields: PassportField[]; expiresAt: string; revoked: boolean; version: number }
export interface PassportTransfer { id: string; passportId: string; status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED'; expiresAt: string; version: number; recipientPieceId: string | null }
export interface GarmentPassport { id: string; pieceId: string; version: number; pieceName: string; origin: PassportOrigin; composition: string | null; care: string | null; provenance: 'OWNER_DECLARED'; events: PassportEvent[]; evidence: PassportEvidence[]; shares: PassportShare[]; transfers: PassportTransfer[]; manufacturing: ManufacturingRecord | null }
export interface PublicPassport { provenance: 'OWNER_DECLARED'; authentication: 'NOT_VERIFIED'; expiresAt: string; pieceName?: string; origin?: PassportOrigin; composition?: string | null; care?: string | null; events?: Pick<PassportEvent, 'kind' | 'occurredOn' | 'provenance'>[]; manufacturing?: ManufacturingRecord }
export interface ResaleDraft { title: string; forSale: boolean; forDonation: boolean; price: number | null; currency: string; composition: string | null; care: string | null; origin: PassportOrigin; provenance: 'OWNER_DECLARED'; authentication: 'NOT_VERIFIED' }
