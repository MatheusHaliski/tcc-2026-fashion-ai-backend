/**
 * O ritmo da ação: cada passo do resultado fica na tela o tempo da sequência da cena dividido pelos passos, para a
 * cena terminar junto com a ação (a luta do Dress Fighter mostra os três rounds inteiros antes do resultado; antes,
 * 700 ms por passo cortavam a luta no meio). Nunca menos que PASSO_MS nem mais que 4 s por passo. Puro.
 */
import { PASSO_MS } from "@/lib/flair/nucleos/action-fx";
import { duracaoDaSequencia } from "@/lib/flair/nucleos/scene/director";
import { sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export const PASSO_MAXIMO_MS = 4000;

export function passoDaCena(codigo: NucleoCodigo, resultado: NucleoResultado, passos: number): number | undefined {
  if (passos <= 0) return undefined;
  const ms = (duracaoDaSequencia(sequenciaDoResultado(codigo, resultado)) * 1000) / passos;
  return Math.round(Math.min(PASSO_MAXIMO_MS, Math.max(PASSO_MS, ms)));
}
