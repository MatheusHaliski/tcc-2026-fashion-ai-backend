/**
 * Cenas dinâmicas dos Desafios de Montagem e dos elencos: uma cena é dado (trilhos, elenco que anda neles, enfeites),
 * desenhada em canvas pelo motor (motor.ts, pintura.ts) na área 160 × 100, a mesma da arte do quebra-cabeça.
 */

/** Contexto 2D usado pelo motor (o do navegador; nos testes, um registrador de chamadas). */
export type Ctx = CanvasRenderingContext2D;

export interface Paleta {
  /** fundo de cima para baixo */
  fundo: [string, string];
  /** cor das linhas finas e do brilho geral */
  luz: string;
  /** uma ou duas cores de acento */
  acentos: string[];
}

export interface Tubo {
  largura: number;
  cor: string;
  /** opacidade do vidro por dentro (0 a 1) */
  vidro?: number;
}

export interface Fio {
  cor: string;
  largura: number;
  a?: number;
  tracejado?: number[];
}

export interface Pulso {
  n: number;
  periodo: number;
  cor: string;
  comprimento: number;
  fase?: number;
  sentido?: 1 | -1;
}

export interface Manga {
  de: number;
  ate: number;
  cor: string;
}

/** Caminho por onde o elenco anda. Aberto: o viajante surge e some em fade nas pontas (nunca aparece de repente). */
export interface Trilho {
  id: string;
  d: string;
  /** nível de profundidade (0 = mais ao fundo) */
  z?: number;
  tubo?: Tubo;
  fio?: Fio;
  /** trechos [de, até] (0 a 1) em que o trilho sobe um nível e passa por cima dos outros */
  pontes?: [number, number][];
  /** trilhos por cima dos quais este passa: o motor acha os cruzamentos e cria as pontes */
  sobre?: string[];
  /** trechos opacos por cima do viajante (ele passa por trás) */
  mangas?: Manga[];
  pulsos?: Pulso;
}

/** tangente: aponta para onde vai; perfil: de lado, espelhado quando anda para a esquerda; reto: em pé; rola: gira ao andar. */
export type Orienta = "tangente" | "perfil" | "reto" | "rola";

/** Um grupo de viajantes no mesmo ritmo, espaçados pelo trilho. */
export interface Grupo {
  trilho: string;
  formas: string[];
  cores: string[];
  n: number;
  /** segundos por volta */
  periodo: number;
  fase?: number;
  /** meia altura do viajante, em unidades da arte */
  escala: number;
  orienta?: Orienta;
  sentido?: 1 | -1;
  /** balanço lateral em graus (só em "reto") */
  balanco?: number;
}

/** Elemento que gira no lugar (engrenagem, carretel). */
export interface Giro {
  forma: string;
  cor: string;
  x: number;
  y: number;
  escala: number;
  periodo: number;
  sentido?: 1 | -1;
  z?: number;
}

export type Enfeite =
  | { k: "halo"; x: number; y: number; r: number; cor: string; a: number }
  | { k: "grade"; passo: number; cor: string; a: number; tipo: "pontos" | "linhas" | "diagonais" }
  | { k: "traco"; d: string; cor: string; largura: number; a: number; tracejado?: number[]; brilho?: boolean }
  | { k: "aneis"; x: number; y: number; r0: number; dr: number; n: number; cor: string; a: number }
  | { k: "poeira"; n: number; semente: number; cor: string; a: number; r: number }
  | { k: "forma"; forma: string; cor: string; x: number; y: number; escala: number; giro?: number; a?: number };

export interface Cena {
  id: string;
  paleta: Paleta;
  fundo: Enfeite[];
  trilhos: Trilho[];
  elenco: Grupo[];
  giros?: Giro[];
  frente?: Enfeite[];
  /** instante (s) do quadro parado, usado com movimento reduzido e nas miniaturas paradas */
  quadro: number;
}

export interface Viajante {
  x: number;
  y: number;
  /** radianos */
  giro: number;
  forma: string;
  cor: string;
  escala: number;
  z: number;
  alfa: number;
  espelho: boolean;
  trilho: string;
  u: number;
}
