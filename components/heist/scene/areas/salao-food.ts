/*
 * MET Gala Heist v2 — Grande Salão — a comida (Z04): a mesa de doces (bolo de cinco andares com flores de açúcar e
 * pérolas, torre de macarons em degradê rosa, prato de cupcakes em três andares, éclairs glaceados, cloches de vidro
 * com petit fours e tortinhas, verrines em camadas, trufas, castiçais de vidro), o bufê (três réchauds de aço com
 * tampa de rolo e fogareiros acesos, bandejas de canapés, frutas num prato de dois andares, tábua de queijos e frios,
 * torre de champanhe de 55 taças, balde de gelo com garrafas, pratos e guardanapos) e o aparador dos garçons (nogueira
 * com portas almofadadas e tampo de mármore verde, pilhas de pratos, rack de copos, cafeteira de prata).
 * Toalhas de linho até o chão com saia plissada; tudo instanciado por tipo (uma chamada por macaron, taça, rosa…).
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import { roseGeometry } from "../interior-hall";
import { ROOM, L, bx, foot, lathe, rand, raisedPanel, roundedBox, salaoFabric, salaoGlass, salaoGlow, salaoMat, salaoSolid, salaoTexture, worldOf, type Foot } from "./salao-kit";

const TOP = 0.9;
const col = (h: string) => new THREE.Color(h);

/* ---------- toalha de linho com saia plissada até o chão ---------- */
function pleatedSkirt(key: string, w: number, d: number, h: number): THREE.BufferGeometry {
  return geo(`salao-skirt-${key}`, () => {
    // contorno do retângulo, pregas a cada 0,12 m (dobra que sai e entra), da borda do tampo até 1 cm do piso
    const per = 2 * (w + d), n = Math.round(per / 0.03), pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    const at = (s: number): [number, number, number, number] => {
      let t = ((s % per) + per) % per;
      if (t < w) return [-w / 2 + t, d / 2, 0, 1]; t -= w;
      if (t < d) return [w / 2, d / 2 - t, 1, 0]; t -= d;
      if (t < w) return [w / 2 - t, -d / 2, 0, -1]; t -= w;
      return [-w / 2, -d / 2 + t, -1, 0];
    };
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * per, [x, z, nx, nz] = at(s), fold = 0.018 * Math.sin((s / 0.12) * Math.PI * 2);
      for (const [y, flare] of [[h, 0], [0.01, 0.02]] as [number, number][]) {
        pos.push(x + nx * (fold + flare), y, z + nz * (fold + flare)); nor.push(nx, 0, nz); uv.push(s / 1.2, y / h);
      }
    }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); return g;
  });
}
/** Mesa de banquete vestida: tampo com toalha, saia plissada, trilho de cetim champanhe com galão dourado. */
function dressedTable(c: PropsCtx, f: Foot, key: string) {
  const P = c.P, linen = P.linen, w = f.w, d = f.d;
  c.batch.add(ROOM, linen, roundedBox(`cloth-${key}`, w + 0.05, 0.035, d + 0.05, 0.012), L(f, 0, TOP - 0.035, 0), { cast: true });
  c.batch.add(ROOM, linen, pleatedSkirt(key, w + 0.04, d + 0.04, TOP - 0.02), L(f, 0, 0, 0), { cast: true });
  const satin = salaoFabric("satin", "#e8d3a6", c.q, { sheen: "#fff3d6", rough: 0.4 });
  bx(c.batch, satin, f, 0, TOP, 0.02, w - 0.3, 0.003, d * 0.55);
  for (const s of [-1, 1]) bx(c.batch, P.gold, f, 0, TOP, 0.02 + s * d * 0.275, w - 0.3, 0.004, 0.012);
}
/** Guirlanda de rosas e folhas em três arcos na frente da saia. */
function garland(c: PropsCtx, f: Foot, w: number, d: number) {
  const rose = roseGeometry(c.q), roseMat = salaoSolid("roseWhite", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 }), leafMat = salaoSolid("leaf", "#3d5f33", { rough: 0.7, side: THREE.DoubleSide });
  const leaf = geo("salao-leafCard", () => new THREE.PlaneGeometry(0.06, 0.03)), R = rand(Math.round(f.cx * 13 + f.cz * 7));
  const tones = [col("#f6d4dc"), col("#ffffff"), col("#f2b7c6"), col("#fbe7d0")];
  const swags = 3, sw = (w - 0.2) / swags;
  for (let k = 0; k < swags; k++) for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = -w / 2 + 0.1 + (k + t) * sw, y = TOP - 0.05 - Math.sin(Math.PI * t) * 0.22, z = d / 2 + 0.05;
    c.inst.add(ROOM, "salao-garlandRose", rose, roseMat, L(f, x, y, z, R() * 6, 0.035 + R() * 0.012, 0.035 + R() * 0.012, 0.035 + R() * 0.012, 1.3, 0), tones[Math.floor(R() * tones.length)]);
    if (i % 2 === 0) c.inst.add(ROOM, "salao-garlandLeaf", leaf, leafMat, L(f, x + 0.03, y - 0.02, z + 0.01, R() * 3, 1, 1, 1, 0.6, R()));
  }
}

/* ======================= mesa de doces ======================= */
export function dessertTable(p: Prop, c: PropsCtx) {
  const f = foot(p), P = c.P, b = c.batch, inst = c.inst, R = rand(41);
  dressedTable(c, f, "dessert");
  garland(c, f, f.w, f.d);
  const porcelain = salaoSolid("porcelain", "#f7f5f0", { rough: 0.25, env: 1.1 }), fondant = salaoSolid("fondant", "#f7f0e4", { rough: 0.55, env: 0.6 });
  const marbleW = P.marbleWhite, gold = P.goldBright;
  // degraus de mármore branco com filete dourado ao fundo (alturas diferentes para o olhar subir)
  for (const [x, h, w] of [[-1.25, 0.16, 0.6], [1.25, 0.1, 0.62], [0, 0.06, 0.7]] as [number, number, number][]) { bx(b, marbleW, f, x, TOP, -0.22, w, h, 0.42, { cast: true }); bx(b, gold, f, x, TOP + h - 0.008, -0.22, w + 0.01, 0.008, 0.43); }
  /* bolo de cinco andares sobre o prato com pé dourado: fondant marfim, faixa dourada e colar de pérolas em cada andar */
  const cake0 = TOP + 0.06;
  b.add(ROOM, gold, lathe("cakeStand", [[0, 0], [0.16, 0], [0.17, 0.012], [0.05, 0.03], [0.04, 0.08], [0.06, 0.1], [0.23, 0.11], [0.235, 0.125], [0, 0.125]], 40), L(f, 0, cake0, -0.22), { cast: true });
  const tiers: [number, number][] = [[0.2, 0.17], [0.165, 0.15], [0.13, 0.14], [0.097, 0.13], [0.066, 0.12]];
  let y = cake0 + 0.125;
  const pearl = SPH(8), pearlMat = salaoSolid("pearl", "#f7f1e6", { rough: 0.15, env: 1.6 });
  tiers.forEach(([r, h], k) => {
    b.add(ROOM, fondant, lathe(`tier${k}`, [[0, 0], [r, 0], [r, h - 0.012], [r - 0.004, h - 0.004], [r - 0.012, h], [0, h]], 48), L(f, 0, y, -0.22), { cast: true });
    b.add(ROOM, gold, CYL(48), L(f, 0, y + 0.012, -0.22, 0, r + 0.002, 0.016, r + 0.002));
    const n = Math.round((2 * Math.PI * r) / 0.014);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; inst.add(ROOM, "salao-cakePearl", pearl, pearlMat, L(f, Math.cos(a) * (r + 0.003), y + 0.006, -0.22 + Math.sin(a) * (r + 0.003), 0, 0.0055)); }
    y += h;
  });
  // cascata de flores de açúcar descendo em espiral e a estrela dourada no topo
  const rose = roseGeometry(c.q), sugar = salaoSolid("sugarRose", "#ffffff", { rough: 0.6, side: THREE.DoubleSide, env: 0.5 }), blush = [col("#f4c9d2"), col("#ffffff"), col("#f0b3c2"), col("#f9e3cf")];
  for (let i = 0; i < 26; i++) {
    const t = i / 26, a = t * Math.PI * 3.2 + 0.4, tier = Math.min(4, Math.floor((1 - t) * 5)), tr = tiers[tier][0], yy = cake0 + 0.125 + tiers.slice(0, tier).reduce((s, x) => s + x[1], 0) + tiers[tier][1] * (0.3 + 0.5 * R());
    inst.add(ROOM, "salao-sugarRose", rose, sugar, L(f, Math.cos(a) * (tr + 0.008), yy, -0.22 + Math.sin(a) * (tr + 0.008), R() * 6, 0.024 + R() * 0.012, 0.024 + R() * 0.012, 0.024 + R() * 0.012, Math.cos(a) * 1.3, -Math.sin(a) * 1.3), blush[i % blush.length]);
  }
  b.add(ROOM, gold, geo("salao-starTopper", () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.022 : 0.055; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 1 }).translate(0, 0.06, -0.004); }), L(f, 0, y, -0.22));
  b.add(ROOM, gold, CYL0(8), L(f, 0, y, -0.22, 0, 0.003, 0.06, 0.003));
  /* torre de macarons (cone de 62 cm) em degradê: framboesa embaixo, rosa, blush e baunilha no alto */
  const tx = -1.25, tz = -0.22, ty = TOP + 0.16, H = 0.62, r0 = 0.17, r1 = 0.035;
  b.add(ROOM, gold, lathe("macBase", [[0, 0], [0.2, 0], [0.2, 0.015], [0.18, 0.02], [0, 0.02]], 36), L(f, tx, ty, tz));
  b.add(ROOM, salaoSolid("cone", "#efe4d4", { rough: 0.9 }), geo("salao-macCone", () => new THREE.ConeGeometry(r0 - 0.02, H, 24, 1, true).translate(0, H / 2, 0)), L(f, tx, ty + 0.02, tz));
  const shell = geo(`salao-macShell-${c.q}`, () => { const a = new THREE.SphereGeometry(1, c.q === "high" ? 14 : 10, c.q === "high" ? 7 : 5).scale(0.021, 0.021, 0.0085); const top = a.clone().translate(0, 0, 0.007), bot = a.clone().translate(0, 0, -0.007); return mergeTwo(top, bot); });
  const fill = geo("salao-macFill", () => new THREE.CylinderGeometry(0.018, 0.018, 0.007, 14).rotateX(Math.PI / 2));
  const shellMat = salaoSolid("macShell", "#ffffff", { rough: 0.62 }), fillMat = salaoSolid("macFill", "#f6ead8", { rough: 0.8 });
  const ombre = ["#c9375f", "#d94f75", "#e56f8c", "#ee90a6", "#f4adbd", "#f7c6d1", "#f9dbe1", "#fbe9e4", "#fdf3ea"].map(col);
  for (let row = 0; ; row++) {
    const yy = 0.025 + row * 0.031; if (yy > H - 0.02) break;
    const rr = r0 + (r1 - r0) * (yy / H) + 0.004, n = Math.max(5, Math.floor((2 * Math.PI * rr) / 0.044)), cc = ombre[Math.min(ombre.length - 1, Math.floor((yy / H) * ombre.length))];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + row * 0.35, m = L(f, tx + Math.cos(a) * rr, ty + 0.02 + yy, tz + Math.sin(a) * rr, -a + Math.PI / 2, 1, 1, 1, -0.3);
      inst.add(ROOM, "salao-macShell", shell, shellMat, m, cc); inst.add(ROOM, "salao-macFill", fill, fillMat, m);
    }
  }
  /* prato de cupcakes em três andares (cápsula plissada dourada, chantili em espiral, pérola no alto) */
  const sx = 1.25, sz = -0.22, sy = TOP + 0.1;
  b.add(ROOM, gold, CYL0(10), L(f, sx, sy, sz, 0, 0.008, 0.62, 0.008));
  const cupPaper = salaoSolid("cupPaper", "#c9a25a", { metal: 0.6, rough: 0.35 }), frost = salaoSolid("frosting", "#ffffff", { rough: 0.55 });
  const cupG = lathe("cupPaperG", [[0, 0], [0.022, 0], [0.03, 0.04], [0.031, 0.042], [0, 0.042]], 18), swirl = geo("salao-swirl", () => new THREE.ConeGeometry(0.03, 0.05, 14, 3).translate(0, 0.025, 0).applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1)));
  const frostCols = [col("#f8dbe3"), col("#ffffff"), col("#d6c2ef"), col("#c5e3c4"), col("#f6e7b4")];
  for (const [ly, pr, n] of [[0, 0.18, 8], [0.22, 0.14, 6], [0.42, 0.1, 4]] as [number, number, number][]) {
    b.add(ROOM, porcelain, lathe(`cupPlate${pr}`, [[0, 0], [pr, 0], [pr + 0.008, 0.012], [pr, 0.014], [0, 0.006]], 32), L(f, sx, sy + ly, sz));
    b.add(ROOM, gold, geo(`salao-cupRim${pr}`, () => new THREE.TorusGeometry(pr + 0.004, 0.003, 4, 40).rotateX(Math.PI / 2)), L(f, sx, sy + ly + 0.012, sz));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = n > 4 ? pr - 0.045 : pr - 0.04, x = sx + Math.cos(a) * rr, z = sz + Math.sin(a) * rr;
      inst.add(ROOM, "salao-cupPaper", cupG, cupPaper, L(f, x, sy + ly + 0.008, z));
      inst.add(ROOM, "salao-swirl", swirl, frost, L(f, x, sy + ly + 0.05, z, R() * 6), frostCols[(i + n) % frostCols.length]);
      inst.add(ROOM, "salao-cupPearl", SPH(8), pearlMat, L(f, x, sy + ly + 0.1, z, 0, 0.006));
    }
  }
  /* éclairs glaceados numa bandeja de prata (frente, à esquerda do bolo) */
  const silver = P.chrome, ecl = geo("salao-eclair", () => new THREE.CapsuleGeometry(0.017, 0.11, 4, 10).rotateZ(Math.PI / 2)), glaze = geo("salao-glaze", () => new THREE.CapsuleGeometry(0.0172, 0.108, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.008, 0));
  bx(b, silver, f, -0.55, TOP + 0.004, 0.24, 0.5, 0.012, 0.26);
  const glazes = [col("#3b1e12"), col("#f2c4cf"), col("#fff6ea"), col("#3b1e12")];
  for (let i = 0; i < 8; i++) { const x = -0.74 + (i % 4) * 0.125, z = 0.18 + Math.floor(i / 4) * 0.12, m = L(f, x, TOP + 0.034, z, 0.05 * (R() - 0.5)); inst.add(ROOM, "salao-eclair", ecl, salaoSolid("choux", "#c48a4c", { rough: 0.7 }), m); inst.add(ROOM, "salao-glaze", glaze, salaoSolid("glazeMat", "#ffffff", { rough: 0.25 }), m, glazes[i % 4]); }
  /* cloches de vidro com petit fours e tortinhas de frutas vermelhas */
  const cloche = geo("salao-cloche", () => new THREE.SphereGeometry(0.13, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1)), gl = salaoGlass("cloche", { opacity: 0.18, tint: "#eef6f8" });
  for (const [x, z, kind] of [[0.62, 0.24, 0], [-1.72, 0.26, 1]] as [number, number, number][]) {
    b.add(ROOM, porcelain, lathe("clochePlate", [[0, 0], [0.06, 0], [0.04, 0.06], [0.15, 0.07], [0.152, 0.08], [0, 0.075]], 32), L(f, x, TOP, z));
    b.add(ROOM, gl, cloche, L(f, x, TOP + 0.08, z));
    b.add(ROOM, gl, SPH(12), L(f, x, TOP + 0.08 + 0.163, z, 0, 0.018));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, rr = i === 6 ? 0 : 0.07, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      if (kind === 0) { inst.add(ROOM, "salao-petitFour", BOX0(), salaoSolid("petitFour", "#ffffff", { rough: 0.5 }), L(f, px, TOP + 0.08, pz, a, 0.034, 0.03, 0.034), [col("#f4c9d2"), col("#c8b7e6"), col("#fdf3ea"), col("#bfe0c2")][i % 4]); inst.add(ROOM, "salao-pfTop", SPH(6), P.goldBright, L(f, px, TOP + 0.113, pz, 0, 0.005)); }
      else { inst.add(ROOM, "salao-tartShell", lathe("tartShell", [[0, 0], [0.028, 0], [0.03, 0.018], [0.025, 0.018], [0.024, 0.006], [0, 0.006]], 16), salaoSolid("tart", "#d9a464", { rough: 0.8 }), L(f, px, TOP + 0.08, pz)); for (let k = 0; k < 4; k++) inst.add(ROOM, "salao-berry", SPH(8), salaoSolid("berry", "#b0122e", { rough: 0.3 }), L(f, px + (k % 2 - 0.5) * 0.02, TOP + 0.094, pz + (Math.floor(k / 2) - 0.5) * 0.02, 0, 0.008)); }
    }
  }
  /* verrines em camadas, trufas e as plaquinhas dos doces */
  const shot = lathe("verrine", [[0, 0], [0.022, 0], [0.024, 0.075], [0.022, 0.075], [0.02, 0.004], [0, 0.004]], 14), layer = CYL0(14);
  for (let i = 0; i < 10; i++) {
    const x = 1.55 + (i % 5) * 0.065, z = 0.17 + Math.floor(i / 5) * 0.08;
    inst.add(ROOM, "salao-verrine", shot, P.glass, L(f, x, TOP + 0.004, z));
    for (const [yy, hh, cc] of [[0.006, 0.022, "#f1e3c8"], [0.028, 0.02, "#b3203c"], [0.048, 0.016, "#fdf8ef"]] as [number, number, string][]) inst.add(ROOM, "salao-verrineLayer", layer, salaoSolid("layer", "#ffffff", { rough: 0.4 }), L(f, x, TOP + 0.004 + yy, z, 0, 0.019, hh, 0.019), col(cc));
  }
  b.add(ROOM, porcelain, CYL0(32), L(f, 0.15, TOP + 0.004, 0.27, 0, 0.13, 0.012, 0.13));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = i === 8 ? 0 : 0.07; inst.add(ROOM, "salao-truffle", SPH(10), salaoSolid("truffle", "#2b160d", { rough: 0.45 }), L(f, 0.15 + Math.cos(a) * rr, TOP + 0.03, 0.27 + Math.sin(a) * rr, 0, 0.017)); }
  for (const x of [-1.25, 1.25, 0, -0.55, 0.62, -1.72, 1.68, 0.15]) inst.add(ROOM, "salao-tentCard", geo("salao-tentGeo", () => { const g = new THREE.BoxGeometry(0.08, 0.05, 0.002); return g.rotateX(-0.35).translate(0, 0.025, 0); }), P.paperWhite, L(f, x, TOP + 0.004, 0.43));
  /* castiçais de vidro nas pontas (chama acesa) */
  for (const x of [-1.85, 1.85]) {
    b.add(ROOM, gold, lathe("hurricaneBase", [[0, 0], [0.07, 0], [0.05, 0.03], [0.03, 0.06], [0.06, 0.08], [0, 0.08]], 24), L(f, x, TOP, -0.2));
    b.add(ROOM, P.glass, lathe("hurricane", [[0.06, 0], [0.085, 0.12], [0.085, 0.32], [0.075, 0.4], [0.073, 0.4], [0.083, 0.32], [0.083, 0.12], [0.058, 0.002]], 24), L(f, x, TOP + 0.08, -0.2));
    b.add(ROOM, P.candle, CYL0(14), L(f, x, TOP + 0.08, -0.2, 0, 0.035, 0.16, 0.035));
    c.inst.add(ROOM, "salao-flame", geo("salao-flameGeo", () => new THREE.SphereGeometry(1, 8, 6).scale(0.5, 1.4, 0.5)), P.flame, L(f, x, TOP + 0.26, -0.2, 0, 0.016));
    c.flames.push(worldOf(f, x, TOP + 0.26, -0.2));
  }
  // pilha de pratinhos e garfinhos na ponta direita
  for (let k = 0; k < 10; k++) inst.add(ROOM, "salao-smallPlate", lathe("smallPlate", [[0, 0], [0.09, 0], [0.1, 0.012], [0.095, 0.014], [0, 0.005]], 24), porcelain, L(f, 1.88, TOP + 0.004 + k * 0.009, 0.25));
}

/* ======================= bufê ======================= */
export function buffetTable(p: Prop, c: PropsCtx) {
  const f = foot(p), P = c.P, b = c.batch, inst = c.inst, R = rand(57), chrome = P.chrome;
  dressedTable(c, f, "buffet");
  garland(c, f, f.w, f.d);
  const porcelain = salaoSolid("porcelain", "#f7f5f0", { rough: 0.25, env: 1.1 });
  /* réchauds: armação, banho-maria, cuba com comida, tampa de rolo (uma aberta) e dois fogareiros acesos */
  const foods = [salaoSolid("risotto", "#e2cc93", { rough: 0.75 }), salaoSolid("beef", "#5a2a18", { rough: 0.55 }), salaoSolid("veg", "#6f8a35", { rough: 0.7 })];
  const lid = geo("salao-rollLid", () => new THREE.CylinderGeometry(0.17, 0.17, 0.55, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2));
  [-0.9, -0.1, 0.7].forEach((x, k) => {
    const z = -0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(ROOM, chrome, CYL0(10), L(f, x + sx * 0.25, TOP, z + sz * 0.14, 0, 0.008, 0.16, 0.008));
    for (const sz of [-1, 1]) b.add(ROOM, chrome, CYL(10), L(f, x, TOP + 0.05, z + sz * 0.14, 0, 0.007, 0.5, 0.007, 0, Math.PI / 2));
    bx(b, chrome, f, x, TOP + 0.13, z, 0.56, 0.1, 0.34, { cast: true });
    bx(b, foods[k], f, x, TOP + 0.228, z, 0.5, 0.004, 0.28);
    for (let i = 0; i < 14; i++) inst.add(ROOM, "salao-foodLump", SPH(8), foods[k], L(f, x + (R() - 0.5) * 0.44, TOP + 0.232, z + (R() - 0.5) * 0.22, R() * 3, 0.02 + R() * 0.012, 0.01, 0.02 + R() * 0.012));
    // tampa de rolo: a do meio aberta para trás, as outras fechadas
    const open = k === 1;
    b.add(ROOM, chrome, lid, mul(L(f, x, TOP + 0.23, z + (open ? -0.17 : 0)), mat(0, 0, 0, 0, 1, 1, 1, open ? -1.9 : 0)));
    b.add(ROOM, P.black, CYL(10), L(f, x, TOP + 0.23 + (open ? 0.12 : 0.17), z + (open ? -0.3 : 0), 0, 0.012, 0.12, 0.012, 0, Math.PI / 2));
    for (const sx of [-0.13, 0.13]) {
      b.add(ROOM, salaoSolid("fuelCan", "#3b3f45", { metal: 0.6, rough: 0.4 }), CYL0(12), L(f, x + sx, TOP, z, 0, 0.035, 0.05, 0.035));
      inst.add(ROOM, "salao-blueFlame", geo("salao-blueFlameGeo", () => new THREE.ConeGeometry(0.02, 0.05, 8, 1, true).translate(0, 0.025, 0)), salaoGlow("blueFlame", "#4da3ff", 1.6, { additive: true }), L(f, x + sx, TOP + 0.05, z));
    }
  });
  /* bandejas de canapés: pão, cobertura colorida (salmão, caviar, queijo, pepino, tomate) */
  const bread = salaoSolid("toast", "#c99a5a", { rough: 0.85 }), topM = salaoSolid("topping", "#ffffff", { rough: 0.45 });
  const tops = ["#f08a68", "#121214", "#f5f0e4", "#7fb25a", "#d8352a"].map(col);
  [-0.95, -0.15, 0.65].forEach((x) => {
    bx(b, chrome, f, x, TOP + 0.004, 0.27, 0.44, 0.012, 0.28);
    for (let i = 0; i < 18; i++) { const gx = x - 0.17 + (i % 6) * 0.068, gz = 0.19 + Math.floor(i / 6) * 0.075; inst.add(ROOM, "salao-canapeBread", BOX0(), bread, L(f, gx, TOP + 0.016, gz, 0, 0.042, 0.014, 0.042)); inst.add(ROOM, "salao-canapeTop", SPH(8), topM, L(f, gx, TOP + 0.031, gz, 0, 0.017, 0.008, 0.017), tops[(i + Math.round(x * 10)) % tops.length]); }
  });
  /* frutas num prato de prata de dois andares: uvas, laranjas, morangos e um abacaxi */
  const fx = 1.5, fz = -0.18;
  b.add(ROOM, chrome, CYL0(10), L(f, fx, TOP, fz, 0, 0.012, 0.42, 0.012));
  for (const [yy, rr] of [[0.06, 0.22], [0.3, 0.15]] as [number, number][]) b.add(ROOM, chrome, lathe(`fruitTier${rr}`, [[0, 0], [rr, 0.02], [rr + 0.01, 0.04], [rr - 0.005, 0.035], [0, 0.012]], 32), L(f, fx, TOP + yy, fz));
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, rr = R() * 0.08, cl = i % 2; inst.add(ROOM, "salao-grape", SPH(8), salaoSolid("grape", "#ffffff", { rough: 0.25 }), L(f, fx - 0.1 + Math.cos(a) * rr * 0.6, TOP + 0.09 + R() * 0.08, fz + Math.sin(a) * rr, 0, 0.012), col(cl ? "#4a1f3d" : "#a7c25a")); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; inst.add(ROOM, "salao-orange", SPH(14), salaoSolid("orange", "#e8861d", { rough: 0.55 }), L(f, fx + 0.08 + Math.cos(a) * 0.07, TOP + 0.12, fz + Math.sin(a) * 0.07, 0, 0.036)); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; inst.add(ROOM, "salao-strawberry", geo("salao-strawGeo", () => new THREE.ConeGeometry(0.015, 0.035, 10).rotateX(Math.PI)), salaoSolid("straw", "#c4142a", { rough: 0.35 }), L(f, fx + Math.cos(a) * 0.09, TOP + 0.35, fz + Math.sin(a) * 0.09, a)); }
  b.add(ROOM, salaoSolid("pineapple", "#b8862e", { rough: 0.7 }), lathe("pineapple", [[0, 0], [0.05, 0.01], [0.065, 0.06], [0.06, 0.13], [0.035, 0.17], [0, 0.17]], 18), L(f, fx, TOP + 0.33, fz));
  for (let k = 0; k < 9; k++) b.add(ROOM, salaoSolid("leaf", "#3d5f33", { rough: 0.7, side: THREE.DoubleSide }), geo("salao-pineLeaf", () => new THREE.ConeGeometry(0.012, 0.16, 4).translate(0, 0.08, 0)), L(f, fx, TOP + 0.49, fz, (k / 9) * Math.PI * 2, 1, 1, 1, 0.35 + (k % 3) * 0.12));
  /* tábua de queijos e frios */
  bx(b, P.oak, f, 1.5, TOP + 0.004, 0.27, 0.46, 0.025, 0.24);
  for (let i = 0; i < 4; i++) inst.add(ROOM, "salao-cheese", geo("salao-wedge", () => new THREE.CylinderGeometry(0.07, 0.07, 0.04, 3, 1, false, 0, Math.PI / 3).translate(0, 0.02, 0)), salaoSolid("cheese", "#f2d27a", { rough: 0.7 }), L(f, 1.34 + i * 0.1, TOP + 0.03, 0.24, i * 0.8), col(i % 2 ? "#f6ecd2" : "#f2c96a"));
  for (let i = 0; i < 12; i++) inst.add(ROOM, "salao-salami", CYL0(14), salaoSolid("salami", "#9e2f2a", { rough: 0.5 }), L(f, 1.32 + (i % 6) * 0.05, TOP + 0.03 + Math.floor(i / 6) * 0.002, 0.34, 0, 0.022, 0.003, 0.022, 0.3));
  /* torre de champanhe: plinto espelhado e 55 taças coupe em pirâmide (5·5, 4·4, 3·3, 2·2, 1), cheias */
  const cx = -1.92, cz = 0;
  b.add(ROOM, salaoSolid("mirrorPlinth", "#d7dadf", { metal: 1, rough: 0.05, env: 1.6 }), CYL0(40), L(f, cx, TOP, cz, 0, 0.36, 0.06, 0.36), { cast: true });
  const coupe = lathe("coupe", [[0, 0], [0.034, 0], [0.034, 0.004], [0.006, 0.012], [0.005, 0.085], [0.02, 0.092], [0.052, 0.112], [0.056, 0.124], [0.053, 0.124], [0.048, 0.114], [0.018, 0.097], [0, 0.095]], 18);
  const fizz = geo("salao-fizz", () => new THREE.CylinderGeometry(0.046, 0.016, 0.022, 16).translate(0, 0.106, 0));
  const step = 0.106, lvlH = 0.118;
  for (let lv = 0; lv < 5; lv++) {
    const n = 5 - lv, y0 = TOP + 0.06 + lv * lvlH;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = cx + (i - (n - 1) / 2) * step, z = cz + (j - (n - 1) / 2) * step;
      inst.add(ROOM, "salao-coupe", coupe, P.glass, L(f, x, y0, z)); inst.add(ROOM, "salao-fizz", fizz, P.champagne, L(f, x, y0, z));
    }
  }
  // balde de gelo de prata com duas garrafas e guardanapo, pilha de pratos e guardanapos
  b.add(ROOM, chrome, lathe("iceBucket", [[0, 0], [0.1, 0], [0.12, 0.2], [0.125, 0.22], [0.115, 0.22], [0.1, 0.02], [0, 0.02]], 28), L(f, -1.45, TOP, -0.3), { cast: true });
  for (const [dx, dz, tilt] of [[-0.03, 0.02, 0.2], [0.04, -0.03, -0.25]] as [number, number, number][]) b.add(ROOM, P.bottleGreen, lathe("champBottle", [[0, 0], [0.042, 0], [0.044, 0.2], [0.03, 0.26], [0.014, 0.3], [0.015, 0.34], [0, 0.34]], 16), L(f, -1.45 + dx, TOP + 0.04, -0.3 + dz, 0, 1, 1, 1, tilt, tilt * 0.5));
  for (let k = 0; k < 12; k++) inst.add(ROOM, "salao-dinnerPlate", lathe("bigPlate", [[0, 0], [0.12, 0], [0.135, 0.016], [0.13, 0.018], [0, 0.006]], 28), porcelain, L(f, 2.2, TOP + 0.004 + k * 0.01, 0.15));
  for (let k = 0; k < 8; k++) inst.add(ROOM, "salao-napkin", BOX0(), P.linen, L(f, 2.2, TOP + 0.004 + k * 0.012, -0.22, 0.4 + k * 0.03, 0.18, 0.012, 0.18));
}

/* ======================= aparador dos garçons ======================= */
const greenMarble = () => salaoMat("verdeAlpi", () => new THREE.MeshStandardMaterial({ map: salaoTexture("verdeAlpi", 512, 256, (g, w, h) => {
  g.fillStyle = "#10261c"; g.fillRect(0, 0, w, h); const R = rand(8);
  for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(${150 + R() * 80},${190 + R() * 50},${170 + R() * 50},${0.15 + R() * 0.3})`; g.lineWidth = 0.6 + R() * 2.2; g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (R() - 0.3) * 90; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
}), roughness: 0.12, envMapIntensity: 1.2 }));
export function serviceBuffet(p: Prop, c: PropsCtx) {
  const f = foot(p), P = c.P, b = c.batch, inst = c.inst, w = f.w, d = f.d, walnut = P.walnut, H = 0.92;
  bx(b, P.black, f, 0, 0, -0.02, w - 0.1, 0.1, d - 0.08);                                                    // rodapé recuado
  bx(b, walnut, f, 0, 0.1, 0, w, H - 0.13, d, { cast: true });
  b.add(ROOM, greenMarble(), roundedBox("sideTop", w + 0.04, 0.035, d + 0.04, 0.012), L(f, 0, H - 0.035, 0), { cast: true });
  // três portas almofadadas com puxadores de latão e uma gaveta corrida em cima
  const n = 3, dw = (w - 0.08) / n;
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + 0.04 + (k + 0.5) * dw;
    b.add(ROOM, walnut, raisedPanel(`sideDoor${Math.round(dw * 100)}`, dw - 0.03, 0.56, 0.025, 0.03), L(f, x, 0.42, d / 2));
    inst.add(ROOM, "salao-knobBrass", SPH(10), P.brass, L(f, x + dw / 2 - 0.07, 0.5, d / 2 + 0.035, 0, 0.012));
  }
  bx(b, walnut, f, 0, 0.74, d / 2, w - 0.08, 0.1, 0.02);
  for (const x of [-w / 4, w / 4]) inst.add(ROOM, "salao-pullBrass", geo("salao-pullGeo", () => new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI).rotateZ(Math.PI)), P.brass, L(f, x, 0.8, d / 2 + 0.025));
  // em cima: pilhas de pratos, rack de copos, cafeteira de prata, guardanapos e o balde com garrafas
  const porcelain = salaoSolid("porcelain", "#f7f5f0", { rough: 0.25, env: 1.1 });
  for (const x of [-0.8, -0.55]) for (let k = 0; k < 14; k++) inst.add(ROOM, "salao-dinnerPlate", lathe("bigPlate", [[0, 0], [0.12, 0], [0.135, 0.016], [0.13, 0.018], [0, 0.006]], 28), porcelain, L(f, x, H + k * 0.01, -0.05));
  bx(b, salaoSolid("rackTray", "#2b2b2f", { rough: 0.7 }), f, -0.05, H, 0, 0.42, 0.03, 0.42);
  const goblet = lathe("waterGoblet", [[0, 0], [0.035, 0], [0.035, 0.004], [0.005, 0.012], [0.004, 0.07], [0.03, 0.09], [0.04, 0.13], [0.038, 0.17], [0.036, 0.17], [0.036, 0.13], [0, 0.085]], 16);
  for (let i = 0; i < 16; i++) inst.add(ROOM, "salao-goblet", goblet, P.glass, L(f, -0.2 + (i % 4) * 0.1, H + 0.03, -0.15 + Math.floor(i / 4) * 0.1));
  b.add(ROOM, P.chrome, lathe("urn", [[0, 0], [0.09, 0], [0.06, 0.04], [0.1, 0.12], [0.11, 0.25], [0.08, 0.33], [0.04, 0.36], [0.05, 0.4], [0, 0.42]], 28), L(f, 0.45, H, -0.05), { cast: true });
  b.add(ROOM, P.black, CYL(8), L(f, 0.55, H + 0.08, -0.05, 0, 0.008, 0.06, 0.008, 0, Math.PI / 2));
  for (let k = 0; k < 9; k++) inst.add(ROOM, "salao-napkin", BOX0(), P.linen, L(f, 0.82, H + k * 0.012, 0.05, 0.1 + k * 0.05, 0.18, 0.012, 0.18));
  bx(b, salaoSolid("caddy", "#5a3a22", { rough: 0.6 }), f, 0.8, H, -0.17, 0.2, 0.08, 0.1);
  for (let i = 0; i < 12; i++) inst.add(ROOM, "salao-cutlery", BOX0(), P.chrome, L(f, 0.72 + (i % 6) * 0.03, H + 0.06, -0.19 + Math.floor(i / 6) * 0.04, 0, 0.006, 0.12, 0.004, (i % 2 ? 0.1 : -0.1)));
  b.add(ROOM, P.chrome, lathe("iceBucket", [[0, 0], [0.1, 0], [0.12, 0.2], [0.125, 0.22], [0.115, 0.22], [0.1, 0.02], [0, 0.02]], 28), L(f, 1.0, H, 0.08));
  b.add(ROOM, P.bottleAmber, lathe("champBottle", [[0, 0], [0.042, 0], [0.044, 0.2], [0.03, 0.26], [0.014, 0.3], [0.015, 0.34], [0, 0.34]], 16), L(f, 1.0, H + 0.04, 0.08, 0, 1, 1, 1, 0.15));
}

/** Junta duas geometrias simples (posição e normal) numa só. */
function mergeTwo(a: THREE.BufferGeometry, b2: THREE.BufferGeometry): THREE.BufferGeometry {
  const A1 = a.index ? a.toNonIndexed() : a, B1 = b2.index ? b2.toNonIndexed() : b2, g = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "uv"]) {
    const x = A1.getAttribute(k) as THREE.BufferAttribute, y = B1.getAttribute(k) as THREE.BufferAttribute;
    const arr = new Float32Array(x.array.length + y.array.length); arr.set(x.array as Float32Array, 0); arr.set(y.array as Float32Array, x.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, x.itemSize));
  }
  return g;
}
