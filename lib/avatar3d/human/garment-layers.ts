import type { Composed } from "./compose";
import { coverageOf, necklineH, type BodyParam, type GarmentGeometry, type GarmentSpec } from "./garments";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The torso envelope extends over the hips as one tube, including the gaps between thighs. */
function torsoCoverage(P: BodyParam, sp: GarmentSpec, x: number, y: number, z: number): number {
  if (!Number.isFinite(sp.hem)) return 0;
  const span = P.neckY - P.hipY, h = (y - P.hipY) / span;
  const hem = sp.skirt > 0 ? (sp.kind === "coat" ? 0 : sp.hem) - sp.skirt / span : sp.hem;
  const neck = necklineH(sp, x, z - P.neckZ);
  return smooth(hem - 0.03, hem + 0.03, h) * (1 - smooth(neck - 0.03, neck + 0.03, h));
}

/** Hide inner fabric only where a successfully constructed outer garment covers it.
 * Keep the inner geometry/thickness for fitting and the visible neckline, longer tail and cuffs.
 * This also prevents independently relaxed inner meshes from poking through the outer surface.
 */
export function occludeInnerGarment(gg: GarmentGeometry, c: Composed, P: BodyParam, above: GarmentSpec[]): void {
  const outer = above.filter((sp) => sp.layer > gg.spec.layer);
  if (!outer.length) return;
  const masks = outer.map((sp) => coverageOf(c, P, sp));
  for (let v = 0; v < gg.source.length; v++) {
    const src = gg.source[v]; let covered = 0;
    for (let i = 0; i < outer.length; i++) {
      const group = src < 0 ? 1 : P.group[src];
      const cov = group === 1 || group === 3
        ? Math.max(src < 0 ? 0 : masks[i][src], torsoCoverage(P, outer[i], gg.position[v * 3], gg.position[v * 3 + 1], gg.position[v * 3 + 2]))
        : src < 0 ? 0 : masks[i][src];
      covered = Math.max(covered, cov);
    }
    gg.alpha[v] *= 1 - covered;
  }
}

/** Separate cuffs/hem/collar bands must obey the same layer visibility as the fabric. */
export function visibleGarmentFinishes(sp: GarmentSpec, above: GarmentSpec[], P: BodyParam): { hem: boolean; cuff: boolean; collar: boolean } {
  const outer = above.filter((o) => o.layer > sp.layer && Number.isFinite(o.hem));
  const hem = (o: GarmentSpec) => o.skirt > 0 ? (o.kind === "coat" ? 0 : o.hem) - o.skirt / (P.neckY - P.hipY) : o.hem;
  return {
    hem: !outer.some((o) => hem(o) <= sp.hem && o.neck - o.vneck > sp.hem + 0.03),
    cuff: !outer.some((o) => o.sleeve >= sp.sleeve),
    collar: !outer.some((o) => o.neck >= sp.neck && o.neck - o.vneck >= sp.neck - sp.vneck),
  };
}
