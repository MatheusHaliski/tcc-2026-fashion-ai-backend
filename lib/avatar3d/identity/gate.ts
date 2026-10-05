/**
 * Quality gate de identidade (AVATAR-ID I0; auditoria de identidade, seção 16).
 *
 * O gate não aprova sozinho: passar nele deixa a versão pronta para a pessoa aprovar ("é você?"). Reprovar marca
 * NEEDS_REFINEMENT — o avatar continua aparecendo para a própria pessoa, com aviso, mas não como versão aprovada.
 *
 * Métricas que o aparelho não mede (semelhança por reconhecedores faciais, que roda no CI com SFace/ArcFace) entram
 * como "não medidas": não reprovam, mas ficam listadas no relatório.
 */
export interface IdentityMetrics {
  similarityFront?: { sface: number; arcface: number; top1: boolean };
  similarity34?: { sface: number };
  reprojectionMm?: { all: number; eyes: number; nose: number; mouth: number };
  asymmetry?: { measuredMm: number; preservation: number };
  hairSilhouetteError?: number;
  skinColorError?: number;
  /** costuras ou buracos achados nos renders de frente, ±45°, ±perfil e costas */
  seams?: number;
}

export const IDENTITY_GATE = {
  similarityFront: { sface: 0.45, arcface: 0.4 },
  similarity34: { sface: 0.363 },
  reprojectionMm: { all: 1.5, region: 1.2 },
  asymmetry: { minMeasuredMm: 1, preservation: 0.7 },
  hairSilhouetteError: 0.15,
  skinColorError: 5,
  seams: 0,
} as const;

export type GateCheck = keyof IdentityMetrics;
export interface GateResult { passed: boolean; failed: GateCheck[]; notMeasured: GateCheck[] }

const CHECKS: GateCheck[] = ["similarityFront", "similarity34", "reprojectionMm", "asymmetry", "hairSilhouetteError", "skinColorError", "seams"];

export function evaluateIdentityGate(m: IdentityMetrics): GateResult {
  const G = IDENTITY_GATE; const failed: GateCheck[] = []; const notMeasured: GateCheck[] = [];
  const ok: Record<GateCheck, (v: never) => boolean> = {
    similarityFront: (v: NonNullable<IdentityMetrics["similarityFront"]>) => v.sface >= G.similarityFront.sface && v.arcface >= G.similarityFront.arcface && v.top1,
    similarity34: (v: NonNullable<IdentityMetrics["similarity34"]>) => v.sface >= G.similarity34.sface,
    reprojectionMm: (v: NonNullable<IdentityMetrics["reprojectionMm"]>) => v.all <= G.reprojectionMm.all && v.eyes <= G.reprojectionMm.region && v.nose <= G.reprojectionMm.region && v.mouth <= G.reprojectionMm.region,
    // assimetria pequena (dentro do ruído) não é cobrada: não há o que preservar
    asymmetry: (v: NonNullable<IdentityMetrics["asymmetry"]>) => v.measuredMm <= G.asymmetry.minMeasuredMm || v.preservation >= G.asymmetry.preservation,
    hairSilhouetteError: (v: number) => v <= G.hairSilhouetteError,
    skinColorError: (v: number) => v <= G.skinColorError,
    seams: (v: number) => v <= G.seams,
  } as Record<GateCheck, (v: never) => boolean>;
  for (const k of CHECKS) {
    const v = m[k];
    if (v === undefined || v === null) { notMeasured.push(k); continue; }
    if (!ok[k](v as never)) failed.push(k);
  }
  return { passed: failed.length === 0, failed, notMeasured };
}
