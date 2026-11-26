/**
 * Elenco humano dos jogos FLAIR 3D (pedido da dona de 15/11/2026: "NPCs como avatares humanos do mesmo tipo do avatar da
 * pessoa"). Cada pessoa de cena é descrita aqui (sexo, corpo, altura, tom de pele, cabelo, rosto sintético e a roupa do
 * papel) e montada na cena com o mesmo corpo humano do avatar da pessoa (components/three/human-avatar.tsx, lib/avatar3d).
 *
 * O elenco sai da semente da partida: a mesma partida tem sempre as mesmas pessoas. A nota nunca depende de nada disto
 * (pele, corpo e rosto são só aparência). Ninguém é parecido com uma pessoa real: o rosto é pintado por regras, sem foto.
 * Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { AvatarHair } from "@/lib/avatar3d/model";
import type { BodyParams, BodySources, Sex } from "@/lib/avatar3d/body-spec";
import type { BodyInput } from "@/lib/avatar3d/human/compose";
import type { FaceStyle } from "@/lib/heist/looks";

export interface PessoaDoElenco {
  /** chave do molde (o corpo vestido montado uma vez) */
  chave: string;
  sexo: Sex;
  corpo: BodyInput;
  estatura: number;
  pele: string;
  cabelo: AvatarHair | null;
  rosto: FaceStyle;
  pecas: Look3dPiece[];
}

/** Tons de pele, do mais claro ao mais escuro: todos aparecem com a mesma chance. */
export const PELES = ["#ecc8b0", "#e6bc9f", "#c99470", "#a8714f", "#7f5038", "#5b3624", "#3f2519"] as const;
const CORES_DE_CABELO = ["#16110f", "#2c1e16", "#4a3020", "#6b4128", "#7a3a20", "#c49a62", "#ddd3c4"] as const;

const CABELO_BASE: AvatarHair = { present: true, color: "#2c1e16", top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", volume: 1 };
/** Cortes de cabelo de quem joga: curtos ou presos (o rabo e o coque não entram no molde: o médio liso faz as vezes). */
const CORTES: Partial<AvatarHair>[] = [
  { length: "short", texture: "straight" },
  { length: "buzz", texture: "straight", volume: 0.8 },
  { length: "short", texture: "coily", volume: 1.5 },
  { length: "short", texture: "wavy", volume: 1.1 },
  { length: "medium", texture: "curly", bottom: -10, volume: 1.35 },
  { length: "medium", texture: "straight", bottom: -8 },
];

const CHAVES: (keyof BodyParams)[] = ["stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "build"];

/** Corpo: só estatura e compleição informadas; o resto, o típico do sexo (como as pessoas do MET Gala Heist). */
export function corpoDe(sexo: Sex, estatura: number, compleicao: number): BodyInput {
  const base: BodyParams = sexo === "FEMININO"
    ? { stature: estatura, shoulderW: 0.19, chestW: 0.175, waistW: 0.15, hipW: 0.205, legLen: 0.53, armLen: 0.333, headH: 0.13, build: compleicao }
    : { stature: estatura, shoulderW: 0.205, chestW: 0.19, waistW: 0.165, hipW: 0.19, legLen: 0.53, armLen: 0.333, headH: 0.13, build: compleicao };
  const sources = Object.fromEntries(CHAVES.map((k) => [k, k === "stature" || k === "build" ? "user" : "default"])) as BodySources;
  return { sex: sexo, params: base, sources };
}

/** Número de 0 a 1 tirado da semente e de um rótulo (mesma entrada, mesmo número). */
export function sorteio(semente: number, rotulo: string): number {
  let h = (semente ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < rotulo.length; i++) h = Math.imul(h ^ rotulo.charCodeAt(i), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const escolher = <T,>(lista: readonly T[], k: number): T => lista[Math.min(lista.length - 1, Math.floor(k * lista.length))];

/** Semente da partida a partir do id dela (texto): o elenco fica preso à partida. */
export function sementeDoTexto(texto: string | null | undefined): number {
  return Math.floor(sorteio(7, texto ?? "") * 2 ** 31);
}

/** Rosto sintético: sobrancelha na cor do cabelo; maquiagem leve ou barba por fazer pela semente. */
function rostoDe(sexo: Sex, cabelo: string, k: number): FaceStyle {
  if (sexo === "FEMININO") return { lips: k < 0.5 ? "#a8505a" : "#8a3a42", brows: cabelo, liner: k < 0.3 ? 1 : 0, shadow: null, blush: k > 0.6 ? "#c9786e" : null, stubble: 0 };
  return { lips: "#9a5a4c", brows: cabelo, liner: 0, shadow: null, blush: null, stubble: Math.round(k * 6) / 10 };
}

/** Uma pessoa com a roupa dada: sexo, altura, compleição, pele e cabelo saem da semente. */
export function pessoaDaSemente(semente: number, rotulo: string, sexo: Sex, pecas: Look3dPiece[], faixa: [number, number] = [1.6, 1.9]): PessoaDoElenco {
  const r = (s: string) => sorteio(semente, `${rotulo}:${s}`);
  const estatura = Math.round((faixa[0] + (faixa[1] - faixa[0]) * r("altura") - (sexo === "FEMININO" ? 0.08 : 0)) * 100) / 100;
  const compleicao = Math.round((r("corpo") * 1.4 - 0.4) * 10) / 10;
  const pele = escolher(PELES, r("pele"));
  const corDoCabelo = escolher(CORES_DE_CABELO, r("cor"));
  const corte = escolher(CORTES, r("corte"));
  const cabelo: AvatarHair = { ...CABELO_BASE, ...corte, color: corDoCabelo };
  const corpo = corpoDe(sexo, estatura, compleicao);
  const chave = JSON.stringify([sexo, estatura, compleicao, pele, corDoCabelo, corte.length, corte.texture, pecas.map((p) => `${p.subcategory}:${p.colorHex}`)]);
  return { chave, sexo, corpo, estatura, pele, cabelo, rosto: rostoDe(sexo, corDoCabelo, r("rosto")), pecas };
}
