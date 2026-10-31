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
import { HAND, SANS, SERIF, drawGown, rand, type Quality } from "../interior-tex";
import type { InteriorCopy } from "../interior-copy";
import { fbm, hash2, mix, once, paint, qs, smooth, surf, surfMat, vnoise, wrap, type Lang } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";

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

/* ---------- textos de parede ---------- */
const GOLD = "#e3c27e", CREAM = "#f1e7d2";
function textBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, title: string, body: string, kicker = "") {
  g.textAlign = "left"; g.textBaseline = "top";
  let yy = y;
  if (kicker) { g.fillStyle = GOLD; g.font = `500 ${Math.round(26 * s)}px ${SANS}`; g.fillText(kicker, x, yy); yy += 46 * s; }
  g.fillStyle = CREAM; g.font = `600 ${Math.round(58 * s)}px ${SERIF}`;
  for (const l of wrap(g, title, w)) { g.fillText(l, x, yy); yy += 70 * s; }
  g.fillStyle = GOLD; g.fillRect(x, yy + 8 * s, 120 * s, 4 * s); yy += 44 * s;
  g.fillStyle = CREAM; g.font = `400 ${Math.round(31 * s)}px ${SERIF}`;
  for (const l of wrap(g, body, w)) { g.fillText(l, x, yy); yy += 46 * s; }
}
/**
 * Atlas dos textos de parede (2 × 2 células quadradas): introdução, seções I, II e III. Letras creme e douradas em
 * fundo transparente (vinil recortado sobre o tecido da parede).
 */
export function wallTextAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-textos-${lang}-${q}`, qs(q, 2048), qs(q, 2048), (g, w) => {
    const c = w / 2, s = c / 1024;
    g.clearRect(0, 0, w, w);
    // introdução: chamada, AURORA grande, subtítulo e o parágrafo
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillStyle = GOLD; g.font = `500 ${Math.round(28 * s)}px ${SANS}`; g.fillText(T.intro.kicker, 70 * s, 70 * s);
    g.fillStyle = CREAM; g.font = `600 ${Math.round(150 * s)}px ${SERIF}`; g.fillText(T.intro.title, 62 * s, 120 * s);
    g.fillStyle = GOLD; g.font = `500 ${Math.round(40 * s)}px ${SERIF}`; g.fillText(T.intro.sub, 70 * s, 290 * s);
    g.fillRect(70 * s, 356 * s, 160 * s, 4 * s);
    g.fillStyle = CREAM; g.font = `400 ${Math.round(31 * s)}px ${SERIF}`;
    let y = 400 * s; for (const l of wrap(g, T.intro.body, 880 * s)) { g.fillText(l, 70 * s, y); y += 46 * s; }
    g.fillStyle = GOLD; g.font = `italic 400 ${Math.round(28 * s)}px ${SERIF}`; g.fillText(T.intro.foot, 70 * s, y + 30 * s);
    textBlock(g, c + 70 * s, 90 * s, 880 * s, s, T.s1.title, T.s1.body);
    textBlock(g, 70 * s, c + 90 * s, 880 * s, s, T.s2.title, T.s2.body);
    textBlock(g, c + 70 * s, c + 90 * s, 880 * s, s, T.s3.title, T.s3.body);
  });
}
/** Créditos (metade esquerda) e as quatro legendas dos arcos (metade direita, uma por faixa). */
export function creditsAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-creditos-${lang}-${q}`, qs(q, 2048), qs(q, 1024), (g, w, h) => {
    const s = h / 1024; g.clearRect(0, 0, w, h);
    g.textAlign = "left"; g.textBaseline = "top";
    let y = 80 * s;
    T.credits.forEach((l, i) => {
      if (i % 2 === 0) { g.fillStyle = GOLD; g.font = `500 ${Math.round(28 * s)}px ${SANS}`; g.fillText(l, 70 * s, y); y += 44 * s; }
      else { g.fillStyle = CREAM; g.font = `400 ${Math.round(40 * s)}px ${SERIF}`; for (const ln of wrap(g, l, 880 * s)) { g.fillText(ln, 70 * s, y); y += 52 * s; } y += 46 * s; }
    });
    T.arches.forEach((t, i) => {
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = CREAM; g.font = `500 ${Math.round(54 * s)}px ${SERIF}`;
      g.fillText(t, w * 0.75, (i + 0.5) * (h / 4));
    });
  });
}
/** Inscrição do friso (letras douradas em caixa alta, espaçadas) — título da exposição sobre o nicho. */
export function friezeText(q: Quality, copy: InteriorCopy): THREE.Texture {
  const text = `${copy.exhibitTitle}  ·  ${copy.exhibitSub}`;
  return paint(`galeria-friso-${text}-${q}`, qs(q, 4096), qs(q, 256), (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, h * 0.2, 0, h * 0.8); grd.addColorStop(0, "#fff0c4"); grd.addColorStop(0.45, "#d9ae5c"); grd.addColorStop(0.55, "#a87b34"); grd.addColorStop(1, "#e8c77f");
    g.fillStyle = grd; g.textAlign = "center"; g.textBaseline = "middle";
    let px = Math.round(h * 0.62); g.font = `600 ${px}px ${SERIF}`;
    const sp = (t: string) => [...t].join(" ");
    while (g.measureText(sp(text)).width > w * 0.94 && px > 10) { px -= 2; g.font = `600 ${px}px ${SERIF}`; }
    g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = h * 0.04; g.shadowOffsetY = h * 0.02;
    g.fillText(sp(text), w / 2, h * 0.53);
  });
}

/* ---------- etiquetas de museu ---------- */
export const LABEL_COLS = 4, LABEL_ROWS = 4;
/** Atlas das etiquetas (cartão creme, número, título, autoria, materiais e crédito). */
export function labelAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-etiquetas-${lang}-${q}`, qs(q, 2048), qs(q, 1024), (g, w, h) => {
    const cw = w / LABEL_COLS, ch = h / LABEL_ROWS, s = cw / 512;
    T.labels.forEach((L, i) => {
      const x = (i % LABEL_COLS) * cw, y = Math.floor(i / LABEL_COLS) * ch;
      g.fillStyle = "#efe8d8"; g.fillRect(x, y, cw, ch);
      g.strokeStyle = "rgba(60,45,25,0.25)"; g.lineWidth = 2 * s; g.strokeRect(x + 6 * s, y + 6 * s, cw - 12 * s, ch - 12 * s);
      g.textAlign = "left"; g.textBaseline = "top";
      let tx = x + 26 * s;
      if (L.n) { g.fillStyle = "#1d1a16"; g.beginPath(); g.arc(x + 46 * s, y + 50 * s, 22 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#efe8d8"; g.font = `600 ${Math.round(20 * s)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L.n, x + 46 * s, y + 51 * s); g.textAlign = "left"; g.textBaseline = "top"; tx = x + 82 * s; }
      g.fillStyle = "#1d1a16"; g.font = `700 ${Math.round(30 * s)}px ${SERIF}`;
      const tl = wrap(g, L.title, cw - (tx - x) - 20 * s); g.fillText(tl[0] ?? "", tx, y + 32 * s);
      g.font = `400 ${Math.round(20 * s)}px ${SANS}`; g.fillStyle = "#3b352c";
      let yy = y + 92 * s; for (const l of wrap(g, L.by, cw - 52 * s)) { g.fillText(l, x + 26 * s, yy); yy += 26 * s; }
      g.font = `italic 400 ${Math.round(19 * s)}px ${SERIF}`; g.fillStyle = "#4a4237";
      for (const l of wrap(g, L.mat, cw - 52 * s).slice(0, 3)) { g.fillText(l, x + 26 * s, yy); yy += 24 * s; }
      g.font = `400 ${Math.round(15 * s)}px ${SANS}`; g.fillStyle = "#6d6455"; g.fillText(L.credit, x + 26 * s, y + ch - 34 * s);
    });
    // célula 15: capa do catálogo (fundo escuro, AURORA dourado e a silhueta do vestido)
    const x = 3 * cw, y = 3 * ch, grd = g.createLinearGradient(x, y, x, y + ch); grd.addColorStop(0, "#1b1424"); grd.addColorStop(1, "#3a1d33");
    g.fillStyle = grd; g.fillRect(x, y, cw, ch);
    const au = g.createLinearGradient(0, y + ch * 0.2, 0, y + ch); au.addColorStop(0, "#fde7b8"); au.addColorStop(1, "#a88bff");
    drawGown(g, x + cw * 0.78, y + ch * 0.12, ch * 0.8, au);
    g.fillStyle = GOLD; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `600 ${Math.round(64 * s)}px ${SERIF}`; g.fillText("AURORA", x + 26 * s, y + ch * 0.42);
    g.font = `400 ${Math.round(18 * s)}px ${SANS}`; g.fillStyle = CREAM; g.fillText(T.intro.sub, x + 30 * s, y + ch * 0.66);
  });
}
/** Índice da capa do catálogo no atlas das etiquetas. */
export const CATALOG_COVER = 15;

/* ---------- croquis e guaches ---------- */
export const ART_COLS = 4, ART_ROWS = 2;
function croquis(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) {
  const R = rand(900 + k * 17);
  // papel creme com fibras e manchas de tempo
  g.fillStyle = "#efe6d1"; g.fillRect(x, y, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,95,60,${0.02 + R() * 0.04})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 3, 1 + R() * 3); }
  const cx = x + w * (0.42 + R() * 0.12), top = y + h * 0.1, H = h * 0.78, wash = ["rgba(168,139,255,0.45)", "rgba(16,24,48,0.5)", "rgba(160,20,40,0.45)", "rgba(220,190,120,0.45)"][k % 4];
  // aguada de aquarela (borda irregular) e a silhueta do vestido a grafite, com traços repetidos
  g.save(); g.globalCompositeOperation = "multiply";
  const fill = g.createLinearGradient(0, top + H * 0.25, 0, top + H); fill.addColorStop(0, wash); fill.addColorStop(1, wash.replace(/[\d.]+\)$/, "0.2)"));
  drawGown(g, cx, top + H * 0.18, H * 0.8, fill); g.restore();
  g.strokeStyle = "rgba(40,36,32,0.75)"; g.lineWidth = Math.max(1, w * 0.004);
  for (let p = 0; p < 3; p++) {
    const j = (R() - 0.5) * w * 0.01;
    g.beginPath(); g.ellipse(cx + j, top + H * 0.07, w * 0.035, H * 0.045, 0.1, 0, Math.PI * 2); g.stroke();                       // cabeça
    g.beginPath(); g.moveTo(cx - w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx + j, top + H * 0.15, cx + w * 0.07 + j, top + H * 0.17);   // ombros
    g.moveTo(cx - w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx - w * 0.12, top + H * 0.3, cx - w * 0.09 + j, top + H * 0.42);           // braço
    g.moveTo(cx + w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx + w * 0.15, top + H * 0.25, cx + w * 0.2 + j, top + H * 0.2);            // braço erguido
    g.stroke();
    // saia: duas curvas e pregas
    g.beginPath(); g.moveTo(cx - w * 0.03, top + H * 0.36); g.bezierCurveTo(cx - w * 0.2, top + H * 0.6, cx - w * 0.3, top + H * 0.85, cx - w * 0.34 + j, top + H * 0.98);
    g.moveTo(cx + w * 0.03, top + H * 0.36); g.bezierCurveTo(cx + w * 0.2, top + H * 0.6, cx + w * 0.34, top + H * 0.85, cx + w * 0.4 + j, top + H * 0.98); g.stroke();
  }
  g.lineWidth = Math.max(1, w * 0.002); g.strokeStyle = "rgba(40,36,32,0.45)";
  for (let i = 0; i < 9; i++) { const t = i / 8; g.beginPath(); g.moveTo(cx - w * 0.02 + t * w * 0.04, top + H * 0.4); g.quadraticCurveTo(cx - w * 0.2 + t * w * 0.4, top + H * 0.7, cx - w * 0.33 + t * w * 0.72, top + H * 0.97); g.stroke(); }
  // anotações à mão e a amostra presa com alfinete
  g.fillStyle = "rgba(50,40,30,0.85)"; g.font = `400 ${Math.round(w * 0.05)}px ${HAND}`; g.textAlign = "left"; g.textBaseline = "top";
  const notes = [["tule lilás → ouro", "11 camadas", "prova 3"], ["veludo de seda", "luva até o cotovelo", "costas nuas"], ["babados em 5 níveis", "tule carmim", "cauda curta"], ["cetim duquesa", "cinto bordado", "corrigir decote"]][k % 4];
  notes.forEach((n, i) => g.fillText(n, x + w * 0.58, y + h * (0.12 + i * 0.07)));
  g.save(); g.translate(x + w * 0.7, y + h * 0.62); g.rotate(-0.12 + R() * 0.2);
  g.fillStyle = ["#b9a4f0", "#1b2a52", "#a8162e", "#e2cf9b"][k % 4]; g.fillRect(0, 0, w * 0.18, h * 0.11);
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * w * 0.015, 0); g.lineTo(i * w * 0.015 + 3, -3); g.stroke(); }
  g.fillStyle = "#c9cdd2"; g.fillRect(w * 0.02, h * 0.02, w * 0.14, 2); g.fillStyle = "#b3121e"; g.beginPath(); g.arc(w * 0.02, h * 0.02 + 1, 4, 0, Math.PI * 2); g.fill();
  g.restore();
  g.font = `400 ${Math.round(w * 0.04)}px ${HAND}`; g.fillStyle = "rgba(50,40,30,0.7)"; g.fillText(`Orvalho · ${1955 + (k % 3)}`, x + w * 0.08, y + h * 0.92);
}
function gouache(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) {
  const R = rand(1300 + k * 23);
  g.fillStyle = "#55575c"; g.fillRect(x, y, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${0.01 + R() * 0.03})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 2, 1 + R() * 2); }
  const cx = x + w / 2, cy = y + h * 0.42, stone = (sx: number, sy: number, r: number, col: string) => {
    const grd = g.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.35, col); grd.addColorStop(1, "#202226");
    g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#d9b866"; g.lineWidth = Math.max(1, r * 0.18); g.stroke();
  };
  if (k % 4 === 0) {            // colar em cascata
    for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.12 + 0.76 * i / 18), sx = cx + Math.cos(a) * w * 0.34, sy = cy - h * 0.12 + Math.sin(a) * h * 0.26; stone(sx, sy, w * 0.022, "#e9eef5"); if (i % 3 === 0) stone(sx, sy + w * 0.06, w * 0.016, "#f0a8c0"); }
    stone(cx, cy + h * 0.2, w * 0.05, "#f3a3b8");
  } else if (k % 4 === 1) {     // tiara
    g.strokeStyle = "#d9b866"; g.lineWidth = w * 0.01; g.beginPath(); g.ellipse(cx, cy + h * 0.1, w * 0.36, h * 0.14, 0, Math.PI, 0); g.stroke();
    for (let i = 0; i < 9; i++) { const t = i / 8, a = Math.PI + t * Math.PI, sx = cx + Math.cos(a) * w * 0.36, sy = cy + h * 0.1 + Math.sin(a) * h * 0.14, tall = 1 - Math.abs(t - 0.5) * 1.4; stone(sx, sy - h * 0.12 * tall, w * (0.018 + 0.02 * tall), "#eef3ff"); }
  } else if (k % 4 === 2) {     // brincos em gota
    for (const s of [-1, 1]) { stone(cx + s * w * 0.18, cy - h * 0.1, w * 0.03, "#eef3ff"); stone(cx + s * w * 0.18, cy + h * 0.02, w * 0.05, "#9fb8ff"); stone(cx + s * w * 0.18, cy + h * 0.15, w * 0.035, "#eef3ff"); }
  } else {                      // broche em flor
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; stone(cx + Math.cos(a) * w * 0.12, cy + Math.sin(a) * w * 0.12, w * 0.05, "#f3d0dc"); }
    stone(cx, cy, w * 0.06, "#ffd27a");
  }
  g.fillStyle = "rgba(235,235,235,0.85)"; g.font = `400 ${Math.round(w * 0.045)}px ${HAND}`; g.textAlign = "left"; g.textBaseline = "top";
  g.fillText(["Alvorada — colar", "Tiara Orvalho", "Gotas de orvalho", "Broche Aurora"][k % 4], x + w * 0.08, y + h * 0.84);
  g.fillText("guache · 1957", x + w * 0.08, y + h * 0.9);
}
/** Atlas da arte emoldurada: quatro croquis (papel creme) e quatro desenhos de joia a guache (papel cinza). */
export function artAtlas(q: Quality): THREE.Texture {
  return paint(`galeria-arte-${q}`, qs(q, 2048), qs(q, 1536), (g, w, h) => {
    const cw = w / ART_COLS, ch = h / ART_ROWS;
    for (let k = 0; k < 4; k++) croquis(g, k * cw, 0, cw, ch, k);
    for (let k = 0; k < 4; k++) gouache(g, k * cw, ch, cw, ch, k);
  });
}

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
  return once("galeria-lanternim", () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe6c4").multiplyScalar(0.34), map: paint("galeria-lanternimTex", 256, 256, (g, w, h) => {
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
