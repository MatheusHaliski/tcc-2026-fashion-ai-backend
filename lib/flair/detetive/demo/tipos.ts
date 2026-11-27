/**
 * A demonstração jogável do Fashion Detective (rota /flair/3d/detective/demo): uma sala com colisão, uma porta trancada,
 * uma gaveta com a chave, um armário com munição, itens no chão e três vigias que patrulham, perseguem e atacam. Tudo
 * simulado no navegador, sem servidor: serve para a dona testar movimento, combate e interação antes de o caso de
 * verdade (decidido no servidor) ganhar o mesmo controle. Tipos e números do jogo. Puro.
 *
 * Coordenadas: x para a direita, z para a câmera (o fundo da sala é -z); giro em radianos, 0 = olhando para +z.
 */

export type ArmaId = "MAOS" | "PISTOLA" | "LEQUE" | "LAQUE" | "KIT";

export interface Ponto {
  x: number;
  z: number;
}

/** Caixa no chão (paredes e móveis): de x0 a x1 e de z0 a z1. */
export interface Caixa {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type ModoDoVigia = "PATRULHA" | "PERSEGUE" | "PROCURA" | "ATACA" | "FERIDO" | "ATORDOADO" | "ABATIDO";

export interface Vigia {
  id: string;
  x: number;
  z: number;
  giro: number;
  vida: number;
  modo: ModoDoVigia;
  /** segundos no modo atual */
  noModo: number;
  rota: Ponto[];
  alvoDaRota: number;
  /** onde viu a pessoa pela última vez */
  visto: Ponto | null;
  /** tempo até poder golpear de novo */
  recarga: number;
  /** já golpeou neste ataque */
  golpeou: boolean;
  /** abatido há tanto tempo que sumiu da sala */
  sumiu: boolean;
}

export interface Projetil {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** metros que ainda pode voar */
  resta: number;
}

export type TipoDeEfeito = "FAISCA" | "BRILHO" | "TECIDO" | "NUVEM" | "CURA";

export interface Efeito {
  id: number;
  tipo: TipoDeEfeito;
  x: number;
  z: number;
  /** segundos de vida que já passaram */
  t: number;
}

export type Interativo =
  | { id: "PORTA"; tipo: "PORTA"; aberta: boolean }
  | { id: string; tipo: "GAVETA" | "ARMARIO"; aberta: boolean }
  | { id: string; tipo: "ITEM"; item: "KIT" | "CARRETEL" | "DOSSIE"; coletado: boolean };

export interface Municao {
  /** alfinetes no pente e na reserva */
  pente: number;
  reserva: number;
  laque: number;
  kits: number;
}

export interface Jogador {
  x: number;
  z: number;
  giro: number;
  vida: number;
  arma: ArmaId;
  municao: Municao;
  chave: boolean;
  /** segundos até poder atacar ou disparar de novo */
  recarga: number;
  /** recarregando a pistola: segundos que faltam (0 = não) */
  recarregando: number;
  /** a última ação, para a animação: o que foi e há quanto tempo */
  gesto: { tipo: "DISPARO" | "GOLPE" | "RECUO" | "CURA" | "SPRAY"; t: number } | null;
  /** invulnerável por um instante depois de levar golpe */
  folga: number;
  andando: boolean;
  correndo: boolean;
}

export type Fim = "PEGA" | "RESOLVIDO" | null;

export interface EstadoDaDemo {
  t: number;
  jogador: Jogador;
  vigias: Vigia[];
  interativos: Interativo[];
  projeteis: Projetil[];
  efeitos: Efeito[];
  /** contador para os ids de projéteis e efeitos */
  proximoId: number;
  fim: Fim;
}

/** Entrada de um passo: o vetor de andar já no chão (x, z), correr, mirar e as ações que apertaram neste passo. */
export interface EntradaDaDemo {
  mover: Ponto;
  correr: boolean;
  mirando: boolean;
  disparar?: boolean;
  interagir?: boolean;
  recarregar?: boolean;
}

/** O que aconteceu no passo, para o aviso curto, o som e a câmera (tremor, flash). */
export type EventoDaDemo =
  | { tipo: "DANO_NO_JOGADOR"; dano: number }
  | { tipo: "ACERTO"; vigia: string; abatido: boolean }
  | { tipo: "SECO" }
  | { tipo: "RECARGA_FEITA" }
  | { tipo: "SEM_RESERVA" }
  | { tipo: "TRANCADA" }
  | { tipo: "ABRIU"; id: string }
  | { tipo: "PEGOU"; item: "CHAVE" | "MUNICAO" | "KIT" | "CARRETEL" | "DOSSIE" }
  | { tipo: "CUROU"; vida: number }
  | { tipo: "VISTO"; vigia: string }
  | { tipo: "FIM"; fim: Exclude<Fim, null> };
