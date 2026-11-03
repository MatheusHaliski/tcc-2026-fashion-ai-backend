/*
 * MET Gala Heist v2 — beco (Z15): canvas → textura: canvas 2D, CanvasTexture em escala de mundo, normal pelo gradiente da altura,
 * conjunto PBR (cor, normal, ORM), leitura de máscara e traços que emendam na borda (trincas).
 */
import * as THREE from "three";

/* ---------- canvas → textura ---------- */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}
export function texFrom(c: HTMLCanvasElement, srgb: boolean, meters?: number | [number, number], clamp = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.anisotropy = 8;
  if (meters !== undefined) { const [mx, my] = typeof meters === "number" ? [meters, meters] : meters; t.repeat.set(1 / mx, 1 / my); }
  t.needsUpdate = true;
  return t;
}
/** Normal (espaço tangente) pelo gradiente de um campo de altura periódico w×h. */
export function normalCanvas(hf: Float32Array, w: number, h: number, strength: number, wrap = true): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = wrap ? (x - 1 + w) % w : Math.max(0, x - 1), xr = wrap ? (x + 1) % w : Math.min(w - 1, x + 1);
    const yu = wrap ? (y - 1 + h) % h : Math.max(0, y - 1), yd = wrap ? (y + 1) % h : Math.min(h - 1, y + 1);
    let nx = (hf[y * w + xl] - hf[y * w + xr]) * strength, ny = (hf[yd * w + x] - hf[yu * w + x]) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
export function dataCanvas(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h); img.data.set(data); g.putImageData(img, 0, 0); return c;
}
export interface PbrSet { map: THREE.Texture; normalMap: THREE.Texture; orm: THREE.Texture; meters: [number, number] }
export function pbr(w: number, h: number, meters: [number, number], color: Uint8ClampedArray, height: Float32Array, orm: Uint8ClampedArray, normalStrength: number): PbrSet {
  return { map: texFrom(dataCanvas(color, w, h), true, meters), normalMap: texFrom(normalCanvas(height, w, h, normalStrength), false, meters), orm: texFrom(dataCanvas(orm, w, h), false, meters), meters };
}
/** Lê um canvas desenhado (máscara em branco sobre preto) como 0–1 por pixel (canal vermelho). */
export function maskOf(c: HTMLCanvasElement): Float32Array {
  const g = c.getContext("2d")!, d = g.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}
/** Traço que dá a volta na borda (a textura emenda): desenha o caminho nas 9 posições vizinhas. */
export function wrapStroke(g: CanvasRenderingContext2D, S: number, pts: [number, number][]) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.stroke();
  }
}
/** Trinca: passeio aleatório com desvios curtos (e galhos), em pixels. */
export function crackPath(r: () => number, x: number, y: number, len: number, step: number, dir: number): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < len; k++) { dir += (r() - 0.5) * 0.9; x += Math.cos(dir) * step * (0.6 + r() * 0.8); y += Math.sin(dir) * step * (0.6 + r() * 0.8); pts.push([x, y]); }
  return pts;
}
