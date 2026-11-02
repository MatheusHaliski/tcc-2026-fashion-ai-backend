/*
 * MET Gala Heist v2 — Vestíbulo: as texturas desenhadas do piso. Ladrilhos de ruído de cada pedra (padrão de
 * preenchimento do canvas), a superfície desenhada em canvas 2D (cor, altura → relevo, rugosidade/metal) e os três
 * desenhos: a faixa de borda com filetes, grega e o quadrado do canto; a rosácea de 16 pontas em mármores de quatro cores
 * com coroa, filetes de latão e o "V" do Museu Vesper; e o tapete vermelho com a linha dourada e o desenho em losangos.
 * Nos testes (jsdom) as texturas saem com 8 px, sem desenhar.
 */
import * as THREE from "three";
import type { Quality } from "../interior-tex";
import { fbm, mix, vein, vnoise, type VSurface } from "./vestibulo-kit";
import { graniteAt } from "./vestibulo-granite";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

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

/** Faixa de borda: u ao longo da parede (1,56 m), v da parede (0) para dentro (0,78 m). À direita, o quadrado do canto. */
export function bandSurface(q: Quality) {
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
export function rosetteSurface(q: Quality) {
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
export function carpetTexture(q: Quality) {
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
