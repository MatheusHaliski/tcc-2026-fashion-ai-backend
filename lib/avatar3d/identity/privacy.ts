/**
 * Logs e observabilidade sem dados pessoais (AVATAR-ID I0; auditoria de identidade, seção 21).
 *
 * Pode registrar: ids, tempos por etapa, códigos de aviso, status do gate e QUAIS métricas reprovaram, contagens, modo
 * e nível de detalhe. Nunca: imagens, atlas, máscaras, landmarks, forma do rosto, coeficientes, resíduo, embeddings,
 * cor de pele/olhos/cabelo, medidas do corpo.
 *
 * `identityLogPayload` é a única porta para mandar algo da identidade a log, telemetria ou auditoria: tudo que não
 * está na lista permitida é descartado, e valores que parecem dado pessoal (vetores, cores, data URLs) também.
 */
export const ALLOWED_LOG_KEYS = new Set([
  "userId", "identityId", "version", "basedOn", "status", "stage", "ms", "totalMs", "photos", "views", "warnings",
  "gatePassed", "failedChecks", "notMeasured", "lod", "mode", "renderProfile", "source", "reason", "count",
]);

/** Chaves que nunca podem aparecer em log (também usadas pelo teste que varre o código). */
export const FORBIDDEN_LOG_KEYS = [
  "shape", "landmarks", "points", "atlas", "texture", "image", "photo", "mask", "residual", "coeffs", "faceCoeffs",
  "embedding", "skin", "skinTone", "iris", "eyeColor", "hair", "hairColor", "body", "params", "measurements", "model",
] as const;

const HEX = /^#?[0-9a-f]{6}$/i;
const looksPersonal = (v: unknown): boolean =>
  (typeof v === "string" && (HEX.test(v) || v.startsWith("data:") || v.startsWith("blob:") || v.length > 200)) ||
  (Array.isArray(v) && (v.length > 32 || v.some((x) => typeof x === "number"))) ||
  ArrayBuffer.isView(v) || (typeof v === "object" && v !== null && !Array.isArray(v));

export function identityLogPayload(details: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [k, v] of Object.entries(details)) {
    if (!ALLOWED_LOG_KEYS.has(k) || v === undefined || v === null || looksPersonal(v)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_]{1,40}$/.test(x)).slice(0, 20);
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}
