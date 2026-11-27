import { api, qs } from "@/lib/api/client";
import type {
  AcervoAmbiente,
  AcervoArvore,
  AcervoBusca,
  AcervoCompartimento,
  AcervoDesejo,
  AcervoDesejoForm,
  AcervoFinanceiro,
  AcervoIluminacao,
  AcervoLook,
  AcervoLugarDaPeca,
  AcervoLuzForm,
  AcervoMedidas,
  AcervoMovel,
  AcervoMovelForm,
  AcervoPrevia,
  AcervoTipo,
  AcervoUso,
} from "./types";

const BASE = "/api/me/acervo";
const part = encodeURIComponent;

/** ACERVO — chamadas da API. Tudo aqui é privado da dona das peças. */
export const acervoApi = {
  arvore: (signal?: AbortSignal) => api.get<AcervoArvore>(BASE, { signal }),
  criarAmbiente: (nome: string) => api.post<AcervoAmbiente>(`${BASE}/ambientes`, { nome }),
  renomearAmbiente: (id: string, nome: string) => api.put(`${BASE}/ambientes/${part(id)}`, { nome }),
  apagarAmbiente: (id: string) => api.delete(`${BASE}/ambientes/${part(id)}`),
  iluminarAmbiente: (id: string, form: AcervoLuzForm) =>
    api.put<{ id: string; iluminacao: AcervoIluminacao }>(`${BASE}/ambientes/${part(id)}/luz`, form),
  ordenarAmbientes: (ids: string[]) => api.put(`${BASE}/ambientes/ordem`, { ids }),
  criarMovel: (ambienteId: string, form: AcervoMovelForm) => api.post<AcervoMovel>(`${BASE}/ambientes/${part(ambienteId)}/moveis`, form),
  atualizarMovel: (id: string, form: AcervoMovelForm) => api.put<AcervoMovel>(`${BASE}/moveis/${part(id)}`, form),
  apagarMovel: (id: string) => api.delete(`${BASE}/moveis/${part(id)}`),
  ordenarMoveis: (ambienteId: string, ids: string[]) => api.put(`${BASE}/ambientes/${part(ambienteId)}/moveis/ordem`, { ids }),
  criarCompartimento: (movelId: string, tipo: AcervoTipo, nome?: string) =>
    api.post<AcervoCompartimento>(`${BASE}/moveis/${part(movelId)}/compartimentos`, { tipo, nome }),
  renomearCompartimento: (id: string, nome: string) => api.put<AcervoCompartimento>(`${BASE}/compartimentos/${part(id)}`, { nome }),
  apagarCompartimento: (id: string) => api.delete(`${BASE}/compartimentos/${part(id)}`),
  ordenarCompartimentos: (movelId: string, ids: string[]) => api.put(`${BASE}/moveis/${part(movelId)}/compartimentos/ordem`, { ids }),
  mover: (pieceIds: string[], compartimentoId: string | null) =>
    api.post<{ movidas: number; compartimentoId: string | null }>(`${BASE}/pecas/mover`, { pieceIds, compartimentoId }),
  medidas: (pieceId: string, medidas: AcervoMedidas) => api.put<AcervoMedidas>(`${BASE}/pecas/${part(pieceId)}/medidas`, medidas),
  lugar: (pieceId: string, signal?: AbortSignal) => api.get<AcervoLugarDaPeca>(`${BASE}/pecas/${part(pieceId)}/lugar`, { signal }),
  looks: (pieceId: string, signal?: AbortSignal) => api.get<AcervoLook[]>(`${BASE}/pecas/${part(pieceId)}/looks`, { signal }),
  previa: (escopo: "SEM_LUGAR" | "TUDO") => api.post<AcervoPrevia>(`${BASE}/arrumacao/previa`, { escopo }),
  confirmar: (movimentos: { pieceId: string; compartimentoId: string | null }[]) =>
    api.post<{ movidas: number }>(`${BASE}/arrumacao/confirmar`, { movimentos }),
  financeiro: (selecao: string[], signal?: AbortSignal) =>
    api.get<AcervoFinanceiro>(`${BASE}/financeiro${qs({ pecas: selecao.join(",") })}`, { signal }),
  busca: (texto: string, signal?: AbortSignal) => api.get<AcervoBusca>(`${BASE}/busca${qs({ q: texto })}`, { signal }),
  uso: (signal?: AbortSignal) => api.get<AcervoUso>(`${BASE}/uso`, { signal }),
  desejos: (signal?: AbortSignal) => api.get<AcervoDesejo[]>(`${BASE}/desejos`, { signal }),
  criarDesejo: (form: AcervoDesejoForm) => api.post<AcervoDesejo>(`${BASE}/desejos`, form),
  atualizarDesejo: (id: string, form: AcervoDesejoForm) => api.put<AcervoDesejo>(`${BASE}/desejos/${part(id)}`, form),
  apagarDesejo: (id: string) => api.delete(`${BASE}/desejos/${part(id)}`),
};
