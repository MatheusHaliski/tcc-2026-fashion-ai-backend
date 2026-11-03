/*
 * MET Gala Heist v2 — beco (Z15): folhas desenhadas das janelas acesas (interiores) e das placas (totem da gala, saídas, garagem…).
 */
import { type Quality, rng } from "./exterior-alley-tex-noise";
import { atlas, type Atlas, CONDENSED, SANS } from "./exterior-alley-tex-atlas";

/* ---------- janelas acesas ---------- */
/** Interiores das janelas acesas (lógica 1024 × 384, quatro células): luz de teto, cortina, persiana, a luz azul de TV. */
export function windowInteriors(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const room = (seed: number, warm: [number, number, number], kind: "curtain" | "blinds" | "tv" | "bare") => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed);
    const grd = g.createRadialGradient(w * (0.3 + r() * 0.4), h * 0.15, 4, w / 2, h * 0.4, h * 0.9);
    grd.addColorStop(0, `rgb(${warm[0]},${warm[1]},${warm[2]})`); grd.addColorStop(1, `rgb(${warm[0] * 0.22},${warm[1] * 0.2},${warm[2] * 0.18})`);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // móvel escuro no fundo (estante, quadro) e a silhueta de uma luminária
    g.fillStyle = "rgba(20,14,10,0.55)"; g.fillRect(w * 0.1, h * 0.55, w * 0.35, h * 0.45); g.fillRect(w * 0.62, h * 0.3, w * 0.2, h * 0.16);
    if (kind === "tv") { g.fillStyle = "rgba(90,140,255,0.9)"; g.fillRect(w * 0.55, h * 0.58, w * 0.3, h * 0.18); }
    if (kind === "curtain") { for (const [x0, x1] of [[0, 0.28], [0.74, 1]]) { const cg = g.createLinearGradient(w * x0, 0, w * x1, 0); cg.addColorStop(0, "rgba(120,40,30,0.92)"); cg.addColorStop(0.5, "rgba(170,70,50,0.85)"); cg.addColorStop(1, "rgba(110,36,28,0.92)"); g.fillStyle = cg; g.fillRect(w * x0, 0, w * (x1 - x0), h); for (let k = 0; k < 6; k++) { g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(w * x0 + k * (w * (x1 - x0) / 6), 0, 3, h); } } }
    if (kind === "blinds") { const top = h * (0.25 + r() * 0.35); for (let y = 0; y < top; y += 10) { g.fillStyle = "rgba(220,215,200,0.92)"; g.fillRect(0, y, w, 7); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y + 7, w, 3); } }
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, h - 10, w, 10);
  };
  return atlas(`windows:${q}`, 1024, 384, s, [
    ["w0", 0, 0, 256, 384, room(101, [255, 206, 140], "curtain")], ["w1", 256, 0, 256, 384, room(102, [255, 226, 170], "blinds")],
    ["w2", 512, 0, 256, 384, room(103, [200, 210, 255], "tv")], ["w3", 768, 0, 256, 384, room(104, [255, 190, 120], "bare")],
  ]);
}

/* ---------- placas ---------- */
/** Placas do beco (lógica 1024 × 512): totem de embarque da gala (duas faces), saída de emergência do vizinho, garagem,
 * placa da cerca, placa do abrigo de gás, medidores, aviso de câmera. */
export function alleySigns(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const GOLD = "#d9b46a", SERIF = "'Didot', 'Bodoni 72', 'Playfair Display', Georgia, 'DejaVu Serif', serif";
  return atlas(`signs:${q}`, 1024, 512, s, [
    // totem: frente (para quem chega da avenida) e verso
    ["totemFront", 0, 0, 160, 512, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#14100c"); bg.addColorStop(1, "#060505"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = GOLD; g.textAlign = "center"; g.font = `400 13px ${SERIF}`; g.fillText("GALA", w / 2, 46); g.font = `400 24px ${SERIF}`; g.fillText("LUMIÈRE", w / 2, 74);
      g.fillRect(30, 90, w - 60, 1.5);
      g.font = `700 15px ${SANS}`; g.fillStyle = "#f3ead6"; g.fillText("EMBARQUE", w / 2, 132); g.fillText("MOTORISTAS", w / 2, 152);
      g.font = `500 10px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("CREDENCIADOS", w / 2, 170);
      // seta para dentro do beco
      g.fillStyle = GOLD; g.beginPath(); g.moveTo(w / 2, 196); g.lineTo(w / 2 + 26, 236); g.lineTo(w / 2 + 9, 236); g.lineTo(w / 2 + 9, 280); g.lineTo(w / 2 - 9, 280); g.lineTo(w / 2 - 9, 236); g.lineTo(w / 2 - 26, 236); g.closePath(); g.fill();
      g.font = `700 13px ${SANS}`; g.fillStyle = "#f3ead6"; g.fillText("SAÍDA DE", w / 2, 320); g.fillText("FUNCIONÁRIOS", w / 2, 338); g.font = `500 10px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("APÓS 01H00", w / 2, 356);
      g.strokeStyle = "rgba(217,180,106,0.6)"; g.lineWidth = 1; g.strokeRect(22, 384, w - 44, 70); g.font = `600 9px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("MUSEU VESPER", w / 2, 410); g.fillText("ENTRADA DE SERVIÇO", w / 2, 426); g.fillText("PELA DOCA · AV. VESPER", w / 2, 442);
      g.font = `400 9px ${SERIF}`; g.fillStyle = GOLD; g.fillText("04 · 12 · 2026", w / 2, h - 26);
    }],
    ["totemBack", 160, 0, 160, 512, (g, w, h) => {
      g.fillStyle = "#0b0908"; g.fillRect(0, 0, w, h); g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = GOLD; g.textAlign = "center"; g.font = `400 22px ${SERIF}`; g.fillText("✦", w / 2, 70); g.font = `400 13px ${SERIF}`; g.fillText("OBRIGADO", w / 2, 110); g.font = `600 10px ${SANS}`; g.fillStyle = "#bfae86";
      ["BOA NOITE", "E VOLTE COM CUIDADO", "", "TÁXI E APLICATIVO", "NA AV. VESPER"].forEach((t, k) => g.fillText(t, w / 2, 160 + k * 18));
      g.fillStyle = "rgba(217,180,106,0.25)"; g.fillRect(20, 300, w - 40, 150); g.fillStyle = GOLD; g.font = `400 26px ${SERIF}`; g.fillText("L", w / 2, 390);
    }],
    // saída de emergência (placa verde fotoluminescente) e "GARAGEM · NÃO ESTACIONE"
    ["exitGreen", 320, 0, 256, 96, (g, w, h) => { g.fillStyle = "#0b7a3b"; g.fillRect(0, 0, w, h); g.fillStyle = "#e9fff1"; g.font = `800 30px ${SANS}`; g.textAlign = "center"; g.fillText("SAÍDA", w * 0.42, h * 0.5 + 6); g.font = `600 13px ${SANS}`; g.fillText("DE EMERGÊNCIA", w * 0.42, h * 0.82); g.beginPath(); g.moveTo(w * 0.78, h * 0.3); g.lineTo(w * 0.92, h * 0.5); g.lineTo(w * 0.78, h * 0.7); g.closePath(); g.fill(); g.fillRect(w * 0.7, h * 0.44, w * 0.09, h * 0.12); }],
    ["garage", 576, 0, 448, 96, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b71c1c"; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = "#b71c1c"; g.font = `900 34px ${SANS}`; g.textAlign = "center"; g.fillText("GARAGEM", w / 2, 44); g.font = `800 18px ${SANS}`; g.fillText("NÃO ESTACIONE · 24 HORAS", w / 2, 76); }],
    // cerca do fundo e câmera (vizinho)
    ["fence", 320, 96, 320, 128, (g, w, h) => { g.fillStyle = "#e8e6df"; g.fillRect(0, 0, w, h); g.fillStyle = "#b71c1c"; g.fillRect(0, 0, w, 34); g.fillStyle = "#fff"; g.font = `900 24px ${SANS}`; g.textAlign = "center"; g.fillText("PROPRIEDADE", w / 2, 26); g.fillStyle = "#151515"; g.font = `800 22px ${SANS}`; g.fillText("PARTICULAR", w / 2, 66); g.font = `600 15px ${SANS}`; g.fillText("NÃO ENTRE · CÃES SOLTOS", w / 2, 98); }],
    ["camera", 640, 96, 192, 128, (g, w, h) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.fillRect(24, 40, 54, 34); g.beginPath(); g.moveTo(78, 46); g.lineTo(100, 36); g.lineTo(100, 78); g.lineTo(78, 68); g.fill(); g.font = `800 16px ${SANS}`; g.textAlign = "left"; g.fillText("SORRIA,", 108, 52); g.fillText("VOCÊ ESTÁ", 108, 72); g.fillText("SENDO", 108, 92); g.fillText("FILMADO", 108, 112); }],
    ["meter", 832, 96, 192, 128, (g, w, h) => { g.fillStyle = "#e9e6dc"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.fillRect(20, 16, w - 40, 36); g.fillStyle = "#9fe28e"; g.font = `600 22px monospace`; g.textAlign = "center"; g.fillText("0 4 7 1 9", w / 2, 42); g.fillStyle = "#333"; g.font = `700 12px ${SANS}`; g.fillText("kWh · 220 V", w / 2, 74); g.fillStyle = "#888"; g.fillRect(30, 90, w - 60, 4); g.fillRect(30, 102, w - 90, 4); }],
    // placas de gás (abrigo) e "PROIBIDO ESTACIONAR" do museu
    ["gasSign", 320, 224, 256, 128, (g, w, h) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.beginPath(); g.moveTo(40, 100); g.lineTo(70, 30); g.lineTo(100, 100); g.closePath(); g.lineWidth = 6; g.strokeStyle = "#151515"; g.stroke(); g.font = `900 40px ${SANS}`; g.textAlign = "center"; g.fillText("!", 70, 92); g.font = `900 26px ${SANS}`; g.fillText("GÁS", 175, 58); g.font = `700 14px ${SANS}`; g.fillText("INFLAMÁVEL", 175, 84); g.fillText("NÃO FUME", 175, 104); }],
    ["noPark", 576, 224, 448, 128, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b71c1c"; g.lineWidth = 7; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "#b71c1c"; g.font = `900 30px ${SANS}`; g.textAlign = "center"; g.fillText("BECO · ACESSO RESTRITO", w / 2, 54); g.font = `800 22px ${SANS}`; g.fillText("PROIBIDO ESTACIONAR", w / 2, 94); }],
    // etiqueta de caçamba (empresa fictícia de coleta) e estêncil "GLP" dos botijões
    ["dumpLabel", 0, 512 - 160, 320, 160, (g, w, h) => { g.fillStyle = "rgba(240,240,232,0.92)"; g.fillRect(0, 0, w, h); g.fillStyle = "#1f4a3a"; g.font = `900 30px ${SANS}`; g.textAlign = "center"; g.fillText("COLETA", w / 2, 42); g.fillText("SÃO BENTO", w / 2, 76); g.fillStyle = "#151515"; g.font = `700 13px ${SANS}`; g.fillText("PROIBIDO DEPOSITAR ENTULHO", w / 2, 108); g.fillText("CONTÊINER Nº 0417", w / 2, 132); }],
    ["glp", 320, 352, 128, 64, (g, w, h) => { g.fillStyle = "rgba(240,240,236,0.9)"; g.font = `900 34px ${CONDENSED}`; g.textAlign = "center"; g.fillText("GLP", w / 2, 44); g.fillRect(14, 52, w - 28, 3); }],
    ["kitchen", 448, 352, 320, 96, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d2a4a"; g.font = `800 22px ${SANS}`; g.textAlign = "center"; g.fillText("ENTRADA DE SERVIÇO", w / 2, 40); g.font = `600 14px ${SANS}`; g.fillText("COZINHA · TOQUE A CAMPAINHA", w / 2, 70); }],
    ["bins", 768, 352, 256, 96, (g, w, h) => { const cols = ["#1f5bb5", "#c62828", "#2e7d32", "#f2c230"], lab = ["PAPEL", "PLÁSTICO", "VIDRO", "METAL"]; cols.forEach((c, k) => { g.fillStyle = c; g.fillRect(k * (w / 4), 0, w / 4, h); g.fillStyle = k === 3 ? "#151515" : "#fff"; g.font = `800 ${k === 1 ? 13 : 16}px ${SANS}`; g.textAlign = "center"; g.fillText(lab[k], k * (w / 4) + w / 8, h / 2 + 6); }); }],
  ]);
}
