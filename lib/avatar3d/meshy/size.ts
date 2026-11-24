/**
 * Tamanho escolhido no provador (P/M/G/GG, numeração, número do calçado) aplicado a um .glb da Meshy, POR REGIÃO,
 * com os fatores do manifesto (tamanhos.porPasso): não é um aumento uniforme da peça.
 *
 * - roupa: largura do tronco por altura (peito em cima, cintura no meio, quadril embaixo — cada uma com a diferença de
 *   tamanho daquela região, GarmentSpec.sizeFold), comprimento a partir do topo (barra e perna), manga ao longo do
 *   braço (comprimento) e em volta dele (largura do peito); a perna da calça ao longo da perna e em volta dela;
 * - calçado: comprimento e largura pelo número.
 *
 * O resultado continua passando pela colisão do glb-garment (largura, profundidade, normal): um tamanho menor que o
 * corpo cola na pele, nunca deixa a pele atravessar. É aproximação visual RELATIVA ao corpo do avatar
 * (RELATIVE_VISUAL_APPROXIMATION): sem alegação de caimento, e as medidas do avatar não mudam.
 */
import * as THREE from "three";
import type { GarmentSpec } from "../human/garments";
import type { BodyFrame } from "../human/glb-garment/frame";
import type { FootAnchor } from "./body-anchors";
import type { MeshyManifest, MeshySizes } from "./manifest";
import { GRIDS } from "@/lib/tryon/sizes";

export const SIZE_CONVENTION = { sizeVariants: "RELATIVE_VISUAL_APPROXIMATION", fitClaim: "NONE", avatarMeasurementsChanged: false } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Peça em escala real (motor Blender, `medidaReal`): ela já É o tamanho gerado; o tamanho escolhido entra como a
 * diferença para ele, em tamanhos da grade (GG escolhido de uma peça M = +2), nunca relativa ao corpo do avatar.
 * Sem rótulo, sem tamanho gerado ou fora da grade: 0 (a peça como foi gerada).
 */
export function generatedSizeShift(m: Pick<MeshyManifest, "tamanhoGerado" | "tamanhos"> | null, label?: string | null): number {
  const grid = m?.tamanhos.grade ? GRIDS[m.tamanhos.grade].map((o) => o.label) : null;
  if (!grid || !m?.tamanhoGerado || !label) return 0;
  const from = grid.indexOf(m.tamanhoGerado), to = grid.indexOf(label);
  return from < 0 || to < 0 ? 0 : to - from;
}

/** Passos por região (do GarmentSpec já com o tamanho), limitados pela faixa do manifesto. */
export function regionSteps(spec: GarmentSpec, sizes: MeshySizes) {
  const [lo, hi] = sizes.limite, fold = spec.sizeFold, all = spec.sizeSteps ?? 0;
  const pick = (v: number | undefined) => clamp(Number.isFinite(v) ? (v as number) : all, lo, hi);
  return fold ? { chest: pick(fold.chest), waist: pick(fold.waist), hip: pick(fold.hip), length: pick(fold.length) }
    : { chest: pick(all), waist: pick(all), hip: pick(all), length: pick(all) };
}

/** Escala do calçado por eixo: comprimento do pé com a folga do bico, largura pelo menos a do pé, e o número. */
export function shoeScale(foot: FootAnchor, len: number, wide: number, m: MeshyManifest, steps: number): THREE.Vector3 {
  const st = clamp(Number.isFinite(steps) ? steps : 0, m.tamanhos.limite[0], m.tamanhos.limite[1]), f = m.tamanhos.porPasso;
  const sLen = (foot.length * 1.06 * (1 + f.comprimento * st)) / len;
  const sWide = Math.min(1.35 * sLen, Math.max(sLen, (foot.width * 1.08) / wide)) * (1 + f.largura * st);
  return new THREE.Vector3(sWide, sLen, sLen);
}

/** Interpola a largura do tronco por altura: peito acima do Spine2, cintura no Spine, quadril abaixo do quadril. */
function torsoSteps(y: number, f: BodyFrame, s: ReturnType<typeof regionSteps>) {
  const chestY = f.joint("Spine2").y, waistY = f.joint("Spine").y, hipY = (f.joint("LeftUpLeg").y + f.joint("RightUpLeg").y) / 2;
  if (y >= chestY) return s.chest;
  if (y >= waistY) return s.waist + ((y - waistY) / Math.max(1e-3, chestY - waistY)) * (s.chest - s.waist);
  if (y >= hipY) return s.hip + ((y - hipY) / Math.max(1e-3, waistY - hipY)) * (s.waist - s.hip);
  return s.hip;
}

/** Centro do tronco em z por faixa de 2 cm (em x o eixo do corpo é 0). */
function centerZ(f: BodyFrame) {
  const cache = new Map<number, number>();
  return (y: number) => {
    const b = Math.round(y / 0.02);
    if (!cache.has(b)) {
      let z0 = Infinity, z1 = -Infinity;
      for (let v = 0; v < f.n; v++) if (f.group[v] === 1 && Math.abs(f.pos[v * 3 + 1] - b * 0.02) < 0.02) { z0 = Math.min(z0, f.pos[v * 3 + 2]); z1 = Math.max(z1, f.pos[v * 3 + 2]); }
      cache.set(b, z0 === Infinity ? 0 : (z0 + z1) / 2);
    }
    return cache.get(b)!;
  };
}

/** Membro: ao longo do eixo (pivô → ponta) por `along`, em volta dele por `around`. */
function scaleLimb(p: Float32Array, v: number, pivot: THREE.Vector3, dir: THREE.Vector3, along: number, around: number) {
  const q = new THREE.Vector3(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).sub(pivot);
  const t = q.dot(dir), radial = q.addScaledVector(dir, -t).multiplyScalar(around);
  const out = radial.addScaledVector(dir, Math.max(0, t) * along + Math.min(0, t)).add(pivot);
  p[v * 3] = out.x; p[v * 3 + 1] = out.y; p[v * 3 + 2] = out.z;
}

/**
 * Aplica o tamanho por região na peça já encaixada (`pos` e `part` do align.ts: 0 tronco, ±1 manga, ±2 perna).
 * Devolve os fatores usados (diagnóstico e testes).
 */
export function applyRegionSize(pos: Float32Array, part: Int8Array, f: BodyFrame, spec: GarmentSpec, sizes: MeshySizes) {
  const s = regionSteps(spec, sizes), k = sizes.porPasso;
  const used = { chest: 1 + k.largura * s.chest, waist: 1 + k.largura * s.waist, hip: 1 + k.largura * s.hip, length: 1 + k.comprimento * s.length, sleeve: 1 + k.manga * s.length };
  if (Object.values(s).every((x) => !x)) return used;
  let top = -Infinity; for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  const cz = centerZ(f), floor = Math.min(f.joint("LeftFoot").y, f.joint("RightFoot").y) - 0.06;
  const limbs = new Map<number, [THREE.Vector3, THREE.Vector3]>([
    [1, [f.joint("LeftArm"), f.joint("LeftHand")]], [-1, [f.joint("RightArm"), f.joint("RightHand")]],
    [2, [f.joint("LeftUpLeg"), f.joint("LeftFoot")]], [-2, [f.joint("RightUpLeg"), f.joint("RightFoot")]],
  ]);
  for (let v = 0; v < part.length; v++) {
    const label = part[v], limb = limbs.get(label);
    if (limb) {
      const dir = limb[1].clone().sub(limb[0]).normalize(), arm = Math.abs(label) === 1;
      scaleLimb(pos, v, limb[0], dir, arm ? used.sleeve : used.length, 1 + k.largura * (arm ? s.chest : s.hip));
      continue;
    }
    const y = pos[v * 3 + 1], kw = 1 + k.largura * torsoSteps(y, f, s), c = cz(y);
    pos[v * 3] *= kw; pos[v * 3 + 2] = c + (pos[v * 3 + 2] - c) * kw;
    pos[v * 3 + 1] = top - (top - y) * used.length;
  }
  // mais comprida que a perna: a barra acumula no chão em vez de atravessá-lo
  for (let i = 1; i < pos.length; i += 3) if (pos[i] < floor) pos[i] = floor + (pos[i] - floor) * 0.1;
  return used;
}

/** Folga radial de um passo (perímetro do passo ÷ 2π): letras 6 cm, numeração 4 cm (lib/tryon/sizes.ts). */
const RADIAL = { letter: 6 / (2 * Math.PI) / 100, numeric: 4 / (2 * Math.PI) / 100 };

/**
 * A mesma peça sem a parte comum do tamanho na folga (applySize soma o passo em todas as regiões): o encaixe pela
 * largura dos ombros/cós usa esta, e o tamanho entra só por região (applyRegionSize), não como escala uniforme.
 */
export function unsizedSpec(spec: GarmentSpec, lower: boolean): GarmentSpec {
  const fold = spec.sizeFold; if (!fold) return spec;
  const common = Math.min(fold.chest, fold.waist, fold.hip), r = lower ? RADIAL.numeric : RADIAL.letter;
  return { ...spec, ease: Math.max(0.0015, spec.ease - r * common), sizeFold: { ...fold, length: 0 } };
}
