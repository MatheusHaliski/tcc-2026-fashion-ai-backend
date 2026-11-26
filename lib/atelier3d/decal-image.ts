import { MAX_DECAL_IMAGE_CHARS } from "./decals";

/** Imagem enviada para logo: reduzida a no máximo 512 px e guardada no documento como data URL pequena. */
export interface DecalImage {
  dataUrl: string;
  /** Altura ÷ largura. */
  aspect: number;
}

const MAX_SIDE = 512;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("ATELIER_DECAL_IMAGE"));
    };
    image.src = url;
  });
}

/** PNG mantém a transparência do logo; se passar do limite, WebP (também com transparência) em qualidade menor. */
export async function readDecalImage(file: File): Promise<DecalImage> {
  if (!TYPES.has(file.type) || file.size > 10 * 1024 * 1024) throw Error("ATELIER_DECAL_IMAGE");
  const image = await decode(file);
  if (!image.naturalWidth || !image.naturalHeight) throw Error("ATELIER_DECAL_IMAGE");
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("ATELIER_DECAL_IMAGE");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const aspect = canvas.height / canvas.width;
  for (const [type, quality] of [["image/png", undefined], ["image/webp", 0.9], ["image/webp", 0.7]] as const) {
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrl.startsWith(`data:${type};base64,`) && dataUrl.length <= MAX_DECAL_IMAGE_CHARS) return { dataUrl, aspect };
  }
  throw Error("ATELIER_DECAL_IMAGE");
}
