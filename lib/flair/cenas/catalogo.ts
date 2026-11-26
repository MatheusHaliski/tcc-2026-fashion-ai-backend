/**
 * Catálogo das cenas dinâmicas e de quem usa cada uma: os cinco elencos (pelo código) e os cenários dos Desafios de
 * Montagem (pelo nome do cenário). Cenário sem cena própria (cenário livre, cenário novo) usa a cena de reserva.
 * São dez cenas para vinte usos (cinco elencos e quinze cenários): cada cena aparece uma vez como é e uma vez como
 * variante (outra luz e espelhada, ver variante.ts), de modo que nenhum uso repete o desenho de outro
 * (ver docs/flair/cbc/CENAS_DINAMICAS.md).
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
import { variar } from "@/lib/flair/cenas/variante";

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

/** Cena de cada cenário dos Desafios de Montagem: metade como é, metade como variante de uma cena de elenco. */
export const CENA_DO_CENARIO: Record<string, Cena> = {
  ipanema: RIO_DE_TECIDO,
  estagio: ESTEIRA,
  casamento: TUNEIS_DE_MODA,
  paris: TEAR,
  carnaval: CORRIDA_DE_CONTAS,
  semana: variar(TUNEIS_DE_COR, { nome: "semana", matiz: 200, espelho: true }),
  festival: variar(ZIGUE_ZAGUE, { nome: "festival", matiz: 70, espelho: true }),
  primavera: variar(TUNEIS_DE_MODA, { nome: "primavera", matiz: -60, espelho: true }),
  brecho: variar(LINHA_DE_CABIDES, { nome: "brecho", matiz: 35, espelho: true }),
  halloween: variar(RELOJOARIA, { nome: "halloween", matiz: 150, espelho: true }),
  armario: variar(RIO_DE_TECIDO, { nome: "armario", matiz: 190, espelho: true }),
  serra: variar(TEAR, { nome: "serra", matiz: 90, espelho: true }),
  gala: variar(ESCADARIA, { nome: "gala", matiz: 200, espelho: true }),
  desfile: variar(ESTEIRA, { nome: "desfile", matiz: 160, espelho: true }),
  popup: variar(CORRIDA_DE_CONTAS, { nome: "popup", matiz: -45, espelho: true }),
};

export function cenaDoElenco(codigo: string): Cena {
  return CENA_DO_ELENCO[codigo] ?? CENA_RESERVA;
}

/** A tela sabe desenhar este cenário? "livre" é a cena neutra (a reserva), desenhada de propósito. */
export const temCenaDoCenario = (cenario: string): boolean => cenario === "livre" || Object.hasOwn(CENA_DO_CENARIO, cenario);

export function cenaDoCenario(cenario: string): Cena {
  return CENA_DO_CENARIO[cenario] ?? CENA_RESERVA;
}
