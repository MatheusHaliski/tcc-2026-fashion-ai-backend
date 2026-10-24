export type PassportField = 'NAME' | 'ORIGIN' | 'COMPOSITION' | 'CARE' | 'HISTORY';
export type PassportOrigin = 'UNKNOWN' | 'COMPRADA' | 'GARIMPADA' | 'HERDADA' | 'PRESENTE' | 'FEITA_A_MAO' | 'TROCADA';
export type PassportEventKind = 'PURCHASE' | 'CARE' | 'REPAIR' | 'ALTERATION' | 'CORRECTION' | 'TRANSFER' | 'DECLARATION';
export interface PassportEvent { id: string; kind: PassportEventKind; occurredOn: string; notes: string | null; provenance: 'OWNER_DECLARED'; correctsEventId: string | null }
export interface PassportEvidence { id: string; kind: string; status: 'PRESENTED_UNVERIFIED' | 'EXPIRED'; expiresAt: string; version: number }
export interface PassportShare { id: string; fields: PassportField[]; expiresAt: string; revoked: boolean; version: number }
export interface PassportTransfer { id: string; passportId: string; status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED'; expiresAt: string; version: number; recipientPieceId: string | null }
export interface GarmentPassport { id: string; pieceId: string; version: number; pieceName: string; origin: PassportOrigin; composition: string | null; care: string | null; provenance: 'OWNER_DECLARED'; events: PassportEvent[]; evidence: PassportEvidence[]; shares: PassportShare[]; transfers: PassportTransfer[] }
export interface PublicPassport { provenance: 'OWNER_DECLARED'; authentication: 'NOT_VERIFIED'; expiresAt: string; pieceName?: string; origin?: PassportOrigin; composition?: string | null; care?: string | null; events?: Pick<PassportEvent, 'kind' | 'occurredOn' | 'provenance'>[] }
export interface ResaleDraft { title: string; forSale: boolean; forDonation: boolean; price: number | null; currency: string; composition: string | null; care: string | null; origin: PassportOrigin; provenance: 'OWNER_DECLARED'; authentication: 'NOT_VERIFIED' }
