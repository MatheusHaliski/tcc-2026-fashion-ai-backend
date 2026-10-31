/*
 * MET Gala Heist v2 — ferramentas da área Lounge, bar e terraço (Z05, Z13), usadas por lounge*.ts e terraco*.ts:
 * superfícies procedurais (cor + relevo + rugosidade) com cache próprio e chaves "lounge-…"/"terraco-…", geometrias
 * reaproveitadas (torneados, caixas arredondadas, painéis com bisel, tubos) e o referencial local dos móveis da planta
 * (pegada → matriz). O gerador de superfícies e o referencial são cópias adaptadas de interior-tex e interior-props, que
 * não os exportam; nada aqui altera os arquivos comuns.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Prop } from "@/lib/heist/types";
import type { LightAnchor } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import { geo, mat, mul } from "../interior-batch";
import { drawnTexture } from "../interior-tex";

/** Nos testes (jsdom, contexto 2D falso) as texturas saem com 8 px: a cena monta igual, sem custo. */
export const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ---------- ruído periódico (o mesmo de interior-tex) ---------- */
export function hash2(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Ruído de valor com período p (em células da rede). */
export function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(i0, j0, seed), b = hash2(i1, j0, seed), c = hash2(i0, j1, seed), d = hash2(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Soma de oitavas (u, v em [0, 1), período base p): repete sem emenda. */
export function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let k = 0; k < oct; k++) { s += a * vnoise(u * p * f, v * p * f, p * f, seed + k * 31); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* ---------- superfícies (cor, relevo, rugosidade) ---------- */
export interface AreaSurface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). */
export type PixelFn = (u: number, v: number, out: Float32Array) => void;
const surfaces = new Map<string, AreaSurface>();
function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}
/** Gera cor, relevo (normal pelo gradiente da altura, dando a volta na borda) e rugosidade de uma vez, com cache por chave. */
export function areaSurface(key: string, size: number, fn: PixelFn, bump = 1.5, h = size): AreaSurface {
  const hit = surfaces.get(key); if (hit) return hit;
  const n = FAKE ? 8 : size, m = FAKE ? 8 : h;
  const col = canvas(n, m), nor = canvas(n, m), rou = canvas(n, m);
  const ci = col.g.createImageData(n, m), ni = nor.g.createImageData(n, m), ri = rou.g.createImageData(n, m);
  const H = new Float32Array(n * m), out = new Float32Array(5);
  for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) {
    out[0] = out[1] = out[2] = 0.5; out[3] = 0.5; out[4] = 0.5;
    fn((x + 0.5) / n, (y + 0.5) / m, out);
    const k = (y * n + x) * 4;
    ci.data[k] = out[0] * 255; ci.data[k + 1] = out[1] * 255; ci.data[k + 2] = out[2] * 255; ci.data[k + 3] = 255;
    const r = out[4] * 255; ri.data[k] = r; ri.data[k + 1] = r; ri.data[k + 2] = r; ri.data[k + 3] = 255;
    H[y * n + x] = out[3];
  }
  const s = bump * n / 256;
  for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) {
    const xl = (x - 1 + n) % n, xr = (x + 1) % n, yu = (y - 1 + m) % m, yd = (y + 1) % m;
    const dx = (H[y * n + xr] - H[y * n + xl]) * s, dy = (H[yd * n + x] - H[yu * n + x]) * s;
    const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4;
    ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  surfaces.set(key, sf);
  return sf;
}

/* ---------- materiais da área (cache por nome) ---------- */
const mats = new Map<string, THREE.Material>();
/** Material criado uma vez por chave (a chave vira o nome: "lounge-…", "terraco-…"). */
export function areaMat<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = mats.get(key) as T | undefined; if (hit) return hit;
  const m = make(); m.name = key; mats.set(key, m); return m;
}
/** Material PBR de uma superfície gerada (cor, relevo e rugosidade), com tinta e opções. */
export function surfaceMat(key: string, sf: AreaSurface, o: { tint?: string; metal?: number; normal?: number; vertex?: boolean; env?: number; rough?: number; repeat?: [number, number]; side?: THREE.Side } = {}): THREE.MeshStandardMaterial {
  return areaMat(key, () => {
    const pick = (t: THREE.Texture) => { if (!o.repeat) return t; const c = t.clone(); c.repeat.set(o.repeat[0], o.repeat[1]); c.needsUpdate = true; return c; };
    return new THREE.MeshStandardMaterial({
      map: pick(sf.map), normalMap: pick(sf.normalMap), roughnessMap: pick(sf.roughnessMap), normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
      color: new THREE.Color(o.tint ?? "#ffffff"), metalness: o.metal ?? 0, roughness: o.rough ?? 1, vertexColors: o.vertex ?? false, envMapIntensity: o.env ?? 1,
      side: o.side ?? THREE.FrontSide, shadowSide: THREE.DoubleSide,
    });
  });
}

/* ---------- geometrias ---------- */
/** Torneado (perfil [raio, altura]) com cache. */
export const lathe = (key: string, pts: [number, number][], seg = 24) => geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg));
/** Caixa de cantos arredondados com a base em y = 0 (almofadas, estofados, tampos boleados), cache pela medida. */
export function rbox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  const k = `lounge-rbox-${w.toFixed(3)}-${h.toFixed(3)}-${d.toFixed(3)}-${r.toFixed(3)}-${seg}`;
  return geo(k, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)).translate(0, h / 2, 0));
}
/** Painel almofadado (retângulo com bisel de 45° na frente): w × h na face, `t` de espessura, `b` de bisel. Olha para +z. */
export function raisedPanel(w: number, h: number, t = 0.018, b = 0.035): THREE.BufferGeometry {
  const k = `lounge-panel-${w.toFixed(3)}-${h.toFixed(3)}-${t}-${b}`;
  return geo(k, () => {
    const s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b;
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, t - b * 0.4), bevelEnabled: true, bevelThickness: b * 0.4, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  });
}
/** Moldura em perfil: anel retangular w × h (medida externa) com largura `f` e espessura `t`, cantos em meia-esquadria. Olha para +z. */
export function frameRing(w: number, h: number, f: number, t: number): THREE.BufferGeometry {
  const k = `lounge-frame-${w.toFixed(3)}-${h.toFixed(3)}-${f}-${t}`;
  return geo(k, () => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
    const hole = new THREE.Path(); hole.moveTo(-w / 2 + f, -h / 2 + f); hole.lineTo(-w / 2 + f, h / 2 - f); hole.lineTo(w / 2 - f, h / 2 - f); hole.lineTo(w / 2 - f, -h / 2 + f); hole.closePath(); s.holes.push(hole);
    const bv = Math.min(f, t) * 0.35;
    return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, t - bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 1 });
  });
}
/** Tubo por uma curva (pontos em ordem), raio e segmentos; cache pela chave. */
export function tube(key: string, pts: [number, number, number][], r: number, seg = 24, radial = 8): THREE.BufferGeometry {
  return geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, r, radial, false));
}
/** Moldura de perfil corrido ao longo de x (perfil [y, z] no plano yz, z para fora): sanca, rodapé, corrimão. Comprimento 1. */
export function profileRun(key: string, prof: [number, number][]): THREE.BufferGeometry {
  return geo(key, () => {
    const s = new THREE.Shape(); s.moveTo(0, 0); for (const [y, z] of prof) s.lineTo(z, y); s.lineTo(0, prof[prof.length - 1][0]); s.closePath();
    // extrusão em z (comprimento 1), girada para correr em x: o perfil fica no plano yz, com a saliência para +z
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -0.5).rotateY(-Math.PI / 2);
  });
}

/**
 * Painel capitonê: plano w × h olhando para +z, subdividido a cada 2 cm, com as almofadas em losango estufadas `depth` e
 * os vincos entre os botões (as arestas dos losangos). Devolve a geometria e onde ficam os botões (x, y no plano).
 */
export function tufted(w: number, h: number, pitch: number, depth: number): { g: THREE.BufferGeometry; buttons: [number, number][] } {
  const px = pitch, py = pitch * 0.92;
  const pillow = (x: number, y: number) => {
    const a = (x + w / 2) / px, b = (y + h / 2) / py, u = a + b, v = a - b, fu = u - Math.floor(u), fv = v - Math.floor(v);
    const k = Math.sin(Math.PI * fu) * Math.sin(Math.PI * fv), e = smooth(0, 0.05, Math.min(x + w / 2, w / 2 - x, y + h / 2, h / 2 - y));
    return Math.pow(Math.max(0, k), 0.45) * (0.25 + 0.75 * e);
  };
  const g = geo(`lounge-tuft-${w.toFixed(3)}-${h.toFixed(3)}-${pitch}-${depth}`, () => {
    const pg = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(w / 0.02)), Math.max(6, Math.round(h / 0.02)));
    const pos = pg.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, depth * pillow(pos.getX(i), pos.getY(i)));
    pg.computeVertexNormals(); return pg;
  });
  const buttons: [number, number][] = [];
  for (let ia = 0; ia <= Math.floor((w / px) * 2); ia++) for (let ib = 0; ib <= Math.floor((h / py) * 2); ib++) {
    if ((ia + ib) % 2) continue;
    const x = (ia / 2) * px - w / 2, y = (ib / 2) * py - h / 2;
    if (x < -w / 2 + 0.05 || x > w / 2 - 0.05 || y < -h / 2 + 0.05 || y > h / 2 - 0.05) continue;
    buttons.push([x, y]);
  }
  return { g, buttons };
}
/**
 * Cortina franzida: pano w × h pendurado em y = h (cai até 0), com `folds` dobras fundas (`depth`), o pé abrindo um pouco
 * e, se `tie` > 0, apanhada por uma braçadeira a essa altura (o pano junta para o lado `dir` · x e bufa embaixo). Olha
 * para +z.
 */
export function drape(key: string, w: number, h: number, folds: number, depth: number, tie = 0, gatherTo = 0.5, dir: 1 | -1 = 1): THREE.BufferGeometry {
  return geo(`lounge-drape-${key}-${dir}`, () => {
    const g = new THREE.PlaneGeometry(w, h, Math.max(24, folds * 8), 24).translate(0, h / 2, 0);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = y / h, u = x / w + 0.5;
      // aperto na braçadeira (o pano junta para a borda de fora, x = +w/2) e solta abaixo dela
      let k = 1;
      if (tie > 0) { const d = Math.abs(y - tie) / h; k = gatherTo + (1 - gatherTo) * smooth(0, 0.35, d) * (y > tie ? 1 : 0.85); }
      const fold = Math.sin(u * folds * Math.PI * 2 + Math.sin(u * 7.3) * 0.6) * depth * (0.55 + 0.45 * (1 - t)) * (tie > 0 ? 0.8 + 0.6 * (1 - k) : 1);
      p.setXYZ(i, dir * w / 2 - (dir * w / 2 - x) * k, y, fold + depth);
    }
    g.computeVertexNormals(); return g;
  });
}
/** Cúpula plissada de abajur (tronco de cone com pregas): raio de baixo, de cima, altura e número de pregas. Aberta. */
export function pleatedShade(r0: number, r1: number, h: number, pleats: number): THREE.BufferGeometry {
  return geo(`lounge-shade-${r0}-${r1}-${h}-${pleats}`, () => {
    const g = new THREE.CylinderGeometry(r1, r0, h, pleats * 4, 4, true).translate(0, h / 2, 0);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.035 * Math.abs(Math.sin(a * pleats / 2 * 2));
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    g.computeVertexNormals(); return g;
  });
}

/* ---------- referencial dos móveis da planta ---------- */
/** Pegada do móvel no referencial dele: largura (x local), profundidade (z local, a frente olha para +z local) e giro. */
export interface Foot { cx: number; cz: number; w: number; d: number; yaw: number; r: number }
export function footOf(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw, r: p.shape.r };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw, r: Math.min(sx, sz) / 2 };
}
/** Matriz no referencial do móvel: (x, y, z) locais, giro local, escala, inclinações. */
export const at = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
/** Ponto do referencial do móvel em coordenadas do mundo. */
export const world = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
/** Âncora de luz num ponto do mundo. */
export const lamp = (anchors: LightAnchor[], room: InteriorRoom, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room, ...o });

/* ---------- sombra de contato própria (sobre tapete e deck, que cobrem a da montagem) ---------- */
export function contactMat(): THREE.MeshBasicMaterial {
  return areaMat("lounge-contactMat", () => new THREE.MeshBasicMaterial({ map: drawnTexture("lounge-contact", 128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1, d = (Math.abs(u) ** 6 + Math.abs(v) ** 6) ** (1 / 6), a = Math.max(0, Math.min(1, (1 - d) / 0.45)), k = (y * w + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(255 * a * a * (3 - 2 * a)); }
    g.putImageData(img, 0, 0);
  }, false), transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}

/* ---------- textura desenhada com tamanho por qualidade ---------- */
/** Lado das texturas desenhadas: 1024 no "high" e 512 no "low" (ou o pedido). */
export const side = (q: "high" | "low", hi = 1024) => (q === "high" ? hi : hi / 2);
