/** FLAIR Card Building Challenge, os cinco elencos: tipos da API /api/flair/elencos (docs/flair/flair-3d/BASE_NUCLEOS.md). */

export const ELENCO_CODIGOS = ["PRIMEIRO_ELENCO", "PALETA_ATELIE", "CASA_MARCA", "NOITE_ESTREIA", "ELENCO_LENDARIO"] as const;
export type ElencoCodigo = (typeof ELENCO_CODIGOS)[number];

export interface ElencoResumo {
  codigo: string;
  vagas: number;
  linhas: number;
  concluido: boolean;
  edicao: number | null;
}

export interface ElencoVaga {
  chave: string;
  posicao: string;
  coluna: number;
  linha: number;
}

export interface ElencoLinha {
  a: string;
  b: string;
}

/** QUIMICA, LINHAS_VERDES, LINHAS_POR (atributo), SEM_LINHA_VERMELHA (vaga opcional), CARTAS, MARCAS, NIVEL_CARTA (nivel). */
export interface ElencoRequisito {
  tipo: string;
  alvo?: number | null;
  atributo?: string;
  vaga?: string;
  nivel?: string;
}

export interface ElencoDefinicao {
  codigo: string;
  vagas: ElencoVaga[];
  linhas: ElencoLinha[];
  requisitos: ElencoRequisito[];
}

/** Nível do link: o servidor manda VERMELHA/LARANJA/VERDE; RED/ORANGE/GREEN (CbcLinks.Level) também valem. */
export type LinkNivel = "RED" | "ORANGE" | "GREEN";

export interface ElencoLink {
  a: string;
  b: string;
  forca: number;
  nivel: string;
  atributos: string[];
}

export interface RequisitoStatus {
  tipo: string;
  ok: boolean;
  valor?: number | string | null;
  alvo?: number | null;
}

export interface ElencoConferencia {
  links: ElencoLink[];
  quimicaCartas: Record<string, number>;
  quimica: number;
  requisitos: RequisitoStatus[];
  ok: boolean;
}

export interface ElencoEntregaResultado extends ElencoConferencia {
  edicao: number;
}
