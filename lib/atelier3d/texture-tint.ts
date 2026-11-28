import * as THREE from "three";

/**
 * Troca de cor de material com textura. No GLB do motor a cor do tecido está NA textura (trama + cor); multiplicar por
 * uma cor só escurece — tecido preto nunca viraria branco. Aqui a textura é refeita: cada pixel mantém a diferença
 * para a cor média (a trama, o relevo do fio) e a média passa a ser a cor escolhida.
 */
export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("");
}

/** Cor média dos pixels visíveis (peso = alfa), em sRGB 0–255. */
export function meanColor(data: ArrayLike<number>): Rgb {
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    r += data[i] * alpha;
    g += data[i + 1] * alpha;
    b += data[i + 2] * alpha;
    weight += alpha;
  }
  return weight ? [r / weight, g / weight, b / weight] : [255, 255, 255];
}

/** Recolore no lugar: média vira `target`, detalhe (pixel − média) é preservado; o alfa não muda. */
export function recolorPixels(data: Uint8ClampedArray | number[], mean: Rgb, target: Rgb): void {
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(target[c] + data[i + c] - mean[c])));
}

type Drawable = CanvasImageSource & { width: number; height: number };

function canvasOf(image: Drawable): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined" || !image?.width || !image?.height) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return { canvas, context };
  } catch {
    return null; // sem canvas 2D (testes, navegador restrito): o editor cai na cor multiplicada
  }
}

const means = new WeakMap<object, Rgb | null>();

/** Cor média da imagem de uma textura; null quando não há como ler os pixels. */
export function textureMean(texture: THREE.Texture | null | undefined): Rgb | null {
  const image = texture?.image as Drawable | undefined;
  if (!image) return null;
  if (means.has(image)) return means.get(image)!;
  const drawn = canvasOf(image);
  const mean = drawn ? meanColor(drawn.context.getImageData(0, 0, drawn.canvas.width, drawn.canvas.height).data) : null;
  means.set(image, mean);
  return mean;
}

/** Cópia da textura com a cor média trocada; mantém UV, repetição, filtro e espaço de cor da original. */
export function tintedTexture(source: THREE.Texture, color: string): THREE.Texture | null {
  const mean = textureMean(source), drawn = canvasOf(source.image as Drawable);
  if (!mean || !drawn) return null;
  const pixels = drawn.context.getImageData(0, 0, drawn.canvas.width, drawn.canvas.height);
  recolorPixels(pixels.data, mean, hexToRgb(color));
  drawn.context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(drawn.canvas);
  texture.name = source.name;
  texture.flipY = source.flipY;
  texture.colorSpace = source.colorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.channel = source.channel;
  texture.anisotropy = source.anisotropy;
  texture.offset.copy(source.offset);
  texture.repeat.copy(source.repeat);
  texture.center.copy(source.center);
  texture.rotation = source.rotation;
  return texture;
}
