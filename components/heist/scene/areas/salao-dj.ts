/*
 * MET Gala Heist v2 — Grande Salão — a festa (Z05): a cabine do DJ (tampo com dois players, mixer de quatro canais,
 * notebook no suporte, luminária de pescoço, copo d'água, cabos presos com fita, cases na prateleira) e as caixas (dois
 * subwoofers empilhados e uma coluna line array em cada lado); a pista de madeira escura polida com borda de alumínio;
 * a treliça quadrada com talhas de corrente, oito moving heads e duas line arrays penduradas; três globos espelhados com
 * motor e cabo e os pin spots que os acendem; os pontinhos de luz girando no piso e no teto; as luzes coloridas da
 * pista seguindo a batida (122 bpm). Quando o alarme toca, a música para: a festa apaga e ficam as luzes da casa.
 * As texturas desenhadas estão em salao-dj-tex.ts e a pista, a treliça e as line arrays em salao-dj-rig.ts.
 */
import * as THREE from "three";
import { baseProps } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import type { LightAnchor, PropsCtx } from "../interior-props";
import { type RoomsCtx, A } from "./kit";
import { BeamSet, ROOM, L, bx, foot, lathe, roundedBox, salaoBeamMaterial, salaoGlow, salaoMat, salaoSolid, sparkleTexture, spotTexture, tube, worldOf, type Foot } from "./salao-kit";
import { ballTiles, cdjTop, facade, glintTexture, grille, laptopScreen, mixerTop, waveTexture } from "./salao-dj-tex";
import { DANCE, TRUSS, danceFloor, flownArray, trussRig } from "./salao-dj-rig";

export { DANCE } from "./salao-dj-rig";
export const BPM = 122;

/* ======================= cabine do DJ (móvel da planta) ======================= */
const facadeMat = () => salaoMat("djFacade", () => new THREE.MeshPhysicalMaterial({ map: facade(), roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.22, envMapIntensity: 1.0 }));
/** Altura do tampo da cabine (o DJ alcança os pratos de pé, a ~0,5 m). */
export const BOOTH_H = 1.05;
/** Posições (locais) do equipamento sobre o tampo: x ao longo da cabine; z negativo = lado do DJ. */
const GEAR = { cdjX: 0.62, z: -0.15, laptopX: 1.0 };
/** Centro da tela do notebook (altura sobre o piso e z local da base). */
const LAPTOP = { z: -0.02, y: BOOTH_H + 0.256 };
export function djBooth(p: Prop, c: PropsCtx) {
  const f = foot(p), P = c.P, b = c.batch, w = f.w, d = f.d, H = BOOTH_H;
  const blk = salaoSolid("matBlack", "#0e0e10", { rough: 0.86 }), rubber = salaoSolid("rubberMat", "#141416", { rough: 0.95 }), alu = salaoSolid("alu", "#b9bdc2", { metal: 0.9, rough: 0.32 });
  // carcaça: laterais laqueadas, frente com o medalhão, rodapé recuado, prateleira, tampo com borda boleada e manta
  for (const s of [-1, 1]) bx(b, P.lacquer, f, s * (w / 2 - 0.025), 0.05, 0, 0.05, H - 0.1, d, { cast: true });
  b.add(ROOM, facadeMat(), BOX0(), L(f, 0, 0.07, d / 2 - 0.025, 0, w - 0.02, H - 0.13, 0.05), { cast: true });
  bx(b, blk, f, 0, 0, -0.02, w - 0.12, 0.07, d - 0.14);
  bx(b, blk, f, 0, 0.42, -0.05, w - 0.12, 0.025, d - 0.2);
  b.add(ROOM, P.lacquer, roundedBox("djTop", w + 0.06, 0.05, d + 0.06, 0.022), L(f, 0, H - 0.05, 0), { cast: true });
  bx(b, rubber, f, 0, H, -0.04, w - 0.14, 0.004, d - 0.22);
  // dois players e o mixer
  const cdjBody = salaoSolid("cdjBody", "#1d1e21", { metal: 0.35, rough: 0.4 }), cdjTopM = salaoMat("cdjTopMat", () => new THREE.MeshStandardMaterial({ map: cdjTop(), roughness: 0.45, metalness: 0.2 }));
  for (const s of [-1, 1]) {
    const x = s * GEAR.cdjX;
    bx(b, cdjBody, f, x, H + 0.004, GEAR.z, 0.32, 0.1, 0.41, { cast: true });
    b.add(ROOM, cdjTopM, geo("salao-planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), L(f, x, H + 0.105, GEAR.z, Math.PI, 0.31, 1, 0.4));
    c.batch.add(ROOM, alu, geo("salao-jog", () => new THREE.CylinderGeometry(0.1, 0.104, 0.014, 40).translate(0, 0.007, 0)), L(f, x + 0.012, H + 0.104, GEAR.z - 0.04));
    c.batch.add(ROOM, blk, geo("salao-jogPlatter", () => new THREE.CylinderGeometry(0.086, 0.086, 0.004, 40).translate(0, 0.016, 0)), L(f, x + 0.012, H + 0.104, GEAR.z - 0.04));
  }
  const mixTop = salaoMat("mixerTopMat", () => new THREE.MeshStandardMaterial({ map: mixerTop(), roughness: 0.5, metalness: 0.2 }));
  bx(b, cdjBody, f, 0, H + 0.004, GEAR.z, 0.3, 0.095, 0.38, { cast: true });
  b.add(ROOM, mixTop, geo("salao-planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), L(f, 0, H + 0.1, GEAR.z, Math.PI, 0.29, 1, 0.37));
  const knob = geo("salao-knob", () => new THREE.CylinderGeometry(0.011, 0.013, 0.02, 12).translate(0, 0.01, 0)), cap = salaoSolid("knobCap", "#2a2c31", { rough: 0.5 });
  for (let ch = 0; ch < 4; ch++) for (let k = 0; k < 4; k++) c.inst.add(ROOM, "salao-knobs", knob, cap, L(f, -0.098 + ch * 0.065, H + 0.1, GEAR.z + 0.15 - k * 0.046));
  for (let ch = 0; ch < 4; ch++) c.inst.add(ROOM, "salao-faders", BOX0(), alu, L(f, -0.098 + ch * 0.065, H + 0.1, GEAR.z - 0.11 + (ch % 2) * 0.03, 0, 0.012, 0.018, 0.024));
  // notebook no suporte de alumínio (o fundo mais alto, teclado inclinado para o DJ) com a tela (animada) virada para ele
  const lx = GEAR.laptopX, lz = LAPTOP.z, body = salaoSolid("laptopBody", "#a7abb0", { metal: 0.8, rough: 0.3 }), cbox = geo("salao-cbox", () => new THREE.BoxGeometry(1, 1, 1));
  for (const s of [-1, 1]) c.batch.add(ROOM, alu, tube(`laptopStand`, [[0, 0, -0.1], [0, 0.05, 0], [0, 0.14, 0.09]], 0.008, 10, 5), L(f, lx + s * 0.13, H, lz));
  c.batch.add(ROOM, body, cbox, L(f, lx, H + 0.105, lz, 0, 0.33, 0.016, 0.23, -0.38));
  c.batch.add(ROOM, body, cbox, L(f, lx, LAPTOP.y, lz + 0.129, 0, 0.33, 0.22, 0.008, 0.2));
  // luminária de pescoço sobre o mixer, copo d'água, celular e o rolo de fita
  c.batch.add(ROOM, blk, CYL0(12), L(f, -1.02, H, -0.28, 0, 0.05, 0.02, 0.05));
  c.batch.add(ROOM, blk, tube("goose", [[0, 0, 0], [0.02, 0.18, 0.02], [0.12, 0.3, 0.08], [0.26, 0.32, 0.14]], 0.007, 16, 5), L(f, -1.02, H + 0.02, -0.28));
  c.batch.add(ROOM, blk, geo("salao-gooseHead", () => new THREE.ConeGeometry(0.028, 0.06, 12, 1, true).rotateX(Math.PI)), L(f, -0.76, H + 0.33, -0.14));
  c.inst.add(ROOM, "salao-gooseBulb", SPH(8), P.bulbWarm, L(f, -0.76, H + 0.31, -0.14, 0, 0.012));
  const lamp = worldOf(f, -0.76, H + 0.28, -0.14); c.anchors.push({ x: lamp.x, y: lamp.y, z: lamp.z, color: "#ffd8a0", intensity: 1.6, distance: 2.2, room: ROOM });
  c.batch.add(ROOM, c.P.glass, lathe("tumbler", [[0, 0], [0.032, 0], [0.036, 0.1], [0.034, 0.1], [0.03, 0.006], [0, 0.006]], 16), L(f, 1.0, H + 0.004, 0.24));
  c.batch.add(ROOM, salaoSolid("water", "#bcd7e6", { rough: 0.05, transparent: true, opacity: 0.45 }), CYL0(14), L(f, 1.0, H + 0.008, 0.24, 0, 0.029, 0.06, 0.029));
  c.batch.add(ROOM, P.black, BOX0(), L(f, -1.0, H + 0.004, 0.18, 0.3, 0.075, 0.009, 0.155));
  c.batch.add(ROOM, salaoSolid("gaffer", "#2a2a2c", { rough: 0.7 }), geo("salao-tapeRoll", () => new THREE.TorusGeometry(0.04, 0.018, 8, 18).rotateX(Math.PI / 2)), L(f, 0.42, 0.45, -0.2));
  // cabos: dos aparelhos por trás do tampo até o chão e pelo chão até a parede, presos com fita
  const cable = salaoSolid("cable", "#0a0a0b", { rough: 0.6 }), tape = salaoSolid("tapeSilver", "#5a5c60", { rough: 0.75 });
  for (const [x, k] of [[-0.62, 0], [0, 1], [0.62, 2], [1.0, 3]] as [number, number][]) {
    b.add(ROOM, cable, tube(`djCable${k}`, [[x, H + 0.05, GEAR.z - 0.2], [x * 0.9, H + 0.02, -0.42], [x * 0.7, H - 0.25, -0.45], [x * 0.4, 0.2, -0.47], [0.1 * k - 0.15, 0.012, -0.62], [0.08 * k - 0.1, 0.012, -1.25]], 0.009, 32, 5), L(f, 0, 0, 0));
  }
  for (let k = 0; k < 3; k++) bx(b, tape, f, -0.04, 0.012, -0.72 - k * 0.22, 0.42, 0.002, 0.05);
  // na prateleira: case de agulhas/fones aberto, bolsa de discos e um rolo de cabo
  bx(b, salaoSolid("caseShell", "#141416", { rough: 0.5 }), f, -0.7, 0.445, -0.05, 0.44, 0.16, 0.3);
  for (const [x, z, sx, sz] of [[-0.92, -0.05, 0.02, 0.3], [-0.48, -0.05, 0.02, 0.3], [-0.7, 0.1, 0.44, 0.02], [-0.7, -0.2, 0.44, 0.02]] as [number, number, number, number][]) bx(b, alu, f, x, 0.445, z, sx, 0.165, sz);
  bx(b, salaoSolid("recordBag", "#2b2b30", { rough: 0.95 }), f, 0.35, 0.445, -0.05, 0.42, 0.34, 0.2);
  b.add(ROOM, cable, geo("salao-coil", () => new THREE.TorusGeometry(0.11, 0.012, 6, 28).rotateX(Math.PI / 2)), L(f, 0.85, 0.46, -0.05));
}

/* ======================= caixas (móvel da planta) ======================= */
export function djSpeaker(p: Prop, c: PropsCtx) {
  const f = foot(p), b = c.batch, tol = salaoSolid("tolex", "#151517", { rough: 0.92 }), alu = salaoSolid("alu", "#b9bdc2", { metal: 0.9, rough: 0.32 });
  const gm = salaoMat("grilleMat", () => new THREE.MeshStandardMaterial({ map: grille(), roughness: 0.6, metalness: 0.5, color: "#ffffff" }));
  // dois subwoofers empilhados (0,66 × 0,54 × 0,72) com grade, cantoneiras e alças embutidas
  for (let k = 0; k < 2; k++) {
    const y = k * 0.545;
    bx(b, tol, f, 0, y, 0, 0.66, 0.54, 0.72, { cast: true });
    b.add(ROOM, gm, geo("salao-planeZ", () => new THREE.PlaneGeometry(1, 1)), L(f, 0, y + 0.27, 0.361, 0, 0.6, 0.48, 1));
    for (const sx of [-1, 1]) for (const sy of [0, 1]) c.inst.add(ROOM, "salao-corners", BOX0(), alu, L(f, sx * 0.31, y + sy * 0.5, 0.33, 0, 0.05, 0.05, 0.07));
    for (const sx of [-1, 1]) bx(b, salaoSolid("handle", "#08080a", { rough: 0.6 }), f, sx * 0.332, y + 0.22, 0, 0.004, 0.1, 0.22);
  }
  c.inst.add(ROOM, "salao-powerLed", SPH(6), c.P.ledGreen, L(f, 0.26, 1.03, 0.362, 0, 0.006));
  // haste e a coluna line array (oito alto-falantes pequenos atrás da grade)
  b.add(ROOM, alu, CYL0(14), L(f, 0, 1.09, 0, 0, 0.022, 0.4, 0.022));
  bx(b, tol, f, 0, 1.45, 0, 0.2, 1.0, 0.24, { cast: true });
  b.add(ROOM, gm, geo("salao-planeZ", () => new THREE.PlaneGeometry(1, 1)), L(f, 0, 1.95, 0.121, 0, 0.17, 0.96, 1));
  bx(b, alu, f, 0, 2.45, 0, 0.21, 0.02, 0.25);
}

/* ======================= pista, treliça, luzes e globos (decoração animada) ======================= */
const PALETTE = ["#ff2fa8", "#29d6ff", "#ffb340", "#8a5cff", "#fff1dc", "#ff4e3a"].map((c) => new THREE.Color(c));

/** Pista, treliça, moving heads, line arrays, globos, pin spots, pontinhos de luz, telas da cabine e o tique da música. */
export function dressDj(c: RoomsCtx, pins: BeamSet) {
  danceFloor(c);
  trussRig(c);
  flownArray(c, TRUSS.x1 + 0.05, TRUSS.z0 - 0.05); flownArray(c, TRUSS.x1 + 0.05, TRUSS.z1 + 0.05);
  const dark = salaoSolid("headBody", "#151619", { metal: 0.45, rough: 0.42 }), white = new THREE.Color(1, 1, 1);
  /* ---------- moving heads: a base fica no lote; garfo, cabeça, lente, feixe e mancha no piso são instâncias que o
   * tique move (seis chamadas de desenho para os oito aparelhos) ---------- */
  const baseGeo = geo("salao-mhBase", () => new THREE.BoxGeometry(0.34, 0.11, 0.26).translate(0, -0.055, 0));
  const yokeGeo = geo("salao-mhYoke", () => {
    const parts = [new THREE.BoxGeometry(0.05, 0.26, 0.08).translate(-0.15, -0.13, 0), new THREE.BoxGeometry(0.05, 0.26, 0.08).translate(0.15, -0.13, 0), new THREE.BoxGeometry(0.35, 0.04, 0.1).translate(0, -0.02, 0)];
    const g = new THREE.BufferGeometry(), all = parts.map((p) => p.toNonIndexed()); let n = 0; for (const p of all) n += p.getAttribute("position").count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0; for (const p of all) { pos.set(p.getAttribute("position").array as Float32Array, o * 3); nor.set(p.getAttribute("normal").array as Float32Array, o * 3); o += p.getAttribute("position").count; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); return g;
  });
  const headGeo = geo("salao-mhHead", () => new THREE.CylinderGeometry(0.11, 0.12, 0.3, 20).translate(0, -0.05, 0));
  const lensGeo = geo("salao-mhLens", () => new THREE.CircleGeometry(0.085, 20).rotateX(Math.PI / 2));
  const coneGeo = geo("salao-beamCone", () => new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0));
  const spotGeo = geo("salao-spotDisc", () => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
  const spotMat = (gobo: boolean) => salaoMat(gobo ? "spotGoboMat" : "spotSoftMat", () => new THREE.MeshBasicMaterial({ map: spotTexture(gobo), color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const hangs: [number, number][] = [[4.4, TRUSS.z0], [6.5, TRUSS.z0], [8.6, TRUSS.z0], [4.4, TRUSS.z1], [6.5, TRUSS.z1], [8.6, TRUSS.z1], [TRUSS.x1, 3.6], [TRUSS.x1, 5.4]];
  const N = hangs.length;
  const yokeIM = new THREE.InstancedMesh(yokeGeo, dark, N), headIM = new THREE.InstancedMesh(headGeo, dark, N), lensIM = new THREE.InstancedMesh(lensGeo, salaoGlow("mhLens", "#ffffff", 2.4), N);
  const beamIM = new THREE.InstancedMesh(coneGeo, salaoBeamMaterial("mh", 0.8, 1.4), N);
  const spotIM = [new THREE.InstancedMesh(spotGeo, spotMat(true), Math.ceil(N / 2)), new THREE.InstancedMesh(spotGeo, spotMat(false), Math.floor(N / 2))];
  const zone = new THREE.Sphere(new THREE.Vector3(6.5, 3.2, 4.5), 7.5);
  for (const im of [yokeIM, headIM, lensIM, beamIM, ...spotIM]) { im.boundingSphere = zone.clone(); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.room = ROOM; c.group.add(im); }
  for (let i = 0; i < N; i++) beamIM.setColorAt(i, white);
  for (const s of spotIM) for (let i = 0; i < s.count; i++) s.setColorAt(i, white);
  beamIM.renderOrder = 4; for (const s of spotIM) s.renderOrder = 4;
  const clampM = salaoSolid("clamp", "#2c2d30", { metal: 0.6, rough: 0.4 });
  const heads = hangs.map(([hx, hz], k) => {
    c.batch.add(ROOM, dark, baseGeo, mat(hx, TRUSS.y - 0.03, hz), { cast: true });
    c.batch.add(ROOM, clampM, BOX0(), mat(hx, TRUSS.y - 0.04, hz, 0, 0.06, 0.07, 0.06));
    // hierarquia só para as contas (não entra na cena): garfo → cabeça → lente e feixe
    const yoke = new THREE.Object3D(); yoke.position.set(hx, TRUSS.y - 0.14, hz);
    const head = new THREE.Object3D(); head.position.set(0, -0.2, 0); yoke.add(head);
    const lens = new THREE.Object3D(); lens.position.set(0, -0.201, 0); head.add(lens);
    const beam = new THREE.Object3D(); beam.position.set(0, -0.2, 0); head.add(beam);
    return { yoke, head, lens, beam, pan0: Math.atan2(6.5 - hx, 4.5 - hz), ph: k * 1.37, k, spot: spotIM[k % 2], si: k >> 1 };
  });
  /* ---------- globos espelhados (instanciados), motores, cabos e pin spots ---------- */
  const ballMat = salaoMat("mirrorBall", () => new THREE.MeshStandardMaterial({ color: "#dfe3e8", metalness: 1, roughness: 0.12, envMapIntensity: 2.6, flatShading: true, emissive: "#ffffff", emissiveMap: ballTiles(), emissiveIntensity: 0.6 }));
  const BALLS: [number, number, number, number, number][] = [[5.0, 5.35, 3.5, 0.3, 0.55], [5.0, 5.45, 5.6, 0.25, -0.62], [7.6, 5.25, 4.5, 0.34, 0.48]];
  const ballIM = new THREE.InstancedMesh(geo(`salao-ballUnit-${c.q}`, () => new THREE.IcosahedronGeometry(1, c.q === "high" ? 5 : 4)), ballMat, BALLS.length);
  ballIM.boundingSphere = zone.clone(); ballIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ballIM.userData.room = ROOM; c.group.add(ballIM);
  // brilhos (estrelas de quatro pontas) que piscam na borda dos globos: pontos de um só desenho
  const nG = BALLS.length * 5, gPos = new Float32Array(nG * 3), gCol = new Float32Array(nG * 3);
  BALLS.forEach(([x, yb, z, r, sp], bi) => {
    const topY = TRUSS.y + TRUSS.s;
    c.batch.add(ROOM, dark, CYL0(12), mat(x, yb + r + 0.02, z, 0, 0.05, 0.1, 0.05));                              // motor
    c.batch.add(ROOM, salaoSolid("ballCable", "#0c0c0d", { rough: 0.5 }), CYL(5), mat(x, (yb + r + 0.12 + topY) / 2, z, 0, 0.005, topY - yb - r - 0.12, 0.005));
    for (let k = 0; k < 5; k++) { const a = k * 2.4 + sp, e = (k % 3 - 1) * 0.6, i = bi * 5 + k; gPos.set([x + Math.cos(a) * r * 1.03 * Math.cos(e), yb + Math.sin(e) * r * 1.03, z + Math.sin(a) * r * 1.03 * Math.cos(e)], i * 3); }
    // pin spot na treliça mirando o globo (feixe fino)
    const px = x + (x < 6 ? -1.0 : 1.0), pz = z < 4.5 ? TRUSS.z0 : z > 4.5 ? TRUSS.z1 : TRUSS.z0;
    c.batch.add(ROOM, dark, CYL0(10), mat(px, TRUSS.y - 0.16, pz, 0, 0.05, 0.14, 0.05));
    pins.add(new THREE.Vector3(px, TRUSS.y - 0.1, pz), new THREE.Vector3(x, yb, z), 0.05, "#fff4e0", 0.18);
  });
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
  const glints = new THREE.Points(gGeo, new THREE.PointsMaterial({ map: glintTexture(), size: 0.3, sizeAttenuation: true, vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glints.userData.room = ROOM; glints.renderOrder = 6; c.group.add(glints);
  /* ---------- pontinhos de luz dos globos: piso da pista e teto ---------- */
  const sparkle = sparkleTexture();
  const floorDots = new THREE.Mesh(geo("salao-dotsDisc", () => new THREE.CircleGeometry(3.4, 48).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ map: sparkle, color: new THREE.Color("#fff6ea").multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  floorDots.position.set(6.5, DANCE.h + 0.004, 4.5); floorDots.userData.room = ROOM; floorDots.renderOrder = 3; c.group.add(floorDots);
  const ceilDots = new THREE.Mesh(geo("salao-dotsCeil", () => new THREE.PlaneGeometry(11, 11).rotateX(Math.PI / 2)), new THREE.MeshBasicMaterial({ map: sparkle, color: new THREE.Color("#fff6ea").multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ceilDots.position.set(6.3, 9.1, 4.5); ceilDots.userData.room = ROOM; ceilDots.renderOrder = 3; c.group.add(ceilDots);
  /* ---------- telas da cabine (ondas correndo) e a fita de LED da frente: lotes com material animado ---------- */
  const booth = baseProps().find((p) => p.kind === "fixture" && p.model === "djBooth");
  const wave = waveTexture();
  const led = salaoMat("djLed", () => new THREE.MeshBasicMaterial({ color: "#ffb36b" }));
  if (booth) {
    const f = foot(booth);
    const waveMat = salaoMat("waveMat", () => new THREE.MeshBasicMaterial({ map: wave, color: new THREE.Color(1.2, 1.2, 1.2) }));
    for (const s of [-1, 1]) c.batch.add(ROOM, waveMat, geo("salao-cdjScreen", () => new THREE.PlaneGeometry(0.24, 0.05).rotateX(-Math.PI / 2)), L(f, s * GEAR.cdjX, BOOTH_H + 0.107, GEAR.z + 0.15, Math.PI));
    c.batch.add(ROOM, salaoMat("laptopScrMat", () => new THREE.MeshBasicMaterial({ map: laptopScreen(), color: new THREE.Color(1.15, 1.15, 1.15) })), geo("salao-laptopScr", () => new THREE.PlaneGeometry(0.3, 0.19)), L(f, GEAR.laptopX, LAPTOP.y, LAPTOP.z + 0.124, Math.PI, 1, 1, 1, -0.2));
    for (const y of [0.075, BOOTH_H - 0.07]) c.batch.add(ROOM, led, BOX0(), L(f, 0, y, f.d / 2 + 0.002, 0, f.w - 0.1, 0.012, 0.006));
    const glowPos = worldOf(f, 0, 0.12, f.d / 2 + 1.0); A(c, ROOM, glowPos.x, glowPos.y, glowPos.z, "#ffb36b", 2.5, 3);   // brilho do LED no piso (longe do laqueado)
  }
  /* ---------- luzes coloridas da pista (âncoras que pulsam) ---------- */
  const party: { a: LightAnchor; base: number }[] = [];
  for (const [x, z, col, i] of [[4.6, 3.0, "#ff3db0", 15], [8.2, 6.0, "#32cfff", 15], [6.6, 4.6, "#ffb85a", 12]] as [number, number, string, number][]) {
    const a: LightAnchor = { x, y: 5.2, z, color: col, intensity: i, distance: 8.5, room: ROOM }; c.anchors.push(a); party.push({ a, base: i });
  }
  /* ---------- o tique da música ---------- */
  const dir = new THREE.Vector3(), lp = new THREE.Vector3(), tmp = new THREE.Color(), col = new THREE.Color(), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const step = (t: number, on: boolean) => {
    const beat = t * BPM / 60, bf = beat % 1, pulse = Math.exp(-bf * 5), bar = Math.floor(beat / 4), kk = 0.55 + 0.45 * pulse;
    beamIM.visible = on; for (const s of spotIM) s.visible = on;
    heads.forEach((h, i) => {
      if (on) {
        h.yoke.rotation.y = h.pan0 + 0.55 * Math.sin(t * 0.62 + h.ph) + 0.22 * Math.sin(t * 1.7 + h.ph * 2.1);
        h.head.rotation.x = -(0.42 + 0.26 * Math.sin(t * 0.83 + h.ph * 1.3));
      }
      h.yoke.updateMatrixWorld(true);
      yokeIM.setMatrixAt(i, h.yoke.matrixWorld); headIM.setMatrixAt(i, h.head.matrixWorld); lensIM.setMatrixAt(i, h.lens.matrixWorld);
      if (!on) return;
      dir.set(0, -1, 0).transformDirection(h.head.matrixWorld); lp.setFromMatrixPosition(h.lens.matrixWorld);
      const hit = dir.y < -0.08 ? (lp.y - DANCE.h - 0.01) / -dir.y : 7, half = 0.075;
      h.beam.scale.set(hit * half, hit, hit * half); h.beam.updateMatrixWorld(true); beamIM.setMatrixAt(i, h.beam.matrixWorld);
      m4.compose(v3.set(lp.x + dir.x * hit, DANCE.h + 0.006, lp.z + dir.z * hit), q4.identity(), s3.setScalar(Math.max(0.25, hit * half * 1.25))); h.spot.setMatrixAt(h.si, m4);
      tmp.copy(PALETTE[(h.k + (bar >> 1)) % PALETTE.length]);
      beamIM.setColorAt(i, col.copy(tmp).multiplyScalar(0.16 * kk)); h.spot.setColorAt(h.si, col.copy(tmp).multiplyScalar(0.55 * kk));
    });
    for (const im of [yokeIM, headIM, lensIM, beamIM, ...spotIM]) im.instanceMatrix.needsUpdate = true;
    for (const im of [beamIM, ...spotIM]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    BALLS.forEach(([x, yb, z, r, sp], bi) => {
      ballIM.setMatrixAt(bi, m4.compose(v3.set(x, yb, z), q4.setFromAxisAngle(s3.set(0, 1, 0), t * sp), s3.setScalar(r)));
      for (let k = 0; k < 5; k++) { const s = on ? Math.max(0, Math.sin(t * 5.3 + k * 1.9 + sp * 10)) ** 8 : 0, i = (bi * 5 + k) * 3; gCol[i] = gCol[i + 1] = gCol[i + 2] = s; }
    });
    ballIM.instanceMatrix.needsUpdate = true; (gGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    floorDots.rotation.y = t * 0.5; ceilDots.rotation.y = -t * 0.5;
    (floorDots.material as THREE.MeshBasicMaterial).opacity = on ? 0.75 + 0.25 * pulse : 0.25;
    for (const p of party) p.a.intensity = on ? p.base * (0.55 + 0.45 * pulse) : p.base * 0.15;
    wave.offset.x = (t * 0.06) % 1;
    led.color.setHSL(on ? ((bar * 0.13) % 1) : 0.08, on ? 0.85 : 0.6, 0.55).multiplyScalar(on ? 1.4 + pulse : 1);
  };
  step(0, true);
  c.ticks.push({ room: ROOM, tick: (t, _dt, v) => step(t, !v.alarm) });
}
export type { Foot };
