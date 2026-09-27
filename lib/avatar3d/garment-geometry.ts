import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Look3dPiece } from "@/components/three/common";
import type { Section, Spec, V3 } from "@/lib/avatar3d/body-spec";
import { faceNz, resolveCollisions } from "@/lib/avatar3d/garment-metrics";

/*
 * Geometria do corpo e das roupas do manequim 3D, sem React (testável em node): cortes do tronco em "loft", membros,
 * molde de cada peça (as partes do corpo que ela cobre, um pouco infladas), projeção frontal da foto, colisões com o
 * corpo e separação entre a parte que exibe a foto e a parte que só tem a cor do tecido.
 * Usada por components/three/mannequin.tsx (render) e pelas métricas de vestir (lib/avatar3d/garment-metrics.ts).
 */

export const SHORT_LOWER = new Set(["bermuda_shorts", "denim_shorts", "shorts", "skort"]);
export const SKIRTS = new Set(["skirt", "culottes"]);
const SEG = 40;
/** Folga mínima entre a roupa e a pele depois de resolver as colisões (m). */
export const COLLISION_CLEARANCE = 0.003;

/** Corte do tronco numa altura, interpolado. */
export function sectionAt(t: Section[], y: number): Section {
  if (y <= t[0].y) return { ...t[0], y };
  for (let i = 1; i < t.length; i++) if (y <= t[i].y) { const a = t[i - 1], b = t[i]; const k = (y - a.y) / Math.max(1e-9, b.y - a.y); return { y, a: a.a + (b.a - a.a) * k, b: a.b + (b.b - a.b) * k }; }
  return { ...t[t.length - 1], y };
}

/** Tronco (ou trecho dele) como superfície de cortes elípticos, com tampas; `inflate` afasta a roupa do corpo. */
export function loftGeo(sections: Section[], inflate = 0, capBottom = true, capTop = true): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  sections.forEach((s, r) => {
    for (let i = 0; i <= SEG; i++) {
      const t = (i / SEG) * Math.PI * 2; pos.push(Math.sin(t) * (s.a + inflate), s.y, Math.cos(t) * (s.b + inflate)); uv.push(i / SEG, r / (sections.length - 1));
    }
  });
  for (let r = 0; r < sections.length - 1; r++) for (let i = 0; i < SEG; i++) {
    const a = r * (SEG + 1) + i, b = a + SEG + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);   // anti-horário visto de fora: normais para fora
  }
  const cap = (r: number, down: boolean) => {
    const c = pos.length / 3; const s = sections[r]; pos.push(0, s.y, 0); uv.push(0.5, r / (sections.length - 1));
    for (let i = 0; i < SEG; i++) { const a = r * (SEG + 1) + i; if (down) idx.push(c, a + 1, a); else idx.push(c, a, a + 1); }
  };
  if (capBottom) cap(0, true); if (capTop) cap(sections.length - 1, false);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

/** Trecho do tronco entre duas alturas (com os cortes intermediários). */
export function torsoBetween(t: Section[], y0: number, y1: number): Section[] {
  return [sectionAt(t, y0), ...t.filter((s) => s.y > y0 && s.y < y1), sectionAt(t, y1)];
}

export function limbGeo(a: V3, b: V3, r0: number, r1: number): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const dir = vb.clone().sub(va); const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 20, 3, false);
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
export const ellipsoid = (c: V3, r: V3, seg = 20) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); return g; };


/** Caixa onde a foto da peça é projetada (centro x, topo y, largura/altura máximas). */
export function photoBox(p: Look3dPiece, s: Spec): { x: number; top: number; w: number; h: number } {
  const sh = Math.abs(s.joints.shoulderL[0]); const hw = Math.abs(s.joints.hipL[0]) / 0.52; const sub = p.subcategory ?? "";
  const neck = s.joints.neckBase[1]; const crotch = s.levels.crotch; const knee = s.joints.kneeL[1]; const waist = sectionAtName(s, "waist");
  switch (p.slot) {
    case "upper": return { x: 0, top: neck + 0.01 * s.stature, w: sh * 3.4, h: neck - crotch + 0.04 * s.stature };
    case "outer_layer": return { x: 0, top: neck + 0.02 * s.stature, w: sh * 3.7, h: neck - crotch + 0.09 * s.stature };
    case "dress": return { x: 0, top: neck + 0.01 * s.stature, w: sh * 3.4, h: neck - knee + 0.05 * s.stature };
    case "lower": return { x: 0, top: waist + 0.025 * s.stature, w: hw * 3.1, h: SHORT_LOWER.has(sub) || SKIRTS.has(sub) ? waist - knee + 0.04 * s.stature : waist - 0.005 * s.stature };
    case "shoes": return { x: 0, top: 0.1 * s.stature, w: hw * 2.4, h: 0.12 * s.stature };
    default: return { x: 0, top: 0, w: 0, h: 0 };
  }
}
/** Altura da cintura do corpo. */
const sectionAtName = (s: Spec, _name: "waist"): number => s.levels.waist;

/** Molde da roupa: as partes do corpo que a peça cobre, um pouco infladas. */
export function garmentMold(p: Look3dPiece, s: Spec): THREE.BufferGeometry | null {
  const H = s.stature; const sub = p.subcategory ?? ""; const parts: THREE.BufferGeometry[] = [];
  const crotch = s.levels.crotch, neck = s.joints.neckBase[1], waist = sectionAtName(s, "waist"), hip = s.joints.hipL[1];
  const limb = (n: string, inf: number) => { const l = s.limbs.find((x) => x.name === n)!; parts.push(limbGeo(l.from, l.to, l.r0 + inf, l.r1 + inf)); };
  const arms = (inf: number) => ["L", "R"].forEach((sd) => { limb(`upperArm${sd}`, inf); limb(`forearm${sd}`, inf); });
  const legs = (inf: number, toKnee: boolean) => ["L", "R"].forEach((sd) => { limb(`thigh${sd}`, inf); if (!toKnee) limb(`shin${sd}`, inf); });
  const skirt = (yTop: number, yHem: number, flare: number) => { const top = sectionAt(s.torso, yTop); parts.push(loftGeo([{ y: yHem, a: top.a * flare, b: top.b * flare * 1.1 }, { y: (yTop + yHem) / 2, a: top.a * (1 + (flare - 1) * 0.5), b: top.b * (1 + (flare - 1) * 0.55) }, top], 0.012 * H, false, false)); };
  switch (p.slot) {
    case "upper": parts.push(loftGeo(torsoBetween(s.torso, crotch + 0.012 * H, neck), 0.008 * H, false, false)); arms(0.006 * H); break;
    case "outer_layer": parts.push(loftGeo(torsoBetween(s.torso, crotch - 0.02 * H, neck + 0.01 * H), 0.018 * H, false, false)); arms(0.013 * H); break;
    case "dress": parts.push(loftGeo(torsoBetween(s.torso, hip, neck), 0.009 * H, false, false)); arms(0.006 * H); skirt(hip, s.joints.kneeL[1] - 0.012 * H, 1.45); break;
    case "lower":
      if (SKIRTS.has(sub)) skirt(waist + 0.025 * H, s.joints.kneeL[1] - 0.012 * H, 1.6);
      else { parts.push(loftGeo(torsoBetween(s.torso, s.levels.crotch - 0.006 * H, waist + 0.025 * H), 0.007 * H, true, false)); legs(0.007 * H, SHORT_LOWER.has(sub)); }
      break;
    case "shoes": for (const f of s.feet) parts.push(ellipsoid([f.center[0], f.center[1] + f.size[1] * 0.1, f.center[2]], [f.size[0] / 2 + 0.012 * H * 0.5, f.size[1] / 2 + 0.006 * H, f.size[2] / 2 + 0.008 * H])); break;
    default: return null;
  }
  const clean = parts.map((g) => { if (!g.getAttribute("normal")) g.computeVertexNormals(); const n = g.index ? g.toNonIndexed() : g; ["uv", "uv1", "uv2"].forEach((a) => n.deleteAttribute(a)); n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2)); return n; });
  const merged = mergeGeometries(clean, false); if (!merged) return null;
  // colisões: nenhum vértice da roupa dentro do corpo nem a menos de 3 mm da pele (axilas, ombros, virilha, coxas)
  resolveCollisions(s, merged.getAttribute("position"), COLLISION_CLEARANCE);
  return merged;
}

/** Projeção frontal da foto no molde (UV planar) e sombreado das costas por cor de vértice (normais para fora). */
export function project(geo: THREE.BufferGeometry, box: { x: number; top: number; w: number; h: number }) {
  const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal"); const n = pos.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = (pos.getX(i) - (box.x - box.w / 2)) / box.w; uv[i * 2 + 1] = (pos.getY(i) - (box.top - box.h)) / box.h;
    const nz = nor.getZ(i); const shade = nz >= 0 ? 1 : 0.8 + 0.2 * (1 + nz);
    col.set([shade, shade, shade], i * 3);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

/** Caixa efetiva da foto no corpo (mesma regra do componente Garment) e a malha já projetada — usada pelas métricas. */
export function garmentGeometry(p: Look3dPiece, s: Spec, aspect: number): { geo: THREE.BufferGeometry; box: { x: number; top: number; w: number; h: number } } | null {
  const box0 = photoBox(p, s); if (!box0.w) return null;
  const g = garmentMold(p, s); if (!g) return null;
  const box = fitPhoto(p, box0, aspect); project(g, box); return { geo: g, box };
}

/**
 * A foto da peça é frontal: não informa costas nem laterais. Repetir a estampa lá seria inventar (a frente aparecia
 * espelhada nas costas) e, nas laterais, a projeção planar esticava a estampa até 12–14×. Por isso a malha é separada:
 * `print` (triângulos que encaram a câmera da foto, nz ≥ PRINT_MIN_NZ) recebe a foto; `plain` recebe a cor do tecido,
 * com o mesmo recorte (alfa) da foto. Com foto das costas (plano, fase 2) o `plain` de trás passa a ter a textura dela.
 */
export const PRINT_MIN_NZ = 0.3;
export function splitPrint(geo: THREE.BufferGeometry): { print: THREE.BufferGeometry; plain: THREE.BufferGeometry } {
  const pos = geo.getAttribute("position"); const n = pos.count; const names = Object.keys(geo.attributes);
  const pick = (keep: (f: number) => boolean) => {
    const faces: number[] = []; for (let f = 0; f + 2 < n; f += 3) if (keep(f)) faces.push(f);
    const out = new THREE.BufferGeometry();
    for (const nm of names) {
      const a = geo.getAttribute(nm) as THREE.BufferAttribute; const k = a.itemSize; const arr = new Float32Array(faces.length * 3 * k);
      faces.forEach((f, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < k; c++) arr[(j * 3 + v) * k + c] = a.array[(f + v) * k + c]; });
      out.setAttribute(nm, new THREE.BufferAttribute(arr, k));
    }
    return out;
  };
  return { print: pick((f) => faceNz(pos, f) >= PRINT_MIN_NZ), plain: pick((f) => faceNz(pos, f) < PRINT_MIN_NZ) };
}

/** Largura efetiva da foto na caixa: superior ajusta pela largura (mangas); vestido e inferior pelo comprimento. */
export function fitPhoto(p: Look3dPiece, box0: { x: number; top: number; w: number; h: number }, aspect: number): { x: number; top: number; w: number; h: number } {
  let w = box0.w, h = box0.w / aspect;
  if (p.slot === "dress" || p.slot === "lower") { h = box0.h; w = h * aspect; if (w > box0.w * 1.25) { w = box0.w * 1.25; h = w / aspect; } }
  else if (h > box0.h) { h = box0.h; w = box0.h * aspect; }
  return { x: box0.x, top: box0.top, w, h };
}
