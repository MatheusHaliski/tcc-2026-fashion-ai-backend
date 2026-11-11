/** FLAIR 3D MAKE UP (Road to Glory): tipos da API /api/flair/make-up (docs/flair/flair-3d/BASE_NUCLEOS.md). */
import type { MaquiagemEscolha, RegraObjetivo, RegraResultado } from "@/lib/flair/nucleos/types";
import type { Paleta } from "@/lib/flair/make-up/palette";

export interface MakeUpCarreira {
  nivel: number;
  prestigio: number;
  faltaParaProximo: number;
  desbloqueios: string[];
}

export interface BriefResumo {
  codigo: string;
  nivelMin: number;
  liberado: boolean;
  melhoresEstrelas: number;
}

export interface BriefLista {
  briefs: BriefResumo[];
}

export interface BriefDefinicao {
  codigo: string;
  nivelMin: number;
  regras: RegraObjetivo[];
  vagas: string[];
  areas: string[];
  paleta?: Paleta | null;
}

export interface MakeUpEntrega {
  cartas: Record<string, string>;
  maquiagem: Record<string, MaquiagemEscolha>;
}

export interface MakeUpResultado {
  pontos: number;
  estrelas: number;
  regras: RegraResultado[];
  prestigioGanho: number;
  carreira?: MakeUpCarreira | null;
}
