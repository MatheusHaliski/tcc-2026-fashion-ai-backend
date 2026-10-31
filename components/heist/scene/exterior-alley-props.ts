/*
 * MET Gala Heist v2 — beco (Z15): os móveis e objetos com colisão do beco, cada um desenhado na caixa de colisão dele
 * (lib/heist/level.ts → seção "beco" de baseProps, `kind: "fixture"` com `model`), mais as caçambas (`dumpster`):
 *
 *  - becoTotem: totem de embarque da Gala Lumière (motoristas credenciados e saída de funcionários), iluminado;
 *  - becoGasCage: abrigo de GLP do restaurante vizinho — base de concreto, quadro de cantoneira, tela soldada, porta com
 *    cadeado, telhadinho de chapa, quatro botijões P45 ligados ao coletor e o cano amarelo subindo a parede;
 *  - becoDrum: tambor de 200 L de óleo de cozinha usado, com funil e balde;
 *  - becoBins: três contêineres de 240 L (rodas, alça, tampa com dobradiça, um com a tampa entreaberta);
 *  - becoTrashPile: sacos de lixo (pretos e brancos) e um caixote quebrado ao lado da caçamba;
 *  - becoCardboard: fardo de papelão amarrado e caixas desmontadas encostadas;
 *  - becoPallets: pilha de paletes PBR e dois encostados na parede;
 *  - becoCondenser: condensadora de ar no chão, dentro da gaiola antifurto, com a hélice girando;
 *  - becoJunk: colchão velho encostado, cadeira de escritório quebrada e um balde;
 *  - becoRecycling: coleta seletiva do museu (quatro cestos com tampa colorida num suporte).
 *
 * Tudo vai para um `Bag` por material (exterior-alley-geo.ts): uma chamada de desenho por material, não por objeto.
 */
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { Bag, box0, cyl0, mul, rod, taper, tm, tube, type V3 } from "./exterior-alley-geo";
import { rng, type Rect01 } from "./exterior-alley-tex";

export const Y0 = SIDEWALK_Y;
/** Pegada do móvel: centro, largura (x local), fundo (z local; a frente olha para +z local) e giro. */
export interface Foot { cx: number; cz: number; w: number; d: number; yaw: number }
export function footOf(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw };
}
/** Matriz no referencial do móvel (y a partir do chão do beco). */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(tm(f.cx, Y0, f.cz, f.yaw), tm(x, y, z, ry, sx, sy, sz, rx, rz));
const B = (bag: Bag, key: string, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, ry = 0, rx = 0, rz = 0) =>
  bag.add(key, box0(), { m: L(f, x, y, z, ry, sx, sy, sz, rx, rz), color, worldUv: true });
/** Plano (olha para +z) com UV dentro de um retângulo da folha. */
export function planeUV(w: number, h: number, r: Rect01): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h), a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i));
  return g;
}

/* ---------- peças repetidas ---------- */
/** Saco de lixo: icosaedro amassado (ruído por posição, igual nos vértices repetidos), achatado no chão, com o nó. */
export function bagGeo(seed: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 3), p = g.getAttribute("position") as THREE.BufferAttribute, r = rng(seed);
  const k = [r() * 6, r() * 6, r() * 6, 2 + r() * 2, 3 + r() * 3];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const n = 0.1 * Math.sin(v.x * k[3] + k[0]) * Math.sin(v.y * k[4] + k[1]) + 0.05 * Math.sin(v.z * 9 + k[2]) * Math.sin(v.x * 11 + k[1]) + 0.025 * Math.sin((v.x + v.y * 2 + v.z) * 23 + k[0]);
    const rr = 0.5 * (1 + n);
    let y = v.y * rr; if (y < -0.32) y = -0.32 - (y + 0.32) * 0.15;          // assenta no chão
    p.setXYZ(i, v.x * rr * (1 + 0.15 * Math.max(0, -v.y)), y, v.z * rr * (1 + 0.15 * Math.max(0, -v.y)));
  }
  g.scale(w, h, w * 0.92); g.translate(0, 0.32 * h, 0);
  const knot = new THREE.ConeGeometry(0.07, 0.16, 7).translate(0, 0.82 * h, 0);
  const ears = [new THREE.SphereGeometry(0.055, 6, 4).scale(1.6, 0.6, 0.8).translate(0.07, 0.9 * h, 0), new THREE.SphereGeometry(0.055, 6, 4).scale(1.6, 0.6, 0.8).translate(-0.07, 0.9 * h, 0.02)];
  const parts = [g, knot, ...ears].map((x) => x.toNonIndexed());
  const out = new THREE.BufferGeometry(); const pos: number[] = [];
  for (const x of parts) pos.push(...(x.getAttribute("position").array as Float32Array));
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals();
  return out;
}
/** Palete PBR (1,2 × 1,0 × 0,144 m): tábuas de cima, travessas, nove blocos e as tábuas de baixo. Base em y = 0. */
export function pallet(bag: Bag, at: THREE.Matrix4, tone: THREE.ColorRepresentation, seed: number) {
  const r = rng(seed), add = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const c = new THREE.Color(tone).multiplyScalar(0.82 + r() * 0.3);
    bag.add("wood", box0(), { m: mul(at, tm(x, y, z, (r() - 0.5) * 0.015, sx, sy, sz)), color: c, worldUv: true });
  };
  for (const x of [-0.55, 0, 0.55]) add(x, 0, 0, 0.1, 0.022, 1.0);                                   // tábuas de baixo
  for (const x of [-0.55, 0, 0.55]) for (const z of [-0.45, 0, 0.45]) add(x, 0.022, z, 0.1, 0.078, 0.1); // blocos
  for (const z of [-0.45, 0, 0.45]) add(0, 0.1, z, 1.2, 0.022, 0.1);                                  // travessas
  for (let k = 0; k < 7; k++) add(0, 0.122, -0.45 + k * 0.15, 1.2, 0.022, k === 0 || k === 6 ? 0.1 : 0.085); // tábuas de cima
}
/** Botijão P45 (0,375 × 1,3 m): pé, corpo com ombros, alça de proteção e válvula. Base em y = 0. */
export function cylinderP45(bag: Bag, at: THREE.Matrix4, color: THREE.ColorRepresentation) {
  const body = new THREE.LatheGeometry([[0, 0.06], [0.18, 0.06], [0.187, 0.1], [0.187, 1.02], [0.17, 1.1], [0.12, 1.15], [0.05, 1.17], [0, 1.17]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  bag.add("paintGloss", body, { m: at, color });
  bag.add("rusty", cyl0(0.17, 0.175, 0.07, 18, true), { m: at, color: "#3a3d40" });                     // pé
  bag.add("rusty", new THREE.TorusGeometry(0.12, 0.012, 5, 18).rotateX(Math.PI / 2), { m: mul(at, tm(0, 1.29, 0)), color: "#4a4d50" });
  for (const a of [0, Math.PI]) bag.add("rusty", box0(), { m: mul(at, tm(Math.cos(a) * 0.12, 1.16, Math.sin(a) * 0.12, 0, 0.025, 0.13, 0.025)), color: "#4a4d50" });
  bag.add("galv", cyl0(0.022, 0.022, 0.09, 8), { m: mul(at, tm(0, 1.17, 0)) });
}

/* ======================= móveis do beco ======================= */
export function buildFixture(bag: Bag, p: Prop, signs: Record<string, Rect01>) {
  const f = footOf(p);
  switch (p.model) {
    case "becoTotem": return totem(bag, f, signs);
    case "becoGasCage": return gasCage(bag, f, signs);
    case "becoDrum": return drum(bag, f);
    case "becoBins": return bins(bag, f);
    case "becoTrashPile": return trashPile(bag, f);
    case "becoCardboard": return cardboard(bag, f);
    case "becoPallets": return pallets(bag, f);
    case "becoCondenser": return condenser(bag, f);
    case "becoJunk": return junk(bag, f);
    case "becoRecycling": return recycling(bag, f, signs);
  }
}

/** Totem de embarque (0,5 × 0,3 × 2,0 m): base com lastro, corpo preto com filetes dourados, as duas faces impressas e
 * iluminadas por dentro, capa de cima. A face da frente olha para quem entra da avenida. */
function totem(bag: Bag, f: Foot, signs: Record<string, Rect01>) {
  const GOLD = "#b8914a", BLACK = "#0d0d0e";
  B(bag, "paint", f, 0, 0, 0, 0.56, 0.035, 0.34, "#1a1a1b");                                 // chapa de base
  B(bag, "paint", f, 0, 0.035, 0, 0.5, 0.11, 0.28, BLACK);                                    // lastro
  B(bag, "paintGloss", f, 0, 0.145, 0, 0.46, 1.83, 0.2, BLACK);                               // corpo
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(bag, "paintGloss", f, sx * 0.226, 0.145, sz * 0.096, 0.012, 1.83, 0.012, GOLD);
  B(bag, "paintGloss", f, 0, 1.975, 0, 0.5, 0.025, 0.24, GOLD);                               // capa
  B(bag, "paintGloss", f, 0, 0.145, 0, 0.47, 0.012, 0.21, GOLD);
  bag.add("signsLit", planeUV(0.42, 1.36, signs.totemFront), { m: L(f, 0, 1.04, 0.1015) });
  bag.add("signsLit", planeUV(0.42, 1.36, signs.totemBack), { m: L(f, 0, 1.04, -0.1015, Math.PI) });
}

/** Abrigo de GLP (largura ao longo da parede, fundo 1,15 m, altura 1,9 m). */
function gasCage(bag: Bag, f: Foot, signs: Record<string, Rect01>) {
  const w = f.w, d = f.d, H = 1.85, x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  B(bag, "concrete", f, 0, 0, 0, w, 0.1, d);                                                  // base
  // quadro de cantoneira galvanizada: montantes, travessas de cima e de baixo
  for (const x of [x0 + 0.03, 0, x1 - 0.03]) for (const z of [z0 + 0.03, z1 - 0.03]) B(bag, "galv", f, x, 0.1, z, 0.04, H - 0.1, 0.04);
  for (const y of [0.12, 1.0, H - 0.04]) { B(bag, "galv", f, 0, y, z1 - 0.03, w, 0.035, 0.035); B(bag, "galv", f, 0, y, z0 + 0.03, w, 0.035, 0.035); for (const x of [x0 + 0.03, x1 - 0.03]) B(bag, "galv", f, x, y, 0, 0.035, 0.035, d); }
  // tela soldada: frente (duas folhas: a da esquerda é a porta, um pouco aberta), lados e teto
  const panel = (m: THREE.Matrix4, pw: number, ph: number) => bag.add("weld", new THREE.PlaneGeometry(pw, ph), { m, worldUv: true });
  panel(L(f, w * 0.25, 0.1 + (H - 0.1) / 2, z1 - 0.03), w / 2 - 0.05, H - 0.14);
  const hinge = L(f, x0 + 0.05, 0, z1 - 0.03, -0.32);                                          // porta entreaberta (dobradiça à esquerda)
  bag.add("weld", new THREE.PlaneGeometry(w / 2 - 0.08, H - 0.14).translate((w / 2 - 0.08) / 2, 0.1 + (H - 0.1) / 2, 0), { m: hinge, worldUv: true });
  bag.add("galv", box0(), { m: mul(hinge, tm((w / 2 - 0.08) / 2, 0.12, 0, 0, w / 2 - 0.08, 0.03, 0.03)) });
  bag.add("galv", box0(), { m: mul(hinge, tm((w / 2 - 0.08) / 2, H - 0.07, 0, 0, w / 2 - 0.08, 0.03, 0.03)) });
  bag.add("galv", box0(), { m: mul(hinge, tm(w / 2 - 0.1, 0.1, 0, 0, 0.03, H - 0.14, 0.03)) });
  bag.add("paintGloss", new THREE.TorusGeometry(0.03, 0.007, 5, 12, Math.PI).rotateZ(Math.PI), { m: mul(hinge, tm(w / 2 - 0.1, 1.06, 0.03)), color: "#b8902a" });  // cadeado aberto
  bag.add("paintGloss", box0(), { m: mul(hinge, tm(w / 2 - 0.1, 0.97, 0.03, 0, 0.05, 0.06, 0.02)), color: "#c9a23a" });
  for (const s of [-1, 1]) panel(L(f, s * (w / 2 - 0.03), 0.1 + (H - 0.1) / 2, 0, Math.PI / 2), d - 0.06, H - 0.14);
  // telhadinho de chapa (cai para a frente) com pingadeira
  B(bag, "galv", f, 0, H, -0.02, w + 0.12, 0.02, d + 0.16, undefined, 0, -0.08);
  // botijões P45 (cores de distribuidoras inventadas) e as mangueiras até o coletor de cobre junto à parede (de onde o cano
  // amarelo sobe pela fachada: exterior-alley-facade.ts)
  const cols = ["#7b8288", "#2f6b3a", "#7b8288", "#a33228"];
  cols.forEach((c, k) => {
    const x = x0 + 0.3 + k * ((w - 0.6) / 3), at = L(f, x, 0.1, -0.08, k * 0.7);
    cylinderP45(bag, at, c);
    bag.add("paint", tube([[x, 1.36, -0.08], [x, 1.5, -0.2], [x * 0.9, 1.58, z0 + 0.12]], 0.01, 10, 5), { m: L(f, 0, 0, 0), color: "#2a2a2a" });
  });
  bag.add("paintGloss", rod([x0 + 0.15, 1.58, z0 + 0.12], [x1 - 0.15, 1.58, z0 + 0.12], 0.02, 8), { m: L(f, 0, 0, 0), color: "#b87333" });
  bag.add("paintGloss", box0(), { m: L(f, x1 - 0.15, 1.5, z0 + 0.04, 0, 0.12, 0.16, 0.08), color: "#c9a23a" });  // regulador
  // placa na porta e extintor pendurado no quadro (do lado de fora)
  bag.add("signs", planeUV(0.36, 0.18, signs.gasSign), { m: mul(hinge, tm(w / 4, 1.45, 0.012)) });
  const ext = L(f, x1 + 0.0, 0.62, z1 + 0.09);
  bag.add("paintGloss", cyl0(0.075, 0.075, 0.42, 14), { m: ext, color: "#c3141a" });
  bag.add("paintGloss", new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { m: mul(ext, tm(0, 0.42, 0)), color: "#c3141a" });
  bag.add("paint", box0(), { m: mul(ext, tm(0, 0.47, 0, 0, 0.05, 0.06, 0.04)), color: "#1a1a1a" });
  bag.add("paint", tube([[0, 0.5, 0.02], [0.06, 0.4, 0.07], [0.08, 0.15, 0.07]], 0.008, 8, 4), { m: ext, color: "#151515" });
}

/** Tambor de 200 L de óleo usado: corpo azul desbotado com os dois aros, tampa com bujão, funil e balde ao lado. */
function drum(bag: Bag, f: Foot) {
  const at = L(f, 0, 0, 0);
  bag.add("paint", cyl0(0.285, 0.285, 0.88, 22), { m: at, color: "#2c4e78" });
  for (const y of [0.29, 0.59]) bag.add("paint", new THREE.TorusGeometry(0.288, 0.012, 5, 22).rotateX(Math.PI / 2), { m: mul(at, tm(0, y, 0)), color: "#24405f" });
  bag.add("rusty", new THREE.TorusGeometry(0.28, 0.014, 5, 22).rotateX(Math.PI / 2), { m: mul(at, tm(0, 0.88, 0)), color: "#4a3a2a" });
  bag.add("rusty", cyl0(0.27, 0.27, 0.01, 22), { m: mul(at, tm(0, 0.875, 0)), color: "#2a2620" });
  bag.add("paintGloss", cyl0(0.11, 0.025, 0.16, 14, true), { m: mul(at, tm(0.08, 0.885, 0.04)), color: "#d9d2c2" });   // funil
  bag.add("paintGloss", cyl0(0.025, 0.02, 0.06, 8), { m: mul(at, tm(0.08, 0.83, 0.04)), color: "#d9d2c2" });
  bag.add("paint", cyl0(0.032, 0.032, 0.02, 10), { m: mul(at, tm(-0.15, 0.885, -0.08)), color: "#3a3a3a" });             // bujão
  // escorrido de gordura (faixa escura saindo da boca)
  bag.add("bag", box0(), { m: mul(at, tm(0.0, 0.42, 0.284, 0, 0.09, 0.46, 0.006)) });
}

/** Três contêineres de 240 L (0,58 × 0,73 × 1,07 m) lado a lado, alças e rodas para a frente (para o beco). */
function bins(bag: Bag, f: Foot) {
  const cols = ["#2e6b34", "#2e6b34", "#575c60"], n = 3, step = f.w / n;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + step * (k + 0.5), c = cols[k], ry = (k - 1) * 0.06, at = L(f, x, 0, 0.02, ry);
    bag.add("plastic", taper(0.5, 0.6, 0.58, 0.7, 0.98), { m: mul(at, tm(0, 0.06, 0)), color: c });
    bag.add("plastic", taper(0.6, 0.72, 0.6, 0.72, 0.05), { m: mul(at, tm(0, 1.0, 0)), color: new THREE.Color(c).multiplyScalar(0.85) });     // borda
    for (const sx of [-1, 1]) bag.add("plastic", box0(), { m: mul(at, tm(sx * 0.27, 0.2, 0, 0, 0.02, 0.7, 0.62)), color: new THREE.Color(c).multiplyScalar(0.9) }); // nervuras laterais
    // tampa: a do meio entreaberta (um saco aparece)
    const open = k === 1 ? 0.45 : 0, lid = mul(at, tm(0, 1.05, 0.36));
    bag.add("plastic", box0(), { m: mul(lid, mul(tm(0, 0, 0, 0, 1, 1, 1, open), tm(0, 0, -0.37, 0, 0.62, 0.04, 0.76))), color: new THREE.Color(c).multiplyScalar(0.8) });
    if (open) bag.add("bag", bagGeo(40 + k, 0.5, 0.4), { m: mul(at, tm(0, 0.86, -0.02)) });
    // alça, eixo e rodas (na frente, para o beco), número pintado
    bag.add("plastic", rod([-0.24, 1.0, 0.39], [0.24, 1.0, 0.39], 0.018, 8), { m: at, color: new THREE.Color(c).multiplyScalar(0.75) });
    bag.add("galv", rod([-0.3, 0.1, 0.3], [0.3, 0.1, 0.3], 0.012, 6), { m: at });
    for (const sx of [-1, 1]) bag.add("rubber", new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14).rotateZ(Math.PI / 2), { m: mul(at, tm(sx * 0.3, 0.1, 0.3)) });
    bag.add("plastic", box0(), { m: mul(at, tm(0, 0.55, 0.352, 0, 0.16, 0.1, 0.006)), color: "#e8e6df" });
  }
}

/** Sacos de lixo amontoados (pretos e brancos do restaurante) e um caixote de feira quebrado. */
function trashPile(bag: Bag, f: Foot) {
  const r = rng(77), spots: [number, number, number, number, boolean][] = [[-0.4, -0.15, 0.62, 0.55, false], [0.15, -0.25, 0.7, 0.6, false], [0.5, 0.1, 0.5, 0.45, true], [-0.15, 0.25, 0.55, 0.5, false], [0.45, -0.35, 0.45, 0.4, true], [-0.5, 0.3, 0.45, 0.38, false]];
  spots.forEach(([x, z, w, h, white], k) => {
    const g = bagGeo(60 + k, w, h);
    if (white) bag.add("plastic", g, { m: L(f, x * f.w / 1.4, 0, z * f.d / 1.2, r() * 6), color: k % 2 ? "#d9dad6" : "#2c4a7a" });
    else bag.add("bag", g, { m: L(f, x * f.w / 1.4, 0, z * f.d / 1.2, r() * 6) });
  });
  // um saco em cima dos outros
  bag.add("bag", bagGeo(70, 0.5, 0.42), { m: L(f, 0, 0.42, -0.05, 1.2, 1, 1, 1, 0.3) });
  // caixote de madeira quebrado (ripas)
  const at = L(f, -f.w / 2 + 0.3, 0, f.d / 2 - 0.22, 0.4);
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) bag.add("wood", box0(), { m: mul(at, tm(0, 0.02 + k * 0.08, s * 0.17, 0, 0.5, 0.05, 0.012)), color: "#f0e0c8", worldUv: true });
  for (const s of [-1, 1]) bag.add("wood", box0(), { m: mul(at, tm(s * 0.24, 0, 0, 0, 0.02, 0.32, 0.36)), color: "#d8c4a4", worldUv: true });
  bag.add("wood", box0(), { m: mul(at, tm(0.1, 0.3, 0.1, 0.6, 0.45, 0.012, 0.05, 0.4)), color: "#f0e0c8", worldUv: true });
}

/** Fardo de papelão amarrado (fitas plásticas) e caixas desmontadas encostadas na parede. */
function cardboard(bag: Bag, f: Foot) {
  const r = rng(78), kraft = ["#ffffff", "#ebe3d6", "#f5ede0", "#d9cfc0"];
  // fardo: camadas de papelão com bordas desencontradas
  for (let k = 0; k < 18; k++) bag.add("cardboard", box0(), { m: L(f, (r() - 0.5) * 0.06, 0.1 + k * 0.045, -0.05 + (r() - 0.5) * 0.05, (r() - 0.5) * 0.05, 0.95, 0.044, 0.62), color: kraft[k % 4], worldUv: true });
  bag.add("wood", box0(), { m: L(f, 0, 0, -0.05, 0, 1.0, 0.1, 0.7), color: "#c8b8a0", worldUv: true });
  for (const x of [-0.3, 0.3]) bag.add("plastic", box0(), { m: L(f, x, 0.08, -0.05, 0, 0.025, 0.95, 0.66), color: "#2457a8" });
  // caixas desmontadas encostadas atrás (inclinadas contra a parede)
  for (let k = 0; k < 4; k++) bag.add("cardboard", box0(), { m: L(f, -0.35 + k * 0.24, 0, -f.d / 2 + 0.06 + k * 0.012, (r() - 0.5) * 0.2, 0.7 + r() * 0.3, 1.0 + r() * 0.3, 0.012, -0.12 - r() * 0.08), color: kraft[(k + 1) % 4], worldUv: true });
}

/** Pilha de seis paletes e dois encostados na parede (ao lado da pilha). */
function pallets(bag: Bag, f: Foot) {
  const r = rng(79), tones = ["#ffffff", "#d8d2c8", "#f2e6d0", "#bcb4a8", "#7fa6e6", "#fff6e8"];
  for (let k = 0; k < 6; k++) pallet(bag, L(f, -f.w / 2 + 0.62 + (r() - 0.5) * 0.04, k * 0.145, 0.02, (r() - 0.5) * 0.06), tones[k], 80 + k);
  for (let k = 0; k < 2; k++) pallet(bag, L(f, f.w / 2 - 0.32 + k * 0.03, 0.02, -f.d / 2 + 0.12 + k * 0.16, Math.PI / 2, 1, 1, 1, 0, -1.38 + k * 0.05), tones[k + 2], 90 + k);
}

/** Condensadora de ar (1,2 × 0,5 × 0,8 m) sobre base de concreto, gaiola antifurto de barras e os tubos de cobre isolados
 * entrando na parede. A hélice (que gira) é desenhada à parte pelo beco. */
function condenser(bag: Bag, f: Foot) {
  const w = f.w, d = f.d;
  B(bag, "concrete", f, 0, 0, 0, w - 0.1, 0.1, d - 0.08);
  B(bag, "paint", f, 0, 0.1, -0.02, 1.2, 0.04, 0.5, "#3a3a3a");                                // pés
  B(bag, "plastic", f, 0, 0.14, -0.02, 1.2, 0.72, 0.5, "#d8d6cf");                             // gabinete
  B(bag, "plastic", f, 0, 0.86, -0.02, 1.22, 0.03, 0.52, "#c9c7bf");                           // tampa
  bag.add("iron", new THREE.TorusGeometry(0.24, 0.012, 5, 28), { m: L(f, -0.2, 0.5, 0.235) });  // aro da grade da hélice
  for (let k = 1; k < 4; k++) bag.add("iron", new THREE.TorusGeometry(0.06 * k, 0.004, 4, 24), { m: L(f, -0.2, 0.5, 0.24) });
  for (let k = 0; k < 6; k++) bag.add("iron", box0(), { m: L(f, -0.2, 0.5, 0.24, 0, 0.48, 0.006, 0.006, 0, (k / 6) * Math.PI) });
  for (let k = 0; k < 10; k++) B(bag, "paint", f, 0.36, 0.2 + k * 0.06, 0.233, 0.3, 0.012, 0.01, "#8a8984");   // aletas do lado direito
  // tubos de cobre com isolamento preto saindo pelo lado e entrando na parede
  for (const [y, rad] of [[0.32, 0.03], [0.4, 0.02]] as [number, number][]) bag.add("rubber", tube([[0.6, y, -0.1], [0.75, y, -0.15], [0.78, y + 0.4, -d / 2 + 0.05], [0.78, 1.6, -d / 2 + 0.05]], rad, 14, 6), { m: L(f, 0, 0, 0) });
  // gaiola antifurto: barras verticais e quadro
  const gx = 0.68, gz = d / 2 - 0.04, gh = 1.06;
  for (let k = 0; k <= 12; k++) { const x = -gx + k * (2 * gx / 12); bag.add("rusty", box0(), { m: L(f, x, 0.1, gz, 0, 0.016, gh - 0.1, 0.016), color: "#2c2c2c" }); }
  for (let k = 0; k <= 4; k++) { const z = -d / 2 + 0.06 + k * ((d - 0.1) / 4); for (const s of [-1, 1]) bag.add("rusty", box0(), { m: L(f, s * gx, 0.1, z, 0, 0.016, gh - 0.1, 0.016), color: "#2c2c2c" }); }
  for (const y of [0.1, 0.55, gh]) { bag.add("rusty", box0(), { m: L(f, 0, y, gz, 0, 2 * gx, 0.03, 0.03), color: "#2c2c2c" }); for (const s of [-1, 1]) bag.add("rusty", box0(), { m: L(f, s * gx, y, 0, 0, 0.03, 0.03, d - 0.06), color: "#2c2c2c" }); }
  for (let k = 0; k <= 6; k++) bag.add("rusty", box0(), { m: L(f, -gx + k * (2 * gx / 6), gh, 0, 0, 0.016, 0.016, d - 0.06), color: "#2c2c2c" });
  bag.add("paintGloss", box0(), { m: L(f, 0.1, 0.5, gz + 0.03, 0, 0.07, 0.09, 0.03), color: "#b8902a" });     // cadeado
}

/** Colchão velho encostado na parede, cadeira de escritório quebrada deitada e um balde. */
function junk(bag: Bag, f: Foot) {
  bag.add("fabric", box0(), { m: L(f, -0.15, 0.02, -f.d / 2 + 0.22, 0, 1.85, 0.9, 0.16, -0.1), color: "#ffffff", worldUv: true });
  bag.add("fabric", box0(), { m: L(f, -0.15, 0.02, -f.d / 2 + 0.215, 0, 1.87, 0.92, 0.14, -0.1), color: "#b8ab92", worldUv: true });
  // cadeira: base de cinco pés com rodízios, coluna, assento e encosto (tombada)
  const at = L(f, 0.55, 0.06, 0.2, 0.7, 1, 1, 1, 0, 1.25);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; bag.add("paint", box0(), { m: mul(at, tm(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15, -a, 0.3, 0.03, 0.04)), color: "#151515" }); }
  bag.add("galv", cyl0(0.025, 0.025, 0.3, 8), { m: at });
  bag.add("fabric", box0(), { m: mul(at, tm(0, 0.3, 0, 0, 0.46, 0.08, 0.44)), color: "#2a2a30", worldUv: true });
  bag.add("fabric", box0(), { m: mul(at, tm(0, 0.38, -0.2, 0, 0.42, 0.5, 0.06, 0.2)), color: "#2a2a30", worldUv: true });
  bag.add("plastic", cyl0(0.12, 0.15, 0.3, 14, true), { m: L(f, -0.3, 0, 0.3), color: "#3a6ea5" });
}

/** Coleta seletiva do museu: suporte de tubo galvanizado com quatro cestos de 50 L e tampas coloridas. */
function recycling(bag: Bag, f: Foot, signs: Record<string, Rect01>) {
  const cols = ["#1f5bb5", "#c62828", "#2e7d32", "#f2c230"], n = 4, step = (f.w - 0.1) / n;
  for (const x of [-f.w / 2 + 0.05, f.w / 2 - 0.05]) { bag.add("galv", cyl0(0.022, 0.022, 1.05, 8), { m: L(f, x, 0, -0.1) }); bag.add("galv", cyl0(0.022, 0.022, 1.05, 8), { m: L(f, x, 0, 0.12) }); }
  bag.add("galv", rod([-f.w / 2 + 0.05, 1.05, -0.1], [f.w / 2 - 0.05, 1.05, -0.1], 0.02, 8), { m: L(f, 0, 0, 0) });
  bag.add("galv", rod([-f.w / 2 + 0.05, 0.85, 0.12], [f.w / 2 - 0.05, 0.85, 0.12], 0.018, 8), { m: L(f, 0, 0, 0) });
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + 0.05 + step * (k + 0.5), at = L(f, x, 0.12, 0.0);
    bag.add("plastic", taper(0.36, 0.3, 0.42, 0.36, 0.7), { m: at, color: "#e8e6e0" });
    bag.add("plastic", taper(0.44, 0.38, 0.42, 0.36, 0.08), { m: mul(at, tm(0, 0.7, 0)), color: cols[k] });
    bag.add("plastic", box0(), { m: mul(at, tm(0, 0.73, 0.1, 0, 0.18, 0.02, 0.06)), color: "#1a1a1a" });    // boca
    bag.add("plastic", box0(), { m: mul(at, tm(0, 0.35, 0.177, 0, 0.3, 0.16, 0.004)), color: cols[k] });   // faixa da cor
  }
  bag.add("signs", planeUV(f.w - 0.2, 0.22, signs.bins), { m: L(f, 0, 1.2, -0.08) });                          // placa da coleta seletiva
  for (const x of [-f.w / 2 + 0.05, f.w / 2 - 0.05]) bag.add("galv", cyl0(0.018, 0.018, 0.32, 6), { m: L(f, x, 1.04, -0.1) });
}

/* ======================= caçambas ======================= */
/** Contêiner metálico de carga frontal (o da planta: 1,6 × 2,4 × 1,3 m): corpo com frente inclinada, nervuras, bolsos de
 * içamento, tampas de plástico (uma aberta, com sacos aparecendo), dreno, rodízios e a etiqueta da coleta. */
export function dumpster(bag: Bag, p: Prop, signs: Record<string, Rect01>, seed: number) {
  if (p.shape.type !== "box") return;
  const s = p.shape, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, W = s.z1 - s.z0, D = s.x1 - s.x0, r = rng(seed);
  // referencial: x local ao longo do comprimento (z do mundo), frente (+z local) virada para o beco (−x do mundo)
  const f: Foot = { cx, cz, w: W, d: D, yaw: -Math.PI / 2 };
  const green = new THREE.Color("#22503d").multiplyScalar(0.9 + r() * 0.15);
  // corpo: caixa afunilada (frente inclinada) sobre o chassi
  const body = new THREE.BoxGeometry(W - 0.06, 1.1, D - 0.1, 1, 1, 1).translate(0, 0.55, 0), pa = body.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) if (pa.getZ(i) > 0 && pa.getY(i) < 0.3) pa.setZ(i, pa.getZ(i) - 0.28);   // frente inclinada embaixo
  body.computeVertexNormals();
  bag.add("paint", body, { m: L(f, 0, 0.16, -0.02), color: green });
  for (let k = 0; k < 4; k++) B(bag, "paint", f, -W / 2 + 0.25 + k * ((W - 0.5) / 3), 0.16, D / 2 - 0.08, 0.06, 1.1, 0.04, green.clone().multiplyScalar(0.85));   // nervuras
  B(bag, "paint", f, 0, 1.22, 0, W, 0.06, D, green.clone().multiplyScalar(0.8));               // borda
  for (const sx of [-1, 1]) { B(bag, "paint", f, sx * (W / 2 + 0.04), 0.7, 0, 0.1, 0.18, 0.5, "#1a1a1a"); }   // bolsos de içamento
  B(bag, "paint", f, 0, 0.1, 0, W - 0.1, 0.08, D - 0.3, "#1b1b1b");                              // chassi
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { bag.add("rubber", new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12).rotateX(Math.PI / 2), { m: L(f, sx * (W / 2 - 0.25), 0.075, sz * (D / 2 - 0.35)) }); bag.add("galv", box0(), { m: L(f, sx * (W / 2 - 0.25), 0.1, sz * (D / 2 - 0.35), 0, 0.1, 0.06, 0.1) }); }
  bag.add("galv", cyl0(0.03, 0.03, 0.06, 10), { m: L(f, W / 2 - 0.2, 0.22, D / 2 - 0.29, 0, 1, 1, 1, Math.PI / 2) });     // dreno
  // tampas de plástico preto: a de trás fechada, a da frente aberta para trás (sacos à mostra)
  const lid0 = L(f, -W / 4, 1.25, -D / 2 + 0.04), lid1 = L(f, W / 4, 1.25, -D / 2 + 0.04);
  bag.add("plastic", box0(), { m: mul(lid0, tm(0, 0, D / 2 - 0.02, 0, W / 2 - 0.04, 0.05, D - 0.04)), color: "#121212" });
  bag.add("plastic", box0(), { m: mul(lid1, mul(tm(0, 0, 0, 0, 1, 1, 1, -1.9), tm(0, 0, D / 2 - 0.02, 0, W / 2 - 0.04, 0.05, D - 0.04))), color: "#151515" });
  for (let k = 0; k < 3; k++) bag.add("bag", bagGeo(seed * 3 + k, 0.55, 0.45), { m: L(f, W / 4 + (k - 1) * 0.32, 0.95, (r() - 0.5) * 0.3, r() * 6) });
  bag.add("signs", planeUV(0.5, 0.25, signs.dumpLabel), { m: L(f, -W / 4, 0.75, D / 2 - 0.045) });
}
