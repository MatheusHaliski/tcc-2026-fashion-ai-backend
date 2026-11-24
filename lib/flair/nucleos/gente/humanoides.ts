/**
 * Humanoides prontos das pessoas de cena: modelos de pessoas com esqueleto baixados do Sketchfab (licença CC BY 4.0,
 * crédito em docs/flair/flair-3d/ASSETS_3D.md), reduzidos para cerca de 10 mil triângulos. Entram no lugar do corpo
 * leve de quem está perto da câmera e não tem o corpo inteiro do FashionAI. Aqui ficam o catálogo, a escolha do modelo
 * de cada pessoa, os nomes dos ossos nos dois esqueletos (Mixamo e Renderpeople) e a pose: para onde cada braço e cada
 * perna aponta, tirada da mesma pose do corpo leve (leve.ts), para as reações continuarem as mesmas. Puro.
 */
import type { Sex } from "@/lib/avatar3d/body-spec";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import { sorteio } from "@/lib/flair/nucleos/gente/elenco";
import type { PoseLeve } from "@/lib/flair/nucleos/gente/leve";

export interface Humanoide {
  slug: string;
  sexo: Sex;
  title: string;
  author: string;
  license: "CC BY 4.0";
  source: string;
  triangles: number;
  /** modelo de uniforme: só serve a quem tem este papel na chave (o segurança não senta na plateia) */
  so?: RegExp;
}

const SKETCHFAB = "https://sketchfab.com/3d-models/";
export const HUMANOIDES: readonly Humanoide[] = [
  { slug: "eric", sexo: "MASCULINO", title: "Eric Rigged 001 - Rigged 3D Business Man", author: "Renderpeople", license: "CC BY 4.0", source: `${SKETCHFAB}eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f`, triangles: 10270 },
  { slug: "carla", sexo: "FEMININO", title: "Carla Rigged 001 - Rigged 3D Business Women", author: "Renderpeople", license: "CC BY 4.0", source: `${SKETCHFAB}carla-rigged-001-rigged-3d-business-women-acf520f450d14dd799f98a6fede3edf5`, triangles: 9993 },
  { slug: "claudia", sexo: "FEMININO", title: "Claudia Rigged 002 - 3D Rigged Business Women", author: "Renderpeople", license: "CC BY 4.0", source: `${SKETCHFAB}claudia-rigged-002-3d-rigged-business-women-c659bd0accab47c6bbe390cf822a2b92`, triangles: 10745 },
  { slug: "seguranca", sexo: "MASCULINO", so: /seguran|vigia|guard|porteiro/i, title: "Security Guard – Rigged 3D Model", author: "Q.SARDOR", license: "CC BY 4.0", source: `${SKETCHFAB}security-guard-rigged-3d-model-1e3307732bbf4453b30f021bfec5bcaf`, triangles: 10222 },
];

export const urlDoHumanoide = (slug: string): string => `/flair/3d/gente/${slug}.glb`;

/** O modelo de uma pessoa: do sexo dela, sorteado pela chave (a mesma pessoa é sempre o mesmo modelo). */
export function humanoideDaPessoa(chave: string, sexo: Sex, catalogo: readonly Humanoide[] = HUMANOIDES): Humanoide | null {
  const dePapel = catalogo.find((h) => h.so?.test(chave));
  if (dePapel) return dePapel;
  const comuns = catalogo.filter((h) => !h.so);
  const doSexo = comuns.filter((h) => h.sexo === sexo);
  const opcoes = doSexo.length ? doSexo : comuns;
  return opcoes.length ? opcoes[Math.floor(sorteio(7, chave) * opcoes.length) % opcoes.length] : null;
}

/**
 * Quantos humanoides a cena mostra ao mesmo tempo (os mais perto da câmera entre quem não tem o corpo inteiro), pelo
 * número de corpos inteiros que a qualidade em uso permite: 0 = qualidade baixa, 1 = média, mais = alta.
 */
export function humanoidesDaCena(corposInteiros: number): number {
  return corposInteiros <= 0 ? 3 : corposInteiros === 1 ? 5 : 8;
}

export const MEMBROS = ["bracoE", "antebracoE", "maoE", "bracoD", "antebracoD", "maoD", "coxaE", "canelaE", "peE", "coxaD", "canelaD", "peD"] as const;
export type Membro = (typeof MEMBROS)[number];

/** O nome de cada osso nos esqueletos Mixamo (`mixamorigLeftArm`) e Renderpeople (`upperarm_l`), como o three os lê. */
export const OSSOS: Record<Membro, RegExp> = {
  bracoE: /(LeftArm|^upperarm_l)(_\d+)?$/, antebracoE: /(LeftForeArm|^lowerarm_l)(_\d+)?$/, maoE: /(LeftHand|^hand_l)(_\d+)?$/,
  bracoD: /(RightArm|^upperarm_r)(_\d+)?$/, antebracoD: /(RightForeArm|^lowerarm_r)(_\d+)?$/, maoD: /(RightHand|^hand_r)(_\d+)?$/,
  coxaE: /(LeftUpLeg|^upperleg_l)(_\d+)?$/, canelaE: /(LeftLeg|^lowerleg_l)(_\d+)?$/, peE: /(LeftFoot|^foot_l)(_\d+)?$/,
  coxaD: /(RightUpLeg|^upperleg_r)(_\d+)?$/, canelaD: /(RightLeg|^lowerleg_r)(_\d+)?$/, peD: /(RightFoot|^foot_r)(_\d+)?$/,
};

type V3 = [number, number, number];
/** Para onde cada osso aponta, no espaço da pessoa (x = a esquerda dela, y = para cima, z = a frente). */
export interface PoseHumana {
  direcoes: Record<Exclude<Membro, "maoE" | "maoD" | "peE" | "peD">, V3>;
  /** quanto o corpo desce (sentada), sobe (pulo) e se inclina para a frente (rad) */
  desce: number;
  pulo: number;
  inclina: number;
}

/** Quanto o quadril desce para sentar, por metro de altura da pessoa. */
export const ASSENTO_POR_ALTURA = 0.25;
const UMA_MAO = new Set<Motion>(["talk", "drink", "phone", "photo", "point"]);
const ANDANDO = new Set<Motion>(["walk", "run", "sneak", "queue"]);

/** Braço pendurado do ombro girado `angulo` (0 = ao lado do corpo; negativo = para a frente e para cima), como em leve.ts. */
const braco = (lado: 1 | -1, angulo: number, abre = 0.12): V3 => [lado * abre, -Math.cos(angulo), -Math.sin(angulo)];

export function poseHumana(anim: Motion, velocidade: number, leve: PoseLeve, t: number, fase = 0): PoseHumana {
  const passo = ANDANDO.has(anim) || velocidade > 0.15 ? Math.sin(t * (anim === "run" ? 10 : 6.5) + fase * 6) : 0;
  const amplitude = anim === "run" ? 0.7 : 0.42;
  const b = leve.bracos;
  const bE = b !== 0 ? b : passo * amplitude * 0.8;
  const bD = b !== 0 ? b : -passo * amplitude * 0.8;
  const direcoes: PoseHumana["direcoes"] = {
    bracoE: braco(1, bE), antebracoE: braco(1, bE - 0.22, 0.06),
    bracoD: braco(-1, bD), antebracoD: braco(-1, bD - 0.22, 0.06),
    coxaE: [0.03, -Math.cos(passo * amplitude), Math.sin(passo * amplitude)],
    canelaE: [0, -Math.cos(passo * amplitude - Math.max(0, -passo) * 0.7), Math.sin(passo * amplitude - Math.max(0, -passo) * 0.7)],
    coxaD: [-0.03, -Math.cos(-passo * amplitude), Math.sin(-passo * amplitude)],
    canelaD: [0, -Math.cos(-passo * amplitude - Math.max(0, passo) * 0.7), Math.sin(-passo * amplitude - Math.max(0, passo) * 0.7)],
  };
  if (leve.sentada) {
    direcoes.coxaE = [0.09, -0.08, 1];
    direcoes.coxaD = [-0.09, -0.08, 1];
    direcoes.canelaE = [0, -1, 0.06];
    direcoes.canelaD = [0, -1, 0.06];
    if (b === 0) {
      // mãos no colo
      direcoes.bracoE = [0.1, -1, 0.28];
      direcoes.bracoD = [-0.1, -1, 0.28];
      direcoes.antebracoE = [-0.18, -0.35, 1];
      direcoes.antebracoD = [0.18, -0.35, 1];
    }
  } else if (b === 0 && UMA_MAO.has(anim)) {
    // conversa, bebe, fotografa, aponta: a mão direita sobe à frente do peito (ou o braço estica, apontando)
    const mexe = anim === "talk" ? Math.sin(t * 2.2 + fase * 5) * 0.12 : 0;
    direcoes.bracoD = anim === "point" ? [-0.1, -0.15, 1] : [-0.16, -0.92, 0.3];
    direcoes.antebracoD = anim === "point" ? [-0.05, -0.05, 1] : [0.22, 0.55 + mexe, 0.8];
  }
  return { direcoes, desce: leve.sentada ? ASSENTO_POR_ALTURA : 0, pulo: leve.pulo, inclina: leve.inclina };
}
