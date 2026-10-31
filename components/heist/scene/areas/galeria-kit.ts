/*
 * MET Gala Heist v2 — ferramentas comuns do Instituto do Traje (galeria, Z07) e da Sala das Joias (cofre, Z08):
 * superfícies procedurais com cor, relevo e rugosidade (cópia adaptada de interior-tex, com chaves próprias da área),
 * quadro local de móvel/parede, molduras extrudadas (perfil varrido ao longo de uma reta), almofadas em relevo,
 * placas recortadas de atlas, planos tingidos por vértice (uma chamada de desenho para várias cores) e o idioma do
 * cenário. Tudo com chave "galeria-…" ou "cofre-…" para não dividir cache com outra área.
 */
import * as THREE from "three";
import { BOX0, CYL0, geo, mat, mul, type Batch } from "../interior-batch";
import { COPY, type InteriorCopy } from "../interior-copy";
import type { Quality } from "../interior-tex";

/** Nos testes (jsdom) as texturas saem com 8 px, como em interior-tex. */
export const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ---------- ruído periódico (o mesmo de interior-tex, que não exporta) ---------- */
export function hash2(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Ruído de valor com período p (em células): vnoise(x + p, y) = vnoise(x, y). */
export function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(i0, j0, seed), b = hash2(i1, j0, seed), c = hash2(i0, j1, seed), d = hash2(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Oitavas de ruído (u, v em [0, 1), período base p): repete sem emenda na borda da textura. */
export function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let k = 0; k < oct; k++) { s += a * vnoise(u * p * f, v * p * f, p * f, seed + k * 31); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Veio de pedra: 1 sobre o veio, 0 fora (t = coordenada turbulenta). */
export const vein = (t: number, width: number) => 1 - smooth(0, width, Math.abs(Math.sin(t * Math.PI)));

/* ---------- superfícies (cor + relevo + rugosidade) ---------- */
export interface Surf { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). */
export type PixelFn = (u: number, v: number, out: Float32Array) => void;
const surfs = new Map<string, Surf>();
function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}
/** Gera cor, mapa normal (gradiente da altura, dando a volta na borda) e rugosidade numa passada só. */
export function surf(key: string, size: number, fn: PixelFn, bump = 1.5): Surf {
  const hit = surfs.get(key); if (hit) return hit;
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
  surfs.set(key, sf); return sf;
}

const mats = new Map<string, THREE.Material>();
/** Material (ou qualquer coisa) criado uma vez por chave. */
export function once<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = mats.get(key) as T | undefined; if (hit) return hit;
  const m = make(); m.name = key; mats.set(key, m); return m;
}
/** Material PBR de uma superfície procedural: tinta, metal, relevo, cores por vértice, reflexo do ambiente. */
export function surfMat(key: string, sf: Surf, o: { tint?: string; metal?: number; normal?: number; vertex?: boolean; env?: number; rough?: number; physical?: { clearcoat: number; clearcoatRoughness: number } } = {}): THREE.MeshStandardMaterial {
  return once(key, () => {
    const p = { map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1), color: new THREE.Color(o.tint ?? "#ffffff"),
      metalness: o.metal ?? 0, roughness: o.rough ?? 1, vertexColors: o.vertex ?? false, envMapIntensity: o.env ?? 1, shadowSide: THREE.DoubleSide };
    return o.physical ? new THREE.MeshPhysicalMaterial({ ...p, clearcoat: o.physical.clearcoat, clearcoatRoughness: o.physical.clearcoatRoughness }) : new THREE.MeshStandardMaterial(p);
  });
}
/** Cor lisa (metal, laca, plástico) com chave da área. */
export function plain(key: string, color: string, o: { metal?: number; rough?: number; env?: number; emissive?: string; ei?: number; side?: THREE.Side; transparent?: boolean; opacity?: number; vertex?: boolean } = {}): THREE.MeshStandardMaterial {
  return once(key, () => new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6, envMapIntensity: o.env ?? 1, emissive: new THREE.Color(o.emissive ?? "#000000"),
    emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, transparent: o.transparent ?? false, opacity: o.opacity ?? 1, vertexColors: o.vertex ?? false, depthWrite: !(o.transparent && (o.opacity ?? 1) < 0.6) }));
}
/** Vidro grosso de vitrine: quase incolor, verniz e reflexo forte; a borda (aresta polida) é outro material, esverdeado. */
export function thickGlass(key: string, o: { tint?: string; opacity?: number } = {}): THREE.MeshPhysicalMaterial {
  return once(key, () => new THREE.MeshPhysicalMaterial({ color: o.tint ?? "#e4eeec", metalness: 0, roughness: 0.03, transparent: true, opacity: o.opacity ?? 0.13, envMapIntensity: 1.8,
    clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, depthWrite: false }));
}
export function glassEdge(key: string): THREE.MeshPhysicalMaterial {
  return once(key, () => new THREE.MeshPhysicalMaterial({ color: "#7fb3a4", metalness: 0, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 1.4, clearcoat: 1, depthWrite: false }));
}
/** Emissivo sem luz (lentes, telas, difusores): acima de 1 para o tone mapping e o bloom pegarem. */
export function lit(key: string, color: string, k = 1, o: { map?: THREE.Texture | null; additive?: boolean; opacity?: number; side?: THREE.Side } = {}): THREE.MeshBasicMaterial {
  return once(key, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), map: o.map ?? null, transparent: !!o.additive || (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.additive, side: o.side ?? THREE.FrontSide }));
}

/* ---------- idioma do cenário (os textos novos da área ficam nos arquivos da área) ---------- */
export type Lang = "pt" | "en" | "es";
export const langOf = (copy: InteriorCopy): Lang => (copy === COPY.en ? "en" : copy === COPY.es ? "es" : "pt");

/* ---------- quadro local ---------- */
/** Matriz no quadro local (x, y, z, giro, escala, inclinação). */
export type Fr = (x: number, y: number, z: number, ry?: number, sx?: number, sy?: number, sz?: number, rx?: number, rz?: number) => THREE.Matrix4;
/** Quadro com origem em (cx, y0, cz) girado `yaw` (a frente do móvel olha para +z local). */
export function frame(cx: number, cz: number, yaw: number, y0 = 0): Fr {
  const base = mat(cx, y0, cz, yaw);
  return (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(base, mat(x, y, z, ry, sx, sy, sz, rx, rz));
}
/** Ponto do quadro local no mundo. */
export const at = (F: Fr, x: number, y: number, z: number) => new THREE.Vector3().setFromMatrixPosition(F(x, y, z));
/** Caixa com a base em y (BOX0) no lote. */
export const bx = (b: Batch, room: string, m: THREE.Material, M: THREE.Matrix4, cast = false) => b.add(room, m, BOX0(), M, { cast });
/** Cilindro com a base em y no lote. */
export const cy = (b: Batch, room: string, m: THREE.Material, M: THREE.Matrix4, seg = 16) => b.add(room, m, CYL0(seg), M);

/** Torneado (perfil r, y) com cache. */
export const lathe = (key: string, pts: [number, number][], seg = 24) => geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));

/**
 * Moldura reta: perfil (u = saída da parede para +z, v = altura) varrido ao longo de x, comprimento 1 e centrado em
 * x = 0 (escala em x = comprimento: o perfil não deforma).
 */
export function moldingGeo(key: string, prof: [number, number][]): THREE.BufferGeometry {
  return geo(`mold-${key}`, () => {
    const s = new THREE.Shape(); s.moveTo(0, prof[0][1]);
    for (const [u, v] of prof) s.lineTo(u, v);
    s.lineTo(0, prof[prof.length - 1][1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 });
    g.rotateY(-Math.PI / 2); g.translate(0.5, 0, 0);
    return g;
  });
}
/** Almofada em relevo (campo chanfrado): w × h, espessura t, chanfro b; costas em z = 0, frente para +z, base em y = 0. */
export function raisedPanel(w: number, h: number, t = 0.018, b = 0.03): THREE.BufferGeometry {
  const kw = Math.round(w * 100), kh = Math.round(h * 100);
  return geo(`raised-${kw}-${kh}-${Math.round(t * 1000)}-${Math.round(b * 1000)}`, () => {
    const iw = kw / 100 - 2 * b, ih = kh / 100 - 2 * b, s = new THREE.Shape();
    s.moveTo(-iw / 2, b); s.lineTo(iw / 2, b); s.lineTo(iw / 2, b + ih); s.lineTo(-iw / 2, b + ih); s.closePath();
    // espessura total = profundidade + 2 × chanfro: z de −0,3t a 0,7t, levado para 0…t
    const g = new THREE.ExtrudeGeometry(s, { depth: t * 0.4, bevelEnabled: true, bevelSize: b, bevelThickness: t * 0.3, bevelSegments: 2, curveSegments: 2 });
    g.translate(0, 0, t * 0.3); return g;
  });
}
/** Arco (anel de pedra/madeira) extrudado: vão r, espessura do anel t, nascença sp, profundidade d; frente em +z. */
export function archRing(key: string, r: number, t: number, sp: number, d: number, bevel = 0.015): THREE.BufferGeometry {
  return geo(`arch-${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-r - t, 0); s.lineTo(-r - t, sp); s.absarc(0, sp, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 28 });
  });
}
/** Vão do arco preenchido (o fundo do nicho). */
export function archFill(key: string, r: number, sp: number): THREE.BufferGeometry {
  return geo(`archFill-${key}`, () => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 28); });
}
/** Plano 1 × 1 recortado da célula i de um atlas cols × rows (linha 0 no alto da imagem). */
export function atlasPlane(key: string, cols: number, rows: number, i: number): THREE.BufferGeometry {
  return geo(`atlas-${key}-${cols}x${rows}-${i}`, () => {
    const g = new THREE.PlaneGeometry(1, 1), uv = g.getAttribute("uv") as THREE.BufferAttribute, c = i % cols, r = Math.floor(i / cols);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / cols, 1 - (r + 1 - uv.getY(k)) / rows);
    return g;
  });
}
/** Plano 1 × 1 com a cor em todos os vértices (para material com vertexColors: várias cores, um lote só). */
export function tintedPlane(color: string): THREE.BufferGeometry {
  return geo(`tinted-${color}`, () => {
    const g = new THREE.PlaneGeometry(1, 1), n = g.getAttribute("position").count, c = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
  });
}
/** Plano deitado (olhando para cima) 1 × 1. */
export const planeUp = () => geo("galeria-planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
/** Pedra preciosa lapidada (octaedro alongado) e cabochão. */
export const gemGeo = () => geo("galeria-gem", () => new THREE.OctahedronGeometry(1, 0).scale(1, 0.8, 1));
export const pearlGeo = () => geo("galeria-pearl", () => new THREE.SphereGeometry(1, 10, 8));

/** Canvas desenhado uma vez por chave (a chave já leva a área e a qualidade). */
const drawn = new Map<string, THREE.CanvasTexture>();
export function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { srgb?: boolean; repeat?: boolean } = {}): THREE.CanvasTexture {
  const hit = drawn.get(key); if (hit) return hit;
  const W = FAKE ? 8 : w, H = FAKE ? 8 : h, { c, g } = canvas(W, H);
  if (!FAKE) draw(g, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true; drawn.set(key, t); return t;
}
/** Tamanho de textura pela qualidade (o "low" usa a metade). */
export const qs = (q: Quality, high: number) => (q === "high" ? high : Math.max(64, high / 2));

/** Quebra o texto em linhas que cabem na largura (canvas 2D). */
export function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
