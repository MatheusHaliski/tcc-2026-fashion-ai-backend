/**
 * Orçamento de textura do provador: lado máximo de 1024 px por mapa (cor, normal, rugosidade/metal, oclusão,
 * emissão). Parte dos .glb da Meshy vem com 2048 px (texture_resolution "2k" pedido na geração); no provador o mapa é
 * reduzido uma vez, ao carregar, antes de ir para a GPU (¼ da memória de vídeo). O .glb do bucket não muda.
 */
import * as THREE from "three";

export const TEXTURE_BUDGET = 1024;
const MAPS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const;

type Sized = CanvasImageSource & { width: number; height: number };

/** Lado alvo de um mapa (mantém a proporção; nunca aumenta). */
export function budgetSize(width: number, height: number, max = TEXTURE_BUDGET): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

function shrink(image: Sized, max: number): HTMLCanvasElement | null {
  const size = budgetSize(image.width, image.height, max);
  if (size.width === image.width && size.height === image.height) return null;
  const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size.width, size.height);
  return canvas;
}

/** Reduz os mapas acima do orçamento (cada textura uma vez, mesmo compartilhada entre mapas). Devolve quantas mudou. */
export function clampTextures(root: THREE.Object3D, max = TEXTURE_BUDGET): number {
  if (typeof document === "undefined") return 0;
  const seen = new Set<THREE.Texture>(); let changed = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    for (const material of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      for (const key of MAPS) {
        const tex = material[key] as THREE.Texture | null | undefined; if (!tex || seen.has(tex)) continue;
        seen.add(tex);
        const image = tex.image as Sized | undefined; if (!image?.width) continue;
        const small = shrink(image, max); if (!small) continue;
        (image as Partial<ImageBitmap>).close?.();
        tex.image = small; tex.needsUpdate = true; changed++;
      }
    }
  });
  return changed;
}
