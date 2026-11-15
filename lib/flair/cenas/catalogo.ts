/**
 * Catálogo das cenas dinâmicas e de quem usa cada uma: os cinco elencos (pelo código) e os cenários dos Desafios de
 * Montagem (pelo nome do cenário). Cenário sem cena própria (cenário livre, cenário novo) usa a cena de reserva.
 */
import { TUNEIS_DE_COR } from "@/lib/flair/cenas/cenas/tuneis-de-cor";
import type { Cena } from "@/lib/flair/cenas/tipos";

export const CENAS: Record<string, Cena> = {
  [TUNEIS_DE_COR.id]: TUNEIS_DE_COR,
};

export const CENA_RESERVA = TUNEIS_DE_COR;

/** Cena de cada elenco. */
export const CENA_DO_ELENCO: Record<string, Cena> = {
  PALETA_ATELIE: TUNEIS_DE_COR,
};

/** Cena de cada cenário dos Desafios de Montagem. */
export const CENA_DO_CENARIO: Record<string, Cena> = {};

export function cenaDoElenco(codigo: string): Cena {
  return CENA_DO_ELENCO[codigo] ?? CENA_RESERVA;
}

export function cenaDoCenario(cenario: string): Cena {
  return CENA_DO_CENARIO[cenario] ?? CENA_RESERVA;
}
