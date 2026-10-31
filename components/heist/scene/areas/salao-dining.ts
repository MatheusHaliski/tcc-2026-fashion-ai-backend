/*
 * MET Gala Heist v2 — Grande Salão — o jantar dos patronos (Z04): mesa redonda de 1,8 m com tampo de marchetaria
 * (estrela de 16 pontas em bordo e pau-rosa sobre nogueira, filete de latão), pé torneado com quatro garras; oito
 * cadeiras "Gala Étoile" (estrutura dourada com pernas curvas, medalhão oval no encosto com a estrelinha, assento e
 * encosto de veludo ameixa); lugares completos (sousplat dourado, prato, guardanapo dobrado com o menu, garfos, faca,
 * colher, talheres de sobremesa, taça de água, de vinho e flûte, pratinho de pão, cartão de lugar) e o centro de mesa
 * (compoteira de rosas, castiçal de cinco velas e velas votivas). Tudo instanciado por peça.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL0, SPH, geo, mat, mul } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import { candelabra, roseGeometry } from "../interior-hall";
import { ROOM, foot, lathe, rand, salaoFabric, salaoMat, salaoSolid, salaoTexture, tube } from "./salao-kit";

const TOP = 0.75, R_TABLE = 0.9;

/** Tampo de marchetaria (vista de cima, 1024 px): nogueira, estrela de bordo e pau-rosa, faixa e filete de latão. */
function marquetry(): THREE.Texture {
  return salaoTexture("marquetry", 1024, 1024, (g, w, h) => {
    const c = w / 2, R = rand(12);
    g.fillStyle = "#3a2214"; g.fillRect(0, 0, w, h);
    // veio da nogueira
    for (let k = 0; k < 160; k++) { g.strokeStyle = `rgba(${20 + R() * 30},${10 + R() * 14},${4 + R() * 8},${0.25 + R() * 0.3})`; g.lineWidth = 1 + R() * 3; g.beginPath(); const y = R() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 6 + (R() - 0.5) * 4); g.stroke(); }
    const ring = (r: number, col: string, lw: number) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); };
    ring(c * 0.97, "#c9a25a", 6); ring(c * 0.9, "#6b3a22", 26); ring(c * 0.86, "#c9a25a", 3);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, len = k % 2 ? 0.42 : 0.62, wd = 0.075;
      for (const [side, colr] of [[1, k % 2 ? "#e2c48f" : "#d7b27a"], [-1, k % 2 ? "#5a2418" : "#7a3a22"]] as [number, string][]) {
        g.fillStyle = colr; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a + side * wd) * c * len * 0.32, c + Math.sin(a + side * wd) * c * len * 0.32); g.lineTo(c + Math.cos(a) * c * len, c + Math.sin(a) * c * len); g.closePath(); g.fill();
      }
    }
    ring(c * 0.1, "#c9a25a", 4); g.fillStyle = "#2a160c"; g.beginPath(); g.arc(c, c, c * 0.09, 0, Math.PI * 2); g.fill();
  });
}
/** Cartão de lugar e menu (texto fictício desenhado; caligrafia). */
function cardTexture(kind: "place" | "menu"): THREE.Texture {
  return salaoTexture(`card-${kind}`, 256, kind === "menu" ? 384 : 128, (g, w, h) => {
    g.fillStyle = "#f6f1e6"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b9924a"; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#3a2a14"; g.textAlign = "center"; g.textBaseline = "middle";
    if (kind === "place") { g.font = "italic 34px 'Snell Roundhand', 'Brush Script MT', Georgia, serif"; g.fillText("★", w / 2, h / 2 - 18); g.fillRect(w * 0.2, h / 2 + 14, w * 0.6, 2); }
    else { g.font = "600 28px 'Didot', Georgia, serif"; g.fillText("GL", w / 2, 50); for (let k = 0; k < 6; k++) { g.fillStyle = "#6b5a40"; g.fillRect(w * 0.18, 110 + k * 40, w * (0.4 + (k % 3) * 0.15), 5); } }
  });
}

/** Cadeira Gala Étoile (peças separadas para instanciar: estrutura dourada, veludo do assento e do encosto). */
function chairParts() {
  return {
    leg: geo("salao-chairLeg", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.46, 0), new THREE.Vector3(0.012, 0.3, 0.01), new THREE.Vector3(-0.008, 0.12, -0.006), new THREE.Vector3(0.02, 0, 0.018)]), 12, 0.016, 6)),
    rail: geo("salao-chairRail", () => new THREE.BoxGeometry(0.46, 0.05, 0.44, 1, 1, 1).translate(0, 0.435, 0)),
    seat: geo("salao-chairSeat", () => { const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(0.23, 0.06, 0.22); return g.translate(0, 0.46, 0); }),
    post: geo("salao-chairPost", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.46, 0), new THREE.Vector3(0.005, 0.7, -0.03), new THREE.Vector3(-0.01, 0.92, -0.05)]), 10, 0.015, 6)),
    medal: geo("salao-chairMedal", () => new THREE.TorusGeometry(0.17, 0.016, 8, 36).scale(1, 1.22, 1)),
    pad: geo("salao-chairPad", () => new THREE.CircleGeometry(0.155, 28).scale(1, 1.22, 1)),
    star: geo("salao-chairStar", () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.014 : 0.035; if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }); }),
  };
}

export function patronTable(p: Prop, c: PropsCtx) {
  const f = foot(p), P = c.P, b = c.batch, inst = c.inst, R = rand(Math.round(f.cx * 31 + f.cz * 17 + 99));
  const at = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz), mat(x, y, z, ry, sx, sy, sz, rx, rz));
  const gold = P.gold, walnut = P.walnut;
  /* mesa: tampo de marchetaria com borda de nogueira e filete de latão; pé torneado com quatro garras */
  const top = salaoMat("marquetryMat", () => new THREE.MeshPhysicalMaterial({ map: marquetry(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }));
  b.add(ROOM, top, geo("salao-tableTop", () => new THREE.CylinderGeometry(R_TABLE, R_TABLE, 0.012, 64).translate(0, 0.006, 0)), at(0, TOP - 0.012, 0), { cast: true });
  b.add(ROOM, walnut, lathe("tableEdge", [[R_TABLE - 0.02, 0], [R_TABLE + 0.005, 0], [R_TABLE + 0.012, 0.012], [R_TABLE + 0.008, 0.035], [R_TABLE - 0.02, 0.04]], 64), at(0, TOP - 0.052, 0), { cast: true });
  b.add(ROOM, gold, geo("salao-tableFillet", () => new THREE.TorusGeometry(R_TABLE + 0.008, 0.004, 4, 96).rotateX(Math.PI / 2)), at(0, TOP - 0.024, 0));
  b.add(ROOM, walnut, lathe("tablePed", [[0, 0.1], [0.16, 0.1], [0.12, 0.16], [0.075, 0.24], [0.1, 0.32], [0.06, 0.4], [0.07, 0.58], [0.12, 0.66], [0.2, 0.7], [0, 0.7]], 32), at(0, 0, 0), { cast: true });
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; b.add(ROOM, walnut, tube("tableClaw", [[0, 0.16, 0], [0.18, 0.1, 0], [0.34, 0.05, 0], [0.42, 0.02, 0]], 0.035, 14, 8), at(0, 0, 0, -a)); b.add(ROOM, gold, SPH(10), at(Math.cos(a) * 0.43, 0.03, Math.sin(a) * 0.43, 0, 0.035)); }
  /* oito cadeiras Gala Étoile viradas para a mesa, algumas puxadas */
  const ch = chairParts(), velvet = salaoFabric("plumVelvet", "#4d1230", c.q, { sheen: "#c07a9a", rough: 0.75 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, pull = R() < 0.3 ? 0.06 : 0, rr = 1.1 + pull, cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const yaw = Math.atan2(-cx, -cz) + (R() - 0.5) * 0.12, cm = at(cx, 0, cz, yaw);
    for (const [lx, lz] of [[-0.2, 0.18], [0.2, 0.18], [-0.19, -0.18], [0.19, -0.18]]) inst.add(ROOM, "salao-chairLeg", ch.leg, gold, mul(cm, mat(lx, 0, lz, lx > 0 ? Math.PI : 0)));
    inst.add(ROOM, "salao-chairRail", ch.rail, gold, cm);
    inst.add(ROOM, "salao-chairSeat", ch.seat, velvet, cm);
    for (const lx of [-0.17, 0.17]) inst.add(ROOM, "salao-chairPost", ch.post, gold, mul(cm, mat(lx, 0, -0.17)));
    inst.add(ROOM, "salao-chairMedal", ch.medal, gold, mul(cm, mat(0, 0.78, -0.24, 0, 1, 1, 1, -0.12)));
    inst.add(ROOM, "salao-chairPad", ch.pad, velvet, mul(cm, mat(0, 0.78, -0.235, 0, 1, 1, 1, -0.12)));
    inst.add(ROOM, "salao-chairPadBack", ch.pad, velvet, mul(cm, mat(0, 0.78, -0.245, Math.PI, 1, 1, 1, 0.12)));
    inst.add(ROOM, "salao-chairStar", ch.star, gold, mul(cm, mat(0, 1.0, -0.268, 0, 1, 1, 1, -0.12)));
  }
  /* lugares: sousplat, prato, guardanapo com menu, talheres, três taças, pratinho de pão, cartão de lugar */
  const porcelain = salaoSolid("porcelain", "#f7f5f0", { rough: 0.25, env: 1.1 }), silver = P.chrome;
  const charger = lathe("charger", [[0, 0], [0.15, 0], [0.158, 0.01], [0.152, 0.012], [0.12, 0.008], [0, 0.006]], 40);
  const plate = lathe("dinner", [[0, 0], [0.11, 0], [0.135, 0.016], [0.13, 0.018], [0.1, 0.008], [0, 0.006]], 32);
  const bread = lathe("breadPlate", [[0, 0], [0.065, 0], [0.08, 0.012], [0.076, 0.014], [0, 0.005]], 24);
  const napkin = geo("salao-napkinFold", () => { const g = new THREE.BoxGeometry(0.12, 0.015, 0.2, 2, 1, 2); const pp = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) + 0.012 * Math.cos(pp.getX(i) * 20)); g.computeVertexNormals(); return g; });
  const fork = geo("salao-fork", () => new THREE.BoxGeometry(0.016, 0.004, 0.19).translate(0, 0.002, 0)), knife = geo("salao-knife", () => new THREE.BoxGeometry(0.014, 0.004, 0.21).translate(0, 0.002, 0));
  const water = lathe("goblet", [[0, 0], [0.035, 0], [0.035, 0.004], [0.005, 0.012], [0.004, 0.07], [0.03, 0.09], [0.04, 0.13], [0.038, 0.17], [0.036, 0.17], [0.036, 0.13], [0, 0.085]], 16);
  const wine = lathe("wineGlass", [[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.012], [0.003, 0.09], [0.035, 0.12], [0.042, 0.16], [0.032, 0.21], [0.03, 0.21], [0.04, 0.16], [0, 0.1]], 16);
  const flute = lathe("flute", [[0, 0], [0.03, 0], [0.03, 0.004], [0.004, 0.012], [0.003, 0.1], [0.022, 0.12], [0.026, 0.2], [0.024, 0.23], [0.022, 0.23], [0.024, 0.2], [0, 0.11]], 16);
  const wineFill = geo("salao-wineFill", () => new THREE.CylinderGeometry(0.037, 0.025, 0.035, 16).translate(0, 0.128, 0));
  const card = salaoMat("placeCard", () => new THREE.MeshStandardMaterial({ map: cardTexture("place"), roughness: 0.8 })), menu = salaoMat("menuCard", () => new THREE.MeshStandardMaterial({ map: cardTexture("menu"), roughness: 0.85 }));
  const linen = P.linen;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, yaw = Math.atan2(-Math.cos(a), -Math.sin(a)), s = at(Math.cos(a) * 0.66, TOP, Math.sin(a) * 0.66, yaw);
    // no referencial do lugar: +z aponta para o centro da mesa (o convidado senta em −z), +x é a esquerda dele
    const p = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0) => mul(s, mat(x, y, z, ry, sx, sy, sz, rx));
    inst.add(ROOM, "salao-charger", charger, P.goldBright, p(0, 0.001, 0.02));
    inst.add(ROOM, "salao-plate", plate, porcelain, p(0, 0.012, 0.02));
    inst.add(ROOM, "salao-napkinFold", napkin, linen, p(0, 0.026, 0.02, 0.15));
    inst.add(ROOM, "salao-menu", geo("salao-menuGeo", () => new THREE.PlaneGeometry(0.09, 0.135).rotateX(-Math.PI / 2)), menu, p(0, 0.045, 0.03, Math.PI + 0.15));
    for (const fx of [0.19, 0.215]) inst.add(ROOM, "salao-fork", fork, silver, p(fx, 0.001, 0.03));
    inst.add(ROOM, "salao-knife", knife, silver, p(-0.19, 0.001, 0.03)); inst.add(ROOM, "salao-knife", knife, silver, p(-0.215, 0.001, 0.035, 0, 0.8));
    inst.add(ROOM, "salao-fork", fork, silver, p(0, 0.001, 0.17, Math.PI / 2, 0.75)); inst.add(ROOM, "salao-knife", knife, silver, p(0, 0.001, 0.195, -Math.PI / 2, 0.7));
    inst.add(ROOM, "salao-goblet", water, P.glass, p(-0.17, 0.001, 0.2)); inst.add(ROOM, "salao-wine", wine, P.glass, p(-0.25, 0.001, 0.14)); inst.add(ROOM, "salao-flute", flute, P.glass, p(-0.09, 0.001, 0.23));
    if (R() > 0.35) inst.add(ROOM, "salao-wineFill", wineFill, salaoSolid("redWine", "#4a0b16", { rough: 0.05, env: 1.4, transparent: true, opacity: 0.88 }), p(-0.25, 0.001, 0.14));
    inst.add(ROOM, "salao-breadPlate", bread, porcelain, p(0.2, 0.001, 0.16));
    inst.add(ROOM, "salao-roll", SPH(10), salaoSolid("roll", "#c88b4a", { rough: 0.8 }), p(0.2, 0.03, 0.16, R(), 0.032, 0.022, 0.026));
    inst.add(ROOM, "salao-placeCard", geo("salao-placeCardGeo", () => new THREE.PlaneGeometry(0.08, 0.04).translate(0, 0.02, 0)), card, p(0, 0.001, 0.12, Math.PI, 1, 1, 1, 0.25));
  }
  /* centro de mesa: compoteira de rosas, castiçal de cinco velas e votivas */
  b.add(ROOM, gold, lathe("compote", [[0, 0], [0.09, 0], [0.04, 0.03], [0.03, 0.09], [0.12, 0.12], [0.14, 0.16], [0.12, 0.16], [0.03, 0.12], [0, 0.12]], 32), at(0, TOP, 0));
  const rose = roseGeometry(c.q), roseMat = salaoSolid("roseWhite", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 }), tones = ["#ffffff", "#f6d4dc", "#e9b1c1", "#fbe7d0", "#8b1e3f"].map((x) => new THREE.Color(x));
  for (let i = 0; i < 22; i++) { const u = R() * Math.PI * 2, v = Math.acos(R() * 0.9), rr = 0.16; inst.add(ROOM, "salao-centerRose", rose, roseMat, at(Math.sin(v) * Math.cos(u) * rr, TOP + 0.13 + Math.cos(v) * rr * 0.55, Math.sin(v) * Math.sin(u) * rr, R() * 6, 0.05 + R() * 0.015, 0.05 + R() * 0.015, 0.05 + R() * 0.015, Math.sin(v) * Math.cos(u) * 1.2, -Math.sin(v) * Math.sin(u) * 1.2), tones[i % tones.length]); }
  candelabra(ROOM, at(0, TOP + 0.13, 0), 0.75, P, b, inst, c.flames);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 0.36, z = Math.sin(a) * 0.36;
    inst.add(ROOM, "salao-votive", lathe("votive", [[0, 0], [0.03, 0], [0.032, 0.06], [0.029, 0.06], [0.027, 0.004], [0, 0.004]], 14), P.glass, at(x, TOP, z));
    inst.add(ROOM, "salao-votiveWax", CYL0(10), P.candle, at(x, TOP + 0.004, z, 0, 0.025, 0.03, 0.025));
    inst.add(ROOM, "salao-flame", geo("salao-flameGeo", () => new THREE.SphereGeometry(1, 8, 6).scale(0.5, 1.4, 0.5)), P.flame, at(x, TOP + 0.045, z, 0, 0.009));
    c.flames.push(new THREE.Vector3(f.cx + x, TOP + 0.045, f.cz + z));
  }
}
