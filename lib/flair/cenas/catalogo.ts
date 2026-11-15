/**
 * Catálogo das cenas dinâmicas e de quem usa cada uma: os cinco elencos (pelo código) e os cenários dos Desafios de
 * Montagem (pelo nome do cenário). Cenário sem cena própria (cenário livre, cenário novo) usa a cena de reserva.
 * São dez cenas para vinte usos (cinco elencos e quinze cenários): cada elenco tem a sua; nos desafios, alguns cenários de tema próximo dividem a
 * mesma cena (ver docs/flair/cbc/CENAS_DINAMICAS.md).
 */
import { CORRIDA_DE_CONTAS } from "@/lib/flair/cenas/cenas/corrida-de-contas";
import { ESCADARIA } from "@/lib/flair/cenas/cenas/escadaria";
import { ESTEIRA } from "@/lib/flair/cenas/cenas/esteira";
import { LINHA_DE_CABIDES } from "@/lib/flair/cenas/cenas/linha-de-cabides";
import { RELOJOARIA } from "@/lib/flair/cenas/cenas/relojoaria";
import { RIO_DE_TECIDO } from "@/lib/flair/cenas/cenas/rio-de-tecido";
import { TEAR } from "@/lib/flair/cenas/cenas/tear";
import { TUNEIS_DE_COR } from "@/lib/flair/cenas/cenas/tuneis-de-cor";
import { TUNEIS_DE_MODA } from "@/lib/flair/cenas/cenas/tuneis-de-moda";
import { ZIGUE_ZAGUE } from "@/lib/flair/cenas/cenas/zigue-zague";
import type { Cena } from "@/lib/flair/cenas/tipos";

const TODAS = [TUNEIS_DE_COR, ZIGUE_ZAGUE, TUNEIS_DE_MODA, LINHA_DE_CABIDES, RELOJOARIA, RIO_DE_TECIDO, TEAR, ESCADARIA, ESTEIRA, CORRIDA_DE_CONTAS];

export const CENAS: Record<string, Cena> = Object.fromEntries(TODAS.map((c) => [c.id, c]));

export const CENA_RESERVA = TUNEIS_DE_COR;

/** Cena de cada elenco (cinco cenas diferentes). */
export const CENA_DO_ELENCO: Record<string, Cena> = {
  PRIMEIRO_ELENCO: LINHA_DE_CABIDES,
  PALETA_ATELIE: TUNEIS_DE_COR,
  CASA_MARCA: ZIGUE_ZAGUE,
  NOITE_ESTREIA: ESCADARIA,
  ELENCO_LENDARIO: RELOJOARIA,
};

/** Cena de cada cenário dos Desafios de Montagem. */
export const CENA_DO_CENARIO: Record<string, Cena> = {
  ipanema: RIO_DE_TECIDO,
  estagio: ESTEIRA,
  brecho: LINHA_DE_CABIDES,
  festival: ZIGUE_ZAGUE,
  casamento: TUNEIS_DE_MODA,
  paris: TEAR,
  gala: ESCADARIA,
  desfile: ESTEIRA,
  popup: ZIGUE_ZAGUE,
  primavera: TUNEIS_DE_MODA,
  armario: LINHA_DE_CABIDES,
  halloween: RELOJOARIA,
  carnaval: CORRIDA_DE_CONTAS,
  serra: TEAR,
  semana: TUNEIS_DE_COR,
};

export function cenaDoElenco(codigo: string): Cena {
  return CENA_DO_ELENCO[codigo] ?? CENA_RESERVA;
}

export function cenaDoCenario(cenario: string): Cena {
  return CENA_DO_CENARIO[cenario] ?? CENA_RESERVA;
}
