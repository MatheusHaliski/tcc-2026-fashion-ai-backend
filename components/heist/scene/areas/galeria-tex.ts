/*
 * MET Gala Heist v2 — Instituto do Traje: texturas e materiais próprios da galeria (Z07), gerados no navegador.
 *  · piso: parquet de carvalho defumado em espinha de peixe a 45° (tábuas de 9 × 54 cm), juntas de 1,5 mm, chanfro e
 *    veio ao comprido, verniz acetinado; faixa de granito preto São Gabriel junto às paredes;
 *  · paredes: tecido pintado (trama de linho) tingido por vértice na cor de cada seção, gesso das molduras e do teto;
 *  · textos de parede (atlas com fundo transparente), inscrição dourada do friso, etiquetas de museu (atlas), croquis a
 *    grafite e aquarela e desenhos de joia a guache sobre papel cinza (atlas), o fundo "aurora" do nicho e o vidro
 *    fosco do lanternim.
 */
import * as THREE from "three";
import { rand, type Quality } from "../interior-tex";
import { fbm, hash2, mix, once, paint, qs, smooth, surf, surfMat, vnoise } from "./galeria-kit";
export { wallTextAtlas, creditsAtlas, friezeText, LABEL_COLS, LABEL_ROWS, labelAtlas, CATALOG_COVER } from "./galeria-tex-textos";
export { ART_COLS, ART_ROWS, artAtlas } from "./galeria-tex-arte";

/* ---------- piso: espinha de peixe ---------- */
const HB_N = 6, HB_W = 0.09;
/** Metros cobertos por uma repetição da textura do parquet (período da espinha de peixe girada 45°). */
export const HB_TILE = 2 * Math.SQRT2 * HB_N * HB_W;
function herringbone(u: number, v: number, o: Float32Array) {
  // (u, v) → largura de tábua; girando 45°, a espinha vira a rede (1, 1)·a + (n, −n)·b com uma tábua deitada e uma em pé
  const T = 2 * Math.SQRT2 * HB_N, X = u * T, Yv = v * T;
  const px = (X + Yv) / Math.SQRT2, py = (Yv - X) / Math.SQRT2;
  const fa = Math.floor((px + py) / 2), fb = Math.floor((px - py) / (2 * HB_N));
  let along = 0, across = 0, ia = 0, ib = 0, vert = -1;
  for (let a = fa - 3; a <= fa + 1 && vert < 0; a++) for (let b = fb - 1; b <= fb + 1 && vert < 0; b++) {
    const dx = px - (a + b * HB_N), dy = py - (a - b * HB_N);
    if (dx >= 0 && dx < HB_N && dy >= 0 && dy < 1) { vert = 0; along = dx / HB_N; across = dy; ia = a; ib = b; }
    else if (dx >= HB_N && dx < HB_N + 1 && dy >= 1 - HB_N && dy < 1) { vert = 1; along = (dy - 1 + HB_N) / HB_N; across = dx - HB_N; ia = a; ib = b; }
  }
  if (vert < 0) { o[0] = o[1] = o[2] = 0.05; o[3] = 0.3; o[4] = 0.8; return; }
  // a mesma tábua do outro lado da borda da textura tem o mesmo índice módulo o período (2n, 2)
  const ma = ((ia % (2 * HB_N)) + 2 * HB_N) % (2 * HB_N), mb = ((ib % 2) + 2) % 2;
  const id = hash2(ma, mb, 7 + vert * 13), id2 = hash2(ma, mb, 29 + vert * 5);
  const L = along * HB_N, A = across;
  const warp = vnoise(L * 0.55 + id * 37, A * 1.1 + id2 * 41, 256, 3) * 2.6 + vnoise(L * 2.4 + id * 11, A * 3.5, 256, 5) * 0.5;
  const rings = 0.5 + 0.5 * Math.sin((A * 5.5 + warp + id * 6) * Math.PI);
  const streak = vnoise(L * 0.35 + id * 3, A * 38, 256, 9), pore = vnoise(L * 70 + id * 13, A * 22, 256, 15) > 0.84;
  const flake = id2 > 0.62 ? smooth(0.78, 0.95, vnoise(L * 1.6 + id * 7, A * 7, 256, 17)) * 0.25 : 0;   // raios medulares do carvalho
  const tone = 0.82 + 0.34 * id;
  const gr = (0.8 + 0.2 * rings - 0.08 * streak + flake) * (pore ? 0.84 : 1);
  let r = 0.4 * tone * gr, g = 0.27 * tone * gr, b = 0.155 * tone * gr;
  const e = Math.min(across, 1 - across) * HB_W, en = Math.min(along, 1 - along) * HB_N * HB_W, edge = Math.min(e, en);
  const seam = 1 - smooth(0.0007, 0.0032, edge), bevel = 1 - smooth(0.0, 0.006, edge);
  r *= 1 - 0.7 * seam; g *= 1 - 0.7 * seam; b *= 1 - 0.7 * seam;
  o[0] = r; o[1] = g; o[2] = b;
  o[3] = 0.55 + 0.03 * rings - 0.22 * bevel - (pore ? 0.03 : 0);
  o[4] = mix(0.32 + 0.1 * (1 - rings) + 0.06 * streak, 0.85, seam);
}
/** Parquet do piso (cores por vértice: a casca escurece os cantos). */
export const floorOak = (q: Quality) => surfMat(`galeria-parquet-${q}`, surf(`galeria-parquet-${q}`, qs(q, 1024), herringbone, 1.1), { vertex: true, env: 0.9 });

/* ---------- granito preto, gesso e tecido pintado ---------- */
function granite(u: number, v: number, o: Float32Array) {
  const n = fbm(u, v, 6, 501, 3), cells = vnoise(u * 160, v * 160, 160, 503), fine = vnoise(u * 480, v * 480, 480, 505), mica = vnoise(u * 640, v * 640, 640, 507) > 0.94;
  let b = 0.04 + 0.02 * n;
  if (cells > 0.66) b = 0.1 + 0.14 * (cells - 0.66) / 0.34;
  if (fine > 0.87) b = 0.26 + 0.1 * (fine - 0.87) / 0.13;
  o[0] = b * 0.94; o[1] = b; o[2] = b * 0.97; o[3] = 0.5 + 0.02 * cells; o[4] = mica ? 0.03 : 0.1 + 0.06 * n;
}
export const graniteSurf = (q: Quality) => surf(`galeria-granito-${q}`, qs(q, 512), granite, 0.4);
/** Granito polido (rodapé, faixa do piso, soleiras, plintos). `mirror`: reflexo planar no "high" (faixa do piso). */
export function graniteMat(q: Quality, mirror = false): THREE.MeshStandardMaterial {
  const m = surfMat(`galeria-granito-${q}-${mirror ? "m" : "s"}`, graniteSurf(q), { env: 1.1 });
  if (mirror && q === "high") m.userData.mirror = [0.9, 0.05];
  return m;
}
function plasterFn(u: number, v: number, o: Float32Array) {
  const n = fbm(u, v, 6, 521, 4), t = fbm(u, v, 18, 523, 2);
  const b = 0.72 + 0.05 * n + 0.02 * t; o[0] = b; o[1] = b * 0.955; o[2] = b * 0.87; o[3] = 0.5 + 0.08 * n; o[4] = 0.8 + 0.08 * t;
}
/** Gesso pintado (molduras, pilastras, vigas e caixotões do teto). */
export const plasterMat = (q: Quality, tint = "#ffffff") => surfMat(`galeria-gesso-${q}-${tint}`, surf(`galeria-gesso-${q}`, qs(q, 512), plasterFn, 0.5), { tint, env: 0.7 });
function cloth(u: number, v: number, o: Float32Array) {
  const wx = 0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 180), wy = 0.5 + 0.5 * Math.sin(v * 2 * Math.PI * 180);
  const weave = (Math.floor(u * 180) + Math.floor(v * 180)) % 2 ? wx : wy, n = fbm(u, v, 8, 531, 3), slub = vnoise(u * 12, v * 180, 12, 533);
  const b = 0.84 + 0.07 * weave + 0.05 * (n - 0.5) + 0.04 * (slub - 0.5);
  o[0] = b; o[1] = b; o[2] = b; o[3] = 0.45 + 0.2 * weave + 0.05 * slub; o[4] = 0.92;
}
/** Parede revestida de tecido pintado (a cor vem dos vértices: uma chamada de desenho para as três seções). */
export const clothWall = (q: Quality) => surfMat(`galeria-tecido-${q}`, surf(`galeria-tecido-${q}`, qs(q, 512), cloth, 0.8), { vertex: true, env: 0.35, normal: 0.7 });
/** Fundo da casca (o que aparece nas ombreiras e cantos): reboco grafite. */
export const wallBase = (q: Quality) => plasterMat(q, "#4a4744");

/** Cores das seções (paredes): III joias (ameixa), II aurora (azul-noite), I ateliê (verde-garrafa). */
export const SECTION = { joias: "#4f1a3f", aurora: "#1b2c52", atelie: "#174a38" } as const;

/* ---------- luz do nicho e do lanternim ---------- */
/** Fundo do nicho do Aurora: céu de amanhecer (laranja embaixo, rosa, violeta no alto) com o "sol" atrás do vestido. */
export function auroraTex(): THREE.Texture {
  return paint("galeria-aurora", 256, 512, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0);
    v.addColorStop(0, "#ff7a2a"); v.addColorStop(0.28, "#ff9a5c"); v.addColorStop(0.55, "#e86a8a"); v.addColorStop(0.8, "#8a4fb8"); v.addColorStop(1, "#3a2a6a");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w / 2, h * 0.92, 0, w / 2, h * 0.92, w * 0.9); sun.addColorStop(0, "rgba(255,240,200,0.9)"); sun.addColorStop(1, "rgba(255,200,150,0)");
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, "rgba(0,0,0,0.5)"); e.addColorStop(0.18, "rgba(0,0,0,0)"); e.addColorStop(0.82, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,0.5)");
    g.fillStyle = e; g.fillRect(0, 0, w, h);
  });
}
/** Vidro fosco do lanternim: painéis com leve variação de brilho (a grelha de bronze é geometria). */
export function laylightMat(): THREE.MeshBasicMaterial {
  return once("galeria-lanternim", () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffdcb4").multiplyScalar(0.2), map: paint("galeria-lanternimTex", 256, 256, (g, w, h) => {
    const R = rand(77); g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.fillStyle = `rgba(200,190,170,${0.05 + R() * 0.12})`; g.fillRect(i * w / 5 + 2, j * h / 5 + 2, w / 5 - 4, h / 5 - 4); }
    const v = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.75); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(120,110,95,0.45)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
  }) }));
}

/** Mancha de luz de um spot na parede (gradiente elíptico, aditivo) e o degradê da luz de sanca no teto. */
export function poolTex(): THREE.Texture {
  return paint("galeria-poca", 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.5, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.95)"); grd.addColorStop(0.45, "rgba(255,255,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false });
}
export function coveTex(): THREE.Texture {
  return paint("galeria-sanca", 16, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false });
}
