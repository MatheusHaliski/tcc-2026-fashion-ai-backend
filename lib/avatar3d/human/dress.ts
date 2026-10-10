/*
 * Montagem da geometria de uma peça (puro, sem DOM): o MESMO caminho do provador (components/three/human-outfit.tsx)
 * e do harness de métricas (fit-metrics.ts) — molde (garments.ts) → caimento (relaxamento, perna em coluna) → dobras.
 * Assim o que se mede é exatamente o que se desenha.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { garmentGeometry, underLayer, type BodyParam, type GarmentGeometry, type GarmentSpec, type UnderLayer } from "./garments";
import { columnLegs, foldGarment, relaxGarment, smoothBody } from "./garment-relax";

/** Corpo suavizado (referência de folga do tecido: sem mamilos, clavícula e músculos desenhados). */
export function softBodyOf(a: BodyAsset, c: Composed): Composed {
  return { ...c, body: smoothBody(a, c, 12) };
}

/** Geometria de uma peça por cima das que já estão vestidas (`below`, em ordem de camada). */
export function buildGarment(a: BodyAsset, c: Composed, soft: Composed, normals: Float32Array, P: BodyParam, spec: GarmentSpec, below: GarmentSpec[]): { gg: GarmentGeometry | null; base: Composed; under: UnderLayer | null } {
  const shoe = spec.kind === "shoes" || spec.kind === "boots";
  const base = shoe ? c : soft;                              // o calçado nasce do pé real; a roupa, do corpo suavizado
  const under = below.length ? underLayer(base, P, below) : null;
  const gg = garmentGeometry(a, base, normals, P, spec, under);
  // caimento: relaxa → perna em coluna (calça reta/ampla não segue a panturrilha) → dobras
  if (gg) { relaxGarment(gg, base, normals, P, under); columnLegs(gg, base, P); foldGarment(gg, base, normals, P); }
  return { gg, base, under };
}
