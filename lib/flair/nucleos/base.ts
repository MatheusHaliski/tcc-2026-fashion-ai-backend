/**
 * Peças comuns aos arquivos dos núcleos: ações por tipo de núcleo, regras do deck e plateia de silhuetas. Cada núcleo
 * continua descrito no próprio arquivo (lib/flair/nucleos/<codigo>.ts); aqui só o que se repete entre eles.
 */
import type { DeckObrigatoria, DeckRegras, NucleoAcao, NucleoPersonagem } from "@/lib/flair/nucleos/types";

const SEMPRE: NucleoAcao[] = ["NAVEGAR", "TROCAR_ABA", "VESTIR", "GIRAR", "ZOOM", "POSAR", "ENTREGAR", "VER_OBJETIVO"];

/** Ações válidas: todas as comuns, "tirar" nos núcleos de cartas e "desfilar" onde a tabela permite. */
export function acoesDe(opts: { cartas: boolean; desfile: boolean }): NucleoAcao[] {
  const out = [...SEMPRE];
  if (opts.cartas) out.push("TIRAR");
  if (opts.desfile) out.push("DESFILAR");
  return out;
}

export function deckDe(tamanhoMax: number, ...obrigatorias: [string, number][]): DeckRegras {
  const lista: DeckObrigatoria[] = obrigatorias.map(([posicao, quantidade]) => ({ posicao, quantidade }));
  return { tamanhoMax, obrigatorias: lista, semDeck: false };
}

export const SEM_DECK: DeckRegras = { tamanhoMax: 0, obrigatorias: [], semDeck: true };

/** Fileira de silhuetas (plateia, passantes) num x fixo, ao longo de z — sempre ao lado do avatar. */
export function fileira(papel: string, x: number, zs: number[], cor: string, postura: NucleoPersonagem["postura"] = "em_pe"): NucleoPersonagem[] {
  return zs.map((z): NucleoPersonagem => ({ papel, tipo: "silhueta", pos: [x, 0, z], cor, escala: 0.9, giro: x < 0 ? 90 : -90, postura }));
}
