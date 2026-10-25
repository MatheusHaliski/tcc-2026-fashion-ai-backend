/*
 * MET Gala Heist v2 — o Grande Salão como o hall neoclássico de um museu de avenida em noite de gala: três cúpulas rasas
 * com caixotões e óculo iluminado sobre a nave, colunata com entablamento, arcos sobre pilares nas quatro paredes (com
 * leques de vidro sobre as portas e lavagem de luz rosa por dentro), galeria contínua no segundo nível com balaustrada,
 * janelas em arco no alto, estandartes da Gala Lumière, castiçais dourados, arandelas e dois lustres de cristal.
 *
 * No centro, a instalação floral da gala: o balcão redondo coberto de rosas e, sobre ele, uma coroa de rosas de quase
 * sete metros (nervuras floridas que se abrem e se fecham num remate dourado), fios de pérolas, castiçais acesos sobre
 * as rosas e pétalas caídas no terrazzo. Tudo instanciado: ~1 000 rosas num punhado de chamadas de desenho.
 */
import * as THREE from "three";
import { Batch, BOX0, CYL, CYL0, Instances, SPH, geo, mat, mul } from "./interior-batch";
import { M, fabric, glow, solid, type Palette } from "./interior-mats";
import { SERIF, drawGown, drawnTexture, fit, spaced, type Quality } from "./interior-tex";
import type { InteriorCopy } from "./interior-copy";

export type WallSide = "N" | "S" | "W" | "E";
/** Matriz de um ponto na parede do salão: s ao longo da parede (x no norte/sul, z no leste/oeste), y, afastado `off` da face. */
export function hallWall(w: WallSide, s: number, y: number, off = 0): THREE.Matrix4 {
  switch (w) {
    case "N": return mat(s, y, -6 + off, 0);
    case "S": return mat(s, y, 14 - off, Math.PI);
    case "W": return mat(-12 + off, y, s, Math.PI / 2);
    case "E": return mat(12 - off, y, s, -Math.PI / 2);
  }
}
export const HALL_H = 9.5, BALC_Y = 5.0;
const BALC_T = 0.4, BALC_D = 1.2;
export const DOMES: { x: number; z: number; r: number; rise: number }[] = [{ x: -8.25, z: 4.5, r: 3, rise: 1.4 }, { x: 0, z: 4.5, r: 4, rise: 1.8 }, { x: 8.25, z: 4.5, r: 3, rise: 1.4 }];

/* ---------- arcos ---------- */
interface Arch { wall: WallSide; s: number; r: number; spring: number; door?: number; panel?: boolean }
const ARCHES: Arch[] = [
  { wall: "N", s: -8, r: 2.7, spring: 2.3, panel: true }, { wall: "N", s: 0, r: 2.7, spring: 2.3, door: 4 },
  { wall: "S", s: -8, r: 2.7, spring: 2.3, panel: true }, { wall: "S", s: 0, r: 2.7, spring: 2.3, door: 4 }, { wall: "S", s: 8, r: 2.7, spring: 2.3, panel: true },
  { wall: "W", s: 2.5, r: 3, spring: 2, panel: true }, { wall: "W", s: 10, r: 1.7, spring: 2.2, door: 2.6 },
  { wall: "E", s: -1, r: 3.5, spring: 1.5 }, { wall: "E", s: 10, r: 1.7, spring: 2.2, door: 2.6 },
];
/** Pilastras (posição ao longo de cada parede). */
const PILASTERS: Record<WallSide, number[]> = { N: [-11.3, -4, 3.1, 9.3, 11.3], S: [-11.3, -4, 4, 11.3], W: [-4.6, 6.6, 12.9], E: [-5.2, 3.8, 7.4, 12.9] };

function archFrameGeo(r: number, spring: number, t: number, depth: number): THREE.BufferGeometry {
  return geo(`archframe${r}-${spring}-${t}-${depth}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-r - t, 0); s.lineTo(-r - t, spring); s.absarc(0, spring, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, spring);
    s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 28 });
    return g;
  });
}
/** Região dentro do arco acima de y0 (tímpano sobre a porta ou o fundo do arco inteiro), com uv 0–1. */
function archFillGeo(r: number, spring: number, y0: number): THREE.BufferGeometry {
  return geo(`archfill${r}-${spring}-${y0}`, () => {
    const s = new THREE.Shape();
    if (y0 <= spring) { s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, y0); }
    else { const half = Math.sqrt(Math.max(0, r * r - (y0 - spring) ** 2)), a0 = Math.atan2(y0 - spring, half); s.moveTo(half, y0); s.absarc(0, spring, r, a0, Math.PI - a0, false); s.lineTo(half, y0); }
    const g = new THREE.ShapeGeometry(s, 28); const p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const top = spring + r; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + r) / (2 * r), (p.getY(i) - y0) / (top - y0));
    return g;
  });
}
function fanlightTexture(): THREE.Texture {
  return drawnTexture("fanlight", 512, 256, (g, w, h) => {
    g.fillStyle = "#1a1208"; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h, 10, w / 2, h, h); grd.addColorStop(0, "#ffd38a"); grd.addColorStop(1, "#5a3a14"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2a1c0c"; g.lineWidth = 7;
    for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2 + Math.cos(a) * w, h + Math.sin(a) * h * 2); g.stroke(); }
    for (const rr of [0.3, 0.62, 0.95]) { g.beginPath(); g.arc(w / 2, h, rr * h, Math.PI, 0); g.stroke(); }
  });
}
function uplightTexture(): THREE.Texture {
  return drawnTexture("uplight", 64, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}

/* ---------- rosa (instanciada) ---------- */
/** Botão de rosa: anéis de pétalas curvas abrindo para fora (high: 3 anéis; low: 2). Raio ~1, base em y = 0. */
export function roseGeometry(q: Quality): THREE.BufferGeometry {
  return geo(`rose-${q}`, () => {
    const rings = q === "high" ? [{ n: 4, r: 0.18, out: 0.18, h: 0.75 }, { n: 6, r: 0.45, out: 0.4, h: 0.68 }, { n: 8, r: 0.75, out: 0.55, h: 0.5 }] : [{ n: 5, r: 0.3, out: 0.3, h: 0.7 }, { n: 7, r: 0.7, out: 0.55, h: 0.5 }];
    const pos: number[] = [], idx: number[] = []; const SA = q === "high" ? 3 : 2, SU = 2;
    rings.forEach((ring, ri) => {
      for (let p = 0; p < ring.n; p++) {
        const c = (p / ring.n) * Math.PI * 2 + ri * 0.6, half = (Math.PI / ring.n) * 1.25, base = pos.length / 3;
        for (let u = 0; u <= SU; u++) for (let a = 0; a <= SA; a++) {
          const t = u / SU, wTaper = Math.sin(Math.PI * (0.2 + 0.8 * t)) * 0.9 + 0.1, ang = c + (a / SA - 0.5) * 2 * half * wTaper;
          const rad = ring.r + ring.out * t * t + 0.06 * Math.sin((a / SA) * Math.PI), y = ring.h * t * (1.15 - 0.3 * t) + 0.12 * ri * (1 - t);
          pos.push(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        }
        for (let u = 0; u < SU; u++) for (let a = 0; a < SA; a++) { const k = base + u * (SA + 1) + a; idx.push(k, k + SA + 1, k + 1, k + 1, k + SA + 1, k + SA + 2); }
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const bud = new THREE.SphereGeometry(0.22, 8, 6).translate(0, 0.42, 0);
    const merged = new THREE.BufferGeometry(); const bp = bud.toNonIndexed().getAttribute("position").array as Float32Array, gp = g.toNonIndexed();
    const all = new Float32Array(gp.getAttribute("position").array.length + bp.length); all.set(gp.getAttribute("position").array as Float32Array); all.set(bp, gp.getAttribute("position").array.length);
    merged.setAttribute("position", new THREE.BufferAttribute(all, 3)); merged.computeVertexNormals();
    return merged;
  });
}
const leafGeometry = () => geo("leaf", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.45, 0.5, 0, 1.2); s.quadraticCurveTo(-0.45, 0.5, 0, 0); return new THREE.ShapeGeometry(s, 4); });
const petalGeometry = () => geo("petal", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.6, 0.4, 0.1, 1); s.quadraticCurveTo(-0.5, 0.5, 0, 0); return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2); });

const ROSE_COLORS: [string, number][] = [["#f4c3cf", 4], ["#f8dbe2", 3], ["#f3ece0", 3], ["#ef9a8c", 1.5], ["#c0304f", 1.2], ["#ecd3a8", 1.5], ["#e7a6bb", 2]];
function roseColor(r: () => number): THREE.Color {
  const tot = ROSE_COLORS.reduce((a, [, w]) => a + w, 0); let x = r() * tot;
  for (const [c, w] of ROSE_COLORS) { x -= w; if (x <= 0) return new THREE.Color(c).multiplyScalar(0.92 + r() * 0.12); }
  return new THREE.Color(ROSE_COLORS[0][0]);
}

/* ---------- castiçal ---------- */
const candelabraStem = () => geo("candStem", () => new THREE.LatheGeometry([[0.16, 0], [0.16, 0.03], [0.06, 0.06], [0.05, 0.25], [0.09, 0.3], [0.03, 0.36], [0.035, 0.75], [0.07, 0.8], [0.03, 0.84]].map(([x, y]) => new THREE.Vector2(x, y)), 16));
/** Castiçal de cinco velas em ouro velho (escala s), com velas e chamas instanciadas. */
export function candelabra(room: string, at: THREE.Matrix4, s: number, P: Palette, batch: Batch, inst: Instances, flames: THREE.Vector3[]) {
  batch.add(room, P.gold, candelabraStem(), mul(at, mat(0, 0, 0, 0, s)));
  const arms = 4, armR = 0.26 * s, y = 0.78 * s;
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * armR, z = Math.sin(a) * armR;
    batch.add(room, P.gold, CYL(8), mul(at, mat(x / 2, y, z / 2, -a, 0.012 * s, armR, 0.012 * s, 0, Math.PI / 2)));
    batch.add(room, P.gold, CYL0(10), mul(at, mat(x, y, z, 0, 0.03 * s, 0.04 * s, 0.03 * s)));
  }
  const tips: [number, number, number][] = [[0, 0.84 * s, 0], ...Array.from({ length: arms }, (_, k) => { const a = (k / arms) * Math.PI * 2 + Math.PI / 4; return [Math.cos(a) * armR, y + 0.04 * s, Math.sin(a) * armR] as [number, number, number]; })];
  const v = new THREE.Vector3();
  for (const [x, yy, z] of tips) {
    inst.add(room, "candle", CYL0(8), P.candle, mul(at, mat(x, yy, z, 0, 0.018 * s, 0.22 * s, 0.018 * s)));
    inst.add(room, "flame", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, mul(at, mat(x, yy + 0.25 * s, z, 0, 0.022 * s)));
    v.set(x, yy + 0.25 * s, z).applyMatrix4(at); flames.push(v.clone());
  }
}

/* ---------- textos do salão ---------- */
function bannerTexture(copy: InteriorCopy, kind: "a" | "b"): THREE.Texture {
  return drawnTexture(`hallBanner-${kind}-${copy.bannerA}-${copy.posterTitle}`, 512, 640, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#2b0b1c"); grd.addColorStop(0.55, "#6d1e3d"); grd.addColorStop(1, "#c86b7a"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d8b56a"; g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36);
    g.fillStyle = "#f3dfb4"; g.textAlign = "center"; g.textBaseline = "middle";
    if (kind === "a") {
      fit(g, copy.bannerA, (p) => `600 ${p}px ${SERIF}`, 74, w - 90); spaced(g, copy.bannerA, w / 2, h * 0.22, 6);
      const au = g.createLinearGradient(0, h * 0.35, 0, h * 0.95); au.addColorStop(0, "#f7e3b5"); au.addColorStop(0.5, "#f1a8bf"); au.addColorStop(1, "#b9a3ff");
      drawGown(g, w / 2, h * 0.34, h * 0.56, au);
    } else {
      g.font = `italic 400 ${Math.round(h * 0.16)}px ${SERIF}`; g.fillText(copy.bannerB, w / 2, h * 0.42);
      g.font = `400 ${Math.round(h * 0.045)}px ${SERIF}`; spaced(g, copy.exhibitSub, w / 2, h * 0.6, 5);
      g.font = `600 ${Math.round(h * 0.06)}px ${SERIF}`; spaced(g, copy.bannerA, w / 2, h * 0.84, 6);
    }
  });
}
/** Cartaz-pista do salão: "VESTIDO AURORA · CASA ORVALHO" com o ano bem grande (o código do teclado da doca). */
function posterTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`posterAurora-${copy.posterTitle}-${copy.posterFoot}`, 768, 1152, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#160a14"); bg.addColorStop(0.5, "#3a1430"); bg.addColorStop(1, "#140810"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const glowG = g.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.5, w * 0.7); glowG.addColorStop(0, "rgba(255,190,150,0.45)"); glowG.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = glowG; g.fillRect(0, 0, w, h);
    const au = g.createLinearGradient(0, h * 0.28, 0, h * 0.75); au.addColorStop(0, "#fde7b8"); au.addColorStop(0.45, "#f3a3b8"); au.addColorStop(1, "#a88bff");
    drawGown(g, w / 2, h * 0.27, h * 0.46, au);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e9cf94";
    g.font = `500 ${Math.round(h * 0.024)}px ${SERIF}`; spaced(g, copy.posterKicker, w / 2, h * 0.06, 10);
    fit(g, copy.posterTitle, (p) => `600 ${p}px ${SERIF}`, Math.round(h * 0.07), w * 0.86); spaced(g, copy.posterTitle, w / 2, h * 0.13, 4);
    g.font = `400 ${Math.round(h * 0.03)}px ${SERIF}`; spaced(g, copy.posterHouse, w / 2, h * 0.2, 12);
    // o ano: o maior elemento do cartaz
    g.fillStyle = "#ffe2a6"; g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 18;
    g.font = `700 ${Math.round(h * 0.2)}px ${SERIF}`; g.fillText(copy.posterYear, w / 2, h * 0.84);
    g.shadowBlur = 0; g.fillStyle = "#d9bf86"; g.font = `400 ${Math.round(h * 0.022)}px ${SERIF}`; g.fillText(copy.posterFoot, w / 2, h * 0.955);
    g.strokeStyle = "#c9a45a"; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
  });
}
function domeTexture(): THREE.Texture {
  return drawnTexture("domeCoffers", 1024, 512, (g, w, h) => {
    g.fillStyle = "#d9cdb3"; g.fillRect(0, 0, w, h);
    const rows = [[0.18, 0.32], [0.36, 0.5], [0.54, 0.68], [0.72, 0.86]], cols = 24;
    for (const [a, b] of rows) for (let c = 0; c < cols; c++) {
      const x0 = (c / cols) * w + 6, x1 = ((c + 1) / cols) * w - 6, y0 = a * h, y1 = b * h;
      const grd = g.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, "#9c8b6e"); grd.addColorStop(1, "#c9b993"); g.fillStyle = grd; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = "#e9dfc6"; g.fillRect(x0 + 5, y0 + 5, x1 - x0 - 10, y1 - y0 - 10);
      g.fillStyle = "#c39a4a"; g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2, Math.min(x1 - x0, y1 - y0) * 0.16, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#b58f45"; g.fillRect(0, h * 0.9, w, h * 0.04); g.fillRect(0, h * 0.13, w, h * 0.02);
    const ocu = g.createLinearGradient(0, 0, 0, h * 0.13); ocu.addColorStop(0, "#fff1cf"); ocu.addColorStop(1, "#d9c08a"); g.fillStyle = ocu; g.fillRect(0, 0, w, h * 0.13);
  });
}

export interface HallOut { flames: THREE.Vector3[]; chandeliers: THREE.Vector3[]; screen?: THREE.Mesh }

/** Arquitetura e decoração do Grande Salão (o que não tem colisão). Os móveis (colunas, mesas, palcos) vêm de interior-props. */
export function buildHall(q: Quality, copy: InteriorCopy, batch: Batch, inst: Instances, group: THREE.Group): HallOut {
  const P = M(q), room = "salao", flames: THREE.Vector3[] = [], chandeliers: THREE.Vector3[] = [];
  const stone = P.limestone, trim = P.stone;

  /* teto plano com caixotões, recortado nas cúpulas */
  const inDome = (x: number, z: number, pad: number) => DOMES.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad);
  {
    const pos: number[] = [], uv: number[] = [];
    for (let z = -6; z < 14 - 1e-6; z += 0.5) {
      let start: number | null = null;
      for (let x = -12; x <= 12 + 1e-6; x += 0.5) {
        const keep = x < 12 - 1e-6 && !inDome(x + 0.25, z + 0.25, -0.05);
        if (keep && start === null) start = x;
        if (!keep && start !== null) { const x0 = start, x1 = x, z0 = z, z1 = z + 0.5; pos.push(x0, HALL_H, z0, x1, HALL_H, z0, x1, HALL_H, z1, x0, HALL_H, z0, x1, HALL_H, z1, x0, HALL_H, z1); for (const [a, b] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) uv.push(a / 2, b / 2); start = null; }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    batch.add(room, P.plasterPlain, g, undefined, { cast: true });
    // vigas dos caixotões a cada 2 m (fora das cúpulas)
    for (let x = -12; x <= 12; x += 2) for (let z = -6; z < 14; z += 2) {
      if (x > -12 && x < 12 && !inDome(x, z + 1, 0.6)) batch.add(room, P.plasterPlain, BOX0(), mat(x, HALL_H - 0.32, z + 1, 0, 0.26, 0.32, 2));
      if (z > -6 && !inDome(x + 1, z, 0.6) && x < 12) batch.add(room, P.plasterPlain, BOX0(), mat(x + 1, HALL_H - 0.32, z, 0, 2, 0.32, 0.26));
    }
  }
  /* cúpulas: calota rasa com caixotões, anel de moldura, sanca iluminada e o óculo */
  const domeMat = new THREE.MeshStandardMaterial({ map: domeTexture(), roughness: 0.85, side: THREE.BackSide, envMapIntensity: 0.6 });
  for (const d of DOMES) {
    const R = (d.r * d.r + d.rise * d.rise) / (2 * d.rise), th = Math.asin(d.r / R);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 10, 0, Math.PI * 2, 0, th), domeMat);
    cap.position.set(d.x, HALL_H + d.rise - R, d.z); cap.name = "dome"; group.add(cap);
    batch.add(room, trim, geo(`domeRing${d.r}`, () => new THREE.TorusGeometry(d.r, 0.2, 8, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.12, d.z));
    batch.add(room, P.plasterPlain, geo(`domeAnnulus${d.r}`, () => new THREE.RingGeometry(d.r - 0.42, d.r + 0.55, 64, 1).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.01, d.z));
    batch.add(room, P.gold, geo(`domeGold${d.r}`, () => new THREE.TorusGeometry(d.r - 0.28, 0.05, 6, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.2, d.z));
    batch.add(room, glow("cove", "#ffd7a0", 1.6), geo(`cove${d.r}`, () => new THREE.TorusGeometry(d.r + 0.05, 0.035, 6, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.33, d.z));
    batch.add(room, glow("oculus", "#fff0d0", 2.2), geo(`oculus${d.r}`, () => new THREE.CircleGeometry(d.r * 0.2, 32).rotateX(Math.PI / 2)), mat(d.x, HALL_H + d.rise - 0.04, d.z));
  }
  /* galeria do segundo nível: laje, entablamento, balaustrada e luzes embutidas no forro */
  const bands: [number, number, number, number, WallSide][] = [[-12, -6, 12, -6 + BALC_D, "N"], [-12, 14 - BALC_D, 12, 14, "S"], [-12, -6 + BALC_D, -12 + BALC_D, 14 - BALC_D, "W"], [12 - BALC_D, -6 + BALC_D, 12, 14 - BALC_D, "E"]];
  const baluster = geo("baluster", () => new THREE.LatheGeometry([[0.05, 0], [0.05, 0.06], [0.035, 0.1], [0.06, 0.32], [0.03, 0.55], [0.045, 0.62], [0.045, 0.66]].map(([x, y]) => new THREE.Vector2(x, y)), 10));
  for (const [x0, z0, x1, z1, w] of bands) {
    batch.add(room, trim, BOX0(), mat((x0 + x1) / 2, BALC_Y, (z0 + z1) / 2, 0, x1 - x0, BALC_T, z1 - z0), { cast: true });
    // borda interna (entablamento) e balaústres ao longo dela
    const alongX = w === "N" || w === "S", edge = w === "N" ? z1 : w === "S" ? z0 : w === "W" ? x1 : x0, dir = w === "N" || w === "W" ? 1 : -1;
    const a0 = alongX ? -12 + BALC_D : -6 + BALC_D, a1 = alongX ? 12 - BALC_D : 14 - BALC_D, len = a1 - a0, mid = (a0 + a1) / 2;
    const at = (along: number, y: number, out: number, sx: number, sy: number, sz: number) => alongX ? mat(along, y, edge + dir * out, 0, sx, sy, sz) : mat(edge + dir * out, y, along, 0, sz, sy, sx);
    batch.add(room, trim, BOX0(), at(mid, BALC_Y - 0.35, 0.04, len + 0.1, 0.35, 0.12));              // arquitrave
    batch.add(room, P.gold, BOX0(), at(mid, BALC_Y - 0.12, 0.11, len + 0.1, 0.04, 0.03));
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T - 0.08, 0.1, len + 0.3, 0.14, 0.22));      // cornija
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T, -0.12, len, 0.12, 0.2));                  // rodapé da balaustrada
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T + 0.78, -0.12, len, 0.1, 0.24));           // corrimão
    for (let a = a0 + 0.15; a < a1; a += 0.3) inst.add(room, "baluster", baluster, trim, at(a, BALC_Y + BALC_T + 0.12, -0.12, 1, 1, 1));
    for (let a = a0 + 1; a < a1; a += 2) inst.add(room, "downlight", geo("dl", () => new THREE.CircleGeometry(0.07, 12).rotateX(Math.PI / 2)), P.bulbWarm, at(a, BALC_Y - 0.36, -0.6, 1, 1, 1));
  }
  /* colunata: entablamento sobre as colunas (z −1 e z 10), do muro ao muro */
  for (const z of [-1, 10]) {
    batch.add(room, trim, BOX0(), mat(0, BALC_Y, z, 0, 24, 0.75, 1.05), { cast: true });
    batch.add(room, P.gold, BOX0(), mat(0, BALC_Y + 0.2, z, 0, 24.02, 0.05, 1.08));
    batch.add(room, trim, BOX0(), mat(0, BALC_Y + 0.66, z, 0, 24.1, 0.16, 1.25));
  }
  /* arcos, tímpanos, lavagem de luz e pilastras */
  const fan = new THREE.MeshStandardMaterial({ map: fanlightTexture(), emissiveMap: fanlightTexture(), emissive: new THREE.Color("#ffb46a"), emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.2 });
  const upl = new THREE.MeshBasicMaterial({ map: uplightTexture(), color: new THREE.Color("#ff5fa8").multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const niche = fabric("hallDrape", "#5a1830", q, { rough: 0.85 });
  for (const a of ARCHES) {
    const base = hallWall(a.wall, a.s, 0, 0.005);
    batch.add(room, trim, archFrameGeo(a.r, a.spring, 0.32, 0.14), base, { cast: true });
    batch.add(room, P.gold, geo(`keystone`, () => new THREE.BoxGeometry(0.34, 0.5, 0.2)), mul(base, mat(0, a.spring + a.r + 0.12, 0.1)));
    if (a.door) batch.add(room, fan, archFillGeo(a.r, a.spring, a.door), mul(base, mat(0, 0, 0.012)));
    else if (a.panel) {
      batch.add(room, niche, archFillGeo(a.r, a.spring, 0), mul(base, mat(0, 0, 0.01)));
      group.add(Object.assign(new THREE.Mesh(archFillGeo(a.r, a.spring, 0), upl), { matrix: mul(base, mat(0, 0, 0.03)), matrixAutoUpdate: false, renderOrder: 2 }));
      inst.add(room, "uplight", BOX0(), P.ledPink, mul(base, mat(0, 0, 0.25, 0, 0.5, 0.06, 0.12)));
    }
  }
  for (const [w, list] of Object.entries(PILASTERS) as [WallSide, number[]][]) for (const s of list) {
    const b = hallWall(w, s, 0, 0);
    batch.add(room, trim, BOX0(), mul(b, mat(0, 0, 0.07, 0, 0.72, BALC_Y - 0.35, 0.14)));
    batch.add(room, trim, BOX0(), mul(b, mat(0, 0, 0.1, 0, 0.86, 0.32, 0.2)));                       // base
    batch.add(room, P.gold, BOX0(), mul(b, mat(0, BALC_Y - 0.65, 0.12, 0, 0.84, 0.3, 0.16)));       // capitel
    // arandela de duas velas
    batch.add(room, P.gold, BOX0(), mul(b, mat(0, 2.9, 0.2, 0, 0.06, 0.28, 0.16)));
    for (const dx of [-0.16, 0.16]) {
      batch.add(room, P.gold, CYL0(10), mul(b, mat(dx, 3.05, 0.3, 0, 0.04, 0.05, 0.04)));
      inst.add(room, "candle", CYL0(8), P.candle, mul(b, mat(dx, 3.1, 0.3, 0, 0.018, 0.18, 0.018)));
      inst.add(room, "sconceBulb", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, mul(b, mat(dx, 3.32, 0.3, 0, 0.026)));
    }
  }
  /* nível de cima: janelas em arco (noite lá fora) sobre cada arco e a cornija do teto */
  for (const a of ARCHES) {
    const b = hallWall(a.wall, a.s, 0, 0.005), r = Math.min(1.5, a.r * 0.6);
    batch.add(room, P.windowNight, archFillGeo(r, 6.7, 6.0), mul(b, mat(0, 0, 0.01)));
    batch.add(room, trim, archFrameGeo(r, 6.7, 0.18, 0.1), mul(b, mat(0, 6.0, 0.005, 0, 1, 1, 1)));
  }
  for (const w of ["N", "S", "W", "E"] as WallSide[]) {
    const len = w === "N" || w === "S" ? 24 : 20, mid = w === "N" || w === "S" ? 0 : 4;
    batch.add(room, trim, BOX0(), mul(hallWall(w, mid, 0, 0), mat(0, HALL_H - 0.5, 0.1, 0, len, 0.18, 0.2)));
    batch.add(room, P.gold, BOX0(), mul(hallWall(w, mid, 0, 0), mat(0, HALL_H - 0.6, 0.1, 0, len, 0.04, 0.14)));
  }
  /* estandartes da gala no nível de cima (norte e sul) */
  const banA = new THREE.MeshStandardMaterial({ map: bannerTexture(copy, "a"), roughness: 0.75, side: THREE.DoubleSide });
  const banB = new THREE.MeshStandardMaterial({ map: bannerTexture(copy, "b"), roughness: 0.75, side: THREE.DoubleSide });
  const banGeo = geo("banner", () => new THREE.PlaneGeometry(2.1, 2.7, 1, 6));
  for (const [w, s, m] of [["N", -8, banA], ["N", 0, banB], ["N", 6.2, banA], ["S", -8, banB], ["S", 0, banA], ["S", 8, banB], ["W", 2.5, banB], ["E", -1, banA]] as [WallSide, number, THREE.Material][]) {
    batch.add(room, m, banGeo, mul(hallWall(w, s, 0, 0), mat(0, 7.95, 1.2 + 0.05, 0)));
    batch.add(room, P.gold, CYL(8), mul(hallWall(w, s, 0, 0), mat(0, 9.32, 1.25, 0, 0.025, 2.3, 0.025, 0, Math.PI / 2)));
  }
  /* o cartaz-pista na parede oeste (z 7), com moldura de latão e luz de quadro */
  {
    const b = hallWall("W", 7, 0, 0);
    batch.add(room, P.brass, BOX0(), mul(b, mat(0, 0.86, 0.03, 0, 1.36, 1.98, 0.05)));
    batch.add(room, new THREE.MeshStandardMaterial({ map: posterTexture(copy), roughness: 0.35, emissiveMap: posterTexture(copy), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.18 }), PLANE_(), mul(b, mat(0, 1.85, 0.065, 0, 1.24, 1.86, 1)));
    batch.add(room, P.brass, BOX0(), mul(b, mat(0, 2.95, 0.16, 0, 0.5, 0.05, 0.2)));
    inst.add(room, "picLight", BOX0(), P.bulbWarm, mul(b, mat(0, 2.92, 0.24, 0, 0.42, 0.02, 0.05)));
  }
  /* lustres de cristal sob as cúpulas laterais */
  for (const d of [DOMES[0], DOMES[2]]) chandelier(room, d.x, 6.9, d.z, HALL_H + d.rise - 0.1, q, P, batch, inst, chandeliers);
  /* castiçais altos junto às pilastras (afastados 0,45 m da parede) */
  for (const [w, s] of [["N", -11.3], ["N", -4], ["S", -11.3], ["S", -4], ["S", 4], ["S", 11.3], ["W", -4.6], ["W", 12.9]] as [WallSide, number][]) {
    const b = mul(hallWall(w, s, 0, 0), mat(0, 0, 0.62));
    batch.add(room, P.gold, CYL0(12), mul(b, mat(0, 0, 0, 0, 0.16, 0.06, 0.16)));
    candelabra(room, b, 1.9, P, batch, inst, flames);
  }
  return { flames, chandeliers };
}
const PLANE_ = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));

/** Lustre de cristal: haste, dois anéis de braços com lâmpadas de vela e cascata de cristais. */
export function chandelier(room: string, x: number, y: number, z: number, ceiling: number, q: Quality, P: Palette, batch: Batch, inst: Instances, out: THREE.Vector3[], scale = 1) {
  const s = scale;
  batch.add(room, P.gold, CYL(8), mat(x, (ceiling + y + 0.9 * s) / 2, z, 0, 0.018, ceiling - y - 0.9 * s, 0.018));
  batch.add(room, P.gold, geo("chBody", () => new THREE.LatheGeometry([[0.02, 0], [0.12, 0.05], [0.07, 0.25], [0.1, 0.5], [0.05, 0.7], [0.08, 0.85], [0.02, 0.92]].map(([a, b]) => new THREE.Vector2(a, b)), 16)), mat(x, y, z, 0, s));
  const crystal = geo("crystal", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.3, 0.5));
  const crystalMat = solid("crystalMat", "#f6f3ff", { metal: 0.1, rough: 0.02, env: 2.2, transparent: true, opacity: 0.85 });
  for (const [ry, rr, n] of [[0.32, 0.85, 10], [0.62, 0.5, 6]] as [number, number, number][]) {
    batch.add(room, P.gold, geo(`chRing${rr}`, () => new THREE.TorusGeometry(rr, 0.015, 6, 48).rotateX(Math.PI / 2)), mat(x, y + ry * s, z, 0, s));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * rr * s, pz = z + Math.sin(a) * rr * s;
      batch.add(room, P.gold, CYL0(8), mat(px, y + ry * s, pz, 0, 0.03 * s, 0.05 * s, 0.03 * s));
      inst.add(room, "chCandle", CYL0(8), P.candle, mat(px, y + (ry + 0.05) * s, pz, 0, 0.016 * s, 0.12 * s, 0.016 * s));
      inst.add(room, "chBulb", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.bulbWarm, mat(px, y + (ry + 0.2) * s, pz, 0, 0.03 * s));
      if (q === "high") for (let d = 0; d < 3; d++) inst.add(room, "crystal", crystal, crystalMat, mat(px, y + (ry - 0.06 - d * 0.08) * s, pz, a, 0.022 * s));
    }
    if (q === "high") for (let k = 0; k < n * 3; k++) { const a = (k / (n * 3)) * Math.PI * 2; inst.add(room, "crystal", crystal, crystalMat, mat(x + Math.cos(a) * rr * 0.7 * s, y + (ry - 0.2) * s, z + Math.sin(a) * rr * 0.7 * s, a, 0.028 * s)); }
  }
  out.push(new THREE.Vector3(x, y + 0.4 * s, z));
}

/** A instalação floral do centro do salão (prop "floral", r 1,6 m): balcão de rosas e a coroa de rosas. */
export function buildFloral(q: Quality, cx: number, cz: number, rad: number, batch: Batch, inst: Instances, flames: THREE.Vector3[]) {
  const P = M(q), room = "salao", rose = roseGeometry(q), leaf = leafGeometry(), petal = petalGeometry();
  const roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
  const leafMat = solid("leafMat", "#2f5a2c", { rough: 0.7, side: THREE.DoubleSide, env: 0.3 });
  let seed = 7; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dense = q === "high" ? 1 : 0.45, R = rad - 0.08, H = 1.05;
  batch.add(room, solid("mossBase", "#1f2a1b", { rough: 1 }), CYL0(32), mat(cx, 0, cz, 0, R - 0.06, H, R - 0.06));
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number) => {
    const m = new THREE.Matrix4(), up = new THREE.Vector3(nx, ny, nz).normalize(), qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    qq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2));
    m.compose(new THREE.Vector3(x, y, z), qq, new THREE.Vector3(s, s, s)); inst.add(room, "rose", rose, roseMat, m, roseColor(r));
  };
  // lateral do balcão (em fiadas) e o topo em cúpula baixa
  const side = Math.round(2 * Math.PI * R / 0.17);
  for (let row = 0; row < 7; row++) for (let k = 0; k < side; k++) {
    if (r() > dense) continue;
    const a = (k + (row % 2) * 0.5) / side * Math.PI * 2 + r() * 0.05, y = 0.1 + row * 0.15 + r() * 0.03;
    put(cx + Math.cos(a) * R, y, cz + Math.sin(a) * R, Math.cos(a), 0.15, Math.sin(a), 0.085 + r() * 0.03);
  }
  for (let ring = 0; ring < 9; ring++) {
    const rr = R * (1 - ring / 9) * 0.98, n = Math.max(1, Math.round(2 * Math.PI * rr / 0.17));
    for (let k = 0; k < n; k++) { if (r() > dense) continue; const a = (k / n) * Math.PI * 2 + ring * 0.4, y = H + 0.06 + 0.22 * (1 - (rr / R) ** 2); put(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, Math.cos(a) * rr / R * 0.6, 1, Math.sin(a) * rr / R * 0.6, 0.09 + r() * 0.03); }
  }
  for (let k = 0; k < 260 * dense; k++) {
    const a = r() * Math.PI * 2, y = 0.08 + r() * (H + 0.1), m = mat(cx + Math.cos(a) * (R + 0.02), y, cz + Math.sin(a) * (R + 0.02), -a + Math.PI / 2, 0.09 + r() * 0.04, 0.09 + r() * 0.04, 1, -0.4 + r() * 0.8, (r() - 0.5) * 1.2);
    inst.add(room, "leaf", leaf, leafMat, m);
  }
  // a coroa: 8 nervuras que se abrem até 2,1 m e se fecham no remate a ~6,8 m
  const ribs = 8, top = 6.8;
  const ribMat = solid("ribMat", "#203222", { rough: 0.95 });
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, rr = 1.05 + 1.05 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.55) - 0.75 * t * t, y = H + 0.15 + (top - H - 0.15) * t; pts.push(new THREE.Vector3(cx + Math.cos(a) * Math.max(0.12, rr), y, cz + Math.sin(a) * Math.max(0.12, rr))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    batch.add(room, ribMat, new THREE.TubeGeometry(curve, 40, 0.1, 6, false));
    const len = curve.getLength(), n = Math.round(len / (0.16 / Math.max(0.5, dense)));
    for (let i = 0; i < n; i++) {
      const t = i / n, p = curve.getPointAt(t), tan = curve.getTangentAt(t), out = new THREE.Vector3(p.x - cx, 0, p.z - cz).normalize();
      for (const [side2, lift] of [[0, 0], [1, 0.4], [-1, 0.4]]) {
        if (side2 !== 0 && r() > dense * 0.8) continue;
        const perp = new THREE.Vector3().crossVectors(tan, out).normalize().multiplyScalar(side2 * 0.11);
        const nrm = out.clone().multiplyScalar(1).add(new THREE.Vector3(0, lift, 0)).add(perp.clone().multiplyScalar(4));
        put(p.x + perp.x + out.x * 0.05, p.y + perp.y, p.z + perp.z + out.z * 0.05, nrm.x, nrm.y + 0.2, nrm.z, 0.075 + r() * 0.03);
      }
    }
    // fio de pérolas em catenária até a próxima nervura (na altura de maior abertura)
    if (q === "high") {
      const b = ((k + 1) / ribs) * Math.PI * 2, y0 = H + 2.2, ra = 2.05;
      const pA = new THREE.Vector3(cx + Math.cos(a) * ra, y0, cz + Math.sin(a) * ra), pB = new THREE.Vector3(cx + Math.cos(b) * ra, y0, cz + Math.sin(b) * ra);
      for (let i = 1; i < 26; i++) { const t = i / 26, p = pA.clone().lerp(pB, t); p.y -= Math.sin(Math.PI * t) * 0.55; inst.add(room, "pearl", SPH(8), solid("pearl", "#f7f1e6", { rough: 0.15, env: 1.6 }), mat(p.x, p.y, p.z, 0, 0.028)); }
    }
  }
  // remate: esfera de rosas brancas e a estrela dourada
  for (let k = 0; k < 40 * dense + 10; k++) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rr = 0.42; put(cx + Math.sin(v) * Math.cos(u) * rr, top + 0.25 + Math.cos(v) * rr, cz + Math.sin(v) * Math.sin(u) * rr, Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u), 0.08); }
  const star = geo("finialStar", () => { const s = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? 0.16 : 0.42; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }).translate(0, 0, -0.03); });
  for (const ry of [0, Math.PI / 2]) batch.add(room, P.goldBright, star, mat(cx, top + 0.95, cz, ry));
  // castiçais sobre as rosas, na borda do balcão
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; candelabra(room, mat(cx + Math.cos(a) * (R - 0.3), H + 0.12, cz + Math.sin(a) * (R - 0.3), a), 1.15, P, batch, inst, flames); }
  // pétalas caídas no terrazzo em volta
  for (let k = 0; k < 220 * dense; k++) {
    const a = r() * Math.PI * 2, d = rad + 0.05 + Math.pow(r(), 2) * 2.4;
    inst.add(room, "fallenPetal", petal, roseMat, mat(cx + Math.cos(a) * d, 0.004 + r() * 0.002, cz + Math.sin(a) * d, r() * Math.PI * 2, 0.03 + r() * 0.02), roseColor(r));
  }
}
