/*
 * MET Gala Heist v2 — Vestíbulo: os móveis únicos do Z02 e os objetos de cena, cada um desenhado exatamente na forma de
 * colisão da planta. Balcão curvo de credenciamento "Nocturne" (laca negra com aletas de latão, tampo de nero, gavetas do
 * lado da recepção, livro de presença, leitores de QR, pulseiras em bandejas, tablet e luminária), chapelaria (balcão com
 * almofadas e a parede de guarda-volumes com nichos numerados e cabides), arara de latão, banco escultural "Silhouette",
 * mesa floral (gueridom de nero e o arranjo de rosas, orquídeas, esporas e eucalipto até 2,2 m), aparador das taças de
 * boas-vindas, painel dos pavimentos, totem acessível com mapa tátil e braile, pórtico do detector, pedestais com cordão,
 * porta-guarda-chuvas, cabideiro e o extintor no nicho. O balcão fica em vestibulo-desk.ts e a chapelaria (balcão,
 * guarda-volumes e arara) em vestibulo-cloak.ts — reexportados daqui; o que os construtores dividem está em
 * vestibulo-furniture-kit.ts.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, mat, mul } from "../interior-batch";
import { foot } from "../interior-props";
import { roseGeometry } from "../interior-hall";
import type { RoomsCtx } from "./kit";
import { BOXC, ROOM, VM, beam, frameGeo, lathe, onWall, vFabric, vGeo, vGlow, vMat, vSolid, vTex, vCopy } from "./vestibulo-kit";
import { L, PLANE_UP, PLANE_V, W, light, reseed, rnd, type Ctx } from "./vestibulo-furniture-kit";

export { desk } from "./vestibulo-desk";
export { cloakWall, coatCheck, rack } from "./vestibulo-cloak";

/* ======================= banco escultural "Silhouette" ======================= */
export function bench(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), w = f.w, d = f.d;
  // estrutura de nogueira com o assento côncavo (as pontas sobem 10 cm) e o estofado capitonê de veludo
  const seatProfile = (x: number) => 0.4 + 0.1 * Math.pow(Math.abs(x) / (w / 2), 3);
  const frame = vGeo(`benchFrame${w}`, () => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0.26); for (let i = 0; i <= 24; i++) { const x = -w / 2 + (i / 24) * w; s.lineTo(x, seatProfile(x) - 0.06); } s.lineTo(w / 2, 0.26); for (let i = 24; i >= 0; i--) { const x = -w / 2 + (i / 24) * w; s.lineTo(x, 0.2 + 0.06 * (x / (w / 2)) ** 2); } const g = new THREE.ExtrudeGeometry(s, { depth: d - 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }); g.translate(0, 0, -(d - 0.04) / 2); return g; });
  c.batch.add(ROOM, V.walnut, frame, L(f, 0, 0, 0), { cast: true });
  const cushion = vGeo(`benchCushion${w}`, () => {
    const g = new THREE.BoxGeometry(w - 0.06, 0.1, d - 0.08, 40, 2, 8), pp = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), top = y > 0;
      let dy = seatProfile(x) - 0.4;
      if (top) { const bx = Math.abs(((x + w) / 0.25) % 1 - 0.5), bz = Math.abs(((z + d) / 0.17) % 1 - 0.5); dy += 0.012 * Math.min(1, Math.hypot(bx, bz) * 2.2) - 0.012; dy += 0.012 * (1 - Math.pow(Math.abs(z) / (d / 2), 4)); }
      pp.setY(i, y + dy);
    }
    g.translate(0, 0.05, 0); g.computeVertexNormals(); return g;
  });
  c.batch.add(ROOM, V.velvetSeat, cushion, L(f, 0, 0.34, 0), { cast: true });
  for (let k = 0; k < 8; k++) for (let j = 0; j < 3; j++) { const x = -0.875 + k * 0.25, z = (j - 1) * 0.17; if (Math.abs(x) > w / 2 - 0.1) continue; c.inst.add(ROOM, "vestibulo-benchButton", SPH(6), V.velvetSeat, L(f, x, 0.34 + seatProfile(x) - 0.4 + 0.088, z, 0, 0.012, 0.007, 0.012)); }
  // pés torneados com ponteiras de latão e a almofada de rolo numa ponta
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    c.batch.add(ROOM, V.walnut, lathe("benchLeg", [[0, 0], [0.022, 0], [0.026, 0.08], [0.035, 0.2], [0.03, 0.3], [0, 0.3]], 12), L(f, sx * (w / 2 - 0.12), 0.0, sz * (d / 2 - 0.08)));
    c.inst.add(ROOM, "vestibulo-sabot", CYL0(10), V.brass, L(f, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.08), 0, 0.024, 0.04, 0.024));
  }
  c.batch.add(ROOM, V.velvetSeat, vGeo("bolster", () => new THREE.CapsuleGeometry(0.085, 0.36, 6, 14).rotateX(Math.PI / 2)), L(f, w / 2 - 0.16, 0.585, 0, 0, 1, 1, 1));
  for (const s of [-1, 1]) c.inst.add(ROOM, "vestibulo-bolsterTassel", vGeo("tasselGeo", () => new THREE.ConeGeometry(0.02, 0.07, 8)), V.giltBright, L(f, w / 2 - 0.16, 0.585, s * 0.27, 0, 1, 1, 1, Math.PI / 2 * s));
}

/* ======================= mesa floral ======================= */
/** Gueridom de nero (Ø 1,4 m) com pé dourado em três volutas e o arranjo exclusivo da gala até ~2,2 m. */
export function floralTable(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), r = f.r, top = 0.76, hi = c.q === "high";
  c.batch.add(ROOM, V.nero, lathe("floralTop", [[0, 0], [r - 0.02, 0], [r, 0.015], [r, 0.035], [r - 0.02, 0.05], [0, 0.05]], 48), L(f, 0, top - 0.05, 0), { cast: true });
  c.batch.add(ROOM, V.brass, vGeo("floralRim", () => new THREE.TorusGeometry(1, 0.012, 6, 64).rotateX(Math.PI / 2)), L(f, 0, top - 0.025, 0, 0, r, 1, r));
  c.batch.add(ROOM, V.gilt, lathe("floralColumn", [[0, 0], [0.1, 0], [0.09, 0.05], [0.05, 0.1], [0.04, 0.3], [0.07, 0.42], [0.04, 0.55], [0.06, 0.66], [0.12, top - 0.05], [0, top - 0.05]], 24), L(f, 0, 0, 0), { cast: true });
  const scroll = vGeo("floralLeg", () => new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0.05, 0.35, 0), new THREE.Vector3(0.3, 0.3, 0), new THREE.Vector3(0.45, 0.12, 0), new THREE.Vector3(0.42, 0.02, 0)), 16, 0.03, 8, false));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; c.batch.add(ROOM, V.gilt, scroll, L(f, 0, 0, 0, a), { cast: true }); c.inst.add(ROOM, "vestibulo-floralPaw", SPH(10), V.gilt, L(f, Math.cos(a) * 0.42, 0.03, -Math.sin(a) * 0.42, 0, 0.045, 0.03, 0.045)); }
  // vaso alto de bronze e o arranjo
  const vy = top;
  c.batch.add(ROOM, V.bronze, lathe("floralVase", [[0, 0], [0.13, 0], [0.14, 0.02], [0.09, 0.08], [0.1, 0.2], [0.17, 0.36], [0.2, 0.44], [0.18, 0.46], [0, 0.46]], 32), L(f, 0, vy, 0), { cast: true });
  const base = vy + 0.44;
  reseed(4242);
  const rose = roseGeometry(c.q), roseMat = vSolid("roseFloral", "#ffffff", { rough: 0.68, side: THREE.DoubleSide, env: 0.4 });
  const leaf = vGeo("floralLeaf", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.06, 0.1, 0, 0.22); s.quadraticCurveTo(-0.06, 0.1, 0, 0); return new THREE.ShapeGeometry(s, 3); });
  const leafM = vSolid("floralLeafM", "#2f5230", { rough: 0.65, side: THREE.DoubleSide, env: 0.3 }), euM = vSolid("eucalyptus", "#7d978a", { rough: 0.75, side: THREE.DoubleSide, env: 0.3 });
  const dome = (n: number, rad: number, h: number, y0: number) => { for (let k = 0; k < n; k++) { const u = rnd() * Math.PI * 2, v = Math.acos(1 - rnd() * 1.1), rr = rad * Math.sin(v), y = y0 + h * Math.cos(v); c.inst.add(ROOM, "vestibulo-rose", rose, roseMat, L(f, Math.cos(u) * rr, y, Math.sin(u) * rr, u, 0.075 + rnd() * 0.03, 0.075 + rnd() * 0.03, 0.075 + rnd() * 0.03, -v * 0.8), new THREE.Color(["#f6f1e6", "#f3d9dd", "#efe3c8", "#e9b9c4", "#fbf7ef"][Math.floor(rnd() * 5)])); } };
  dome(hi ? 70 : 40, 0.42, 0.34, base + 0.06);
  // esporas (delfínios) altas, brancas e azul-claro, e galhos de orquídea pendentes
  const spikeM = [vSolid("delphWhite", "#f4f2ee", { rough: 0.7, env: 0.3 }), vSolid("delphBlue", "#b9c8e6", { rough: 0.7, env: 0.3 })];
  for (let s = 0; s < 7; s++) {
    const a = (s / 7) * Math.PI * 2 + 0.3, rr = 0.12 + rnd() * 0.12, x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, h = 0.75 + rnd() * 0.25, lean = 0.12;
    c.batch.add(ROOM, vSolid("stemGreen", "#45633a", { rough: 0.7 }), BOXC(), beam(W(f, x0, base, z0), W(f, x0 * (1 + lean * 3), base + h, z0 * (1 + lean * 3)), 0.008, 0.008));
    for (let k = 0; k < (hi ? 16 : 9); k++) { const t = 0.35 + (k / (hi ? 16 : 9)) * 0.65, sz = 0.032 * (1.15 - t * 0.6); c.inst.add(ROOM, `vestibulo-delph${s % 2}`, vGeo("delphBud", () => new THREE.IcosahedronGeometry(1, 0)), spikeM[s % 2], L(f, x0 * (1 + lean * 3 * t) + (rnd() - 0.5) * 0.03, base + h * t, z0 * (1 + lean * 3 * t) + (rnd() - 0.5) * 0.03, rnd() * 3, sz)); }
  }
  const bloom = vGeo("orchidBloom", () => { const sh = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2, rr = 0.028 * (0.6 + 0.4 * Math.abs(Math.cos(a * 2.5))); if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ShapeGeometry(sh, 2); });
  const bm = vSolid("orchidWhite", "#fbf6f2", { rough: 0.6, side: THREE.DoubleSide, env: 0.4 });
  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2 + 0.9, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(W(f, Math.cos(a) * (0.3 + t * 0.4), base + 0.25 - t * t * 0.55 + t * 0.12, Math.sin(a) * (0.3 + t * 0.4))); }
    c.batch.add(ROOM, vSolid("stemGreen", "#45633a", { rough: 0.7 }), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.005, 5, false));
    for (let k = 3; k <= 10; k++) { const q = pts[k]; c.inst.add(ROOM, "vestibulo-orchid", bloom, bm, mat(q.x, q.y - 0.025, q.z, a + k, 1.2, 1.2, 1.2, -0.6)); }
  }
  // folhagem: folhas largas na base do buquê e ramos de eucalipto caindo pela borda
  for (let k = 0; k < (hi ? 46 : 26); k++) { const a = rnd() * Math.PI * 2, rr = 0.3 + rnd() * 0.18; c.inst.add(ROOM, "vestibulo-floralLeaf", leaf, leafM, L(f, Math.cos(a) * rr, base + 0.05 + rnd() * 0.15, Math.sin(a) * rr, -a + Math.PI / 2, 1, 1, 1, 1.0 + rnd() * 0.5)); }
  for (let s = 0; s < 8; s++) { const a = (s / 8) * Math.PI * 2; for (let k = 0; k < 7; k++) { const t = k / 7, rr = 0.36 + t * 0.32; c.inst.add(ROOM, "vestibulo-eucalyptus", vGeo("euLeaf", () => new THREE.CircleGeometry(0.025, 8)), euM, L(f, Math.cos(a) * rr, base + 0.05 - t * t * 0.5, Math.sin(a) * rr, a + k, 1, 1, 1, 0.8)); } }
  // pétalas caídas no tampo
  const petal = vGeo("petalFlat", () => new THREE.CircleGeometry(0.02, 6).rotateX(-Math.PI / 2));
  for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, rr = 0.3 + rnd() * 0.32; c.inst.add(ROOM, "vestibulo-petal", petal, roseMat, L(f, Math.cos(a) * rr, top + 0.003, Math.sin(a) * rr, rnd() * 3, 1, 1, 1), new THREE.Color("#f3dde0")); }
  light(c, W(f, 0, 2.6, 0), "#fff1dc", 3.2, 3.4);
}

/* ======================= aparador das taças de boas-vindas ======================= */
export function welcomeConsole(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), w = f.w, d = f.d, h = 0.9;
  c.batch.add(ROOM, V.carrara, BOX0(), L(f, 0, h - 0.04, 0, 0, w + 0.06, 0.04, d + 0.04), { cast: true });
  c.batch.add(ROOM, V.gilt, BOX0(), L(f, 0, h - 0.17, 0.02, 0, w - 0.06, 0.13, d - 0.06), { cast: true });
  c.batch.add(ROOM, V.giltBright, vGeo("consoleCartouche", () => new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1.6, 1, 0.5)), L(f, 0, h - 0.105, d / 2 - 0.02));
  const leg = vGeo("cabriole", () => new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(0.09, 0.55, 0.06), new THREE.Vector3(-0.07, 0.2, -0.02), new THREE.Vector3(0.03, 0.02, 0.04)), 16, 0.026, 8, false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.batch.add(ROOM, V.gilt, leg, L(f, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.08), sx > 0 ? Math.PI : 0), { cast: true });
  c.batch.add(ROOM, V.gilt, BOXC(), L(f, 0, 0.18, 0, 0, w - 0.3, 0.02, 0.04));
  // duas bandejas de prata com taças (flûtes e coupes) e o balde com a garrafa
  const silver = vSolid("silver", "#d4d6da", { metal: 1, rough: 0.15, env: 1.4 });
  const glassM = vSolid("glassFlute", "#eef4f6", { rough: 0.02, env: 1.8, transparent: true, opacity: 0.32 });
  const wine = vSolid("champagneV", "#e8c86a", { rough: 0.08, env: 1.2, transparent: true, opacity: 0.8 });
  const flute = lathe("fluteV", [[0, 0], [0.034, 0.004], [0.006, 0.015], [0.004, 0.12], [0.028, 0.2], [0.033, 0.28], [0.0, 0.28]], 14);
  for (const tx of [-0.55, 0.45]) {
    c.batch.add(ROOM, silver, lathe("trayV", [[0, 0], [0.24, 0], [0.26, 0.015], [0.25, 0.02], [0, 0.008]], 32), L(f, tx, h, 0));
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = k === 8 ? 0 : 0.15; const x = tx + Math.cos(a) * rr, z = Math.sin(a) * rr; c.inst.add(ROOM, "vestibulo-fluteV", flute, glassM, L(f, x, h + 0.01, z)); c.inst.add(ROOM, "vestibulo-fluteWine", vGeo("fluteWineV", () => new THREE.CylinderGeometry(0.026, 0.008, 0.09, 10).translate(0, 0.17, 0)), wine, L(f, x, h + 0.01, z)); }
  }
  c.batch.add(ROOM, silver, lathe("iceBucket", [[0, 0], [0.09, 0], [0.11, 0.2], [0.115, 0.22], [0.105, 0.22], [0.09, 0.02], [0, 0.02]], 24), L(f, -0.02, h, -0.05));
  c.batch.add(ROOM, vSolid("bottleGreenV", "#173d24", { rough: 0.08, env: 1.5 }), lathe("bottleV", [[0, 0], [0.042, 0], [0.044, 0.02], [0.044, 0.2], [0.03, 0.26], [0.015, 0.3], [0.015, 0.34], [0, 0.34]], 14), L(f, -0.02, h + 0.06, -0.05));
  c.batch.add(ROOM, V.gilt, CYL0(10), L(f, -0.02, h + 0.36, -0.05, 0, 0.017, 0.05, 0.017));
  // guardanapos dobrados
  for (let k = 0; k < 5; k++) c.inst.add(ROOM, "vestibulo-napkin", BOX0(), V.paper, L(f, 0.95 - k * 0.012, h + k * 0.006, 0.12, 0.1 * k, 0.12, 0.006, 0.12));
}

/* ======================= painel dos pavimentos e totem acessível ======================= */
export function directory(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), w = f.w - 0.04, tx = vCopy(c.copy);
  c.batch.add(ROOM, V.nero, BOX0(), L(f, 0, 0, 0, 0, w + 0.1, 0.12, 0.3));
  c.batch.add(ROOM, V.bronze, BOX0(), L(f, 0, 0.12, 0, 0, w, 1.62, 0.1), { cast: true });
  c.batch.add(ROOM, V.bronze, vGeo("dirArch", () => new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 32, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2)), L(f, 0, 1.74, 0));
  const t = vTex(`directory-${tx.floors.map((x) => x[1]).join("|")}`, 512, 1280, (g, ww, hh) => {
    g.fillStyle = "#050507"; g.fillRect(0, 0, ww, hh);
    g.strokeStyle = "#b8924a"; g.lineWidth = 4; g.strokeRect(16, 16, ww - 32, hh - 32);
    g.fillStyle = "#e6c77f"; g.textAlign = "center"; g.font = `600 44px 'Didot', Georgia, serif`; g.fillText(tx.museum, ww / 2, 90);
    g.font = `400 24px 'Didot', Georgia, serif`; g.fillText("— Gala Lumière —", ww / 2, 130);
    tx.floors.forEach(([lv, name], i) => {
      const y = 230 + i * 250;
      g.fillStyle = "#b8924a"; g.beginPath(); g.arc(72, y, 40, 0, Math.PI * 2); g.fill(); g.fillStyle = "#050507"; g.font = `700 38px 'DejaVu Sans', Arial, sans-serif`; g.textAlign = "center"; g.fillText(lv, 72, y + 13);
      g.fillStyle = "#efe2c4"; g.textAlign = "left"; g.font = `500 30px 'Didot', Georgia, serif`;
      name.split(" · ").forEach((ln, k) => g.fillText(ln, 132, y - 18 + k * 40));
      g.strokeStyle = "rgba(184,146,74,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(40, y + 110); g.lineTo(ww - 40, y + 110); g.stroke();
    });
  });
  c.batch.add(ROOM, vMat(`directoryMat-${tx.museum}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.08, metalness: 0.1, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.3, envMapIntensity: 1.5 })), PLANE_V(), L(f, 0, 0.98, 0.0505, 0, w - 0.08, 1.48, 1));
  c.batch.add(ROOM, V.giltBright, vGeo("dirEmblem", () => new THREE.TorusGeometry(0.08, 0.012, 6, 24)), L(f, 0, 1.86, 0.052));
}
export function totem(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), tx = vCopy(c.copy);
  // pedestal com o topo inclinado (0,95 m na frente, 1,1 m atrás): mapa tátil em relevo, braile e o texto
  const shape = vGeo("totemBody", () => { const s = new THREE.Shape(); s.moveTo(-0.15, 0); s.lineTo(0.15, 0); s.lineTo(0.15, 1.1); s.lineTo(-0.15, 0.95); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }); g.translate(0, 0, -0.19); g.rotateY(Math.PI / 2); return g; });
  c.batch.add(ROOM, V.bronze, shape, L(f, 0, 0, 0), { cast: true });
  const t = vTex(`totem-${tx.totemTitle}`, 512, 512, (g, ww, hh) => {
    g.fillStyle = "#0b0b0d"; g.fillRect(0, 0, ww, hh);
    g.fillStyle = "#e6c77f"; g.textAlign = "center"; g.font = `700 34px 'DejaVu Sans', Arial, sans-serif`; g.fillText(tx.totemTitle, ww / 2, 50);
    g.strokeStyle = "#c9a24b"; g.lineWidth = 6; g.strokeRect(60, 90, ww - 120, 230); g.strokeRect(150, 150, ww - 300, 110); g.beginPath(); g.moveTo(ww / 2, 90); g.lineTo(ww / 2, 30 + 60); g.stroke();
    g.fillStyle = "#ff5a3a"; g.beginPath(); g.arc(ww / 2, 300, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#efe2c4"; g.textAlign = "left"; g.font = `500 26px 'DejaVu Sans', Arial, sans-serif`;
    tx.totemLines.forEach((ln, i) => g.fillText(ln, 70, 370 + i * 34));
    g.fillStyle = "#c9a24b"; for (let k = 0; k < 18; k++) for (let j = 0; j < 3; j++) if ((k * 7 + j * 3) % 5 < 3) { g.beginPath(); g.arc(80 + k * 20 + (k % 2) * 6, 495 - j * 8, 3, 0, Math.PI * 2); g.fill(); }
  });
  const slope = Math.atan2(0.15, 0.3);
  c.batch.add(ROOM, vMat(`totemMat-${tx.totemTitle}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.4, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.18 })), PLANE_UP(), L(f, 0, 1.03, 0.0, 0, 0.36, 1, 0.28, slope));
  for (let k = 0; k < 6; k++) c.inst.add(ROOM, "vestibulo-tactile", BOX0(), V.giltBright, L(f, -0.1 + k * 0.04, 1.03 + 0.002, -0.02 + (k % 2) * 0.03, 0, 0.025, 0.006, 0.05, slope));
}

/* ======================= detector (pórtico) e cordões ======================= */
export function detector(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), w = f.w, d = f.d, H = 2.25;
  c.batch.add(ROOM, V.nero, BOX0(), L(f, 0, 0, 0, 0, w + 0.06, 0.06, d + 0.06));
  c.batch.add(ROOM, V.bronzeDark, BOX0(), L(f, 0, 0.06, 0, 0, w, H - 0.06, d), { cast: true });
  for (const s of [-1, 1]) c.batch.add(ROOM, V.brass, BOX0(), L(f, s * (w / 2 + 0.003), 0.1, 0, 0, 0.006, H - 0.2, d - 0.08));
  // painel de zonas (LEDs verdes) nas duas faces e o visor no alto
  for (const sz of [-1, 1]) {
    c.batch.add(ROOM, V.blackMatte, BOX0(), L(f, 0, 0.35, sz * (d / 2 + 0.002), 0, w * 0.5, 1.5, 0.006));
    for (let k = 0; k < 8; k++) c.inst.add(ROOM, "vestibulo-detLed", BOX0(), V.ledGreen, L(f, 0, 0.42 + k * 0.18, sz * (d / 2 + 0.006), 0, w * 0.32, 0.05, 0.004));
  }
  c.batch.add(ROOM, vGlow("detDisplay", "#3cff9a", 1.4), BOX0(), L(f, 0, 1.98, d / 2 + 0.004, 0, w * 0.6, 0.1, 0.004));
}
/** Pedestais de latão (base pesada e cabeça de bola) com cordão de veludo e ganchos. */
export function rope(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), alongX = f.w >= f.d, len = Math.max(f.w, f.d), n = Math.max(2, Math.round(len / 1.3) + 1);
  const post = lathe("stanchionV", [[0, 0], [0.16, 0], [0.165, 0.015], [0.15, 0.03], [0.05, 0.06], [0.028, 0.09], [0.024, 0.86], [0.04, 0.88], [0.035, 0.9], [0.05, 0.94], [0.05, 0.97], [0, 1.0]], 18);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) { const t = -len / 2 + 0.08 + (k / (n - 1)) * (len - 0.16), x = alongX ? t : 0, z = alongX ? 0 : t; c.batch.add(ROOM, V.brass, post, L(f, x, 0, z)); pts.push(W(f, x, 0.88, z)); }
  for (let k = 0; k < n - 1; k++) {
    const a = pts[k], b = pts[k + 1], mid = a.clone().lerp(b, 0.5); mid.y -= 0.17;
    c.batch.add(ROOM, V.velvetRed, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.022, 8, false));
    for (const q of [a, b]) c.inst.add(ROOM, "vestibulo-ropeHook", CYL(8), V.brass, mat(q.x + (b.x - a.x) * 0.02 * (q === a ? 1 : -1), q.y, q.z + (b.z - a.z) * 0.02 * (q === a ? 1 : -1), 0, 0.026, 0.07, 0.026, 0, Math.PI / 2));
  }
}

/* ======================= objetos soltos ======================= */
/** Porta-guarda-chuvas, cabideiro, o extintor no nicho e a viga do detector — decoração sem colisão. */
export function smallProps(c: RoomsCtx) {
  const V = VM(c.q);
  // viga do pórtico do detector (liga as duas colunas por cima), com a faixa de LED e o selo da gala
  c.batch.add(ROOM, V.bronzeDark, BOX0(), mat(0, 2.25, 14.9, 0, 5.0, 0.2, 0.6), { cast: true });
  c.batch.add(ROOM, V.brass, BOX0(), mat(0, 2.45, 14.9, 0, 5.04, 0.02, 0.64));
  for (const s of [-1, 1]) c.inst.add(ROOM, "vestibulo-detBeamLed", BOX0(), V.ledGreen, mat(0, 2.31, 14.9 + s * 0.301, 0, 1.8, 0.04, 0.004));
  // porta-guarda-chuvas de latão com três guarda-chuvas e o cabideiro de madeira curvada
  c.batch.add(ROOM, V.brass, lathe("umbrellaStand", [[0, 0], [0.15, 0], [0.16, 0.02], [0.14, 0.04], [0.14, 0.52], [0.155, 0.55], [0.13, 0.56], [0.12, 0.05], [0, 0.05]], 24), mat(2.95, 0, 23.62), { cast: true });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, x = 2.95 + Math.cos(a) * 0.05, z = 23.62 + Math.sin(a) * 0.05;
    c.batch.add(ROOM, V.blackMatte, vGeo("umbrellaFold", () => new THREE.ConeGeometry(0.045, 0.75, 10).rotateX(Math.PI).translate(0, 0.375, 0)), mat(x, 0.08, z, a, 1, 1, 1, Math.cos(a) * 0.12, Math.sin(a) * 0.12));
    c.batch.add(ROOM, V.walnut, vGeo("umbrellaHook", () => new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI)), mat(x + Math.cos(a) * 0.09, 0.86, z + Math.sin(a) * 0.09, a));
  }
  const cs = [7.55, 23.55];
  c.batch.add(ROOM, V.walnut, lathe("coatStandPole", [[0, 0], [0.025, 0], [0.022, 1.7], [0.04, 1.74], [0, 1.8]], 10), mat(cs[0], 0, cs[1]), { cast: true });
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; c.batch.add(ROOM, V.walnut, BOXC(), beam(new THREE.Vector3(cs[0], 0.3, cs[1]), new THREE.Vector3(cs[0] + Math.cos(a) * 0.3, 0.02, cs[1] + Math.sin(a) * 0.3), 0.025, 0.025)); c.batch.add(ROOM, V.walnut, vGeo("coatHookV", () => new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI * 1.3)), mat(cs[0] + Math.cos(a) * 0.08, 1.6, cs[1] + Math.sin(a) * 0.08, -a, 1, 1, 1, 0, Math.PI / 2)); }
  c.batch.add(ROOM, vFabric("scarf", "#7a1a2a", c.q), vGeo("scarfGeo", () => new THREE.CapsuleGeometry(0.03, 0.55, 4, 8)), mat(cs[0] + 0.09, 1.3, cs[1] + 0.03, 0, 1, 1, 0.5));
  c.batch.add(ROOM, V.blackMatte, lathe("hatV", [[0, 0], [0.17, 0], [0.17, 0.008], [0.1, 0.012], [0.095, 0.11], [0, 0.115]], 20), mat(cs[0] - 0.05, 1.74, cs[1] + 0.06, 0, 1, 1, 1, 0.3));
  // extintor discreto no nicho da parede oeste (moldura de bronze, porta de vidro e a placa)
  const w = "W" as const, z = 23.42, at = (y: number, off: number) => onWall(w, z, y, off);
  c.batch.add(ROOM, V.bronze, BOX0(), mul(at(0.2, 0.09), mat(0, 0, 0, 0, 0.46, 0.84, 0.18)));
  c.batch.add(ROOM, vSolid("extBack", "#1d1612", { rough: 0.9 }), BOX0(), mul(at(0.26, 0.185), mat(0, 0, 0, 0, 0.38, 0.72, 0.01)));
  c.batch.add(ROOM, V.bronze, frameGeo("extFrame", 0.46, 0.84, 0.05, 0.03, 0.008), mul(at(0.62, 0.18), mat(0, 0, 0)));
  c.batch.add(ROOM, vSolid("extRed", "#a3141a", { rough: 0.35, env: 1.1 }), lathe("extBody", [[0, 0], [0.075, 0], [0.08, 0.02], [0.08, 0.46], [0.06, 0.52], [0.025, 0.56], [0, 0.56]], 16), mul(at(0.27, 0.27), mat(0, 0, 0)));
  c.batch.add(ROOM, V.blackMatte, BOX0(), mul(at(0.83, 0.27), mat(0.05, 0, 0, 0, 0.08, 0.06, 0.03)));
  c.batch.add(ROOM, V.glass, PLANE_V(), mul(at(0.62, 0.205), mat(0, 0, 0, 0, 0.38, 0.74, 1)));
}
void CYL0;
