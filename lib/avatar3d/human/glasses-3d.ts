/*
 * Óculos de grau do avatar (AVATAR-ID I4; lista de 29/09, itens 3 e 7): acessório 3D separado do rosto, nunca pintado
 * na pele e nunca grudado nele. A armação é montada na cabeça desta pessoa:
 *
 *  - lentes de largura proporcional ao olho (1,6 × a largura entre os cantos, 40–58 mm) e altura 0,74 × a largura;
 *  - plano das lentes 12 mm à frente da córnea (distância de vértice usual), mais à frente se a ponte do nariz ou a
 *    bochecha sob a lente pedirem — folga mínima de 4 mm de qualquer ponto do rosto que fica atrás da lente;
 *  - leve curvatura (6°) para trás nas pontas, ponte apoiada sobre o nariz (2 mm de folga), hastes que passam por
 *    fora da cabeça (3 mm de folga, conferida ao longo da haste) até atrás da orelha, com a curva para baixo;
 *  - cor da armação medida na foto (glasses.ts), lentes quase transparentes.
 *
 * O grupo vira filho do osso Head: anda com a cabeça e entra no GLB como o resto da roupa.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import { landmarksOn, type Composed } from "./compose";
import { eyeRig } from "./eyes";

type V3 = [number, number, number];
const P = (lm: Float64Array, i: number): V3 => [lm[i * 3], lm[i * 3 + 1], lm[i * 3 + 2]];
const FRAME_RADIUS = 0.0013;
const WRAP = (6 * Math.PI) / 180;

export interface GlassesFit {
  lens: { w: number; h: number; center: { left: V3; right: V3 } };
  z0: number;                       // plano das lentes (m)
  clearance: number;                // menor folga entre a lente e o rosto atrás dela (m)
  arms: { left: V3[]; right: V3[] };
  bridge: V3[];
}

/** Superelipse (n = 4): retângulo de cantos arredondados, como uma lente comum. */
function lensOutline(w: number, h: number, n = 48): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2; const c = Math.cos(t), s = Math.sin(t); out.push([(w / 2) * Math.sign(c) * Math.abs(c) ** 0.5, (h / 2) * Math.sign(s) * Math.abs(s) ** 0.5]); }
  return out;
}

/** Medidas da armação na cabeça composta (sem three.js; testado em node). */
export function fitGlasses(a: BodyAsset, c: Composed): GlassesFit {
  const lm = landmarksOn(a, c.body); const rig = eyeRig(a, c.eye);
  let front = -Infinity; for (let i = 2; i < c.eye.length; i += 3) front = Math.max(front, c.eye[i]);
  const eyeW = (Math.hypot(...P(lm, 33).map((v, k) => v - P(lm, 133)[k]) as V3) + Math.hypot(...P(lm, 263).map((v, k) => v - P(lm, 362)[k]) as V3)) / 2;
  const w = Math.min(0.058, Math.max(0.04, eyeW * 1.6)), h = w * 0.74;
  const cy = (rig.center.left[1] + rig.center.right[1]) / 2 - 0.002;
  const cx = Math.max(Math.abs(rig.center.left[0]), w / 2 + 0.008) * 1.03;      // ponte de pelo menos 16 mm
  const center = { left: [cx, cy, 0] as V3, right: [-cx, cy, 0] as V3 };
  // plano das lentes: 12 mm à frente da córnea, e 4 mm à frente de qualquer ponto do rosto que fique atrás da lente
  const bridgeZ = Math.max(P(lm, 168)[2], P(lm, 6)[2]) + 0.002;
  // Clearance must include the backwards wrap and the tube thickness, not just the lens center plane.
  const backExtent = Math.sin(WRAP) * (w / 2) + FRAME_RADIUS;
  let z0 = Math.max(front + 0.012 + backExtent, bridgeZ - 0.002);
  const behind: number[] = [];
  for (let i = 0; i < lm.length / 3; i++) {
    const [x, y, z] = P(lm, i);
    for (const ctr of [center.left, center.right]) if (Math.abs(x - ctr[0]) < w / 2 && Math.abs(y - ctr[1]) < h / 2) behind.push(z);
  }
  if (behind.length) z0 = Math.max(z0, Math.max(...behind) + 0.004 + backExtent);
  const clearance = z0 - backExtent - (behind.length ? Math.max(...behind) : front);
  center.left[2] = z0; center.right[2] = z0;
  // hastes: da ponta da lente para trás até a orelha, por fora da cabeça
  const hingeY = cy + h * 0.25; const ear = { left: P(lm, 454), right: P(lm, 234) };
  const arm = (s: 1 | -1, ctr: V3, e: V3): V3[] => {
    const wrapBack = Math.sin(WRAP) * (w / 2);
    const start: V3 = [ctr[0] + s * (w / 2 + 0.003), hingeY, z0 - wrapBack];
    const endZ = e[2] - 0.02; const pts: V3[] = []; let x = Math.abs(start[0]);
    for (let k = 0; k <= 10; k++) {
      const z = start[2] + ((endZ - start[2]) * k) / 10;
      // meia-largura da cabeça nesta altura e profundidade (vértices do corpo de cada lado)
      let half = 0;
      for (let i = 0; i < c.body.length; i += 3) if (Math.sign(c.body[i]) === s && Math.abs(c.body[i + 1] - hingeY) < 0.008 && Math.abs(c.body[i + 2] - z) < 0.006) half = Math.max(half, Math.abs(c.body[i]));
      x = Math.max(x, half + 0.003); pts.push([s * x, hingeY, z]);
    }
    pts.push([s * x, hingeY - 0.022, endZ - 0.016]);           // curva para baixo atrás da orelha
    return pts;
  };
  const arms = { left: arm(1, center.left, ear.left), right: arm(-1, center.right, ear.right) };
  const bx = cx - w / 2;
  const bridge: V3[] = [[-bx, cy + h * 0.18, z0], [0, cy + h * 0.26, Math.max(z0, bridgeZ)], [bx, cy + h * 0.18, z0]];
  return { lens: { w, h, center }, z0, clearance, arms, bridge };
}

const tube = (pts: V3[], r: number, closed = false) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, "centripetal"), Math.max(8, pts.length * 4), r, 8, closed);

/**
 * A armação em three.js, em coordenadas do osso Head (o esqueleto nasce com rotações identidade: basta descontar a
 * posição da cabeça). `headJoint` = posição do osso Head no corpo composto.
 */
export function buildGlasses(fit: GlassesFit, headJoint: V3, frameColor = "#1d1d1f"): THREE.Group {
  const g = new THREE.Group(); g.name = "oculos";
  const frame = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: 0.35, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }); frame.name = "armação";
  const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false }); glass.name = "lente";
  const wrap = WRAP;
  for (const side of ["left", "right"] as const) {
    const s = side === "left" ? 1 : -1; const ctr = fit.lens.center[side];
    // a lente gira em torno do eixo vertical: a ponta de fora vai para trás (curvatura da armação)
    const ring: V3[] = lensOutline(fit.lens.w, fit.lens.h).map(([x, y]) => [ctr[0] + x * Math.cos(wrap), ctr[1] + y, ctr[2] - s * x * Math.sin(wrap)]);
    g.add(new THREE.Mesh(tube(ring, FRAME_RADIUS, true), frame));
    const shape = new THREE.Shape(lensOutline(fit.lens.w * 0.97, fit.lens.h * 0.97).map(([x, y]) => new THREE.Vector2(x, y)));
    const lg = new THREE.ShapeGeometry(shape, 12); lg.rotateY(-s * wrap); lg.translate(ctr[0], ctr[1], ctr[2]);
    const lens = new THREE.Mesh(lg, glass); lens.renderOrder = 2; g.add(lens);
    g.add(new THREE.Mesh(tube(fit.arms[side], 0.0011), frame));
  }
  g.add(new THREE.Mesh(tube(fit.bridge, 0.0012), frame));
  g.position.set(-headJoint[0], -headJoint[1], -headJoint[2]);
  for (const m of g.children as THREE.Mesh[]) { m.castShadow = true; }
  g.userData.dispose = () => { g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); frame.dispose(); glass.dispose(); };
  return g;
}
