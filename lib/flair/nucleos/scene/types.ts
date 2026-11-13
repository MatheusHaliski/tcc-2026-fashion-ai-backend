/**
 * FLAIR 3D, cenário de cada jogo (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 3): descrição pura da sala. A sala é
 * uma lista de partes (primitivas e extrusões, em metros; o avatar fica na origem, de frente para +z) com materiais,
 * zonas e luzes. O construtor 3D (components/flair/nucleos/scene) só desenha o que está descrito aqui, e o orçamento
 * (budget.ts) conta triângulos e materiais da mesma descrição.
 */
import type { NucleoCodigo, NucleoPersonagem, V3 } from "@/lib/flair/nucleos/types";

/** Orçamento de cada cenário no navegador e limites das animações. */
export const ORCAMENTO = {
  triangulos: 60000,
  materiais: 12,
  texturaPx: 1024,
  luzesProprias: 3,
  clipSegundos: 4,
} as const;

export type Textura =
  | "madeira"
  | "marmore"
  | "tijolo"
  | "ladrilho"
  | "veludo"
  | "metal"
  | "asfalto"
  | "concreto"
  | "reboco"
  | "pedra"
  | "pedraPortuguesa"
  | "borracha"
  | "laca"
  | "tecido"
  | "listras"
  | "la"
  | "janelas"
  | "led"
  | "rede"
  | "ceu"
  | "amostras"
  | "imagem"
  | "liso";

export interface MaterialDesc {
  textura: Textura;
  cor: string;
  /** segunda cor do desenho (veio, rejunte, reflexo, horizonte) */
  cor2?: string;
  rugosidade: number;
  metal: number;
  /** lado da textura em px (0 = material sem textura: vidro, espelho, luz) */
  px: 0 | 256 | 512 | 1024;
  /** metros cobertos por uma repetição da textura */
  repete?: number;
  /** intensidade da luz própria (neon, LED, lâmpada) */
  emissiva?: number;
  opacidade?: number;
  /** imagem pronta (textura "imagem"), servida de /public */
  url?: string;
}

export type Forma = "caixa" | "chanfrada" | "cilindro" | "esfera" | "plano" | "extrusao" | "toro";

/**
 * Parte de um móvel ou da casca da sala.
 * `tam`: caixa/chanfrada = largura, altura, profundidade; cilindro = raio de cima, altura, raio de baixo;
 * esfera = raios x, y, z; plano = largura, altura (de frente para +z); toro = raio, raio do tubo;
 * extrusão = perfil em (x, y) com a profundidade em tam[2].
 * `rot`: graus, na ordem Y, X, Z (o giro do móvel soma em Y).
 */
export interface Parte {
  forma: Forma;
  tam: V3;
  pos: V3;
  rot?: V3;
  mat: string;
  seg?: number;
  perfil?: [number, number][];
}

export type ZonaNome = "avatar" | "personagens" | "decoracao";

/** Retângulo no piso (metros). */
export interface Zona {
  x: [number, number];
  z: [number, number];
}

/** Zona do avatar: tablado, tapete, marca no piso ou a própria passarela; `altura` é onde os pés ficam. */
export interface ZonaAvatar extends Zona {
  marca: "tablado" | "tapete" | "marca" | "passarela";
  altura: number;
}

export interface Movel {
  tipo: string;
  pos: V3;
  /** rotação em y, em graus */
  giro: number;
  zona: ZonaNome;
  /** partes no espaço do móvel (origem no piso, frente para +z) */
  partes: Parte[];
  /** móvel animado pelas sequências (porta, claquete, bola): desenhado à parte, com este nome */
  id?: string;
  /**
   * objeto GLB licenciado (public/flair/3d/assets/<slug>.glb) que substitui as partes quando o arquivo existe no
   * manifesto e carrega; sem ele (ou sem WebGL), valem as partes procedurais
   */
  glb?: GlbRef;
}

export interface GlbRef {
  slug: string;
  /** escala fixa; sem ela, o objeto é ajustado à altura do móvel procedural e apoiado no piso */
  escala?: number;
  /** giro extra em y (graus), para modelos que vêm virados */
  giro?: number;
}

export interface Luz {
  cor: string;
  intensidade: number;
  pos: V3;
}

/** Luz própria do lugar (neon, lustre, spots). */
export interface LuzPropria extends Luz {
  id: string;
  tipo: "ponto" | "foco";
  alvo?: V3;
  alcance?: number;
  /** apagada até uma sequência acender (flash, luz da porta, rastro do golpe) */
  apagada?: boolean;
}

export interface Sala {
  codigo: NucleoCodigo;
  /** largura (x), fundo (atrás do avatar, z negativo), frente (até atrás da câmera) e altura, em metros */
  dim: { largura: number; fundo: number; frente: number; altura: number };
  fechamento: "tres_paredes" | "quatro_paredes" | "fundo_fechado";
  cobertura: "teto" | "ceu";
  /** materiais da casca */
  casca: { piso: string; parede: string; fundo?: string; teto: string; rodape?: string };
  materiais: Record<string, MaterialDesc>;
  zonas: { avatar: ZonaAvatar; personagens: Zona[]; decoracao: Zona[] };
  moveis: Movel[];
  /** figurantes só de cenário (torcida, convidados), além dos personagens do arquivo do núcleo */
  figurantes: NucleoPersonagem[];
  luzes: {
    principal: Luz;
    recorte: Luz;
    ambiente: { ceu: string; chao: string; intensidade: number };
    /** reflexo de estúdio nos materiais polidos (0 a 1) */
    reflexo: number;
    proprias: LuzPropria[];
  };
  /** cor de fundo (atrás de tudo) e neblina leve que esconde o fim da sala */
  fundo: string;
  /** painel de LED que mostra o placar (posição do centro, tamanho e giro) */
  placar?: { pos: V3; tam: [number, number]; giro?: number };
  /** distância máxima da câmera (salas de quatro paredes) */
  cameraMax?: number;
}
