/**
 * FashionAI Lens (RF54 §11) — rostos borrados NO APARELHO, antes do upload. O Lens identifica roupas, nunca pessoas:
 * a foto é redesenhada num canvas (o que também descarta EXIF/GPS), cada rosto achado pelo MediaPipe Face Landmarker
 * (o mesmo já hospedado em /public/mediapipe para o Avatar 3D) vira uma área pixelada e desfocada, e a imagem é
 * regravada em JPEG.
 *
 * Sem detector (offline, navegador sem WebAssembly/WebGL, modelo que não carrega) o retorno é `faces = -1`: a tela
 * exige a confirmação explícita da pessoa antes de enviar. O backend continua aplicando a moderação de sempre.
 *
 * O detector é injetável (`finder`) e o módulo é carregado sob demanda: os testes (jsdom, sem MediaPipe) simulam tudo.
 */

export interface RedactResult {
  /** imagem regravada (JPEG, sem metadados) — ou o arquivo original, se nem a decodificação foi possível */
  blob: Blob;
  /** rostos borrados; -1 = não foi possível verificar */
  faces: number;
  width: number; height: number;
}
export interface Point { x: number; y: number }
export interface Region { x: number; y: number; w: number; h: number }
/** Acha rostos no canvas: uma lista de pontos normalizados (0–1) por rosto. */
export type FaceFinder = (canvas: HTMLCanvasElement) => Promise<Point[][]>;

/** Lado máximo da imagem enviada (o backend também reduz a ≤ 2048 px). */
export const MAX_SIDE = 2048;
/** Passadas do detector: o landmarker do avatar acha até 3 rostos por vez; os já borrados não voltam na passada seguinte. */
const MAX_PASSES = 4;

/**
 * Caixa do rosto em pixels a partir dos pontos (normalizados) do landmarker, com folga: os pontos vão do meio da testa
 * ao queixo, então a folga é maior em cima (testa e linha do cabelo) e nas laterais (orelhas).
 */
export function faceRegion(points: Point[], width: number, height: number): Region | null {
  if (!points.length || width <= 0 || height <= 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const w = (x1 - x0) * width, h = (y1 - y0) * height;
  if (!(w > 0 && h > 0)) return null;
  const left = Math.max(0, Math.floor(x0 * width - w * 0.25));
  const top = Math.max(0, Math.floor(y0 * height - h * 0.45));
  const right = Math.min(width, Math.ceil(x1 * width + w * 0.25));
  const bottom = Math.min(height, Math.ceil(y1 * height + h * 0.15));
  return right > left && bottom > top ? { x: left, y: top, w: right - left, h: bottom - top } : null;
}

const overlap = (a: Region, b: Region) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ix * iy) / Math.min(a.w * a.h, b.w * b.h);
};

/** Pixela forte (≈ 6 blocos na largura do rosto) e desfoca por cima quando o canvas suporta `filter`. */
export function obscure(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, r: Region) {
  const tw = 6, th = Math.max(1, Math.round((6 * r.h) / r.w));
  const small = document.createElement("canvas"); small.width = tw; small.height = th;
  small.getContext("2d")?.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, tw, th);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, tw, th, r.x, r.y, r.w, r.h);
  if (typeof ctx.filter === "string") {
    const region = document.createElement("canvas"); region.width = r.w; region.height = r.h;
    region.getContext("2d")?.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.filter = `blur(${Math.max(8, Math.round(r.w / 8))}px)`;
    ctx.drawImage(region, r.x, r.y);
  }
  ctx.restore();
}

/** Detector padrão: o Face Landmarker do Avatar 3D (carregado só quando o Lens precisa). */
const mediapipeFinder: FaceFinder = async (canvas) => {
  const { faceLandmarker } = await import("@/lib/avatar3d/detect");
  const landmarker = await faceLandmarker();
  return (landmarker.detect(canvas).faceLandmarks ?? []).map((face) => face.map((p) => ({ x: p.x, y: p.y })));
};

async function decode(file: Blob): Promise<{ img: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    // orientação do EXIF aplicada (como o ImageOps.decode do backend); navegadores antigos não aceitam as opções
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
    return { img: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    return { img, width: img.naturalWidth, height: img.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

const withTimeout = <T,>(p: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const id = setTimeout(() => reject(new Error("timeout")), ms);
  p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
});

/**
 * Redesenha a foto, borra os rostos e regrava em JPEG. Nunca rejeita: sem decodificação devolve o arquivo original
 * com `faces = -1` (a tela pede a confirmação da pessoa).
 */
export async function redactFaces(file: Blob, opts: { finder?: FaceFinder; timeoutMs?: number; quality?: number } = {}): Promise<RedactResult> {
  const finder = opts.finder ?? mediapipeFinder;
  let decoded: Awaited<ReturnType<typeof decode>>;
  try { decoded = await decode(file); } catch { return { blob: file, faces: -1, width: 0, height: 0 }; }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale)); canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, faces: -1, width: decoded.width, height: decoded.height };
    ctx.drawImage(decoded.img, 0, 0, canvas.width, canvas.height);

    let faces = 0;
    try {
      const done: Region[] = [];
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const found = (await withTimeout(finder(canvas), opts.timeoutMs ?? 12_000))
          .map((pts) => faceRegion(pts, canvas.width, canvas.height)).filter((r): r is Region => !!r);
        const fresh = found.filter((r) => !done.some((d) => overlap(d, r) > 0.3));
        found.forEach((r) => obscure(ctx, canvas, r));   // um rosto achado de novo é borrado de novo, sem contar duas vezes
        done.push(...fresh); faces += fresh.length;
        if (!fresh.length) break;
      }
    } catch { faces = -1; }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", opts.quality ?? 0.9));
    return blob ? { blob, faces, width: canvas.width, height: canvas.height } : { blob: file, faces: -1, width: decoded.width, height: decoded.height };
  } catch {
    return { blob: file, faces: -1, width: decoded.width, height: decoded.height };
  } finally { decoded.close?.(); }
}
