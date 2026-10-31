/*
 * MET Gala Heist v2 — Vestíbulo: o piso. Campo de granito polido em losangos (preto absoluto e branco salpicado, placas de
 * 60 cm na diagonal), faixa de borda junto às paredes (granito negro, filetes de mármore branco e de latão e a grega em
 * mármore), a rosácea embutida no centro (Ø 3,2 m: estrela de 16 pontas em mármores de quatro cores, meio a meio para
 * parecer em relevo, coroa de pedras alternadas, filetes de latão e o "V" do Museu Vesper), soleiras de mármore nas três
 * portas e os dois trechos do tapete vermelho (da rua à rosácea e da rosácea ao salão) com debrum e varões de latão.
 */
import * as THREE from "three";
import { BOX0, CYL, mat } from "../interior-batch";
import type { Quality } from "../interior-tex";
import type { RoomsCtx } from "./kit";
import { ROOM, VM, X0, X1, Z0, Z1, fbm, hash2, mix, smooth, vGeo, vMat, vSurface, vnoise, vein, type VSurface } from "./vestibulo-kit";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
/** Centro e raio da rosácea (sob o lustre, no meio da sala). */
export const ROSE = { x: 0, z: 19.25, r: 1.6 };
/** Largura da faixa de borda e o comprimento de uma repetição da grega. */
const BAND_W = 0.78, BAND_L = 1.56;
/** Metros por repetição do campo de losangos (placa de 60 cm na diagonal). */
export const FIELD_TILE: [number, number] = [0.8485, 0.8485];

/* ======================= campo de granito ======================= */
/** Losango central branco e os quatro cantos pretos (a outra cor) em cada repetição; junta de ~2 mm entre as placas. */
export function graniteFieldSurface(n: number): VSurface {
  return vSurface(`graniteField${n}`, n, n, (u, v, o) => {
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5), white = d < 0.5, edge = Math.abs(d - 0.5) * 0.7071;
    graniteAt(u, v, white, o);
    if (edge < 0.0016) { o[0] = o[1] = o[2] = white ? 0.26 : 0.2; o[3] = 0.3; o[4] = 0.55; }
    else if (edge < 0.003) { o[3] = 0.47; }                                     // aresta levemente quebrada (bisotê)
  }, 0.5);
}
/** Cor, altura e rugosidade do granito: branco (pintas de biotita, quartzo) ou preto absoluto (cristais de mica). */
function graniteAt(u: number, v: number, white: boolean, o: Float32Array) {
  if (white) {
    const big = vnoise(u * 150, v * 150, 150, 601), fine = vnoise(u * 360, v * 360, 360, 603), cl = fbm(u, v, 4, 605, 3), q = vnoise(u * 90, v * 90, 90, 607);
    let r = 0.79 + 0.06 * cl, g = 0.78 + 0.06 * cl, b = 0.76 + 0.06 * cl, ro = 0.11;
    if (q > 0.7) { const k = smooth(0.7, 0.8, q) * 0.45; r = mix(r, 0.6, k); g = mix(g, 0.61, k); b = mix(b, 0.63, k); ro = 0.06; }
    if (big > 0.76) { const k = smooth(0.76, 0.81, big); r = mix(r, 0.09, k); g = mix(g, 0.09, k); b = mix(b, 0.1, k); }
    else if (fine > 0.82) { const k = smooth(0.82, 0.88, fine) * 0.8; r = mix(r, 0.16, k); g = mix(g, 0.16, k); b = mix(b, 0.17, k); }
    else if (fine < 0.1) { r = mix(r, 0.86, 0.5); g = mix(g, 0.78, 0.5); b = mix(b, 0.74, 0.5); }      // feldspato rosado
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5; o[4] = ro;
  } else {
    const f = vnoise(u * 420, v * 420, 420, 611), cl = fbm(u, v, 5, 613, 3), m = vnoise(u * 210, v * 210, 210, 615);
    let k = 0.028 + 0.014 * cl; if (m > 0.84) k += 0.05 * smooth(0.84, 0.9, m);
    const fleck = f > 0.9;
    o[0] = fleck ? 0.22 : k; o[1] = fleck ? 0.22 : k; o[2] = fleck ? 0.24 : k * 1.12; o[3] = 0.5; o[4] = fleck ? 0.03 : 0.065;
  }
}
/** Material do campo (a casca troca o nome para "floor-vestibulo" e põe o reflexo planar pelo SurfaceOverride). */
export function floorMaterial(q: Quality): THREE.MeshStandardMaterial {
  return vMat(`floorField-${q}`, () => {
    const sf = graniteFieldSurface(q === "high" ? 1024 : 512);
    return new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, vertexColors: true, envMapIntensity: 1.1 });
  });
}

/* ======================= texturas desenhadas (faixa, rosácea, tapete) ======================= */
/** Ladrilho de ruído de cada pedra (256 px), usado como padrão de preenchimento no canvas. */
function stoneTile(kind: "nero" | "white" | "carrara" | "giallo" | "rosso" | "grey"): HTMLCanvasElement {
  const key = `vestibulo-stoneTile-${kind}`, hit = tiles.get(key); if (hit) return hit;
  const n = FAKE ? 8 : 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d") as CanvasRenderingContext2D, id = g.createImageData(n, n), o = new Float32Array(5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n, v = (y + 0.5) / n;
    if (kind === "nero") graniteAt(u * 0.6, v * 0.6, false, o);
    else if (kind === "white") graniteAt(u * 0.6, v * 0.6, true, o);
    else {
      const t = fbm(u, v, 3, 701 + kind.length, 4) * 5 + (u + v * 0.5) * 2, w = vein(t, 0.05) * (0.4 + 0.6 * fbm(u, v, 5, 709, 2)), cl = fbm(u, v, 4, 711, 3);
      const base: Record<string, [number, number, number]> = { carrara: [0.9, 0.9, 0.9], giallo: [0.84, 0.66, 0.32], rosso: [0.52, 0.16, 0.13], grey: [0.55, 0.55, 0.56] };
      const vc: Record<string, [number, number, number]> = { carrara: [0.52, 0.53, 0.57], giallo: [0.95, 0.88, 0.7], rosso: [0.85, 0.75, 0.7], grey: [0.85, 0.85, 0.86] };
      const b = base[kind], vv = vc[kind], k = 0.92 + 0.12 * cl;
      o[0] = mix(b[0] * k, vv[0], w * 0.6); o[1] = mix(b[1] * k, vv[1], w * 0.6); o[2] = mix(b[2] * k, vv[2], w * 0.6);
    }
    const i = (y * n + x) * 4; id.data[i] = o[0] * 255; id.data[i + 1] = o[1] * 255; id.data[i + 2] = o[2] * 255; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); tiles.set(key, c); return c;
}
const tiles = new Map<string, HTMLCanvasElement>();

/**
 * Superfície desenhada em canvas 2D: `draw` recebe três contextos (cor, altura em cinza, rugosidade em G e metal em B) e
 * pinta formas vetoriais; a altura vira mapa de relevo. Uma textura "rm" serve de roughnessMap (G) e metalnessMap (B).
 */
export function drawnSurface(key: string, w: number, h: number, draw: (col: CanvasRenderingContext2D, hgt: CanvasRenderingContext2D, rm: CanvasRenderingContext2D, w: number, h: number) => void, bump = 1.5): VSurface & { rm: THREE.Texture } {
  const k = `vestibulo-drawn-${key}`, hit = drawnCache.get(k); if (hit) return hit;
  const W = FAKE ? 8 : w, H = FAKE ? 8 : h;
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D }; };
  const col = mk(), hgt = mk(), rm = mk(), nor = mk();
  if (!FAKE) {
    hgt.g.fillStyle = "#808080"; hgt.g.fillRect(0, 0, W, H); rm.g.fillStyle = "rgb(0,30,0)"; rm.g.fillRect(0, 0, W, H);
    draw(col.g, hgt.g, rm.g, W, H);
    const hd = hgt.g.getImageData(0, 0, W, H).data, nd = nor.g.createImageData(W, H), s = bump * Math.max(W, H) / 1024;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const at = (xx: number, yy: number) => hd[((Math.min(H - 1, Math.max(0, yy)) * W) + Math.min(W - 1, Math.max(0, xx))) * 4] / 255;
      const dx = (at(x + 1, y) - at(x - 1, y)) * s * 8, dy = (at(x, y + 1) - at(x, y - 1)) * s * 8, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
      nd.data[i] = (-dx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
    }
    nor.g.putImageData(nd, 0, 0);
  }
  const t = (c: HTMLCanvasElement, srgb: boolean) => { const x = new THREE.CanvasTexture(c); x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; x.anisotropy = 8; x.wrapS = x.wrapT = THREE.RepeatWrapping; x.needsUpdate = true; return x; };
  const rmt = t(rm.c, false);
  const out = { map: t(col.c, true), normalMap: t(nor.c, false), roughnessMap: rmt, rm: rmt };
  drawnCache.set(k, out); return out;
}
const drawnCache = new Map<string, VSurface & { rm: THREE.Texture }>();
const pattern = (g: CanvasRenderingContext2D, kind: Parameters<typeof stoneTile>[0], scale = 1) => {
  const p = g.createPattern(stoneTile(kind), "repeat"); if (p && scale !== 1 && "setTransform" in p) p.setTransform(new DOMMatrix().scale(scale, scale)); return p ?? "#777";
};
/** Material de piso desenhado (cor, relevo, rugosidade/metal) com reflexo planar no "high". */
function inlayMaterial(key: string, sf: VSurface & { rm: THREE.Texture }): THREE.MeshStandardMaterial {
  return vMat(key, () => {
    const m = new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.rm, metalnessMap: sf.rm, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(0.7, 0.7),
      envMapIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.userData.mirror = [0.85, 0.05];
    return m;
  });
}

/** Faixa de borda: u ao longo da parede (1,56 m), v da parede (0) para dentro (0,78 m). À direita, o quadrado do canto. */
function bandSurface(q: Quality) {
  const n = q === "high" ? 1024 : 512;
  return drawnSurface(`band-${q}`, n * 1.5, n / 2, (g, hg, rm, W, H) => {
    const bw = W * (2 / 3), px = H / 0.78;                                      // px por metro (atravessado)
    const yAt = (m: number) => m * px;
    // granito negro de fundo, fileiras de filetes e a grega
    g.fillStyle = pattern(g, "nero"); g.fillRect(0, 0, W, H);
    const fil = (m0: number, m1: number, kind: "white" | "brass", x0 = 0, x1 = bw) => {
      if (kind === "brass") { g.fillStyle = "#c9a24b"; rm.fillStyle = "rgb(0,60,255)"; rm.fillRect(x0, yAt(m0), x1 - x0, yAt(m1) - yAt(m0)); }
      else g.fillStyle = pattern(g, "carrara");
      g.fillRect(x0, yAt(m0), x1 - x0, yAt(m1) - yAt(m0));
    };
    fil(0.4, 0.43, "white"); fil(0.43, 0.44, "brass"); fil(0.7, 0.71, "brass"); fil(0.71, 0.74, "white");
    // grega (meandro corrido) em mármore branco entre 0,46 e 0,68 m: quatro módulos por repetição
    const top = yAt(0.465), hh = yAt(0.675) - top, cw = bw / 4, lw = hh * 0.13;
    g.strokeStyle = pattern(g, "carrara"); g.lineWidth = lw; g.lineCap = "square"; g.lineJoin = "miter";
    const key: [number, number][] = [[0, 0.08], [0.8, 0.08], [0.8, 0.92], [0.2, 0.92], [0.2, 0.36], [0.6, 0.36], [0.6, 0.66], [0.42, 0.66]];
    for (let k = -1; k <= 4; k++) {
      g.beginPath(); key.forEach(([x, y], i) => { const X = (k + x) * cw, Y = top + (1 - y) * hh; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke();
      g.beginPath(); g.moveTo((k + 0.8) * cw, top + 0.92 * hh); g.lineTo((k + 1) * cw, top + 0.92 * hh); g.stroke();
    }
    // juntas: entre as placas (a cada 0,78 m ao longo) e nas divisões dos filetes
    hg.strokeStyle = "#202020"; hg.lineWidth = 2; g.strokeStyle = "rgba(20,20,20,0.6)"; g.lineWidth = 1.5;
    for (const m of [0.4, 0.74]) { hg.beginPath(); hg.moveTo(0, yAt(m)); hg.lineTo(bw, yAt(m)); hg.stroke(); }
    for (let x = 0; x <= bw; x += bw / 2) { for (const c of [g, hg]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, yAt(0.4)); c.stroke(); } }
    rm.fillStyle = "rgba(0,170,0,1)"; for (let x = 0; x <= bw; x += bw / 2) rm.fillRect(x - 1, 0, 3, yAt(0.4));
    // o quadrado do canto: negro com moldura branca, losango de latão e o disco de mármore amarelo
    const cx = bw + (W - bw) / 2, cy = H / 2, s = (W - bw) * 0.5;
    g.fillStyle = pattern(g, "nero"); g.fillRect(bw, 0, W - bw, H);
    g.strokeStyle = pattern(g, "carrara"); g.lineWidth = s * 0.08; g.strokeRect(cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.4);
    g.beginPath(); g.moveTo(cx, cy - s * 0.55); g.lineTo(cx + s * 0.55, cy); g.lineTo(cx, cy + s * 0.55); g.lineTo(cx - s * 0.55, cy); g.closePath(); g.fillStyle = "#c9a24b"; g.fill();
    rm.beginPath(); rm.moveTo(cx, cy - s * 0.55); rm.lineTo(cx + s * 0.55, cy); rm.lineTo(cx, cy + s * 0.55); rm.lineTo(cx - s * 0.55, cy); rm.closePath(); rm.fillStyle = "rgb(0,60,255)"; rm.fill();
    g.beginPath(); g.arc(cx, cy, s * 0.3, 0, Math.PI * 2); g.fillStyle = pattern(g, "giallo"); g.fill();
    rm.beginPath(); rm.arc(cx, cy, s * 0.3, 0, Math.PI * 2); rm.fillStyle = "rgb(0,30,0)"; rm.fill();
  }, 1.2);
}

/** Rosácea: estrela de 16 pontas (4 grandes, 4 médias, 8 pequenas), cada ponta meio clara e meio escura. */
function rosetteSurface(q: Quality) {
  const n = q === "high" ? 2048 : 1024;
  return drawnSurface(`rosette-${q}`, n, n, (g, hg, rm, W) => {
    const c = W / 2, R = W / 2 / 1.6;                                           // px por metro
    const ring = (r0: number, r1: number, fill: string | CanvasPattern, metal = false) => {
      g.beginPath(); g.arc(c, c, r1 * R, 0, Math.PI * 2); g.arc(c, c, r0 * R, 0, Math.PI * 2, true); g.fillStyle = fill; g.fill("evenodd");
      if (metal) { rm.beginPath(); rm.arc(c, c, r1 * R, 0, Math.PI * 2); rm.arc(c, c, r0 * R, 0, Math.PI * 2, true); rm.fillStyle = "rgb(0,55,255)"; rm.fill("evenodd"); }
      for (const r of [r0, r1]) { hg.beginPath(); hg.arc(c, c, r * R, 0, Math.PI * 2); hg.strokeStyle = "#202020"; hg.lineWidth = 2; hg.stroke(); }
    };
    g.fillStyle = pattern(g, "carrara"); g.fillRect(0, 0, W, W);
    ring(1.52, 1.6, pattern(g, "nero")); ring(1.5, 1.52, "#c9a24b", true);
    // coroa de 32 pedras alternadas (negro / branco)
    for (let k = 0; k < 32; k++) {
      const a0 = (k / 32) * Math.PI * 2, a1 = ((k + 1) / 32) * Math.PI * 2;
      g.beginPath(); g.arc(c, c, 1.5 * R, a0, a1); g.arc(c, c, 1.3 * R, a1, a0, true); g.closePath(); g.fillStyle = pattern(g, k % 2 ? "nero" : "white"); g.fill();
      hg.beginPath(); hg.moveTo(c + Math.cos(a0) * 1.3 * R, c + Math.sin(a0) * 1.3 * R); hg.lineTo(c + Math.cos(a0) * 1.5 * R, c + Math.sin(a0) * 1.5 * R); hg.strokeStyle = "#303030"; hg.lineWidth = 2; hg.stroke();
    }
    ring(1.28, 1.3, "#c9a24b", true);
    // a estrela: pontas grandes (giallo/nero), médias (carrara/grey), pequenas (rosso/nero), sempre meio a meio
    const point = (a: number, len: number, half: number, light: Parameters<typeof stoneTile>[0], dark: Parameters<typeof stoneTile>[0]) => {
      const tip = [c + Math.cos(a) * len * R, c + Math.sin(a) * len * R], l = [c + Math.cos(a - half) * 0.32 * R, c + Math.sin(a - half) * 0.32 * R], r = [c + Math.cos(a + half) * 0.32 * R, c + Math.sin(a + half) * 0.32 * R];
      for (const [side, kind] of [[l, light], [r, dark]] as const) {
        g.beginPath(); g.moveTo(c, c); g.lineTo(side[0], side[1]); g.lineTo(tip[0], tip[1]); g.closePath(); g.fillStyle = pattern(g, kind); g.fill();
        hg.beginPath(); hg.moveTo(c, c); hg.lineTo(side[0], side[1]); hg.lineTo(tip[0], tip[1]); hg.closePath(); hg.strokeStyle = "#252525"; hg.lineWidth = 2.5; hg.stroke();
      }
    };
    for (let k = 0; k < 8; k++) point((k + 0.5) / 8 * Math.PI * 2 - Math.PI / 2, 0.78, 0.17, "rosso", "nero");
    for (let k = 0; k < 4; k++) point((k + 0.5) / 4 * Math.PI * 2 - Math.PI / 2, 1.02, 0.2, "carrara", "grey");
    for (let k = 0; k < 4; k++) point((k / 4) * Math.PI * 2 - Math.PI / 2, 1.28, 0.22, "giallo", "nero");
    // centro: anel de latão, disco negro e o "V" de latão do Museu Vesper
    ring(0.24, 0.27, "#c9a24b", true);
    g.beginPath(); g.arc(c, c, 0.24 * R, 0, Math.PI * 2); g.fillStyle = pattern(g, "nero"); g.fill();
    const v = (fill: string, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath(); const s = 0.16 * R;
      ctx.moveTo(c - s, c - s * 0.85); ctx.lineTo(c - s * 0.62, c - s * 0.85); ctx.lineTo(c, c + s * 0.55); ctx.lineTo(c + s * 0.62, c - s * 0.85); ctx.lineTo(c + s, c - s * 0.85); ctx.lineTo(c + s * 0.1, c + s * 0.95); ctx.lineTo(c - s * 0.1, c + s * 0.95); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    };
    v("#d2ab55", g); v("rgb(0,50,255)", rm); v("#9a9a9a", hg);
  }, 1.4);
}

/** Tapete: veludo vermelho com tom variando, uma linha dourada tecida a 12 cm da borda e o desenho miúdo em losangos. */
function carpetTexture(q: Quality) {
  const n = q === "high" ? 1024 : 512;
  return drawnSurface(`carpet-${q}`, n, n / 2, (g, hg, rm, W, H) => {
    if (FAKE) return;
    const id = g.createImageData(W, H), hd = hg.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, pile = vnoise(u * 300, v * 150, 300, 801), cl = fbm(u, v, 3, 803, 3);
      const lu = Math.abs(u - 0.5) * 2.6, gold = Math.abs(lu - 1.06) < 0.012;      // u: 0…1 = 2,6 m; linha a 0,24 m da borda (1,3 − 0,24)
      const dia = Math.abs(((u * 2.6 * 5) % 1) - 0.5) + Math.abs(((v * 1.3 * 5) % 1) - 0.5), motif = lu < 1.0 && Math.abs(dia - 0.42) < 0.03;
      let r = 0.42 + 0.06 * cl + 0.05 * pile, gg = 0.03 + 0.015 * pile, b = 0.06 + 0.02 * pile;
      if (motif) { r *= 0.8; gg *= 0.8; b *= 0.85; }
      if (gold) { r = 0.78; gg = 0.58; b = 0.26; }
      const i = (y * W + x) * 4; id.data[i] = r * 255; id.data[i + 1] = gg * 255; id.data[i + 2] = b * 255; id.data[i + 3] = 255;
      const h = 110 + pile * 40 - (motif ? 20 : 0); hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = h; hd.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0); hg.putImageData(hd, 0, 0); rm.fillStyle = "rgb(0,235,0)"; rm.fillRect(0, 0, W, H);
  }, 0.8);
}

/* ======================= montagem ======================= */
/** Retângulo horizontal com uv dado nos quatro cantos (a, b = cantos opostos em x/z). */
function flat(x0: number, z0: number, x1: number, z1: number, y: number, uv: [number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv.flat(), 2)); g.setIndex([0, 1, 2, 0, 2, 3]); return g;
}

export function buildFloor(c: RoomsCtx) {
  const V = VM(c.q), q = c.q;
  /* faixa de borda (onde a escadaria não cobre) */
  const band = inlayMaterial(`band-${q}`, bandSurface(q)), y = 0.0015, f = 2 / 3;      // f: fração da textura que é a faixa
  const runs: { x0: number; z0: number; x1: number; z1: number; along: "x" | "z"; inward: 1 | -1 }[] = [
    { x0: -3.9, z0: Z0, x1: 3.9, z1: Z0 + BAND_W, along: "x", inward: 1 },                     // norte (sob a galeria)
    { x0: X0 + BAND_W, z0: Z1 - BAND_W, x1: X1 - BAND_W, z1: Z1, along: "x", inward: -1 },     // sul
    { x0: X0, z0: 17.9, x1: X0 + BAND_W, z1: Z1 - BAND_W, along: "z", inward: 1 },             // oeste
    { x0: X1 - BAND_W, z0: 17.9, x1: X1, z1: Z1 - BAND_W, along: "z", inward: -1 },            // leste
  ];
  for (const r of runs) {
    const len = r.along === "x" ? r.x1 - r.x0 : r.z1 - r.z0, u1 = (len / BAND_L) * f;
    // v = 0 na parede, 1 no lado de dentro; u ao longo (a faixa repete: a textura é 2/3 faixa + 1/3 canto, então o uv
    // ao longo usa só a fração da faixa por repetição — a borda direita da faixa casa com a esquerda)
    const segs = Math.ceil(len / BAND_L);
    for (let k = 0; k < segs; k++) {
      const a = k * BAND_L, b = Math.min(len, a + BAND_L), ua = 0, ub = ((b - a) / BAND_L) * f;
      if (r.along === "x") {
        const xa = r.x0 + a, xb = r.x0 + b, zw = r.inward > 0 ? r.z0 : r.z1, zi = r.inward > 0 ? r.z1 : r.z0;
        c.batch.add(ROOM, band, flat(xa, Math.min(zw, zi), xb, Math.max(zw, zi), y, r.inward > 0 ? [[ua, 1], [ub, 1], [ub, 0], [ua, 0]] : [[ua, 0], [ub, 0], [ub, 1], [ua, 1]]), undefined, { receive: true });
      } else {
        const za = r.z0 + a, zb = r.z0 + b, xw = r.inward > 0 ? r.x0 : r.x1, xi = r.inward > 0 ? r.x1 : r.x0;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([xw, y, za, xw, y, zb, xi, y, zb, xi, y, za], 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute([ua, 0, ub, 0, ub, 1, ua, 1], 2));
        g.setIndex(r.inward > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
        c.batch.add(ROOM, band, g, undefined, { receive: true });
      }
    }
    void u1;
  }
  // quadrados dos cantos sul (os do norte ficam sob a escadaria)
  for (const x of [X0, X1 - BAND_W]) c.batch.add(ROOM, band, flat(x, Z1 - BAND_W, x + BAND_W, Z1, y, [[f, 0], [1, 0], [1, 1], [f, 1]]), undefined, { receive: true });

  /* rosácea */
  const rose = inlayMaterial(`rosette-${q}`, rosetteSurface(q));
  c.batch.add(ROOM, rose, vGeo("roseDisc", () => new THREE.CircleGeometry(ROSE.r, 128).rotateX(-Math.PI / 2)), mat(ROSE.x, 0.0025, ROSE.z), { receive: true });

  /* soleiras de mármore nas três portas (1,2 cm, com a aresta da frente boleada) */
  for (const [x0, z0, x1, z1] of [[-2.02, 14.0, 2.02, 14.5], [-2.02, 24.0, 2.02, 24.5], [-8.5, 19.98, -8.0, 22.52]] as [number, number, number, number][]) {
    c.batch.add(ROOM, V.carrara, BOX0(), mat((x0 + x1) / 2, 0, (z0 + z1) / 2, 0, x1 - x0, 0.012, z1 - z0), { receive: true });
  }

  /* tapete vermelho: da rua até a rosácea e da rosácea até a porta do salão */
  const carpet = carpetTexture(q), cm = vMat(`carpetMat-${q}`, () => new THREE.MeshPhysicalMaterial({ map: carpet.map, normalMap: carpet.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95,
    sheen: 1, sheenColor: new THREE.Color("#ff6070"), sheenRoughness: 0.4, envMapIntensity: 0.5 }));
  const W = 2.6, T = 0.013;
  for (const [za, zb] of [[ROSE.z + ROSE.r - 0.38, 24.48], [14.3, ROSE.z - ROSE.r + 0.38]] as [number, number][]) {
    const L = zb - za, mid = (za + zb) / 2;
    // corpo com uv: u atravessado (0…1 = 2,6 m), v ao longo (1 repetição = 1,3 m)
    const g = new THREE.BoxGeometry(W, T, L, 1, 1, 1).translate(0, T / 2, 0), uv = g.getAttribute("uv") as THREE.BufferAttribute, pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getZ(i) / 1.3);
    c.batch.add(ROOM, cm, g, mat(0, 0.001, mid), { receive: true });
    // debrum: fita de gorgorão dourado-escuro nas bordas compridas, um pouco mais alta
    for (const s of [-1, 1]) c.batch.add(ROOM, V.brassAged, BOX0(), mat(s * (W / 2 - 0.02), 0.001, mid, 0, 0.045, T + 0.003, L), { receive: true });
    // varões de latão nas pontas, presos por dois suportes
    for (const z of [za + 0.04, zb - 0.04]) {
      if (z > 24.3) continue;                                                    // a ponta da rua passa sob a porta
      c.batch.add(ROOM, V.brass, CYL(12), mat(0, 0.014, z, 0, 0.011, W + 0.12, 0.011, 0, Math.PI / 2));
      for (const s of [-1, 1]) {
        c.batch.add(ROOM, V.brass, vGeo("rodFinial", () => new THREE.SphereGeometry(0.022, 12, 8)), mat(s * (W / 2 + 0.07), 0.016, z));
        c.batch.add(ROOM, V.brass, BOX0(), mat(s * (W / 2 + 0.035), 0, z, 0, 0.03, 0.02, 0.03));
      }
    }
  }
  void hash2;
}
