/**
 * O desenho de cada elenco em quebra-cabeça: a imagem (public/flair/elencos), o vídeo do modal de conclusão, a forma
 * do recorte, as peças (uma por vaga, na ordem p1, p2...) e o que cada vaga pede, igual ao servidor
 * (FlairCbcElencos.java). Cada cena tem o próprio vídeo: o quadrante dela, recortado do vídeo Firefly 2×2. Os logos sem vídeo próprio mostram no modal a animação CSS do logo se montando.
 */
import { cacos, grade, jigsaw, setores, type Peca, type Ponto } from "@/lib/flair/elencos/recortes";
import type { ElencoRequisito } from "@/lib/flair/elencos/types";

export type Forma = "grade" | "jigsaw" | "setores" | "cacos";

export interface QuebraCabeca {
  codigo: string;
  imagem: string;
  /** largura da imagem nas unidades do recorte (a altura é sempre 100) */
  largura: number;
  video: string | null;
  forma: Forma;
  pecas: Peca[];
  /** o que a vaga de cada peça pede: "color:red", "style:modern", "occasion:party" ou "" (qualquer carta) */
  pedidos: string[];
  requisitos: ElencoRequisito[];
}

const DIR = "/flair/elencos";
const VIDEO_ARENA = `${DIR}/arena-celebracao.mp4`;
const [VERMELHO, VERDE, AZUL, LARANJA, PRETO, ROSA, ROXO] = ["red", "green", "blue", "orange", "black", "pink", "purple"].map((c) => `color:${c}`);
const MODERNO = "style:modern";
const FESTA = "occasion:party";
const LIVRE = "";

const repetir = (n: number, ...ciclo: string[]) => Array.from({ length: n }, (_, i) => ciclo[i % ciclo.length]);
const cor = (valor: string, alvo: number): ElencoRequisito => ({ tipo: "COR", alvo, valor });

/** Raios das rachaduras do logo em cacos de vidro (15.webp), do impacto à borda, no sentido horário a partir do alto. */
const IMPACTO: Ponto = [52, 50];
const RACHADURAS: Ponto[][] = [
  [[53, 36], [50, 22], [51, 12], [50, 0]],
  [[57, 29], [64, 17], [73, 14], [82, 0]],
  [[63, 40], [75, 31], [88, 24], [100, 20]],
  [[66, 50], [79, 49], [100, 50]],
  [[62, 57], [70, 68], [83, 71], [100, 80]],
  [[57, 63], [62, 80], [68, 100]],
  [[53, 57], [50, 75], [52, 90], [50, 100]],
  [[46, 64], [39, 77], [30, 100]],
  [[42, 57], [28, 66], [12, 70], [0, 78]],
  [[40, 49], [26, 50], [0, 52]],
  [[43, 40], [30, 33], [20, 24], [0, 20]],
  [[45, 31], [36, 20], [31, 11], [24, 0]],
];

const cena = (codigo: string, imagem: string, pedidos: string[], requisitos: ElencoRequisito[]): QuebraCabeca => ({
  codigo, imagem: `${DIR}/${imagem}.webp`, largura: 100, video: `${DIR}/${imagem}.mp4`, forma: "grade", pecas: grade(2, 2, 100), pedidos, requisitos,
});

const logo = (codigo: string, imagem: string, forma: Forma, pecas: Peca[], pedidos: string[], requisitos: ElencoRequisito[]): QuebraCabeca => ({
  codigo, imagem: `${DIR}/${imagem}.webp`, largura: 100, video: null, forma, pecas, pedidos, requisitos,
});

export const QUEBRA_CABECAS: QuebraCabeca[] = [
  cena("DESAFIO_FOGO", "fogo", [VERMELHO, VERMELHO, VERMELHO, VERMELHO], [cor("red", 4)]),
  cena("DESAFIO_VERDE_FLORESTAL", "verde-florestal", [VERDE, VERDE, VERDE, LIVRE], [cor("green", 3)]),
  cena("DESAFIO_AZUL_TECH", "azul-tech", [AZUL, LIVRE, LIVRE, LIVRE], [cor("blue", 1)]),
  cena("DESAFIO_FASHIONAI_TECH", "fai-tech", [MODERNO, MODERNO, MODERNO, MODERNO], [{ tipo: "ESTILO", alvo: 4, valor: "modern" }]),
  {
    codigo: "CELEBRACAO_ARENA", imagem: `${DIR}/arena.webp`, largura: 134.07, video: VIDEO_ARENA, forma: "grade", pecas: grade(3, 2, 134.07),
    pedidos: repetir(6, FESTA, LIVRE), requisitos: [{ tipo: "OCASIAO", alvo: 3, valor: "party" }],
  },
  logo("LOGO_QUEBRA_CABECA", "logo-quebra-cabeca", "jigsaw", jigsaw(4, 3, 100),
    [LARANJA, LIVRE, LARANJA, LIVRE, LIVRE, LARANJA, LIVRE, LARANJA, LARANJA, LIVRE, LARANJA, LIVRE], [cor("orange", 6)]),
  logo("LOGO_SETORES", "logo-3d", "setores", setores(12, 50, 50, 50), repetir(12, PRETO, LARANJA, LIVRE), [cor("black", 4), cor("orange", 4)]),
  logo("LOGO_TEAL", "logo-teal", "jigsaw", jigsaw(4, 3, 100), repetir(12, AZUL, LIVRE, LIVRE, VERDE), [cor("blue", 3), cor("green", 3)]),
  logo("LOGO_CACOS", "logo-cacos", "cacos", cacos(IMPACTO, RACHADURAS, 100), repetir(12, ROSA, ROXO, LIVRE), [cor("pink", 4), cor("purple", 4)]),
  logo("LOGO_PECAS_FALTANDO", "logo-pecas-faltando", "jigsaw", jigsaw(4, 4, 100),
    [PRETO, LARANJA, LARANJA, PRETO, LARANJA, LIVRE, LIVRE, LARANJA, LARANJA, LIVRE, LIVRE, LARANJA, PRETO, LIVRE, LIVRE, PRETO],
    [cor("orange", 6), cor("black", 4), { tipo: "MARCAS", alvo: 3 }]),
];

export function quebraCabecaDe(codigo: string): QuebraCabeca | null {
  return QUEBRA_CABECAS.find((q) => q.codigo === codigo) ?? null;
}

/** "color:red" → { color: ["red"] }; "" → {} (qualquer carta). */
export function pedidoDaVaga(pedido: string): Record<string, string[]> {
  if (!pedido) return {};
  const i = pedido.indexOf(":");
  return { [pedido.slice(0, i)]: [pedido.slice(i + 1)] };
}
