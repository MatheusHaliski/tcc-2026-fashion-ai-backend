/**
 * FashionAI Lens (RF54) — chamadas da API. Os ids vêm da URL: sempre codificados antes de entrar no caminho.
 * A imagem do scan é privada (chave restricted/…): é buscada com o cliente autenticado como blob e vira uma object URL.
 */
import { api, qs } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type {
  LensCreateInput, LensDetectionPatch, LensDetectionView, LensMatchView, LensMode, LensReadingView, LensRecreatePlan, LensScanCard, LensScanView, LensScope, LensSlotKind,
} from "./types";

const scan = (id: string) => `/api/lens/scans/${encodeURIComponent(id)}`;
const detection = (id: string, did: string) => `${scan(id)}/detections/${encodeURIComponent(did)}`;

export const lensApi = {
  /** multipart: image, source, intent, facesRedacted, redactionConfirmed → o scan já processado (MVP síncrono) */
  create(input: LensCreateInput) {
    const fd = new FormData();
    fd.append("image", input.image, "lens.jpg");
    fd.append("source", input.source);
    fd.append("intent", input.intent ?? "IDENTIFY");
    fd.append("facesRedacted", String(Math.max(0, Math.round(input.facesRedacted))));
    fd.append("redactionConfirmed", String(input.redactionConfirmed));
    return api.upload<LensScanView>("/api/lens/scans", fd);
  },
  get: (id: string, signal?: AbortSignal) => api.get<LensScanView>(scan(id), { signal }),
  /** object URL da imagem gravada (já sem EXIF/GPS e com rostos borrados); quem chama revoga */
  imageUrl: (id: string) => api.blobUrl(`${scan(id)}/image`),
  list: (params: { saved?: boolean; page?: number; size?: number }, signal?: AbortSignal) =>
    api.get<Page<LensScanCard>>(`/api/me/lens/scans${qs({ saved: params.saved ? "true" : undefined, page: params.page ?? 0, size: params.size ?? 12 })}`, { signal }),
  setSaved: (id: string, saved: boolean) => api.patch<LensScanView>(scan(id), { saved }),
  remove: (id: string) => api.delete<void>(scan(id)),
  matches: (id: string, params: { detection?: string | null; scope: LensScope }, signal?: AbortSignal) =>
    api.get<{ items: LensMatchView[] }>(`${scan(id)}/matches${qs({ detection: params.detection ?? undefined, scope: params.scope })}`, { signal }),
  reading: (id: string, detectionId?: string | null, signal?: AbortSignal) =>
    api.get<LensReadingView>(`${scan(id)}/reading${qs({ detection: detectionId ?? undefined })}`, { signal }),
  recreate: (id: string, body: { mode: LensMode; focus?: string | null; locked?: Partial<Record<LensSlotKind, string>> }) =>
    api.post<LensRecreatePlan>(`${scan(id)}/recreate`, {
      mode: body.mode, ...(body.focus ? { focus: body.focus } : {}), ...(body.locked && Object.keys(body.locked).length ? { locked: body.locked } : {}),
    }),
  patchDetection: (id: string, did: string, patch: LensDetectionPatch) => api.patch<LensDetectionView>(detection(id, did), patch),
  addDetection: (id: string, body: { box: { x: number; y: number; w: number; h: number }; category: string; subcategory?: string; color?: string }) =>
    api.post<LensDetectionView>(`${scan(id)}/detections`, body),
  setWanted: (id: string, did: string, wanted: boolean) => api.put<LensDetectionView>(`${detection(id, did)}/want`, { wanted }),
  /** "Eu tenho": com itemId liga à peça; sem, devolve o href de /pieces/new pré-preenchido (nunca com o recorte da foto) */
  own: (id: string, did: string, itemId?: string) => api.post<{ detection: LensDetectionView; href: string }>(`${detection(id, did)}/own`, itemId ? { itemId } : {}),
};
