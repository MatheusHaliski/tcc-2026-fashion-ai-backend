/*
 * Matriz de vestir do provador (PROVADOR-3D): peças REAIS do acervo (public/assets_pecas, chave estável do asset) ×
 * corpos de proporções distintas × poses. Puro: roda em node (vitest) com o corpo do avatar (fai-body-v1).
 * Usado pelo teste de aceite (fit-matrix.test.ts) e pelo relatório em docs/provador/.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import { compose, fitBody, type Composed } from "./compose";
import { buildHuman, baseNormals, type Human } from "./three-human";
import { applyIdle, applyRestPose, applyTestPose, setArmOut, type PoseState, type TestPose } from "./pose";
import { armOutFor, bodyParam, kindOf, posedPositions, SPECS, type BodyParam, type GarmentGeometry, type GarmentSpec } from "./garments";
import { withDefaultOutfit } from "./default-outfit";
import { specFor } from "./garment-fit";
import { buildGarment, softBodyOf } from "./dress";
import { fitReport, silhouette, type FitReport } from "./fit-metrics";
import { DEFAULT_BODY, BODY_KEYS, type BodyParams, type BodySources, type Sex } from "../body-spec";
import type { Look3dPiece } from "@/components/three/common";
import { ACERVO, type AcervoPiece } from "@/lib/tryon/acervo";
export { ACERVO, ACERVO_SEM_3D, type AcervoPiece } from "@/lib/tryon/acervo";

export interface BodyCase { id: string; sex: Sex; params: BodyParams | null }
export const BODIES: BodyCase[] = [
  { id: "F-ref", sex: "FEMININO", params: null },
  { id: "M-ref", sex: "MASCULINO", params: null },
  { id: "F-plus", sex: "FEMININO", params: { ...DEFAULT_BODY.FEMININO, stature: 1.66, build: 1.4 } },
  { id: "M-slim", sex: "MASCULINO", params: { ...DEFAULT_BODY.MASCULINO, stature: 1.82, build: -0.8 } },
];

export const asPiece = (p: AcervoPiece): Look3dPiece => ({ id: p.id, name: p.id, slot: p.category, category: p.category, subcategory: p.subcategory });


export interface Dressed { human: Human; st: PoseState; c: Composed; P: BodyParam; items: { piece: Look3dPiece; spec: GarmentSpec; gg: GarmentGeometry | null }[] }

/** Veste o corpo com as peças (mais o look padrão nas zonas que faltarem), na mesma ordem e regras do provador. */
export function dressBody(asset: BodyAsset, body: BodyCase, pieces: Look3dPiece[], specOf: (p: Look3dPiece) => GarmentSpec | null): Dressed {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, body.params ? "user" : "default"])) as BodySources;
  const fit = fitBody(asset, { sex: body.sex, params: body.params, sources });
  const stature = body.params?.stature ?? DEFAULT_BODY[body.sex].stature;
  const c = compose(asset, fit.z, null, stature);
  const human = buildHuman(asset, c, { skin: "#c99a6e" });
  const st = applyRestPose(human);
  const P = bodyParam(asset, c); const soft = softBodyOf(asset, c);
  const list = withDefaultOutfit(pieces).map((piece) => ({ piece, spec: specOf(piece) })).filter((x): x is { piece: Look3dPiece; spec: GarmentSpec } => !!x.spec).sort((a, b) => a.spec.layer - b.spec.layer);
  setArmOut(human, st, armOutFor(list.map((x) => x.spec)));
  const below: GarmentSpec[] = [];
  const items = list.map(({ piece, spec }) => { const { gg } = buildGarment(asset, c, soft, human.rest.normals, P, spec, below); below.push(spec); return { piece, spec, gg }; });
  return { human, st, c, P, items };
}

/** ANTES (linha de base): o molde da subcategoria sem classe de caimento e sem perna em coluna (o comportamento anterior). */
export const legacySpecOf = (p: Look3dPiece): GarmentSpec | null => { const k = kindOf(p); return k ? { ...SPECS[k], legColumn: 0, bustFall: 0.965 } : null; };
/** DEPOIS: o molde ajustado pela classe de caimento e pelos comprimentos declarados (garment-fit.ts). */
export const fittedSpecOf = (p: Look3dPiece): GarmentSpec | null => specFor(p);

const W = (u8: Uint8Array | Float32Array) => Float32Array.from(u8 as ArrayLike<number>, (x) => (u8 instanceof Uint8Array ? x / 255 : x));

/** Corpo e peça posados (skinning na CPU, como no shader) + normais e articulações na mesma pose. */
function posed(asset: BodyAsset, d: Dressed) {
  const nb = asset.meta.counts.body; const h = d.human;
  const body = posedPositions(h.skeleton, h.body.bindMatrix, d.c.body.subarray(0, nb * 3), asset.body.skinIndex, W(asset.body.skinWeight));
  const normals = baseNormals(body, asset.body.index, asset.body.renderVertex);
  const joints = new Float32Array(h.bones.length * 3); const v = new THREE.Vector3();
  h.bones.forEach((b, i) => { b.getWorldPosition(v); joints[i * 3] = v.x; joints[i * 3 + 1] = v.y; joints[i * 3 + 2] = v.z; });
  return { body, normals, joints };
}

export interface MatrixRow { pieceId: string; kind: string; body: string; pose: TestPose | "exibicao"; report: FitReport }

/** Métricas da peça `pieceId` vestida em `d` na pose de exibição e nas poses de verificação. */
export function measure(asset: BodyAsset, d: Dressed, pieceId: string, bodyId: string, poses: (TestPose | "exibicao")[] = ["exibicao", "bracos", "caminhada", "agachamento"]): MatrixRow[] {
  const it = d.items.find((x) => x.piece.id === pieceId); if (!it?.gg) return [];
  const gg = it.gg; const P = d.P;
  const rows: MatrixRow[] = [];
  for (const pose of poses) {
    if (pose === "exibicao") applyIdle(d.human, d.st, 0, 0); else applyTestPose(d.human, d.st, pose);
    d.human.root.updateMatrixWorld(true);
    const { body, normals, joints } = posed(asset, d);
    const g = posedPositions(d.human.skeleton, d.human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight);
    const report = fitReport(asset, P, gg, body, normals, g);
    if (pose === "exibicao") report.silhouette = silhouette(asset, P, gg, body, g, joints);
    rows.push({ pieceId, kind: gg.spec.kind, body: bodyId, pose, report });
  }
  applyIdle(d.human, d.st, 0, 0);
  return rows;
}
