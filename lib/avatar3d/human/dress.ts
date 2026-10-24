/*
 * Montagem da geometria de uma peça (puro, sem DOM): o MESMO caminho do provador (components/three/human-outfit.tsx)
 * e do harness de métricas (fit-metrics.ts) — molde (garments.ts) → caimento (relaxamento, perna em coluna) → dobras.
 * Assim o que se mede é exatamente o que se desenha.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { SPECS, garmentGeometry, underLayer, type BodyParam, type GarmentGeometry, type GarmentSpec, type UnderLayer } from "./garments";
import { enforceGarmentClearance, columnLegs, foldGarment, relaxGarment, smoothBody } from "./garment-relax";

/** Corpo suavizado (referência de folga do tecido: sem mamilos, clavícula e músculos desenhados). */
export function softBodyOf(a: BodyAsset, c: Composed): Composed {
  return { ...c, body: smoothBody(a, c, 12) };
}

/** Geometria de uma peça por cima das que já estão vestidas (`below`, em ordem de camada). */
export function buildGarment(a: BodyAsset, c: Composed, soft: Composed, normals: Float32Array, P: BodyParam, spec: GarmentSpec, below: GarmentSpec[]): { gg: GarmentGeometry | null; base: Composed; under: UnderLayer | null } {
  const shoe = spec.kind === "shoes" || spec.kind === "boots";
  const base = shoe ? c : soft;                              // o calçado nasce do pé real; a roupa, do corpo suavizado
  let lining: GarmentGeometry | null = null;
  let layers = below;
  if (spec.liningLeg && spec.skirt > 0) {
    const skirtBottom = P.hipY + spec.waist * (P.neckY - P.hipY) - spec.skirt;
    const leg = Math.max(.08, Math.min(spec.liningLeg, (P.hipY - skirtBottom - .025) / (P.hipY - P.ankleY)));
    const liningSpec: GarmentSpec = { ...SPECS.shorts, leg, waist: spec.waist, ease: .004, flare: 0, legColumn: 0, layer: spec.layer - 1 };
    lining = buildGarment(a, c, soft, normals, P, liningSpec, below).gg;
    if (lining) layers = [...below, liningSpec];
  }
  const under = layers.length ? underLayer(base, P, layers) : null;
  let gg = garmentGeometry(a, base, normals, P, spec, under);
  // caimento: relaxa → perna em coluna (calça reta/ampla não segue a panturrilha) → dobras
  if (gg) { relaxGarment(gg, base, normals, P, under); columnLegs(gg, base, P); foldGarment(gg, base, normals, P); if (!shoe) enforceGarmentClearance(gg, c, normals, P, under); }
  if (gg && lining) gg = withEstimatedLining(gg, lining);
  return { gg, base, under };
}

/** One wearable mesh for renderer and audit alike. The lining gets fabric, never the skirt's front artwork. */
function withEstimatedLining(outer: GarmentGeometry, inner: GarmentGeometry): GarmentGeometry {
  const offset = outer.position.length / 3;
  const joinFloat = (a: Float32Array, b: Float32Array) => { const out = new Float32Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; };
  const skinIndex = new Uint16Array(outer.skinIndex.length + inner.skinIndex.length); skinIndex.set(outer.skinIndex); skinIndex.set(inner.skinIndex, outer.skinIndex.length);
  const source = new Int32Array(outer.source.length + inner.source.length); source.set(outer.source); source.set(inner.source, outer.source.length);
  const index = new Uint32Array(outer.index.length + inner.index.length); index.set(outer.index); index.set(Uint32Array.from(inner.index, v => v + offset), outer.index.length);
  const photoEligible = new Float32Array(source.length); photoEligible.fill(1, 0, offset);
  return { spec: outer.spec, position: joinFloat(outer.position, inner.position), alpha: joinFloat(outer.alpha, inner.alpha), skinIndex,
    skinWeight: joinFloat(outer.skinWeight, inner.skinWeight), source, index, photoEligible };
}
