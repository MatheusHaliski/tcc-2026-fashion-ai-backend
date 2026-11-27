/**
 * Os quebra-cabeças DINÂMICOS dos Desafios de Montagem (docs/flair/cbc/MONTAGEM_DINAMICA.md): cada cenário novo tem
 * uma fonte em movimento — um vídeo tocando ou o símbolo FAI animado em código — e a forma do recorte. Diferente dos
 * elencos (imagens paradas), cada peça mostra a sua região da fonte enquanto ela se move. O número de peças é o número
 * de vagas do desafio, que vem do servidor (V131__montagem_quebra_cabeca_dinamico.sql); o recorte se ajusta a ele.
 * Os mp4 e as imagens são os do PR #597 (public/flair/elencos) e os desenhos gerados por
 * scripts/flair-modes/montagem-desenhos.sh (public/flair/montagem).
 */

/** Movimento procedural do símbolo FAI (movimento.ts): giro lento, pulso e órbita dos brilhos. */
export type Movimento = "orbita";

/** Região da fonte usada pelo quebra-cabeça, em frações da largura e da altura do vídeo (tira as faixas pretas). */
export interface Janela {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Fonte =
  | { tipo: "video"; src: string; poster: string; janela: Janela }
  | { tipo: "logo"; imagem: string; movimento: Movimento };

export type FormaDinamica = "grade" | "jigsaw" | "setores" | "cacos";

export interface QuebraCabecaDinamico {
  cenario: string;
  fonte: Fonte;
  /** largura do quadro nas unidades do recorte (a altura é sempre 100) */
  largura: number;
  forma: FormaDinamica;
}

const ELENCOS = "/flair/elencos";
const MONTAGEM = "/flair/montagem";
const INTEIRA: Janela = { x: 0, y: 0, w: 1, h: 1 };

const video = (src: string, poster: string, janela: Janela = INTEIRA): Fonte => ({ tipo: "video", src, poster, janela });

const LISTA: QuebraCabecaDinamico[] = [
  // a cena de fogo do Firefly com a moeda FAI girando: só o vídeo do quadrante dela, nunca o 2×2 inteiro (regra do #597)
  { cenario: "firefly-fogo", fonte: video(`${ELENCOS}/fogo.mp4`, `${ELENCOS}/fogo.webp`), largura: 100, forma: "jigsaw" },
  { cenario: "arena", fonte: video(`${ELENCOS}/arena-celebracao.mp4`, `${ELENCOS}/arena.webp`), largura: 133.33, forma: "grade" },
  { cenario: "logo-fai", fonte: { tipo: "logo", imagem: `${ELENCOS}/logo-3d.webp`, movimento: "orbita" }, largura: 100, forma: "setores" },
  { cenario: "logo-deriva", fonte: video(`${MONTAGEM}/logo-deriva.mp4`, `${MONTAGEM}/logo-deriva.webp`), largura: 100, forma: "cacos" },
  { cenario: "caleidoscopio", fonte: video(`${MONTAGEM}/caleidoscopio.mp4`, `${MONTAGEM}/caleidoscopio.webp`), largura: 100, forma: "setores" },
];

export const QUEBRA_CABECAS_DINAMICOS: Record<string, QuebraCabecaDinamico> = Object.fromEntries(LISTA.map((q) => [q.cenario, q]));

export function quebraCabecaDinamico(cenario: string | null | undefined): QuebraCabecaDinamico | null {
  return cenario && Object.hasOwn(QUEBRA_CABECAS_DINAMICOS, cenario) ? QUEBRA_CABECAS_DINAMICOS[cenario] : null;
}

export const ehDinamico = (cenario: string | null | undefined): boolean => quebraCabecaDinamico(cenario) !== null;

/** Imagem parada da fonte: o pôster do vídeo ou o próprio símbolo (movimento reduzido e antes de o vídeo carregar). */
export const imagemParada = (f: Fonte): string => (f.tipo === "video" ? f.poster : f.imagem);
