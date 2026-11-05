/** RF-PESQ-03 — ciclo de lavanderia. Estado de uso ≠ condição física ≠ arquivo. */
export type WearState = 'CLEAN' | 'WORN' | 'IN_WASH';
export interface LaundryPiece { id: string; name: string; category: string; thumbnailUrl: string | null; material: string | null; washCode: string | null; washName: string | null; careInstructions: string | null; disponivel: boolean; archived: boolean; wearState: WearState; batchId: string | null; changedAt: string | null }
export interface LaundryBatch { id: string; status: 'WASHING' | 'DONE' | 'CANCELLED'; instructionCode: string | null; instructions: string | null; startedAt: string; finishedAt: string | null; version: number; pieces: LaundryPiece[] }
export interface LaundryGroup { key: string; source: 'DECLARED_INSTRUCTION' | 'DECLARED_COMPOSITION'; pieceIds: string[] }
export interface LaundryConflict { day: string; eventLabel: string | null; pieceId: string; pieceName: string | null }
export interface LaundryBoard { clean: number; worn: LaundryPiece[]; inWash: LaundryPiece[]; batches: LaundryBatch[]; suggestions: LaundryGroup[]; missingData: string[]; conflicts: LaundryConflict[] }
export interface BatchForm { pieceIds: string[]; instructionCode: string | null; instructions: string; confirmed: boolean }
