import { ApiError, api } from "@/lib/api/client";

/** A rota estável existe também em backends anteriores ao atalho especializado do Copilot. */
export async function requestSealPolicyDraft<T>(payload: unknown): Promise<T> {
  try { return await api.post<T>("/api/seals/draft", payload); }
  catch (error) {
    // Só uma rota ausente autoriza o alias: falhas de inferência não devem gerar outra execução.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    return await api.post<T>("/api/copilot/seal-policy", payload);
  }
}
