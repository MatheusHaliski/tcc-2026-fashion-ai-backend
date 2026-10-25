/*
 * MET Gala Heist v2 — os móveis do interior, um construtor por tipo de móvel da planta (lib/heist/level.ts → baseProps e
 * as araras de RACKS). Cada peça é desenhada EXATAMENTE na forma de colisão (caixa ou círculo, giro e variante): o que se
 * vê é o que barra o passo e o olhar. Alturas seguem a regra da planta: "low" fica abaixo de ~1,1 m (esconde quem está
 * agachado), "tall" passa de 1,8 m (tapa a visão), "glass" é vitrine.
 *
 * Tudo vai para os lotes da sala (Batch: geometria mesclada por material; Instances: o que se repete) e devolve pontos de
 * luz (LightAnchor) para o conjunto de luzes dinâmicas do interior.
 */
import * as THREE from "three";
import type { Prop, RoomId } from "@/lib/heist/types";
import { Batch, BOX0, CYL, CYL0, Instances, SPH, geo, mat, mul } from "./interior-batch";
import { M, fabric, glass, glow, solid, type Palette } from "./interior-mats";
import { SANS, SERIF, drawSymbol, drawnTexture, fit, paper, rand, spaced, type Quality } from "./interior-tex";
import { candelabra, roseGeometry } from "./interior-hall";
import { canopyGeometry, dressFormParts, frondGeometry, frondMaterial, gownGeometry, gownMaterial, statueGeometry, type GownCut } from "./interior-dress";
import type { InteriorCopy } from "./interior-copy";
import type { InteriorRoom } from "./interior-shell";
import { CODES, RING_SYMBOLS } from "@/lib/heist/level";

export interface LightAnchor { x: number; y: number; z: number; color: string; intensity: number; distance: number; room: InteriorRoom; flicker?: number; alarm?: boolean }
export interface PropsCtx {
  q: Quality; P: Palette; batch: Batch; inst: Instances; copy: InteriorCopy; anchors: LightAnchor[]; flames: THREE.Vector3[];
  /** malhas que animam (telas, monitores, vapor) e o diamante */
  animated: { kind: "screen" | "cctv" | "steam" | "diamond" | "glint"; mesh: THREE.Object3D; room: InteriorRoom }[];
  group: THREE.Group;
}

/** Pegada do móvel no referencial dele: largura (x local), profundidade (z local, a frente olha para +z local) e giro. */
interface Foot { cx: number; cz: number; w: number; d: number; yaw: number; r: number }
export function foot(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw, r: p.shape.r };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw, r: Math.min(sx, sz) / 2 };
}
/** Matriz no referencial do móvel: (x, y, z) locais, giro local, escala. */
const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
const worldOf = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
const box = (c: PropsCtx, room: string, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: { cast?: boolean; ry?: number } = {}) =>
  c.batch.add(room, m, BOX0(), L(f, x, y, z, o.ry ?? 0, sx, sy, sz), { cast: o.cast });
const cyl = (c: PropsCtx, room: string, m: THREE.Material, f: Foot, x: number, y: number, z: number, r: number, h: number, seg = 20) => c.batch.add(room, m, CYL0(seg), L(f, x, y, z, 0, r, h, r));
const anchor = (c: PropsCtx, room: InteriorRoom, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room, ...o });

/* ---------- geometrias compartilhadas ---------- */
const lathe = (key: string, pts: [number, number][], seg = 24) => geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/** Fuste canelado (24 caneluras) de 1 m de altura e raio 1 — escalado por coluna. */
const flutedShaft = () => geo("fluted", () => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0); const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.045 * Math.max(0, Math.cos(a * 24)) ** 0.6; p.setXYZ(i, x * k, p.getY(i), z * k); }
  g.computeVertexNormals(); return g;
});
const flute = () => lathe("flute", [[0, 0], [0.032, 0.005], [0.006, 0.02], [0.004, 0.12], [0.03, 0.2], [0.034, 0.27], [0.0, 0.28]], 14);
const coupe = () => lathe("coupe", [[0, 0], [0.04, 0.004], [0.005, 0.015], [0.004, 0.09], [0.05, 0.11], [0.055, 0.14], [0.0, 0.14]], 14);
const bottle = () => lathe("bottle", [[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.2], [0.03, 0.25], [0.014, 0.29], [0.014, 0.33], [0, 0.33]], 12);
const urn = () => lathe("urn", [[0.0, 0], [0.24, 0], [0.26, 0.04], [0.2, 0.1], [0.32, 0.3], [0.42, 0.52], [0.44, 0.58], [0.4, 0.6], [0.0, 0.6]], 28);

/* ---------- textos desenhados dos móveis ---------- */
function screenTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`ledwall-${copy.screenB}`, 1024, 600, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, "#1a0420"); bg.addColorStop(0.5, "#43103d"); bg.addColorStop(1, "#0a0618"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 220; k++) { const x = (k * 97) % w, y = (k * 53) % h; g.fillStyle = `rgba(255,${200 + (k % 50)},${180 + (k % 70)},${0.08 + (k % 7) * 0.02})`; g.beginPath(); g.arc(x, y, 1 + (k % 3), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f6dfaa"; g.textAlign = "center"; g.textBaseline = "middle";
    fit(g, copy.screenA, (p) => `600 ${p}px ${SERIF}`, 120, w * 0.8); spaced(g, copy.screenA, w / 2, h * 0.42, 14);
    g.font = `400 ${Math.round(h * 0.07)}px ${SERIF}`; spaced(g, copy.screenB, w / 2, h * 0.64, 8);
    g.strokeStyle = "rgba(246,223,170,0.5)"; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.3, h * 0.53); g.lineTo(w * 0.7, h * 0.53); g.stroke();
  });
}
/** Folha de chamada sobre a mesa da produção (pista do teclado da doca e do cofre da segurança). */
export function callSheetTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`callsheet-${copy.sheetTitle}`, 600, 820, (g, w, h) => {
    paper(g, w, h, [0.95, 0.94, 0.9], 7);
    g.fillStyle = "#1c1c1c"; g.textBaseline = "top"; g.textAlign = "left";
    fit(g, copy.sheetTitle, (p) => `700 ${p}px ${SANS}`, 30, w - 60); g.fillText(copy.sheetTitle, 30, 30);
    g.font = `400 22px ${SANS}`; g.fillStyle = "#444"; g.fillText(copy.sheetDate, 30, 74);
    g.fillStyle = "#222"; g.fillRect(30, 108, w - 60, 2);
    g.font = `500 24px ${SANS}`; copy.sheetRows.forEach((r, i) => { g.fillStyle = "#222"; g.fillText(r, 30, 128 + i * 40); });
    // anotações à mão (as pistas): marcador vermelho, sublinhadas
    g.font = `600 34px 'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'DejaVu Sans', cursive`; g.fillStyle = "#b3121e";
    g.save(); g.translate(40, 380); g.rotate(-0.03); g.fillText(copy.sheetNoteDock, 0, 0); g.fillRect(0, 44, Math.min(w - 80, g.measureText(copy.sheetNoteDock).width), 4); g.restore();
    g.save(); g.translate(40, 470); g.rotate(0.02); g.fillText(copy.sheetNoteSafe, 0, 0); g.fillRect(0, 44, Math.min(w - 80, g.measureText(copy.sheetNoteSafe).width), 4); g.restore();
    g.font = `400 22px ${SANS}`; g.fillStyle = "#555"; g.fillText(copy.sheetRadio, 30, h - 70);
    g.strokeStyle = "rgba(120,80,40,0.25)"; g.lineWidth = 10; g.beginPath(); g.arc(w - 120, h - 140, 52, 0, Math.PI * 2); g.stroke();   // marca de copo de café
  });
}
/** Placa da exposição diante da vitrine (a ordem dos símbolos da vitrine do diamante). */
export function placardTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`placard-${copy.placardTitle}`, 800, 520, (g, w, h) => {
    g.fillStyle = "#14110f"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8924a"; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = "#d8b46a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `500 26px ${SERIF}`; spaced(g, copy.placardKicker, w / 2, 62, 8);
    fit(g, copy.placardTitle, (p) => `600 ${p}px ${SERIF}`, 40, w - 90); g.fillStyle = "#f2e6cf"; g.fillText(copy.placardTitle, w / 2, 118);
    g.font = `italic 400 24px ${SERIF}`; g.fillStyle = "#cbbd9f"; g.fillText(copy.placardLine, w / 2, 164);
    g.font = `500 22px ${SANS}`; g.fillStyle = "#b8924a"; spaced(g, copy.placardSeal.toUpperCase(), w / 2, 224, 4);
    // a ordem: ★ ☾ ♛ (CODES.rings sobre RING_SYMBOLS), com o nome embaixo
    const order = CODES.rings.map((i) => RING_SYMBOLS[i]);
    order.forEach((sym, k) => {
      const x = w / 2 + (k - 1) * 210, y = 330;
      g.strokeStyle = "#b8924a"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 66, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#f3d58e"; drawSymbol(g, sym, x, y, 40);
      g.fillStyle = "#e9dcc0"; g.font = `500 22px ${SANS}`; g.fillText(copy.placardSymbols[k], x, y + 100);
      g.fillStyle = "#8d7a55"; g.font = `600 20px ${SANS}`; g.fillText(String(k + 1), x, y - 92);
    });
  });
}
function labelTexture(text: string, sub = ""): THREE.Texture {
  return drawnTexture(`label-${text}-${sub}`, 512, 256, (g, w, h) => {
    g.fillStyle = "#f1ece2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1d1b18"; g.textAlign = "left"; g.textBaseline = "top";
    fit(g, text, (p) => `600 ${p}px ${SERIF}`, 40, w - 50); g.fillText(text, 26, 40);
    if (sub) { g.font = `400 26px ${SANS}`; g.fillStyle = "#555"; g.fillText(sub, 26, 120); }
  });
}
/** Imagens das câmeras de segurança (corredores, vitrines) em verde-monocromático com carimbo de hora. */
export function cctvTexture(k: number): THREE.CanvasTexture {
  return drawnTexture(`cctv-${k}`, 320, 200, (g, w, h) => {
    const R = rand(400 + k);
    g.fillStyle = "#06120b"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,220,160,0.55)"; g.lineWidth = 2;
    // perspectiva de corredor/sala: pontos de fuga e caixas
    const vx = w * (0.35 + R() * 0.3), vy = h * (0.35 + R() * 0.2);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(vx, vy); g.stroke(); }
    for (let i = 0; i < 4; i++) { const s = 0.2 + i * 0.2; g.strokeRect(vx - w * s * 0.5, vy - h * s * 0.5, w * s, h * s); }
    for (let i = 0; i < 3; i++) { const x = R() * w, y = h * (0.55 + R() * 0.3); g.fillStyle = "rgba(160,255,190,0.35)"; g.fillRect(x, y - 30, 10, 30); g.beginPath(); g.arc(x + 5, y - 36, 6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#9cffbe"; g.font = "600 14px monospace"; g.fillText(`CAM ${String(k + 1).padStart(2, "0")}`, 10, 18); g.fillText("23:0" + (k % 10) + ":14", w - 86, h - 10);
    g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(w - 16, 14, 5, 0, Math.PI * 2); g.fill();
  }) as THREE.CanvasTexture;
}

/* ======================= construtores por tipo ======================= */
export function buildProp(p: Prop, c: PropsCtx) {
  const f = foot(p), room = p.room as InteriorRoom, P = c.P;
  switch (p.kind) {
    case "column": return column(c, room, f);
    case "table": return p.room === "lounge" ? sideTable(c, room, f) : cocktailTable(c, room, f, p.id);
    case "stage": return p.variant === 1 ? quartetStage(c, room, f) : runwayStage(c, room, f);
    case "screen": return p.room === "bastidores" ? monitorWall(c, room, f) : ledWall(c, room, f);
    case "desk": return desk(c, room, f, p.variant ?? 0);
    case "sofa": return sofa(c, room, f, p.room === "terraco" ? P.canvasWhite : p.room === "lounge" ? fabric("loungeVelvet", "#3b1f52", c.q) : P.velvetRose);
    case "planter": return planter(c, room, f, p.id);
    case "bar": return bar(c, room, f);
    case "mirror": return p.room === "bastidores" ? makeupMirror(c, room, f) : wallMirror(c, room, f);
    case "piano": return piano(c, room, f);
    case "steamer": return steamer(c, room, f);
    case "mannequin": return mannequin(c, room, f, p.id);
    case "case": return p.room === "cofre" ? jewelCase(c, room, f, p.id) : vitrine(c, room, f, p.variant ?? 0, p.id);
    case "bench": return bench(c, room, f);
    case "statue": return statue(c, room, f, p.id);
    case "pedestal": return pedestal(c, room, f);
    case "monitor": return monitorDesk(c, room, f);
    case "safe": return safe(c, room, f);
    case "panel": return fusePanel(c, room, f);
    case "crate": return crate(c, room, f, p.height, p.variant ?? 0, p.id);
    case "coatcheck": return coatCheck(c, room, f);
    case "detector": return detector(c, room, f);
    case "rope": return rope(c, room, f);
    case "rack": return rack(c, room, f, p.id);
    case "floral": return;                                                       // a instalação floral é de interior-hall
    default: box(c, room, P.black, f, 0, 0, 0, f.w, 1, f.d);
  }
}

/** Coluna coríntia do salão: plinto, base, fuste canelado e capitel dourado até o entablamento (5 m). */
function column(c: PropsCtx, room: string, f: Foot) {
  const P = c.P, r = f.r * 0.86;
  box(c, room, P.marbleDark, f, 0, 0, 0, f.r * 1.84, 0.32, f.r * 1.84, { cast: true });
  c.batch.add(room, P.stone, lathe("colBase", [[0, 0], [1.02, 0], [1.05, 0.06], [0.98, 0.12], [1.0, 0.16], [0.92, 0.2], [0.0, 0.2]], 40), L(f, 0, 0.32, 0, 0, r, 1, r));
  c.batch.add(room, P.stone, flutedShaft(), L(f, 0, 0.52, 0, 0, r * 0.98, 3.9, r * 0.98), { cast: true });
  c.batch.add(room, P.gold, lathe("colNeck", [[1, 0], [1.02, 0.03], [1.0, 0.07], [0, 0.07]], 40), L(f, 0, 4.42, 0, 0, r, 1, r));
  c.batch.add(room, P.stone, lathe("colCap", [[0.98, 0], [1.08, 0.18], [1.22, 0.36], [1.32, 0.46], [0, 0.46]], 40), L(f, 0, 4.48, 0, 0, r, 1, r));
  // folhas de acanto douradas (anel de folhas) e o ábaco
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.inst.add(room, "acanthus", geo("acanthusLeaf", () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI, 0, Math.PI / 2).scale(0.09, 0.22, 0.05)), P.gold, L(f, Math.cos(a) * r * 1.08, 4.55, Math.sin(a) * r * 1.08, -a + Math.PI / 2, 1, 1, 1, -0.25)); }
  box(c, room, P.stone, f, 0, 4.94, 0, r * 2.9, 0.08, r * 2.9);
}

/** Mesa alta de coquetel com capa de linho atada, vela no globo de vidro, taças e um buquê de rosas. */
function cocktailTable(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 97 + id.charCodeAt(id.length - 1));
  c.batch.add(room, P.brass, CYL0(24), L(f, 0, 0, 0, 0, 0.28, 0.03, 0.28));
  c.batch.add(room, P.linen, lathe("cocktailSkirt", [[0.44, 1.1], [0.435, 1.04], [0.34, 0.86], [0.2, 0.62], [0.215, 0.55], [0.3, 0.35], [0.4, 0.12], [0.45, 0.02], [0.0, 0.02]], 36), L(f, 0, 0, 0), { cast: true });
  c.batch.add(room, P.linen, CYL0(36), L(f, 0, 1.08, 0, 0, 0.445, 0.03, 0.445));
  c.batch.add(room, P.gold, geo("sash", () => new THREE.TorusGeometry(0.21, 0.018, 6, 24).rotateX(Math.PI / 2)), L(f, 0, 0.58, 0));
  // vela no globo, taças e rosas
  c.batch.add(room, P.glass, CYL(20), L(f, 0, 1.2, 0, 0, 0.07, 0.18, 0.07));
  c.inst.add(room, "candle", CYL0(10), P.candle, L(f, 0, 1.11, 0, 0, 0.035, 0.1, 0.035));
  c.inst.add(room, "flame", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, L(f, 0, 1.235, 0, 0, 0.012));
  c.flames.push(worldOf(f, 0, 1.235, 0));
  const n = 2 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2, d = 0.18 + R() * 0.16; c.inst.add(room, "flute", flute(), P.glass, L(f, Math.cos(a) * d, 1.11, Math.sin(a) * d)); c.inst.add(room, "fluteWine", geo("fluteWine", () => new THREE.CylinderGeometry(0.026, 0.008, 0.08, 10).translate(0, 0.17, 0)), P.champagne, L(f, Math.cos(a) * d, 1.11, Math.sin(a) * d)); }
  const rose = roseGeometry(c.q), roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.inst.add(room, "rose", rose, roseMat, L(f, -0.2 + Math.cos(a) * 0.05, 1.12 + (k === 0 ? 0.04 : 0), 0.18 + Math.sin(a) * 0.05, a, 0.045), new THREE.Color(k % 2 ? "#f4c3cf" : "#f3ece0")); }
  anchor(c, room, worldOf(f, 0, 1.3, 0), "#ffb46b", 2.2, 3.2, { flicker: 1 });
}
/** Mesa lateral do lounge: tampo de mármore, pé de latão e abajur com cúpula plissada. */
function sideTable(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.brass, lathe("sideBase", [[0, 0], [0.22, 0], [0.22, 0.02], [0.04, 0.05], [0.035, 0.52], [0.0, 0.52]], 20), L(f, 0, 0, 0));
  c.batch.add(room, P.marbleDark, CYL0(28), L(f, 0, 0.52, 0, 0, f.r * 0.92, 0.035, f.r * 0.92));
  c.batch.add(room, P.brass, lathe("lampBase", [[0, 0], [0.07, 0], [0.09, 0.08], [0.05, 0.2], [0.012, 0.3], [0.0, 0.3]], 16), L(f, 0.08, 0.555, 0));
  c.batch.add(room, fabric("lampShade", "#e8d2a4", c.q, { side: THREE.DoubleSide }), lathe("shade", [[0.16, 0], [0.09, 0.2], [0.0, 0.2]], 24), L(f, 0.08, 0.83, 0));
  c.inst.add(room, "lampGlow", SPH(10), glow("lampGlow", "#ffd29a", 2), L(f, 0.08, 0.9, 0, 0, 0.05));
  c.inst.add(room, "coupe", coupe(), P.glass, L(f, -0.15, 0.555, 0.08));
  anchor(c, room, worldOf(f, 0.08, 0.95, 0), "#ffc781", 4, 4.5);
}

/** Palco da apresentação (0,6 m): tablado laqueado, saia de veludo, fita de LED na borda e treliça com refletores. */
function runwayStage(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, h = 0.6;
  box(c, room, P.velvetBlack, f, 0, 0, 0, f.w, h - 0.04, f.d, { cast: true });
  box(c, room, P.lacquer, f, 0, h - 0.04, 0, f.w + 0.04, 0.04, f.d + 0.04);
  c.inst.add(room, "stageLed", BOX0(), glow("stageLed", "#ffe1b3", 2.4), L(f, 0, h - 0.02, f.d / 2 + 0.025, 0, f.w, 0.012, 0.012));
  // pedestal do microfone e retorno de palco
  c.batch.add(room, P.chrome, CYL0(8), L(f, -0.6, h, 0.8, 0, 0.01, 1.4, 0.01)); c.batch.add(room, P.black, SPH(10), L(f, -0.6, h + 1.42, 0.8, 0, 0.03));
  box(c, room, P.black, f, 0.9, h, 1.1, 0.5, 0.3, 0.35, { ry: 0.3 });
  // treliça sobre o palco com quatro refletores apontando para a plateia
  for (const x of [-f.w / 2 + 0.15, f.w / 2 - 0.15]) box(c, room, P.steel, f, x, 0, -f.d / 2 + 0.2, 0.12, 4.6, 0.12);
  box(c, room, P.steel, f, 0, 4.5, -f.d / 2 + 0.2, f.w, 0.16, 0.16);
  for (let k = 0; k < 4; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 4);
    c.batch.add(room, P.black, CYL(14), L(f, x, 4.3, -f.d / 2 + 0.35, 0, 0.12, 0.3, 0.12, 0.6));
    c.inst.add(room, "parLens", geo("parLens", () => new THREE.CircleGeometry(0.1, 16)), glow("parLens", "#fff1d6", 3), L(f, x, 4.23, -f.d / 2 + 0.47, 0, 1, 1, 1, 0.6 - Math.PI / 2 + Math.PI / 2));
    anchor(c, room, worldOf(f, x, 4.1, -f.d / 2 + 0.8), "#ffe6c0", 16, 9);
  }
}
/** Tablado do quarteto de cordas (0,3 m): carpete, quatro cadeiras douradas, estantes de partitura e o estojo do violoncelo. */
function quartetStage(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, h = 0.3;
  box(c, room, P.velvetBlack, f, 0, 0, 0, f.w, h - 0.03, f.d, { cast: true });
  box(c, room, fabric("quartetCarpet", "#4a0f1d", c.q), f, 0, h - 0.03, 0, f.w + 0.02, 0.03, f.d + 0.02);
  for (let k = 0; k < 4; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 4), z = -0.25 - (k === 0 || k === 3 ? 0 : 0.35);
    // estante de partitura com a folha
    c.batch.add(room, P.black, CYL0(6), L(f, x, h, z + 0.6, 0, 0.008, 1.0, 0.008));
    box(c, room, P.black, f, x, h + 0.98, z + 0.62, 0.42, 0.28, 0.01, { ry: 0 });
    box(c, room, P.paperWhite, f, x, h + 1.0, z + 0.605, 0.38, 0.24, 0.006);
  }
  c.batch.add(room, P.lacquer, geo("celloCase", () => new THREE.CapsuleGeometry(0.2, 0.9, 4, 12).scale(1, 1, 0.55)), L(f, f.w / 2 - 0.25, h + 0.65, -f.d / 2 + 0.3, 0, 1, 1, 1, 0.2));
  anchor(c, room, worldOf(f, 0, 2.6, 0.5), "#ffcf96", 6, 5);
}

/** Telão de LED no norte do salão (moldura preta, imagem emissiva que respira). */
function ledWall(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.black, f, 0, 0.9, 0, f.w + 0.1, 3.2, f.d, { cast: true });
  const m = new THREE.MeshBasicMaterial({ map: screenTexture(c.copy), toneMapped: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), m); mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(L(f, 0, 2.5, f.d / 2 + 0.006, 0, f.w - 0.12, 2.9, 1)); c.group.add(mesh); mesh.userData.room = room;
  c.animated.push({ kind: "screen", mesh, room });
  anchor(c, room, worldOf(f, 0, 2.5, 1.2), "#c86cff", 5, 7);
}
/** Parede de monitores da produção nos bastidores (circuito de câmeras do palco). */
function monitorWall(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  for (let k = 0; k < 3; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 3);
    box(c, room, P.black, f, x, 1.3, 0, f.w / 3 - 0.08, 0.62, f.d);
    const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(10 + k), color: new THREE.Color(1.3, 1.3, 1.3) }));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(L(f, x, 1.61, f.d / 2 + 0.004, 0, f.w / 3 - 0.14, 0.52, 1)); c.group.add(mesh); mesh.userData.room = room;
    c.animated.push({ kind: "cctv", mesh, room });
  }
  anchor(c, room, worldOf(f, 0, 1.6, 0.8), "#9fd8ff", 1.6, 3);
}

/** Mesas: recepção (vestíbulo), produção e monitores (bastidores), camarim. */
function desk(c: PropsCtx, room: InteriorRoom, f: Foot, variant: number) {
  const P = c.P;
  if (room === "vestibulo") {
    // balcão de recepção curvo: frente de nogueira com frisos de latão, tampo de mármore, tablet, buquê e luminária
    box(c, room, P.walnut, f, 0, 0, 0, f.w, 1.02, f.d, { cast: true });
    for (const y of [0.18, 0.95]) box(c, room, P.brass, f, 0, y, f.d / 2 + 0.002, f.w, 0.02, 0.01);
    box(c, room, P.marbleWhite, f, 0, 1.02, 0, f.w + 0.06, 0.04, f.d + 0.06);
    box(c, room, P.plasticDark, f, -0.5, 1.06, -0.05, 0.25, 0.012, 0.18, { ry: 0.2 });
    c.batch.add(room, P.glass, CYL0(16), L(f, 0.75, 1.06, -0.05, 0, 0.07, 0.25, 0.07));
    const rose = roseGeometry(c.q), roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
    for (let k = 0; k < 9; k++) { const a = k * 2.4, d = 0.03 + (k % 3) * 0.04; c.inst.add(room, "rose", rose, roseMat, L(f, 0.75 + Math.cos(a) * d, 1.33 + (k % 2) * 0.03, -0.05 + Math.sin(a) * d, a, 0.05), new THREE.Color(["#f4c3cf", "#f3ece0", "#c0304f"][k % 3])); }
    c.batch.add(room, P.brass, lathe("bankerLamp", [[0, 0], [0.09, 0], [0.09, 0.02], [0.012, 0.03], [0.012, 0.32], [0, 0.32]], 14), L(f, 0.1, 1.06, -0.12));
    c.batch.add(room, solid("bankerShade", "#0d4a2e", { rough: 0.25, env: 1 }), geo("bankerShadeGeo", () => new THREE.CylinderGeometry(0.03, 0.12, 0.09, 18, 1, true)), L(f, 0.1, 1.4, -0.12, 0, 1, 1, 1, 0.1));
    anchor(c, room, worldOf(f, 0.1, 1.3, 0.2), "#ffd9a0", 3, 3);
    return;
  }
  if (variant === 4) {
    // bancada do camarim: tampo branco, gavetas, maquiagem, secador e escovas
    box(c, room, P.plasticDark, f, 0, 0, 0, f.w, 0.76, f.d, { cast: true });
    box(c, room, P.marbleWhite, f, 0, 0.76, 0, f.w + 0.02, 0.03, f.d + 0.02);
    const R = rand(77);
    for (let k = 0; k < 18; k++) { const x = (R() - 0.5) * (f.w - 0.2), z = (R() - 0.5) * (f.d - 0.2); c.inst.add(room, "makeup", k % 3 ? CYL0(8) : BOX0(), k % 2 ? P.black : P.goldBright, L(f, x, 0.79, z, R() * 3, 0.02 + R() * 0.02, 0.05 + R() * 0.1, 0.02 + R() * 0.02)); }
    return;
  }
  if (room === "bastidores" && variant === 1) {
    // mesa da produção diante dos monitores: notebooks, rádios, café
    box(c, room, P.black, f, 0, 0.72, 0, f.w, 0.04, f.d, { cast: true });
    for (const x of [-f.w / 2 + 0.06, f.w / 2 - 0.06]) for (const z of [-f.d / 2 + 0.06, f.d / 2 - 0.06]) box(c, room, P.darkSteel, f, x, 0, z, 0.04, 0.72, 0.04);
    for (const x of [-0.8, 0.5]) { box(c, room, P.darkSteel, f, x, 0.76, 0.05, 0.34, 0.02, 0.24); box(c, room, glow("laptopScreen", "#9fc6ff", 1.4), f, x, 0.77, -0.07, 0.32, 0.22, 0.01, { ry: 0 }); }
    for (let k = 0; k < 3; k++) c.inst.add(room, "radio", BOX0(), P.black, L(f, -0.2 + k * 0.12, 0.76, 0.15, 0, 0.06, 0.2, 0.04));
    c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, 1.0, 0.76, 0.1, 0, 0.04, 0.11, 0.04));
    return;
  }
  // mesa da produção nos bastidores (a da folha de chamada): mesa dobrável preta, notebook, roteiro, a folha de chamada
  box(c, room, P.black, f, 0, 0.72, 0, f.w, 0.04, f.d, { cast: true });
  for (const x of [-f.w / 2 + 0.06, f.w / 2 - 0.06]) for (const z of [-f.d / 2 + 0.06, f.d / 2 - 0.06]) box(c, room, P.darkSteel, f, x, 0, z, 0.04, 0.72, 0.04);
  box(c, room, P.darkSteel, f, 0.6, 0.76, 0, 0.34, 0.02, 0.24);
  box(c, room, glow("laptopScreen", "#9fc6ff", 1.4), f, 0.6, 0.77, -0.12, 0.32, 0.22, 0.01);
  // a folha de chamada voltada para o lado de quem chega (sul, z +): bem legível
  const sheet = new THREE.MeshStandardMaterial({ map: callSheetTexture(c.copy), roughness: 0.9, emissiveMap: callSheetTexture(c.copy), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 });
  c.batch.add(room, sheet, geo("planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), L(f, -0.05, 0.765, -0.24, Math.PI, 0.3, 1, 0.41));
  c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, -0.6, 0.76, 0.1, 0, 0.04, 0.11, 0.04));
  c.batch.add(room, P.black, lathe("deskLamp", [[0, 0], [0.08, 0], [0.08, 0.02], [0.01, 0.03], [0.01, 0.45], [0, 0.45]], 12), L(f, -0.95, 0.76, -0.2));
  c.batch.add(room, P.black, geo("deskLampHead", () => new THREE.ConeGeometry(0.08, 0.14, 16, 1, true)), L(f, -0.9, 1.18, -0.1, 0, 1, 1, 1, 2.2));
  anchor(c, room, worldOf(f, -0.6, 1.1, 0.1), "#fff0d0", 3, 2.8);
}

/** Sofá de veludo: base, encosto, braços, almofadas e pés de latão. */
function sofa(c: PropsCtx, room: InteriorRoom, f: Foot, cover: THREE.Material) {
  const P = c.P, w = f.w, d = f.d;
  box(c, room, cover, f, 0, 0.12, 0.04, w - 0.2, 0.3, d - 0.12, { cast: true });
  box(c, room, cover, f, 0, 0.12, -d / 2 + 0.12, w, 0.72, 0.24, { cast: true });
  for (const s of [-1, 1]) box(c, room, cover, f, s * (w / 2 - 0.1), 0.12, 0.04, 0.2, 0.48, d - 0.12);
  const n = Math.max(2, Math.round((w - 0.4) / 0.7));
  for (let k = 0; k < n; k++) { const x = -w / 2 + 0.2 + (k + 0.5) * ((w - 0.4) / n); c.batch.add(room, cover, geo("cushion", () => new THREE.CapsuleGeometry(0.1, 0.4, 4, 8).rotateZ(Math.PI / 2).scale(1, 1.1, 2.8)), L(f, x, 0.48, 0.05, 0, ((w - 0.4) / n) / 0.62, 1, (d - 0.3) / 0.56)); }
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) c.inst.add(room, "sofaLeg", CYL0(8), P.brass, L(f, x, 0, z, 0, 0.025, 0.12, 0.025));
}

/** Vaso: urna dourada com palmeira (salão, vestíbulo) ou jardineira de pedra com oliveira podada (terraço). */
function planter(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 13 + id.charCodeAt(id.length - 1));
  if (room === "terraco") {
    c.batch.add(room, P.stone, lathe("terrPlanter", [[0, 0], [0.98, 0], [1, 0.05], [0.95, 0.6], [1.02, 0.66], [1.0, 0.72], [0, 0.72]], 32), L(f, 0, 0, 0, 0, f.r, 1, f.r), { cast: true });
    c.batch.add(room, P.soil, CYL0(24), L(f, 0, 0.68, 0, 0, f.r * 0.9, 0.03, f.r * 0.9));
    c.batch.add(room, P.bark, geo("oliveTrunk", () => new THREE.CylinderGeometry(0.05, 0.09, 1.4, 8).translate(0, 0.7, 0)), L(f, 0, 0.7, 0, 0, 1, 1, 1, 0.08));
    c.batch.add(room, solid("olive", "#4b6a3d", { rough: 0.85 }), canopyGeometry(7 + (id.length % 3)), L(f, 0.05, 1.9, 0, R() * 3, 1.2));
    return;
  }
  c.batch.add(room, P.gold, urn(), L(f, 0, 0, 0, 0, f.r / 0.44, 1, f.r / 0.44), { cast: true });
  c.batch.add(room, P.soil, CYL0(20), L(f, 0, 0.57, 0, 0, f.r * 0.88, 0.02, f.r * 0.88));
  const frond = frondGeometry(), fm = frondMaterial();
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + R() * 0.3, tilt = 0.25 + R() * 0.55; c.inst.add(room, "frond", frond, fm, L(f, 0, 0.6, 0, a, 0.9 + R() * 0.5, 1.1 + R() * 0.7, 1, -tilt)); }
  for (let k = 0; k < 5; k++) c.batch.add(room, P.bark, CYL0(6), L(f, (R() - 0.5) * 0.1, 0.58, (R() - 0.5) * 0.1, 0, 0.018, 0.5 + R() * 0.6, 0.018, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2));
}

/** Bar do lounge: frente de mogno em almofadas com filetes dourados, tampo de mármore negro, trilho de latão, taças. */
function bar(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, w = f.w, d = f.d, h = 1.08;
  box(c, room, P.mahogany, f, 0, 0, 0, w, h - 0.05, d, { cast: true });
  // almofadas da frente (lado +z local = frente, para o salão), com moldura dourada como na referência
  const panels = Math.round(w / 1.0);
  for (let k = 0; k < panels; k++) {
    const x = -w / 2 + (k + 0.5) * (w / panels), pw = w / panels - 0.16;
    box(c, room, P.walnut, f, x, 0.16, d / 2, pw, h - 0.42, 0.02);
    for (const [px, py, sx, sy] of [[x, 0.16, pw, 0.02], [x, h - 0.28, pw, 0.02], [x - pw / 2, 0.16, 0.02, h - 0.42], [x + pw / 2, 0.16, 0.02, h - 0.42]] as [number, number, number, number][]) box(c, room, P.gold, f, px, py, d / 2 + 0.012, sx, sy, 0.012);
  }
  box(c, room, P.marbleDark, f, 0, h - 0.05, 0.03, w + 0.12, 0.05, d + 0.16);
  c.batch.add(room, P.brass, CYL(10), L(f, 0, 0.18, d / 2 + 0.14, 0, 0.022, w, 0.022, 0, Math.PI / 2));                 // descanso de pés
  box(c, room, glow("barUnderglow", "#ffb05a", 1.6), f, 0, 0.04, d / 2 + 0.01, w, 0.012, 0.012);
  const R = rand(5);
  for (let k = 0; k < 9; k++) c.inst.add(room, k % 2 ? "coupe" : "flute", k % 2 ? coupe() : flute(), P.glass, L(f, -w / 2 + 0.3 + R() * (w - 0.6), h, 0.05 + (R() - 0.5) * 0.2));
  for (let k = 0; k < 3; k++) c.inst.add(room, "bottle", bottle(), [P.bottleGreen, P.bottleAmber, P.bottleClear][k], L(f, -w / 2 + 1 + k * 1.8, h, -0.15, 0, 1.2));
  c.batch.add(room, P.chrome, CYL0(12), L(f, 0.8, h, -0.2, 0, 0.06, 0.22, 0.06));                                           // balde de gelo
  for (let k = 0; k < 3; k++) anchor(c, room, worldOf(f, -w / 2 + (k + 0.5) * (w / 3), 1.6, -0.6), "#ffb867", 5, 3.6);
}

/** Espelho dourado do lounge e o espelho de camarim com lâmpadas dos bastidores. */
function wallMirror(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.gold, f, 0, 0.35, 0, f.w, 2.6, f.d * 0.6, { cast: true });
  box(c, room, P.mirror, f, 0, 0.47, f.d * 0.3, f.w - 0.22, 2.36, 0.01);
  c.batch.add(room, P.gold, geo("mirrorCrest", () => new THREE.TorusGeometry(0.3, 0.05, 8, 24, Math.PI)), L(f, 0, 2.95, f.d * 0.3));
}
function makeupMirror(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, n = 3;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / n), mw = f.w / n - 0.12;
    box(c, room, P.black, f, x, 1.0, 0, mw + 0.1, 1.1, f.d * 0.5);
    box(c, room, P.mirror, f, x, 1.05, f.d * 0.25, mw - 0.1, 1.0, 0.01);
    for (let b = 0; b < 5; b++) for (const s of [-1, 1]) c.inst.add(room, "vanityBulb", SPH(8), P.bulbWarm, L(f, x + s * (mw / 2 + 0.01), 1.12 + b * 0.22, f.d * 0.3, 0, 0.035));
    for (let b = 0; b < 4; b++) c.inst.add(room, "vanityBulb", SPH(8), P.bulbWarm, L(f, x - mw / 2 + (b + 0.5) * (mw / 4), 2.1, f.d * 0.3, 0, 0.035));
    anchor(c, room, worldOf(f, x, 1.7, 0.6), "#ffdcaa", 4, 3);
  }
}

/** Piano de cauda laqueado com tampa aberta, estante, pernas torneadas e banqueta. */
function piano(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, w = f.w, d = f.d;
  const body = geo("pianoBody", () => {
    const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.05); s.bezierCurveTo(0.5, 0.35, 0.2, 0.25, 0.1, 0.5); s.lineTo(-0.5, 0.5); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 20 }).rotateX(-Math.PI / 2);
  });
  c.batch.add(room, P.lacquer, body, L(f, 0, 0.66, 0, Math.PI, w, 1, d), { cast: true });
  // tampa aberta (aprox. 40°) e o suporte
  c.batch.add(room, P.lacquer, geo("pianoLid", () => { const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.05); s.bezierCurveTo(0.5, 0.35, 0.2, 0.25, 0.1, 0.5); s.lineTo(-0.5, 0.5); s.closePath(); return new THREE.ShapeGeometry(s, 20).rotateX(-Math.PI / 2); }), L(f, 0.02, 0.97, 0, Math.PI, w, 1, d, 0, -0.7));
  c.batch.add(room, P.black, CYL(6), L(f, -0.1, 1.15, 0.1, 0, 0.01, 0.42, 0.01));
  box(c, room, P.black, f, 0, 0.66, d / 2 - 0.1, w * 0.85, 0.12, 0.2);
  c.batch.add(room, solid("ivory", "#f2ede0", { rough: 0.3 }), BOX0(), L(f, 0, 0.78, d / 2 - 0.08, 0, w * 0.82, 0.015, 0.14));
  for (const [x, z] of [[-w / 2 + 0.12, d / 2 - 0.12], [w / 2 - 0.12, d / 2 - 0.12], [0.1, -d / 2 + 0.15]]) c.batch.add(room, P.lacquer, lathe("pianoLeg", [[0.05, 0], [0.06, 0.05], [0.045, 0.3], [0.06, 0.55], [0.065, 0.66], [0, 0.66]], 12), L(f, x, 0, z));
}

/** Vaporizador de roupa: base com reservatório, haste, mangueira e cabeça, com vapor saindo. */
function steamer(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.plastic, CYL0(16), L(f, 0, 0, 0, 0, f.r * 0.9, 0.32, f.r * 0.9));
  c.batch.add(room, solid("tank", "#aac9d8", { rough: 0.2, transparent: true, opacity: 0.6 }), CYL0(16), L(f, 0, 0.32, 0, 0, f.r * 0.6, 0.18, f.r * 0.6));
  c.batch.add(room, P.chrome, CYL0(8), L(f, 0.05, 0.5, 0, 0, 0.012, 1.1, 0.012));
  c.batch.add(room, P.plasticDark, geo("hose", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.4, 0.05), new THREE.Vector3(0.2, 0.7, 0.2), new THREE.Vector3(0.05, 1.3, 0.12), new THREE.Vector3(0.06, 1.55, 0.05)]), 24, 0.02, 6)), L(f, 0, 0, 0));
  box(c, room, P.plastic, f, 0.06, 1.55, 0.04, 0.1, 0.16, 0.06);
  const steam = new THREE.Mesh(geo("steamGeo", () => new THREE.ConeGeometry(0.12, 0.6, 12, 1, true).translate(0, 0.3, 0)), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  steam.matrixAutoUpdate = false; steam.matrix.copy(L(f, 0.06, 1.72, 0.04)); c.group.add(steam); steam.userData.room = room; c.animated.push({ kind: "steam", mesh: steam, room });
}

const GOWNS: { cut: GownCut; color: string; stops?: string[]; sheen?: string }[] = [
  { cut: "ball", color: "#ffffff", stops: ["#a88bff", "#f3a3b8", "#fde7b8"], sheen: "#fff3e0" },         // Aurora (réplica de exposição)
  { cut: "column", color: "#0f1320", sheen: "#7d8cff" },                                                   // coluna de veludo
  { cut: "mermaid", color: "#8e0f24", sheen: "#ff9aa8" },                                                  // tule carmim
  { cut: "aline", color: "#d9c39a", sheen: "#fff4d6" },
  { cut: "mermaid", color: "#2f4f7a", sheen: "#c8dcff" },
  { cut: "ball", color: "#f2f0ea", sheen: "#ffffff" },
];
/** Busto de costura com um vestido (bastidores: looks do desfile final). */
function mannequin(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const k = (id.charCodeAt(id.length - 1) + 1) % GOWNS.length;
  dressForm(c, room, (x, y, z, ry = 0, s = 1) => L(f, x, y, z, ry, s), GOWNS[k], `bk${k}`);
}
function dressForm(c: PropsCtx, room: InteriorRoom, at: (x: number, y: number, z: number, ry?: number, s?: number) => THREE.Matrix4, g: (typeof GOWNS)[number], key: string, gown = true) {
  const P = c.P, parts = dressFormParts();
  c.batch.add(room, P.brass, parts.foot, at(0, 0, 0)); c.batch.add(room, P.brass, parts.pole, at(0, 0.04, 0));
  c.batch.add(room, solid("formLinen", "#d8cdb6", { rough: 0.9 }), parts.torso, at(0, 0, 0), { cast: true });
  c.batch.add(room, P.walnut, parts.neck, at(0, 0, 0));
  if (gown) c.batch.add(room, gownMaterial(key, g.color, { stops: g.stops, sheen: g.sheen }), gownGeometry(g.cut, c.q), at(0, 0.03, 0, 0, 1), { cast: true });
}

/** Vitrine do Instituto do Traje: plinto, cúpula de vidro, luz interna e as peças (vestidos em bustos ou chapéus e luvas). */
function vitrine(c: PropsCtx, room: InteriorRoom, f: Foot, variant: number, id: string) {
  const P = c.P, w = f.w, d = f.d, plinth = 0.45, top = 2.75;
  box(c, room, P.black, f, 0, 0, 0, w, plinth, d, { cast: true });
  box(c, room, P.brass, f, 0, plinth - 0.02, 0, w + 0.01, 0.02, d + 0.01);
  box(c, room, solid("vitrineFloor", "#1a1716", { rough: 0.6 }), f, 0, plinth, 0, w - 0.04, 0.005, d - 0.04);
  // vidro (cinco faces) e o forro iluminado em cima
  for (const [x, z, sx, sz] of [[0, d / 2, w, 0.01], [0, -d / 2, w, 0.01], [w / 2, 0, 0.01, d], [-w / 2, 0, 0.01, d]] as [number, number, number, number][]) box(c, room, P.glass, f, x, plinth, z, sx, top - plinth, sz);
  box(c, room, P.glass, f, 0, top - 0.005, 0, w, 0.01, d);
  box(c, room, P.black, f, 0, top, 0, w + 0.04, 0.12, d + 0.04);
  c.inst.add(room, "caseLight", BOX0(), glow("caseLight", "#fff2d8", 2.2), L(f, 0, top - 0.02, 0, 0, w - 0.3, 0.012, d - 0.3));
  if (variant === 3) {
    // chapéus e luvas sobre cabeças de feltro e mãos de exposição
    for (let k = 0; k < 2; k++) {
      const z = -d / 2 + (k + 0.5) * (d / 2);
      c.batch.add(room, P.black, CYL0(12), L(f, 0, plinth, z, 0, 0.04, 0.6, 0.04));
      c.batch.add(room, solid("feltHead", "#cfc3ad", { rough: 0.95 }), SPH(14), L(f, 0, plinth + 0.72, z, 0, 0.1, 0.13, 0.11));
      c.batch.add(room, k ? P.velvetBlack : P.velvetRose, lathe(`hat${k}`, k ? [[0.3, 0], [0.31, 0.01], [0.12, 0.02], [0.11, 0.12], [0.0, 0.14]] : [[0.22, 0], [0.22, 0.01], [0.1, 0.03], [0.1, 0.16], [0.0, 0.17]], 24), L(f, 0, plinth + 0.8, z, 0, 1, 1, 1, 0.15));
      c.batch.add(room, solid("glove", "#efe6d5", { rough: 0.7 }), geo("gloveGeo", () => new THREE.CapsuleGeometry(0.035, 0.32, 4, 8)), L(f, 0.25, plinth + 0.25, z, 0, 1, 1, 1, 0.5));
    }
  } else {
    const g = GOWNS[variant === 1 ? 0 : variant === 0 ? 1 : 2];
    dressForm(c, room, (x, y, z, ry = 0, s = 1) => L(f, x, plinth + y, z, ry + Math.PI * 0.06, s), g, `case${variant}`);
  }
  // plaquinha da peça no plinto (frente)
  const labels = c.copy.caseLabels, txt = labels[variant === 1 ? 0 : variant === 0 ? 1 : variant === 2 ? 2 : 3];
  const lm = new THREE.MeshStandardMaterial({ map: labelTexture(txt), roughness: 0.6 });
  c.batch.add(room, lm, geo("plane", () => new THREE.PlaneGeometry(1, 1)), L(f, w / 2 - 0.35, 0.3, d / 2 + 0.003, 0, 0.5, 0.25, 1));
  anchor(c, room, worldOf(f, 0, 2.2, 0), "#fff1dc", variant === 1 ? 9 : 5, 4.5);
  void id;
}

/** Vitrine de joias da Sala das Joias (parede): gabinete laqueado, veludo, colares e tiaras em bustos. */
function jewelCase(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, w = f.w, d = f.d, R = rand(id.length * 31 + id.charCodeAt(3));
  box(c, room, P.lacquer, f, 0, 0, 0, w, 0.9, d, { cast: true });
  box(c, room, P.velvetBlack, f, 0, 0.9, 0, w - 0.06, 0.02, d - 0.06);
  for (const [x, z, sx, sz] of [[0, d / 2, w, 0.01], [0, -d / 2, w, 0.01], [w / 2, 0, 0.01, d], [-w / 2, 0, 0.01, d]] as [number, number, number, number][]) box(c, room, P.glass, f, x, 0.9, z, sx, 0.75, sz);
  box(c, room, P.glass, f, 0, 1.65, 0, w, 0.01, d);
  box(c, room, P.brass, f, 0, 1.65, 0, w + 0.03, 0.04, d + 0.03);
  c.inst.add(room, "caseLight", BOX0(), glow("caseLight", "#fff2d8", 2.2), L(f, 0, 1.64, 0, 0, w - 0.1, 0.01, d - 0.1));
  const n = Math.max(1, Math.round(Math.max(w, d) / 0.55));
  const gem = geo("gem", () => new THREE.OctahedronGeometry(1, 0)), gold = P.goldBright;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n - 0.5, x = w > d ? t * w : 0, z = w > d ? 0 : t * d;
    // o busto olha para dentro da sala: vitrine encostada na parede oeste olha para +x, na norte para +z
    const face = d > w ? Math.PI / 2 : 0, fx = Math.sin(face), fz = Math.cos(face);
    c.batch.add(room, P.velvetBlack, geo("bust", () => new THREE.LatheGeometry([[0.0, 0], [0.11, 0], [0.12, 0.05], [0.07, 0.2], [0.05, 0.3], [0.0, 0.32]].map(([a, b]) => new THREE.Vector2(a, b)), 20).scale(1, 1, 0.7)), L(f, x, 0.92, z, face));
    // colar: arco de pedras na frente do busto
    for (let s = 0; s < 11; s++) { const a = Math.PI * (0.15 + 0.7 * (s / 10)), side = Math.cos(a) * 0.06; c.inst.add(room, "neckGem", gem, s === 5 ? solid("ruby", "#c2102a", { rough: 0.05, env: 2.5 }) : solid("gemWhite", "#ffffff", { rough: 0.02, env: 3 }), L(f, x + side * fz + fx * 0.07, 1.12 - Math.sin(a) * 0.03, z - side * fx + fz * 0.07, R(), s === 5 ? 0.016 : 0.009)); }
    c.inst.add(room, "tiara", geo("tiaraGeo", () => new THREE.TorusGeometry(0.06, 0.006, 6, 24, Math.PI)), gold, L(f, x, 1.24, z, face));
  }
  anchor(c, room, worldOf(f, 0, 1.5, 0), "#fff4e6", 3.5, 2.5);
}

/** Banco de museu: assento de couro, estrutura de aço escovado. */
function bench(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.leatherBlack, f, 0, 0.38, 0, f.w, 0.08, f.d * 0.95);
  for (const s of [-1, 1]) box(c, room, P.steel, f, s * (f.w / 2 - 0.15), 0, 0, 0.04, 0.38, f.d * 0.85);
}

/** Estátua clássica de mármore sobre plinto (galeria). */
function statue(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, marble = solid("statueMarble", "#efeae0", { rough: 0.38, env: 0.9 });
  box(c, room, P.marbleDark, f, 0, 0, 0, f.r * 1.9, 1.0, f.r * 1.9, { cast: true });
  box(c, room, P.marbleWhite, f, 0, 1.0, 0, f.r * 2.05, 0.06, f.r * 2.05);
  const v = id.charCodeAt(id.length - 1) % 2;
  c.batch.add(room, marble, statueGeometry(v), L(f, 0, 1.06, 0, v ? Math.PI * 0.85 : Math.PI * 0.15, 0.95), { cast: true });
  anchor(c, room, worldOf(f, 0, 3.4, 0.9), "#ffe9cc", 7, 4.5);
}

/** Pedestal do diamante: coluna de mármore negro, os três anéis de latão da trava (símbolos), cúpula de vidro e almofada. */
function pedestal(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.marbleDark, lathe("pedestalCol", [[0, 0], [0.5, 0], [0.5, 0.08], [0.42, 0.14], [0.36, 0.2], [0.34, 0.9], [0.42, 0.98], [0.46, 1.05], [0, 1.05]], 40), L(f, 0, 0, 0), { cast: true });
  // anéis da trava com os símbolos gravados (★ ☾ ♛ ♥ em volta)
  const ringTex = drawnTexture("ringSymbols", 1024, 64, (g, w, h) => {
    g.fillStyle = "#6b4f1d"; g.fillRect(0, 0, w, h); g.fillStyle = "#f2d38a";
    for (let k = 0; k < 16; k++) drawSymbol(g, RING_SYMBOLS[k % 4], (k + 0.5) * (w / 16), h / 2, h * 0.32);
  });
  const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, metalness: 0.9, roughness: 0.3, color: "#e2c27a" });
  for (const y of [0.42, 0.56, 0.7]) c.batch.add(room, ringMat, geo("ringBand", () => new THREE.CylinderGeometry(0.355, 0.355, 0.1, 48, 1, true)), L(f, 0, y, 0));
  c.batch.add(room, P.velvetRed, geo("cushion2", () => new THREE.SphereGeometry(0.16, 20, 10).scale(1, 0.3, 1)), L(f, 0, 1.08, 0));
  for (const [x, z, sx, sz] of [[0, 0.22, 0.44, 0.01], [0, -0.22, 0.44, 0.01], [0.22, 0, 0.01, 0.44], [-0.22, 0, 0.01, 0.44]] as [number, number, number, number][]) box(c, room, P.glass, f, x, 1.05, z, sx, 0.46, sz);
  box(c, room, P.glass, f, 0, 1.51, 0, 0.44, 0.01, 0.44);
  box(c, room, P.brass, f, 0, 1.05, 0, 0.47, 0.02, 0.47);
  // o diamante (lapidação brilhante), aparece só enquanto está no pedestal
  const diamond = new THREE.Mesh(diamondGeometry(), new THREE.MeshPhysicalMaterial({ color: "#f4fbff", metalness: 0.05, roughness: 0.0, envMapIntensity: 3.2, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.6, iridescenceIOR: 1.6, flatShading: true }));
  diamond.position.copy(worldOf(f, 0, 1.2, 0)); diamond.scale.setScalar(0.07); diamond.userData.room = room; c.group.add(diamond);
  c.animated.push({ kind: "diamond", mesh: diamond, room });
  anchor(c, room, worldOf(f, 0, 3.8, 0), "#f2f6ff", 14, 6);
}
/** Brilhante redondo: coroa, mesa e pavilhão facetados (57 facetas aproximadas). */
export function diamondGeometry(): THREE.BufferGeometry {
  return geo("diamond", () => {
    const n = 16, pts: number[] = [], tbl = 0.55, girdle = 1, crownH = 0.32, pavH = 0.86;
    const ring = (r: number, y: number, off = 0) => Array.from({ length: n }, (_, k) => { const a = ((k + off) / n) * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
    const T = ring(tbl, crownH, 0.5), G = ring(girdle, 0), C = [0, crownH, 0], B = [0, -pavH, 0];
    const tri = (a: number[], b: number[], c2: number[]) => pts.push(...a, ...b, ...c2);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      tri(C, T[k2], T[k]);                                                       // mesa
      tri(T[k], T[k2], G[k2]); tri(T[k], G[k2], G[k]);                           // coroa
      tri(G[k], G[k2], B);                                                       // pavilhão
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g;
  });
}

/** Mesa de monitores da sala de segurança: seis telas de câmeras sobre a bancada, teclado, rádio, café. */
function monitorDesk(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.darkSteel, f, 0, 0, 0, f.w, 0.74, f.d, { cast: true });
  box(c, room, P.black, f, 0, 0.74, 0, f.w + 0.02, 0.03, f.d + 0.02);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 3), y = 0.95 + r * 0.42;
    box(c, room, P.black, f, x, y, -f.d / 2 + 0.12, f.w / 3 - 0.04, 0.38, 0.05, { ry: 0 });
    const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(r * 3 + k), color: new THREE.Color(1.25, 1.25, 1.25) }));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(L(f, x, y + 0.19, -f.d / 2 + 0.147, 0, f.w / 3 - 0.08, 0.33, 1)); c.group.add(mesh); mesh.userData.room = room;
    c.animated.push({ kind: "cctv", mesh, room });
  }
  box(c, room, P.black, f, 0, 0.77, 0.15, 0.45, 0.02, 0.15);
  c.inst.add(room, "radio", BOX0(), P.black, L(f, 0.5, 0.77, 0.2, 0, 0.06, 0.2, 0.04));
  c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, -0.5, 0.77, 0.2, 0, 0.04, 0.11, 0.04));
  anchor(c, room, worldOf(f, 0, 1.3, 0.5), "#7fe0a8", 2.2, 3);
}
/** Cofre do cartão (sala de segurança): aço com teclado, maçaneta em roda e LED. */
function safe(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("safeSteel", "#3b3f45", { metal: 0.85, rough: 0.35 }), f, 0, 0, 0, f.w, 1.0, f.d, { cast: true });
  box(c, room, solid("safeDoor", "#4a4f56", { metal: 0.85, rough: 0.3 }), f, 0, 0.06, f.d / 2, f.w - 0.08, 0.88, 0.02);
  c.batch.add(room, P.chrome, geo("safeWheel", () => new THREE.TorusGeometry(0.09, 0.012, 6, 20)), L(f, 0.12, 0.5, f.d / 2 + 0.03));
  box(c, room, P.black, f, -0.2, 0.6, f.d / 2 + 0.02, 0.12, 0.16, 0.015);
  c.inst.add(room, "ledRed", SPH(6), P.ledRed, L(f, -0.2, 0.72, f.d / 2 + 0.03, 0, 0.008));
}
/** Quadro de luz: caixa cinza com disjuntores, etiquetas de alerta e eletrodutos subindo para o teto. */
function fusePanel(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("panelGrey", "#8a8f93", { metal: 0.6, rough: 0.5 }), f, 0, 0.9, 0, f.w, 1.2, f.d, { cast: true });
  box(c, room, P.darkSteel, f, 0, 1.0, f.d / 2, f.w - 0.12, 1.0, 0.01);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c.inst.add(room, "breaker", BOX0(), P.black, L(f, -f.w / 2 + 0.28 + k * ((f.w - 0.56) / 2), 1.15 + r * 0.28, f.d / 2 + 0.012, 0, 0.12, 0.14, 0.02));
  box(c, room, P.yellow, f, 0, 1.92, f.d / 2 + 0.002, 0.4, 0.12, 0.004);
  for (const x of [-0.25, 0, 0.25]) c.batch.add(room, P.steel, CYL0(8), L(f, x, 2.1, 0, 0, 0.025, 1.3, 0.025));
}

/** Caixas da doca: engradados de pinho (altos e baixos) e cases de bufê pretos com cantoneiras. */
function crate(c: PropsCtx, room: InteriorRoom, f: Foot, h: Prop["height"], variant: number, id: string) {
  const P = c.P, H = h === "tall" ? 1.95 : 0.95, R = rand(id.length * 19 + id.charCodeAt(id.length - 1));
  if (variant === 2) {
    // pilha de cases de bufê
    const layers = Math.round(H / 0.48);
    for (let k = 0; k < layers; k++) {
      const y = k * 0.48, ry = (R() - 0.5) * 0.05;
      box(c, room, solid("flightCase", "#16171a", { rough: 0.55 }), f, 0, y, 0, f.w - 0.02, 0.46, f.d - 0.02, { cast: true, ry });
      for (const s of [-1, 1]) for (const t of [-1, 1]) c.inst.add(room, "corner", BOX0(), P.steel, L(f, s * (f.w / 2 - 0.02), y, t * (f.d / 2 - 0.02), ry, 0.06, 0.46, 0.06));
    }
    return;
  }
  const n = h === "tall" ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const y = k * (H / n), sh = H / n;
    box(c, room, P.crateWood, f, 0, y, 0, f.w - 0.02, sh - 0.02, f.d - 0.02, { cast: true });
    for (const s of [-1, 1]) box(c, room, P.crateWood, f, s * (f.w / 2 - 0.04), y + 0.02, f.d / 2 - 0.005, 0.09, sh - 0.06, 0.02);
    c.batch.add(room, solid("stencil", "#1e1e1e", { rough: 0.9 }), BOX0(), L(f, 0, y + sh * 0.45, f.d / 2 + 0.002, 0, 0.4, 0.12, 0.002));
  }
}

/** Chapelaria: balcão com tampo de latão, campainha, fichas numeradas; casacos pendurados no fundo (parede leste). */
function coatCheck(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.walnut, f, 0, 0, 0, f.w, 1.05, f.d, { cast: true });
  box(c, room, P.brass, f, 0, 1.05, 0, f.w + 0.06, 0.03, f.d + 0.06);
  c.batch.add(room, P.goldBright, SPH(12), L(f, 0.8, 1.08, 0, 0, 0.05, 0.035, 0.05));
  for (let k = 0; k < 8; k++) c.inst.add(room, "ticket", BOX0(), P.paperWhite, L(f, -1.2 + k * 0.06, 1.08, 0.05, 0, 0.035, 0.002, 0.06));
  // trilho de casacos atrás do balcão (a 1,9 m da frente, junto à parede)
  const R = rand(3);
  c.batch.add(room, P.chrome, CYL(8), L(f, 0, 1.75, -2.1, 0, 0.015, f.w - 0.1, 0.015, 0, Math.PI / 2));
  for (let k = 0; k < 14; k++) {
    const x = -f.w / 2 + 0.2 + k * ((f.w - 0.4) / 13), col = ["#151517", "#2b1d16", "#3a3a3d", "#5a1d2a", "#1c2630"][Math.floor(R() * 5)];
    c.inst.add(room, "coat", geo("coatGeo", () => new THREE.CapsuleGeometry(0.17, 0.75, 4, 10).scale(1, 1, 0.38)), fabric(`coat-${col}`, col, c.q), L(f, x, 1.2, -2.1, (R() - 0.5) * 0.3));
  }
  anchor(c, room, worldOf(f, 0, 2.2, -1), "#ffd8a0", 3, 3.5);
}
/** Detector de metais: coluna com barras de LED (a viga liga as duas colunas por cima — interior-rooms). */
function detector(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("detectorGrey", "#c9cbcd", { rough: 0.4 }), f, 0, 0, 0, f.w, 2.25, f.d, { cast: true });
  for (let k = 0; k < 8; k++) c.inst.add(room, "detLed", BOX0(), P.ledGreen, L(f, 0, 0.4 + k * 0.2, f.d / 2 + 0.002, 0, f.w * 0.5, 0.05, 0.004));
}
/** Pedestais de latão com cordão de veludo vermelho. */
function rope(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const alongX = f.w >= f.d, len = Math.max(f.w, f.d), n = Math.max(2, Math.round(len / 1.3) + 1), P = c.P;
  const post = lathe("stanchion", [[0, 0], [0.16, 0], [0.16, 0.02], [0.04, 0.05], [0.025, 0.08], [0.025, 0.9], [0.045, 0.93], [0.05, 0.98], [0, 1.0]], 18);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) { const t = -len / 2 + 0.08 + (k / (n - 1)) * (len - 0.16), x = alongX ? t : 0, z = alongX ? 0 : t; c.batch.add(room, P.brass, post, L(f, x, 0, z)); pts.push(worldOf(f, x, 0.9, z)); }
  for (let k = 0; k < n - 1; k++) {
    const a = pts[k], b = pts[k + 1], mid = a.clone().lerp(b, 0.5); mid.y -= 0.16;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    c.batch.add(room, P.velvetRed, new THREE.TubeGeometry(curve, 12, 0.022, 6, false));
  }
}
/** Arara (esconderijo): estrutura cromada com capas de roupa (bastidores, doca) ou casacos (vestíbulo). */
function rack(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 11 + id.charCodeAt(id.length - 1)), H = 1.85;
  for (const s of [-1, 1]) { c.batch.add(room, P.chrome, CYL0(8), L(f, s * (f.w / 2 - 0.03), 0.06, 0, 0, 0.015, H - 0.06, 0.015)); box(c, room, P.chrome, f, s * (f.w / 2 - 0.03), 0, 0, 0.04, 0.03, f.d); }
  c.batch.add(room, P.chrome, CYL(8), L(f, 0, H, 0, 0, 0.015, f.w, 0.015, 0, Math.PI / 2));
  const coats = room === "vestibulo", n = 7;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + 0.12 + k * ((f.w - 0.24) / (n - 1));
    if (coats) c.inst.add(room, "coat", geo("coatGeo", () => new THREE.CapsuleGeometry(0.17, 0.75, 4, 10).scale(1, 1, 0.38)), fabric(`coat-${["#151517", "#2b1d16", "#3a3a3d"][k % 3]}`, ["#151517", "#2b1d16", "#3a3a3d"][k % 3], c.q), L(f, x, H - 0.62, 0, Math.PI / 2 + (R() - 0.5) * 0.2));
    else c.inst.add(room, "garmentBag", geo("bagGeo", () => new THREE.BoxGeometry(0.08, 1.3, 0.55).translate(0, -0.65, 0)), P.garmentBag, L(f, x, H - 0.04, 0, (R() - 0.5) * 0.25));
  }
}

export const INTERIOR_PROP_ROOMS: RoomId[] = ["vestibulo", "salao", "galeria", "lounge", "terraco", "bastidores", "servico", "seguranca", "doca", "cofre"];
export { candelabra };
void M; void glass;
