/*
 * Quanto falta para o modelo 3D da peça (RF16), contado em ETAPAS que de fato aconteceram — nunca em porcentagem
 * inventada. O servidor manda números de referência em `progress` (5 na fila, 10–15 processando) que não medem nada;
 * só o provedor externo informa progresso real (`progressReal`), e só então a barra mostra porcentagem.
 *
 * As quatro etapas, na ordem do job (Model3dService):
 *   1. na fila          o pedido foi aceito (QUEUED)
 *   2. foto preparada   recorte sem fundo (estágio FOTO)
 *   3. modelo montado   envio ao provedor, reconstrução ou malha local (ENVIO, RECONSTRUCAO, SILHUETA, MALHA, TEXTURA)
 *   4. arquivo salvo    GLB no armazenamento (ARMAZENAMENTO / COMPLETED)
 * Sem pedido ainda: 0 de 4.
 */
export const MODEL3D_STEPS = 4;
export type Model3dPhase = "none" | "queued" | "running" | "ready" | "failed";
export interface Model3dStepInput {
  status?: string | null;
  modelUrl?: string | null;
  progress?: number | null;
  progressReal?: boolean | null;
  stages?: { name: string }[] | null;
}
export interface Model3dProgress {
  phase: Model3dPhase;
  /** etapas concluídas (0–4) */
  step: number;
  total: number;
  /** porcentagem só com progresso real do provedor; senão null */
  pct: number | null;
}

const MODEL_STAGES = new Set(["ENVIO", "RECONSTRUCAO", "SILHUETA", "MALHA", "TEXTURA"]);

export function model3dProgress(st: Model3dStepInput | null | undefined): Model3dProgress {
  const total = MODEL3D_STEPS;
  const status = st?.status ?? null;
  if (status === "FAILED") return { phase: "failed", step: 0, total, pct: null };
  if (status === "COMPLETED" || (!!st?.modelUrl && status !== "QUEUED" && status !== "PROCESSING")) return { phase: "ready", step: total, total, pct: null };
  if (status === "QUEUED") return { phase: "queued", step: 1, total, pct: null };
  if (status === "PROCESSING") {
    const names = new Set((st?.stages ?? []).map((s) => s.name));
    const step = names.has("ARMAZENAMENTO") ? 4 : 1 + (names.has("FOTO") ? 1 : 0) + ([...names].some((n) => MODEL_STAGES.has(n)) ? 1 : 0);
    const real = !!st?.progressReal && typeof st.progress === "number";
    return { phase: "running", step, total, pct: real ? Math.max(1, Math.min(99, Math.round(st!.progress!))) : null };
  }
  return { phase: "none", step: 0, total, pct: null };
}

/** Largura da barra (0–100): a porcentagem real quando houver; senão as etapas concluídas. */
export const model3dFill = (p: Model3dProgress) => (p.pct != null ? p.pct : Math.round((p.step / p.total) * 100));
