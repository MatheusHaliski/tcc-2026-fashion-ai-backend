import * as THREE from "three";
import { clonePixels, fillPixels, hexToRgb, tileOver, type Pixels } from "./raster";
import { composeLayers, type LayerCache } from "./paint";
import { cachedPatternPixels } from "./patterns";
import { decalTriangles, rasterDecal } from "./decal";
import { imagePixels, imagesVersion } from "./images";
import { canvasTexture, createCanvas, putPixels, readImagePixels } from "./textures";
import type { GarmentState } from "./state";

export const SURFACE_SIZE = 1024;

export interface SurfaceState {
  inputs: unknown[];
  canvas: HTMLCanvasElement | null;
  texture: THREE.CanvasTexture | null;
  cache: LayerCache;
  base?: { map: THREE.Texture | null; color: string; pixels: Pixels };
}

function sameInputs(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Fundo da superfície: mapa original do GLB multiplicado pela cor do material, ou a cor lisa. */
function basePixels(state: SurfaceState, map: THREE.Texture | null, color: string): Pixels {
  if (state.base && state.base.map === map && state.base.color === color) return state.base.pixels;
  const rgb = hexToRgb(color);
  const image = map?.image as CanvasImageSource | undefined;
  const pixels = (image && readImagePixels(image, SURFACE_SIZE, SURFACE_SIZE)) || fillPixels({ width: SURFACE_SIZE, height: SURFACE_SIZE, data: new Uint8ClampedArray(SURFACE_SIZE * SURFACE_SIZE * 4) }, [255, 255, 255]);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = (pixels.data[i] * rgb[0]) / 255;
    pixels.data[i + 1] = (pixels.data[i + 1] * rgb[1]) / 255;
    pixels.data[i + 2] = (pixels.data[i + 2] * rgb[2]) / 255;
    pixels.data[i + 3] = 255;
  }
  state.base = { map, color, pixels };
  return pixels;
}

/**
 * Textura de cor composta da parte: fundo → padrão repetido → estampas projetadas → camadas de pintura.
 * Recalcula só quando alguma entrada muda (o documento é imutável, então a comparação é por referência).
 */
export function syncSurface(
  state: SurfaceState | undefined,
  mesh: THREE.Mesh,
  key: string,
  garment: GarmentState | undefined,
  color: string,
  originalMap: THREE.Texture | null,
  original: Float32Array | undefined,
): SurfaceState | undefined {
  const layers = garment?.layers[key] ?? [];
  const pattern = garment?.patterns[key];
  const decals = garment?.decals.filter((decal) => decal.primitive === key) ?? [];
  if (!garment || (!layers.length && !pattern && !decals.length)) {
    state?.texture?.dispose();
    return undefined;
  }
  const usesImages = decals.length > 0 || pattern?.source.kind === "image";
  const inputs = [layers, pattern, color, originalMap, usesImages ? imagesVersion() : 0, ...decals];
  if (state && sameInputs(state.inputs, inputs)) return state;
  const next: SurfaceState = state ?? { inputs, canvas: null, texture: null, cache: new Map() };
  next.inputs = inputs;
  const surface = clonePixels(basePixels(next, originalMap, color));
  if (pattern) {
    const tile = pattern.source.kind === "procedural"
      ? cachedPatternPixels(pattern.source.pattern, pattern.source.colors)
      : imagePixels(garment.images[pattern.source.image]);
    if (tile) tileOver(surface, tile, pattern.scale, pattern.rotation, pattern.opacity);
  }
  const geometry = mesh.geometry;
  const uv = geometry.getAttribute("uv");
  for (const decal of decals) {
    const image = imagePixels(garment.images[decal.image]);
    if (!image || !uv || !original) continue;
    const uvs = Float32Array.from({ length: uv.count * 2 }, (_, i) => (i % 2 ? uv.getY(i >> 1) : uv.getX(i >> 1)));
    const triangles = decalTriangles(original, uvs, geometry.index?.array ?? null, decal, image.height / image.width);
    rasterDecal(surface, image, triangles, decal.opacity);
  }
  composeLayers(surface, layers, next.cache);
  next.canvas ??= createCanvas(SURFACE_SIZE, SURFACE_SIZE);
  if (!next.canvas) return next;
  putPixels(next.canvas, surface);
  next.texture ??= canvasTexture(next.canvas, true, THREE.RepeatWrapping);
  next.texture.needsUpdate = true;
  return next;
}
