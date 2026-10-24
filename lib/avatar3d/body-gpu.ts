/*
 * Avatar 3D — medida do corpo na GPU (SAM 3D Body, POST /api/me/avatar3d/body-scan). A mesma foto de corpo inteiro
 * vira uma malha 3D no servidor e voltam só as proporções (fração da estatura, como em body-spec.ts), inclusive as
 * profundidades do tronco que a medida no aparelho só tira de uma foto de perfil. A foto não é guardada: nem no
 * backend, nem no worker, nem na GPU. Cada envio pede o consentimento de novo.
 */
import { api } from "@/lib/api/client";
import { loadOriented } from "@/lib/avatar3d/pipeline";
import { BODY_RANGE, type BodyModel, type BodySources } from "@/lib/avatar3d/body-spec";

export const GPU_KEYS = ["shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "chestD", "waistD", "hipD"] as const;
export type GpuKey = (typeof GPU_KEYS)[number];

export interface GpuMeasurement {
  ratios: Partial<Record<GpuKey, number>>;
  refused: Partial<Record<GpuKey, string>>;
  warnings: string[];
  modelRevision?: string;
}

/** Lado máximo que a GPU aceita; a foto sai do aparelho já reduzida e em JPEG (sem os metadados do arquivo original). */
const MAX_SIDE = 1536;

async function jpeg(file: Blob): Promise<Blob> {
  const canvas = await loadOriented(file, MAX_SIDE);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG"))), "image/jpeg", 0.92));
}

export async function measureBodyOnGpu(file: Blob): Promise<GpuMeasurement> {
  const form = new FormData();
  form.append("photo", await jpeg(file), "corpo.jpg");
  form.append("consent", "true");
  return api.upload<GpuMeasurement>("/api/me/avatar3d/body-scan", form);
}

/**
 * Aplica a medida da GPU: cada proporção medida passa a ser "medida na foto" (observed), substituindo a do aparelho;
 * a que a GPU recusou fica como estava. A estatura continua vindo da altura informada (a foto não tem escala).
 */
export function mergeGpuMeasurement(m: BodyModel, g: GpuMeasurement): BodyModel {
  const params = { ...m.params };
  const sources = { ...m.sources } as BodySources;
  let applied = 0;
  for (const k of GPU_KEYS) {
    const v = g.ratios?.[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < BODY_RANGE[k][0] || v > BODY_RANGE[k][1]) continue;
    params[k] = v; sources[k] = "observed"; applied++;
  }
  return applied ? { ...m, params, sources, photo: true } : m;
}

/** Motivo da recusa (details.reason) → o que a pessoa corrige na foto. Códigos desconhecidos não viram texto. */
export function gpuRefusalKey(reason?: unknown): string | null {
  const r = typeof reason === "string" ? reason : "";
  switch (r) {
    case "FULL_BODY_NOT_VISIBLE": return "avatar3d.body.gpu.motivo.corpo_inteiro";
    case "EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED": case "INVALID_PERSON_DETECTION": return "avatar3d.body.gpu.motivo.pessoa";
    case "VISIBLE_LANDMARK_OUTSIDE_IMAGE": return "avatar3d.body.gpu.motivo.fora";
    case "ONE_BODY_RECONSTRUCTION_REQUIRED": case "INVALID_BODY_MESH": case "INVALID_BODY_KEYPOINTS": case "IMPLAUSIBLE_BODY_SCALE":
    case "IMPLAUSIBLE_BODY_PROPORTIONS": case "DEGENERATE_BODY_FRAME": case "NONFINITE_DWPOSE": return "avatar3d.body.gpu.motivo.reconstrucao";
    case "GPU_BUSY_RETRY_LATER": case "WORKER_BUSY": case "GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD": return "avatar3d.body.gpu.motivo.ocupada";
    case "TASK_NOT_SUPPORTED_BY_MODEL": case "MODEL_NOT_READY": case "GPU_PREDICTION_FAILED": return "avatar3d.body.gpu.motivo.indisponivel";
  }
  return r.startsWith("VERTEX_") ? "avatar3d.body.gpu.motivo.indisponivel" : null;
}

/** Por que uma proporção não foi medida (refused) → frase curta; desconhecido vira o genérico. */
export function gpuRefusedKey(code: string): string {
  return code === "SLICE_WITHOUT_TORSO" || code === "ARMS_CLOSE_TO_BODY" || code === "OUT_OF_ADULT_RANGE"
    ? `avatar3d.body.gpu.recusa.${code}` : "avatar3d.body.gpu.recusa.outro";
}
