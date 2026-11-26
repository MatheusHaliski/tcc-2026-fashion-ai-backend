/**
 * ACERVO — luz do ambiente (exercício 07): tipo de iluminação (FK para tipos_iluminacao) e temperatura de cor em kelvin,
 * gravados no ambiente. A cena 3D só usa a luz confirmada pelo GET do acervo; o ambiente legado (sem tipo nem kelvin)
 * continua com a luz padrão de antes, sem mudar nada no que já existia.
 */
import { LUZ_FRIA } from "./cena/materiais";
import type { AcervoIluminacao } from "./types";

/** a mesma faixa do serviço (AcervoLightingWriter) e do CHECK ck_acervo_ambientes_kelvin */
export const KELVIN_MIN = 2700;
export const KELVIN_MAX = 6500;
export const KELVIN_PASSO = 100;

/** temperatura típica de cada tipo, usada quando o ambiente tem o tipo mas não o kelvin */
const KELVIN_DO_TIPO: Record<string, number> = { QUENTE: 2700, NEUTRA: 4000, FRIA: 6500, NATURAL: 5500 };

/** intensidade [ambiente, direcional, pontual] por tipo: a natural vem da janela; a quente se concentra no pendente */
const INTENSIDADE_DO_TIPO: Record<string, [number, number, number]> = {
  QUENTE: [0.75, 1.1, 10],
  NEUTRA: [0.9, 1.6, 8],
  FRIA: [1.05, 1.6, 7],
  NATURAL: [1, 2.4, 4],
};
const INTENSIDADE_SEM_TIPO: [number, number, number] = [0.9, 1.7, 9];

export function kelvinValido(kelvin: number): boolean {
  return Number.isInteger(kelvin) && kelvin >= KELVIN_MIN && kelvin <= KELVIN_MAX;
}

/** Cor da luz de um corpo negro na temperatura dada (aproximação de Tanner Helland), em hex maiúsculo. */
export function corDoKelvin(kelvin: number): string {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const hex = (v: number) => Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

export interface LuzDaCena {
  ambiente: number;
  direcional: number;
  corDirecional: string;
  pontual: number;
  corPontual: string;
}

/** Sem tipo nem kelvin gravados: a luz de antes do exercício 07 (quente em Meu espaço, fria no Dream Space). */
export function luzPadrao(dream: boolean): LuzDaCena {
  return {
    ambiente: dream ? 1.25 : 0.9,
    direcional: dream ? 1.4 : 1.7,
    corDirecional: "#FFFFFF",
    pontual: dream ? 6 : 9,
    corPontual: dream ? LUZ_FRIA : "#FFD9A0",
  };
}

/** As luzes da cena para a luz gravada no ambiente: o kelvin dá a cor; o tipo dá a intensidade (e o kelvin típico). */
export function luzDaCena(iluminacao: AcervoIluminacao | null | undefined, dream: boolean): LuzDaCena {
  const tipo = iluminacao?.tipo?.codigo ?? null;
  const kelvin = iluminacao?.temperaturaKelvin ?? (tipo ? KELVIN_DO_TIPO[tipo] ?? null : null);
  if (!tipo && kelvin === null) return luzPadrao(dream);
  const [ambiente, direcional, pontual] = (tipo && INTENSIDADE_DO_TIPO[tipo]) || INTENSIDADE_SEM_TIPO;
  const cor = corDoKelvin(kelvin ?? KELVIN_DO_TIPO.NEUTRA);
  return {
    ambiente: dream ? ambiente * 1.2 : ambiente,
    direcional,
    corDirecional: cor,
    pontual: dream ? pontual * 0.7 : pontual,
    corPontual: cor,
  };
}
