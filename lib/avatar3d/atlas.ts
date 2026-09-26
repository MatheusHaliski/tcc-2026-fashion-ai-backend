/*
 * Avatar 3D (RF40) — textura do rosto ("atlas") no UV canônico. Cada triângulo da malha recebe o pedaço da foto em
 * que ele aparece mais de frente; como a malha usa os mesmos pontos detectados na foto, geometria e textura coincidem
 * por construção (o olho da foto cai no olho da malha, de frente e de 3/4). Nada de projetar a foto numa cabeça
 * genérica.
 *
 * Tratamento de luz, conservador: as fotos de lado são igualadas em cor à de frente (ganho por canal nas áreas que as
 * duas mostram) e uma luz lateral forte é suavizada por uma rampa de ganho da esquerda para a direita que preserva a
 * média — o tom de pele da pessoa não muda. A borda do rosto se funde na cor de pele medida na própria foto.
 */
import { CANON_TRI, CANON_UV, FACE_OVAL } from "./canonical-face";
import { visibility, type Role, type Similarity } from "./geometry";
import { luma, polygonMask, type Pt } from "./image-stats";

export interface AtlasView { role: Role; canvas: HTMLCanvasElement; px: Pt[]; sim: Similarity }

function affine(s: Pt[], d: Pt[]): [number, number, number, number, number, number] | null {
  const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2]; const [u0, v0] = d[0], [u1, v1] = d[1], [u2, v2] = d[2];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(det) < 1e-6) return null;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det, c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det, dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0];
}

function canvas(w: number, h: number): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

/** Cor média da foto no centro dos triângulos que as duas fotos mostram bem de frente. */
function sharedMean(img: ImageData, px: Pt[], tris: number[]): number[] {
  const acc = [0, 0, 0]; let n = 0;
  for (const t of tris) {
    const [a, b, c] = [CANON_TRI[t * 3], CANON_TRI[t * 3 + 1], CANON_TRI[t * 3 + 2]];
    const x = Math.round((px[a][0] + px[b][0] + px[c][0]) / 3), y = Math.round((px[a][1] + px[b][1] + px[c][1]) / 3);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const o = (y * img.width + x) * 4; const L = luma(img.data[o], img.data[o + 1], img.data[o + 2]); if (L < 15 || L > 245) continue;
    acc[0] += img.data[o]; acc[1] += img.data[o + 1]; acc[2] += img.data[o + 2]; n++;
  }
  return n > 20 ? acc.map((v) => v / n) : [];
}

/** Iguala a cor de uma foto de lado à de frente (ganho por canal, limitado): sem isso a costura entre fotos aparece. */
function colorMatched(view: AtlasView, front: AtlasView, visS: Float64Array, visF: Float64Array): HTMLCanvasElement {
  const tris: number[] = [];
  for (let t = 0; t < CANON_TRI.length / 3; t++) {
    const vs = [0, 1, 2].map((k) => CANON_TRI[t * 3 + k]);
    if (vs.every((v) => visS[v] > 0.55 && visF[v] > 0.55)) tris.push(t);
  }
  const fi = ctx2d(front.canvas).getImageData(0, 0, front.canvas.width, front.canvas.height);
  const c = canvas(view.canvas.width, view.canvas.height); const g = ctx2d(c); g.drawImage(view.canvas, 0, 0);
  const si = g.getImageData(0, 0, c.width, c.height);
  const mf = sharedMean(fi, front.px, tris), ms = sharedMean(si, view.px, tris);
  if (!mf.length || !ms.length) return view.canvas;
  const gain = mf.map((v, k) => Math.min(1.33, Math.max(0.75, v / Math.max(1, ms[k]))));
  for (let i = 0; i < si.data.length; i += 4) for (let k = 0; k < 3; k++) si.data[i + k] = si.data[i + k] * gain[k];
  g.putImageData(si, 0, 0); return c;
}

/** Luz lateral: rampa de ganho da esquerda para a direita do rosto que iguala os dois lados sem mudar a média. */
export function evenSideLight(img: ImageData, mask: Uint8Array): { left: number; right: number; applied: boolean } {
  const W = img.width; let sl = 0, nl = 0, sr = 0, nr = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue; const u = x / W; const o = (y * W + x) * 4; const L = luma(img.data[o], img.data[o + 1], img.data[o + 2]);
    if (u > 0.12 && u < 0.42) { sl += L; nl++; } else if (u > 0.58 && u < 0.88) { sr += L; nr++; }
  }
  const left = nl ? sl / nl : 0, right = nr ? sr / nr : 0;
  if (!left || !right || Math.max(left, right) / Math.min(left, right) < 1.12) return { left, right, applied: false };
  const mean = (left + right) / 2; const gl = Math.min(1.3, Math.max(0.78, mean / left)), gr = Math.min(1.3, Math.max(0.78, mean / right));
  for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) {
    const u = x / W; const t = Math.min(1, Math.max(0, (u - 0.27) / 0.46)); const s = t * t * (3 - 2 * t); const g = gl + (gr - gl) * s;
    const o = (y * W + x) * 4; for (let k = 0; k < 3; k++) img.data[o + k] = img.data[o + k] * g;
  }
  return { left, right, applied: true };
}

function boxBlur(f0: Float32Array, S: number, r: number): Float32Array {
  let f: Float32Array = f0;
  for (let pass = 0; pass < 2; pass++) for (const horiz of [true, false]) {
    const o = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let acc = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = horiz ? x + k : x, yy = horiz ? y : y + k; if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue; acc += f[yy * S + xx]; n++; }
      o[y * S + x] = acc / n;
    }
    f = o;
  }
  return f;
}

/**
 * Máscara suave (UV, 256²) de onde a textura da foto vale: dentro do contorno do rosto E onde alguma foto mostrou a
 * superfície de frente o bastante. Fora disso a foto estaria esticada: entra a cor de pele medida (neutra), em vez de
 * pixels inventados pela deformação.
 */
function featherMask(size: number, conf: Float32Array): HTMLCanvasElement {
  const S = 256; const oval: Pt[] = FACE_OVAL.map((i) => [CANON_UV[i * 2] * S, CANON_UV[i * 2 + 1] * S]);
  const cx = oval.reduce((a, p) => a + p[0], 0) / oval.length, cy = oval.reduce((a, p) => a + p[1], 0) / oval.length;
  const m = polygonMask(S, S, oval.map(([x, y]) => [cx + (x - cx) * 0.93, cy + (y - cy) * 0.95] as Pt));
  const c = boxBlur(conf, S, 3);
  let f: Float32Array = Float32Array.from(m, (v, i) => v * c[i]); const r = 8;
  f = boxBlur(f, S, r);
  const cv = canvas(S, S); const g = ctx2d(cv); const id = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.round(f[i] * 255); }
  g.putImageData(id, 0, 0);
  const big = canvas(size, size); const bg = ctx2d(big); bg.imageSmoothingQuality = "high"; bg.drawImage(cv, 0, 0, size, size); return big;
}

export interface AtlasResult { canvas: HTMLCanvasElement; source: Role[]; light: { left: number; right: number; applied: boolean } }

export function bakeAtlas(views: AtlasView[], skinHex: string, size = 1024): AtlasResult {
  const front = views.find((v) => v.role === "front") ?? views[0];
  const vis = views.map((v) => visibility(v.sim)); const vf = vis[views.indexOf(front)];
  const sources = views.map((v, k) => (v === front ? v.canvas : colorMatched(v, front, vis[k], vf)));
  const raw = canvas(size, size); const g = ctx2d(raw);
  g.fillStyle = skinHex; g.fillRect(0, 0, size, size);
  const dst = (i: number): Pt => [CANON_UV[i * 2] * size, CANON_UV[i * 2 + 1] * size];
  const used: Role[] = []; const CS = 256; const confC = canvas(CS, CS); const cg = ctx2d(confC); cg.fillStyle = "#000"; cg.fillRect(0, 0, CS, CS);
  const area = (p: Pt[]) => Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;
  const ratios: number[] = []; const picks: { tri: number[]; best: number; ratio: number }[] = [];
  for (let t = 0; t < CANON_TRI.length / 3; t++) {
    const tri = [CANON_TRI[t * 3], CANON_TRI[t * 3 + 1], CANON_TRI[t * 3 + 2]];
    let best = 0, score = -1;
    views.forEach((v, k) => { const s0 = Math.min(...tri.map((i) => vis[k][i])) + (v === front ? 0.12 : 0); if (s0 > score) { score = s0; best = k; } });
    const d = tri.map(dst); const src = tri.map((i) => views[best].px[i]); const M = affine(src, d);
    const ratio = area(src) / Math.max(1e-6, area(d)); ratios.push(ratio); picks.push({ tri, best, ratio });
    if (!M) continue;
    const cx = (d[0][0] + d[1][0] + d[2][0]) / 3, cy = (d[0][1] + d[1][1] + d[2][1]) / 3;
    g.save(); g.beginPath();
    d.forEach(([x, y], k) => { const l = Math.hypot(x - cx, y - cy) || 1; const ex = x + ((x - cx) / l) * 1.2, ey = y + ((y - cy) / l) * 1.2; if (k) g.lineTo(ex, ey); else g.moveTo(ex, ey); });
    g.closePath(); g.clip(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); g.drawImage(sources[best], 0, 0); g.restore();
    if (!used.includes(views[best].role)) used.push(views[best].role);
  }
  // confiança = quanto a foto "esticou" o triângulo (área na foto ÷ área no UV, relativa à mediana do rosto): um
  // triângulo visto de lado vira uma lasca na foto e sairia borrado; cantos côncavos dos olhos, vistos de frente, não
  const med = ratios.slice().sort((x, y) => x - y)[ratios.length >> 1] || 1;
  for (const { tri, ratio } of picks) {
    const q = Math.round(Math.min(1, Math.max(0, (ratio / med - 0.12) / 0.3)) * 255);
    cg.fillStyle = `rgb(${q},${q},${q})`; cg.beginPath(); tri.forEach((i, k) => { const x = CANON_UV[i * 2] * CS, y = CANON_UV[i * 2 + 1] * CS; if (k) cg.lineTo(x, y); else cg.moveTo(x, y); }); cg.closePath(); cg.fill();
  }
  const cd = cg.getImageData(0, 0, CS, CS).data; const conf = new Float32Array(CS * CS); for (let i = 0; i < conf.length; i++) conf[i] = cd[i * 4] / 255;
  const id = g.getImageData(0, 0, size, size);
  const oval: Pt[] = FACE_OVAL.map((i) => dst(i));
  const light = evenSideLight(id, polygonMask(size, size, oval));
  g.putImageData(id, 0, 0);
  // borda do rosto → pele medida na foto (a textura some suavemente; o crânio, as orelhas e o pescoço têm a mesma cor)
  const face = canvas(size, size); const fg = ctx2d(face); fg.drawImage(raw, 0, 0); fg.globalCompositeOperation = "destination-in"; fg.drawImage(featherMask(size, conf), 0, 0);
  const out = canvas(size, size); const og = ctx2d(out); og.fillStyle = skinHex; og.fillRect(0, 0, size, size); og.drawImage(face, 0, 0);
  return { canvas: out, source: used, light };
}
