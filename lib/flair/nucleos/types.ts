/**
 * FLAIR 3D, base dos 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md): tipos da API e do arquivo de cada núcleo.
 * A API devolve só códigos; os textos ficam nos catálogos de i18n (flair3d.nucleo.<CODIGO>.* e flair3d.ui.*).
 */

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
}

export interface NucleoDefinicao {
  codigo: NucleoCodigo;
  numero: number;
  objetivo: { codigo: string; regras: RegraObjetivo[] };
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

export interface RegraResultado {
  codigo: string;
  ok: boolean;
  pontos: number;
}

export interface NucleoResultado {
  pontos: number;
  estrelas: number;
  resultado: string;
  regras: RegraResultado[];
  eventos: { codigo: string; valor?: unknown }[];
}

export interface EfeitoItem {
  codigo: string;
  valor: number | string;
}

export interface EfeitosResposta {
  efeitos: { cardId: string; itens: EfeitoItem[] }[];
}

// ------------------------------------------------------------------ arquivo do núcleo (cenário, personagens, recursos)

export type V3 = [number, number, number];

/** Prop do cenário como primitiva simples (unidades em metros; o avatar fica na origem, de frente para +z). */
export interface CenaProp {
  forma: "caixa" | "cilindro" | "esfera" | "plano";
  pos: V3;
  tam: V3;
  cor: string;
  emissiva?: boolean;
}

export interface NucleoCena {
  fundo: string;
  piso: string;
  luz: string;
  props: CenaProp[];
}

/** Personagem sem rosto: sempre atrás (z < 0) ou ao lado (|x| ≥ 1) do avatar, nunca na frente da roupa. */
export interface NucleoPersonagem {
  papel: string;
  tipo: "manequim" | "silhueta";
  pos: V3;
  cor: string;
  escala?: number;
  /** rotação em y, em graus (0 = de frente para a câmera) */
  giro?: number;
  /** como a silhueta aparece: em pé (padrão), sentada (plateia) ou busto de costura (manequim do ateliê) */
  postura?: "em_pe" | "sentada" | "busto";
}

export type AbaIcone =
  | "sup"
  | "inf"
  | "cal"
  | "ace"
  | "ves"
  | "zona"
  | "labios"
  | "olhos"
  | "bochechas"
  | "resposta";

export interface NucleoConfig {
  codigo: NucleoCodigo;
  numero: number;
  recursos: NucleoRecurso[];
  cena: NucleoCena;
  personagens: NucleoPersonagem[];
  /** abas padrão da janela de recursos (a definição da API, quando chega, manda nas vagas, zonas e áreas) */
  vagas: Vaga[];
  zonas: string[];
  areas: AreaMaquiagem[];
  opcoes: string[];
  acoes: NucleoAcao[];
  /** códigos das regras do objetivo mais simples (textos em flair3d.nucleo.<CODIGO>.rules.<REGRA>) */
  regras: string[];
  deck: DeckRegras;
  /**
   * protagonista: tipos aceitos (o primeiro é o padrão; MODELO_CASA também é a reserva de quem não tem avatar);
   * online: variações futuras (só dado nesta base). Os figurantes saem de `personagens`.
   */
  avatares: { protagonista: AvatarTipo[]; online: AvatarOnline | null };
  /** a luta/partida roda sozinha depois da entrega (DRESS_FIGHTER, FASHION_SPORTS) */
  automatico?: boolean;
}
