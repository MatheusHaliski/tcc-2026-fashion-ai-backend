/*
 * Avatar 3D (RF40) — cabelo em fios (fase 2 do plano docs/avatar3d/plano-cabelo-realista-e-acabamentos.md).
 *
 * A calota/cortina de hair-geometry.ts vira a BASE (mais escura, garante cobertura) e por cima vem o PENTEADO:
 *
 *   penteado (HairGroom) — guias do penteado: polilinhas da raiz à ponta, no espaço do avatar. Hoje crescem por um
 *              campo simples (growGroom): raízes sorteadas na calota com a normal do couro cabeludo; risca lateral no
 *              curto e ao meio no médio/longo; alto penteado para o lado e para trás; laterais e nuca descendo; franja
 *              para a frente (parando na sobrancelha); cada guia sai com um "lift" (o volume medido), a gravidade puxa
 *              e a colisão a mantém por fora da base e do corpo (com folga para a roupa). Nenhuma mecha passa na frente
 *              do rosto nem deita na pele nua (ctx.inFace/onSkin). Serializável (groomToJSON) para a biblioteca da fase 3.
 *   fios     — strandsFromGroom gera as fitas de cada guia conforme o nível de detalhe (hair-lod.ts): fitas finas que
 *              se juntam na ponta (clumping), com comprimentos diferentes, frizz e onda/cacho/crespo pela textura;
 *              3–5% de fios soltos na borda; ±5% de tom por fio, raiz mais escura e ponta mais clara, interior das
 *              mechas mais escuro (oclusão por densidade). No nível 2 cada guia vira um card largo (≤ 8 mil triângulos).
 *   sombreamento — strandMaterial: fibras em alfa (alpha-to-coverage com MSAA) e brilho de fio Kajiya-Kay com dois
 *              lóbulos sobre a tangente do fio (atributo `tangent`, deformado pelo esqueleto): primário branco
 *              deslocado para a raiz e secundário na cor do cabelo deslocado para a ponta, em faixa ao redor da cabeça;
 *              ele substitui o especular GGX da fita (plana, ficava prateada em ângulo rasante).
 * Tudo determinístico (mesma foto → mesmo cabelo) e preso ao mesmo esqueleto (cabeça, pescoço, tronco).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { AvatarHair } from "../model";
import type { HairBuild } from "./hair-geometry";
import type { HairLod } from "./hair-lod";
import { baseHairS } from "./hair-motion";
import { strandContext } from "./strand-context";
import { growGroom, type HairGroom } from "./strand-groom";
import { strandsFromGroom, type StrandGeometry } from "./strand-ribbons";
import { strandMaterial } from "./strand-shading";
export { strandContext, type StrandContext } from "./strand-context";
export { groomFromJSON, groomToJSON, growGroom, type HairGroom } from "./strand-groom";
export { BABY_KIND, FRINGE_KIND, growStyledFringe } from "./strand-fringe";
export { strandsFromGroom, type StrandGeometry } from "./strand-ribbons";
export { strandMaterial } from "./strand-shading";

export interface StrandOptions { density?: number; seed?: number; lod?: HairLod; groom?: HairGroom | null }

/**
 * Fitas de fios sobre a base. `base` é a saída de buildHair(…, { base: true }) (usa a calota como área das raízes e as
 * duas partes como superfície de colisão). `volume` é o ajuste da pessoa (0,6–1,6) e multiplica o volume medido.
 * `opts.lod` escolhe o nível (padrão 1; 3 = sem fios); `opts.groom` reaproveita um penteado já crescido.
 */
export function strandGeometry(a: BodyAsset, c: Composed, hair: AvatarHair, base: HairBuild, volume = 1, opts: StrandOptions = {}): StrandGeometry | null {
  const lod = opts.lod ?? 1; if (lod === 3) return null;
  const ctx = strandContext(a, c, hair, base, volume); if (!ctx) return null;
  const groom = opts.groom ?? growGroom(ctx, hair, base, opts); if (!groom) return null;
  return strandsFromGroom(ctx, groom, lod, opts);
}

/**
 * Base + fios numa malha só (dois grupos, dois materiais): um SkinnedMesh, uma entrada no GLB exportado.
 * A base precisa ter normais (buildHair calcula); a tangente da base é preenchida (a base não usa).
 */
export function withStrands(base: HairBuild, st: StrandGeometry, color: string, opts: { earY?: number } = {}): { geometry: THREE.BufferGeometry; material: THREE.Material[] } {
  const g0 = base.geometry; const n0 = g0.getAttribute("position").count; const i0 = g0.getIndex()!.count;
  const cat = (name: string, extra: ArrayLike<number>, size: number, Ctor: Float32ArrayConstructor | Uint16ArrayConstructor) => {
    const a = g0.getAttribute(name) as THREE.BufferAttribute; const out = new Ctor(a.array.length + extra.length); out.set(a.array as ArrayLike<number>); out.set(extra, a.array.length);
    return new THREE.BufferAttribute(out, size);
  };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", cat("position", st.position, 3, Float32Array));
  g.setAttribute("normal", cat("normal", st.normal, 3, Float32Array));
  g.setAttribute("uv", cat("uv", st.uv, 2, Float32Array));
  g.setAttribute("color", cat("color", st.color, 4, Float32Array));
  g.setAttribute("skinIndex", cat("skinIndex", st.skinIndex, 4, Uint16Array));
  g.setAttribute("skinWeight", cat("skinWeight", st.skinWeight, 4, Float32Array));
  const tan = new Float32Array(n0 * 4 + st.tangent.length); for (let i = 0; i < n0; i++) { tan[i * 4] = 1; tan[i * 4 + 3] = 1; } tan.set(st.tangent, n0 * 4);
  g.setAttribute("tangent", new THREE.BufferAttribute(tan, 4));
  // distância da raiz (m) para o movimento (hair-motion.ts): base pela altura abaixo da orelha; fio pelo arco (uv.y·0,12)
  const hs = new Float32Array(n0 + st.uv.length / 2);
  if (opts.earY !== undefined) hs.set(baseHairS((g0.getAttribute("position") as THREE.BufferAttribute).array as ArrayLike<number>, n0, opts.earY));
  for (let i = 0; i < st.uv.length / 2; i++) hs[n0 + i] = st.uv[i * 2 + 1] * 0.12;
  g.setAttribute("hairS", new THREE.BufferAttribute(hs, 1));
  const idx = new Uint32Array(i0 + st.index.length); idx.set(g0.getIndex()!.array as ArrayLike<number>); for (let i = 0; i < st.index.length; i++) idx[i0 + i] = st.index[i] + n0;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.addGroup(0, i0, 0); g.addGroup(i0, st.index.length, 1);
  g.computeBoundingSphere();
  return { geometry: g, material: [base.material, strandMaterial(color, st.lod)] };
}
