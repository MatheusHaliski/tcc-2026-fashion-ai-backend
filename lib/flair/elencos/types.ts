/** FLAIR Card Building Challenge, os elencos em quebra-cabeça: tipos da API /api/flair/elencos (docs/flair/cbc/CINCO_ELENCOS.md). */

export interface ElencoResumo {
  codigo: string;
  /** número de peças (uma vaga por peça) */
  pecas: number;
  concluido: boolean;
  edicao: number | null;
}

/** Vaga = peça da imagem: a posição da carta ("ANY" = qualquer) e o que a carta precisa ter (color, style, occasion). */
export interface ElencoVaga {
  chave: string;
  posicao: string;
  pede?: Record<string, string[]>;
}

/** COR, ESTILO, OCASIAO (valor), CARTAS, MARCAS e NIVEL_CARTA (nivel). */
export interface ElencoRequisito {
  tipo: string;
  alvo?: number | null;
  valor?: string;
  nivel?: string;
}

export interface ElencoDefinicao {
  codigo: string;
  vagas: ElencoVaga[];
  requisitos: ElencoRequisito[];
}

export interface RequisitoStatus {
  tipo: string;
  ok: boolean;
  valor?: number | string | null;
  alvo?: number | null;
}

export interface ElencoConferencia {
  /** cada vaga: a carta posta encaixou a peça */
  pecas: Record<string, boolean>;
  completas: number;
  total: number;
  requisitos: RequisitoStatus[];
  ok: boolean;
}

export interface ElencoEntregaResultado extends ElencoConferencia {
  edicao: number;
}
