import type { SceneDocument } from "../document";
import type { Pixels } from "./raster";
import { createCanvas, readImagePixels } from "./textures";
import { GARMENT_LIMITS } from "./state";

/**
 * Estampas enviadas viram PNG/JPEG rasterizado (SVG inclusive: desenhado como imagem, sem scripts) com no
 * máximo 512 px, guardado como data URL no documento. A decodificação é assíncrona e fica em cache.
 */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_UPLOAD = 5 * 1024 * 1024;
const decoded = new Map<string, Pixels | "loading" | "failed">();
const listeners = new Set<() => void>();
let version = 0;

export function imagesVersion() {
  return version;
}
export function onImagesReady(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  return image;
}

async function decode(url: string): Promise<Pixels | null> {
  try {
    const image = await loadImage(url);
    return readImagePixels(image, image.naturalWidth || 512, image.naturalHeight || 512);
  } catch {
    return null;
  }
}

/** Pixels já decodificados; senão agenda a decodificação e avisa os ouvintes quando terminar. */
export function imagePixels(url: string | undefined): Pixels | null {
  if (!url) return null;
  const hit = decoded.get(url);
  if (hit && typeof hit !== "string") return hit;
  if (hit || typeof Image === "undefined") return null;
  decoded.set(url, "loading");
  void decode(url).then((pixels) => {
    if (decoded.size > 32) decoded.clear();
    decoded.set(url, pixels ?? "failed");
    version++;
    listeners.forEach((listener) => listener());
  });
  return null;
}

/** Antes de exportar: garante que toda estampa do documento já está em pixels. */
export async function preloadGarmentImages(doc: SceneDocument) {
  await Promise.all(Object.values(doc.garment?.images ?? {}).map(async (url) => {
    if (decoded.get(url) && typeof decoded.get(url) !== "string") return;
    const pixels = await decode(url);
    decoded.set(url, pixels ?? "failed");
  }));
  version++;
}

function encode(canvas: HTMLCanvasElement, opaque: boolean, quality: number) {
  return opaque ? canvas.toDataURL("image/jpeg", quality) : canvas.toDataURL("image/png");
}

/** Converte o arquivo enviado em data URL compacta, dentro do limite por imagem do documento. */
export async function importGarmentImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_UPLOAD) throw Error("ATELIER_IMAGE_TYPE");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const width = image.naturalWidth || 512, height = image.naturalHeight || 512;
    for (const side of [512, 384, 256]) {
      const scale = Math.min(1, side / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      const canvas = createCanvas(w, h);
      const context = canvas?.getContext("2d");
      if (!canvas || !context) throw Error("ATELIER_IMAGE_TYPE");
      context.drawImage(image, 0, 0, w, h);
      const alpha = context.getImageData(0, 0, w, h).data;
      let opaque = file.type === "image/jpeg";
      if (!opaque) {
        opaque = true;
        for (let i = 3; i < alpha.length; i += 4) if (alpha[i] < 255) { opaque = false; break; }
      }
      const data = encode(canvas, opaque, 0.86);
      if (data.length <= GARMENT_LIMITS.imageChars) return data;
    }
    throw Error("ATELIER_IMAGE_SIZE");
  } finally {
    URL.revokeObjectURL(url);
  }
}
