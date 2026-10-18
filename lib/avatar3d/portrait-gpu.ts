/*
 * Meu Avatar — retrato estilizado na GPU (SDXL + InstantID, POST /api/me/avatar3d/stylized-portrait). A foto do rosto
 * vira um desenho 3D semirrealista da pessoa, e volta junto a semelhança medida pelo ArcFace entre a foto e o retrato.
 * Nada é guardado: nem a foto (backend, worker e GPU) nem o retrato, que fica só nesta tela para ver e baixar.
 */
import { api } from "@/lib/api/client";
import { loadOriented } from "@/lib/avatar3d/pipeline";

export interface StylizedPortrait {
  image: string;               // data:image/jpeg;base64,...
  width: number;
  height: number;
  identitySimilarity: number;  // cosseno do ArcFace (-1..1)
  seed: number;
  style: string;
}

const MAX_SIDE = 1536;

async function jpeg(file: Blob): Promise<Blob> {
  const canvas = await loadOriented(file, MAX_SIDE);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG"))), "image/jpeg", 0.92));
}

/** Sem `seed`, o servidor sorteia outro retrato; o mesmo seed com a mesma foto repete o resultado. */
export async function stylizedPortraitOnGpu(file: Blob, seed?: number): Promise<StylizedPortrait> {
  const form = new FormData();
  form.append("photo", await jpeg(file), "rosto.jpg");
  form.append("consent", "true");
  if (seed !== undefined) form.append("seed", String(seed));
  return api.upload<StylizedPortrait>("/api/me/avatar3d/stylized-portrait", form);
}

/**
 * Faixas da semelhança (cosseno do ArcFace glintr100 entre foto e retrato). No ArcFace, ~0,36 já separa "mesma pessoa"
 * em fotos; num desenho estilizado o valor cai, então as faixas são para orientar, não para certificar identidade.
 */
export function similarityBand(similarity: number): "alta" | "media" | "baixa" {
  return similarity >= 0.5 ? "alta" : similarity >= 0.35 ? "media" : "baixa";
}

/** Motivo da recusa (details.reason) → o que a pessoa corrige na foto. Códigos desconhecidos não viram texto. */
export function portraitRefusalKey(reason?: unknown): string | null {
  const r = typeof reason === "string" ? reason : "";
  switch (r) {
    case "FACE_NOT_FOUND": case "DEGENERATE_FACE_LANDMARKS": return "avatar3d.portrait.motivo.sem_rosto";
    case "MULTIPLE_FACES_REJECTED": return "avatar3d.portrait.motivo.varios_rostos";
    case "FACE_TOO_SMALL": return "avatar3d.portrait.motivo.rosto_pequeno";
    case "GENERATED_FACE_REJECTED": case "DEGENERATE_GENERATED_IMAGE": return "avatar3d.portrait.motivo.resultado";
    case "GPU_BUSY_RETRY_LATER": case "WORKER_BUSY": case "GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD": return "avatar3d.portrait.motivo.ocupada";
    case "TASK_NOT_SUPPORTED_BY_MODEL": case "MODEL_NOT_READY": case "GPU_PREDICTION_FAILED": return "avatar3d.portrait.motivo.indisponivel";
  }
  return r.startsWith("VERTEX_") ? "avatar3d.portrait.motivo.indisponivel" : null;
}
