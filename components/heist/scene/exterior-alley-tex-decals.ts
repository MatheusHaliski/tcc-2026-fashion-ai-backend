/*
 * MET Gala Heist v2 — beco (Z15): folhas de decalques das paredes (pichações, reboco, lambe-lambes, escorridos) e do chão (panfletos,
 * folhas, manchas, sujeira do pé da parede), e as poças com película de óleo.
 */
import { type Quality, rng } from "./exterior-alley-tex-noise";
import { atlas, type Atlas, CONDENSED, HANDS, IMPACT, overspray, paperFill, raggedBlob, SANS, sprayText } from "./exterior-alley-tex-atlas";

/** Folha de decalques das paredes do beco (lógica 2048 × 1024). Nomes inventados; nenhuma marca real. */
export function wallDecals(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  return atlas(`walldecals:${q}`, 2048, 1024, s, [
    // pichação de assinatura (traço fino, preto com contorno prata)
    ["tagNox", 0, 0, 512, 256, (g, w, h) => { overspray(g, w / 2, h / 2, 150, "#111", 3, 120); sprayText(g, "NOX", w / 2, h * 0.48, 150, "#141414", "#b9bcc2", { seed: 4, drips: 7 }); }],
    // grafite de letras gordas (bomb) em dois tons
    ["throwVulto", 512, 0, 512, 256, (g, w, h) => { sprayText(g, "VULTO", w / 2, h * 0.5, 120, "#e8d34a", "#1b1b1b", { seed: 5, drips: 6, skew: -0.1, font: IMPACT }); sprayText(g, "VULTO", w / 2 + 2, h * 0.5 - 3, 120, "rgba(255,255,255,0)", "rgba(255,255,255,0.35)", { seed: 6, drips: 0, skew: -0.1 }); }],
    ["tagTrama", 1024, 0, 512, 256, (g, w, h) => { overspray(g, w * 0.5, h * 0.5, 170, "#3a6fd8", 7, 220); sprayText(g, "TRAMA·26", w / 2, h * 0.5, 96, "#3f78e0", "#f2f2f2", { seed: 8, drips: 8, skew: -0.25 }); }],
    // estêncil: corvo com a frase
    ["stencilCorvo", 1536, 0, 256, 256, (g, w, h) => {
      g.fillStyle = "rgba(20,20,22,0.92)"; g.save(); g.translate(w / 2, h * 0.44); g.beginPath();
      g.moveTo(-70, 20); g.quadraticCurveTo(-20, -40, 40, -30); g.lineTo(70, -46); g.lineTo(52, -22); g.quadraticCurveTo(60, 10, 20, 30); g.lineTo(30, 62); g.lineTo(14, 62); g.lineTo(6, 34); g.lineTo(-10, 36); g.lineTo(-4, 62); g.lineTo(-20, 62); g.lineTo(-22, 34); g.quadraticCurveTo(-60, 40, -70, 20); g.fill();
      g.fillStyle = "#e8e2d4"; g.beginPath(); g.arc(46, -30, 4, 0, Math.PI * 2); g.fill(); g.restore();
      g.fillStyle = "rgba(20,20,22,0.9)"; g.font = `700 26px ${CONDENSED}`; g.textAlign = "center"; g.fillText("OLHO VIVO", w / 2, h * 0.9);
    }],
    ["tagsSmall", 1792, 0, 256, 256, (g, w, h) => {
      sprayText(g, "LUME", w * 0.45, h * 0.28, 64, "#c23a2b", "rgba(0,0,0,0)", { seed: 9, drips: 3, font: HANDS });
      sprayText(g, "K.O.", w * 0.6, h * 0.62, 56, "#151515", "rgba(0,0,0,0)", { seed: 10, drips: 2, font: HANDS });
      g.strokeStyle = "#151515"; g.lineWidth = 3; g.beginPath(); g.arc(w * 0.25, h * 0.8, 20, 0, Math.PI * 2); g.moveTo(w * 0.25 - 14, h * 0.8 - 14); g.lineTo(w * 0.25 + 14, h * 0.8 + 14); g.stroke();
    }],
    // lambe-lambes (cartazes colados, alguns rasgados): eventos e serviços fictícios
    ["posters", 0, 256, 512, 256, (g, w, h) => {
      const items: [string, string, string, string][] = [["SAMBA NO BECO", "SEXTA · 23H", "#f2c230", "#1a1a1a"], ["BAILE ORVALHO", "SÁBADO · ENTRADA FRANCA", "#d6322b", "#fff3e0"], ["FEIRA DE VINIL", "DOMINGO · PRAÇA 7", "#1f4f8a", "#f6f1e6"]];
      items.forEach(([t1, t2, bg, ink], k) => {
        const x = 8 + k * 168, y = 10 + (k % 2) * 8, pw = 158, ph = 230;
        g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate((k - 1) * 0.03); g.translate(-pw / 2, -ph / 2);
        paperFill(g, pw, ph, bg, 20 + k);
        g.fillStyle = ink; g.textAlign = "center"; g.font = `900 30px ${IMPACT}`; g.fillText(t1.split(" ")[0], pw / 2, 60); g.font = `900 26px ${IMPACT}`; g.fillText(t1.split(" ").slice(1).join(" "), pw / 2, 94);
        g.font = `700 13px ${SANS}`; g.fillText(t2, pw / 2, 140);
        g.fillRect(20, 160, pw - 40, 3); g.font = `600 11px ${SANS}`; g.fillText("CARTAZ · NÃO RETIRAR", pw / 2, 196);
        // rasgo: um pedaço arrancado mostrando o cartaz de baixo (branco sujo)
        if (k === 1) { g.globalCompositeOperation = "destination-out"; raggedBlob(g, pw * 0.8, ph * 0.85, 40, 30, 30 + k, 0.5); g.fill(); g.globalCompositeOperation = "source-over"; }
        g.restore();
      });
    }],
    // reboco descascado (manchas de reboco velho sobre o tijolo: borda irregular, rachado, sujo)
    ["plasterA", 512, 256, 384, 256, (g, w, h) => {
      raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.42, 41, 0.35, 90); g.save(); g.clip();
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#bdb6a6"); grd.addColorStop(1, "#9c9483"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
      const r = rng(42); for (let k = 0; k < 900; k++) { g.globalAlpha = 0.1 + r() * 0.15; g.fillStyle = r() > 0.6 ? "#5d564b" : "#d8d2c3"; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      g.globalAlpha = 0.7; g.strokeStyle = "#4a443a"; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
      g.restore(); g.globalAlpha = 0.6; g.strokeStyle = "#3a352d"; g.lineWidth = 2.5; raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.42, 41, 0.35, 90); g.stroke(); g.globalAlpha = 1;
    }],
    ["plasterB", 896, 256, 256, 256, (g, w, h) => {
      raggedBlob(g, w * 0.5, h * 0.55, w * 0.45, h * 0.4, 43, 0.45, 70); g.save(); g.clip();
      g.fillStyle = "#c9c1ad"; g.fillRect(0, 0, w, h); const r = rng(44);
      for (let k = 0; k < 500; k++) { g.globalAlpha = 0.12 + r() * 0.12; g.fillStyle = r() > 0.5 ? "#6d6455" : "#e6dfcf"; g.fillRect(r() * w, r() * h, 2, 2); }
      // pintura velha por cima do reboco (verde-água desbotado)
      g.globalAlpha = 0.55; raggedBlob(g, w * 0.45, h * 0.5, w * 0.3, h * 0.28, 45, 0.5, 60); g.fillStyle = "#7fa59a"; g.fill(); g.restore(); g.globalAlpha = 1;
    }],
    // escorridos: ferrugem sob suportes e água/sujeira sob peitoris e aparelhos de ar
    ["rustStreak", 1152, 256, 128, 384, (g, w, h) => {
      const r = rng(46); for (let k = 0; k < 14; k++) { const x = w * 0.3 + r() * w * 0.4, len = h * (0.4 + r() * 0.6); const grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, "rgba(110,52,20,0.75)"); grd.addColorStop(1, "rgba(110,52,20,0)"); g.strokeStyle = grd; g.lineWidth = 2 + r() * 7; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, len); g.stroke(); }
    }],
    ["waterStreak", 1280, 256, 256, 384, (g, w, h) => {
      const r = rng(47); for (let k = 0; k < 30; k++) { const x = r() * w, len = h * (0.3 + r() * 0.7); const grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, "rgba(20,22,18,0.55)"); grd.addColorStop(1, "rgba(20,22,18,0)"); g.strokeStyle = grd; g.lineWidth = 3 + r() * 12; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 8, len); g.stroke(); }
      const top = g.createLinearGradient(0, 0, 0, 40); top.addColorStop(0, "rgba(15,15,12,0.6)"); top.addColorStop(1, "rgba(15,15,12,0)"); g.fillStyle = top; g.fillRect(0, 0, w, 40);
    }],
    // fuligem do exaustor da cozinha (nuvem escura subindo)
    ["soot", 1536, 256, 256, 384, (g, w, h) => {
      const r = rng(48); for (let k = 0; k < 40; k++) { const y = h - r() * h, spread = (1 - y / h) * w * 0.4 + 20, x = w / 2 + (r() - 0.5) * spread; const grd = g.createRadialGradient(x, y, 0, x, y, 30 + r() * 50); grd.addColorStop(0, `rgba(12,10,8,${0.22 + 0.25 * (y / h)})`); grd.addColorStop(1, "rgba(12,10,8,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
    }],
    // pintura de aviso direto no tijolo e o número da casa
    ["noTrash", 1792, 256, 256, 128, (g, w, h) => { g.fillStyle = "rgba(240,236,224,0.85)"; g.font = `900 34px ${CONDENSED}`; g.textAlign = "center"; g.fillText("PROIBIDO", w / 2, h * 0.38); g.fillText("JOGAR LIXO", w / 2, h * 0.75); g.fillStyle = "rgba(200,40,30,0.85)"; g.fillRect(16, h * 0.86, w - 32, 6); }],
    ["houseNumber", 1792, 384, 128, 128, (g, w, h) => { g.fillStyle = "#e9e3d2"; g.fillRect(8, 8, w - 16, h - 16); g.strokeStyle = "#1d2a4a"; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = "#1d2a4a"; g.font = `800 64px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("18", w / 2, h / 2 + 3); }],
    ["chalk", 1920, 384, 128, 128, (g, w, h) => { g.strokeStyle = "rgba(235,235,230,0.8)"; g.lineWidth = 3; g.font = `400 22px ${HANDS}`; g.fillStyle = "rgba(235,235,230,0.85)"; g.fillText("GÁS ↓", 14, 40); g.strokeRect(14, 60, 90, 40); g.beginPath(); g.moveTo(14, 60); g.lineTo(104, 100); g.stroke(); }],
    // eflorescência (sal branco subindo do pé da parede) e mancha de umidade
    ["efflor", 0, 512, 512, 192, (g, w, h) => {
      const r = rng(49); for (let k = 0; k < 60; k++) { const x = r() * w, y = h - r() * h * 0.8, rad = 14 + r() * 40; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(230,228,215,0.32)"); grd.addColorStop(1, "rgba(230,228,215,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
      const wet = g.createLinearGradient(0, h, 0, 0); wet.addColorStop(0, "rgba(14,16,12,0.7)"); wet.addColorStop(0.45, "rgba(14,16,12,0.25)"); wet.addColorStop(1, "rgba(14,16,12,0)"); g.fillStyle = wet; g.fillRect(0, 0, w, h);
    }],
    // aviso de gás (placa pintada no muro sobre o abrigo) e marca de giz
    ["gasPaint", 512, 512, 384, 192, (g, w, h) => { g.fillStyle = "rgba(242,194,48,0.92)"; g.fillRect(10, 10, w - 20, h - 20); g.fillStyle = "#151515"; g.font = `900 48px ${IMPACT}`; g.textAlign = "center"; g.fillText("GLP", w / 2, h * 0.42); g.font = `800 22px ${SANS}`; g.fillText("PERIGO · INFLAMÁVEL", w / 2, h * 0.66); g.fillText("NÃO FUME", w / 2, h * 0.84); }],
    // contorno escuro de mão/encosto (gordura) em volta da porta da cozinha
    ["grease", 896, 512, 256, 256, (g, w, h) => { const r = rng(50); for (let k = 0; k < 26; k++) { const x = w * 0.2 + r() * w * 0.6, y = h * 0.2 + r() * h * 0.6, rad = 10 + r() * 30; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(24,18,10,0.35)"); grd.addColorStop(1, "rgba(24,18,10,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
    // pichação de assinatura longa (corrida) e "xarpi" vertical
    ["tagRun", 1152, 640, 640, 128, (g, w, h) => { sprayText(g, "GANA · VÉU · 7Z", w / 2, h * 0.52, 64, "#1c1c1c", "rgba(0,0,0,0)", { seed: 51, drips: 9, font: HANDS, skew: -0.3 }); }],
    ["tagVert", 1792, 512, 128, 384, (g, w, h) => { g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); sprayText(g, "ZUMBA", 0, 0, 70, "#7a2bb0", "#0d0d0d", { seed: 52, drips: 0, skew: -0.1 }); g.restore(); }],
    // grafite com fundo (peça maior): sol nascente estilizado e a palavra AURORA em letras de bloco
    ["pieceSun", 0, 704, 768, 320, (g, w, h) => {
      overspray(g, w / 2, h / 2, 300, "#2a2140", 53, 400);
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#f39a3c"); grd.addColorStop(1, "#c1306b"); g.fillStyle = grd;
      g.beginPath(); g.arc(w * 0.22, h * 0.62, h * 0.32, Math.PI, 0); g.fill();
      for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) * (Math.PI / 9); g.strokeStyle = "#f5c04a"; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.22 + Math.cos(a) * h * 0.36, h * 0.62 + Math.sin(a) * h * 0.36); g.lineTo(w * 0.22 + Math.cos(a) * h * 0.48, h * 0.62 + Math.sin(a) * h * 0.48); g.stroke(); }
      sprayText(g, "AMANHÃ", w * 0.62, h * 0.5, 110, "#f4efe2", "#1d1b2e", { seed: 54, drips: 6, skew: -0.08 });
    }],
  ]);
}

/** Folha de decalques do chão do beco (lógica 1024 × 1024). */
export function groundDecals(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  return atlas(`grounddecals:${q}`, 1024, 1024, s, [
    // faixa de sujeira do pé da parede (repete ao longo de u; v = 0 junto à parede)
    ["grime", 0, 0, 1024, 192, (g, w, h) => {
      const r = rng(61);
      const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, "rgba(16,14,10,0.92)"); grd.addColorStop(0.35, "rgba(26,22,16,0.65)"); grd.addColorStop(0.75, "rgba(40,34,26,0.18)"); grd.addColorStop(1, "rgba(40,34,26,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 700; k++) { const x = r() * w, y = h - Math.pow(r(), 1.7) * h; g.globalAlpha = 0.2 + r() * 0.4; g.fillStyle = ["#2b2418", "#4a3d29", "#151310", "#5b5040", "#3a4a26"][Math.floor(r() * 5)]; g.beginPath(); g.ellipse(x, y, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2); g.fill(); }
      // folhas secas e lodo verde
      for (let k = 0; k < 40; k++) { const x = r() * w, y = h - r() * h * 0.6; g.globalAlpha = 0.75; g.fillStyle = ["#6b4a22", "#8a6630", "#4d3a1c"][k % 3]; g.save(); g.translate(x, y); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 9 + r() * 6, 4 + r() * 2, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.globalAlpha = 0.35; g.fillStyle = "#2f4220"; for (let k = 0; k < 30; k++) { g.beginPath(); g.ellipse(r() * w, h - r() * 30, 20 + r() * 40, 5 + r() * 6, 0, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }],
    // panfletos (papel, um pouco amassado/sujo): eventos e serviços inventados
    ["flyer0", 0, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#f6f1e3", 62); g.fillStyle = "#c2185b"; g.font = `900 22px ${IMPACT}`; g.textAlign = "center"; g.fillText("BAILE", w / 2, 40); g.fillText("ORVALHO", w / 2, 66); g.fillStyle = "#222"; g.font = `600 11px ${SANS}`; g.fillText("SÁBADO · 23H", w / 2, 92); g.fillRect(14, 104, w - 28, 2); g.fillText("ENTRADA FRANCA", w / 2, 124); g.fillStyle = "rgba(60,40,20,0.25)"; g.fillRect(0, h * 0.6, w, 30); }],
    ["flyer1", 128, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#fff04a", 63); g.fillStyle = "#151515"; g.font = `900 20px ${IMPACT}`; g.textAlign = "center"; g.fillText("PIZZA", w / 2, 36); g.fillText("DO BECO", w / 2, 60); g.font = `700 12px ${SANS}`; g.fillText("ENTREGA 24H", w / 2, 88); g.fillStyle = "#c62828"; g.beginPath(); g.arc(w / 2, 130, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.font = `900 14px ${SANS}`; g.fillText("2 POR 1", w / 2, 135); }],
    ["flyer2", 256, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#e9f0f7", 64); g.fillStyle = "#1a3a6a"; g.font = `900 16px ${SANS}`; g.textAlign = "center"; g.fillText("ALUGA-SE", w / 2, 30); g.fillText("SALÃO", w / 2, 50); g.fillStyle = "#333"; g.font = `500 10px ${SANS}`; for (let k = 0; k < 6; k++) g.fillRect(16, 70 + k * 12, w - 32 - (k % 2) * 20, 3); for (let k = 0; k < 7; k++) { g.fillStyle = "#ddd"; g.fillRect(6 + k * 17, h - 30, 12, 28); g.fillStyle = "#555"; g.fillRect(9 + k * 17, h - 28, 2, 24); } }],
    ["flyer3", 384, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#121212", 65); g.fillStyle = "#e3b04b"; g.font = `400 14px Georgia, serif`; g.textAlign = "center"; g.fillText("GALA", w / 2, 40); g.font = `400 26px Georgia, serif`; g.fillText("LUMIÈRE", w / 2, 70); g.font = `600 9px ${SANS}`; g.fillText("CONVITE · NÃO TRANSFERÍVEL", w / 2, 100); g.strokeStyle = "#e3b04b"; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = "rgba(90,70,40,0.4)"; g.beginPath(); g.ellipse(w * 0.7, h * 0.8, 30, 14, 0.3, 0, Math.PI * 2); g.fill(); }],
    // jornal velho (colunas cinza)
    ["newspaper", 512, 192, 256, 176, (g, w, h) => { paperFill(g, w, h, "#d9d4c5", 66); g.fillStyle = "#2a2a2a"; g.font = `900 22px Georgia, serif`; g.fillText("CIDADE", 12, 30); for (let c = 0; c < 4; c++) for (let k = 0; k < 14; k++) g.fillRect(12 + c * 60, 46 + k * 9, 50 - (k % 3) * 6, 3); g.fillStyle = "#777"; g.fillRect(140, 50, 100, 60); }],
    // papelão rasgado (pedaço solto)
    ["cardboard", 768, 192, 256, 176, (g, w, h) => { raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.4, 67, 0.3); g.save(); g.clip(); g.fillStyle = "#a27c52"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(60,40,20,0.25)"; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h); g.fillStyle = "#1a1a1a"; g.font = `900 22px ${SANS}`; g.fillText("FRÁGIL", 40, 80); g.fillStyle = "rgba(40,30,20,0.5)"; g.fillRect(0, h * 0.7, w, 20); g.restore(); }],
    // manchas de óleo (escuras com borda irisada) e mancha molhada (bica do cano)
    ["oil0", 0, 368, 256, 256, (g, w, h) => { const r = rng(68); for (let k = 0; k < 9; k++) { const x = w / 2 + (r() - 0.5) * 90, y = h / 2 + (r() - 0.5) * 90, rad = 30 + r() * 60; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(8,8,6,0.55)"); grd.addColorStop(0.75, "rgba(12,10,8,0.3)"); grd.addColorStop(1, "rgba(12,10,8,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
    ["oil1", 256, 368, 256, 256, (g, w, h) => { const r = rng(69); for (let k = 0; k < 24; k++) { const x = w / 2 + (r() - 0.5) * 160, y = h / 2 + (r() - 0.5) * 60, rad = 8 + r() * 26; g.fillStyle = `rgba(10,9,7,${0.3 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill(); } }],
    ["wetStain", 512, 368, 256, 256, (g, w, h) => { raggedBlob(g, w / 2, h / 2, w * 0.45, h * 0.32, 70, 0.4, 60); const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.45); grd.addColorStop(0, "rgba(10,12,10,0.7)"); grd.addColorStop(1, "rgba(10,12,10,0.15)"); g.fillStyle = grd; g.fill(); }],
    // marca de pneu (arco de borracha) e pegadas de lama
    ["tire", 768, 368, 256, 256, (g, w, h) => { g.strokeStyle = "rgba(12,12,12,0.55)"; g.lineWidth = 34; g.setLineDash([3, 5]); g.beginPath(); g.arc(-60, h * 1.1, w * 0.95, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); g.setLineDash([]); g.lineWidth = 2; g.strokeStyle = "rgba(10,10,10,0.3)"; g.beginPath(); g.arc(-60, h * 1.1, w * 0.95 + 14, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); }],
    ["steps", 0, 624, 256, 128, (g, w, h) => { const r = rng(71); for (let k = 0; k < 6; k++) { const x = 20 + k * 38, y = h / 2 + (k % 2 ? -18 : 18); g.save(); g.translate(x, y); g.rotate(0.1 + (r() - 0.5) * 0.2); g.fillStyle = "rgba(40,30,18,0.45)"; g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(-16, 0, 6, 5, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }],
    // folhas soltas (cada uma recortada)
    ["leaves", 256, 624, 256, 128, (g, w, h) => { const r = rng(72); for (let k = 0; k < 14; k++) { const x = 16 + r() * (w - 32), y = 16 + r() * (h - 32); g.save(); g.translate(x, y); g.rotate(r() * 6); g.fillStyle = ["#6b4a22", "#8a6630", "#4d3a1c", "#7a5a28", "#3e4a22"][k % 5]; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -8, 14, 0); g.quadraticCurveTo(0, 8, -14, 0); g.fill(); g.strokeStyle = "rgba(30,20,10,0.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke(); g.restore(); } }],
    // chiclete e manchas pequenas (pontos escuros achatados)
    ["gum", 512, 624, 256, 128, (g, w, h) => { const r = rng(73); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${30 + r() * 30},${28 + r() * 20},${26 + r() * 20},${0.5 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, Math.PI * 2); g.fill(); } }],
    // embalagem de salgadinho amassada e copo plástico achatado (vistos de cima)
    ["wrapper", 768, 624, 128, 128, (g, w, h) => { raggedBlob(g, w / 2, h / 2, 50, 30, 74, 0.35); g.fillStyle = "#c62f2f"; g.fill(); g.fillStyle = "#f4d03f"; g.font = `900 18px ${IMPACT}`; g.textAlign = "center"; g.fillText("CROC", w / 2, h / 2 + 6); g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.3, h * 0.3); g.lineTo(w * 0.5, h * 0.42); g.stroke(); }],
    ["cup", 896, 624, 128, 128, (g, w, h) => { g.fillStyle = "rgba(240,240,236,0.95)"; g.beginPath(); g.moveTo(20, 40); g.lineTo(108, 30); g.lineTo(100, 92); g.lineTo(28, 98); g.closePath(); g.fill(); g.strokeStyle = "rgba(120,120,120,0.6)"; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(26 + k * 20, 40); g.lineTo(30 + k * 20, 96); g.stroke(); } }],
  ]);
}

/* ---------- poças ---------- */
/** Poças (lógica 1024 × 256, quatro formas): alfa = água (borda recortada e mais fina), cor = escuro com película de óleo
 * furta-cor em faixas; o material da poça é liso (reflete o ambiente da rua). */
export function puddleAtlas(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const draw = (seed: number, oily: number) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed), cx = w / 2, cy = h / 2;
    // forma: soma de 5 manchas elípticas, contorno suave
    const blobs = Array.from({ length: 5 }, () => ({ x: cx + (r() - 0.5) * w * 0.4, y: cy + (r() - 0.5) * h * 0.35, rx: w * (0.14 + r() * 0.16), ry: h * (0.12 + r() * 0.14), a: r() * 3 }));
    for (const b of blobs) {
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(b.rx, b.ry));
      grd.addColorStop(0, "rgba(10,12,14,1)"); grd.addColorStop(0.7, "rgba(10,12,14,0.95)"); grd.addColorStop(1, "rgba(10,12,14,0)");
      g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.scale(1, b.ry / b.rx); g.translate(-b.x, -b.y); g.fillStyle = grd; g.beginPath(); g.arc(b.x, b.y, b.rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // película de óleo: faixas de cor fina (arco-íris) dentro da poça, só onde há água
    if (oily > 0) {
      g.save(); g.globalCompositeOperation = "source-atop";
      for (let k = 0; k < 7; k++) {
        const x = cx + (r() - 0.5) * w * 0.3, y = cy + (r() - 0.5) * h * 0.3, R = 20 + r() * 60;
        const hues = ["rgba(170,60,200,", "rgba(40,140,220,", "rgba(40,200,120,", "rgba(230,200,40,", "rgba(220,90,40,"];
        for (let j = 0; j < hues.length; j++) { g.strokeStyle = `${hues[j]}${0.16 * oily})`; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, R + j * 5, (R + j * 5) * 0.6, r() * 3, 0, Math.PI * 2); g.stroke(); }
      }
      g.restore();
    }
  };
  return atlas(`puddles:${q}`, 1024, 256, s, [["p0", 0, 0, 256, 256, draw(81, 0)], ["p1", 256, 0, 256, 256, draw(82, 1)], ["p2", 512, 0, 256, 256, draw(83, 0.4)], ["p3", 768, 0, 256, 256, draw(84, 1)]]);
}
