/**
 * Arquivo de cada núcleo do FLAIR 3D: cenário, personagens de cena, abas de recurso e a configuração do jogo na tela.
 * Os tipos da API ficam em ./types, que reexporta estes.
 */
import type { AreaMaquiagem, AvatarOnline, AvatarTipo, DeckRegras, NucleoAcao, NucleoCodigo, NucleoRecurso, Vaga } from "./types";

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
