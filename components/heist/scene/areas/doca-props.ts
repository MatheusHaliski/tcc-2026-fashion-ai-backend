/*
 * MET Gala Heist v2 — Doca (Z12): os móveis próprios da doca (lib/heist/level.ts → seção "doca" de baseProps, `kind:
 * "fixture"` com `model`), cada um desenhado exatamente na caixa de colisão dele, e a caixa de obra (o `crate` que ficou):
 *
 *  - docaShelf: estante de aço (2,0 × 0,6 × 2,4 m) de montantes em cantoneira, bandejas com aba, contraventamento em X e
 *    a carga da produção (caixas, organizadores, fitas, carretéis, latas, toalhas, cubas);
 *  - docaBench: bancada de conferência (2,0 × 0,8 × 0,9 m) com tampo de madeira, prateleira de baixo, prancheta, notebook,
 *    impressora de etiquetas, rádio, estilete, fita, café — e, na parede atrás, o quadro de escalas e o cabideiro;
 *  - docaBooth: guarita de controle de acesso (1,6 × 1,6 × 2,6 m) de chapa e vidro, com balcão do passa-documentos,
 *    mesa, monitor do circuito de câmeras, livro de registro, rádio e a luz de teto;
 *  - docaFlightCases: dois flight cases empilhados (1,2 × 0,6 × 0,8 m cada) — laminado, perfis de alumínio, cantos de
 *    esfera, fechos borboleta, alças embutidas, rodízios, estêncil e fita gaffer;
 *  - docaPalletJack: paleteira manual com um palete carregado e envolto em filme;
 *  - docaStacker: empilhadeira patolada elétrica estacionada na parede, carregando a bateria (torre, garfos, timão);
 *  - docaHotBoxes: dois carros térmicos do bufê sobre carrinhos de rodízio;
 *  - docaFountain: bebedouro de pressão de inox;
 *  - docaPallets: pilha de paletes vazios com os cones em cima;
 *  - e a caixa de obra do museu (a `crate` alta da planta), de compensado com sarrafos e estêncil.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { cctvTexture, foot, type PropsCtx } from "../interior-props";
import type { Palette } from "../interior-mats";
import type { Quality } from "../interior-tex";
import { docaAtlas, laminateSurface, type Rect } from "./doca-tex";

export const ROOM = "doca";
type Foot = ReturnType<typeof foot>;
type Mat = THREE.Material;

/* ---------- materiais da área ---------- */
const mcache = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T { const k = `doca-${key}`; if (!mcache.has(k)) mcache.set(k, make()); return mcache.get(k) as T; }
export interface DocaMats {
  paint: THREE.MeshStandardMaterial; matte: THREE.MeshStandardMaterial; plastic: THREE.MeshStandardMaterial; galv: THREE.MeshStandardMaterial;
  laminate: THREE.MeshStandardMaterial; signs: THREE.MeshStandardMaterial; marks: THREE.MeshStandardMaterial; lit: THREE.MeshStandardMaterial;
  film: THREE.MeshStandardMaterial; inox: THREE.MeshStandardMaterial; rubber: Mat; wood: Mat; alu: Mat; chrome: Mat; glass: Mat; led: Mat; ledRed: Mat; ledGreen: Mat;
}
export function docaMats(q: Quality, P: Palette): DocaMats {
  return once(`mats-${q}`, () => {
    const at = docaAtlas(q), lam = laminateSurface(q);
    const lamN = lam.normalMap.clone(); lamN.repeat.set(4, 4); lamN.needsUpdate = true;
    const lamR = lam.roughnessMap.clone(); lamR.repeat.set(4, 4); lamR.needsUpdate = true;
    const vc = (name: string, o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...o }); m.name = `doca-${name}`; return m; };
    const signs = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.55, metalness: 0.02, alphaTest: 0.08, emissiveMap: at.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12, side: THREE.DoubleSide });
    signs.name = "doca-signs";
    const lit = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.4, emissiveMap: at.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.4 }); lit.name = "doca-lit";
    const marks = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.6, transparent: true, depthWrite: false, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); marks.name = "doca-marks";
    const laminate = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 1, roughnessMap: lamR, normalMap: lamN, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.8 }); laminate.name = "doca-laminate";
    const film = new THREE.MeshStandardMaterial({ color: "#e6eef2", roughness: 0.12, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }); film.name = "doca-film";
    const galv = new THREE.MeshStandardMaterial({ color: "#a3a8ac", roughness: 0.42, metalness: 0.85, envMapIntensity: 1 }); galv.name = "doca-galv";
    const inox = new THREE.MeshStandardMaterial({ color: "#c8ccd0", roughness: 0.22, metalness: 1, envMapIntensity: 1.2 }); inox.name = "doca-inox";
    return {
      paint: vc("paint", { roughness: 0.48, metalness: 0.35, envMapIntensity: 0.8 }), matte: vc("matte", { roughness: 0.82, metalness: 0.05, envMapIntensity: 0.5 }),
      plastic: vc("plastic", { roughness: 0.45, metalness: 0, envMapIntensity: 0.7 }), galv, laminate, signs, marks, lit, film, inox,
      rubber: P.rubber, wood: P.crateWood, alu: P.steel, chrome: P.chrome, glass: P.glass, led: P.fluoro, ledRed: P.ledRed, ledGreen: P.ledGreen,
    };
  });
}

/* ---------- geometrias com cor e com UV da folha ---------- */
const gcache = new Map<string, THREE.BufferGeometry>();
/** Cópia da geometria com a cor por vértice (cacheada por forma e cor). */
export function tint(base: THREE.BufferGeometry, key: string, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color), k = `${key}|${c.getHexString()}`; const hit = gcache.get(k); if (hit) return hit;
  const g = base.clone(), n = g.getAttribute("position").count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); gcache.set(k, g); return g;
}
/** Plano (olha para +z) e caixa com o UV dentro de um retângulo da folha (todas as faces da caixa mostram o desenho). */
export function planeUV(_name: string, r: Rect): THREE.BufferGeometry {
  return geo(`doca-plane-${r.u0.toFixed(5)}-${r.v0.toFixed(5)}-${r.u1.toFixed(5)}-${r.v1.toFixed(5)}`, () => { const g = new THREE.PlaneGeometry(1, 1), a = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i)); return g; });
}
export function boxUV(_name: string, r: Rect): THREE.BufferGeometry {
  return geo(`doca-box-${r.u0.toFixed(5)}-${r.v0.toFixed(5)}-${r.u1.toFixed(5)}-${r.v1.toFixed(5)}`, () => { const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), a = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i)); return g; });
}

/* ---------- ajudantes no referencial do móvel ---------- */
/** Matriz local do móvel (frente para +z local). */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
const worldOf = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
/** Caixa com base em y (cor opcional para os materiais de cor por vértice). */
function bx(c: PropsCtx, m: Mat, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, o: { ry?: number; rx?: number; rz?: number; cast?: boolean } = {}) {
  c.batch.add(ROOM, m, color ? tint(BOX0(), "box0", color) : BOX0(), L(f, x, y, z, o.ry ?? 0, sx, sy, sz, o.rx ?? 0, o.rz ?? 0), { cast: o.cast });
}
function cy(c: PropsCtx, m: Mat, f: Foot, x: number, y: number, z: number, r: number, h: number, color?: THREE.ColorRepresentation, o: { seg?: number; rx?: number; rz?: number; ry?: number } = {}) {
  const seg = o.seg ?? 14; c.batch.add(ROOM, m, color ? tint(CYL0(seg), `cyl0${seg}`, color) : CYL0(seg), L(f, x, y, z, o.ry ?? 0, r, h, r, o.rx ?? 0, o.rz ?? 0));
}
function decal(c: PropsCtx, m: Mat, f: Foot, name: string, r: Rect, x: number, y: number, z: number, w: number, h: number, ry = 0, rx = 0) {
  c.batch.add(ROOM, m, planeUV(name, r), L(f, x, y, z, ry, w, h, 1, rx));
}
/** Rodízio giratório (placa, garfo, roda) com a base em y = 0 e a placa em `h`. */
function caster(c: PropsCtx, M: DocaMats, f: Foot, x: number, z: number, h: number, ry = 0) {
  bx(c, M.galv, f, x, h - 0.008, z, 0.09, 0.008, 0.08);
  bx(c, M.galv, f, x, h * 0.35, z, 0.05, h * 0.62, 0.012, undefined, { ry });
  c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, x, h * 0.4, z + 0.012, ry, 0.032, h * 0.4, h * 0.4));
}

/* ======================= os móveis ======================= */
export function docaFixture(p: Prop, c: PropsCtx) {
  const f = foot(p), M = docaMats(c.q, c.P), A = docaAtlas(c.q).rects;
  switch (p.model) {
    case "docaShelf": return shelf(c, M, A, f, p.id);
    case "docaBench": return bench(c, M, A, f);
    case "docaBooth": return booth(c, M, A, f);
    case "docaFlightCases": return flightStack(c, M, A, f);
    case "docaPalletJack": return palletJack(c, M, A, f);
    case "docaStacker": return stacker(c, M, A, f);
    case "docaHotBoxes": return hotBoxes(c, M, A, f);
    case "docaFountain": return fountain(c, M, f);
    case "docaPallets": return palletStack(c, M, f);
    default: bx(c, c.P.black, f, 0, 0, 0, f.w, p.height === "tall" ? 2 : 0.9, f.d);
  }
}

/** Estante de aço com a carga da produção. */
function shelf(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot, id: string) {
  const W = f.w, D = f.d, H = 2.4, up = "#3c5269", tray = "#8f969c", r = rand(id.length * 31 + id.charCodeAt(id.length - 1));
  // montantes em cantoneira (dois perfis por canto) e sapatas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.025), z = sz * (D / 2 - 0.025);
    bx(c, M.paint, f, x, 0, z - sz * 0.0, 0.045, H, 0.006, up, { cast: true }); bx(c, M.paint, f, x - sx * 0.0, 0, z, 0.006, H, 0.045, up);
    bx(c, M.rubber, f, x, 0, z, 0.06, 0.012, 0.06);
  }
  // bandejas com aba dobrada na frente e atrás
  const levels = [0.1, 0.58, 1.06, 1.54, 2.02, 2.36];
  for (const y of levels) { bx(c, M.paint, f, 0, y, 0, W - 0.02, 0.02, D - 0.02, tray); for (const s of [-1, 1]) bx(c, M.paint, f, 0, y - 0.03, s * (D / 2 - 0.012), W - 0.02, 0.05, 0.012, tray); }
  // contraventamento em X atrás e a placa de carga máxima
  for (const s of [-1, 1]) bx(c, M.paint, f, 0, 1.2, -D / 2 + 0.008, Math.hypot(W, 2.2), 0.03, 0.004, up, { rz: s * Math.atan2(2.2, W) });
  decal(c, M.signs, f, "maxLoad", A.maxLoad, -W / 2 + 0.35, 2.47, D / 2 + 0.004, 0.42, 0.14);
  // carga: caixas de papelão, caixas do bufê, organizadores de plástico, fitas, carretéis, latas, toalhas dobradas, cubas
  for (let k = 0; k < levels.length - 1; k++) {
    const y = levels[k] + 0.02, room = levels[k + 1] - levels[k] - 0.06;
    let x = -W / 2 + 0.06;
    while (x < W / 2 - 0.12) {
      const kind = r(), w = 0.22 + r() * 0.3;
      if (x + w > W / 2 - 0.05) break;
      const cx = x + w / 2, dz = (r() - 0.5) * 0.06;
      if (kind < 0.3) { const h = Math.min(room, 0.18 + r() * 0.24); c.batch.add(ROOM, M.signs, boxUV("kraftBox", A.kraftBox), L(f, cx, y, dz, (r() - 0.5) * 0.08, w - 0.02, h, D - 0.12)); }
      else if (kind < 0.48) { const h = Math.min(room, 0.22 + r() * 0.12); c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, cx, y, dz, (r() - 0.5) * 0.06, w - 0.02, h, D - 0.14)); }
      else if (kind < 0.62) { const col = ["#2f6fb2", "#e2b322", "#3a3d41", "#c7372f"][Math.floor(r() * 4)], h = Math.min(room, 0.24); bx(c, M.plastic, f, cx, y, dz, w - 0.03, h, D - 0.1, col); bx(c, M.plastic, f, cx, y + h, dz, w - 0.01, 0.025, D - 0.08, new THREE.Color(col).multiplyScalar(0.8)); }
      else if (kind < 0.74) { for (let j = 0; j < 3; j++) cy(c, M.plastic, f, cx - w / 2 + 0.06 + j * 0.08, y, dz + (j % 2) * 0.12, 0.05, 0.05, j % 2 ? "#1a1a1a" : "#bfc3c6", { seg: 14 }); }
      else if (kind < 0.84) { cy(c, M.wood, f, cx, y, dz, 0.15, 0.025, undefined, { seg: 18 }); cy(c, M.wood, f, cx, y + 0.21, dz, 0.15, 0.025, undefined, { seg: 18 }); cy(c, M.plastic, f, cx, y + 0.025, dz, 0.11, 0.185, "#1c1c1c", { seg: 16 }); }
      else if (kind < 0.92) { for (let j = 0; j < 2; j++) cy(c, M.paint, f, cx - 0.06 + j * 0.13, y, dz, 0.085, 0.19, j ? "#c9cdd2" : "#e6e2d8", { seg: 16 }); }
      else { const n = 2 + Math.floor(r() * 3); for (let j = 0; j < n; j++) bx(c, M.matte, f, cx, y + j * 0.05, dz, w - 0.04, 0.045, D - 0.16, j % 2 ? "#efeae0" : "#e6e0d2"); }
      x += w + 0.02 + r() * 0.05;
    }
  }
}

/** Bancada de conferência, o quadro de escalas e o cabideiro na parede de trás. */
function bench(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = f.w, D = f.d, H = 0.9, frame = "#2f3337";
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.paint, f, sx * (W / 2 - 0.04), 0, sz * (D / 2 - 0.04), 0.05, H - 0.05, 0.05, frame, { cast: true });
  for (const sz of [-1, 1]) bx(c, M.paint, f, 0, 0.16, sz * (D / 2 - 0.04), W - 0.08, 0.04, 0.04, frame);
  bx(c, M.wood, f, 0, 0.2, 0, W - 0.1, 0.02, D - 0.1);                                                // prateleira de baixo
  bx(c, M.wood, f, 0, H - 0.05, 0, W, 0.045, D, undefined, { cast: true });                          // tampo
  bx(c, M.galv, f, 0, H - 0.055, D / 2, W, 0.05, 0.004);                                             // cantoneira da frente
  // embaixo: caixas e a lixeira de pedal
  c.batch.add(ROOM, M.signs, boxUV("kraftBox", A.kraftBox), L(f, -0.55, 0.22, 0, 0.05, 0.5, 0.32, 0.5));
  c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, 0.05, 0.22, -0.02, -0.04, 0.42, 0.28, 0.45));
  cy(c, M.paint, f, 0.72, 0.22, 0.05, 0.14, 0.42, "#9aa0a5", { seg: 18 });
  // em cima: prancheta com a conferência, notebook aberto, impressora de etiquetas, rádio, estilete, fita, café, notas
  const y = H;
  bx(c, M.paint, f, -0.55, y, 0.12, 0.25, 0.012, 0.36, "#6b4a2a", { ry: 0.12 });
  decal(c, M.signs, f, "clipboard", A.clipboard, -0.55, y + 0.014, 0.12, 0.24, 0.35, 0.12, -Math.PI / 2);
  bx(c, M.paint, f, 0.15, y, -0.05, 0.34, 0.018, 0.24, "#2a2d31");                                  // notebook
  bx(c, M.paint, f, 0.15, y + 0.018, -0.17, 0.34, 0.22, 0.012, "#2a2d31", { rx: -0.25 });
  c.batch.add(ROOM, glowScreen(), geo("plane", () => new THREE.PlaneGeometry(1, 1)), L(f, 0.15, y + 0.13, -0.155, 0, 0.3, 0.19, 1, -0.25));
  bx(c, M.plastic, f, 0.62, y, -0.1, 0.14, 0.12, 0.2, "#e8e6e0"); bx(c, M.plastic, f, 0.62, y + 0.12, -0.05, 0.12, 0.012, 0.06, "#1a1a1a");  // impressora de etiquetas
  bx(c, M.plastic, f, -0.15, y, 0.18, 0.06, 0.16, 0.035, "#141414", { ry: 0.3 }); cy(c, M.plastic, f, -0.13, y + 0.16, 0.18, 0.006, 0.14, "#141414");  // rádio
  bx(c, M.plastic, f, 0.4, y, 0.25, 0.14, 0.012, 0.025, "#f2c230", { ry: 0.6 });                   // estilete
  c.batch.add(ROOM, M.plastic, tint(geo("doca-tape", () => new THREE.TorusGeometry(0.045, 0.02, 8, 18).rotateX(Math.PI / 2)), "doca-tape", "#c9b48a"), L(f, 0.85, y + 0.02, 0.2));
  cy(c, M.plastic, f, 0.9, y, -0.15, 0.04, 0.1, "#f1eee6");                                         // copo de café
  for (let k = 0; k < 4; k++) bx(c, M.matte, f, -0.85 + k * 0.004, y + k * 0.004, -0.12, 0.21, 0.004, 0.3, k % 2 ? "#f4f1e8" : "#fff59d", { ry: 0.05 * k });
  // na parede de trás (a 1,2 m do chão): quadro de escalas com moldura de alumínio e bandeja; cabideiro com coletes
  const wz = -D / 2 - 0.035;
  bx(c, M.alu, f, 0, 1.12, wz, 1.56, 1.0, 0.02);
  decal(c, M.signs, f, "schedule", A.schedule, 0, 1.62, wz + 0.012, 1.5, 0.94);
  bx(c, M.alu, f, 0, 1.08, wz + 0.04, 1.4, 0.03, 0.06);
  for (let k = 0; k < 3; k++) cy(c, M.plastic, f, -0.2 + k * 0.08, 1.115, wz + 0.05, 0.008, 0.12, ["#1e3a8a", "#b3121e", "#111"][k], { rz: Math.PI / 2 });
  // cabideiro: tábua com ganchos e as peças penduradas (colete refletivo, jaqueta da segurança, avental do bufê)
  const hx = W / 2 + 0.75;
  bx(c, M.wood, f, hx, 1.62, wz + 0.01, 1.1, 0.12, 0.025);
  const items = ["vest", "jacket", "vest", "apron"];
  items.forEach((it, k) => {
    const x = hx - 0.42 + k * 0.28; cy(c, M.chrome, f, x, 1.68, wz + 0.05, 0.008, 0.08, undefined, { rx: Math.PI / 2 });
    for (const s of [-1, 1]) decal(c, M.signs, f, it, A[it], x + s * 0.004, 1.32, wz + 0.07 + s * 0.012, 0.3, 0.45, s * 0.25);
  });
  // capacetes no gancho da ponta
  c.batch.add(ROOM, M.plastic, tint(geo("doca-helmet", () => new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.15)), "doca-helmet", "#f2f2ee"), L(f, hx + 0.48, 1.6, wz + 0.15));
}
function glowScreen(): THREE.MeshBasicMaterial { return once("screen", () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#9fc6ff").multiplyScalar(1.3) })); }

/** Guarita de controle de acesso: chapa em baixo, vidro em cima, porta lateral, balcão do passa-documentos e o interior. */
function booth(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = f.w, D = f.d, H = 2.6, sill = 1.0, top = 2.3, white = "#e9e8e2", frame = "#4a5058";
  // a frente (+z local) dá para a doca; o fundo (−z) encosta na parede. Base e telhado
  bx(c, M.matte, f, 0, 0, 0, W, 0.1, D, "#6a6f74");
  bx(c, M.paint, f, 0, top, 0, W + 0.16, 0.08, D + 0.12, frame, { cast: true });
  bx(c, M.paint, f, 0, top + 0.08, 0, W + 0.06, 0.18, D + 0.02, white);
  decal(c, M.signs, f, "booth", A.booth, 0, top + 0.17, D / 2 + 0.015, W - 0.1, 0.16);
  // montantes nos cantos
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.paint, f, sx * (W / 2 - 0.03), 0.1, sz * (D / 2 - 0.03), 0.06, top - 0.1, 0.06, frame, { cast: true });
  // painéis de baixo (frente e lateral direita) e de cima com vidro; a lateral esquerda tem a porta
  const glassPanel = (x: number, z: number, ry: number, w: number) => {
    bx(c, M.paint, f, x, 0.1, z, w, sill - 0.1, 0.04, white, { ry, cast: true });
    bx(c, M.paint, f, x, sill, z, w, 0.04, 0.06, frame, { ry });
    c.batch.add(ROOM, M.glass, BOX0(), L(f, x, sill + 0.04, z, ry, w - 0.02, top - sill - 0.06, 0.008));
  };
  glassPanel(0, D / 2 - 0.03, 0, W - 0.1);
  glassPanel(W / 2 - 0.03, 0, Math.PI / 2, D - 0.1);
  // passa-documentos: caixilho de correr aberto na frente e o balcãozinho
  bx(c, M.paint, f, 0.22, sill + 0.04, D / 2 - 0.01, 0.5, 0.36, 0.03, frame);
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -0.1, sill + 0.06, D / 2 + 0.005, 0, 0.46, 0.34, 0.008));
  bx(c, M.wood, f, 0.1, sill - 0.02, D / 2 - 0.12, 0.8, 0.03, 0.2);
  // lateral esquerda (−x local): porta com vidro em cima, maçaneta
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, D / 2 - 0.35, 0.04, top - 0.1, 0.6, white, { cast: true });
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -D / 2 + 0.12, 0.04, top - 0.1, 0.2, white);
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -0.2, 0.04, 0.95, 0.75, "#d9d8d2");
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -W / 2 + 0.03, 1.1, -0.2, 0, 0.008, 1.1, 0.7));
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -0.2, 0.05, 2.15, 0.04, frame); bx(c, M.paint, f, -W / 2 + 0.03, 2.2, -0.2, 0.05, 0.05, 0.75, frame);
  cy(c, M.chrome, f, -W / 2 - 0.01, 1.0, 0.08, 0.01, 0.12, undefined, { rx: Math.PI / 2 });
  // fundo (contra a parede da doca): chapa
  bx(c, M.paint, f, 0, 0.1, -D / 2 + 0.02, W - 0.06, top - 0.1, 0.03, white);
  // dentro: mesa em L, cadeira, monitor do circuito, livro de registro, rádio no carregador, ventilador, calendário
  bx(c, M.wood, f, 0.05, 0.72, D / 2 - 0.42, W - 0.24, 0.035, 0.5); bx(c, M.wood, f, W / 2 - 0.32, 0.72, -0.05, 0.45, 0.035, D - 0.5);
  for (const [x, z] of [[-W / 2 + 0.2, D / 2 - 0.2], [W / 2 - 0.15, -D / 2 + 0.25]]) bx(c, M.paint, f, x, 0.1, z, 0.04, 0.62, 0.04, frame);
  bx(c, M.paint, f, 0.3, 0.755, D / 2 - 0.55, 0.42, 0.28, 0.04, "#151515", { ry: Math.PI });
  const scr = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(20), color: new THREE.Color(1.25, 1.25, 1.25) }));
  scr.matrixAutoUpdate = false; scr.matrix.copy(L(f, 0.3, 0.9, D / 2 - 0.575, Math.PI, 0.38, 0.24, 1)); scr.userData.room = ROOM; c.group.add(scr); c.animated.push({ kind: "cctv", mesh: scr, room: ROOM });
  bx(c, M.paint, f, -0.25, 0.755, D / 2 - 0.4, 0.32, 0.03, 0.24, "#1d2a4a", { ry: 0.1 });          // livro de registro
  bx(c, M.plastic, f, 0.55, 0.755, -0.3, 0.1, 0.06, 0.12, "#1a1a1a"); bx(c, M.plastic, f, 0.55, 0.815, -0.3, 0.05, 0.16, 0.03, "#111");
  cy(c, M.paint, f, -0.2, 0.1, -0.1, 0.22, 0.04, "#202020", { seg: 18 }); cy(c, M.paint, f, -0.2, 0.14, -0.1, 0.025, 0.36, "#202020");
  bx(c, M.matte, f, -0.2, 0.5, -0.1, 0.42, 0.06, 0.42, "#26303c"); bx(c, M.matte, f, -0.2, 0.56, -0.3, 0.4, 0.42, 0.06, "#26303c", { rx: -0.12 });
  cy(c, M.plastic, f, -W / 2 + 0.25, 0.755, -D / 2 + 0.25, 0.06, 0.03, "#e8e8e4"); c.batch.add(ROOM, M.plastic, tint(geo("doca-fan", () => new THREE.TorusGeometry(0.11, 0.008, 4, 18)), "doca-fan", "#e8e8e4"), L(f, -W / 2 + 0.25, 0.92, -D / 2 + 0.27));
  // luz de teto da guarita (calha com tubo) e o ponto de luz
  bx(c, M.paint, f, 0, top - 0.05, 0, 0.7, 0.04, 0.1, "#e9e8e2"); c.batch.add(ROOM, M.led, BOX0(), L(f, 0, top - 0.065, 0, 0, 0.62, 0.02, 0.05));
  const lp = worldOf(f, 0, top - 0.25, 0); c.anchors.push({ x: lp.x, y: lp.y, z: lp.z, color: "#eef6ff", intensity: 2.6, distance: 3.2, room: ROOM, flicker: 0 });
}

/** Dois flight cases empilhados (cada um 1,2 × 0,6 × 0,8 m + rodízios de 0,15 m). */
function flightStack(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = Math.min(1.2, f.w), D = Math.min(0.6, f.d);
  const one = (y: number, ry: number, label: string, gaffer: string, lift: number) => {
    const cw = 0.15, H = 0.8;
    // rodízios e a tábua dos rodízios
    bx(c, M.wood, f, 0, y + cw - 0.02, 0, W - 0.04, 0.02, D - 0.04, undefined, { ry });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(c, M, f, sx * (W / 2 - 0.1), sz * (D / 2 - 0.09), y + cw - 0.02, ry);
    const y0 = y + cw;
    bx(c, M.laminate, f, 0, y0, 0, W - 0.01, H, D - 0.01, undefined, { ry, cast: true });
    // perfis de alumínio nas 12 arestas e o friso da tampa
    const e = 0.022;
    for (const yy of [y0, y0 + H - e]) { for (const sz of [-1, 1]) bx(c, M.alu, f, 0, yy, sz * (D / 2 - e / 2), W + 0.004, e, e, undefined, { ry }); for (const sx of [-1, 1]) bx(c, M.alu, f, sx * (W / 2 - e / 2), yy, 0, e, e, D + 0.004, undefined, { ry }); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.alu, f, sx * (W / 2 - e / 2), y0, sz * (D / 2 - e / 2), e, H, e, undefined, { ry });
    bx(c, M.alu, f, 0, y0 + H * 0.74, 0, W + 0.008, 0.03, D + 0.008, undefined, { ry });
    // cantos de esfera (cromados), fechos borboleta na frente e atrás, alças embutidas nas laterais
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [y0 + 0.02, y0 + H - 0.02]) c.inst.add(ROOM, "doca-ball", SPH(10), M.chrome as THREE.Material, L(f, sx * (W / 2 - 0.004), yy, sz * (D / 2 - 0.004), ry, 0.032));
    for (const sz of [-1, 1]) for (const sx of [-0.32, 0.32]) { bx(c, M.chrome, f, sx, y0 + H * 0.74 - 0.05, sz * (D / 2 + 0.006), 0.08, 0.1, 0.012, undefined, { ry }); bx(c, M.chrome, f, sx, y0 + H * 0.74 - 0.01, sz * (D / 2 + 0.014), 0.05, 0.02, 0.012, undefined, { ry }); }
    for (const sx of [-1, 1]) { bx(c, M.chrome, f, sx * (W / 2 + 0.006), y0 + H * 0.45, 0, 0.012, 0.12, 0.2, undefined, { ry }); bx(c, M.paint, f, sx * (W / 2 + 0.016), y0 + H * 0.47, 0, 0.02, 0.03, 0.13, "#151515", { ry }); }
    // estêncil na frente e a fita gaffer com a etiqueta na tampa
    decal(c, M.signs, f, label, A[label], 0, y0 + H * 0.38, D / 2 + 0.003 + lift, W * 0.78, W * 0.78 / 4, ry);
    decal(c, M.signs, f, gaffer, A[gaffer], 0.25, y0 + H * 0.9, D / 2 + 0.004 + lift, 0.36, 0.09, ry);
  };
  one(0, 0, "caseLight", "gaffer0", 0);
  one(0.95, 0.04, "caseCostume", "gaffer1", 0);
}

/** Paleteira manual com palete carregado (fardos e caixas do bufê envoltos em filme), garfos ao longo de x local. */
function palletJack(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const x0 = -f.w / 2, pw = 1.2, pd = Math.min(1.0, f.d), red = "#c62f23";
  pallet(c, M, f, x0 + pw / 2, 0, pw, pd, "#e8d6b8");
  // carga: duas camadas de fardos (garrafas de água) e caixas do bufê por cima, envolto em filme
  for (let ly = 0; ly < 2; ly++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = x0 + 0.22 + i * 0.38, z = -pd / 2 + 0.26 + j * 0.48, y = 0.144 + ly * 0.3;
    bx(c, M.plastic, f, x, y, z, 0.36, 0.28, 0.46, ly ? "#d8e6ee" : "#cfe0ea");
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) c.inst.add(ROOM, "doca-bottleCap", CYL0(8), M.plastic as THREE.Material, L(f, x - 0.12 + a * 0.12, y + 0.28, z - 0.17 + b * 0.115, 0, 0.018, 0.02, 0.018));
  }
  for (let i = 0; i < 2; i++) c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, x0 + 0.35 + i * 0.55, 0.744, 0, (i - 0.5) * 0.06, 0.5, 0.26, 0.6));
  c.batch.add(ROOM, M.film, BOX0(), L(f, x0 + pw / 2, 0.15, 0, 0, pw - 0.02, 0.62, pd - 0.02));
  decal(c, M.signs, f, "gaffer3", A.gaffer3, x0 + 0.4, 0.62, pd / 2 - 0.005, 0.36, 0.09);
  // paleteira: garfos dentro do palete, rodinhas na ponta, corpo com a bomba hidráulica, rodas de direção e o timão
  for (const z of [-0.27, 0.27]) { bx(c, M.paint, f, x0 + 0.62, 0.012, z, 1.15, 0.07, 0.16, red); c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, x0 + 0.1, 0.035, z, Math.PI / 2, 0.035, 0.07, 0.035)); }
  const bxj = x0 + pw + 0.12;
  bx(c, M.paint, f, bxj, 0.03, 0, 0.22, 0.22, 0.56, red, { cast: true });
  cy(c, M.chrome, f, bxj, 0.25, 0, 0.045, 0.32);
  bx(c, M.paint, f, bxj, 0.56, 0, 0.12, 0.08, 0.14, red);
  for (const z of [-0.09, 0.09]) c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, bxj + 0.05, 0.09, z, Math.PI / 2, 0.09, 0.05, 0.09));
  // timão inclinado (para trás) com a alavanca
  const tilt = -0.42, hx = bxj + 0.02;
  for (const z of [-0.12, 0.12]) bx(c, M.paint, f, hx, 0.62, z, 0.03, 0.95, 0.03, "#1e1e1e", { rz: tilt });
  bx(c, M.paint, f, hx + Math.sin(-tilt) * 0.95, 0.62 + Math.cos(tilt) * 0.95, 0, 0.035, 0.035, 0.3, "#1e1e1e");
  bx(c, M.chrome, f, hx + Math.sin(-tilt) * 0.85, 0.62 + Math.cos(tilt) * 0.85, 0, 0.012, 0.012, 0.16, undefined, { rz: tilt - 0.5 });
}
/** Palete PBR (1,2 × 1,0 × 0,144 m) no chão, centro (cx, cz) local. */
function pallet(c: PropsCtx, M: DocaMats, f: Foot, cx: number, cz: number, w: number, d: number, tone: string, y = 0) {
  const r = rand(Math.round(cx * 100) + Math.round(y * 1000) + 7), t = (k: number) => new THREE.Color(tone).multiplyScalar(0.85 + 0.25 * ((k * 0.618) % 1) + (r() - 0.5) * 0.06);
  for (const dz of [-d / 2 + 0.05, 0, d / 2 - 0.05]) bx(c, M.matte, f, cx, y, cz + dz, w, 0.022, 0.1, t(1));
  for (const dz of [-d / 2 + 0.05, 0, d / 2 - 0.05]) for (const dx of [-w / 2 + 0.05, 0, w / 2 - 0.05]) bx(c, M.matte, f, cx + dx, y + 0.022, cz + dz, 0.1, 0.078, 0.1, t(2));
  for (const dx of [-w / 2 + 0.05, 0, w / 2 - 0.05]) bx(c, M.matte, f, cx + dx, y + 0.1, cz, 0.1, 0.022, d, t(3));
  for (let k = 0; k < 7; k++) bx(c, M.matte, f, cx, y + 0.122, cz - d / 2 + 0.05 + k * ((d - 0.1) / 6), w, 0.022, k === 0 || k === 6 ? 0.1 : 0.085, t(k + 4));
}

/** Barra (cilindro) de a até b, no referencial do móvel. */
function seg(c: PropsCtx, m: Mat, f: Foot, a: [number, number, number], b: [number, number, number], r: number, color?: THREE.ColorRepresentation) {
  const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B3.clone().sub(A3).normalize());
  c.batch.add(ROOM, m, color ? tint(CYL0(6), "cyl06", color) : CYL0(6), mul(mat(f.cx, 0, f.cz, f.yaw), new THREE.Matrix4().compose(A3, q, new THREE.Vector3(r, A3.distanceTo(B3), r))));
}

/** Empilhadeira patolada elétrica estacionada junto à parede sul, carregando (1,7 × 0,74 m, torre de 2,0 m): chassi da
 * bateria com o timão em pé, torre de dois estágios com cilindro, correntes e tela de proteção, garfos baixados sobre
 * as patolas, roletes e rodízios, a plaqueta de capacidade e o cabo do carregador na tomada industrial da parede.
 * Comprimento ao longo de x local (garfos para +x); a parede fica em +z local, o lado −z dá para a doca. */
function stacker(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const zc = -0.05, yel = "#dfa91b", dark = "#2a2d31", black = "#1c1e21", wall = f.d / 2, room = zc - 0.32;
  // chassi (bateria e tração): corpo amarelo, tampa preta, rodapé, para-choque de borracha, frisos e venezianas
  bx(c, M.paint, f, -0.51, 0.07, zc, 0.62, 0.79, 0.64, yel, { cast: true });
  bx(c, M.paint, f, -0.51, 0.86, zc, 0.65, 0.06, 0.67, black);
  bx(c, M.paint, f, -0.51, 0.03, zc, 0.6, 0.05, 0.6, black);
  bx(c, M.rubber, f, -0.835, 0.1, zc, 0.03, 0.15, 0.6);
  bx(c, M.paint, f, -0.51, 0.47, room - 0.001, 0.6, 0.006, 0.004, "#7a5d10"); bx(c, M.paint, f, -0.29, 0.1, room - 0.001, 0.006, 0.74, 0.004, "#7a5d10");
  for (let k = 0; k < 5; k++) bx(c, M.paint, f, -0.74 + k * 0.035, 0.16, room - 0.002, 0.014, 0.2, 0.004, "#3a2e0b");
  decal(c, M.signs, f, "stacker", A.stacker, -0.52, 0.66, room - 0.004, 0.36, 0.18, Math.PI);
  decal(c, M.signs, f, "stackerHz", A.hazard, -0.824, 0.5, zc, 0.5, 0.1, -Math.PI / 2);
  // painel na tampa: indicador de bateria aceso, chave e o botão de emergência
  bx(c, M.plastic, f, -0.66, 0.92, zc - 0.13, 0.11, 0.014, 0.07, "#101418"); c.batch.add(ROOM, M.ledGreen, BOX0(), L(f, -0.67, 0.934, zc - 0.13, 0, 0.06, 0.004, 0.03));
  cy(c, M.chrome, f, -0.58, 0.92, zc - 0.13, 0.012, 0.025);
  cy(c, M.plastic, f, -0.72, 0.92, zc + 0.14, 0.03, 0.03, "#e2b322"); cy(c, M.plastic, f, -0.72, 0.95, zc + 0.14, 0.036, 0.028, "#c62828");
  // timão: articulação, braço quase de pé (posição de descanso) e a cabeça com as manoplas, aceleradores e o botão de reversão
  const tilt = 0.12, arm = 0.9, tx = -0.71 - Math.sin(tilt) * arm, ty = 0.96 + Math.cos(tilt) * arm;
  bx(c, M.paint, f, -0.71, 0.9, zc, 0.13, 0.08, 0.15, black);
  bx(c, M.paint, f, -0.71, 0.96, zc, 0.05, arm, 0.05, black, { rz: tilt });
  bx(c, M.plastic, f, tx, ty - 0.04, zc, 0.13, 0.09, 0.34, black, { rz: tilt });
  for (const s of [-1, 1]) { cy(c, M.rubber, f, tx, ty + 0.005, zc + s * 0.17, 0.024, 0.1, undefined, { rx: s * Math.PI / 2 }); bx(c, M.plastic, f, tx - 0.03, ty + 0.03, zc + s * 0.13, 0.03, 0.05, 0.05, "#e2b322"); }
  cy(c, M.plastic, f, tx - 0.06, ty, zc, 0.028, 0.03, "#c62828", { rz: Math.PI / 2 });
  // torre: montantes externos (perfil C) e internos, travessas, cilindro hidráulico, cabeçote, polias e correntes
  for (const s of [-1, 1]) { bx(c, M.paint, f, -0.15, 0.07, zc + s * 0.29, 0.08, 1.93, 0.05, dark, { cast: true }); bx(c, M.paint, f, -0.13, 0.1, zc + s * 0.235, 0.06, 1.86, 0.04, "#3a3e43"); }
  bx(c, M.paint, f, -0.15, 1.94, zc, 0.09, 0.07, 0.64, yel); bx(c, M.paint, f, -0.17, 0.95, zc, 0.05, 0.06, 0.6, dark);
  cy(c, M.paint, f, -0.15, 0.12, zc, 0.045, 0.95, dark); cy(c, M.chrome, f, -0.15, 1.07, zc, 0.028, 0.5);
  bx(c, M.paint, f, -0.15, 1.57, zc, 0.07, 0.05, 0.3, dark);
  for (const s of [-1, 1]) { cy(c, M.galv, f, -0.15, 1.6, zc + s * 0.1 - 0.015, 0.045, 0.03, undefined, { rx: Math.PI / 2 }); bx(c, M.galv, f, -0.105, 0.36, zc + s * 0.1, 0.018, 1.24, 0.012); }
  // tela de proteção do operador (policarbonato com a grade)
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -0.205, 0.97, zc, 0, 0.008, 0.95, 0.5));
  for (let k = 0; k < 4; k++) bx(c, M.paint, f, -0.2, 0.97, zc - 0.2 + k * 0.133, 0.006, 0.95, 0.006, dark);
  for (let j = 0; j < 5; j++) bx(c, M.paint, f, -0.2, 1.0 + j * 0.22, zc, 0.006, 0.006, 0.5, dark);
  // porta-garfos com o encosto de carga (grade) e os garfos baixados sobre as patolas
  bx(c, M.paint, f, -0.085, 0.08, zc, 0.04, 0.42, 0.62, dark);
  for (const s of [-1, 1]) bx(c, M.paint, f, -0.08, 0.5, zc + s * 0.29, 0.03, 0.7, 0.03, dark);
  for (const y of [0.74, 0.97, 1.17]) bx(c, M.paint, f, -0.08, y, zc, 0.03, 0.025, 0.61, dark);
  for (let k = 0; k < 4; k++) bx(c, M.paint, f, -0.08, 0.5, zc - 0.18 + k * 0.12, 0.02, 0.68, 0.02, dark);
  for (const s of [-1, 1]) {
    const z = zc + s * 0.17;
    bx(c, M.paint, f, -0.055, 0.1, z, 0.04, 0.38, 0.1, "#26282b");
    bx(c, M.paint, f, 0.37, 0.1, z, 0.86, 0.045, 0.1, "#26282b", { cast: true }); bx(c, M.paint, f, 0.82, 0.1, z, 0.04, 0.025, 0.1, "#26282b");
    bx(c, M.paint, f, 0.3, 0.015, z, 1.0, 0.08, 0.13, yel);                                                    // patola
    c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, 0.74, 0.04, z, Math.PI / 2, 0.1, 0.04, 0.04));
  }
  // roda de tração e rodízios estabilizadores sob o chassi
  c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, -0.5, 0.115, zc, Math.PI / 2, 0.08, 0.115, 0.115));
  for (const s of [-1, 1]) c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, -0.75, 0.05, zc + s * 0.25, Math.PI / 2, 0.04, 0.05, 0.05));
  // carregador: tomada industrial azul na parede (com eletroduto e tampa), plugue e o cabo saindo do conector do chassi
  bx(c, M.plastic, f, -0.45, 0.56, wall - 0.03, 0.12, 0.16, 0.06, "#1e5aa8"); bx(c, M.plastic, f, -0.45, 0.63, wall - 0.066, 0.1, 0.07, 0.012, "#174a8c");
  bx(c, M.plastic, f, -0.45, 0.46, wall - 0.035, 0.07, 0.1, 0.05, "#1e5aa8");
  bx(c, M.galv, f, -0.45, 0.72, wall - 0.015, 0.025, 1.3, 0.025);
  bx(c, M.plastic, f, -0.42, 0.48, zc + 0.335, 0.08, 0.07, 0.03, "#c62828");
  // (o cabo passa na frente do bate-carrinho de borracha da parede)
  const cable: [number, number, number][] = [[-0.42, 0.5, zc + 0.35], [-0.43, 0.22, zc + 0.36], [-0.45, 0.12, wall - 0.07], [-0.46, 0.36, wall - 0.075], [-0.45, 0.47, wall - 0.05]];
  for (let k = 0; k < cable.length - 1; k++) seg(c, M.plastic, f, cable[k], cable[k + 1], 0.011, "#151515");
}

/** Dois carros térmicos do bufê (0,48 × 0,66 × 1,45 m) sobre carrinhos de rodízio, de frente para a doca. */
function hotBoxes(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const n = 2, step = f.w / n;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + step * (k + 0.5), ry = (k - 0.5) * 0.05, w = step - 0.04, d = Math.min(0.66, f.d - 0.04);
    bx(c, M.plastic, f, x, 0.05, 0, w, 0.07, d, "#1a1a1a", { ry });                                   // carrinho
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(c, M, f, x + sx * (w / 2 - 0.07), sz * (d / 2 - 0.07), 0.07, ry);
    bx(c, M.plastic, f, x, 0.12, 0, w - 0.02, 1.3, d - 0.02, "#3a3f45", { ry, cast: true });           // corpo isolado
    bx(c, M.plastic, f, x, 1.42, 0, w, 0.04, d, "#30353a", { ry });
    for (const sz of [-1, 1]) bx(c, M.plastic, f, x, 1.38, sz * (d / 2 - 0.02), w - 0.1, 0.03, 0.03, "#2a2e33", { ry });   // pegas
    // porta da frente com dois fechos e a etiqueta do bufê
    bx(c, M.plastic, f, x, 0.2, d / 2 - 0.005, w - 0.08, 1.12, 0.02, "#454b52", { ry });
    for (const y of [0.45, 1.05]) bx(c, M.chrome, f, x + w / 2 - 0.08, y, d / 2 + 0.01, 0.03, 0.08, 0.02, undefined, { ry });
    c.batch.add(ROOM, M.signs, planeUV("cateringBox", A.cateringBox), L(f, x, 0.95, d / 2 + 0.017, ry, 0.22, 0.22, 1));
    bx(c, M.paint, f, x - 0.1, 1.2, d / 2 + 0.008, 0.12, 0.05, 0.01, "#7a7f85", { ry });                // visor do termômetro
  }
  // pilha de bandejas brancas do bufê em cima do primeiro
  for (let k = 0; k < 4; k++) bx(c, M.plastic, f, -f.w / 4, 1.46 + k * 0.07, 0, 0.42, 0.06, 0.56, k % 2 ? "#eeeeea" : "#e4e4de", { ry: (k - 1.5) * 0.03 });
}

/** Bebedouro de pressão de coluna (inox): gabinete, tampo com cuba, torneiras, botões e a grade de ventilação. */
function fountain(c: PropsCtx, M: DocaMats, f: Foot) {
  const W = Math.min(0.34, f.w), D = Math.min(0.34, f.d);
  bx(c, M.inox, f, 0, 0.02, 0, W, 0.86, D, undefined, { cast: true });
  bx(c, M.rubber, f, 0, 0, 0, W - 0.02, 0.02, D - 0.02);
  bx(c, M.inox, f, 0, 0.88, 0, W + 0.04, 0.03, D + 0.04);
  c.batch.add(ROOM, M.inox, geo("doca-basin", () => new THREE.CylinderGeometry(0.13, 0.09, 0.05, 20, 1, true)), L(f, 0, 0.88, 0.02));
  cy(c, M.rubber, f, 0, 0.88, 0.02, 0.025, 0.004);
  for (const [x, h] of [[-0.06, 0.08], [0.07, 0.12]]) { cy(c, M.chrome, f, x, 0.91, -0.06, 0.012, h); bx(c, M.chrome, f, x, 0.91 + h, -0.06, 0.012, 0.012, 0.06); }
  for (const [x, col] of [[-0.09, "#1e88e5"], [0.09, "#e8e8e4"]] as [number, string][]) bx(c, M.plastic, f, x, 0.8, D / 2 + 0.004, 0.05, 0.04, 0.012, col);
  for (let k = 0; k < 6; k++) bx(c, M.paint, f, 0, 0.08 + k * 0.035, D / 2 + 0.002, W - 0.08, 0.014, 0.004, "#2a2a2a");
  cy(c, M.galv, f, 0.1, 0.1, -D / 2 - 0.02, 0.012, 0.5, undefined, { rx: 0 });
}

/** Pilha de paletes vazios (7 × 0,144 m) com três cones de sinalização empilhados em cima. */
function palletStack(c: PropsCtx, M: DocaMats, f: Foot) {
  const w = Math.min(1.2, f.w), d = Math.min(1.0, f.d), tones = ["#e8d6b8", "#d6cbb8", "#f0e2c6", "#cfc4b0", "#e0cfae", "#d9ccb4", "#efe0c2"];
  for (let k = 0; k < 7; k++) pallet(c, M, f, (k % 2 ? 0.015 : -0.01), 0, w - (k % 3) * 0.01, d, tones[k], k * 0.144);
  const top = 7 * 0.144;
  for (let k = 0; k < 3; k++) {
    const y = top + k * 0.09;
    c.batch.add(ROOM, M.plastic, tint(geo("doca-cone", () => new THREE.ConeGeometry(0.14, 0.62, 18, 1, true).translate(0, 0.31, 0)), "doca-cone", "#f25c19"), L(f, 0.2, y + 0.03, 0.1));
    c.batch.add(ROOM, M.plastic, tint(geo("doca-coneBase", () => new THREE.BoxGeometry(0.36, 0.03, 0.36).translate(0, 0.015, 0)), "doca-coneBase", "#1a1a1a"), L(f, 0.2, y, 0.1));
  }
  c.batch.add(ROOM, M.plastic, tint(geo("doca-coneBand", () => new THREE.CylinderGeometry(0.07, 0.095, 0.1, 18, 1, true).translate(0, 0.05, 0)), "doca-coneBand", "#f4f4f0"), L(f, 0.2, top + 0.18 + 0.33, 0.1));
}

/** A caixa de obra do museu (crate alta): compensado, sarrafos nas bordas, parafusos, estêncil e indicadores. */
export function artCrate(c: PropsCtx, p: Prop) {
  const f = foot(p), M = docaMats(c.q, c.P), A = docaAtlas(c.q).rects, H = p.height === "tall" ? 1.9 : 0.95, W = f.w, D = f.d;
  bx(c, M.wood, f, 0, 0.1, 0, W - 0.04, H - 0.1, D - 0.04, undefined, { cast: true });
  for (const sz of [-1, 1]) bx(c, M.matte, f, 0, 0, sz * (D / 2 - 0.12), W, 0.1, 0.1, "#cdbb9a");                 // patins
  // sarrafos das bordas (as quatro faces) e o reforço do meio
  const e = 0.07, slat = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => bx(c, M.wood, f, x, y, z, sx, sy, sz);
  for (const sz of [-1, 1]) { slat(0, 0.1, sz * (D / 2 - 0.01), W, e, 0.03); slat(0, H - e, sz * (D / 2 - 0.01), W, e, 0.03); for (const sx of [-1, 1]) slat(sx * (W / 2 - e / 2), 0.1, sz * (D / 2 - 0.01), e, H - 0.1, 0.03); slat(0, H / 2, sz * (D / 2 - 0.01), W - 0.1, e, 0.03); }
  for (const sx of [-1, 1]) { slat(sx * (W / 2 - 0.01), 0.1, 0, 0.03, e, D - 0.1); slat(sx * (W / 2 - 0.01), H - e, 0, 0.03, e, D - 0.1); }
  for (let k = 0; k < 10; k++) c.inst.add(ROOM, "doca-screw", CYL0(6), M.chrome as THREE.Material, L(f, -W / 2 + 0.1 + (k % 5) * ((W - 0.2) / 4), k < 5 ? 0.13 : H - 0.04, D / 2 + 0.006, 0, 0.008, 0.004, 0.008, Math.PI / 2));
  decal(c, M.signs, f, "artCrate", A.artCrate, 0, H * 0.5 + 0.22, D / 2 + 0.008, W * 0.86, W * 0.43);
  decal(c, M.signs, f, "artCrateSide", A.artCrate, W / 2 + 0.008, H * 0.55, 0, D * 0.86, D * 0.43, Math.PI / 2);
}

/** Sorteio com semente. */
function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
