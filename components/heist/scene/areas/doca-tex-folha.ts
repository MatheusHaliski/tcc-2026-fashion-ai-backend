/*
 * MET Gala Heist v2 — doca (Z12): a folha de desenhos (placas, quadro de escalas, mural, mapa de fuga,
 * estênceis, etiquetas, marcas do piso) e os retângulos UV de cada desenho. Saiu de doca-tex.ts sem mudança.
 */
import * as THREE from "three";
import { DOORS, ROOMS } from "@/lib/heist/level";
import { HAND, SANS, SERIF, drawnTexture, fit, type Quality } from "../interior-tex";
import { memo, rng, tex } from "./doca-tex-base";

/* ======================= folha de desenhos ======================= */
export interface Rect { u0: number; v0: number; u1: number; v1: number }
type Cell = [string, number, number, number, number, (g: CanvasRenderingContext2D, w: number, h: number) => void];
const LW = 2048, LH = 2048;
const YEL = "#f2c230", BLK = "#151515", RED = "#c3141a", GRN = "#0b7a3b", BLU = "#1d4f9c";
const STEN = "'Stencil', 'Stardos Stencil', 'Arial Black', Impact, 'DejaVu Sans', sans-serif";

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, color: string, o: { font?: string; weight?: string; align?: CanvasTextAlign; max?: number } = {}) {
  g.fillStyle = color; g.textAlign = o.align ?? "center"; g.textBaseline = "middle";
  const fam = o.font ?? SANS, wgt = o.weight ?? "700";
  if (o.max) fit(g, s, (p) => `${wgt} ${p}px ${fam}`, px, o.max); else g.font = `${wgt} ${px}px ${fam}`;
  g.fillText(s, x, y);
}
function pictoExtinguisher(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  g.fillStyle = color; g.beginPath(); g.roundRect(cx - s * 0.18, cy - s * 0.3, s * 0.36, s * 0.75, s * 0.12); g.fill();
  g.fillRect(cx - s * 0.08, cy - s * 0.45, s * 0.16, s * 0.16); g.lineWidth = s * 0.07; g.strokeStyle = color; g.beginPath(); g.moveTo(cx + s * 0.06, cy - s * 0.38); g.quadraticCurveTo(cx + s * 0.4, cy - s * 0.4, cx + s * 0.34, cy + s * 0.1); g.stroke();
}
function pictoPerson(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, run = false) {
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = "round"; g.lineWidth = s * 0.12;
  g.beginPath(); g.arc(cx + (run ? s * 0.1 : 0), cy - s * 0.42, s * 0.11, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx, cy - s * 0.28); g.lineTo(cx - (run ? s * 0.06 : 0), cy + s * 0.08);
  if (run) { g.lineTo(cx + s * 0.22, cy + s * 0.42); g.moveTo(cx - s * 0.06, cy + s * 0.08); g.lineTo(cx - s * 0.3, cy + s * 0.3); g.moveTo(cx, cy - s * 0.2); g.lineTo(cx + s * 0.28, cy - s * 0.05); g.moveTo(cx, cy - s * 0.2); g.lineTo(cx - s * 0.26, cy - s * 0.12); }
  else { g.lineTo(cx - s * 0.12, cy + s * 0.45); g.moveTo(cx, cy + s * 0.08); g.lineTo(cx + s * 0.12, cy + s * 0.45); g.moveTo(cx - s * 0.22, cy - s * 0.12); g.lineTo(cx + s * 0.22, cy - s * 0.12); }
  g.stroke();
}
function tapeStrip(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "rgba(235,232,215,0.85)"; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
function pin(g: CanvasRenderingContext2D, x: number, y: number, c: string) { g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(x + 2, y + 3, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, Math.PI * 2); g.fill(); }
function sheet(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, draw: () => void, bg = "#f4f1e8") {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(a); g.translate(-w / 2, -h / 2);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(3, 4, w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h); draw(); g.restore();
}

/** Planta simplificada do museu para o mapa de rota de fuga (as salas do jogo, a doca destacada, setas para as saídas). */
function evacMap(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, w, h); g.strokeStyle = GRN; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = GRN; g.fillRect(0, 0, w, 54); text(g, "ROTA DE FUGA", w / 2, 28, 30, "#fff", { weight: "800" });
  const X0 = -23, X1 = 31, Z0 = -24, Z1 = 26, mx = 20, my = 70, sx = (w - mx * 2) / (X1 - X0), sz = (h - my - 40) / (Z1 - Z0), s = Math.min(sx, sz);
  const P = (x: number, z: number): [number, number] => [mx + (x - X0) * s, my + (z - Z0) * s];
  for (const r of ROOMS) {
    if (r.id === "rua" || r.id === "beiral" || r.id === "seguranca") continue;
    const [a, b] = P(r.rect.x0, r.rect.z0), [c, d] = P(r.rect.x1, r.rect.z1);
    g.fillStyle = r.id === "doca" ? "#ffe69a" : r.outdoor ? "#e3eadf" : "#ffffff"; g.fillRect(a, b, c - a, d - b);
    g.strokeStyle = "#333"; g.lineWidth = 2; g.strokeRect(a, b, c - a, d - b);
  }
  for (const d of DOORS) { if (d.lock === "climb" || d.lock === "vent") continue; const [a, b] = P(d.rect.x0, d.rect.z0), [c, e] = P(d.rect.x1, d.rect.z1); g.fillStyle = "#ffffff"; g.fillRect(a - 1, b - 1, c - a + 2, e - b + 2); }
  // saídas (portão da doca e portas da frente) e as setas verdes
  g.strokeStyle = GRN; g.fillStyle = GRN; g.lineWidth = 4;
  const arrow = (x0: number, z0: number, x1: number, z1: number) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1), an = Math.atan2(d - b, c - a); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.beginPath(); g.moveTo(c, d); g.lineTo(c - 12 * Math.cos(an - 0.4), d - 12 * Math.sin(an - 0.4)); g.lineTo(c - 12 * Math.cos(an + 0.4), d - 12 * Math.sin(an + 0.4)); g.closePath(); g.fill(); };
  arrow(-15, 19.5, -19, 25.5); arrow(-11, 21.2, -7.6, 21.2); arrow(0, 19, 0, 25.5); arrow(0, 6, 0, 12.6); arrow(17, 9, 13, 10);
  const [yx, yy] = P(-10.2, 18.4); g.fillStyle = RED; g.beginPath(); g.arc(yx, yy, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
  text(g, "VOCÊ ESTÁ AQUI", yx + 70, yy - 16, 15, RED, { weight: "800" });
  text(g, "SAÍDA", P(-19, 26)[0], P(-19, 26)[1] + 6, 15, GRN, { weight: "800" }); text(g, "SAÍDA", P(0, 26)[0], P(0, 26)[1] + 6, 15, GRN, { weight: "800" });
  g.fillStyle = "#555"; g.font = `500 12px ${SANS}`; g.textAlign = "left"; g.fillText("Museu Vesper · térreo · em caso de incêndio não use o elevador", 16, h - 16);
}

const CELLS: Cell[] = [
  /* ----- placas ----- */
  ["dockTitle", 0, 0, 1024, 192, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = BLK; for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x + 24 - 24, 22); g.lineTo(x - 24, 22); g.fill(); g.beginPath(); g.moveTo(x, h - 22); g.lineTo(x + 24, h - 22); g.lineTo(x, h); g.lineTo(x - 24, h); g.fill(); } text(g, "DOCA 1 · CARGA E DESCARGA", w / 2, h * 0.43, 74, BLK, { weight: "900", max: w - 80 }); text(g, "ENTREGAS DA GALA · SOMENTE COM CREDENCIAL", w / 2, h * 0.74, 30, BLK, { weight: "700", max: w - 80 }); }],
  ["clearance", 1024, 0, 512, 192, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); text(g, "ALTURA LIVRE", w / 2, h * 0.32, 44, BLK, { weight: "900" }); text(g, "4,20 m", w / 2, h * 0.68, 70, RED, { weight: "900" }); }],
  ["booth", 1536, 0, 512, 96, (g, w, h) => { g.fillStyle = "#1d2a4a"; g.fillRect(0, 0, w, h); text(g, "PORTARIA · CONTROLE DE ACESSO", w / 2, h / 2, 30, "#fff", { weight: "800", max: w - 30 }); }],
  ["visitors", 1536, 96, 512, 96, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); text(g, "MOTORISTAS: APRESENTEM-SE NA PORTARIA", w / 2, h / 2, 24, BLK, { weight: "800", max: w - 30 }); }],
  ["epi", 0, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = BLU; g.beginPath(); g.arc(w / 2, 120, 100, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(w / 2, 108, 50, 34, 0, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 64, 106, 128, 12); g.fillRect(w / 2 - 34, 140, 68, 50); text(g, "USO OBRIGATÓRIO", w / 2, 262, 26, BLU, { weight: "900" }); text(g, "DE EPI", w / 2, 296, 34, BLU, { weight: "900" }); text(g, "capacete · colete · botina", w / 2, 340, 18, "#333", { weight: "600" }); }],
  ["noSmoking", 256, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, 120, 92, 0, Math.PI * 2); g.stroke(); g.fillStyle = BLK; g.fillRect(w / 2 - 70, 112, 110, 22); g.fillStyle = "#e8e2d0"; g.fillRect(w / 2 + 40, 112, 26, 22); g.strokeStyle = "#999"; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2 + 60, 104); g.quadraticCurveTo(w / 2 + 74, 84, w / 2 + 60, 64); g.stroke(); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.moveTo(w / 2 - 65, 55); g.lineTo(w / 2 + 65, 185); g.stroke(); text(g, "PROIBIDO", w / 2, 270, 34, RED, { weight: "900" }); text(g, "FUMAR", w / 2, 310, 34, RED, { weight: "900" }); text(g, "Lei estadual", w / 2, 350, 16, "#555", { weight: "500" }); }],
  ["forklift", 512, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = YEL; g.strokeStyle = BLK; g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, 22); g.lineTo(w - 18, 210); g.lineTo(18, 210); g.closePath(); g.fill(); g.stroke(); g.fillStyle = BLK; g.fillRect(w / 2 - 40, 120, 56, 46); g.fillRect(w / 2 + 16, 80, 8, 90); g.fillRect(w / 2 + 16, 160, 40, 6); g.beginPath(); g.arc(w / 2 - 28, 176, 12, 0, Math.PI * 2); g.arc(w / 2 + 6, 176, 12, 0, Math.PI * 2); g.fill(); text(g, "CUIDADO", w / 2, 262, 36, BLK, { weight: "900" }); text(g, "EMPILHADEIRA E", w / 2, 304, 22, BLK, { weight: "800" }); text(g, "PALETEIRA EM MANOBRA", w / 2, 332, 18, BLK, { weight: "800", max: w - 20 }); }],
  ["extinguisher", 768, 256, 256, 256, (g, w, h) => { g.fillStyle = RED; g.fillRect(0, 0, w, h); g.strokeStyle = "#fff"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); pictoExtinguisher(g, w * 0.42, h * 0.48, h * 0.62, "#fff"); text(g, "EXTINTOR", w / 2, h * 0.9, 26, "#fff", { weight: "900" }); }],
  ["speed", 1024, 256, 256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, h / 2 - 10, 100, 0, Math.PI * 2); g.stroke(); text(g, "5", w / 2, h / 2 - 22, 96, BLK, { weight: "900" }); text(g, "km/h", w / 2, h / 2 + 38, 26, BLK, { weight: "800" }); }],
  ["exit", 1280, 256, 384, 160, (g, w, h) => { g.fillStyle = GRN; g.fillRect(0, 0, w, h); pictoPerson(g, 70, h / 2 + 6, 110, "#f1fff4", true); g.fillStyle = "#f1fff4"; g.fillRect(118, 30, 6, h - 60); text(g, "SAÍDA", 250, h / 2 + 2, 64, "#f1fff4", { weight: "900" }); g.beginPath(); g.moveTo(w - 30, h / 2); g.lineTo(w - 60, h / 2 - 26); g.lineTo(w - 60, h / 2 + 26); g.fill(); }],
  ["maxLoad", 1280, 416, 384, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); text(g, "CARGA MÁXIMA", w / 2, h * 0.36, 34, BLK, { weight: "900" }); text(g, "300 kg POR PRATELEIRA", w / 2, h * 0.72, 26, BLK, { weight: "800" }); }],
  ["clock", 1664, 256, 256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#dedbd2"); grd.addColorStop(1, "#c9c5ba"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    text(g, "PONTO ELETRÔNICO", w / 2, 26, 18, "#333", { weight: "800" }); g.fillStyle = "#0f1a12"; g.fillRect(28, 46, w - 56, 70); text(g, "23:47", w / 2, 82, 50, "#9cff8a", { font: "monospace", weight: "700" });
    text(g, "SÁB 04/12  ·  APROXIME O CRACHÁ", w / 2, 132, 13, "#333", { weight: "700", max: w - 20 });
    for (let k = 0; k < 12; k++) { g.fillStyle = "#3a3a3a"; g.fillRect(40 + (k % 3) * 62, 152 + Math.floor(k / 3) * 24, 52, 18); }
    g.fillStyle = "#c62828"; g.beginPath(); g.arc(w - 30, 30, 6, 0, Math.PI * 2); g.fill();
  }],
  ["cards", 1664, 512, 256, 128, (g, w, h) => { g.fillStyle = "#5c6066"; g.fillRect(0, 0, w, h); const r = rng(741); for (let k = 0; k < 8; k++) { g.fillStyle = r() < 0.2 ? "#ffd75a" : "#f4f2ec"; g.fillRect(8 + k * 31, 10 + (r() < 0.5 ? 0 : 6), 26, h - 26); g.fillStyle = "#333"; g.fillRect(12 + k * 31, 18, 18, 3); g.fillRect(12 + k * 31, 26, 14, 2); } }],
  /* ----- quadro de escalas, mural, mapa, prancheta ----- */
  ["schedule", 0, 640, 1024, 640, (g, w, h) => {
    g.fillStyle = "#f7f8f6"; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, "rgba(255,255,255,0.6)"); grd.addColorStop(0.4, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(200,205,210,0.3)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,130,140,0.18)"; for (let k = 0; k < 6; k++) g.fillRect(80 + k * 150, 40 + (k % 3) * 160, 120, 20);     // marcas de apagador
    text(g, "ESCALA · DOCA · GALA LUMIÈRE · SÁB 04/12", w / 2, 50, 40, "#1b3a8a", { font: HAND, weight: "700", max: w - 60 });
    g.strokeStyle = "#1b1b1b"; g.lineWidth = 3; const cols = [40, 170, 390, 690, 830, 980], top = 96, rowH = 50;
    for (const x of cols) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + rowH * 6); g.stroke(); }
    for (let k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(cols[0], top + k * rowH); g.lineTo(cols[cols.length - 1], top + k * rowH); g.stroke(); }
    const rows = [["TURNO", "NOME", "FUNÇÃO", "ENTRA", "SAI"], ["NOITE", "Gil", "Portão / chave", "18:00", "02:00"], ["NOITE", "Sônia", "Ronda da doca", "18:00", "02:00"], ["NOITE", "Dorival", "Portaria", "18:00", "06:00"], ["BUFÊ", "Márcia", "Conferência", "17:00", "01:00"], ["BUFÊ", "Tião", "Carga e descarga", "17:00", "01:00"]];
    rows.forEach((r, k) => r.forEach((s, j) => { g.fillStyle = k === 0 ? "#b3121e" : "#1b1b1b"; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `${k === 0 ? 700 : 400} 30px ${HAND}`; g.fillText(s, cols[j] + 12, top + k * rowH + rowH / 2 + 2); }));
    g.font = `400 28px ${HAND}`; g.fillStyle = "#1b3a8a"; g.textAlign = "left";
    ["ENTREGAS:", "21:00  Bufê Lumière — câmara fria  ✓", "21:40  Gelo, 40 sacos  ✓", "22:30  Flores (arranjo extra)", "00:30  Recolhimento dos cases"].forEach((s, k) => g.fillText(s, 52, 432 + k * 34));
    g.fillStyle = "#b3121e"; g.font = `700 34px ${HAND}`; g.fillText("23:10  TROCA DE TURNO DA SEGURANÇA", 520, 470); g.fillRect(520, 492, 440, 4);
    g.font = `400 26px ${HAND}`; g.fillText("portão SÓ com o Gil!", 600, 540);
    // ímãs e a bandeja de canetas
    for (const [x, y, c] of [[150, 130, "#e53935"], [300, 300, "#43a047"], [860, 180, "#1e88e5"], [930, 520, "#fdd835"]] as [number, number, string][]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(x - 4, y - 4, 4, 0, Math.PI * 2); g.fill(); }
    sheet(g, 760, 360, 180, 120, 0.05, () => { text(g, "CAFÉ", 90, 40, 26, "#333", { font: HAND }); text(g, "na copa ↑", 90, 80, 22, "#555", { font: HAND }); }, "#fff59d");
  }],
  ["notices", 1024, 640, 512, 384, (g, w, h) => {
    const r = rng(751); g.fillStyle = "#b98a56"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "90,60,30" : "220,180,120"},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = "#5a3e22"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    sheet(g, 30, 30, 170, 220, -0.04, () => { g.fillStyle = BLU; g.fillRect(0, 0, 170, 40); text(g, "CIPA", 85, 21, 24, "#fff", { weight: "900" }); text(g, "SEMANA DE", 85, 70, 16, "#222"); text(g, "PREVENÇÃO", 85, 92, 18, "#222", { weight: "800" }); for (let k = 0; k < 6; k++) { g.fillStyle = "#999"; g.fillRect(16, 120 + k * 14, 138 - (k % 2) * 30, 4); } });
    sheet(g, 220, 24, 150, 110, 0.03, () => { text(g, "RAMAIS", 75, 18, 18, BLK, { weight: "900" }); ["Portaria 201", "Segurança 202", "Bufê 230", "Produção 245"].forEach((s, k) => text(g, s, 75, 42 + k * 18, 14, "#222", { weight: "600" })); });
    sheet(g, 380, 40, 110, 140, -0.06, () => { g.fillStyle = "#8a8d92"; g.fillRect(10, 10, 90, 90); g.fillStyle = "#c9b9a0"; g.beginPath(); g.arc(55, 48, 18, 0, Math.PI * 2); g.fill(); g.fillRect(30, 70, 50, 30); text(g, "aniversariante", 55, 118, 12, "#333", { font: HAND }); }, "#fff");
    sheet(g, 220, 160, 270, 150, 0.02, () => { g.fillStyle = RED; g.fillRect(0, 0, 270, 34); text(g, "AVISO", 135, 18, 22, "#fff", { weight: "900" }); text(g, "PROIBIDO ESTACIONAR", 135, 62, 18, BLK, { weight: "800" }); text(g, "NA RAMPA DA DOCA", 135, 86, 18, BLK, { weight: "800" }); text(g, "— Administração", 160, 126, 14, "#444", { font: HAND }); });
    sheet(g, 40, 270, 160, 90, 0.05, () => { text(g, "MARMITA ✓", 80, 30, 22, "#222", { font: HAND }); text(g, "sexta: feijoada", 80, 62, 16, "#444", { font: HAND }); }, "#fff59d");
    for (const [x, y, c] of [[115, 34, RED], [295, 28, "#1e88e5"], [435, 44, "#43a047"], [355, 164, "#fdd835"], [120, 274, RED]] as [number, number, string][]) pin(g, x, y, c);
  }],
  ["evac", 1536, 640, 512, 384, (g, w, h) => evacMap(g, w, h)],
  ["clipboard", 1152, 1664, 256, 384, (g, w, h) => {
    g.fillStyle = "#6b4a2a"; g.fillRect(0, 0, w, h); g.fillStyle = "#f6f3ea"; g.fillRect(14, 40, w - 28, h - 54);
    g.fillStyle = "#9aa0a6"; g.fillRect(w / 2 - 50, 8, 100, 40); g.fillStyle = "#6c7177"; g.fillRect(w / 2 - 30, 18, 60, 10);
    text(g, "CONFERÊNCIA DE CARGA", w / 2, 66, 17, BLK, { weight: "900", max: w - 40 }); text(g, "Bufê Lumière · NF 0412", w / 2, 88, 13, "#444", { weight: "600" });
    ["Câmara fria (3)", "Cubas inox (24)", "Taças (12 cx)", "Toalhas (6 fardos)", "Gelo (40 sacos)", "Flores (extra)", "Cases de luz (8)"].forEach((s, k) => { const y = 118 + k * 28; g.strokeStyle = "#333"; g.lineWidth = 2; g.strokeRect(26, y - 9, 16, 16); g.fillStyle = "#222"; g.textAlign = "left"; g.font = `500 15px ${SANS}`; g.fillText(s, 52, y); if (k < 5) { g.strokeStyle = "#1b3a8a"; g.lineWidth = 3; g.beginPath(); g.moveTo(28, y); g.lineTo(34, y + 6); g.lineTo(44, y - 10); g.stroke(); } });
    g.strokeStyle = "#333"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(30, h - 40); g.lineTo(w - 30, h - 40); g.stroke(); text(g, "Márcia", w / 2, h - 52, 22, "#1b3a8a", { font: HAND });
  }],
  ["hiVis", 1280, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#c8f526"; g.fillRect(0, 0, w, h); for (const y of [h * 0.38, h * 0.62]) { g.fillStyle = "#c9cdd2"; g.fillRect(0, y, w, h * 0.08); g.fillStyle = "rgba(255,255,255,0.5)"; for (let x = 0; x < w; x += 6) g.fillRect(x, y + 2, 3, h * 0.08 - 4); } text(g, "STAFF", w / 2, h * 0.22, 34, "#1b1b1b", { weight: "900" }); }],
  ["cateringBox", 1536, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#f1efe9"; g.fillRect(0, 0, w, h); g.fillStyle = "#b8913f"; g.beginPath(); g.arc(w / 2, h * 0.44, 46, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 58, h * 0.44, 116, 8); g.beginPath(); g.arc(w / 2, h * 0.44 - 50, 7, 0, Math.PI * 2); g.fill(); text(g, "BUFÊ LUMIÈRE", w / 2, h * 0.68, 26, "#151515", { font: SERIF, weight: "400" }); text(g, "MANTER REFRIGERADO", w / 2, h * 0.84, 14, "#8a6c2f", { weight: "700" }); g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }],
  ["kraftBox", 1792, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#b48d5d"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 5) { g.fillStyle = "rgba(80,55,25,0.07)"; g.fillRect(x, 0, 2, h); } g.fillStyle = "rgba(225,210,170,0.85)"; g.fillRect(0, h * 0.45, w, 30); text(g, "FRÁGIL", w * 0.36, h * 0.2, 34, "rgba(20,20,20,0.85)", { weight: "900" }); g.fillStyle = "rgba(20,20,20,0.85)"; for (const dx of [0, 34]) { const x = w * 0.75 + dx, y = h * 0.78; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 14, y - 8); g.lineTo(x + 5, y - 8); g.lineTo(x + 5, y + 22); g.lineTo(x - 5, y + 22); g.lineTo(x - 5, y - 8); g.lineTo(x - 14, y - 8); g.closePath(); g.fill(); } g.fillStyle = "#fff"; g.fillRect(20, h * 0.66, 100, 60); g.fillStyle = "#333"; for (let k = 0; k < 4; k++) g.fillRect(28, h * 0.66 + 10 + k * 12, 80 - k * 10, 4); }],
  /* ----- estênceis e etiquetas ----- */
  ["caseLight", 0, 1280, 512, 128, (g, w, h) => { text(g, "ILUMINAÇÃO · CASE 07", w / 2, h * 0.42, 44, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "GALA LUMIÈRE · PRODUÇÃO", w / 2, h * 0.8, 22, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["caseSound", 512, 1280, 512, 128, (g, w, h) => { text(g, "SOM · CASE 12", w / 2, h * 0.42, 48, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "PA · LADO L", w / 2, h * 0.8, 24, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["caseCostume", 1024, 1280, 512, 128, (g, w, h) => { text(g, "FIGURINO · CASE 21", w / 2, h * 0.42, 44, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "DESFILE FINAL · AURORA", w / 2, h * 0.8, 22, "rgba(242,194,48,0.9)", { font: STEN, weight: "700" }); }],
  ["caseCables", 1536, 1280, 512, 128, (g, w, h) => { text(g, "CABOS · CASE 03", w / 2, h * 0.42, 48, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "NÃO EMPILHAR SOBRE ESTE", w / 2, h * 0.8, 22, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["artCrate", 0, 1408, 512, 256, (g, w, h) => {
    text(g, "MUSEU VESPER", w / 2, 36, 40, "rgba(18,18,18,0.88)", { font: STEN, weight: "900" }); text(g, "INSTITUTO DO TRAJE · OBRA 1957-04", w / 2, 78, 22, "rgba(18,18,18,0.85)", { font: STEN, weight: "800", max: w - 30 });
    g.fillStyle = "rgba(18,18,18,0.88)"; for (const dx of [-50, 0]) { const x = w / 2 + dx + 25, y = 150; g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 18, y - 8); g.lineTo(x + 7, y - 8); g.lineTo(x + 7, y + 26); g.lineTo(x - 7, y + 26); g.lineTo(x - 7, y - 8); g.lineTo(x - 18, y - 8); g.closePath(); g.fill(); }
    text(g, "FRÁGIL · ESTE LADO PARA CIMA · MANTER SECO", w / 2, 206, 18, "rgba(18,18,18,0.85)", { font: STEN, weight: "800", max: w - 30 });
    g.fillStyle = "#f4f4f0"; g.fillRect(16, 116, 70, 70); g.fillStyle = "#d32f2f"; g.beginPath(); g.arc(51, 146, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = "#222"; g.font = `700 10px ${SANS}`; g.textAlign = "center"; g.fillText("TILT", 51, 180);
    g.fillStyle = "#e3f2fd"; g.fillRect(w - 86, 116, 70, 70); for (let k = 0; k < 3; k++) { g.fillStyle = ["#90caf9", "#f8bbd0", "#90caf9"][k]; g.beginPath(); g.arc(w - 51, 132 + k * 20, 8, 0, Math.PI * 2); g.fill(); }
  }],
  ["gaffer0", 512, 1408, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "LUZ PALCO", w / 2, h / 2 + 2, 30, "#111", { font: HAND, weight: "700" }); }],
  ["gaffer1", 512, 1472, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "NÃO ABRIR!", w / 2, h / 2 + 2, 30, "#b3121e", { font: HAND, weight: "700" }); }],
  ["gaffer2", 512, 1536, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "SOM L/R", w / 2, h / 2 + 2, 30, "#111", { font: HAND, weight: "700" }); }],
  ["gaffer3", 512, 1600, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "DOCA → SALÃO", w / 2, h / 2 + 2, 28, "#111", { font: HAND, weight: "700" }); }],
  /* ----- marcas do piso (fundo transparente) ----- */
  ["hazard", 768, 1408, 512, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = BLK; for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - h, h); g.lineTo(x - h, h); g.closePath(); g.fill(); } wear(g, w, h, 761); }],
  ["lineYellow", 768, 1536, 256, 32, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 4, w, h - 8); wear(g, w, h, 762); }],
  ["lineWhite", 768, 1568, 256, 32, (g, w, h) => { g.fillStyle = "#eeeeea"; g.fillRect(0, 4, w, h - 8); wear(g, w, h, 763); }],
  ["arrow", 1024, 1536, 128, 128, (g, w, h) => { g.fillStyle = "#eeeeea"; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w - 18, 56); g.lineTo(w / 2 + 16, 56); g.lineTo(w / 2 + 16, h - 8); g.lineTo(w / 2 - 16, h - 8); g.lineTo(w / 2 - 16, 56); g.lineTo(18, 56); g.closePath(); g.fill(); wear(g, w, h, 764); }],
  ["pedestres", 1152, 1536, 256, 96, (g, w, h) => { text(g, "PEDESTRES", w / 2, h / 2 + 4, 44, "#eeeeea", { font: STEN, weight: "900", max: w - 10 }); wear(g, w, h, 765); }],
  ["extFloor", 1280, 1408, 128, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = RED; g.fillRect(14, 14, w - 28, h - 28); wear(g, w, h, 766); }],
  ["keepClear", 1408, 1408, 256, 256, (g, w, h) => { g.strokeStyle = YEL; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); g.save(); g.beginPath(); g.rect(14, 14, w - 28, h - 28); g.clip(); g.lineWidth = 10; for (let k = -h; k < w; k += 36) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); } g.restore(); g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(40, h / 2 - 22, w - 80, 44); text(g, "NÃO OBSTRUIR", w / 2, h / 2 + 2, 28, YEL, { weight: "900" }); wear(g, w, h, 767); }],
  ["tire", 1664, 1408, 256, 256, (g, w) => { g.strokeStyle = "rgba(12,12,12,0.5)"; for (const [r, lw] of [[w * 0.8, 10], [w * 0.8 - 46, 10]] as [number, number][]) { g.lineWidth = lw; g.beginPath(); g.arc(-40, w * 1.05, r, -Math.PI * 0.45, -Math.PI * 0.05); g.stroke(); } }],
  ["palletBox", 0, 1664, 256, 256, (g, w, h) => { g.strokeStyle = "#eeeeea"; g.lineWidth = 12; const L = 60; for (const [x, y, sx, sy] of [[8, 8, 1, 1], [w - 8, 8, -1, 1], [8, h - 8, 1, -1], [w - 8, h - 8, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke(); } wear(g, w, h, 768); }],
  ["stain", 256, 1664, 128, 128, (g, w, h) => { const r = rng(769); for (let k = 0; k < 8; k++) { const x = w / 2 + (r() - 0.5) * 50, y = h / 2 + (r() - 0.5) * 50, rad = 14 + r() * 30; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(10,9,7,0.5)"); grd.addColorStop(1, "rgba(10,9,7,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
  ["vest", 384, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#c8f526"; g.beginPath(); g.moveTo(14, 20); g.lineTo(44, 4); g.lineTo(54, 40); g.lineTo(74, 40); g.lineTo(84, 4); g.lineTo(114, 20); g.lineTo(118, h - 8); g.lineTo(10, h - 8); g.closePath(); g.fill(); for (const y of [h * 0.55, h * 0.75]) { g.fillStyle = "#cfd3d8"; g.fillRect(10, y, 108, 14); } g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(62, 40, 4, h - 48); }],
  ["jacket", 512, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#1c2433"; g.beginPath(); g.moveTo(10, 24); g.lineTo(46, 4); g.lineTo(64, 30); g.lineTo(82, 4); g.lineTo(118, 24); g.lineTo(122, h - 6); g.lineTo(6, h - 6); g.closePath(); g.fill(); g.fillStyle = "#e8e6df"; g.fillRect(16, h * 0.35, 30, 12); text(g, "SEGURANÇA", 64, h * 0.62, 13, "#e8e6df", { weight: "900" }); g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(62, 30, 4, h - 36); }],
  ["electric", 768, 1664, 128, 128, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = YEL; g.strokeStyle = BLK; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w - 10, h - 30); g.lineTo(10, h - 30); g.closePath(); g.fill(); g.stroke(); g.fillStyle = BLK; g.beginPath(); g.moveTo(w / 2 + 6, 34); g.lineTo(w / 2 - 12, 66); g.lineTo(w / 2, 66); g.lineTo(w / 2 - 6, 88); g.lineTo(w / 2 + 12, 56); g.lineTo(w / 2, 56); g.closePath(); g.fill(); text(g, "PERIGO 220/380 V", w / 2, h - 13, 13, BLK, { weight: "900", max: w - 8 }); }],
  ["gateWarn", 896, 1664, 256, 96, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8); text(g, "PORTÃO AUTOMÁTICO", w / 2, h * 0.38, 22, BLK, { weight: "900", max: w - 20 }); text(g, "NÃO PERMANEÇA SOB A PORTA", w / 2, h * 0.72, 15, BLK, { weight: "800", max: w - 20 }); }],
  ["buttons", 896, 1760, 128, 160, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); for (const [k, c, s] of [[0, "#2e7d32", "ABRE"], [1, "#c62828", "PARA"], [2, "#212121", "FECHA"]] as [number, string, string][]) { const y = 30 + k * 44; g.fillStyle = "#333"; g.beginPath(); g.arc(36, y, 17, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(36, y, 13, 0, Math.PI * 2); g.fill(); text(g, s, 88, y, 16, BLK, { weight: "900" }); } }],
  ["apron", 640, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#f2f0ea"; g.beginPath(); g.moveTo(30, 6); g.lineTo(98, 6); g.lineTo(98, 60); g.lineTo(118, 80); g.lineTo(110, h - 6); g.lineTo(18, h - 6); g.lineTo(10, 80); g.lineTo(30, 60); g.closePath(); g.fill(); g.fillStyle = "#b8913f"; g.fillRect(40, 96, 48, 6); text(g, "BUFÊ", 64, 120, 14, "#8a6c2f", { font: SERIF, weight: "400" }); }],
  // tela do notebook da bancada: a planilha da conferência de carga (notas, fornecedores fictícios, volumes, conferido)
  ["laptop", 1408, 1856, 256, 160, (g, w, h) => {
    g.fillStyle = "#f4f6f8"; g.fillRect(0, 0, w, h); g.fillStyle = "#1f3b57"; g.fillRect(0, 0, w, 20); text(g, "CONFERÊNCIA DE CARGA · DOCA", 8, 11, 11, "#fff", { weight: "800", align: "left", max: w - 16 });
    g.fillStyle = "#dde3ea"; g.fillRect(0, 22, w, 16);
    const cols = [6, 44, 152, 200, 232];
    ["NF", "FORNECEDOR", "VOL.", "OK"].forEach((s, k) => text(g, s, cols[k], 30, 9, "#33475b", { weight: "800", align: "left" }));
    const rows: [string, string, string, string][] = [["4471", "Bufê Lumière", "12", "✓"], ["4472", "Gelo Polar", "40", "✓"], ["0913", "Flores Íris", "3", "—"], ["2210", "Produção · cases", "8", "✓"], ["2211", "Produção · luz", "4", "✓"], ["0057", "Instituto do Traje", "1", "!"], ["4475", "Bufê Lumière", "6", "—"]];
    rows.forEach((r, k) => { const y = 48 + k * 15; if (k % 2) { g.fillStyle = "#eef2f6"; g.fillRect(0, y - 7, w, 15); } r.forEach((s, j) => text(g, s, cols[j], y, 9, j === 3 ? (s === "✓" ? "#2e7d32" : s === "!" ? "#c62828" : "#888") : "#222", { weight: j === 3 ? "900" : "600", align: "left", max: j === 1 ? 104 : 40 })); });
    g.fillStyle = "#1f3b57"; g.fillRect(0, h - 12, w, 12); text(g, "23:47 · 34/36 volumes", w - 8, h - 6, 8, "#cfe0f2", { weight: "700", align: "right" });
  }],
  // plaqueta de capacidade da empilhadeira patolada (com a numeração da frota da doca e os avisos), gasta nas bordas
  ["stacker", 1408, 1664, 384, 192, (g, w, h) => {
    g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = BLK; g.fillRect(10, 10, w - 20, 40); text(g, "EMPILHADEIRA ELÉTRICA  Nº 03", w / 2, 31, 22, YEL, { weight: "900", max: w - 40 });
    text(g, "CAPACIDADE 1.200 kg", w / 2, 80, 34, BLK, { weight: "900", max: w - 30 });
    text(g, "CENTRO DE CARGA 600 mm  ·  ELEVAÇÃO 1,6 m", w / 2, 113, 15, BLK, { weight: "800", max: w - 30 });
    g.save(); g.beginPath(); g.rect(10, 128, w - 20, 22); g.clip(); for (let x = -22; x < w; x += 28) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 14, 150); g.lineTo(x + 36, 128); g.lineTo(x + 22, 128); g.closePath(); g.fill(); } g.restore();
    text(g, "SÓ OPERADOR TREINADO · NÃO TRANSPORTE PESSOAS", w / 2, 168, 14, BLK, { weight: "800", max: w - 30 });
    const r = rng(771); for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(52,44,30,${0.05 + r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() < 0.5 ? r() * 18 + h - 18 : r() * h, 2 + r() * 9, 0, Math.PI * 2); g.fill(); }
  }],
];
/** Desgaste da tinta do piso: falhas e riscos (transparência). */
function wear(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed); g.save(); g.globalCompositeOperation = "destination-out";
  for (let k = 0; k < (w * h) / 220; k++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 5, 0.6 + r() * 2, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** A folha (lógica 2048 × 2048; 1024 no "low") e os retângulos UV de cada desenho. */
export function docaAtlas(q: Quality): { tex: THREE.CanvasTexture; rects: Record<string, Rect> } {
  return memo(`atlas-${q}`, () => {
    const s = q === "high" ? 1 : 0.5;
    const t = drawnTexture(`doca-atlas-${q}`, LW * s, LH * s, (g) => {
      g.clearRect(0, 0, LW * s, LH * s);
      for (const [, x, y, w, h, draw] of CELLS) { g.save(); g.scale(s, s); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore(); }
    });
    t.anisotropy = 8;
    const rects: Record<string, Rect> = {};
    for (const [name, x, y, w, h] of CELLS) rects[name] = { u0: (x + 1) / LW, v0: 1 - (y + h - 1) / LH, u1: (x + w - 1) / LW, v1: 1 - (y + 1) / LH };
    return { tex: t, rects };
  });
}
