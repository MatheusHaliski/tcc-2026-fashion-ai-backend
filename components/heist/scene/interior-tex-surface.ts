/*
 * MET Gala Heist v2 — gerador de superfícies procedurais do interior (interior-tex.ts): a partir de uma função por pixel
 * (cor, altura, rugosidade) saem de uma vez o mapa de cor, o de relevo (normal map pelo gradiente da altura, com a borda
 * dando a volta) e o de rugosidade, em cache por chave. Também o canvas 2D e a textura que os desenhos usam.
 *
 * Nos testes (jsdom, contexto 2D falso) as texturas saem com 8 px: a cena monta igual, sem custo.
 */
import * as THREE from "three";

export type Quality = "high" | "low";

export const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ---------- superfícies ---------- */
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). */
export type PixelFn = (u: number, v: number, out: Float32Array) => void;

const surfaces = new Map<string, Surface>();

export function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, srgb: boolean, aniso = 8): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}

/** Gera cor, relevo (normal map pelo gradiente da altura, com a borda dando a volta) e rugosidade de uma vez. */
export function surface(key: string, size: number, fn: PixelFn, bump = 1.5): Surface {
  const hit = surfaces.get(key); if (hit) return hit;
  const n = FAKE ? 8 : size;
  const col = canvas(n, n), nor = canvas(n, n), rou = canvas(n, n);
  const ci = col.g.createImageData(n, n), ni = nor.g.createImageData(n, n), ri = rou.g.createImageData(n, n);
  const H = new Float32Array(n * n), out = new Float32Array(5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    out[3] = 0.5; out[4] = 0.5;
    fn((x + 0.5) / n, (y + 0.5) / n, out);
    const k = (y * n + x) * 4;
    ci.data[k] = Math.max(0, Math.min(255, out[0] * 255)); ci.data[k + 1] = Math.max(0, Math.min(255, out[1] * 255)); ci.data[k + 2] = Math.max(0, Math.min(255, out[2] * 255)); ci.data[k + 3] = 255;
    const r = Math.max(0, Math.min(255, out[4] * 255)); ri.data[k] = r; ri.data[k + 1] = r; ri.data[k + 2] = r; ri.data[k + 3] = 255;
    H[y * n + x] = out[3];
  }
  const s = bump * n / 256;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xl = (x - 1 + n) % n, xr = (x + 1) % n, yu = (y - 1 + n) % n, yd = (y + 1) % n;
    const dx = (H[y * n + xr] - H[y * n + xl]) * s, dy = (H[yd * n + x] - H[yu * n + x]) * s;
    const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4;
    ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  surfaces.set(key, sf);
  return sf;
}
