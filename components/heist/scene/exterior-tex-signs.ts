/*
 * MET Gala Heist v2 — texturas com texto da fachada e da rua: banners da exposição (tecido com dobras e a silhueta do
 * vestido), placa de bronze, inscrição do friso, letreiros pequenos, a lateral do caminhão do bufê e os cartazes dos fãs.
 */
import * as THREE from "three";
import { canvas, fieldOf, memo, samp, texFrom, type Quality } from "./exterior-tex-core";
import { fitFont, SANS, SERIF, SIGNAGE, spaced } from "./exterior-tex-type";

/** Tecido do banner: trama fina e sombra das dobras (o banner pendurado ondula pouco). */
function fabric(g: CanvasRenderingContext2D, w: number, h: number) {
  const f = fieldOf(256, 91, 3, 8); const id = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fold = 0.93 + 0.07 * Math.sin((x / w) * Math.PI * 7 + samp(f, 256, x * 0.2, y * 0.05) * 2), weave = 0.97 + 0.03 * samp(f, 256, x * 2.5, y * 2.5);
    const o = (y * w + x) * 4; const k = fold * weave; id.data[o] *= k; id.data[o + 1] *= k; id.data[o + 2] *= k;
  }
  g.putImageData(id, 0, 0);
}
/** Silhueta estilizada de um vestido de gala (o Aurora) em dourado-marfim, para o banner da exposição. */
function gownArt(g: CanvasRenderingContext2D, cx: number, top: number, h: number) {
  const w = h * 0.62;
  const rays = g.createRadialGradient(cx, top + h * 0.35, 0, cx, top + h * 0.35, h * 0.8);
  rays.addColorStop(0, "rgba(255,226,170,0.38)"); rays.addColorStop(1, "rgba(255,226,170,0)");
  g.fillStyle = rays; g.fillRect(cx - h, top - h * 0.2, h * 2, h * 1.4);
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gr.addColorStop(0, "#9c7a3e"); gr.addColorStop(0.35, "#f4dfae"); gr.addColorStop(0.55, "#fff4d8"); gr.addColorStop(1, "#8a6a35");
  g.fillStyle = gr; g.beginPath();
  const waist = top + h * 0.3, neck = top + h * 0.04;
  g.moveTo(cx - w * 0.07, neck); g.quadraticCurveTo(cx - w * 0.16, top + h * 0.1, cx - w * 0.1, waist);   // corpete
  g.bezierCurveTo(cx - w * 0.22, top + h * 0.55, cx - w * 0.62, top + h * 0.85, cx - w * 0.5, top + h);  // saia rodada
  g.quadraticCurveTo(cx, top + h * 1.04, cx + w * 0.5, top + h);
  g.bezierCurveTo(cx + w * 0.62, top + h * 0.85, cx + w * 0.22, top + h * 0.55, cx + w * 0.1, waist);
  g.quadraticCurveTo(cx + w * 0.16, top + h * 0.1, cx + w * 0.07, neck); g.closePath(); g.fill();
  // pregas da saia
  g.strokeStyle = "rgba(120,90,40,0.5)"; g.lineWidth = Math.max(1, h / 300);
  for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(cx + k * w * 0.012, waist + h * 0.02); g.quadraticCurveTo(cx + k * w * 0.05, top + h * 0.7, cx + k * w * 0.1, top + h * 0.99); g.stroke(); }
  g.fillStyle = "rgba(255,250,235,0.9)"; g.fillRect(cx - w * 0.11, waist - h * 0.008, w * 0.22, h * 0.016);           // cinto
}
export type BannerKind = "aurora" | "lumiere" | "institute" | "marquee";
/** Banners da fachada. aurora/lumiere/institute: verticais (1:2); marquee: faixa horizontal sobre o arco central. */
export function bannerTex(q: Quality, kind: BannerKind): THREE.Texture {
  return memo(`banner:${q}:${kind}`, () => {
    const hi = q === "high"; const W = kind === "marquee" ? (hi ? 1536 : 768) : hi ? 768 : 384, H = kind === "marquee" ? (hi ? 384 : 192) : hi ? 1536 : 768;
    const [c, g] = canvas(W, H); g.textAlign = "center"; g.textBaseline = "alphabetic";
    if (kind === "aurora") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0f2c35"); bg.addColorStop(0.6, "#0a1c24"); bg.addColorStop(1, "#05100f"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      gownArt(g, W / 2, H * 0.2, H * 0.52);
      g.fillStyle = "#f3e2b8"; let s = fitFont(g, SIGNAGE.aurora, SERIF, "400", W * 0.24, W * 0.86, W * 0.03); spaced(g, SIGNAGE.aurora, W / 2, H * 0.84, W * 0.03);
      g.fillStyle = "#cdb98c"; s = fitFont(g, SIGNAGE.auroraHouse, SANS, "500", W * 0.055, W * 0.8, 4); spaced(g, SIGNAGE.auroraHouse, W / 2, H * 0.84 + s * 1.9, W * 0.012);
      g.fillStyle = "#e9dcc0"; fitFont(g, SIGNAGE.exhibit, SANS, "600", W * 0.05, W * 0.6); spaced(g, SIGNAGE.exhibit, W / 2, H * 0.12, W * 0.02);
      g.fillStyle = "#9fb0aa"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.965, W * 0.02);
    } else if (kind === "lumiere") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#5a0d1b"); bg.addColorStop(0.5, "#3c0711"); bg.addColorStop(1, "#1d0308"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H * 0.38); g.globalAlpha = 0.5;
      for (let k = 0; k < 48; k++) { g.rotate((Math.PI * 2) / 48); const lg = g.createLinearGradient(0, 0, 0, -H * 0.5); lg.addColorStop(0, "rgba(255,214,140,0.7)"); lg.addColorStop(1, "rgba(255,214,140,0)"); g.fillStyle = lg; g.fillRect(-W * 0.004, 0, W * 0.008, -H * (0.32 + 0.14 * (k % 3))); }
      g.restore(); g.globalAlpha = 1;
      g.fillStyle = "#f7e2b0"; g.beginPath(); g.arc(W / 2, H * 0.38, W * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f3dca6"; fitFont(g, SIGNAGE.gala.split(" ")[0], SANS, "600", W * 0.07, W * 0.6); spaced(g, SIGNAGE.gala.split(" ")[0], W / 2, H * 0.62, W * 0.04);
      fitFont(g, SIGNAGE.gala.split(" ")[1], SERIF, "400", W * 0.22, W * 0.9, W * 0.01); spaced(g, SIGNAGE.gala.split(" ")[1], W / 2, H * 0.74, W * 0.01);
      g.fillStyle = "#d9b779"; fitFont(g, SIGNAGE.date, SANS, "500", W * 0.06, W * 0.8); spaced(g, SIGNAGE.date, W / 2, H * 0.83, W * 0.015);
      g.fillStyle = "#b99b6b"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.965, W * 0.02);
    } else if (kind === "institute") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#efe7d6"); bg.addColorStop(1, "#d8cdb6"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#1b1b1b"; g.lineWidth = W * 0.006; g.strokeRect(W * 0.07, H * 0.04, W * 0.86, H * 0.92);
      // vestido em traço (croqui) e o nome da exposição
      g.save(); g.globalAlpha = 0.9; gownArt(g, W / 2, H * 0.2, H * 0.46); g.restore();
      g.fillStyle = "#151515"; fitFont(g, SIGNAGE.institute, SERIF, "400", W * 0.11, W * 0.8); spaced(g, SIGNAGE.institute, W / 2, H * 0.79, W * 0.005);
      g.fillStyle = "#6b5a3a"; fitFont(g, SIGNAGE.aurora, SANS, "600", W * 0.06, W * 0.6); spaced(g, SIGNAGE.aurora, W / 2, H * 0.86, W * 0.03);
      g.fillStyle = "#151515"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.93, W * 0.02);
    } else {
      const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, "#120a06"); bg.addColorStop(0.5, "#22140a"); bg.addColorStop(1, "#120a06"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#c9a24a"; g.lineWidth = H * 0.025; g.strokeRect(H * 0.08, H * 0.1, W - H * 0.16, H * 0.8);
      g.fillStyle = "#f2d38f"; fitFont(g, SIGNAGE.gala, SERIF, "400", H * 0.42, W * 0.7, H * 0.04); spaced(g, SIGNAGE.gala, W / 2, H * 0.58, H * 0.04);
      g.fillStyle = "#c9a24a"; fitFont(g, SIGNAGE.date, SANS, "600", H * 0.13, W * 0.4); spaced(g, SIGNAGE.date, W / 2, H * 0.8, H * 0.02);
    }
    fabric(g, W, H);
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Placa de bronze fundido: fundo escuro com pátina, borda em relevo, quatro rosetas e as letras romanas claras. */
export function plaqueTex(q: Quality, key: string, lines: readonly string[]): THREE.Texture {
  return memo(`plaque:${q}:${key}`, () => {
    const W = q === "high" ? 768 : 384, H = Math.round(W * 0.62), [c, g] = canvas(W, H);
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#3a2a18"); bg.addColorStop(0.5, "#5a4024"); bg.addColorStop(1, "#2e2214"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,110,90,${0.04 + Math.random() * 0.05})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 4 + Math.random() * 30, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#b38a4a"; g.lineWidth = H * 0.035; g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
    g.strokeStyle = "#1c140c"; g.lineWidth = H * 0.012; g.strokeRect(H * 0.09, H * 0.09, W - H * 0.18, H - H * 0.18);
    for (const [x, y] of [[H * 0.13, H * 0.13], [W - H * 0.13, H * 0.13], [H * 0.13, H - H * 0.13], [W - H * 0.13, H - H * 0.13]]) { const rg = g.createRadialGradient(x - 2, y - 2, 1, x, y, H * 0.035); rg.addColorStop(0, "#f0d39a"); rg.addColorStop(1, "#6a4a24"); g.fillStyle = rg; g.beginPath(); g.arc(x, y, H * 0.035, 0, Math.PI * 2); g.fill(); }
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, k) => {
      const big = k === 0, size = fitFont(g, l, "'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif", "600", big ? H * 0.2 : H * 0.085, W * 0.78, H * 0.02);
      const y = H * (lines.length === 1 ? 0.5 : big ? 0.38 : 0.58 + (k - 1) * 0.13);
      g.font = `600 ${size}px 'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif`;
      g.fillStyle = "#1a120a"; spaced(g, l, W / 2 + 2, y + 2, H * 0.02);
      g.fillStyle = "#e3c27f"; spaced(g, l, W / 2, y, H * 0.02);
    });
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Inscrição gravada no friso (letras romanas cavadas na pedra, iluminadas de baixo). */
export function inscriptionTex(q: Quality, text: string): THREE.Texture {
  return memo(`inscr:${q}:${text}`, () => {
    const W = q === "high" ? 2048 : 1024, H = W / 16, [c, g] = canvas(W, H);
    g.clearRect(0, 0, W, H); g.textAlign = "center"; g.textBaseline = "middle";
    const size = fitFont(g, text, "'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif", "500", H * 0.7, W * 0.9, H * 0.25);
    g.font = `500 ${size}px 'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif`;
    g.fillStyle = "rgba(40,30,20,0.85)"; spaced(g, text, W / 2, H * 0.52, H * 0.25);          // fundo da letra (sombra)
    g.fillStyle = "rgba(255,240,210,0.35)"; spaced(g, text, W / 2, H * 0.52 + size * 0.06, H * 0.25);   // borda de baixo pega a luz
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Placas e letreiros pequenos (texto centralizado em uma ou duas linhas, cores de fundo/tinta). */
export function signTex(key: string, lines: readonly string[], opt: { w: number; h: number; bg: string; ink: string; font?: "serif" | "sans" | "hand"; border?: string; glow?: boolean }): THREE.Texture {
  return memo(`sign:${key}`, () => {
    const [c, g] = canvas(opt.w, opt.h); g.fillStyle = opt.bg; g.fillRect(0, 0, opt.w, opt.h);
    if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = opt.h * 0.05; g.strokeRect(opt.h * 0.06, opt.h * 0.06, opt.w - opt.h * 0.12, opt.h - opt.h * 0.12); }
    const fam = opt.font === "serif" ? SERIF : opt.font === "hand" ? "'Marker Felt', 'Comic Sans MS', 'Chalkboard', 'DejaVu Sans', sans-serif" : SANS;
    g.fillStyle = opt.ink; g.textAlign = "center"; g.textBaseline = "middle";
    const n = lines.length;
    lines.forEach((line, k) => { const size = fitFont(g, line, fam, opt.font === "hand" ? "700" : "700", opt.h / (n + 0.6) * (k === 0 ? 1 : 0.72), opt.w * 0.88, opt.h * 0.02); g.font = `700 ${size}px ${fam}`; spaced(g, line, opt.w / 2, opt.h * ((k + 0.5) / n) + size * 0.33, opt.h * 0.02); });
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Lateral do caminhão do bufê: branco com o logotipo dourado e preto. */
export function cateringTex(q: Quality): THREE.Texture {
  return memo(`catering:${q}`, () => {
    const W = q === "high" ? 1024 : 512, H = W * 0.37, [c, g] = canvas(W, H);
    g.fillStyle = "#f1efe9"; g.fillRect(0, 0, W, H);
    const band = g.createLinearGradient(0, 0, W, 0); band.addColorStop(0, "#1a1a1a"); band.addColorStop(1, "#2a2420"); g.fillStyle = band; g.fillRect(0, H * 0.78, W, H * 0.22);
    g.fillStyle = "#b8913f"; g.fillRect(0, H * 0.76, W, H * 0.02);
    // cloche estilizada
    g.fillStyle = "#b8913f"; g.beginPath(); g.arc(W * 0.16, H * 0.5, H * 0.17, Math.PI, 0); g.fill(); g.fillRect(W * 0.16 - H * 0.21, H * 0.5, H * 0.42, H * 0.03); g.beginPath(); g.arc(W * 0.16, H * 0.31, H * 0.025, 0, Math.PI * 2); g.fill();
    g.textAlign = "center"; g.fillStyle = "#151515"; fitFont(g, SIGNAGE.caterer, SERIF, "400", H * 0.26, W * 0.55, H * 0.02); spaced(g, SIGNAGE.caterer, W * 0.58, H * 0.5, H * 0.02);
    g.fillStyle = "#8a6c2f"; fitFont(g, SIGNAGE.catererSub, SANS, "600", H * 0.07, W * 0.55); spaced(g, SIGNAGE.catererSub, W * 0.58, H * 0.64, H * 0.012);
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Cartazes feitos à mão dos fãs (papel-cartão, caneta grossa). */
export function fanSignTex(k: number): THREE.Texture {
  const text = SIGNAGE.fans[k % SIGNAGE.fans.length];
  const bgs = ["#f7f1e3", "#ffd6e7", "#fff3a8", "#d8f0ff", "#f7f1e3", "#e9ffd8"], inks = ["#c2185b", "#1a237e", "#111111", "#6a1b9a", "#b71c1c", "#0d47a1"];
  return signTex(`fan:${k}`, [text], { w: 256, h: 160, bg: bgs[k % bgs.length], ink: inks[k % inks.length], font: "hand" });
}
