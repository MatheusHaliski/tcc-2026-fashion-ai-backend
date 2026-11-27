import * as THREE from "three";
import type { Pixels } from "./raster";
import { weaveNormalPixels } from "./weave";
import type { WeaveKind } from "./state";

/** Canvas 2D do navegador (ou o falso dos testes); null fora do DOM, onde não há textura a gerar. */
export function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d") ? canvas : null;
}

export function putPixels(canvas: HTMLCanvasElement, pixels: Pixels) {
  const context = canvas.getContext("2d");
  if (!context) return;
  if (canvas.width !== pixels.width || canvas.height !== pixels.height) {
    canvas.width = pixels.width;
    canvas.height = pixels.height;
  }
  const image = context.createImageData(pixels.width, pixels.height);
  image.data.set(pixels.data);
  context.putImageData(image, 0, 0);
}

/** Lê os pixels de uma imagem já decodificada (mapa original do GLB ou estampa enviada), redimensionada. */
export function readImagePixels(image: CanvasImageSource, width: number, height: number): Pixels | null {
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext("2d");
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    return { width, height, data: new Uint8ClampedArray(data) };
  } catch {
    return null;
  }
}

/** Textura de canvas no padrão glTF (flipY falso, sRGB para cor) para entrar no GLB exportado. */
export function canvasTexture(canvas: HTMLCanvasElement, color: boolean, wrap: THREE.Wrapping): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = wrap;
  texture.anisotropy = 4;
  // cor composta é opaca: JPEG no GLB exportado mantém o arquivo bem abaixo do teto de 8 MB
  if (color) texture.userData.mimeType = "image/jpeg";
  texture.needsUpdate = true;
  return texture;
}

const weaveCache = new Map<WeaveKind, HTMLCanvasElement | null>();

/** Mapa normal procedural da trama; uma textura por material (a repetição é por material). */
export function weaveNormalTexture(kind: WeaveKind): THREE.CanvasTexture | null {
  if (!weaveCache.has(kind)) {
    const canvas = createCanvas(256, 256);
    if (canvas) putPixels(canvas, weaveNormalPixels(kind, 256));
    weaveCache.set(kind, canvas);
  }
  const canvas = weaveCache.get(kind);
  return canvas ? canvasTexture(canvas, false, THREE.RepeatWrapping) : null;
}
