/*
 * MET Gala Heist v2 — placas da área de serviço: o atlas (um material só para toda a sinalização, desenhado no idioma
 * do cenário), o plano de cada placa com as coordenadas do atlas, a proporção e as placas de PVC parafusadas na parede
 * (`sign`) ou num referencial qualquer (`signOn`).
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import * as THREE from "three";
import { BOX0, geo } from "../interior-batch";
import type { InteriorCopy } from "../interior-copy";
import { HAND, SANS, drawnTexture, fit, type Quality } from "../interior-tex";
import { mix } from "./servico-kit-pbr";
import { SM } from "./servico-kit-mats";
import { Fr, type Sink } from "./servico-kit-frame";
import { SRV_TEXT, localeOf } from "./servico-text";

/** Placas do atlas: retângulo em unidades de uma grade 16 × 16. */
export type SignId = "staffOnly" | "restricted" | "copa" | "kitchen" | "dish" | "bar" | "cold" | "toHall" | "toDock" | "toSec" | "keepClear" | "monitoring"
  | "stageEntry" | "quickChange" | "wardrobe" | "makeup" | "production" | "silence" | "toKitchen" | "exit" | "hot" | "highVoltage" | "arrow" | "exitArrow"
  | "noSmoking" | "hairnet" | "handWash" | "wetFloor" | "extinguisher" | "hose" | "alarm" | "orders" | "duty" | "drinks" | "temp" | "staffEntrance";
const SLOTS: Record<SignId, [number, number, number, number]> = {
  staffOnly: [0, 0, 4, 1], restricted: [4, 0, 4, 1], copa: [8, 0, 4, 1], kitchen: [12, 0, 4, 1],
  dish: [0, 1, 4, 1], bar: [4, 1, 4, 1], cold: [8, 1, 4, 1], toHall: [12, 1, 4, 1],
  toDock: [0, 2, 4, 1], toSec: [4, 2, 4, 1], keepClear: [8, 2, 4, 1], monitoring: [12, 2, 4, 1],
  stageEntry: [0, 3, 4, 1], quickChange: [4, 3, 4, 1], wardrobe: [8, 3, 4, 1], makeup: [12, 3, 4, 1],
  production: [0, 4, 4, 1], silence: [4, 4, 8, 1], toKitchen: [12, 4, 4, 1],
  exit: [0, 5, 4, 2], hot: [4, 5, 4, 2], highVoltage: [8, 5, 4, 2], arrow: [12, 5, 2, 2], exitArrow: [14, 5, 2, 2],
  noSmoking: [0, 7, 2, 3], hairnet: [2, 7, 2, 3], handWash: [4, 7, 2, 3], wetFloor: [6, 7, 2, 3], extinguisher: [8, 7, 2, 3], hose: [10, 7, 2, 3], alarm: [12, 7, 2, 2], staffEntrance: [12, 9, 4, 1],
  orders: [0, 10, 6, 4], duty: [6, 10, 6, 4], drinks: [12, 10, 4, 6], temp: [0, 14, 4, 2],
};
type G = CanvasRenderingContext2D;
function plate(g: G, x: number, y: number, w: number, h: number, bg: string, fg: string, text: string, o: { border?: string; font?: number; icon?: (cx: number, cy: number, s: number) => void; sub?: string } = {}) {
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = h * 0.06; g.strokeRect(x + h * 0.06, y + h * 0.06, w - h * 0.12, h * 0.88); }
  const ix = o.icon ? h * 0.95 : 0;
  if (o.icon) o.icon(x + h * 0.55, y + h / 2, h * 0.34);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  const px = fit(g, text, (p) => `700 ${p}px ${SANS}`, Math.round(h * (o.font ?? 0.46)), w - ix - h * 0.4);
  g.font = `700 ${px}px ${SANS}`; g.fillText(text, x + ix + (w - ix) / 2, y + h * (o.sub ? 0.38 : 0.53));
  if (o.sub) { g.font = `500 ${Math.round(h * 0.2)}px ${SANS}`; g.fillText(o.sub, x + ix + (w - ix) / 2, y + h * 0.75); }
}
const ico = {
  cutlery: (g: G, cx: number, cy: number, s: number, c: string) => { g.fillStyle = c; g.fillRect(cx - s * 0.5, cy - s, s * 0.14, s * 2); for (const k of [-0.75, -0.5, -0.25]) g.fillRect(cx - s * 0.5 + k * s * 0.4 + s * 0.05, cy - s, s * 0.06, s * 0.7); g.beginPath(); g.ellipse(cx + s * 0.45, cy - s * 0.35, s * 0.18, s * 0.65, 0, 0, Math.PI * 2); g.fill(); g.fillRect(cx + s * 0.4, cy, s * 0.12, s); },
  flake: (g: G, cx: number, cy: number, s: number, c: string) => { g.strokeStyle = c; g.lineWidth = s * 0.16; g.lineCap = "round"; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * s, cy - Math.sin(a) * s); g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); g.stroke(); } },
  person: (g: G, cx: number, cy: number, s: number, c: string, run = false) => {
    g.fillStyle = c; g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = s * 0.26;
    g.beginPath(); g.arc(cx + (run ? s * 0.25 : 0), cy - s * 0.78, s * 0.2, 0, Math.PI * 2); g.fill();
    const line = (pts: number[][]) => { g.beginPath(); g.moveTo(cx + pts[0][0] * s, cy + pts[0][1] * s); for (const p of pts.slice(1)) g.lineTo(cx + p[0] * s, cy + p[1] * s); g.stroke(); };
    if (run) { line([[0.15, -0.5], [-0.1, 0.15]]); line([[-0.1, 0.15], [0.35, 0.45], [0.25, 0.95]]); line([[-0.1, 0.15], [-0.35, 0.55], [-0.75, 0.6]]); line([[0.1, -0.4], [0.5, -0.15], [0.7, -0.35]]); line([[0.1, -0.4], [-0.25, -0.2], [-0.5, -0.45]]); }
    else { line([[0, -0.5], [0, 0.2]]); line([[0, 0.2], [0.25, 0.95]]); line([[0, 0.2], [-0.25, 0.95]]); line([[0, -0.4], [0.4, 0]]); line([[0, -0.4], [-0.4, 0]]); }
  },
  arrow: (g: G, cx: number, cy: number, s: number, c: string) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx - s, cy - s * 0.25); g.lineTo(cx + s * 0.1, cy - s * 0.25); g.lineTo(cx + s * 0.1, cy - s * 0.7); g.lineTo(cx + s, cy); g.lineTo(cx + s * 0.1, cy + s * 0.7); g.lineTo(cx + s * 0.1, cy + s * 0.25); g.lineTo(cx - s, cy + s * 0.25); g.closePath(); g.fill(); },
  tri: (g: G, cx: number, cy: number, s: number) => { g.fillStyle = "#111"; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 1.1, cy + s * 0.85); g.lineTo(cx - s * 1.1, cy + s * 0.85); g.closePath(); g.fill(); g.fillStyle = "#f2c21b"; g.beginPath(); g.moveTo(cx, cy - s * 0.66); g.lineTo(cx + s * 0.8, cy + s * 0.68); g.lineTo(cx - s * 0.8, cy + s * 0.68); g.closePath(); g.fill(); },
};
const atlasMats = new Map<string, { face: THREE.MeshStandardMaterial; lit: THREE.MeshBasicMaterial }>();
/** O atlas das placas da área no idioma do cenário: material das placas (levemente autoiluminado) e o aceso (saída). */
export function signAtlas(copy: InteriorCopy, q: Quality) {
  const loc = localeOf(copy), key = `srv-signs-${loc}-${q}`, hit = atlasMats.get(key); if (hit) return hit;
  const t = SRV_TEXT[loc], S = q === "high" ? 2048 : 1024, U = S / 16;
  const tex = drawnTexture(key, S, S, (g) => {
    g.fillStyle = "#777"; g.fillRect(0, 0, S, S);
    const r = (id: SignId) => { const [x, y, w, h] = SLOTS[id]; return [x * U, y * U, w * U, h * U] as const; };
    const zone = (id: SignId, text: string, icon?: (cx: number, cy: number, s: number) => void) => { const [x, y, w, h] = r(id); plate(g, x, y, w, h, "#24282d", "#f4f4f2", text, { border: "#f4f4f2", icon, font: 0.4 }); };
    { const [x, y, w, h] = r("staffOnly"); plate(g, x, y, w, h, "#b0121b", "#ffffff", copy.staffOnly, { font: 0.44 }); }
    { const [x, y, w, h] = r("restricted"); plate(g, x, y, w, h, "#b0121b", "#ffffff", copy.restricted, { font: 0.44 }); }
    zone("copa", t.copa, (cx, cy, s) => ico.cutlery(g, cx, cy, s, "#f4f4f2")); zone("kitchen", t.kitchen, (cx, cy, s) => ico.cutlery(g, cx, cy, s, "#f4f4f2"));
    zone("dish", t.dish); zone("bar", t.bar); zone("toHall", t.toHall); zone("toDock", t.toDock); zone("toSec", t.toSec); zone("toKitchen", t.toKitchen);
    { const [x, y, w, h] = r("cold"); plate(g, x, y, w, h, "#1d5a9c", "#ffffff", t.cold, { icon: (cx, cy, s) => ico.flake(g, cx, cy, s, "#ffffff"), font: 0.42 }); }
    { const [x, y, w, h] = r("keepClear"); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = "#111"; for (let k = -2; k < 24; k++) { g.beginPath(); g.moveTo(x + k * h * 0.5, y + h); g.lineTo(x + k * h * 0.5 + h * 0.25, y + h); g.lineTo(x + k * h * 0.5 + h * 0.5, y); g.lineTo(x + k * h * 0.5 + h * 0.25, y); g.fill(); } g.restore(); g.fillStyle = "#f2c21b"; g.fillRect(x + h * 0.25, y + h * 0.18, w - h * 0.5, h * 0.64); g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, t.keepClear, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.38), w - h * 0.7); g.font = `800 ${px}px ${SANS}`; g.fillText(t.keepClear, x + w / 2, y + h * 0.52); }
    { const [x, y, w, h] = r("monitoring"); plate(g, x, y, w, h, "#0f2a44", "#cfe8ff", t.monitoring, { border: "#5fa8e6", font: 0.36 }); }
    for (const [id, text] of [["stageEntry", t.stageEntry], ["quickChange", t.quickChange], ["wardrobe", t.wardrobe], ["makeup", t.makeup], ["production", t.production]] as [SignId, string][]) { const [x, y, w, h] = r(id); plate(g, x, y, w, h, "#0d0d0e", "#f0c75a", text, { border: "#f0c75a", font: 0.42 }); }
    { const [x, y, w, h] = r("silence"); plate(g, x, y, w, h, "#9e0f18", "#ffffff", copy.silence, { font: 0.5 }); }
    { const [x, y, w, h] = r("staffEntrance"); plate(g, x, y, w, h, "#24282d", "#f4f4f2", t.staffEntrance, { border: "#f4f4f2", font: 0.4 }); }
    { const [x, y, w, h] = r("exit"); g.fillStyle = "#0b8a41"; g.fillRect(x, y, w, h); g.strokeStyle = "#e9fff1"; g.lineWidth = h * 0.05; g.strokeRect(x + h * 0.08, y + h * 0.08, w - h * 0.16, h * 0.84); ico.person(g, x + h * 0.55, y + h * 0.52, h * 0.32, "#ffffff", true); g.fillStyle = "#ffffff"; g.fillRect(x + h * 0.95, y + h * 0.2, h * 0.06, h * 0.6); g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, copy.exit, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.4), w - h * 1.4); g.font = `800 ${px}px ${SANS}`; g.fillText(copy.exit, x + h * 1.05 + (w - h * 1.05) / 2, y + h * 0.53); }
    for (const [id, lines] of [["hot", t.hot], ["highVoltage", t.highVoltage]] as [SignId, [string, string]][]) {
      const [x, y, w, h] = r(id); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); g.strokeStyle = "#111"; g.lineWidth = h * 0.05; g.strokeRect(x + h * 0.06, y + h * 0.06, w - h * 0.12, h * 0.88);
      ico.tri(g, x + h * 0.5, y + h * 0.5, h * 0.3); g.fillStyle = "#111"; g.font = `800 ${Math.round(h * 0.26)}px ${SANS}`; g.textAlign = "center"; g.fillText(id === "hot" ? "!" : "ϟ", x + h * 0.5, y + h * 0.56);
      g.textBaseline = "middle"; const px = fit(g, lines[1], (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.22), w - h * 1.15); g.font = `800 ${Math.round(h * 0.26)}px ${SANS}`; g.fillText(lines[0], x + h + (w - h) / 2, y + h * 0.36); g.font = `800 ${px}px ${SANS}`; g.fillText(lines[1], x + h + (w - h) / 2, y + h * 0.66);
    }
    { const [x, y, w, h] = r("arrow"); g.fillStyle = "#24282d"; g.fillRect(x, y, w, h); ico.arrow(g, x + w / 2, y + h / 2, w * 0.36, "#f4f4f2"); }
    { const [x, y, w, h] = r("exitArrow"); g.fillStyle = "#0b8a41"; g.fillRect(x, y, w, h); ico.arrow(g, x + w / 2, y + h / 2, w * 0.36, "#ffffff"); }
    const portrait = (id: SignId, ring: string, bg: string, lines: string[], icon: (cx: number, cy: number, s: number) => void, slash = false) => {
      const [x, y, w, h] = r(id); g.fillStyle = bg; g.fillRect(x, y, w, h); g.strokeStyle = "#cfcfcf"; g.lineWidth = w * 0.02; g.strokeRect(x + w * 0.03, y + w * 0.03, w * 0.94, h - w * 0.06);
      const cx = x + w / 2, cy = y + w * 0.52, R = w * 0.36; g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.fillStyle = bg === "#ffffff" && slash ? "#ffffff" : bg; if (slash) { g.beginPath(); g.arc(cx, cy, R * 0.8, 0, Math.PI * 2); g.fill(); }
      icon(cx, cy, R * 0.62);
      if (slash) { g.strokeStyle = ring; g.lineWidth = R * 0.2; g.beginPath(); g.moveTo(cx - R * 0.58, cy - R * 0.58); g.lineTo(cx + R * 0.58, cy + R * 0.58); g.stroke(); }
      g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
      lines.forEach((s, k) => { const px = fit(g, s, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.13), w * 0.86); g.font = `800 ${px}px ${SANS}`; g.fillText(s, cx, y + w * 1.02 + k * w * 0.17); });
    };
    const split = (s: string) => { const m = s.split(" "); if (m.length < 2) return [s]; const k = Math.ceil(m.length / 2); return [m.slice(0, k).join(" "), m.slice(k).join(" ")]; };
    portrait("noSmoking", "#c4141c", "#ffffff", split(t.noSmoking), (cx, cy, s) => { g.fillStyle = "#222"; g.fillRect(cx - s, cy - s * 0.12, s * 1.5, s * 0.24); g.fillStyle = "#e07a2a"; g.fillRect(cx + s * 0.5, cy - s * 0.12, s * 0.3, s * 0.24); }, true);
    portrait("hairnet", "#1d5a9c", "#ffffff", split(t.hairnet), (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy + s * 0.15, s * 0.55, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(cx, cy - s * 0.35, s * 0.75, s * 0.45, 0, Math.PI, 0); g.fill(); });
    portrait("handWash", "#1d5a9c", "#ffffff", split(t.handWash), (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(cx - s * 0.3, cy + s * 0.2, s * 0.32, s * 0.6, 0.5, 0, Math.PI * 2); g.ellipse(cx + s * 0.3, cy + s * 0.2, s * 0.32, s * 0.6, -0.5, 0, Math.PI * 2); g.fill(); for (const k of [-0.4, 0, 0.4]) { g.beginPath(); g.arc(cx + k * s, cy - s * 0.7, s * 0.1, 0, Math.PI * 2); g.fill(); } });
    { const [x, y, w, h] = r("wetFloor"); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); ico.tri(g, x + w / 2, y + w * 0.5, w * 0.34); g.lineWidth = w * 0.035; ico.person(g, x + w / 2, y + w * 0.58, w * 0.16, "#111", true); g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle"; t.wetFloor.forEach((s, k) => { const px = fit(g, s, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.15), w * 0.86); g.font = `800 ${px}px ${SANS}`; g.fillText(s, x + w / 2, y + w * 1.05 + k * w * 0.19); }); }
    const fire = (id: SignId, text: string, icon: (cx: number, cy: number, s: number) => void) => { const [x, y, w, h] = r(id); g.fillStyle = "#c4141c"; g.fillRect(x, y, w, h); icon(x + w / 2, y + h * 0.4, w * 0.3); g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, text, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.15), w * 0.9); g.font = `800 ${px}px ${SANS}`; g.fillText(text, x + w / 2, y + h * 0.84); };
    fire("extinguisher", t.extinguisher, (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(cx - s * 0.32, cy - s * 0.55, s * 0.64, s * 1.5, s * 0.25); g.fill(); g.fillRect(cx - s * 0.12, cy - s * 0.85, s * 0.24, s * 0.3); g.fillRect(cx - s * 0.6, cy - s * 0.85, s * 0.7, s * 0.12); g.lineWidth = s * 0.1; g.strokeStyle = "#ffffff"; g.beginPath(); g.moveTo(cx + s * 0.12, cy - s * 0.75); g.quadraticCurveTo(cx + s * 0.75, cy - s * 0.6, cx + s * 0.55, cy + s * 0.4); g.stroke(); });
    fire("hose", t.hose, (cx, cy, s) => { g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.14; for (const rr of [0.85, 0.62, 0.4]) { g.beginPath(); g.arc(cx, cy, s * rr, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(cx + s * 0.85, cy); g.lineTo(cx + s * 0.85, cy + s * 0.95); g.stroke(); });
    { const [x, y, w, h] = r("alarm"); g.fillStyle = "#c4141c"; g.fillRect(x, y, w, h); g.fillStyle = "#ffffff"; g.fillRect(x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.42); g.fillStyle = "#c4141c"; g.font = `800 ${Math.round(h * 0.3)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", x + w / 2, y + h * 0.4); g.fillStyle = "#ffffff"; const px = fit(g, t.alarm, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.11), w * 0.9); g.font = `800 ${px}px ${SANS}`; g.fillText(t.alarm, x + w / 2, y + h * 0.78); }
    const board = (id: SignId, lines: string[], bg: string, ink: string, head: string) => {
      const [x, y, w, h] = r(id); g.fillStyle = bg; g.fillRect(x, y, w, h);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(120,120,120,${0.02 + (k % 5) * 0.008})`; g.fillRect(x + ((k * 97) % w), y + ((k * 53) % h), w * 0.2, h * 0.02); }
      g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = head; const hp = fit(g, lines[0], (p) => `700 ${p}px ${SANS}`, Math.round(h * 0.1), w * 0.9); g.font = `700 ${hp}px ${SANS}`; g.fillText(lines[0], x + w * 0.05, y + h * 0.06);
      g.fillStyle = head; g.fillRect(x + w * 0.05, y + h * 0.19, w * 0.9, h * 0.008);
      g.fillStyle = ink; lines.slice(1).forEach((s, k) => { const px = fit(g, s, (p) => `600 ${p}px ${HAND}`, Math.round(h * 0.11), w * 0.9); g.font = `600 ${px}px ${HAND}`; g.save(); g.translate(x + w * 0.06, y + h * (0.24 + k * 0.14)); g.rotate(((k % 3) - 1) * 0.012); g.fillText(s, 0, 0); g.restore(); });
    };
    board("orders", t.orders, "#f3f3ef", "#1b3f8f", "#b3121e"); board("duty", t.duty, "#f3f3ef", "#1d1d1d", "#1b3f8f"); board("drinks", t.drinks, "#151517", "#f2efe4", "#e0b85a"); board("temp", t.temp, "#f7f5ec", "#1d1d1d", "#1d1d1d");
  });
  tex.anisotropy = 8;
  const out = {
    face: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.22 }),
    lit: new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.9, 1.9, 1.9) }),
  };
  out.face.name = `${key}-face`; out.lit.name = `${key}-lit`;
  atlasMats.set(key, out); return out;
}
/** Plano da placa (largura 1, altura 1, olhando para +z) com as coordenadas do atlas. */
export function signGeo(id: SignId): THREE.BufferGeometry {
  return geo(`srv-signGeo-${id}`, () => {
    const g = new THREE.PlaneGeometry(1, 1), [x, y, w, h] = SLOTS[id], uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const u0 = x / 16, u1 = (x + w) / 16, v1 = 1 - y / 16, v0 = 1 - (y + h) / 16, e = 0.002;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, mix(u0 + e, u1 - e, uv.getX(k)), mix(v0 + e, v1 - e, uv.getY(k)));
    return g;
  });
}
/** Proporção (largura / altura) da placa no atlas. */
export const signAspect = (id: SignId) => SLOTS[id][2] / SLOTS[id][3];
/**
 * Placa de PVC parafusada: chapa com espessura (3 mm) e a face do atlas, centrada em (x, y, z) da parede, olhando para
 * `ry`; `h` = altura (a largura sai da proporção); `rot` gira a face no próprio plano (setas). `lit`: caixa de luz (saída).
 */
export function sign(c: Sink & { copy: InteriorCopy; q: Quality }, room: string, id: SignId, x: number, y: number, z: number, ry: number, h: number, o: { rot?: number; lit?: boolean; depth?: number } = {}) {
  signOn(c, Fr.at(c, room, x, y, z, ry), id, 0, 0, 0, h, o);
}
/** A mesma placa num referencial qualquer (abas inclinadas, portas, carrinhos): centro (x, y, z) local, olhando para +z. */
export function signOn(c: Sink & { copy: InteriorCopy; q: Quality }, f: Fr, id: SignId, x: number, y: number, z: number, h: number, o: { rot?: number; lit?: boolean; depth?: number } = {}) {
  const w = h * signAspect(id), A = signAtlas(c.copy, c.q), d = o.depth ?? 0.004, S = SM(c.q), room = f.room;
  if (o.lit) { c.batch.add(room, S.plasticWhite, BOX0(), f.m(x, y - h / 2 - 0.02, z, 0, w + 0.06, h + 0.04, 0.05)); c.batch.add(room, A.lit, signGeo(id), f.m(x, y, z + 0.051, 0, w, h, 1, 0, o.rot ?? 0)); return; }
  c.batch.add(room, S.plasticWhite, BOX0(), f.m(x, y - h / 2, z + d / 2, 0, w + 0.004, h + 0.004, d));
  c.batch.add(room, A.face, signGeo(id), f.m(x, y, z + d + 0.0015, 0, w, h, 1, 0, o.rot ?? 0));
}
