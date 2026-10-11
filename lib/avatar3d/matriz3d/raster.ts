/*
 * MATRIZ-3D · catálogo visual: rasterizador mínimo (puro, sem DOM nem WebGL) que desenha as malhas que os construtores
 * produziram — corpo, molde, faixas de acabamento, gola, calçado — em vista ortográfica de frente e de lado, com
 * z-buffer e sombreamento de Lambert. Cada componente tem a sua cor, para ver ONDE ele está na peça.
 */
export interface Mesh { position: ArrayLike<number>; index: ArrayLike<number>; color: [number, number, number]; /** alfa por vértice: pixel com alfa interpolado < 0,5 não desenha (alphaTest) */ alpha?: ArrayLike<number> }
export interface View { axis: "front" | "side"; x0: number; x1: number; y0: number; y1: number }
export interface Image { width: number; height: number; data: Uint8ClampedArray }

const LIGHT = (() => { const l = [0.35, 0.55, 0.75]; const n = Math.hypot(...l); return l.map((x) => x / n); })();

/** Desenha as malhas numa imagem `width` px de largura, com a altura proporcional à janela da vista. */
export function render(meshes: Mesh[], view: View, width: number, background: [number, number, number] = [246, 244, 240]): Image {
  const sx = width / (view.x1 - view.x0); const height = Math.max(1, Math.round((view.y1 - view.y0) * sx));
  const data = new Uint8ClampedArray(width * height * 4); const depth = new Float32Array(width * height).fill(-Infinity);
  for (let i = 0; i < width * height; i++) { data[i * 4] = background[0]; data[i * 4 + 1] = background[1]; data[i * 4 + 2] = background[2]; data[i * 4 + 3] = 255; }
  // frente: a câmera em +z olha para −z (x da pessoa à esquerda da imagem fica à direita: espelho de quem olha de frente)
  const proj = (p: ArrayLike<number>, i: number): [number, number, number] => view.axis === "front"
    ? [(p[i * 3] - view.x0) * sx, (view.y1 - p[i * 3 + 1]) * sx, p[i * 3 + 2]]
    : [(p[i * 3 + 2] - view.x0) * sx, (view.y1 - p[i * 3 + 1]) * sx, -p[i * 3]];
  for (const m of meshes) {
    const idx = m.index; const pos = m.position;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      // alphaTest 0,5 por pixel, como o material da peça (garmentMaterial): o alfa é interpolado no triângulo
      if (m.alpha && m.alpha[a] < 0.5 && m.alpha[b] < 0.5 && m.alpha[c] < 0.5) continue;
      // normal no espaço do mundo (sombreamento dos dois lados: DoubleSide, como no provador)
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const view3 = view.axis === "front" ? [0, 0, 1] : [1, 0, 0];
      if (nx * view3[0] + ny * view3[1] + nz * view3[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lam = 0.38 + 0.62 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const col = m.color.map((x) => Math.min(255, Math.round(x * lam))) as [number, number, number];
      const A = proj(pos, a), B = proj(pos, b), C = proj(pos, c);
      const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(width - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(height - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (Math.abs(area) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        if (m.alpha && w0 * m.alpha[a] + w1 * m.alpha[b] + w2 * m.alpha[c] < 0.5) continue;
        const z = w0 * A[2] + w1 * B[2] + w2 * C[2]; const k = y * width + x;
        if (z <= depth[k]) continue;
        depth[k] = z; data[k * 4] = col[0]; data[k * 4 + 1] = col[1]; data[k * 4 + 2] = col[2];
      }
    }
  }
  return { width, height, data };
}

/** Junta imagens lado a lado (mesma altura; a menor é centrada) com um espaço entre elas. */
export function sideBySide(imgs: Image[], gap = 8, background: [number, number, number] = [246, 244, 240]): Image {
  const height = Math.max(...imgs.map((i) => i.height)); const width = imgs.reduce((s, i) => s + i.width, 0) + gap * (imgs.length - 1);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = background[0]; data[i * 4 + 1] = background[1]; data[i * 4 + 2] = background[2]; data[i * 4 + 3] = 255; }
  let ox = 0;
  for (const im of imgs) {
    const oy = Math.floor((height - im.height) / 2);
    for (let y = 0; y < im.height; y++) data.set(im.data.subarray(y * im.width * 4, (y + 1) * im.width * 4), ((y + oy) * width + ox) * 4);
    ox += im.width + gap;
  }
  return { width, height, data };
}

/** Cores dos componentes no catálogo (iguais na legenda). */
export const CORES: Record<string, [number, number, number]> = {
  corpo: [222, 214, 204], molde: [86, 128, 186], tubo: [118, 92, 172], gola: [212, 120, 60], barra: [228, 176, 40], punho: [64, 166, 120],
  carcela: [196, 64, 84], costura: [40, 40, 40], botoes: [250, 250, 250], "botoes-borda": [30, 30, 30], "gola-ponta": [236, 140, 160],
  cabedal: [110, 120, 132], sola: [240, 240, 236], cadarco: [214, 60, 60], colarinho: [60, 150, 200],
};
