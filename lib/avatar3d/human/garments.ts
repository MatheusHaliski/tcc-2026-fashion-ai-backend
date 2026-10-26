// @ts-nocheck
import * as THREE from "three";
import { BodyAsset } from "./assets";
import { BodyParam } from "./params";
import { LayerTextureOptions, preparePhotoTexture, UnderLayer } from "./textures";
import { smooth } from "./utils";

export interface GarmentSpec {
  kind: string;
  neck: number;
  waist: number;
  hip: number;
  hem: number;
  vneck: number;
  sleeve: number;
  wrist: number;
  shoulder: number;
  neckShape: "round" | "v" | "square" | "boat";
  inseam: number;
  pantAnkle: number;
  crotch: number;
  fit: number;
  fitCurve: number;
  loose: number;
  flare: number;
  oversize: number;
  frontOpening?: number;
  isOpenFront?: boolean;
}

export type PresetKey =
  | "tee"
  | "longsleeve"
  | "crop"
  | "hoodie"
  | "shirt"
  | "tank"
  | "pants"
  | "shorts"
  | "bermuda"
  | "culottes"
  | "skirt"
  | "dress"
  | "jacket"
  | "coat"
  | "sweater"
  | "leggings";

export const GARMENT_PRESETS: Record<PresetKey, GarmentSpec> = {
  tee: {
    kind: "tee",
    neck: 0.98,
    waist: 0.58,
    hip: 0.54,
    hem: 0.52,
    vneck: 0.08,
    sleeve: 0.38,
    wrist: 0.34,
    shoulder: 0.03,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.035,
    fitCurve: 0.4,
    loose: 0.08,
    flare: 0,
    oversize: 0,
  },
  longsleeve: {
    kind: "longsleeve",
    neck: 0.97,
    waist: 0.58,
    hip: 0.54,
    hem: 0.52,
    vneck: 0.08,
    sleeve: 0.98,
    wrist: 0.22,
    shoulder: 0.03,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.03,
    fitCurve: 0.3,
    loose: 0.06,
    flare: 0,
    oversize: 0,
  },
  crop: {
    kind: "crop",
    neck: 0.98,
    waist: 0.8,
    hip: 0.72,
    hem: 0.72,
    vneck: 0.06,
    sleeve: 0.32,
    wrist: 0.32,
    shoulder: 0.02,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.02,
    fitCurve: 0.2,
    loose: 0.04,
    flare: 0,
    oversize: 0,
  },
  hoodie: {
    kind: "hoodie",
    neck: 0.94,
    waist: 0.52,
    hip: 0.48,
    hem: 0.46,
    vneck: 0.1,
    sleeve: 1.0,
    wrist: 0.23,
    shoulder: 0.06,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.065,
    fitCurve: 0.6,
    loose: 0.16,
    flare: 0,
    oversize: 0,
  },
  shirt: {
    kind: "shirt",
    neck: 0.96,
    waist: 0.56,
    hip: 0.52,
    hem: 0.5,
    vneck: 0.18,
    sleeve: 0.95,
    wrist: 0.24,
    shoulder: 0.04,
    neckShape: "v",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.04,
    fitCurve: 0.4,
    loose: 0.1,
    flare: 0,
    oversize: 0,
    frontOpening: 0.8,
  },
  tank: {
    kind: "tank",
    neck: 0.94,
    waist: 0.58,
    hip: 0.54,
    hem: 0.52,
    vneck: 0.18,
    sleeve: 0.0,
    wrist: 0.0,
    shoulder: -0.04,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.025,
    fitCurve: 0.3,
    loose: 0.05,
    flare: 0,
    oversize: 0,
  },
  pants: {
    kind: "pants",
    neck: 0,
    waist: 0.72,
    hip: 0.52,
    hem: 0.02,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0.96,
    pantAnkle: 0.25,
    crotch: 0.52,
    fit: 0.035,
    fitCurve: 0.4,
    loose: 0.08,
    flare: 0,
    oversize: 0,
  },
  shorts: {
    kind: "shorts",
    neck: 0,
    waist: 0.72,
    hip: 0.54,
    hem: 0.42,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0.2,
    pantAnkle: 0.36,
    crotch: 0.52,
    fit: 0.03,
    fitCurve: 0.3,
    loose: 0.06,
    flare: 0,
    oversize: 0,
  },
  bermuda: {
    kind: "bermuda",
    neck: 0,
    waist: 0.72,
    hip: 0.54,
    hem: 0.32,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0.42,
    pantAnkle: 0.32,
    crotch: 0.52,
    fit: 0.035,
    fitCurve: 0.35,
    loose: 0.07,
    flare: 0,
    oversize: 0,
  },
  culottes: {
    kind: "culottes",
    neck: 0,
    waist: 0.72,
    hip: 0.54,
    hem: 0.28,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0.55,
    pantAnkle: 0.45,
    crotch: 0.52,
    fit: 0.04,
    fitCurve: 0.5,
    loose: 0.15,
    flare: 0.3,
    oversize: 0,
  },
  skirt: {
    kind: "skirt",
    neck: 0,
    waist: 0.72,
    hip: 0.54,
    hem: 0.38,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.03,
    fitCurve: 0.3,
    loose: 0.1,
    flare: 0.25,
    oversize: 0,
  },
  dress: {
    kind: "dress",
    neck: 0.98,
    waist: 0.65,
    hip: 0.52,
    hem: 0.28,
    vneck: 0.12,
    sleeve: 0.35,
    wrist: 0.32,
    shoulder: 0.02,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.03,
    fitCurve: 0.35,
    loose: 0.08,
    flare: 0.2,
    oversize: 0,
  },
  jacket: {
    kind: "jacket",
    neck: 0.95,
    waist: 0.54,
    hip: 0.5,
    hem: 0.48,
    vneck: 0.12,
    sleeve: 0.98,
    wrist: 0.26,
    shoulder: 0.05,
    neckShape: "v",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.055,
    fitCurve: 0.5,
    loose: 0.14,
    flare: 0,
    oversize: 0,
    frontOpening: 0.9,
  },
  coat: {
    kind: "coat",
    neck: 0.95,
    waist: 0.54,
    hip: 0.48,
    hem: 0.32,
    vneck: 0.15,
    sleeve: 0.98,
    wrist: 0.27,
    shoulder: 0.06,
    neckShape: "v",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.06,
    fitCurve: 0.5,
    loose: 0.15,
    flare: 0,
    oversize: 0,
    frontOpening: 0.9,
  },
  sweater: {
    kind: "sweater",
    neck: 0.96,
    waist: 0.54,
    hip: 0.5,
    hem: 0.48,
    vneck: 0.08,
    sleeve: 0.98,
    wrist: 0.22,
    shoulder: 0.04,
    neckShape: "round",
    inseam: 0,
    pantAnkle: 0,
    crotch: 0,
    fit: 0.05,
    fitCurve: 0.5,
    loose: 0.12,
    flare: 0,
    oversize: 0,
  },
  leggings: {
    kind: "leggings",
    neck: 0,
    waist: 0.72,
    hip: 0.52,
    hem: 0.02,
    vneck: 0,
    sleeve: 0,
    wrist: 0,
    shoulder: 0,
    neckShape: "round",
    inseam: 0.96,
    pantAnkle: 0.18,
    crotch: 0.52,
    fit: 0.015,
    fitCurve: 0.2,
    loose: 0,
    flare: 0,
    oversize: 0,
  },
};

const HAS_COLLAR_BAND = new Set([
  "tee",
  "longsleeve",
  "crop",
  "hoodie",
  "shirt",
  "tank",
  "dress",
  "jacket",
  "coat",
  "sweater",
]);

export interface Composed {
  shoulderW: number;
  waistW: number;
  hipW: number;
  chestDepth: number;
  neckR: number;
  yNeck: number;
  yShoulder: number;
  yWaist: number;
  yHip: number;
  yCrotch: number;
  yAnkle: number;
  armLen: number;
  legLen: number;
  torsoH: number;
}

export interface CollarBand {
  mesh: THREE.Mesh;
  yMin: number;
  yMax: number;
}

export function fillSpecDefaults(sp: GarmentSpec): GarmentSpec {
  const base = GARMENT_PRESETS[sp.kind as PresetKey] ?? GARMENT_PRESETS.tee;
  return {
    ...base,
    ...sp,
    fit: sp.fit ?? base.fit,
    fitCurve: sp.fitCurve ?? base.fitCurve,
    loose: sp.loose ?? base.loose,
    flare: sp.flare ?? base.flare,
    oversize: sp.oversize ?? base.oversize,
    frontOpening: sp.frontOpening ?? base.frontOpening,
    isOpenFront: sp.isOpenFront ?? base.isOpenFront,
  };
}

export function composeParams(P: BodyParam, a: BodyAsset): Composed {
  const box = new THREE.Box3().setFromObject(a.bodyMesh);
  const sz = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const yNeck = box.max.y - sz.y * 0.12;
  const yShoulder = box.max.y - sz.y * 0.18;
  const yWaist = center.y + sz.y * 0.05;
  const yHip = center.y - sz.y * 0.12;
  const yCrotch = box.min.y + sz.y * 0.42;
  const yAnkle = box.min.y + sz.y * 0.08;

  const shoulderW = (sz.x * 0.38) * P.shoulderWidth;
  const waistW = (sz.x * 0.28) * P.waistWidth;
  const hipW = (sz.x * 0.34) * P.hipWidth;
  const chestDepth = (sz.z * 0.32) * P.chestDepth;

  const neckR = Math.max(0.04, shoulderW * 0.22);
  const armLen = sz.y * 0.38;
  const legLen = yCrotch - yAnkle;
  const torsoH = yNeck - yHip;

  return {
    shoulderW,
    waistW,
    hipW,
    chestDepth,
    neckR,
    yNeck,
    yShoulder,
    yWaist,
    yHip,
    yCrotch,
    yAnkle,
    armLen,
    legLen,
    torsoH,
  };
}

export function necklineH(sp: GarmentSpec, x: number, dz: number): number {
  const r = Math.hypot(x, dz) || 1;
  const front = smooth(-0.2, 0.75, dz / r);
  const side = Math.abs(x) / r;

  const vDrop = sp.frontOpening ? Math.max(sp.vneck, 0.15) : sp.vneck;

  switch (sp.neckShape) {
    case "v":
      return sp.neck - vDrop * Math.max(0, 1 - side / 0.75) * smooth(-0.15, 0.35, dz / r);
    case "square":
      return sp.neck - vDrop * (1 - smooth(0.42, 0.6, side)) * smooth(-0.15, 0.35, dz / r);
    case "boat":
      return sp.neck - vDrop * smooth(-0.3, 0.3, dz / r);
    default:
      return sp.neck - vDrop * Math.pow(front, 1.4);
  }
}

export function collarBand(
  a: BodyAsset,
  c: Composed,
  P: BodyParam,
  sp: GarmentSpec,
  under: UnderLayer | null = null
): CollarBand | null {
  if (
    !HAS_COLLAR_BAND.has(sp.kind) ||
    Number.isNaN(sp.hem) ||
    (sp.frontOpening && sp.frontOpening > 0)
  ) {
    return null;
  }

  const radSegs = 36;
  const heightSegs = 6;
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const baseRadius = c.neckR * 1.05;
  const bandHeight = 0.025 + sp.fit * 0.1;
  const yBase = c.yNeck - 0.015;

  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    const y = yBase + v * bandHeight;

    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const angle = u * Math.PI * 2;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const r = baseRadius * (1 + 0.08 * Math.cos(angle * 2));
      const x = cos * r;
      const z = sin * r * 0.85;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const first = j * (radSegs + 1) + i;
      const second = first + radSegs + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  return {
    mesh,
    yMin: yBase,
    yMax: yBase + bandHeight,
  };
}

export function buildGarmentMesh(
  sp: GarmentSpec,
  P: BodyParam,
  c: Composed,
  a: BodyAsset,
  opts?: LayerTextureOptions,
  under: UnderLayer | null = null
): THREE.Mesh {
  const spec = fillSpecDefaults(sp);

  const geom = new THREE.BufferGeometry();
  const radSegs = 48;
  const heightSegs = 64;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const isUpperPiece = [
    "tee",
    "longsleeve",
    "crop",
    "hoodie",
    "shirt",
    "tank",
    "dress",
    "jacket",
    "coat",
    "sweater",
  ].includes(spec.kind);

  const yTop = isUpperPiece ? c.yNeck : c.yWaist;
  let yBot = c.yHip;

  if (spec.kind === "crop") {
    yBot = c.yWaist + (c.yNeck - c.yWaist) * 0.2;
  } else if (spec.kind === "dress" || spec.kind === "skirt") {
    yBot = c.yHip - c.legLen * (1 - spec.hem);
  } else if (!isUpperPiece) {
    yBot = c.yAnkle + c.legLen * (1 - spec.inseam);
  }

  const fy = ["pants", "shorts", "bermuda", "culottes", "skirt", "leggings"].includes(spec.kind)
    ? 0.45
    : isUpperPiece
    ? 0.85
    : spec.sleeve > 0.6
    ? 0.93
    : 0.62;

  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    const y = yTop - v * (yTop - yBot);

    const tTorso = Math.max(0, Math.min(1, (c.yNeck - y) / (c.yNeck - c.yHip || 1)));

    let radiusX = c.shoulderW * (1 - tTorso * 0.2) + spec.fit * 0.05;
    let radiusZ = c.chestDepth * (1 - tTorso * 0.1) + spec.fit * 0.04;

    if (!isUpperPiece) {
      const tLeg = Math.max(0, Math.min(1, (c.yWaist - y) / (c.yWaist - yBot || 1)));
      radiusX = c.waistW * (1 - tLeg * 0.3) + spec.fit * 0.04;
      radiusZ = c.waistW * 0.7 * (1 - tLeg * 0.3) + spec.fit * 0.04;
    }

    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const angle = u * Math.PI * 2;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      let px = cos * radiusX;
      let pz = sin * radiusZ;
      let py = y;

      if (isUpperPiece && j < heightSegs * 0.25) {
        const neckFactor = necklineH(spec, px, pz);
        py -= (1 - neckFactor) * 0.05;
      }

      positions.push(px, py, pz);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const first = j * (radSegs + 1) + i;
      const second = first + radSegs + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  let mat: THREE.Material;

  if (opts && opts.photoUrl) {
    const tex = preparePhotoTexture(opts.photoUrl, opts);
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: opts?.color ?? 0x3b82f6,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.Mesh(geom, mat);
}