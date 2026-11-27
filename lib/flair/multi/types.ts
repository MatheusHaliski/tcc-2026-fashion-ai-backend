/**
 * Contrato do multiplayer do FLAIR 3D (docs/flair/flair-3d/MULTIPLAYER.md): busca de adversários, convites e salas.
 * Espelha Flair3dAdversarios, Flair3dSalaVista, Flair3dSalaAssincrona e Flair3dSalaPlacar no servidor.
 */
export type Relacao = "TODOS" | "SIGO" | "ME_SEGUE" | "MUTUOS";
export type ModoSala = "ASSINCRONO" | "TURNOS" | "COOP";
export type EstadoSala = "CONVIDADO" | "JOGANDO" | "FECHADO" | "RECUSADO" | "CANCELADO" | "EXPIRADO";
export type Lado = "DE" | "PARA";

export interface FiltrosAdversario {
  q?: string;
  relacao?: Relacao;
  nivel?: string;
  estilo?: string;
  pais?: string;
  cidade?: string;
  ativo?: boolean;
  jogo?: string;
  comDeck?: boolean;
}

export interface Adversario {
  id: string;
  username: string;
  nome?: string | null;
  avatarUrl?: string | null;
  pais?: string | null;
  cidade?: string | null;
  nivel: string;
  nivelLabel: string;
  pontos: number;
  estilo?: string | null;
  ativo: boolean;
  temDeck?: boolean | null;
  relacao: "SIGO" | "ME_SEGUE" | "MUTUOS" | "NENHUMA";
  status: "DISPONIVEL" | "CONVITE_PENDENTE" | "EM_SALA";
  convidavel: boolean;
  motivo?: string | null;
}

export interface BuscaAdversarios {
  resultados: Adversario[];
  niveis: string[];
}

export interface PessoaDaSala {
  id: string;
  username: string;
  nome?: string | null;
  avatarUrl?: string | null;
}

export interface LadoAssincrono {
  terminou: boolean;
  pontos?: number | null;
  estrelas?: number | null;
}

export interface Assincrono {
  minhaPartida?: string | null;
  eu?: LadoAssincrono | null;
  outro?: LadoAssincrono | null;
}

/** Um turno julgado: o que cada lado fez e quanto valeu (Batalha: nota; Dress Fighter: golpe, dano e vida; Sports: valor e gols). */
export interface TurnoJulgado {
  turno: number;
  desafio?: string;
  round?: number;
  atacante?: Lado;
  gol?: boolean;
  vencedor: Lado | "EMPATE";
  de: Record<string, unknown>;
  para: Record<string, unknown>;
}

export interface Turnos {
  total: number;
  vagas: string[];
  minimo: number;
  repete: boolean;
  vez: number;
  esperando: boolean;
  outroLancou: boolean;
  meuDeck: string[];
  deckDoOutroPronto: boolean;
  meuLance?: Record<string, string> | null;
  usadas: string[];
  julgados: TurnoJulgado[];
  pontos: { de: number; para: number };
  encerrado: boolean;
  vencedor?: Lado | "EMPATE" | null;
  desafios?: string[];
}

export interface Sala {
  id: string;
  jogo: string;
  rodada?: string | null;
  modo: ModoSala;
  estado: EstadoSala;
  prazo: string;
  criadaEm?: string;
  voce: Lado;
  de: PessoaDaSala;
  para: PessoaDaSala;
  revancheDe?: string | null;
  resultado?: { de?: { pontos?: number; estrelas?: number }; para?: { pontos?: number; estrelas?: number }; motivo?: string } | null;
  vencedor?: Lado | "EMPATE" | null;
  semente?: number | null;
  modos?: ModoSala[];
  assincrono?: Assincrono;
  turnos?: Turnos;
}

export interface CaixaMulti {
  recebidos: Sala[];
  enviados: Sala[];
  ativas: Sala[];
  recentes: Sala[];
}

export interface Historico {
  placar: { vitorias: number; derrotas: number; empates: number };
  salas: Sala[];
}

export interface ConvitePedido {
  para: string;
  jogo: string;
  modo?: ModoSala;
  rodada?: string | null;
}
