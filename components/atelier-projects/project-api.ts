import { api } from '@/lib/api/client';
import type { ProjectDetail, ProjectDraft, ProjectPage, ProjectSummary, Revision, TechPack } from './contracts';
const ROOT = '/api/atelier/projects';
export const projectApi = {
  list: (page: number, signal?: AbortSignal) => api.get<ProjectPage<ProjectSummary>>(`${ROOT}?page=${page}&size=24`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ProjectDetail>(`${ROOT}/${id}`, { signal }),
  create: (draft: ProjectDraft, requestId: string) => api.post<ProjectDetail>(ROOT, { ...draft, requestId }),
  save: (id: string, draft: ProjectDraft, expectedVersion: number) => api.put<ProjectDetail>(`${ROOT}/${id}`, { ...draft, expectedVersion }),
  revisions: (id: string, page = 0, signal?: AbortSignal) => api.get<ProjectPage<Revision>>(`${ROOT}/${id}/revisions?page=${page}&size=20`, { signal }),
  export: (id: string, revisionId: string) => api.get<TechPack>(`${ROOT}/${id}/revisions/${revisionId}/tech-pack`),
};
export async function downloadTechPack(id: string, revision: Revision) {
  const pack = await projectApi.export(id, revision.id);
  const href = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = `fai-tech-pack-v${revision.number}.json`; anchor.click();
  URL.revokeObjectURL(href);
}
