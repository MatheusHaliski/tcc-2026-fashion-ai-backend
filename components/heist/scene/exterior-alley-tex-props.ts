/*
 * MET Gala Heist v2 — beco (Z15): texturas pequenas dos objetos: grades (alfa recortado), bituca, mato, tampa de bueiro, madeira de
 * palete, papelão, tecido manchado e a mancha de luz das lâmpadas.
 */
import * as THREE from "three";
import { fieldOf, memo, rng, samp } from "./exterior-alley-tex-noise";
import { canvas, normalCanvas, texFrom } from "./exterior-alley-tex-canvas";
import { SANS } from "./exterior-alley-tex-atlas";

/* ---------- peças pequenas ---------- */
/** Grade (alfa recortado): tela de arame (losangos) ou chapa expandida, para a gaiola de gás, cercas e grelhas. */
export function meshAlpha(kind: "chain" | "weld" | "grate"): THREE.CanvasTexture {
  return memo(`mesh:${kind}`, () => {
    const S = 128, [c, g] = canvas(S, S); g.fillStyle = "#000"; g.fillRect(0, 0, S, S); g.strokeStyle = "#fff"; g.fillStyle = "#fff";
    if (kind === "chain") { g.lineWidth = 5; for (let k = -S; k < S * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); g.beginPath(); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); } }
    else if (kind === "weld") { for (let k = 0; k < S; k += 16) { g.fillRect(k, 0, 3, S); g.fillRect(0, k, S, 3); } }
    else { for (let k = 0; k < S; k += 21) g.fillRect(k, 0, 9, S); g.fillRect(0, 0, S, 6); g.fillRect(0, S / 2, S, 6); }
    return texFrom(c, false);
  });
}
/** Bituca: faixas ao longo do cilindro (filtro laranja pintado, papel branco sujo, ponta queimada). */
export function buttTex(): THREE.CanvasTexture {
  return memo("butt", () => {
    const [c, g] = canvas(8, 64);
    g.fillStyle = "#c98a45"; g.fillRect(0, 0, 8, 26); g.fillStyle = "rgba(90,50,20,0.5)"; for (let y = 2; y < 26; y += 5) g.fillRect(0, y, 8, 1);
    g.fillStyle = "#e4dfd2"; g.fillRect(0, 26, 8, 32); g.fillStyle = "rgba(120,110,90,0.35)"; g.fillRect(0, 40, 8, 6);
    g.fillStyle = "#2b2622"; g.fillRect(0, 58, 8, 6); g.fillStyle = "#6a625a"; g.fillRect(0, 57, 8, 2);
    return texFrom(c, true, undefined, true);
  });
}
/** Mato de fresta (cartões cruzados, alfa recortado): folhas finas de capim e uma folhinha larga. */
export function weedTex(): THREE.CanvasTexture {
  return memo("weed", () => {
    const S = 128, [c, g] = canvas(S, S), r = rng(91); g.clearRect(0, 0, S, S);
    for (let k = 0; k < 22; k++) { const x = S * (0.3 + r() * 0.4), lean = (r() - 0.5) * 50, hgt = S * (0.35 + r() * 0.55); g.strokeStyle = ["#3d5a22", "#56742c", "#2c4318", "#6b7f33"][k % 4]; g.lineWidth = 2 + r() * 2.5; g.beginPath(); g.moveTo(x, S); g.quadraticCurveTo(x + lean * 0.3, S - hgt * 0.6, x + lean, S - hgt); g.stroke(); }
    for (let k = 0; k < 5; k++) { const x = S * (0.3 + r() * 0.4), y = S * (0.6 + r() * 0.3); g.fillStyle = "#4a6a26"; g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 2); g.beginPath(); g.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    return texFrom(c, true, undefined, true);
  });
}
/** Tampa de bueiro de ferro fundido (vista de cima): anéis, losangos em relevo e a inscrição. Cor + altura. */
export function manholeTex(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  return memo("manhole", () => {
    const S = 256, [c, g] = canvas(S, S), hf = new Float32Array(S * S), r = rng(92);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5, v = (y + 0.5) / S - 0.5, d = Math.hypot(u, v) * 2;
      const ring = d > 0.86 && d < 0.94 ? 1 : 0, dia = (Math.abs(((u + v) * 14) % 1) < 0.18 || Math.abs(((u - v) * 14 + 100) % 1) < 0.18) && d < 0.8 ? 1 : 0;
      hf[y * S + x] = d > 1 ? 0 : 0.5 + 0.3 * ring + 0.2 * dia + 0.04 * r();
    }
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const h = hf[i], v = h > 0 ? 40 + h * 60 : 0; img.data[i * 4] = v * 1.05; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 0.92; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.fillStyle = "rgba(150,140,125,0.6)"; g.font = `800 18px ${SANS}`; g.textAlign = "center"; g.fillText("ÁGUAS PLUVIAIS", S / 2, S / 2 + 6);
    // ferrugem e lama nas bordas
    for (let k = 0; k < 60; k++) { const a = r() * Math.PI * 2, d = S * (0.36 + r() * 0.1); g.fillStyle = `rgba(110,60,25,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 3 + r() * 6, 0, Math.PI * 2); g.fill(); }
    return { map: texFrom(c, true, undefined, true), normalMap: texFrom(normalCanvas(hf, S, S, 6, false), false, undefined, true) };
  });
}


/* ---------- materiais de objetos (ladrilhos de 1 m, tingidos pela cor por vértice) ---------- */
/** Madeira de palete (pinus serrado): veios, nós e marcas de serra, clara (a cor por vértice escurece/esverdeia). */
export function woodTex(): THREE.CanvasTexture {
  return memo("wood", () => {
    const W = 512, H = 512, [c, g] = canvas(W, H), r = rng(111), f = fieldOf(256, 112, 4, 8);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = samp(f, 256, x * 0.5, y * 0.08), grain = 0.5 + 0.5 * Math.sin((y + n * 60) * 0.35), saw = 0.5 + 0.5 * Math.sin(x * 0.9 + y * 0.05);
      const v = 0.72 + 0.12 * grain + 0.04 * saw - 0.1 * n, i = (y * W + x) * 4;
      img.data[i] = 214 * v; img.data[i + 1] = 178 * v; img.data[i + 2] = 128 * v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 6; k++) { const x = r() * W, y = r() * H, rad = 6 + r() * 10; const grd = g.createRadialGradient(x, y, 0, x, y, rad * 2); grd.addColorStop(0, "rgba(70,40,15,0.85)"); grd.addColorStop(0.4, "rgba(110,70,30,0.5)"); grd.addColorStop(1, "rgba(110,70,30,0)"); g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rad * 2.2, rad, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(40,30,20,0.18)"; for (let k = 0; k < 40; k++) g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    return texFrom(c, true, 1);
  });
}
/** Papelão ondulado: kraft com ondas, fita adesiva, setas e "FRÁGIL" impressos, manchas de umidade. */
export function cardboardTex(): THREE.CanvasTexture {
  return memo("cardboard", () => {
    const S = 512, [c, g] = canvas(S, S), r = rng(113);
    g.fillStyle = "#b8925f"; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 4) { g.fillStyle = `rgba(90,60,30,${0.05 + 0.04 * Math.sin(x)})`; g.fillRect(x, 0, 2, S); }
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${r() > 0.5 ? "60,40,20" : "230,210,170"},${0.06 + r() * 0.08})`; g.fillRect(r() * S, r() * S, 2 + r() * 4, 1 + r() * 2); }
    g.fillStyle = "rgba(205,180,120,0.75)"; g.fillRect(0, S * 0.46, S, 46); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, S * 0.46 + 6, S, 6);
    g.fillStyle = "rgba(25,25,25,0.82)"; g.font = `900 46px ${SANS}`; g.fillText("FRÁGIL", 30, 120);
    g.save(); g.translate(400, 330); for (const dx of [0, 46]) { g.beginPath(); g.moveTo(dx, -40); g.lineTo(dx + 18, -10); g.lineTo(dx + 6, -10); g.lineTo(dx + 6, 30); g.lineTo(dx - 6, 30); g.lineTo(dx - 6, -10); g.lineTo(dx - 18, -10); g.closePath(); g.fill(); } g.restore();
    g.strokeStyle = "rgba(25,25,25,0.7)"; g.lineWidth = 3; g.strokeRect(30, 360, 200, 110); g.font = `700 18px ${SANS}`; g.fillText("PESO 18 kg", 46, 400); g.fillText("LOTE 0412", 46, 440);
    const wet = g.createRadialGradient(140, 470, 10, 140, 470, 160); wet.addColorStop(0, "rgba(60,40,20,0.35)"); wet.addColorStop(1, "rgba(60,40,20,0)"); g.fillStyle = wet; g.fillRect(0, 0, S, S);
    return texFrom(c, true, 1);
  });
}
/** Tecido manchado (colchão velho, estofado): matelassê em losangos, manchas de chuva e mofo. */
export function fabricTex(): THREE.CanvasTexture {
  return memo("fabric", () => {
    const S = 512, [c, g] = canvas(S, S), r = rng(114);
    g.fillStyle = "#e6dfcc"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(120,105,80,0.45)"; g.lineWidth = 2;
    for (let k = -S; k < S * 2; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); g.beginPath(); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); }
    for (let k = 0; k < 9; k++) { const x = r() * S, y = r() * S, rad = 30 + r() * 90; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, `rgba(${90 + r() * 40},${70 + r() * 30},${30 + r() * 20},0.45)`); grd.addColorStop(0.8, "rgba(110,90,50,0.25)"); grd.addColorStop(1, "rgba(110,90,50,0)"); g.fillStyle = grd; g.fillRect(0, 0, S, S); }
    for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(40,50,30,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(r() * S, S - r() * S * 0.3, 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
    return texFrom(c, true, 1);
  });
}
/** Mancha de luz radial (halo das lâmpadas e a poça de luz no chão), em escala de cinza. */
export function alleyGlow(): THREE.CanvasTexture {
  return memo("glow", () => {
    const S = 128, [c, g] = canvas(S, S), grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,0.55)"); grd.addColorStop(0.6, "rgba(255,255,255,0.14)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return texFrom(c, false, undefined, true);
  });
}
