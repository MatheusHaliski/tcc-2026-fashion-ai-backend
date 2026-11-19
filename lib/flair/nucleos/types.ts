/**
 * FLAIR 3D, base dos 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md): tipos da API e do arquivo de cada núcleo.
 * A API devolve só códigos; os textos ficam nos catálogos de i18n (flair3d.nucleo.<CODIGO>.* e flair3d.ui.*).
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types-resultado";
import type { RetomadaSalva } from "@/lib/flair/nucleos/progresso";

export const NUCLEO_CODIGOS = [
  "PASSARELA",
  "DRESS_FIGHTER",
  "DRESS_THE_STAR",
  "PERSONAGEM_FILME",
  "ROAD_TO_GLORY",
  "FASHION_DETECTIVE",
  "BOUTIQUE_3D",
  "CLUBE_CORACAO",
  "FAVORITE_SINGER",
  "LABIRINTO",
  "PILOTO_FAVORITO",
  "AROUND_THE_WORLD",
  "SUPER_HEROI",
  "FASHION_SPORTS",
  "BATALHA_LOOKS",
] as const;
export type NucleoCodigo = (typeof NUCLEO_CODIGOS)[number];

/** Recursos de jogo: cartas FLAIR, zonas do editor, maquiagem e (no PERSONAGEM_FILME) a resposta entre opções. */
export type NucleoRecurso = "CARTAS" | "ZONAS" | "MAQUIAGEM" | "RESPOSTA";

/** Ações do personagem e da janela de recursos (tabela "Ações do personagem e comandos do controle"). */
export const NUCLEO_ACOES = [
  "NAVEGAR",
  "TROCAR_ABA",
  "VESTIR",
  "TIRAR",
  "GIRAR",
  "ZOOM",
  "POSAR",
  "DESFILAR",
  "ENTREGAR",
  "VER_OBJETIVO",
] as const;
export type NucleoAcao = (typeof NUCLEO_ACOES)[number];

/** Quem aparece na cena (seção "Os avatares de cada partida"). */
export type AvatarTipo = "PROPRIO" | "MODELO_CASA" | "OUTRO_JOGADOR" | "FIGURANTE";

export interface AvatarSolo {
  tipo: AvatarTipo;
  papel: string;
  quantidade: number;
}

export interface AvatarOnline {
  min: number;
  max: number;
  porTime?: number | null;
}

export interface NucleoAvatares {
  solo: AvatarSolo[];
  online: AvatarOnline | null;
}

export type Vaga = "SUP" | "INF" | "CAL" | "ACE" | "VES";
export type Acabamento = "FOSCO" | "BRILHANTE" | "METALICO" | "ESPELHADO";
export type AreaMaquiagem = "LABIOS" | "OLHOS" | "BOCHECHAS";

// ------------------------------------------------------------------ API

export interface NucleoResumo {
  codigo: NucleoCodigo;
  numero: number;
  recursos: NucleoRecurso[];
  acoes: NucleoAcao[];
}

export interface NucleoLista {
  nucleos: NucleoResumo[];
}

export interface RegraObjetivo {
  codigo: string;
  pontos: number;
}

export interface DeckObrigatoria {
  /** posição da carta (SUP, INF, CAL, ACE, VES); alternativas separadas por "|"; ANY = qualquer posição */
  posicao: string;
  quantidade: number;
}

export interface DeckRegras {
  /** nulo nos núcleos sem deck */
  tamanhoMax: number | null;
  obrigatorias: DeckObrigatoria[];
  semDeck: boolean;
  /** posições de carta que o jogo usa (as vagas do look); vazio ou ausente = qualquer uma */
  posicoes?: string[];
}

/** Uma rodada do jogo: o objetivo dela e, quando mudam, as zonas e as opções; `etapas` > 1 = um look por etapa. */
export interface NucleoRodada {
  codigo: string;
  objetivo: { codigo: string; regras: RegraObjetivo[] };
  zonas?: string[];
  opcoes?: string[];
  etapas?: number;
}

export interface NucleoDefinicao {
  codigo: NucleoCodigo;
  numero: number;
  objetivo: { codigo: string; regras: RegraObjetivo[] };
  /** as rodadas que o servidor oferece (a primeira é a padrão da tela) */
  rodadas?: NucleoRodada[];
  /** a rodada escolhida, quando a definição já é a dela (lib/flair/nucleos/rodadas.ts) */
  rodada?: string | null;
  recursos: NucleoRecurso[];
  vagas: string[];
  zonas: string[];
  areas: string[];
  opcoes: string[];
  acoes: NucleoAcao[];
  deck?: DeckRegras | null;
  avatares?: NucleoAvatares | null;
}

export interface NucleoPartida {
  id: string;
  nucleo: NucleoCodigo;
  status: string;
  semente: number;
  deck?: string[];
  participantes?: { tipo: AvatarTipo; papel: string; time?: string | null; userId?: string | null }[];
  rodada?: string | null;
  /** o que o jogo revela ao entrar: o tema, a estrela, a cena, o desafio, o oponente, a primeira etapa, o look-alvo */
  abertura?: Record<string, unknown> | null;
  /** partida retomada: o look que já estava vestido (vaga → carta) */
  vestidas?: Record<string, string> | null;
  /** partida retomada na preparação: o look em montagem que o servidor guardou */
  rascunho?: RetomadaSalva["rascunho"];
}

/**
 * A partida que ficou em andamento ("Continuar partida"): a abertura dela, o look vestido e o ponto em que parou — o
 * resultado de agora (EM_ACAO) ou a última entrega (ABERTA, rodada em etapas), refeitos pelo servidor.
 */
export interface NucleoRetomada extends RetomadaSalva {
  partida: NucleoPartida;
  vestidas: Record<string, string> | null;
  resultado: NucleoResultado | null;
  tentativa: NucleoResultado | null;
  atualizadaEm?: string;
}

export interface ZonaEscolha {
  cor?: string;
  acabamento?: string;
}

export interface MaquiagemEscolha {
  familia?: string;
  acabamento?: string;
}

export interface NucleoEntrega {
  cartas: Record<string, string>;
  zonas: Record<string, ZonaEscolha>;
  maquiagem: Record<string, MaquiagemEscolha>;
  resposta?: string | null;
}

export type {
  CartaPontos,
  EfeitoItem,
  EfeitosResposta,
  NucleoAcionamento,
  NucleoResultado,
  PartidaStatus,
  RegraResultado,
} from "@/lib/flair/nucleos/types-resultado";

// O arquivo do núcleo (cenário, personagens, recursos) fica em ./types-cena.
export type { V3, CenaProp, NucleoCena, NucleoPersonagem, AbaIcone, NucleoConfig } from "./types-cena";
