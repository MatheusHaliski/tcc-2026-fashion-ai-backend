/*
 * Provador — pontos do rosto e do corpo para a prévia 2D de acessórios, detectados no próprio navegador com os mesmos
 * modelos do Avatar 3D (/public/mediapipe). A foto não sai do aparelho para esta etapa.
 */
import { detectFace } from "@/lib/avatar3d/detect";
import { poseLandmarker } from "@/lib/avatar3d/body-detect";
import type { Detected } from "./accessory-2d";

/** Lado maior da imagem analisada: os pontos são normalizados, então reduzir só poupa tempo. */
const MAX_SIDE = 1024;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = () => reject(new Error("ACCESSORY_PHOTO_UNREADABLE"));
    img.src = src;
  });
}

/** Rosto principal e corpo principal da foto (`src` precisa ser legível pelo canvas: blob:, data: ou mesma origem). */
export async function detectForAccessories(src: string, needs: { face: boolean; pose: boolean }): Promise<Detected & { width: number; height: number }> {
  const img = await load(src);
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * k); canvas.height = Math.round(img.naturalHeight * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const face = needs.face ? (await detectFace(canvas)).lm : null;
  let pose: Detected["pose"] = null;
  if (needs.pose) {
    // a pessoa maior da foto (quem está provando), como no Avatar 3D
    const all = (await poseLandmarker()).detect(canvas).landmarks ?? [];
    const size = (lm: { y: number }[]) => Math.max(...lm.map((p) => p.y)) - Math.min(...lm.map((p) => p.y));
    const main = all.reduce<(typeof all)[number] | null>((best, lm) => (!best || size(lm) > size(best) ? lm : best), null);
    pose = main?.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })) ?? null;
  }
  return { face, pose, width: img.naturalWidth, height: img.naturalHeight };
}
