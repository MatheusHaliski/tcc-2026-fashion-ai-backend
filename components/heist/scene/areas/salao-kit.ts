/*
 * MET Gala Heist v2 — Grande Salão — ferramentas da área: pegada e matriz local dos móveis, torneados, materiais e
 * texturas próprias (chaves "salao-…": nenhuma outra área divide estas), inclusive o gerador de superfícies com cor,
 * relevo e rugosidade (cópia adaptada do de interior-tex.ts) para o piso de mármore, a madeira da pista e a marchetaria.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, Batch, Instances, geo, mat, mul } from "../interior-batch";
import { fabric, glass, glow, solid } from "../interior-mats";
import { drawnTexture, type Quality } from "../interior-tex";

export const ROOM = "salao" as const;
/** Nos testes (jsdom) as texturas saem com 8 px, sem desenhar. */
export const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ---------- pegada e matriz local ---------- */
/** Pegada do móvel no referencial dele: largura (x local), profundidade (z local, a frente olha para +z local) e giro. */
export interface Foot { cx: number; cz: number; w: number; d: number; yaw: number; r: number }
export function foot(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw, r: p.shape.r };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw, r: Math.min(sx, sz) / 2 };
}
/** Matriz no referencial do móvel: (x, y, z) locais, giro local, escala. */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
export const worldOf = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
/** Caixa com a base em y (no referencial do móvel). */
export const bx = (batch: Batch, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: { cast?: boolean; ry?: number } = {}) =>
  batch.add(ROOM, m, BOX0(), L(f, x, y, z, o.ry ?? 0, sx, sy, sz), { cast: o.cast });
/** Caixa no mundo, base em y. */
export const wbx = (batch: Batch, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) =>
  batch.add(ROOM, m, BOX0(), mat(x, y, z, ry, sx, sy, sz), { cast });

/* ---------- geometrias ---------- */
/** Torneado (perfil [raio, altura]) com cache de área. */
export const lathe = (key: string, pts: number[][], seg = 24) => geo(`salao-${key}`, () => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg));
/** Caixa com chanfro (perfil arredondado) — tampos, frentes, almofadas. Base em y = 0, centrada em x/z. */
export function roundedBox(key: string, w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  return geo(`salao-rbox-${key}`, () => {
    const s = new THREE.Shape(), x = w / 2 - r, z = d / 2 - r;
    s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.absarc(x, -z, r, -Math.PI / 2, 0, false); s.lineTo(w / 2, z); s.absarc(x, z, r, 0, Math.PI / 2, false);
    s.lineTo(-x, d / 2); s.absarc(-x, z, r, Math.PI / 2, Math.PI, false); s.lineTo(-w / 2, -z); s.absarc(-x, -z, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * Math.min(r, h / 3), bevelEnabled: true, bevelThickness: Math.min(r, h / 3), bevelSize: Math.min(r, h / 3) * 0.6, bevelSegments: seg, curveSegments: 4 * seg });
    g.rotateX(-Math.PI / 2); g.translate(0, Math.min(r, h / 3), 0); return g;
  });
}
/** Almofada em relevo (painel com chanfro nas quatro bordas), espessura t, face para +z. */
export function raisedPanel(key: string, w: number, h: number, t: number, bevel: number): THREE.BufferGeometry {
  return geo(`salao-panel-${key}`, () => {
    const s = new THREE.Shape(); s.moveTo(-w / 2 + bevel, -h / 2 + bevel); s.lineTo(w / 2 - bevel, -h / 2 + bevel); s.lineTo(w / 2 - bevel, h / 2 - bevel); s.lineTo(-w / 2 + bevel, h / 2 - bevel); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, t - bevel * 0.5), bevelEnabled: true, bevelThickness: bevel * 0.5, bevelSize: bevel, bevelSegments: 1 });
  });
}
/** Tubo por pontos (cabos, alças), com cache. */
export const tube = (key: string, pts: number[][], r: number, seg = 24, radial = 6) => geo(`salao-tube-${key}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, r, radial, false));

/* ---------- materiais da área ---------- */
export const salaoSolid = (key: string, color: string, o: Parameters<typeof solid>[2] = {}) => solid(`salao-${key}`, color, o);
export const salaoFabric = (key: string, color: string, q: Quality, o: Parameters<typeof fabric>[3] = {}) => fabric(`salao-${key}`, color, q, o);
export const salaoGlow = (key: string, color: string, k = 1, o: Parameters<typeof glow>[3] = {}) => glow(`salao-${key}`, color, k, o);
export const salaoGlass = (key: string, o: Parameters<typeof glass>[1] = {}) => glass(`salao-${key}`, o);
const mats = new Map<string, THREE.Material>();
/** Material próprio (com textura) criado uma vez por chave. */
export function salaoMat<T extends THREE.Material>(key: string, make: () => T): T {
  const k = `salao-${key}`, hit = mats.get(k) as T | undefined; if (hit) return hit;
  const m = make(); m.name = k; mats.set(k, m); return m;
}

/* ---------- lote por acabamento (cor por vértice) ---------- */
/*
 * As peças pequenas do salão (equipamento do DJ, comida, doces, ferragens) usam dezenas de cores lisas; cada material
 * seria uma chamada de desenho. `tinting(c)` devolve o contexto com o lote e as instâncias trocados: um material liso
 * "solid-salao-…" (sem textura, opaco, sem emissão) vira um material branco com cor por vértice, um por acabamento
 * (metal/rugosidade/ambiente arredondados), e a cor vai assada na geometria. Instâncias pequenas (até ~6 mil triângulos
 * por chave) entram no mesmo lote; as grandes (cascas de macaron, taças, rosas) continuam instanciadas.
 */
const tintMats = new Map<string, THREE.MeshStandardMaterial>();
const _tc = new THREE.Color();
function tintOf(m: THREE.Material): { mat: THREE.MeshStandardMaterial; color: THREE.Color } | null {
  const s = m as THREE.MeshStandardMaterial;
  if (s.type !== "MeshStandardMaterial" || !s.name.startsWith("solid-salao-") || s.map || s.normalMap || s.roughnessMap || s.transparent || s.opacity < 1 || s.vertexColors) return null;
  if (s.emissive && (s.emissive.r + s.emissive.g + s.emissive.b) * s.emissiveIntensity > 0.001) return null;
  const metal = Math.round(s.metalness * 4) / 4, rough = Math.round(s.roughness * 10) / 10, env = Math.round(s.envMapIntensity * 4) / 4, key = `${s.side}|${metal}|${rough}|${env}`;
  let t = tintMats.get(key);
  if (!t) { t = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, metalness: metal, roughness: rough, envMapIntensity: env, side: s.side }); t.name = `salao-tint-${key}`; tintMats.set(key, t); }
  return { mat: t, color: s.color };
}
function tinted(g: THREE.BufferGeometry, c: THREE.Color, k?: THREE.Color): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone(), n = out.getAttribute("position").count, a = new Float32Array(n * 3);
  _tc.copy(c); if (k) _tc.multiply(k);
  for (let i = 0; i < n; i++) { a[i * 3] = _tc.r; a[i * 3 + 1] = _tc.g; a[i * 3 + 2] = _tc.b; }
  out.setAttribute("color", new THREE.BufferAttribute(a, 3)); return out;
}
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
/** Contexto com lote/instâncias por acabamento (ver acima). Chame `done()` no fim para decidir as instâncias. */
export function tinting<T extends { batch: Batch; inst: Instances }>(c: T): T & { done: () => void } {
  const base = c.batch, binst = c.inst;
  const batch = Object.create(base) as Batch;
  batch.add = (room, m, g, mm, o = {}) => { const t = tintOf(m); if (t) base.add(room, t.mat, tinted(g, t.color), mm, o); else base.add(room, m, g, mm, o); };
  const held = new Map<string, { room: string; g: THREE.BufferGeometry; m: THREE.Material; items: [THREE.Matrix4, THREE.Color | undefined][] }>();
  const inst = Object.create(binst) as Instances;
  inst.add = (room, key, g, m, mm, color) => {
    if (!tintOf(m)) { binst.add(room, key, g, m, mm, color); return; }
    const k = `${room}|${key}|${m.uuid}`; let h = held.get(k); if (!h) { h = { room, g, m, items: [] }; held.set(k, h); }
    h.items.push([mm.clone(), color?.clone()]);
  };
  const done = () => {
    for (const [k, h] of held) {
      const key = k.split("|")[1];
      if (tris(h.g) * h.items.length > 6000) { for (const [mm, col] of h.items) binst.add(h.room, key, h.g, h.m, mm, col); continue; }
      const t = tintOf(h.m)!; for (const [mm, col] of h.items) base.add(h.room, t.mat, tinted(h.g, t.color, col), mm);
    }
    held.clear();
  };
  return { ...c, batch, inst, done };
}

/* ---------- feixes de luz instanciados ---------- */
/**
 * Feixe aditivo (cone aberto do ápice em y = 0 até a base em y = −1), cor por instância, mais forte perto da lente e na
 * silhueta. Serve às malhas instanciadas (moving heads, pin spots): uma chamada de desenho por conjunto. A normal usa a
 * inversa-transposta da escala da instância (o cone é esticado em y).
 */
export function salaoBeamMaterial(key: string, fall = 0.8, pow = 1.4): THREE.ShaderMaterial {
  return salaoMat(`beam-${key}`, () => new THREE.ShaderMaterial({
    uniforms: { uFall: { value: fall }, uPow: { value: pow } },
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main() {
        vY = position.y; vec3 n = normal; vC = vec3(1.0);
        #ifdef USE_INSTANCING
          mat3 m3 = mat3(instanceMatrix);
          n = m3 * (n / vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2])));
          vec4 wp = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 wp = modelViewMatrix * vec4(position, 1.0);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vN = normalize(normalMatrix * n); vV = normalize(-wp.xyz);
        gl_Position = projectionMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFall; uniform float uPow; varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main() { float edge = pow(abs(dot(vN, vV)), uPow); float f = clamp(-vY, 0.0, 1.0); gl_FragColor = vec4(vC * edge * (1.0 - uFall * f), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
}
/** Feixes parados (pin spots sobre os doces, o bufê e os globos): juntam-se e saem numa malha instanciada só. */
export class BeamSet {
  private items: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  /** Feixe do ponto `top` ao `bottom`, raio `r` na base, cor × k. */
  add(top: THREE.Vector3, bottom: THREE.Vector3, r: number, color: string, k: number) {
    const o = new THREE.Object3D(); o.position.copy(top); o.lookAt(bottom); o.rotateX(-Math.PI / 2); o.scale.set(r, top.distanceTo(bottom), r); o.updateMatrix();
    this.items.push({ m: o.matrix.clone(), c: new THREE.Color(color).multiplyScalar(k) });
  }
  flush(group: THREE.Group) {
    if (!this.items.length) return;
    const im = new THREE.InstancedMesh(geo("salao-beamCone16", () => new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, -0.5, 0)), salaoBeamMaterial("pin", 0.55, 1.6), this.items.length);
    this.items.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
    im.computeBoundingSphere(); im.renderOrder = 4; im.userData.room = ROOM; group.add(im); this.items = [];
  }
}

/* ---------- superfícies procedurais (cor + relevo + rugosidade) ---------- */
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). */
export type PixelFn = (u: number, v: number, out: Float32Array) => void;
const surfaces = new Map<string, Surface>();
function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, srgb: boolean, aniso = 8): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}
/** Gera cor, relevo (normal pelo gradiente da altura, dando a volta na borda) e rugosidade de uma vez. */
export function surface(key: string, size: number, fn: PixelFn, bump = 1.5, wrap = true): Surface {
  const k = `salao-${key}`, hit = surfaces.get(k); if (hit) return hit;
  const n = FAKE ? 8 : size;
  const col = canvas(n, n), nor = canvas(n, n), rou = canvas(n, n);
  const ci = col.g.createImageData(n, n), ni = nor.g.createImageData(n, n), ri = rou.g.createImageData(n, n);
  const H = new Float32Array(n * n), out = new Float32Array(5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    out[3] = 0.5; out[4] = 0.5;
    if (!FAKE) fn((x + 0.5) / n, (y + 0.5) / n, out); else { out[0] = out[1] = out[2] = 0.5; }
    const i = (y * n + x) * 4;
    ci.data[i] = Math.max(0, Math.min(255, out[0] * 255)); ci.data[i + 1] = Math.max(0, Math.min(255, out[1] * 255)); ci.data[i + 2] = Math.max(0, Math.min(255, out[2] * 255)); ci.data[i + 3] = 255;
    const r = Math.max(0, Math.min(255, out[4] * 255)); ri.data[i] = r; ri.data[i + 1] = r; ri.data[i + 2] = r; ri.data[i + 3] = 255;
    H[y * n + x] = out[3];
  }
  const s = bump * n / 256;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xl = wrap ? (x - 1 + n) % n : Math.max(0, x - 1), xr = wrap ? (x + 1) % n : Math.min(n - 1, x + 1), yu = wrap ? (y - 1 + n) % n : Math.max(0, y - 1), yd = wrap ? (y + 1) % n : Math.min(n - 1, y + 1);
    const dx = (H[y * n + xr] - H[y * n + xl]) * s, dy = (H[yd * n + x] - H[yu * n + x]) * s;
    const l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    ni.data[i] = (-dx / l * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  if (!wrap) for (const t of [sf.map, sf.normalMap, sf.roughnessMap]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  surfaces.set(k, sf); return sf;
}
/** Material PBR de uma superfície (cor, relevo, rugosidade), com reflexo planar opcional (pisos: userData.mirror). */
export function surfaceMat(key: string, sf: Surface, o: { tint?: string; normal?: number; env?: number; metal?: number; mirror?: [number, number]; transparent?: boolean; polygonOffset?: boolean } = {}): THREE.MeshStandardMaterial {
  return salaoMat(`sm-${key}`, () => {
    const m = new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
      color: new THREE.Color(o.tint ?? "#ffffff"), roughness: 1, metalness: o.metal ?? 0, envMapIntensity: o.env ?? 1, transparent: o.transparent ?? false });
    if (o.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
    if (o.mirror) m.userData.mirror = o.mirror;
    return m;
  });
}

/* ---------- ruído (determinístico) ---------- */
export function hash2(x: number, y: number, s: number) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Ruído de valor que dá a volta a cada `p` células (texturas sem emenda). */
export function vnoise(u: number, v: number, p: number, s: number) {
  const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const w = (i: number, j: number) => hash2(((i % p) + p) % p, ((j % p) + p) % p, s);
  return (w(xi, yi) * (1 - fx) + w(xi + 1, yi) * fx) * (1 - fy) + (w(xi, yi + 1) * (1 - fx) + w(xi + 1, yi + 1) * fx) * fy;
}
export function fbm(u: number, v: number, p: number, s: number, oct = 4) { let a = 0, amp = 0.5, f = 1, n = 0; for (let k = 0; k < oct; k++) { a += vnoise(u * f, v * f, p, s + k * 31) * amp; n += amp; amp *= 0.5; f *= 2; } return a / n; }
/** Veio de mármore: 1 sobre o veio (t = coordenada turbulenta). */
export function vein(t: number, width: number) { const s = Math.abs(Math.sin(t * Math.PI)); return 1 - Math.min(1, s / width); }
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

/* ---------- texturas desenhadas da área ---------- */
export const salaoTexture = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) => drawnTexture(`salao-${key}`, w, h, draw, srgb);
/** Mancha suave (luz no piso, halo) com miolo opcional (gobo de estrela). */
export function spotTexture(gobo: boolean): THREE.Texture {
  return salaoTexture(gobo ? "spotGobo" : "spotSoft", 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.55, "rgba(255,255,255,0.75)"); grd.addColorStop(0.8, "rgba(255,255,255,0.2)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    if (gobo) {
      // gobo: anel de pontas de estrela (a luz sai recortada, como um gobo de moving head)
      g.globalCompositeOperation = "destination-out"; g.fillStyle = "rgba(0,0,0,0.85)";
      for (let k = 0; k < 8; k++) { g.save(); g.translate(w / 2, h / 2); g.rotate((k / 8) * Math.PI * 2); g.beginPath(); g.moveTo(w * 0.08, 0); g.lineTo(w * 0.4, -w * 0.05); g.lineTo(w * 0.4, w * 0.05); g.closePath(); g.fill(); g.restore(); }
      g.globalCompositeOperation = "source-over";
    }
  }, false);
}
/** Campo de pontinhos de luz do globo espelhado (projetado no piso, nas paredes e no teto). */
export function sparkleTexture(): THREE.Texture {
  const t = salaoTexture("sparkle", 1024, 1024, (g, w, h) => {
    const R = rand(919);
    for (let k = 0; k < 420; k++) {
      const x = R() * w, y = R() * h, r = 2 + R() * 4.5, a = 0.35 + R() * 0.65;
      const grd = g.createRadialGradient(x, y, 0, x, y, r * 2.2); grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(0.4, `rgba(255,255,255,${a * 0.5})`); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
