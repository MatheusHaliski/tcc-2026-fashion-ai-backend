import { api } from '@/lib/api/client';
import type { SceneDocument } from '@/lib/atelier3d/document';
/** RF — editor 3D da peça: personalização por pessoa vinculada à peça original; o GLB nunca muda. */
export interface Customization {
  pieceId: string; baseModelUrl: string | null; modelAvailable: boolean; editable: boolean; viewOnly: boolean; assetApproval: string; quarantine: boolean; tryOnApproved: boolean;
  supports: { camera: boolean; materials: boolean; transforms: boolean; undoRedo: boolean; vertices: boolean }; document: SceneDocument; revision: number; savedAt: string | null; baseChanged: boolean;
  scaleIsVisualOnly: true; affectsOfficialMeasurements: false; affectsPassport: false; fitClaim: 'NONE';
}
const part = encodeURIComponent;
export const customizationApi = {
  get: (pieceId: string, signal?: AbortSignal) => api.get<Customization>(`/api/pieces/${part(pieceId)}/customization`, { signal }),
  save: (pieceId: string, body: { expectedRevision: number; document: SceneDocument; requestId: string }) => api.put<Customization>(`/api/pieces/${part(pieceId)}/customization`, body),
  reset: (pieceId: string) => api.delete(`/api/pieces/${part(pieceId)}/customization`),
};
