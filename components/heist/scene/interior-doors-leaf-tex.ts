/*
 * MET Gala Heist v2 — texturas desenhadas das folhas de porta (interior-doors-leaf.ts): o preto de palco com estêncil,
 * o aço guilhochê da porta blindada e o vidro aramado.
 */
import * as THREE from "three";
import { drawnTexture } from "./interior-tex";

/** Preto do palco: tinta fosca com marcas de uso, fita crepe e o nome em estêncil (spray branco falhado). */
export function stageTexture(text: string): THREE.Texture {
  return drawnTexture(`vestibulo-door-stage-${text}`, 512, 1280, (g, w, h) => {
    g.fillStyle = "#16161a"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) { const x = (k * 151) % w, y = (k * 97) % h, l = 10 + (k % 23) * 3; g.strokeStyle = `rgba(${90 + (k % 40)},${90 + (k % 40)},${95 + (k % 40)},${0.05 + (k % 7) * 0.012})`; g.lineWidth = 1 + (k % 3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(k), y + l * Math.sin(k) * 0.3); g.stroke(); }
    const scuff = g.createLinearGradient(0, h, 0, h * 0.82); scuff.addColorStop(0, "rgba(120,110,100,0.25)"); scuff.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = scuff; g.fillRect(0, h * 0.82, w, h * 0.18);
    // estêncil na vertical, lido de baixo para cima, entre a chapa de chute e o visor (0,3–1,4 m da folha de 2,6 m): letras
    // com as pontes do molde no meio de cada uma e os borrifos do spray em volta
    const FAM = "'DejaVu Sans', Arial, sans-serif", len = h * 0.42;
    g.font = `700 100px ${FAM}`;
    const F = Math.min(w * 0.3, (100 * len) / Math.max(1, g.measureText(text).width));
    g.save(); g.translate(w / 2, h * 0.67); g.rotate(-Math.PI / 2);
    g.font = `700 ${Math.round(F)}px ${FAM}`; g.textAlign = "center"; g.textBaseline = "middle";
    const tw = g.measureText(text).width;
    g.fillStyle = "rgba(236,230,214,0.85)"; g.fillText(text, 0, 0);
    g.fillStyle = "#16161a"; for (let k = 0; k < text.length; k++) g.fillRect(-tw / 2 + ((k + 0.5) * tw) / text.length - 2, -F * 0.09, 4, F * 0.18);
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(236,230,214,${0.15 + (k % 5) * 0.08})`; g.fillRect((((k * 53) % 1000) / 1000 - 0.5) * tw * 1.12, (((k * 31) % 100) / 100 - 0.5) * F * 1.3, 2, 2); }
    g.restore();
    // fita crepe com a marca do ensaio, acima do visor
    g.fillStyle = "rgba(214,196,150,0.85)"; g.fillRect(w * 0.18, h * 0.19, w * 0.5, 26); g.fillStyle = "#3a3020"; g.font = `600 18px ${FAM}`; g.textAlign = "left"; g.fillText("CENA 4 · ENTRADA L", w * 0.2, h * 0.19 + 19);
  });
}
/** Aço "guilhochê" do painel do cofre: círculos sobrepostos em grade, como o acabamento de portas-fortes antigas. */
export function jeweledTexture(): THREE.Texture {
  return drawnTexture("vestibulo-door-jeweled", 512, 512, (g, w, h) => {
    g.fillStyle = "#8c9197"; g.fillRect(0, 0, w, h);
    const r = 26;
    for (let y = -r; y < h + r; y += r) for (let x = -r; x < w + r; x += r) {
      const grd = g.createRadialGradient(x - 8, y - 8, 2, x, y, r * 1.2); grd.addColorStop(0, "#d5d9de"); grd.addColorStop(0.55, "#9aa0a6"); grd.addColorStop(1, "#6d7278");
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * 1.15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; for (let k = 3; k < r; k += 4) { g.beginPath(); g.arc(x, y, k, 0, Math.PI * 2); g.stroke(); }
    }
  });
}
/** Vidro aramado (malha quadrada de 2,5 cm). */
function wireTexture(): THREE.Texture {
  const t = drawnTexture("vestibulo-door-wireTex", 128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = "rgba(60,60,60,0.9)"; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 6); return t;
}
