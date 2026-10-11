/*
 * MATRIZ-3D · sonda: constrói a peça pelo MESMO caminho do provador (dress.ts → buildGarment; garment-trims; collarBand;
 * shoes.ts) no corpo de referência e registra o que saiu — vértices do molde por região, faixas de acabamento, gola e
 * partes do calçado. É isso que decide o estado de cada componente na matriz (nada é marcado por leitura do código).
 * Puro (sem DOM): roda em node, no teste da matriz.
 */
import type { BodyAsset } from "@/lib/avatar3d/human/asset";
import type { Composed } from "@/lib/avatar3d/human/compose";
import { buildGarment, softBodyOf } from "@/lib/avatar3d/human/dress";
import { fitClassOf, necklineOf, specFor, type FitPiece } from "@/lib/avatar3d/human/garment-fit";
import { RELAX } from "@/lib/avatar3d/human/garment-relax";
import { garmentTrims, type TrimBand } from "@/lib/avatar3d/human/garment-trims";
import { bodyParam, collarBand, kindOf, type BodyParam, type CollarBand, type GarmentGeometry } from "@/lib/avatar3d/human/garments";
import { shoeParts, shoeStyleOf, type ShoePart } from "@/lib/avatar3d/human/shoes";
import { baseNormals } from "@/lib/avatar3d/human/three-human";
import type { Observacao } from "./registry";

export interface ProbeEnv { asset: BodyAsset; c: Composed; soft: Composed; normals: Float32Array; P: BodyParam }

export function probeEnv(asset: BodyAsset, c: Composed): ProbeEnv {
  return { asset, c, soft: softBodyOf(asset, c), normals: baseNormals(c.body, asset.body.index, asset.body.renderVertex), P: bodyParam(asset, c) };
}

/** Peça sondada: subcategoria/categoria da taxonomia e, opcionalmente, atributos (ex.: SLEEVE_LENGTH=LONG_SLEEVE). */
export interface ProbePiece { category: string; subcategory: string; name?: string; attributes?: Record<string, string[]> }

export interface Built { obs: Observacao; gg: GarmentGeometry | null; base: Composed | null; trims: TrimBand[]; collar: CollarBand | null; shoes: ShoePart[] }

export const attrsKey = (a?: Record<string, string[]>) => Object.entries(a ?? {}).map(([k, x]) => `${k}=${x.join("+")}`).sort().join(" ");

const verts = (pos: Float32Array) => pos.length / 3;

/** Constrói a peça sozinha no corpo (sem camadas por baixo) e devolve o observado + as malhas (para o catálogo visual). */
export function build(env: ProbeEnv, piece: ProbePiece): Built {
  const fp: FitPiece = { name: piece.name ?? piece.subcategory, category: piece.category, subcategory: piece.subcategory, attributes: piece.attributes ?? null };
  const kind = kindOf(fp); const spec = specFor(fp);
  const obs: Observacao = {
    sub: piece.subcategory, attrs: attrsKey(piece.attributes), kind, spec: null, fit: kind ? fitClassOf(fp) : null, neckline: kind ? necklineOf(fp) : null,
    shoeStyle: kind === "shoes" || kind === "boots" ? shoeStyleOf(piece.subcategory) : null, relax: kind ? RELAX[kind] ?? null : null,
    molde: null, gola: 0, acabamentos: {}, calcado: {},
  };
  if (!kind || !spec) return { obs, gg: null, base: null, trims: [], collar: null, shoes: [] };
  obs.spec = { ease: spec.ease, hem: spec.hem, neck: spec.neck, vneck: spec.vneck, neckShape: spec.neckShape ?? "round", waist: spec.waist, sleeve: spec.sleeve, leg: spec.leg,
    skirt: spec.skirt, drape: spec.drape, flare: spec.flare, layer: spec.layer, legColumn: spec.legColumn, bustFall: spec.bustFall, shaft: spec.shaft, construction: spec.construction ?? "" };
  const { asset, c, soft, normals, P } = env;
  const { gg, base, under } = buildGarment(asset, c, soft, normals, P, spec, []);
  let trims: TrimBand[] = []; let collar: CollarBand | null = null; let shoes: ShoePart[] = [];
  if (gg) {
    const m = { verts: verts(gg.position), tris: gg.index.length / 3, tronco: 0, braco: 0, perna: 0, pe: 0, tubo: 0, ombro: 0 };
    for (let v = 0; v < gg.source.length; v++) {
      if (gg.alpha[v] < 0.5) continue;
      const s = gg.source[v]; if (s < 0) { m.tubo++; continue; }
      const g = P.group[s];
      if (g === 1) { m.tronco++; if (P.h[s] >= 0.97 && Math.abs(env.c.body[s * 3]) > 0.07) m.ombro++; } else if (g === 2 || g === 5) m.braco++; else if (g === 3) m.perna++; else if (g === 4) m.pe++;
    }
    obs.molde = m;
    trims = garmentTrims(asset, base, P, gg);
    for (const t of trims) obs.acabamentos[t.part] = (obs.acabamentos[t.part] ?? 0) + verts(t.position);
  }
  const shoe = kind === "shoes" || kind === "boots";
  if (!shoe) { collar = collarBand(asset, base, P, spec, under); obs.gola = collar ? verts(collar.position) : 0; }
  else {
    shoes = shoeParts(asset, c, P, spec, { upper: "#7a8794", sole: "#eeeeee" }, shoeStyleOf(piece.subcategory));
    for (const p of shoes) obs.calcado[p.name] = (obs.calcado[p.name] ?? 0) + verts(p.position);
  }
  return { obs, gg, base, trims, collar, shoes };
}

/** Sonda com cache: subcategorias que caem no mesmo molde e atributos reaproveitam a construção. */
export function prober(env: ProbeEnv) {
  const cache = new Map<string, Built>();
  return (piece: ProbePiece): Built => {
    const key = `${piece.category}|${piece.subcategory}|${attrsKey(piece.attributes)}`;
    let b = cache.get(key);
    if (!b) { b = build(env, piece); cache.set(key, b); }
    return b;
  };
}
