/*
 * MET Gala Heist v2 — Vestíbulo: a chapelaria. O balcão (almofadas de nogueira, tampo de latão, campainha, fichas e a
 * aba de passagem), a parede de guarda-volumes atrás dele (nichos numerados com caixas, bolsas e o porta-joias de
 * veludo; trilho com cabides e casacos de gala; a placa no alto) e a arara de latão do esconderijo.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, mat, mul } from "../interior-batch";
import { foot } from "../interior-props";
import type { RoomsCtx } from "./kit";
import { ROOM, VM, frameGeo, lathe, onWall, raisedPanel, vCopy, vFabric, vGeo, vMat, vSolid, vTex } from "./vestibulo-kit";
import { L, PLANE_V, W, light, reseed, rnd, type Ctx } from "./vestibulo-furniture-kit";

/* ======================= chapelaria ======================= */
/** Balcão da chapelaria (frente para oeste): almofadas de nogueira, tampo de latão, campainha, fichas, aba de passagem. */
export function coatCheck(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), w = f.w, d = f.d, h = 1.05;
  c.batch.add(ROOM, V.nero, BOX0(), L(f, 0, 0, 0.02, 0, w - 0.04, 0.12, d - 0.04));
  c.batch.add(ROOM, V.walnut, BOX0(), L(f, 0, 0.12, 0, 0, w, h - 0.16, d), { cast: true });
  const n = Math.round(w / 0.6);
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + (k + 0.5) * (w / n);
    c.batch.add(ROOM, V.walnut, raisedPanel("coatPanel", w / n - 0.14, 0.58, 0.018, 0.01), L(f, x, 0.6, d / 2));
    c.batch.add(ROOM, V.gilt, frameGeo("coatPanelFrame", w / n - 0.1, 0.64, 0.015, 0.024, 0.004), L(f, x, 0.6, d / 2));
  }
  c.batch.add(ROOM, V.mahogany, BOX0(), L(f, 0, h - 0.04, 0.02, 0, w + 0.06, 0.04, d + 0.08));
  c.batch.add(ROOM, V.brass, BOX0(), L(f, 0, h, 0.02, 0, w + 0.04, 0.012, d + 0.06));
  // campainha, porta-fichas numeradas e o bloco de tíquetes; a aba de passagem na ponta sul
  c.batch.add(ROOM, V.brass, lathe("bellBase", [[0, 0], [0.05, 0], [0.05, 0.01], [0, 0.01]], 18), L(f, w / 2 - 0.35, h + 0.012, 0.1));
  c.batch.add(ROOM, V.giltBright, vGeo("bellDome", () => new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), L(f, w / 2 - 0.35, h + 0.022, 0.1));
  for (let k = 0; k < 10; k++) c.inst.add(ROOM, "vestibulo-coatTicket", BOX0(), V.paper, L(f, -0.8 + k * 0.05, h + 0.012, 0.12, 0.05 * (k % 3), 0.035, 0.05, 0.003, -0.25));
  c.batch.add(ROOM, V.brass, BOX0(), L(f, -0.8 + 0.22, h + 0.012, 0.1, 0, 0.56, 0.012, 0.03));
  c.batch.add(ROOM, V.walnut, BOX0(), L(f, -w / 2 + 0.35, h - 0.02, 0, 0, 0.6, 0.03, d - 0.02));
  for (const s of [-1, 1]) c.inst.add(ROOM, "vestibulo-hinge", CYL(8), V.brass, L(f, -w / 2 + 0.66, h - 0.01, s * 0.2, 0, 0.01, 0.08, 0.01, Math.PI / 2, 0));
  // placa sobre o balcão e a luz da chapelaria
  const tx = vCopy(c.copy);
  const t = vTex(`coatSign-${tx.coat}`, 512, 160, (g, ww, hh) => { g.fillStyle = "#141010"; g.fillRect(0, 0, ww, hh); g.fillStyle = "#e2c27a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(hh * 0.42)}px 'Didot', Georgia, serif`; g.fillText(tx.coat, ww / 2, hh / 2); });
  c.batch.add(ROOM, V.brass, BOX0(), L(f, 0.5, h + 0.012, -0.05, 0, 0.42, 0.012, 0.12));
  c.batch.add(ROOM, vMat(`coatSignMat-${tx.coat}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })), PLANE_V(), L(f, 0.5, h + 0.09, -0.04, 0, 0.36, 0.11, 1, -0.3));
  light(c, W(f, 0, 2.3, -0.4), "#ffd9a8", 3.4, 3.6);
}

/** Parede de guarda-volumes atrás do balcão (parede leste, z 19,5…23,5): nichos numerados em cima, cabides embaixo. */
export function cloakWall(c: RoomsCtx) {
  const V = VM(c.q), w = "E" as const, z0 = 19.5, z1 = 23.5, len = z1 - z0, mid = (z0 + z1) / 2, at = (s: number, y: number, off: number) => onWall(w, s, y, off);
  const D = 0.36, top = 2.66, ybase = 1.98, rows = 3, cols = 12, cw = len / cols, ch = 0.21;
  // fundo, laterais, rodapé e a cornija de mogno
  c.batch.add(ROOM, V.walnut, BOX0(), mul(at(mid, 0, 0.025), mat(0, 0, 0, 0, len, top, 0.05)));
  for (const s of [z0 + 0.02, z1 - 0.02]) c.batch.add(ROOM, V.walnut, BOX0(), mul(at(s, 0, D / 2), mat(0, 0, 0, 0, 0.04, top, D)), { cast: true });
  c.batch.add(ROOM, V.nero, BOX0(), mul(at(mid, 0, D / 2), mat(0, 0, 0, 0, len, 0.1, D)));
  c.batch.add(ROOM, V.mahogany, BOX0(), mul(at(mid, top, D / 2 + 0.03), mat(0, 0, 0, 0, len + 0.1, 0.07, D + 0.06)));
  // nichos numerados (3 fileiras × 12): interior escuro, prateleiras e divisões de nogueira, plaquinhas de latão
  c.batch.add(ROOM, vSolid("cubbyDark", "#1a120c", { rough: 0.9 }), BOX0(), mul(at(mid, ybase, 0.06), mat(0, 0, 0, 0, len - 0.04, rows * ch, 0.02)));
  for (let r = 0; r <= rows; r++) c.batch.add(ROOM, V.walnut, BOX0(), mul(at(mid, ybase + r * ch - 0.01, D / 2), mat(0, 0, 0, 0, len - 0.04, 0.02, D)));
  for (let k = 1; k < cols; k++) c.inst.add(ROOM, "vestibulo-cubbyDiv", BOX0(), V.walnut, mul(at(z0 + k * cw, ybase, D / 2), mat(0, 0, 0, 0, 0.018, rows * ch, D)));
  const nums = vTex("cubbyNumbers", 1024, 384, (g, ww, hh) => {
    g.fillStyle = "#b8924a"; g.fillRect(0, 0, ww, hh); g.fillStyle = "#2a1d0a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 64px 'DejaVu Sans', Arial, sans-serif`;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 12; k++) g.fillText(String(101 + r * 12 + k), (k + 0.5) * (ww / 12), (r + 0.5) * (hh / 3));
  });
  const numM = vMat("cubbyNumMat", () => new THREE.MeshStandardMaterial({ map: nums, metalness: 0.85, roughness: 0.3 }));
  for (let r = 0; r < rows; r++) {
    const g = vGeo(`cubbyRow${r}`, () => { const pg = new THREE.PlaneGeometry(len, 0.04); const uv = pg.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), (2 - r) / 3 + 0.06 + uv.getY(i) * 0.21); return pg; });
    c.batch.add(ROOM, numM, g, at(mid, ybase + r * ch - 0.01, D + 0.001));
  }
  // o que está guardado: caixas, bolsas e o porta-joias de veludo (a peça da chapelaria, em frente à interação)
  for (let k = 0; k < 16; k++) { const r = k % rows, col = (k * 5 + r) % cols; c.inst.add(ROOM, "vestibulo-cubbyBox", BOX0(), [V.velvetRed, V.leather, V.paper][k % 3], mul(at(z0 + (col + 0.5) * cw, ybase + r * ch + 0.005, 0.2), mat(0, 0, 0, 0.2 * (k % 2), cw * 0.55, ch * 0.5, 0.18))); }
  c.batch.add(ROOM, vFabric("jewelBox", "#3b0d26", c.q, { sheen: "#c070a0" }), BOX0(), mul(at(20.4, ybase + 0.005, 0.22), mat(0, 0, 0, 0, 0.16, 0.09, 0.13)));
  c.batch.add(ROOM, V.giltBright, BOX0(), mul(at(20.4, ybase + 0.095, 0.22), mat(0, 0, 0, 0, 0.165, 0.008, 0.135)));
  // trilho de casacos (1,82 m) com cabides de madeira e casacos de gala
  c.batch.add(ROOM, V.brass, CYL(10), mul(at(mid, 1.82, 0.2), mat(0, 0, 0, 0, 0.016, len - 0.12, 0.016, 0, Math.PI / 2)));
  reseed(77); const cols2 = ["#141416", "#2b1d16", "#3a3a3d", "#5a1d2a", "#1c2630", "#e8e2d6", "#0f2b23"];
  for (let k = 0; k < 15; k++) {
    const s = z0 + 0.3 + k * 0.25 + (rnd() - 0.5) * 0.06, col = cols2[Math.floor(rnd() * cols2.length)];
    if (Math.abs(s - 20.4) < 0.2) continue;                                       // a frente do porta-joias fica livre
    c.inst.add(ROOM, "vestibulo-hanger", vGeo("hangerGeo", () => new THREE.TorusGeometry(0.2, 0.01, 4, 16, Math.PI).rotateZ(Math.PI)), V.walnut, mul(at(s, 1.76, 0.2), mat(0, 0, 0, Math.PI / 2, 1, 0.35, 1)));
    c.inst.add(ROOM, `vestibulo-coatV-${col}`, coatGeo(), vFabric(`coatV-${col}`, col, c.q), mul(at(s, 1.16, 0.2), mat(0, 0, 0, Math.PI / 2 + (rnd() - 0.5) * 0.25)));
  }
  // placa CHAPELARIA no alto
  const tx = vCopy(c.copy);
  const t = vTex(`cloakSign-${tx.coat}`, 1024, 220, (g, ww, hh) => { g.fillStyle = "#0b0a0a"; g.fillRect(0, 0, ww, hh); g.strokeStyle = "#c9a24b"; g.lineWidth = 6; g.strokeRect(12, 12, ww - 24, hh - 24); g.fillStyle = "#e6c77f"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(hh * 0.42)}px 'Didot', 'Bodoni 72', Georgia, serif`; g.fillText(tx.coat, ww / 2, hh * 0.54); });
  c.batch.add(ROOM, V.brass, BOX0(), mul(at(mid, 2.92, 0.015), mat(0, 0, 0, 0, 2.3, 0.5, 0.03)));
  c.batch.add(ROOM, vMat(`cloakSignMat-${tx.coat}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.2, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.2 })), PLANE_V(), mul(at(mid, 3.17, 0.032), mat(0, 0, 0, 0, 2.2, 0.44, 1)));
}
/** Casaco no cabide: cápsula achatada com os ombros estreitando no alto. */
function coatGeo(): THREE.BufferGeometry {
  return vGeo("coatV", () => { const g = new THREE.CapsuleGeometry(0.17, 0.8, 4, 12).scale(1, 1, 0.34); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.35) { const k = (y - 0.35) / 0.25; p.setX(i, p.getX(i) * (1 - 0.35 * k)); } } g.computeVertexNormals(); return g; });
}

/** Arara da chapelaria (esconderijo): latão escovado, pés em arco, prateleira de baixo, casacos e capas de roupa. */
export function rack(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), H = 1.85, w = f.w;
  for (const s of [-1, 1]) {
    c.batch.add(ROOM, V.brass, CYL0(10), L(f, s * (w / 2 - 0.04), 0.05, 0, 0, 0.014, H - 0.05, 0.014));
    c.batch.add(ROOM, V.brass, vGeo("rackFoot", () => new THREE.TorusGeometry(0.22, 0.012, 6, 16, Math.PI)), L(f, s * (w / 2 - 0.04), 0.02, 0, Math.PI / 2, 1, 0.25, 1));
    c.batch.add(ROOM, V.brass, SPH(10), L(f, s * (w / 2 - 0.04), H + 0.02, 0, 0, 0.025));
  }
  c.batch.add(ROOM, V.brass, CYL(10), L(f, 0, H, 0, 0, 0.015, w - 0.06, 0.015, 0, Math.PI / 2));
  c.batch.add(ROOM, V.walnut, BOX0(), L(f, 0, 0.18, 0, 0, w - 0.1, 0.025, 0.36));
  reseed(31);
  for (let k = 0; k < 7; k++) {
    const x = -w / 2 + 0.14 + k * ((w - 0.28) / 6), col = ["#141416", "#2b1d16", "#5a1d2a", "#3a3a3d"][k % 4];
    if (k % 3 === 1) c.inst.add(ROOM, "vestibulo-garmentBag", vGeo("garmentBagV", () => new THREE.BoxGeometry(0.06, 1.25, 0.55).translate(0, -0.62, 0)), vFabric("garmentBagV", "#1b1c20", c.q, { rough: 0.6 }), L(f, x, H - 0.05, 0, (rnd() - 0.5) * 0.2));
    else c.inst.add(ROOM, `vestibulo-coatV-${col}`, coatGeo(), vFabric(`coatV-${col}`, col, c.q), L(f, x, H - 0.66, 0, Math.PI / 2 + (rnd() - 0.5) * 0.2));
  }
  for (let k = 0; k < 3; k++) c.inst.add(ROOM, "vestibulo-shoeBox", BOX0(), V.paper, L(f, -0.3 + k * 0.32, 0.205, 0, 0.1 * k, 0.26, 0.1, 0.18));
}
