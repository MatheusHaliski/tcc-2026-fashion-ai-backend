/*
 * MET Gala Heist v2 — as folhas das portas internas, uma família por tipo de porta, desenhadas no referencial da folha
 * (dobradiça em x = 0, folha para +x, altura em y, espessura em z; +z é a "frente"). Cada folha sai em poucas malhas (uma
 * por material, geometria mesclada e reaproveitada entre folhas iguais) e traz dobradiças à vista; as que fecham sozinhas
 * levam a mola aérea com braço articulado (o cotovelo é resolvido a cada quadro pelo ângulo da folha).
 *
 *  - nobre (salão e galeria, 4 m): nogueira com montantes e travessas, almofadas levantadas com moldura bolection e filete
 *    dourado, florão entalhado no alto, losango no meio, puxador de latão de 0,9 m, placa de empurrar e chapa de chute;
 *  - aço (doca, serviço, terraço da equipe, segurança): chapa pintada, visor de vidro aramado com baguete, chapa de chute
 *    inox, barra antipânico do lado de empurrar e alavanca do outro;
 *  - acolchoada (lounge): couro capitonê com botões e tachas de latão sobre mogno, placa oval e puxador;
 *  - palco (bastidores): preta fosca com marcas de uso, o nome em estêncil, visor redondo, placa e chapa de alumínio;
 *  - francesa (terraço): madeira branca com 2 × 5 vidros, travessa baixa cega, cremona e maçanetas de latão;
 *  - disfarçada (equipe, no salão): do lado do salão continua a parede (calcário, lambri de nogueira, rodapé de nero),
 *    do lado do serviço é uma porta de aço com barra;
 *  - blindada (Sala das Joias): aço polido de 30 cm com quadro em degrau, painel "guilhochê", volante de cinco raios,
 *    disco do segredo, seis trancas cromadas na borda e as dobradiças cilíndricas; por dentro, o mecanismo atrás do vidro.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { geo, mat } from "./interior-batch";
import { glass, solid, type Palette } from "./interior-mats";
import { drawnTexture, type Quality } from "./interior-tex";
import type { RoomId } from "@/lib/heist/types";

export type LeafStyle = "grand" | "steel" | "padded" | "stage" | "french" | "jib" | "vault";
export interface LeafSpec {
  style: LeafStyle; w: number; h: number;
  /** +1: o lado de puxar (para onde a folha abre) é a frente (+z); −1: é o verso */
  pull: 1 | -1;
  /** sala para onde a frente (+z) e o verso (−z) olham */
  front: RoomId | null; back: RoomId | null;
  /** texto do estêncil (palco) */
  stencil?: string;
  /** mola aérea */
  closer?: boolean;
  /** porta disfarçada: coordenada (ao longo da parede) da dobradiça e o sentido da folha, para a cantaria casar com a parede */
  wallUv?: { origin: number; dir: number };
}
export const LEAF_T: Record<LeafStyle, number> = { grand: 0.075, steel: 0.05, padded: 0.08, stage: 0.055, french: 0.055, jib: 0.06, vault: 0.3 };

/* ---------- materiais das portas ---------- */
const dm = (key: string, color: string, o: Parameters<typeof solid>[2] = {}) => solid(`vestibulo-door-${key}`, color, o);
function doorMats(P: Palette) {
  return {
    walnut: P.walnut, gold: P.gold, brass: P.brass, chrome: P.chrome,
    steelPaint: dm("steelPaint", "#4d5761", { metal: 0.45, rough: 0.48 }),
    steelPaintLight: dm("steelPaintLight", "#8a9095", { metal: 0.4, rough: 0.5 }),
    inox: dm("inox", "#b9bdc1", { metal: 0.95, rough: 0.3 }),
    rubber: dm("rubber", "#121212", { rough: 0.85 }),
    leather: dm("leatherOx", "#4a1418", { rough: 0.55, env: 0.8 }),
    mahogany: P.mahogany,
    blackDoor: dm("blackDoorBase", "#141416", { rough: 0.7 }),
    alu: dm("alu", "#a8adb3", { metal: 0.85, rough: 0.35 }),
    whitePaint: dm("whitePaint", "#e9e5dc", { rough: 0.42, env: 0.8 }),
    vaultSteel: dm("vaultSteel", "#8f949a", { metal: 0.95, rough: 0.2, env: 1.2 }),
    vaultDark: dm("vaultDark", "#5c6167", { metal: 0.9, rough: 0.32 }),
    limestone: P.limestone, marbleDark: P.marbleDark,
    glassClear: glass("vestibulo-door-glass", { opacity: 0.2, tint: "#dbe8ea" }),
    glassWire: glass("vestibulo-door-wire", { opacity: 0.38, tint: "#c3ccd0", rough: 0.12 }),
  };
}
export type DoorMats = ReturnType<typeof doorMats>;

/** Preto do palco: tinta fosca com marcas de uso, fita crepe e o nome em estêncil (spray branco falhado). */
function stageTexture(text: string): THREE.Texture {
  return drawnTexture(`vestibulo-door-stage-${text}`, 512, 1280, (g, w, h) => {
    g.fillStyle = "#16161a"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) { const x = (k * 151) % w, y = (k * 97) % h, l = 10 + (k % 23) * 3; g.strokeStyle = `rgba(${90 + (k % 40)},${90 + (k % 40)},${95 + (k % 40)},${0.05 + (k % 7) * 0.012})`; g.lineWidth = 1 + (k % 3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(k), y + l * Math.sin(k) * 0.3); g.stroke(); }
    const scuff = g.createLinearGradient(0, h, 0, h * 0.82); scuff.addColorStop(0, "rgba(120,110,100,0.25)"); scuff.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = scuff; g.fillRect(0, h * 0.82, w, h * 0.18);
    // estêncil: letras com as pontes do molde e borrifos
    g.save(); g.translate(w / 2, h * 0.32); g.rotate(-Math.PI / 2);
    g.font = `700 ${Math.round(w * 0.28)}px 'DejaVu Sans', Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(236,230,214,0.85)"; g.fillText(text, 0, 0);
    g.fillStyle = "#16161a"; for (let k = -8; k <= 8; k++) g.fillRect(k * w * 0.12 - 2, -w * 0.02, 4, w * 0.04);
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(236,230,214,${0.15 + (k % 5) * 0.08})`; g.fillRect(((k * 53) % 600) - 300, ((k * 31) % 140) - 70, 2, 2); }
    g.restore();
    // fita crepe com a marca do ensaio
    g.fillStyle = "rgba(214,196,150,0.85)"; g.fillRect(w * 0.18, h * 0.6, w * 0.5, 26); g.fillStyle = "#3a3020"; g.font = `600 18px 'DejaVu Sans', Arial`; g.textAlign = "left"; g.fillText("CENA 4 · ENTRADA L", w * 0.2, h * 0.6 + 19);
  });
}
/** Aço "guilhochê" do painel do cofre: círculos sobrepostos em grade, como o acabamento de portas-fortes antigas. */
function jeweledTexture(): THREE.Texture {
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

/* ---------- montagem por material ---------- */
class Parts {
  private by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(m: THREE.Material, g: THREE.BufferGeometry, M?: THREE.Matrix4) {
    const src = g.index ? g.toNonIndexed() : g.clone(); if (!src.getAttribute("normal")) src.computeVertexNormals();
    const out = new THREE.BufferGeometry(); out.setAttribute("position", src.getAttribute("position").clone()); out.setAttribute("normal", src.getAttribute("normal").clone());
    out.setAttribute("uv", src.getAttribute("uv")?.clone() ?? new THREE.BufferAttribute(new Float32Array(src.getAttribute("position").count * 2), 2));
    if (M) out.applyMatrix4(M);
    let l = this.by.get(m); if (!l) { l = []; this.by.set(m, l); } l.push(out);
  }
  box(m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { this.add(m, BOXN(), mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, Math.max(1e-4, x1 - x0), Math.max(1e-4, y1 - y0), Math.max(1e-4, z1 - z0))); }
  done(): { m: THREE.Material; g: THREE.BufferGeometry }[] { return [...this.by].map(([m, l]) => ({ m, g: mergeGeometries(l, false) ?? l[0] })); }
}
const BOXN = () => geo("vestibulo-door-box", () => new THREE.BoxGeometry(1, 1, 1));
const CYLN = (seg = 12) => geo(`vestibulo-door-cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg));
const raised = (w: number, h: number, d: number, b: number) => geo(`vestibulo-door-raised-${w.toFixed(3)}-${h.toFixed(3)}-${d}-${b}`, () => {
  const s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b * 0.7, bevelSegments: 2 });
});
const frame = (w: number, h: number, fw: number, d: number, b = 0.006) => geo(`vestibulo-door-frame-${w.toFixed(3)}-${h.toFixed(3)}-${fw}-${d}`, () => {
  const s = new THREE.Shape(), x = w / 2, y = h / 2; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
  const hole = new THREE.Path(), ix = x - fw, iy = y - fw; hole.moveTo(-ix, -iy); hole.lineTo(-ix, iy); hole.lineTo(ix, iy); hole.lineTo(ix, -iy); hole.closePath(); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2 });
});
/** Peça em uma face: `side` +1 = frente (+z), −1 = verso; `z` = distância da face central da folha. */
const onFace = (side: number, x: number, y: number, z: number) => mat(x, y, side * z, side > 0 ? 0 : Math.PI);

/** Dobradiças à vista (canecas e capas) na borda da dobradiça, do lado de puxar. */
function hinges(p: Parts, m: THREE.Material, h: number, t: number, pull: number, n: number, r = 0.012) {
  for (let k = 0; k < n; k++) {
    const y = n === 1 ? h / 2 : 0.25 + k * ((h - 0.5) / (n - 1));
    p.add(m, CYLN(12), mat(-0.004, y, pull * (t / 2 + 0.002), 0, r, 0.12, r));
    p.add(m, geo("vestibulo-door-hingeTip", () => new THREE.SphereGeometry(1, 10, 6)), mat(-0.004, y + 0.065, pull * (t / 2 + 0.002), 0, r * 0.9, r * 1.4, r * 0.9));
    p.box(m, 0, y - 0.06, pull > 0 ? t / 2 : -t / 2 - 0.002, 0.05, y + 0.06, pull > 0 ? t / 2 + 0.002 : -t / 2);
  }
}
/**
 * Corpo da mola aérea em braço paralelo: preso na face de EMPURRAR da folha, junto da dobradiça (a folha gira no meio da
 * parede de 50 cm; deste lado o braço e a sapata nunca cruzam a folha quando ela abre).
 */
function closerBody(p: Parts, m: THREE.Material, h: number, t: number, side: number) {
  const z0 = side * (t / 2), z1 = side * (t / 2 + 0.055);
  p.box(m, 0.08, h - 0.16, Math.min(z0, z1), 0.4, h - 0.08, Math.max(z0, z1));
  p.add(m, CYLN(12), mat(0.12, h - 0.12, side * (t / 2 + 0.06), 0, 0.016, 0.03, 0.016));
}

/* ---------- famílias ---------- */
function grand(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.grand, st = 0.17, rails: [number, number][] = [[0, 0.3], [1.0, 1.18], [2.72, 2.86], [h - 0.18, h]];
  p.box(M.walnut, 0, 0, -t / 2, st, h, t / 2); p.box(M.walnut, w - st, 0, -t / 2, w, h, t / 2);
  for (const [a, b] of rails) p.box(M.walnut, st, a, -t / 2, w - st, b, t / 2);
  const panels: [number, number][] = [[0.3, 1.0], [1.18, 2.72], [2.86, h - 0.18]];
  for (const [a, b] of panels) {
    const pw = w - 2 * st, ph = b - a, cx = w / 2, cy = (a + b) / 2;
    p.box(M.walnut, st, a, -0.012, w - st, b, 0.012);
    for (const side of [1, -1]) {
      p.add(M.walnut, raised(pw - 0.07, ph - 0.07, 0.024, 0.014), onFace(side, cx, cy, 0.012));
      p.add(M.walnut, frame(pw + 0.02, ph + 0.02, 0.05, 0.03, 0.01), onFace(side, cx, cy, t / 2 - 0.008));
      p.add(M.gold, frame(pw - 0.1, ph - 0.1, 0.009, 0.03, 0.003), onFace(side, cx, cy, 0.012));
      // entalhes: florão no painel de cima, losango em relevo no grande e a cartela no de baixo
      if (b > h - 0.5) { p.add(M.gold, geo("vestibulo-door-rosette", () => { const sh = new THREE.Shape(); for (let i = 0; i <= 48; i++) { const a2 = (i / 48) * Math.PI * 2, r = 0.13 * (0.75 + 0.25 * Math.abs(Math.cos(a2 * 4))); if (i) sh.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); else sh.moveTo(Math.cos(a2) * r, Math.sin(a2) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }); }), onFace(side, cx, cy, 0.03)); }
      else if (ph > 1) { p.add(M.walnut, geo("vestibulo-door-lozenge", () => { const sh = new THREE.Shape(); sh.moveTo(0, -0.42); sh.lineTo(0.2, 0); sh.lineTo(0, 0.42); sh.lineTo(-0.2, 0); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.016, bevelSegments: 2 }); }), onFace(side, cx, cy, 0.03)); }
      else p.add(M.gold, geo("vestibulo-door-cartouche", () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.14, 0.08, 0.025)), onFace(side, cx, cy, 0.03));
    }
  }
  // ferragens: puxador vertical de 0,9 m do lado de puxar, placa de empurrar do outro, chapas de chute dos dois lados
  const hx = w - 0.09, pz = s.pull * (t / 2);
  p.add(M.brass, CYLN(14), mat(hx, 1.4, pz + s.pull * 0.065, 0, 0.018, 0.9, 0.018));
  for (const y of [1.0, 1.8]) p.add(M.brass, CYLN(10), mat(hx, y, pz + s.pull * 0.035, 0, 0.011, 0.06, 0.011, Math.PI / 2));
  p.box(M.brass, hx - 0.06, 1.15, -s.pull * (t / 2 + 0.004), hx + 0.06, 1.65, -s.pull * (t / 2));
  for (const side of [1, -1]) p.box(M.brass, 0.02, 0.0, side > 0 ? t / 2 : -t / 2 - 0.003, w - 0.02, 0.26, side > 0 ? t / 2 + 0.003 : -t / 2);
  hinges(p, M.brass, h, t, s.pull, 4, 0.016);
  if (s.closer) closerBody(p, M.brass, h, t, -s.pull);
}
function steel(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.steel, paint = s.front === "vestibulo" || s.back === "vestibulo" ? M.steelPaint : M.steelPaintLight;
  // chapa com o recorte do visor (montada em quatro partes) e o vidro aramado com baguetes dos dois lados
  const vx0 = w * 0.3, vx1 = w * 0.7, vy0 = 1.35, vy1 = 1.95;
  p.box(paint, 0, 0, -t / 2, w, vy0, t / 2); p.box(paint, 0, vy1, -t / 2, w, h, t / 2);
  p.box(paint, 0, vy0, -t / 2, vx0, vy1, t / 2); p.box(paint, vx1, vy0, -t / 2, w, vy1, t / 2);
  p.box(M.glassWire, vx0, vy0, -0.004, vx1, vy1, 0.004);
  for (const side of [1, -1]) p.add(paint, frame(vx1 - vx0 + 0.06, vy1 - vy0 + 0.06, 0.035, 0.012, 0.004), onFace(side, w / 2, (vy0 + vy1) / 2, t / 2));
  // bordas boleadas (a chapa dobrada) e as chapas de chute inox
  for (const x of [0.004, w - 0.004]) p.add(paint, CYLN(8), mat(x, h / 2, 0, 0, t / 2, h, t / 2));
  for (const side of [1, -1]) p.box(M.inox, 0.03, 0.0, side > 0 ? t / 2 : -t / 2 - 0.002, w - 0.03, 0.3, side > 0 ? t / 2 + 0.002 : -t / 2);
  // lado de empurrar: barra antipânico (caixas nas pontas e a barra); lado de puxar: alavanca com espelho
  const ps = -s.pull, z = ps * (t / 2);
  p.box(M.inox, 0.12, 0.92, Math.min(z, z + ps * 0.07), 0.24, 1.08, Math.max(z, z + ps * 0.07));
  p.box(M.inox, w - 0.2, 0.9, Math.min(z, z + ps * 0.075), w - 0.04, 1.1, Math.max(z, z + ps * 0.075));
  p.add(M.inox, CYLN(14), mat((0.24 + w - 0.2) / 2, 1.0, z + ps * 0.055, 0, 0.022, w - 0.44, 0.022, 0, Math.PI / 2));
  p.box(M.rubber, (0.24 + w - 0.2) / 2 - 0.1, 0.985, Math.min(z + ps * 0.075, z + ps * 0.08), (0.24 + w - 0.2) / 2 + 0.1, 1.015, Math.max(z + ps * 0.075, z + ps * 0.08));
  const zp = s.pull * (t / 2);
  p.box(M.inox, w - 0.12, 0.95, Math.min(zp, zp + s.pull * 0.008), w - 0.06, 1.15, Math.max(zp, zp + s.pull * 0.008));
  p.add(M.inox, CYLN(10), mat(w - 0.09, 1.05, zp + s.pull * 0.035, 0, 0.012, 0.06, 0.012, Math.PI / 2));
  p.add(M.inox, CYLN(10), mat(w - 0.15, 1.05, zp + s.pull * 0.065, 0, 0.011, 0.13, 0.011, 0, Math.PI / 2));
  hinges(p, M.inox, h, t, s.pull, 3, 0.012);
  if (s.closer) closerBody(p, M.steelPaintLight, h, t, -s.pull);
}
function padded(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.padded;
  p.box(M.mahogany, 0, 0, -t / 2 + 0.015, w, h, t / 2 - 0.015);
  // almofada de couro capitonê (losangos de 22 × 30 cm) com botões e o friso de tachas
  const pw = w - 0.12, ph = h - 0.22, pad = geo(`vestibulo-door-tufted-${pw.toFixed(3)}-${ph.toFixed(3)}`, () => {
    // só a face de couro é subdividida (os losangos afundam nos botões); o lado do estofado é uma caixa fina
    const g = new THREE.PlaneGeometry(pw, ph, 18, 44), pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const u = (x + pw / 2) / 0.22, v = (y + ph / 2) / 0.3, du = u - Math.round(u), dv = v - Math.round(v), du2 = u + 0.5 - Math.round(u + 0.5), dv2 = v + 0.5 - Math.round(v + 0.5);
      const d = Math.min(Math.hypot(du * 0.22, dv * 0.3), Math.hypot(du2 * 0.22, dv2 * 0.3)), edge = Math.min(pw / 2 - Math.abs(x), ph / 2 - Math.abs(y));
      pos.setZ(i, 0.012 + 0.02 * Math.min(1, d / 0.1) * Math.min(1, edge / 0.05));
    }
    g.computeVertexNormals();
    const side = new THREE.BoxGeometry(pw, ph, 0.012).translate(0, 0, 0.006);
    const a = g.toNonIndexed(), b = side.toNonIndexed();
    return mergeGeometries([a, b].map((x) => { const y = new THREE.BufferGeometry(); y.setAttribute("position", x.getAttribute("position")); y.setAttribute("normal", x.getAttribute("normal")); y.setAttribute("uv", x.getAttribute("uv")); return y; }), false) ?? a;
  });
  for (const side of [1, -1]) {
    p.add(M.leather, pad, onFace(side, w / 2, 0.11 + ph / 2, t / 2 - 0.015));
    for (let i = 0; i <= Math.floor(pw / 0.22); i++) for (let j = 0; j <= Math.floor(ph / 0.3); j++) for (const off of [0, 0.5]) {
      const x = -pw / 2 + (i + off) * 0.22, y = -ph / 2 + (j + off) * 0.3; if (Math.abs(x) > pw / 2 - 0.04 || Math.abs(y) > ph / 2 - 0.04) continue;
      p.add(M.leather, geo("vestibulo-door-button", () => new THREE.SphereGeometry(1, 8, 5)), mat(w / 2 + x * side, 0.11 + ph / 2 + y, side * (t / 2 - 0.004), 0, 0.012, 0.012, 0.006));
    }
    const nail = geo("vestibulo-door-nail", () => new THREE.IcosahedronGeometry(1, 0));
    for (let k = 0; k * 0.05 < pw; k++) for (const y of [0.11 + 0.02, 0.11 + ph - 0.02]) p.add(M.brass, nail, mat(0.06 + k * 0.05 + 0.025, y, side * (t / 2 + 0.006), 0, 0.007));
    for (let k = 0; k * 0.05 < ph; k++) for (const x of [0.08, w - 0.08]) p.add(M.brass, nail, mat(x, 0.11 + k * 0.05 + 0.025, side * (t / 2 + 0.006), 0, 0.007));
  }
  // placa oval de empurrar, puxador em D do outro lado, chapa de chute
  const ps = -s.pull;
  p.add(M.brass, geo("vestibulo-door-ovalPlate", () => new THREE.CylinderGeometry(1, 1, 1, 28).rotateX(Math.PI / 2).scale(0.09, 0.2, 0.004)), mat(w - 0.16, 1.3, ps * (t / 2 + 0.006)));
  const dz = s.pull * (t / 2);
  p.add(M.brass, geo("vestibulo-door-dpull", () => new THREE.TorusGeometry(0.11, 0.013, 8, 18, Math.PI).rotateZ(-Math.PI / 2)), mat(w - 0.13, 1.1, dz + s.pull * 0.012, s.pull > 0 ? Math.PI / 2 : -Math.PI / 2));
  for (const side of [1, -1]) p.box(M.brass, 0.03, 0, side > 0 ? t / 2 : -t / 2 - 0.003, w - 0.03, 0.1, side > 0 ? t / 2 + 0.003 : -t / 2);
  hinges(p, M.brass, h, t, s.pull, 3, 0.013);
  if (s.closer) closerBody(p, M.brass, h, t, -s.pull);
}
function stage(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.stage, tex = stageTexture(s.stencil ?? "PALCO");
  const black = solid(`vestibulo-door-stage-${s.stencil}`, "#ffffff", { rough: 0.72 }); (black as THREE.MeshStandardMaterial).map = tex;
  // chapa com o furo do visor redondo; uv da frente = (x/w, y/h) para o estêncil caber na folha
  const slab = geo(`vestibulo-door-stageSlab-${w.toFixed(3)}-${h.toFixed(3)}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, 0); sh.lineTo(w, h); sh.lineTo(0, h); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(w / 2, 1.62, 0.15, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -t / 2);
    const pos = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w, pos.getY(i) / h);
    return g;
  });
  p.add(black, slab);
  for (const side of [1, -1]) p.add(M.rubber, geo("vestibulo-door-portRing", () => new THREE.TorusGeometry(0.155, 0.018, 8, 28)), onFace(side, w / 2, 1.62, t / 2));
  p.add(M.glassWire, geo("vestibulo-door-portGlass", () => new THREE.CircleGeometry(0.15, 28)), mat(w / 2, 1.62, 0));
  const ps = -s.pull, zps = ps * (t / 2), zp = s.pull * (t / 2);
  p.box(M.alu, w - 0.2, 1.05, Math.min(zps, zps + ps * 0.003), w - 0.05, 1.45, Math.max(zps, zps + ps * 0.003));
  p.add(M.alu, CYLN(12), mat(w - 0.1, 1.15, zp + s.pull * 0.05, 0, 0.014, 0.35, 0.014));
  for (const y of [1.0, 1.3]) p.add(M.alu, CYLN(8), mat(w - 0.1, y, zp + s.pull * 0.025, 0, 0.009, 0.05, 0.009, Math.PI / 2));
  for (const side of [1, -1]) p.box(M.alu, 0.03, 0, side > 0 ? t / 2 : -t / 2 - 0.002, w - 0.03, 0.25, side > 0 ? t / 2 + 0.002 : -t / 2);
  hinges(p, M.alu, h, t, s.pull, 3, 0.012);
  if (s.closer) closerBody(p, M.blackDoor, h, t, -s.pull);
}
function french(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.french, st = 0.11, bot = 0.32, top = 0.12, bar = 0.026;
  p.box(M.whitePaint, 0, 0, -t / 2, st, h, t / 2); p.box(M.whitePaint, w - st, 0, -t / 2, w, h, t / 2);
  p.box(M.whitePaint, st, 0, -t / 2, w - st, bot, t / 2); p.box(M.whitePaint, st, h - top, -t / 2, w - st, h, t / 2);
  for (const side of [1, -1]) p.add(M.whitePaint, raised(w - 2 * st - 0.05, bot - 0.1, 0.014, 0.008), onFace(side, w / 2, bot / 2 + 0.02, t / 2));
  const gx0 = st, gx1 = w - st, gy0 = bot, gy1 = h - top;
  p.box(M.glassClear, gx0, gy0, -0.003, gx1, gy1, 0.003);
  p.box(M.whitePaint, w / 2 - bar / 2, gy0, -0.016, w / 2 + bar / 2, gy1, 0.016);
  for (let k = 1; k < 5; k++) { const y = gy0 + k * (gy1 - gy0) / 5; p.box(M.whitePaint, gx0, y - bar / 2, -0.016, gx1, y + bar / 2, 0.016); }
  // cremona (vareta de latão) na borda do encontro e maçanetas dos dois lados
  p.add(M.brass, CYLN(10), mat(w - 0.05, h / 2, s.pull * (t / 2 + 0.012), 0, 0.007, h - 0.2, 0.007));
  for (const side of [1, -1]) { p.add(M.brass, geo("vestibulo-door-rose", () => new THREE.CylinderGeometry(0.028, 0.028, 0.01, 18).rotateX(Math.PI / 2)), onFace(side, w - 0.06, 1.05, t / 2 + 0.005)); p.add(M.brass, CYLN(10), mat(w - 0.12, 1.05, side * (t / 2 + 0.05), 0, 0.009, 0.11, 0.009, 0, Math.PI / 2)); }
  hinges(p, M.brass, h, t, s.pull, 3, 0.011);
}
function jib(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.jib, salaoSide = s.front === "salao" ? 1 : -1;
  p.box(M.steelPaintLight, 0, 0, -t / 2, w, h, t / 2);
  // do lado do salão: a mesma cantaria da parede (uv no referencial da parede: u = posição/2,4 m, v = altura/1,2 m, as
  // juntas continuam as da parede) e o rodapé de mármore negro da casca; nenhuma ferragem à vista além da fechadura
  const face = new THREE.PlaneGeometry(w - 0.004, h - 0.18, 1, 1);
  if (salaoSide < 0) face.rotateY(Math.PI);                                       // virada para o verso (−z)
  face.translate(w / 2, 0.18 + (h - 0.18) / 2, salaoSide * (t / 2 + 0.002));
  const fp = face.getAttribute("position") as THREE.BufferAttribute, fu = face.getAttribute("uv") as THREE.BufferAttribute, U = s.wallUv ?? { origin: 0, dir: 1 };
  for (let i = 0; i < fp.count; i++) fu.setXY(i, (U.origin + U.dir * fp.getX(i)) / 2.4, fp.getY(i) / 1.2);
  p.add(M.limestone, face);
  { const z0 = salaoSide * (t / 2), z1 = salaoSide * (t / 2 + 0.022); p.box(M.marbleDark, 0, 0, Math.min(z0, z1), w, 0.18, Math.max(z0, z1)); }
  // do lado do serviço: barra de empurrar e chapa de chute
  const ss = -salaoSide, zs = ss * (t / 2);
  p.add(M.inox, CYLN(12), mat(w / 2, 1.0, zs + ss * 0.06, 0, 0.02, w - 0.3, 0.02, 0, Math.PI / 2));
  for (const x of [0.15, w - 0.15]) p.box(M.inox, x - 0.03, 0.96, Math.min(zs, zs + ss * 0.07), x + 0.03, 1.04, Math.max(zs, zs + ss * 0.07));
  p.box(M.inox, 0.03, 0, Math.min(zs, zs + ss * 0.002), w - 0.03, 0.28, Math.max(zs, zs + ss * 0.002));
  hinges(p, M.inox, h, t, ss, 2, 0.01);
}
function vault(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.vault, out = s.front === "galeria" ? 1 : -1;
  const jewel = solid("vestibulo-door-vaultJewel", "#ffffff", { metal: 0.95, rough: 0.28, env: 1.2 }); (jewel as THREE.MeshStandardMaterial).map = jeweledTexture();
  p.box(M.vaultSteel, 0, 0, -t / 2, w, h, t / 2);
  // face de fora: quadro em dois degraus, painel guilhochê, volante, disco do segredo e placa
  p.add(M.vaultDark, frame(w - 0.08, h - 0.08, 0.12, 0.03, 0.01), onFace(out, w / 2, h / 2, t / 2));
  p.add(M.vaultSteel, frame(w - 0.32, h - 0.32, 0.06, 0.05, 0.012), onFace(out, w / 2, h / 2, t / 2));
  p.box(jewel, 0.22, 0.22, out > 0 ? t / 2 : -t / 2 - 0.01, w - 0.22, h - 0.22, out > 0 ? t / 2 + 0.01 : -t / 2);
  const cx = w * 0.5, cy = h * 0.47, zw = out * (t / 2 + 0.11);
  p.add(M.chrome, geo("vestibulo-door-wheel", () => new THREE.TorusGeometry(0.3, 0.03, 10, 36)), mat(cx, cy, zw, out > 0 ? 0 : Math.PI));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.add(M.chrome, CYLN(10), mat(cx + Math.cos(a) * 0.15, cy + Math.sin(a) * 0.15, zw, 0, 0.018, 0.3, 0.018, 0, a - Math.PI / 2)); p.add(M.chrome, geo("vestibulo-door-knob", () => new THREE.SphereGeometry(0.04, 12, 8)), mat(cx + Math.cos(a) * 0.36, cy + Math.sin(a) * 0.36, zw)); }
  p.add(M.chrome, CYLN(20), mat(cx, cy, out * (t / 2 + 0.06), 0, 0.07, 0.12, 0.07, Math.PI / 2));
  p.add(M.vaultDark, CYLN(32), mat(cx, cy + 0.62, out * (t / 2 + 0.03), 0, 0.12, 0.06, 0.12, Math.PI / 2));
  p.add(M.chrome, CYLN(32), mat(cx, cy + 0.62, out * (t / 2 + 0.065), 0, 0.09, 0.02, 0.09, Math.PI / 2));
  p.box(M.brass, cx - 0.22, h - 0.42, out > 0 ? t / 2 + 0.01 : -t / 2 - 0.016, cx + 0.22, h - 0.3, out > 0 ? t / 2 + 0.016 : -t / 2 - 0.01);
  // seis trancas cromadas saindo da borda e as duas dobradiças cilíndricas
  for (let k = 0; k < 6; k++) p.add(M.chrome, CYLN(14), mat(w + 0.04, 0.35 + k * (h - 0.7) / 5, 0, 0, 0.045, 0.16, 0.045, 0, Math.PI / 2));
  for (const y of [0.55, h - 0.55]) { p.add(M.vaultDark, CYLN(20), mat(-0.02, y, out * (t / 2 - 0.02), 0, 0.075, 0.42, 0.075)); p.add(M.chrome, CYLN(20), mat(-0.02, y + 0.23, out * (t / 2 - 0.02), 0, 0.06, 0.04, 0.06)); }
  // face de dentro: o mecanismo das trancas atrás do vidro (barras, engrenagem central)
  const zi = -out * (t / 2 + 0.03);
  p.box(M.vaultDark, 0.2, 0.25, Math.min(zi, -out * t / 2), w - 0.12, h - 0.25, Math.max(zi, -out * t / 2));
  for (let k = 0; k < 6; k++) p.box(M.chrome, w * 0.45, 0.35 + k * (h - 0.7) / 5 - 0.03, Math.min(zi, zi - out * 0.03), w - 0.06, 0.35 + k * (h - 0.7) / 5 + 0.03, Math.max(zi, zi - out * 0.03));
  p.add(M.brass, geo("vestibulo-door-gear", () => { const sh = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2, r = i % 4 < 2 ? 0.2 : 0.17; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); }), onFace(-out, w * 0.42, h / 2, t / 2 + 0.03));
  p.box(M.glassClear, 0.24, 0.3, Math.min(zi - out * 0.06, zi - out * 0.065), w - 0.16, h - 0.3, Math.max(zi - out * 0.06, zi - out * 0.065));
}

/* ---------- mola aérea: braço articulado ---------- */
/**
 * Braço da mola (dois elos numa malha só, do lado de empurrar `side`): o eixo fica na folha, a sapata pende do forro do
 * vão; a cada quadro o cotovelo é resolvido pelo ângulo atual da folha (`holder.rotation.y`) e os vértices são refeitos.
 */
export const CLOSER_SHOE: [number, number] = [0.5, 0.12];
export function closerArm(h: number, t: number, side: number, holder: THREE.Object3D, m: THREE.Material): THREE.Mesh {
  const pull = side, S = new THREE.Vector2(0.12, side * (t / 2 + 0.06)), F0 = new THREE.Vector2(CLOSER_SHOE[0], side * Math.max(CLOSER_SHOE[1], t / 2 + 0.09)), a = 0.26, b = 0.3, y = h - 0.115;
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), base = (g.getAttribute("position") as THREE.BufferAttribute).array.slice() as Float32Array;
  const pos = new Float32Array(base.length * 2); const geom = new THREE.BufferGeometry(); geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(pos.length), 3)); geom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  const mesh = new THREE.Mesh(geom, m); mesh.frustumCulled = false; mesh.castShadow = false;
  let last = NaN;
  const seg = (off: number, p: THREE.Vector2, q: THREE.Vector2, yy: number, wd: number) => {
    const dx = q.x - p.x, dz = q.y - p.y, len = Math.hypot(dx, dz) || 1e-4, ux = dx / len, uz = dz / len;
    for (let i = 0; i < base.length; i += 3) {
      const lx = base[i] * len, ly = base[i + 1] * 0.022, lz = base[i + 2] * wd;
      pos[off + i] = p.x + ux * (lx + len / 2) - uz * lz; pos[off + i + 1] = yy + ly; pos[off + i + 2] = p.y + uz * (lx + len / 2) + ux * lz;
    }
  };
  const solve = () => {
    const r = holder.rotation.y; if (r === last) return; last = r;
    const c = Math.cos(r), s = Math.sin(r), F = new THREE.Vector2(F0.x * c - F0.y * s, F0.x * s + F0.y * c);
    const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, F.distanceTo(S))), u = F.clone().sub(S).normalize(), l = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - l * l));
    // cotovelo sempre do mesmo lado da linha eixo→sapata (o lado de fora quando fechada): o braço dobra sem pular
    const n = pull < 0 ? new THREE.Vector2(u.y, -u.x) : new THREE.Vector2(-u.y, u.x);
    const E = S.clone().addScaledVector(u, l).addScaledVector(n, hh);
    seg(0, S, E, y, 0.03); seg(base.length, E, F, y - 0.012, 0.022);
    geom.getAttribute("position").needsUpdate = true; geom.computeVertexNormals(); geom.computeBoundingSphere();
  };
  solve();
  mesh.onBeforeRender = () => { solve(); };
  return mesh;
}

/** Folha pronta: um grupo com uma malha por material (geometria reaproveitada entre folhas iguais). */
const cache = new Map<string, { m: THREE.Material; g: THREE.BufferGeometry }[]>();
export function buildLeaf(s: LeafSpec, P: Palette, q: Quality): THREE.Group {
  const key = `${s.style}|${s.w.toFixed(3)}|${s.h.toFixed(3)}|${s.pull}|${s.front}|${s.back}|${s.stencil ?? ""}|${s.closer ? 1 : 0}|${s.wallUv ? `${s.wallUv.origin}/${s.wallUv.dir}` : ""}|${q}`;
  let parts = cache.get(key);
  if (!parts) {
    const p = new Parts(), M = doorMats(P);
    ({ grand, steel, padded, stage, french, jib, vault } as Record<LeafStyle, (p: Parts, M: DoorMats, s: LeafSpec) => void>)[s.style](p, M, s);
    parts = p.done(); cache.set(key, parts);
  }
  const g = new THREE.Group();
  for (const { m, g: geom } of parts) { const me = new THREE.Mesh(geom, m); me.castShadow = true; me.receiveShadow = true; g.add(me); }
  return g;
}
export { doorMats };
