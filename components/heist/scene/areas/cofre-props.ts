/*
 * MET Gala Heist v2 — Sala das Joias (Z08): os móveis da planta desenhados pela área, cada um na forma de colisão dele.
 *  · pedestal do diamante (peça principal): base octogonal em dois degraus de Nero Marquina com filetes de latão, fuste
 *    canelado com os três anéis da trava (os símbolos da placa-pista), capitel, tampo, campânula de vidro grosso com
 *    cúpula e remate de latão, almofada de veludo, o diamante e o brilho dele (somem quando o diamante sai);
 *  · vitrines de parede (furto): gabinete de nogueira com portas almofadadas, caixa de vidro com colunetas de latão e as
 *    joias (tiaras, pérolas, brincos e broches), dentro de uma alcova em arco forrada de veludo; a do vão da janela é
 *    baixa e de tampo inclinado (anéis), para a janela continuar livre;
 *  · conservação (fixture): mesa de restauração com suportes acolchoados, mapoteca (gaveteiro horizontal), estação
 *    fotográfica de documentação e carrinho de acervo — com luvas brancas, lupas, laudo e caixas livres de ácido.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, CYL0, SPH, geo } from "../interior-batch";
import { fabric } from "../interior-mats";
import { diamondGeometry, type LightAnchor, type PropsCtx } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import { type Fr, archFill, archRing, at, atlasPlane, bx, cy, frame, glassEdge, langOf, lathe, lit, once, paint, plain, planeUp, raisedPanel, thickGlass } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";
import { earrings, jewelBust, necklace, pearls, ring, tiara } from "./galeria-trajes";
import { neroMat, reportTex, ringTex, tagAtlas } from "./cofre-tex";

const ROOM = "cofre";
export const brassC = () => plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 });
export const goldC = () => plain("cofre-ouroVelho", "#b48a3c", { metal: 1, rough: 0.36 });
export const velvetPlum = (q: PropsCtx["q"]) => fabric("cofre-veludoAmeixa", "#2c0a1e", q, { sheen: "#8a3a6a", rough: 0.8 });
export const velvetBlack = (q: PropsCtx["q"]) => fabric("cofre-veludoPreto", "#0c0b0e", q, { rough: 0.85 });
const vidroC = () => thickGlass("cofre-vidro");
const arestaC = () => glassEdge("cofre-vidroAresta");
export const steelWhite = () => plain("cofre-acoBranco", "#d9dad6", { metal: 0.35, rough: 0.42 });
export const steelGrey = () => plain("cofre-acoCinza", "#8d9298", { metal: 0.7, rough: 0.38 });
const anchor = (c: PropsCtx, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room: ROOM as InteriorRoom, ...o });
/** Etiqueta do atlas pequeno (gavetas, caixas, vitrines). */
export function tagMat(c: { q: PropsCtx["q"]; copy: PropsCtx["copy"] }): THREE.MeshStandardMaterial {
  const t = tagAtlas(c.q, langOf(c.copy));
  return once(`cofre-etiquetaMat-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.14 }));
}
export const tagGeo = (i: number) => atlasPlane("cofre-etq", 4, 4, i);
/** Nogueira do mobiliário (a mesma da paleta) e a luz das vitrines (apaga quando cortam o quadro de luz: cofre.ts). */
export const caseLight = () => lit("cofre-luzVitrine", "#fff4e2", 2.2);

/* ======================= pedestal ======================= */
export function pedestal(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "circle") return;
  const s = p.shape, F = frame(s.x, s.z, 0), q = c.q, nero = neroMat(q), br = brassC();
  // base octogonal em dois degraus com filetes de latão
  c.batch.add(ROOM, nero, lathe("cofre-pedDegrau1", [[0, 0], [0.55, 0], [0.55, 0.08], [0, 0.08]], 8), F(0, 0, 0, Math.PI / 8), { cast: true });
  c.batch.add(ROOM, br, lathe("cofre-pedFilete1", [[0.548, 0.078], [0.556, 0.078], [0.556, 0.086], [0.548, 0.086]], 8), F(0, 0, 0, Math.PI / 8));
  c.batch.add(ROOM, nero, lathe("cofre-pedDegrau2", [[0, 0], [0.47, 0], [0.47, 0.08], [0, 0.08]], 8), F(0, 0.08, 0, Math.PI / 8), { cast: true });
  c.batch.add(ROOM, br, lathe("cofre-pedFilete2", [[0.468, 0.078], [0.476, 0.078], [0.476, 0.086], [0.468, 0.086]], 8), F(0, 0.08, 0, Math.PI / 8));
  // base do fuste (toro e escócia), fuste canelado, os três anéis da trava com os símbolos e os aros entre eles
  c.batch.add(ROOM, nero, lathe("cofre-pedToro", [[0, 0], [0.4, 0], [0.41, 0.025], [0.395, 0.05], [0.36, 0.06], [0.355, 0.08], [0, 0.08]], 40), F(0, 0.16, 0), { cast: true });
  c.batch.add(ROOM, nero, geo("cofre-canelado", () => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), pp = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 - 0.05 * Math.max(0, Math.cos(a * 20)) ** 0.6; pp.setXYZ(i, x * k, pp.getY(i), z * k); }
    g.computeVertexNormals(); return g;
  }), F(0, 0.24, 0, 0, 0.335, 0.62, 0.335), { cast: true });
  const rt = ringTex(), ringM = once("cofre-anelTrava", () => new THREE.MeshStandardMaterial({ map: rt, metalness: 0.9, roughness: 0.3, color: "#e8c77f", emissiveMap: rt, emissive: new THREE.Color("#ffd98a"), emissiveIntensity: 0.12 }));
  for (const y of [0.42, 0.56, 0.7]) {
    c.batch.add(ROOM, ringM, geo("cofre-anelBanda", () => new THREE.CylinderGeometry(0.355, 0.355, 0.1, 64, 1, true)), F(0, y, 0));
    for (const e of [-0.051, 0.051]) c.batch.add(ROOM, br, geo("cofre-anelAro", () => new THREE.TorusGeometry(0.357, 0.006, 6, 64).rotateX(Math.PI / 2)), F(0, y + e, 0));
  }
  // capitel, tampo com borda de latão
  c.batch.add(ROOM, nero, lathe("cofre-pedCapitel", [[0, 0], [0.34, 0], [0.36, 0.03], [0.4, 0.07], [0.44, 0.11], [0.45, 0.14], [0, 0.14]], 40), F(0, 0.86, 0), { cast: true });
  c.batch.add(ROOM, nero, CYL0(48), F(0, 1.0, 0, 0, 0.46, 0.05, 0.46));
  c.batch.add(ROOM, br, geo("cofre-tampoAro", () => new THREE.TorusGeometry(0.462, 0.01, 6, 64).rotateX(Math.PI / 2)), F(0, 1.025, 0));
  // placa na frente do degrau
  c.batch.add(ROOM, br, geo("cofre-placaPed", () => new THREE.BoxGeometry(1, 1, 1)), F(0, 0.12, 0.437, 0, 0.24, 0.055, 0.006));
  const pl = paint(`cofre-placaPedTex-${langOf(c.copy)}`, 512, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#e2c27a"); grd.addColorStop(1, "#a77f37"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2c1f0a"; g.font = "600 40px Georgia, 'DejaVu Serif', serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(GAL_COPY[langOf(c.copy)].pedestal, w / 2, h / 2);
  });
  c.batch.add(ROOM, once("cofre-placaPedMat", () => new THREE.MeshStandardMaterial({ map: pl, metalness: 0.7, roughness: 0.35 })), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(0, 0.12, 0.441, 0, 0.22, 0.045, 1));
  // almofada de veludo capitonê com o botão no centro
  c.batch.add(ROOM, velvetPlum(q), lathe("cofre-almofada", [[0, 0], [0.14, 0], [0.155, 0.03], [0.15, 0.06], [0.12, 0.075], [0.05, 0.078], [0, 0.072]], 32), F(0, 1.05, 0));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; c.batch.add(ROOM, br, CYL0(6), F(Math.cos(a) * 0.035, 1.118, Math.sin(a) * 0.035, 0, 0.003, 0.05, 0.003, Math.cos(a) * 0.35, -Math.sin(a) * 0.35)); }
  // campânula: cilindro de vidro grosso (duas faces) com cúpula, aros de latão e o remate
  // vidro da campânula mais limpo que o das vitrines (os feixes da cúpula atravessam: com o vidro grosso ela ficava leitosa)
  const G = thickGlass("cofre-vidroCampanula", { opacity: 0.06, tint: "#eef4f6" }), E = arestaC();
  c.batch.add(ROOM, br, lathe("cofre-campBase", [[0.205, 0], [0.245, 0], [0.245, 0.03], [0.235, 0.04], [0.205, 0.04]], 48), F(0, 1.05, 0));
  for (const r of [0.225, 0.213]) c.batch.add(ROOM, G, geo(`cofre-campVidro${r}`, () => new THREE.CylinderGeometry(r, r, 0.34, 64, 1, true).translate(0, 0.17, 0)), F(0, 1.09, 0));
  c.batch.add(ROOM, G, geo("cofre-campCupula", () => new THREE.SphereGeometry(0.225, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.42, 1)), F(0, 1.43, 0));
  c.batch.add(ROOM, E, geo("cofre-campBorda", () => new THREE.TorusGeometry(0.219, 0.007, 6, 64).rotateX(Math.PI / 2)), F(0, 1.43, 0));
  c.batch.add(ROOM, br, lathe("cofre-remate", [[0, 0], [0.03, 0], [0.024, 0.02], [0.012, 0.035], [0.02, 0.05], [0.008, 0.07], [0, 0.075]], 16), F(0, 1.52, 0));
  // o diamante (lapidação brilhante) e o brilho: aparecem só enquanto ele está no pedestal (interior-fx)
  const diamond = new THREE.Mesh(diamondGeometry(), new THREE.MeshPhysicalMaterial({ color: "#f4fbff", metalness: 0.05, roughness: 0.0, envMapIntensity: 3.2, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.6, iridescenceIOR: 1.6, flatShading: true }));
  diamond.position.copy(at(F, 0, 1.2, 0)); diamond.scale.setScalar(0.07); diamond.userData.room = ROOM; c.group.add(diamond);
  c.animated.push({ kind: "diamond", mesh: diamond, room: ROOM });
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex(), color: new THREE.Color("#ffffff").multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glint.position.copy(at(F, 0.03, 1.27, 0.02)); glint.scale.setScalar(0.2); glint.renderOrder = 6; glint.userData.room = ROOM; c.group.add(glint);
  c.animated.push({ kind: "glint", mesh: glint, room: ROOM });
  anchor(c, at(F, 0, 3.8, 0), "#f2f6ff", 14, 6);
}
function glintTex(): THREE.Texture {
  return paint("cofre-brilho", 128, 128, (g, w) => {
    const c = w / 2, grd = g.createRadialGradient(c, c, 0, c, c, c * 0.35); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, w);
    for (const [a, l] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]] as [number, number][]) {
      g.save(); g.translate(c, c); g.rotate(a); const lg = g.createLinearGradient(-c * l, 0, c * l, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.95)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-c * l, 0); g.lineTo(0, -2.2); g.lineTo(c * l, 0); g.lineTo(0, 2.2); g.closePath(); g.fill(); g.restore();
    }
  }, { srgb: false });
}

/* ======================= vitrines de parede ======================= */
/**
 * Vitrine de joias encostada na parede (a frente olha para dentro da sala). As do lado oeste e a do canto nordeste são
 * altas, dentro de uma alcova em arco; a do vão da janela é baixa, de tampo inclinado.
 */
export function jewelCase(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, sx = s.x1 - s.x0, sz = s.z1 - s.z0, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const west = sz > sx, L = west ? sz : sx, D = west ? sx : sz, F = frame(cx, cz, west ? Math.PI / 2 : 0);
  const kind = west ? (cz < -14 ? 0 : 1) : cx < -17 ? 3 : 2;            // 0 tiaras, 1 pérolas, 2 brincos e broches, 3 anéis
  if (kind === 3) return lowCase(c, F, L, D);
  const q = c.q, wal = c.P.walnut, br = brassC(), back = 0.4;            // a 0,4 m da parede
  // plinto de mármore, gabinete de nogueira com portas almofadadas e espelhos de fechadura
  bx(c.batch, ROOM, neroMat(q), F(0, 0, 0.0, 0, L - 0.04, 0.1, D - 0.04));
  bx(c.batch, ROOM, wal, F(0, 0.1, 0, 0, L, 0.74, D), true);
  const n = Math.max(2, Math.round(L / 0.75)), dw = L / n;
  for (let k = 0; k < n; k++) {
    const x = -L / 2 + (k + 0.5) * dw;
    c.batch.add(ROOM, wal, raisedPanel(dw - 0.12, 0.5, 0.018, 0.03), F(x, 0.2, D / 2));
    c.batch.add(ROOM, br, CYL(12), F(x + dw / 2 - 0.08, 0.62, D / 2 + 0.006, 0, 0.012, 0.008, 0.012, Math.PI / 2));
  }
  bx(c.batch, ROOM, br, F(0, 0.84, 0, 0, L + 0.01, 0.022, D + 0.01));
  bx(c.batch, ROOM, velvetBlack(q), F(0, 0.862, 0, 0, L - 0.02, 0.012, D - 0.02));
  // caixa de vidro com colunetas e moldura de latão; a fita de luz por dentro do tampo
  const G = vidroC(), E = arestaC(), y0 = 0.874, y1 = 1.62, t = 0.016;
  bx(c.batch, ROOM, G, F(0, y0, D / 2 - t / 2, 0, L, y1 - y0, t)); bx(c.batch, ROOM, G, F(0, y0, -D / 2 + t / 2, 0, L, y1 - y0, t));
  for (const e of [-1, 1]) bx(c.batch, ROOM, G, F(e * (L / 2 - t / 2), y0, 0, 0, t, y1 - y0, D - 2 * t));
  bx(c.batch, ROOM, G, F(0, y1, 0, 0, L, t, D));
  bx(c.batch, ROOM, E, F(0, y1, D / 2 - t / 2, 0, L, t + 0.002, t + 0.002));
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) bx(c.batch, ROOM, br, F(ex * (L / 2 - 0.009), y0, ez * (D / 2 - 0.009), 0, 0.018, y1 - y0 + t, 0.018));
  bx(c.batch, ROOM, br, F(0, y1 + t, 0, 0, L + 0.02, 0.04, D + 0.02));
  bx(c.batch, ROOM, caseLight(), F(0, y1 - 0.006, D / 2 - 0.05, 0, L - 0.1, 0.006, 0.012));
  // alcova: costas de veludo ameixa contra a parede, pilastras de nogueira nas pontas e o arco por cima
  const Bz = -D / 2 - back;
  for (const e of [-1, 1]) { bx(c.batch, ROOM, wal, F(e * (L / 2 + 0.1), 0, Bz + (back + 0.02) / 2, 0, 0.2, 1.9, back + 0.02), true); bx(c.batch, ROOM, br, F(e * (L / 2 + 0.1), 0.9, Bz + back + 0.021, 0, 0.12, 0.95, 0.004)); }
  c.batch.add(ROOM, wal, archRing(`cofre-alcova-${L}`, L / 2 + 0.2, 0.18, 1.9, back + 0.02, 0.01), F(0, 0, Bz), { cast: true });
  c.batch.add(ROOM, velvetPlum(q), archFill(`cofre-alcova-${L}`, L / 2 + 0.2, 1.9), F(0, 0, Bz + 0.012));
  c.batch.add(ROOM, lit("cofre-luzNicho", "#ffcfa0", 0.55, { additive: true, map: paint("cofre-manchaNicho", 128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.5, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, { srgb: false }) }), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(0, 2.2, Bz + 0.02, 0, L + 0.3, 1.8, 1));
  // inscrição de latão no alto da alcova
  c.batch.add(ROOM, tagMat(c), tagGeo(12 + kind), F(0, 2.45, Bz + 0.025, 0, 0.72, 0.18, 1));
  // as joias
  const y = 0.874, M = c.inst;
  if (kind === 0) {
    for (const [x, r] of [[-1.0, 0], [0, 1], [1.0, 2]] as [number, number][]) {
      c.batch.add(ROOM, velvetPlum(q), lathe("cofre-suporteTiara", [[0, 0], [0.11, 0], [0.11, 0.06], [0.09, 0.08], [0, 0.085]], 24), F(x, y, -0.02));
      tiara(c.batch, M, ROOM, F, x, y + 0.09, -0.02, 1.1, r === 1 ? plain("cofre-esmeralda", "#1f8a5a", { rough: 0.03, env: 3, emissive: "#0a3a20", ei: 0.4 }) : undefined);
    }
  } else if (kind === 1) {
    for (const x of [-1.0, 0, 1.0]) { jewelBust(c.batch, ROOM, F, x, y, -0.04, 1.0); pearls(M, ROOM, F, x, y + 0.255, 0.015, 0.075); }
    necklace(M, ROOM, F, 0, y + 0.24, 0.035, 0.065, 18, plain("cofre-safira", "#2a4bd8", { rough: 0.03, env: 3, emissive: "#1a2a80", ei: 0.4 }), "cofre-colar");
  } else {
    earrings(c.batch, M, ROOM, F, -0.3, y, -0.02, plain("cofre-rubi", "#c2102a", { rough: 0.03, env: 3, emissive: "#600010", ei: 0.4 }));
    earrings(c.batch, M, ROOM, F, 0.25, y, -0.02, plain("cofre-perolaGota", "#f3ece0", { rough: 0.18, env: 1.6 }));
  }
  anchor(c, at(F, 0, 1.55, D / 2 + 0.3), "#fff4e6", 3.5, 2.6);
}
/** Vitrine baixa de tampo inclinado sob a janela (anéis num estojo de veludo e dois broches). */
function lowCase(c: PropsCtx, F: Fr, L: number, D: number) {
  const q = c.q, wal = c.P.walnut, br = brassC();
  bx(c.batch, ROOM, neroMat(q), F(0, 0, 0, 0, L - 0.04, 0.08, D - 0.04));
  bx(c.batch, ROOM, wal, F(0, 0.08, 0, 0, L, 0.6, D), true);
  c.batch.add(ROOM, wal, raisedPanel(L - 0.16, 0.42, 0.016, 0.03), F(0, 0.16, D / 2));
  bx(c.batch, ROOM, br, F(0, 0.68, 0, 0, L + 0.01, 0.018, D + 0.01));
  // tampo inclinado: frente 0,76 m, fundo 0,88 m (abaixo do peitoril da janela, a 0,9 m)
  const ang = Math.atan2(0.12, D), mid = 0.82, cs = Math.cos(ang), sn = Math.sin(ang);
  const T: Fr = (x, yy, z, ry = 0, s1 = 1, s2 = s1, s3 = s1) => F(x, mid + yy * cs - z * sn, z * cs + yy * sn, ry, s1, s2, s3, ang);
  for (const e of [-1, 1]) bx(c.batch, ROOM, wal, F(e * (L / 2 - 0.01), 0.68, 0, 0, 0.02, 0.15, D));
  bx(c.batch, ROOM, wal, F(0, 0.68, -D / 2 + 0.01, 0, L, 0.2, 0.02));
  bx(c.batch, ROOM, velvetBlack(q), T(0, -0.07, 0, 0, L - 0.04, 0.01, D / Math.cos(ang) - 0.04));
  bx(c.batch, ROOM, vidroC(), T(0, 0, 0, 0, L, 0.012, D / Math.cos(ang)));
  for (const e of [-1, 1]) bx(c.batch, ROOM, br, T(e * (L / 2 - 0.01), -0.08, 0, 0, 0.02, 0.095, D / Math.cos(ang)));
  bx(c.batch, ROOM, br, T(0, -0.08, D / 2 - 0.01, 0, L, 0.095, 0.02)); bx(c.batch, ROOM, br, T(0, -0.08, -D / 2 + 0.01, 0, L, 0.095, 0.02));
  c.batch.add(ROOM, velvetPlum(q), geo("cofre-estojo", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), T(-0.25, -0.065, 0, 0, 0.4, 0.03, 0.22));
  for (let k = 0; k < 6; k++) ring(c.inst, ROOM, T, -0.4 + (k % 3) * 0.075, -0.035, -0.05 + Math.floor(k / 3) * 0.1, [plain("cofre-rubi", "#c2102a", { rough: 0.03, env: 3, emissive: "#600010", ei: 0.4 }), plain("cofre-safira", "#2a4bd8", { rough: 0.03, env: 3, emissive: "#1a2a80", ei: 0.4 }), plain("cofre-esmeralda", "#1f8a5a", { rough: 0.03, env: 3, emissive: "#0a3a20", ei: 0.4 })][k % 3]);
  for (const x of [0.15, 0.4]) for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.inst.add(ROOM, "galeria-broche", geo("galeria-gem", () => new THREE.OctahedronGeometry(1, 0).scale(1, 0.8, 1)), plain("galeria-cristal", "#f4f8ff", { rough: 0.02, metal: 0.1, env: 3, emissive: "#9fb4ff", ei: 0.35 }), T(x + Math.cos(a) * 0.025, -0.055, Math.sin(a) * 0.025, a, 0.008)); }
  c.batch.add(ROOM, tagMat(c), geo("cofre-etqDeitada", () => tagGeo(15).clone().rotateX(-Math.PI / 2)), T(0.25, -0.064, D / 2 - 0.06, 0, 0.36, 1, 0.09));
  anchor(c, at(F, 0, 1.3, D / 2 + 0.3), "#fff4e6", 2.2, 2.2);
}

/* ======================= conservação ======================= */
export function fixture(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, yaw = p.yaw ?? 0, swap = Math.abs(Math.sin(yaw)) > 0.5, w = swap ? s.z1 - s.z0 : s.x1 - s.x0, d = swap ? s.x1 - s.x0 : s.z1 - s.z0;
  const F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, yaw);
  switch (p.model) {
    case "restorationTable": return restorationTable(c, F, w, d);
    case "flatFiles": return flatFiles(c, F, w, d);
    case "photoStation": return photoStation(c, F, w, d);
    case "collectionCart": return collectionCart(c, F, w, d);
  }
}
const muslin = (q: PropsCtx["q"]) => fabric("cofre-musselina", "#ece6d6", q, { rough: 0.95 });
const gloveWhite = (q: PropsCtx["q"]) => fabric("cofre-luvaAlgodao", "#f5f3ee", q, { rough: 0.95 });
/** Par de luvas brancas de algodão deitadas (palma, quatro dedos e o polegar). */
function gloves(c: PropsCtx, F: Fr, x: number, y: number, z: number, r: number) {
  const m = gloveWhite(c.q);
  for (const k of [0, 1]) {
    const gx = x + k * 0.1, gz = z + k * 0.03, rr = r + k * 0.25;
    c.batch.add(ROOM, m, geo("cofre-palma", () => new THREE.SphereGeometry(1, 12, 8).scale(0.045, 0.012, 0.07)), F(gx, y + 0.01, gz, rr));
    c.batch.add(ROOM, m, geo("cofre-punho", () => new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12).rotateX(Math.PI / 2).scale(1, 0.3, 1)), F(gx - Math.sin(rr) * 0.1, y + 0.01, gz - Math.cos(rr) * 0.1, rr));
    for (let f = 0; f < 4; f++) c.batch.add(ROOM, m, geo("cofre-dedo", () => new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateX(Math.PI / 2)), F(gx + Math.cos(rr) * (-0.025 + f * 0.017) + Math.sin(rr) * 0.1, y + 0.01, gz - Math.sin(rr) * (-0.025 + f * 0.017) + Math.cos(rr) * 0.1, rr));
    c.batch.add(ROOM, m, geo("cofre-dedo", () => new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateX(Math.PI / 2)), F(gx + Math.cos(rr) * 0.055 + Math.sin(rr) * 0.03, y + 0.01, gz - Math.sin(rr) * 0.055 + Math.cos(rr) * 0.03, rr + 0.7));
  }
}
/** Lupa de mão (aro preto, lente e cabo). */
function loupe(c: PropsCtx, F: Fr, x: number, y: number, z: number, r: number) {
  c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), geo("cofre-lupaAro", () => new THREE.TorusGeometry(0.04, 0.006, 8, 24).rotateX(Math.PI / 2)), F(x, y + 0.008, z, r));
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL0(24), F(x, y + 0.004, z, r, 0.038, 0.006, 0.038));
  c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL(8), F(x + Math.sin(r) * 0.1, y + 0.008, z + Math.cos(r) * 0.1, r, 0.008, 0.11, 0.008, Math.PI / 2));
}
/** Mesa de restauração (1,8 × 0,9 × 0,9 m): estrutura de aço branco, tampo acolchoado com musselina, suportes e ferramentas. */
function restorationTable(c: PropsCtx, F: Fr, w: number, d: number) {
  const q = c.q, sw = steelWhite(), y = 0.86;
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(ex * (w / 2 - 0.05), 0, ez * (d / 2 - 0.05), 0, 0.045, 0.82, 0.045), true);
  for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(0, 0.2, ez * (d / 2 - 0.05), 0, w - 0.1, 0.035, 0.035));
  bx(c.batch, ROOM, sw, F(0, 0.22, 0, 0, w - 0.12, 0.02, d - 0.12));                                       // prateleira de baixo
  for (let k = 0; k < 3; k++) bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(-0.5 + k * 0.42, 0.24, 0.02, 0.05 * (k - 1), 0.38, 0.12, 0.3));
  bx(c.batch, ROOM, sw, F(0, 0.8, 0, 0, w, 0.03, d), true);
  c.batch.add(ROOM, muslin(q), geo("cofre-tampoAcolchoado", () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, 0.5, 0)), F(0, 0.83, 0, 0, w - 0.02, 0.03, d - 0.02));
  // manivela de altura
  c.batch.add(ROOM, sw, CYL(8), F(w / 2 + 0.03, 0.62, 0.2, 0, 0.008, 0.06, 0.008, 0, Math.PI / 2)); c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL(8), F(w / 2 + 0.06, 0.58, 0.2, 0, 0.012, 0.08, 0.012));
  // suportes acolchoados: rolos de musselina, anel para a tiara e o busto de veludo com um colar
  for (const [x, z, r] of [[-0.55, -0.15, 0.1], [-0.55, 0.12, -0.05], [0.05, -0.28, 1.5]] as [number, number, number][]) c.batch.add(ROOM, muslin(q), geo("cofre-rolo", () => new THREE.CapsuleGeometry(0.035, 0.36, 4, 10).rotateZ(Math.PI / 2)), F(x, y + 0.035, z, r));
  c.batch.add(ROOM, muslin(q), geo("cofre-anelApoio", () => new THREE.TorusGeometry(0.09, 0.028, 10, 28).rotateX(Math.PI / 2)), F(-0.55, y + 0.028, -0.01));
  tiara(c.batch, c.inst, ROOM, F, -0.55, y + 0.05, -0.01, 1.0);
  jewelBust(c.batch, ROOM, F, 0.35, y, -0.05, 0.85);
  necklace(c.inst, ROOM, F, 0.35, y + 0.205, -0.03, 0.06, 16, plain("cofre-rubi", "#c2102a", { rough: 0.03, env: 3, emissive: "#600010", ei: 0.4 }), "cofre-colar");
  // laudo na prancheta, lápis, luvas brancas, lupa, pinça, pincel macio e a caixa de luvas de nitrila
  bx(c.batch, ROOM, plain("cofre-prancheta", "#6b4a2a", { rough: 0.7 }), F(0.0, y, 0.22, 0.12, 0.25, 0.008, 0.34));
  c.batch.add(ROOM, once(`cofre-laudoMat-${langOf(c.copy)}`, () => new THREE.MeshStandardMaterial({ map: reportTex(langOf(c.copy)), roughness: 0.9, emissiveMap: reportTex(langOf(c.copy)), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.1 })), planeUp(), F(0.0, y + 0.009, 0.23, 0.12, 0.22, 1, 0.3));
  bx(c.batch, ROOM, steelGrey(), F(0.0, y + 0.009, 0.08, 0.12, 0.08, 0.012, 0.02));
  gloves(c, F, 0.62, y, 0.18, 0.4);
  loupe(c, F, 0.25, y, 0.3, -0.6);
  bx(c.batch, ROOM, steelGrey(), F(0.72, y + 0.003, -0.15, 0.3, 0.008, 0.004, 0.12));
  c.batch.add(ROOM, plain("cofre-madeiraClara", "#c9a77a", { rough: 0.6 }), CYL(8), F(0.6, y + 0.008, -0.3, 1.2, 0.006, 0.16, 0.006, Math.PI / 2));
  c.batch.add(ROOM, fabric("cofre-cerdas", "#2a2018", q), CYL(8), F(0.6 + Math.sin(1.2) * 0.09, y + 0.008, -0.3 + Math.cos(1.2) * 0.09, 1.2, 0.012, 0.04, 0.012, Math.PI / 2));
  bx(c.batch, ROOM, plain("cofre-caixaNitrila", "#2f63b8", { rough: 0.6 }), F(-0.78, y, 0.25, 0.1, 0.13, 0.07, 0.24));
  // luminária-lupa articulada presa na borda (aro de LED aceso)
  const sg = steelWhite();
  bx(c.batch, ROOM, sg, F(-w / 2 + 0.1, 0.8, -d / 2 + 0.06, 0, 0.06, 0.06, 0.05));
  c.batch.add(ROOM, sg, CYL(8), F(-w / 2 + 0.1, 1.08, -d / 2 + 0.06, 0, 0.01, 0.5, 0.01));
  c.batch.add(ROOM, sg, CYL(8), F(-w / 2 + 0.24, 1.36, -d / 2 + 0.16, 0.6, 0.01, 0.4, 0.01, 0, -1.0));
  c.batch.add(ROOM, sg, geo("cofre-aroLupa", () => new THREE.TorusGeometry(0.1, 0.018, 8, 32).rotateX(Math.PI / 2)), F(-w / 2 + 0.42, 1.28, -d / 2 + 0.28, 0, 1, 1, 1, 0.5));
  c.batch.add(ROOM, lit("cofre-ledLupa", "#f2f8ff", 2.6), geo("cofre-ledLupaGeo", () => new THREE.TorusGeometry(0.1, 0.006, 6, 32).rotateX(Math.PI / 2)), F(-w / 2 + 0.42, 1.27, -d / 2 + 0.28, 0, 1, 1, 1, 0.5));
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL0(32), F(-w / 2 + 0.42, 1.28, -d / 2 + 0.28, 0, 0.085, 0.006, 0.085, 0.5));
  anchor(c, at(F, -w / 2 + 0.42, 1.15, -d / 2 + 0.3), "#eef6ff", 2.4, 2.4);
}
/** Mapoteca (gaveteiro horizontal 1,5 × 1,0 × 1,0 m): dois módulos de cinco gavetas rasas, puxadores, porta-etiquetas. */
function flatFiles(c: PropsCtx, F: Fr, w: number, d: number) {
  const sg = steelGrey(), tags = tagMat(c), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  bx(c.batch, ROOM, K, F(0, 0, 0, 0, w - 0.06, 0.08, d - 0.06));
  bx(c.batch, ROOM, sg, F(0, 0.08, 0, 0, w, 0.88, d), true);
  for (let k = 0; k < 10; k++) {
    const y = 0.1 + k * 0.083 + (k >= 5 ? 0.02 : 0);
    bx(c.batch, ROOM, sg, F(0, y, d / 2, 0, w - 0.04, 0.072, 0.012));
    bx(c.batch, ROOM, brassC(), F(0, y + 0.02, d / 2 + 0.014, 0, w * 0.5, 0.012, 0.014));
    c.batch.add(ROOM, tags, tagGeo(9 - k), F(-w / 2 + 0.16, y + 0.036, d / 2 + 0.0135, 0, 0.12, 0.03, 1));
  }
  bx(c.batch, ROOM, plain("cofre-tampoBranco", "#eae7df", { rough: 0.7 }), F(0, 0.96, 0, 0, w + 0.02, 0.025, d + 0.02));
  // em cima: caixas livres de ácido empilhadas (com a etiqueta), o rolo de tecido e o papel de seda
  for (let k = 0; k < 2; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(-0.35, 0.985 + k * 0.13, -0.05, 0.04 * k, 0.55, 0.125, 0.4)); c.batch.add(ROOM, tags, tagGeo(10), F(-0.35, 1.04 + k * 0.13, 0.151 + 0.01 * k, 0.04 * k, 0.16, 0.04, 1)); }
  c.batch.add(ROOM, fabric("cofre-roloTecido", "#d8c6e8", c.q), CYL(20), F(0.4, 1.04, 0.0, 0.1, 0.055, 0.7, 0.055, 0, Math.PI / 2));
  c.batch.add(ROOM, plain("cofre-tuboPapel", "#efe9dc", { rough: 0.8 }), CYL(10), F(0.4, 1.04, 0.0, 0.1, 0.022, 0.76, 0.022, 0, Math.PI / 2));
  bx(c.batch, ROOM, plain("cofre-papelSeda", "#f6f4ee", { rough: 0.95 }), F(0.35, 0.985, 0.3, 0.2, 0.5, 0.02, 0.32));
}
/** Estação fotográfica de documentação: mesa, base cinza do reprodutor, coluna, braço com a câmera, duas luzes de LED. */
function photoStation(c: PropsCtx, F: Fr, w: number, d: number) {
  const q = c.q, K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), sw = steelWhite();
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(ex * (w / 2 - 0.05), 0, ez * (d / 2 - 0.05), 0, 0.04, 0.74, 0.04), true);
  bx(c.batch, ROOM, sw, F(0, 0.74, 0, 0, w, 0.03, d), true);
  bx(c.batch, ROOM, plain("cofre-cinza18", "#7b7b78", { rough: 0.95 }), F(0, 0.77, -0.05, 0, 0.7, 0.02, 0.6));            // base cinza 18 %
  bx(c.batch, ROOM, K, F(0, 0.79, -0.33, 0, 0.08, 1.15, 0.06), true);                                                       // coluna
  bx(c.batch, ROOM, K, F(0, 1.42, -0.18, 0, 0.06, 0.06, 0.3));                                                               // braço
  bx(c.batch, ROOM, K, F(0, 1.3, -0.05, 0, 0.14, 0.11, 0.1));                                                                // câmera
  c.batch.add(ROOM, K, CYL(16), F(0, 1.25, -0.05, 0, 0.035, 0.09, 0.035));                                                   // objetiva
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL(16), F(0, 1.204, -0.05, 0, 0.03, 0.004, 0.03));
  for (const e of [-1, 1]) {
    c.batch.add(ROOM, K, CYL(8), F(e * 0.42, 0.79, -0.25, 0, 0.012, 0.6, 0.012));
    bx(c.batch, ROOM, K, F(e * 0.42, 1.36, -0.25, -e * 0.6, 0.22, 0.18, 0.04, 0.5));
    c.batch.add(ROOM, lit("cofre-painelLed", "#f4f8ff", 1.8), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(e * 0.42 - e * 0.012, 1.45, -0.25 + 0.02, -e * 0.6, 0.19, 0.15, 1, 0.5));
  }
  // na base: o broche documentado com a régua de escala e o cartão de cores
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.inst.add(ROOM, "galeria-broche", geo("galeria-gem", () => new THREE.OctahedronGeometry(1, 0).scale(1, 0.8, 1)), plain("galeria-cristal", "#f4f8ff", { rough: 0.02, metal: 0.1, env: 3, emissive: "#9fb4ff", ei: 0.35 }), F(Math.cos(a) * 0.03, 0.795, -0.05 + Math.sin(a) * 0.03, a, 0.01)); }
  bx(c.batch, ROOM, plain("cofre-regua", "#f2f0e8", { rough: 0.7 }), F(0, 0.79, 0.12, 0, 0.3, 0.003, 0.03));
  const chk = paint("cofre-cartaoCores", 128, 96, (g, W, H) => { const cols = ["#73523f", "#c2967f", "#5f7a9c", "#596b40", "#8180b0", "#64bdaa", "#d67e2c", "#4c5ca8", "#c15a62", "#5e3c6c", "#9dbc40", "#e0a32e", "#383c96", "#469449", "#af363c", "#e7c71f", "#bb5695", "#0885a1", "#f3f3f2", "#c8c8c8", "#a0a0a0", "#7a7a79", "#555555", "#343434"]; cols.forEach((col, i) => { g.fillStyle = col; g.fillRect((i % 6) * W / 6 + 1, Math.floor(i / 6) * H / 4 + 1, W / 6 - 2, H / 4 - 2); }); });
  c.batch.add(ROOM, once("cofre-cartaoCoresMat", () => new THREE.MeshStandardMaterial({ map: chk, roughness: 0.8 })), planeUp(), F(0.22, 0.792, 0.08, 0, 0.12, 1, 0.09));
  // notebook com a foto na tela
  bx(c.batch, ROOM, K, F(-0.32, 0.77, 0.4, 0.3, 0.32, 0.015, 0.22));
  c.batch.add(ROOM, lit("cofre-telaNotebook", "#bcd2ff", 1.0), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(-0.32 - Math.sin(0.3) * 0.1, 0.89, 0.4 - Math.cos(0.3) * 0.1, 0.3, 0.3, 0.19, 1, -0.2));
  anchor(c, at(F, 0, 1.3, 0.1), "#f4f8ff", 2.6, 2.6);
  void q;
}
/** Carrinho de acervo: aço inox em dois andares com bordas, prateleira acolchoada, alça e rodízios; caixas por cima. */
function collectionCart(c: PropsCtx, F: Fr, w: number, d: number) {
  const inox = plain("cofre-inox", "#c4c8cc", { metal: 1, rough: 0.25 }), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) {
    c.batch.add(ROOM, inox, CYL(8), F(ex * (w / 2 - 0.04), 0.12, ez * (d / 2 - 0.04), 0, 0.012, 0.8, 0.012));
    c.batch.add(ROOM, K, geo("cofre-rodizio", () => new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16).rotateZ(Math.PI / 2)), F(ex * (w / 2 - 0.04), 0.045, ez * (d / 2 - 0.04)));
    bx(c.batch, ROOM, inox, F(ex * (w / 2 - 0.04), 0.09, ez * (d / 2 - 0.04), 0, 0.03, 0.03, 0.05));
  }
  for (const y of [0.2, 0.72]) { bx(c.batch, ROOM, inox, F(0, y, 0, 0, w, 0.02, d)); for (const e of [-1, 1]) { bx(c.batch, ROOM, inox, F(0, y, e * (d / 2 - 0.01), 0, w, 0.06, 0.012)); bx(c.batch, ROOM, inox, F(e * (w / 2 - 0.01), y, 0, 0, 0.012, 0.06, d)); } }
  bx(c.batch, ROOM, muslin(c.q), F(0, 0.74, 0, 0, w - 0.06, 0.03, d - 0.06));
  c.batch.add(ROOM, inox, geo("cofre-alca", () => new THREE.TorusGeometry(0.2, 0.012, 6, 20, Math.PI)), F(-w / 2 - 0.02, 0.92, 0, Math.PI / 2, 1, 0.6, 1));
  for (let k = 0; k < 2; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(0.1 - k * 0.42, 0.77, 0, 0.03 * k, 0.38, 0.14, d - 0.14)); c.batch.add(ROOM, tagMat(c), tagGeo(10), F(0.1 - k * 0.42, 0.84, (d - 0.14) / 2 + 0.002, 0.03 * k, 0.16, 0.04, 1)); }
  bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(0, 0.22, 0, 0.1, 0.6, 0.25, d - 0.12));
  void cy;
}
