import * as THREE from "three";
import { clothFolds, hungProfile, hungShape, type HungKind } from "./hung-shape";

/*
 * O pano da roupa pendurada (HungGarment, hung-garment.tsx): cor média da foto, trama do tecido, recorte pela foto
 * ou pela silhueta do tipo e as duas folhas (frente e costas) com o balanço no shader, um programa para todas.
 */

/** Cor média dos pixels opacos da foto (24 × 24); null se a imagem não puder ser lida (CORS) ou não tiver tecido. */
export function averageColor(image: CanvasImageSource): string | null {
  try {
    const c = document.createElement("canvas"); c.width = 24; c.height = 24; const g = c.getContext("2d"); if (!g) return null;
    g.drawImage(image, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (n < 12) return null;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(gg)}${hex(b)}`;
  } catch { return null; }
}

/** Tempo e intensidade do balanço do pano, um só para todas as peças (um programa de shader para todas). */
export const CLOTH_TIME = { value: 0 }, CLOTH_SWAY = { value: 1 };

/** Trama fina do tecido como mapa de normais (fios alternados, como tela), compartilhada por todas as peças. */
let weaveTex: THREE.Texture | null = null;
function weave(): THREE.Texture | null {
  if (weaveTex || typeof document === "undefined") return weaveTex;
  const n = 64, c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"); if (!g) return null;
  const img = g.createImageData(n, n), hgt = (x: number, y: number) => {
    const u = ((x % n) + n) % n, v = ((y % n) + n) % n, over = (Math.floor(u / 4) + Math.floor(v / 4)) % 2 === 0;
    return over ? Math.sin((u % 4) / 4 * Math.PI) : Math.sin((v % 4) / 4 * Math.PI) * 0.8;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1), k = (y * n + x) * 4;
    const nx = -dx * 0.6, ny = -dy * 0.6, nz = 1, l = Math.hypot(nx, ny, nz);
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  weaveTex = new THREE.CanvasTexture(c); weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping; weaveTex.repeat.set(9, 14);
  return weaveTex;
}

/** Máscara de dentro/fora da peça numa grade (true = tecido) e a distância (m) de cada nó até a borda. */
function insideGrid(nx: number, ny: number, w: number, h: number, inside: (u: number, v: number) => boolean) {
  const cols = nx + 1, rows = ny + 1, inn = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) inn[j * cols + i] = inside(i / nx, j / ny) ? 1 : 0;
  const dist = new Float32Array(cols * rows), cw = w / nx, ch = h / ny;
  for (let k = 0; k < inn.length; k++) {
    if (!inn[k]) continue;
    const i0 = k % cols, j0 = Math.floor(k / cols); let best = Math.min(i0 * cw, (nx - i0) * cw, j0 * ch, (ny - j0) * ch);
    for (let q = 0; q < inn.length; q++) if (!inn[q]) { const d = Math.hypot((q % cols - i0) * cw, (Math.floor(q / cols) - j0) * ch); if (d < best) best = d; }
    dist[k] = best;
  }
  return dist;
}

/** Alfa da foto amostrado (leitura do canvas; null se a imagem não puder ser lida) e a caixa do tecido na imagem. */
function photoAlpha(image: CanvasImageSource): { at: (u: number, v: number) => number; box: { x0: number; y0: number; x1: number; y1: number } } | null {
  try {
    const W = 96, H = 96, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); if (!g) return null;
    g.drawImage(image, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 96) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    return { at: (u, v) => d[(Math.min(H - 1, Math.max(0, Math.round(v * (H - 1)))) * W + Math.min(W - 1, Math.max(0, Math.round(u * (W - 1))))) * 4 + 3] / 255, box: { x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H } };
  } catch { return null; }
}

/** Ponto dentro do polígono (contorno da silhueta), par-ímpar. */
function inPolygon(pts: THREE.Vector2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Monta o pano: duas folhas (frente e costas) numa grade fina, afastadas pela espessura da peça e coladas na borda
 * (a costura), com as dobras da queda. Com foto, o contorno é o da foto (recorte e caixa lidos do alfa) e a frente leva
 * a foto; as costas ficam na cor do tecido. Sem foto, a silhueta do tipo vira a máscara.
 */
export function buildCloth(kind: Exclude<HungKind, "shelf">, length: number, depth: number, tex: THREE.Texture | null, seed: number) {
  const nx = 22, ny = 34;
  const alpha = tex?.image ? photoAlpha(tex.image as CanvasImageSource) : null;
  // caixa do tecido na foto (calça dobrada: a metade de cima)
  const box = alpha?.box ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const crop = kind === "pants" && alpha ? { ...box, y1: box.y0 + (box.y1 - box.y0) * 0.55 } : box;
  const outline = hungShape(kind, length).getSpacedPoints(120), sb = new THREE.Box2().setFromPoints(outline);
  const aspect = alpha ? ((crop.x1 - crop.x0) * (tex!.image as { width: number }).width) / Math.max(1, (crop.y1 - crop.y0) * (tex!.image as { height: number }).height) : (sb.max.x - sb.min.x) / Math.max(0.01, sb.max.y - sb.min.y);
  const height = length, width = Math.min(0.62, Math.max(0.28, height * aspect));
  const inside = alpha
    ? (u: number, v: number) => alpha.at(crop.x0 + u * (crop.x1 - crop.x0), crop.y0 + v * (crop.y1 - crop.y0)) > 0.4
    : (u: number, v: number) => inPolygon(outline, sb.min.x + u * (sb.max.x - sb.min.x), sb.max.y - v * (sb.max.y - sb.min.y));
  const dist = insideGrid(nx, ny, width, height, inside);
  const make = (side: 1 | -1) => {
    const g = new THREE.PlaneGeometry(width, height, nx, ny); g.translate(0, -height / 2, 0);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const i = k % (nx + 1), j = Math.floor(k / (nx + 1)), x = pos.getX(k), y = pos.getY(k), tt = -y / height;
      const edge = THREE.MathUtils.smoothstep(dist[j * (nx + 1) + i], 0, 0.05);
      pos.setZ(k, edge * (side * (depth / 2) * hungProfile(kind, tt, x) + clothFolds(tt, x, seed)));
      if (alpha) uv.setXY(k, crop.x0 + (i / nx) * (crop.x1 - crop.x0), 1 - (crop.y0 + (j / ny) * (crop.y1 - crop.y0)));
    }
    if (side < 0) { const idx = g.index!; for (let q = 0; q < idx.count; q += 3) { const a = idx.getX(q + 1); idx.setX(q + 1, idx.getX(q + 2)); idx.setX(q + 2, a); } }
    g.computeVertexNormals(); return g;
  };
  // sem foto: a silhueta desenhada num canvas é a máscara de recorte das duas folhas
  let mask: THREE.Texture | null = null;
  if (!alpha && typeof document !== "undefined") {
    const c = document.createElement("canvas"); c.width = 128; c.height = 192; const g2 = c.getContext("2d");
    if (g2) {
      g2.fillStyle = "#000"; g2.fillRect(0, 0, 128, 192); g2.fillStyle = "#fff"; g2.filter = "blur(1.2px)"; g2.beginPath();   // borda macia: o recorte (alphaTest) sai liso
      outline.forEach((q, n) => { const px = ((q.x - sb.min.x) / (sb.max.x - sb.min.x)) * 128, py = ((sb.max.y - q.y) / (sb.max.y - sb.min.y)) * 192; if (n) g2.lineTo(px, py); else g2.moveTo(px, py); });
      g2.closePath(); g2.fill(); mask = new THREE.CanvasTexture(c);
    }
  }
  const material = (front: boolean) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: front && alpha ? tex : null, alphaMap: alpha ? null : mask, alphaTest: 0.4, transparent: false,
      roughness: 0.92, metalness: 0, sheen: 0.75, sheenRoughness: 0.7, normalMap: weave(), normalScale: new THREE.Vector2(0.32, 0.32),
      emissive: new THREE.Color("#ffd54a"), emissiveIntensity: 0,
    });
    if (!front && alpha) { m.map = tex; }   // costas: o mesmo recorte da foto, tingido com a cor do tecido (sem estampa inventada)
    m.customProgramCacheKey = () => `hung-cloth-${front}-${!!alpha}`;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uClothTime = CLOTH_TIME; shader.uniforms.uClothSway = CLOTH_SWAY; shader.uniforms.uClothH = { value: height };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uClothTime; uniform float uClothSway; uniform float uClothH;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat clothT = clamp(-position.y / uClothH, 0.0, 1.0);\ntransformed.z += sin(uClothTime * 1.6 + position.y * 7.0 + position.x * 4.0) * 0.004 * clothT * clothT * uClothSway;\ntransformed.x += sin(uClothTime * 1.1 + position.y * 4.0) * 0.0025 * clothT * uClothSway;");
      if (!front && alpha) shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = diffuse;");
    };
    return m;
  };
  const front = material(true), back = material(false), frontGeo = make(1), backGeo = make(-1);
  return {
    front, back, frontGeo, backGeo, width, photo: !!alpha,
    setSheen: (hex: string) => { const c = new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.35); front.sheenColor.copy(c); back.sheenColor.copy(c); },
    dispose: () => { front.dispose(); back.dispose(); frontGeo.dispose(); backGeo.dispose(); mask?.dispose(); },
  };
}
