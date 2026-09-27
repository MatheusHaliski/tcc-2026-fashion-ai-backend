/*
 * Avatar 3D (RF40) — o corpo humano aberto (MakeHuman/MPFB2, CC0) exportado por scripts/avatar3d/body-export: malha,
 * esqueleto com nomes do Mixamo, pesos de pele, espaços de forma do corpo e do rosto, regressões medida → forma e a
 * correspondência com os 468 pontos do MediaPipe. Aqui só se lê o arquivo; a composição fica em compose.ts.
 */
export const BODY_FORMAT = "fai-body-v1";
export const BODY_URL = `/avatar3d/body/${BODY_FORMAT}`;

interface Slot { offset: number; length: number; type: string; shape: number[]; scale?: number[] }
export interface BodyMeta {
  format: string;
  license: string;
  counts: { body: number; eye: number; hair: number; bones: number; bodyShape: number; faceShape: number; landmarks: number };
  bones: { name: string; parent: number }[];
  joints: number[][];
  tails: number[][];
  regression: { names: string[]; coef: number[][]; r2: number[]; rmse: number[]; min: number[]; max: number[] };
  faceFit: { lambda: number; canonScale: number; canonRotation: number[][]; canonTranslation: number[]; templateCoef: number[] };
  vertices: { chin: number; top: number[]; sole: number[] };
  layout: Record<string, Slot>;
}

export interface Part {
  position: Float32Array;          // forma média, n×3 (m)
  shape: Int16Array;               // K × n × 3, quantizado (× shapeScale[k])
  shapeScale: number[];
  skinIndex: Uint8Array;           // n × 4 (índice do osso)
  skinWeight: Uint8Array;          // n × 4 (0–255, soma 255)
}
export interface BodyAsset {
  meta: BodyMeta;
  body: Part & { renderVertex: Uint16Array; renderUv: Float32Array; index: Uint16Array; faceUv: Float32Array; faceWeight: Uint8Array; torso: Uint8Array };
  eye: Part & { renderVertex: Uint16Array; renderUv: Float32Array; index: Uint16Array; faceUv: Float32Array };
  hair: Part & { index: Uint16Array };
  shapeJoints: Float32Array;       // K × ossos × 3
  shapeTails: Float32Array;
  face: { support: Uint16Array; mean: Float32Array; shape: Int16Array; shapeScale: number[] };
  landmark: { tri: Uint16Array; bary: Float32Array };
}

const CTOR = { float32: Float32Array, int16: Int16Array, uint16: Uint16Array, uint8: Uint8Array } as const;

export function parseBodyAsset(meta: BodyMeta, buf: ArrayBuffer): BodyAsset {
  if (meta.format !== BODY_FORMAT) throw new Error(`formato do corpo inesperado: ${meta.format}`);
  const get = <T extends keyof typeof CTOR>(name: string, type: T): InstanceType<(typeof CTOR)[T]> => {
    const s = meta.layout[name];
    if (!s || s.type !== type) throw new Error(`corpo: campo ${name} ausente ou com tipo errado`);
    return new CTOR[type](buf, s.offset, s.length) as InstanceType<(typeof CTOR)[T]>;
  };
  const scale = (name: string) => meta.layout[name].scale ?? [];
  const part = (p: string): Part => ({
    position: get(`${p}.position`, "float32"), shape: get(`shape.${p}`, "int16"), shapeScale: scale(`shape.${p}`),
    skinIndex: get(`${p}.skin.index`, "uint8"), skinWeight: get(`${p}.skin.weight`, "uint8"),
  });
  return {
    meta,
    body: { ...part("body"), renderVertex: get("body.render.vertex", "uint16"), renderUv: get("body.render.uv", "float32"), index: get("body.render.index", "uint16"),
      faceUv: get("face.uv", "float32"), faceWeight: get("face.weight", "uint8"), torso: get("torso", "uint8") },
    eye: { ...part("eye"), renderVertex: get("eye.render.vertex", "uint16"), renderUv: get("eye.render.uv", "float32"), index: get("eye.render.index", "uint16"), faceUv: get("eye.faceUv", "float32") },
    hair: { ...part("hair"), index: get("hair.index", "uint16") },
    shapeJoints: get("shape.joints", "float32"), shapeTails: get("shape.tails", "float32"),
    face: { support: get("face.support", "uint16"), mean: get("face.mean", "float32"), shape: get("face.shape", "int16"), shapeScale: scale("face.shape") },
    landmark: { tri: get("landmark.tri", "uint16"), bary: get("landmark.bary", "float32") },
  };
}

let cached: Promise<BodyAsset> | null = null;
/** Baixa o corpo uma vez por sessão (arquivos estáticos e imutáveis em /public). */
export function loadBodyAsset(): Promise<BodyAsset> {
  if (!cached) {
    cached = Promise.all([
      fetch(`${BODY_URL}.json`).then((r) => { if (!r.ok) throw new Error(`corpo ${r.status}`); return r.json() as Promise<BodyMeta>; }),
      fetch(`${BODY_URL}.bin`).then((r) => { if (!r.ok) throw new Error(`corpo ${r.status}`); return r.arrayBuffer(); }),
    ]).then(([m, b]) => parseBodyAsset(m, b));
    cached.catch(() => { cached = null; });
  }
  return cached;
}
