/**
 * Linha de cabides: os cabides, com blusa, vestido e calça, correm pendurados em três linhas de um mapa de trilhos
 * (retas e viradas de 45°), com estações em anel e pulsos de luz pelas linhas.
 */
import { quebrada } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Enfeite } from "@/lib/flair/cenas/tipos";

const CEU = "#5cc8ff";
const CORAL = "#ff7f6e";
const AREIA = "#ecd98a";
const LUZ = "#e6eeff";

const LINHAS: { id: string; cor: string; pontos: [number, number][] }[] = [
  { id: "ceu", cor: CEU, pontos: [[-14, 18], [34, 18], [52, 36], [104, 36], [122, 18], [176, 18]] },
  { id: "coral", cor: CORAL, pontos: [[-14, 60], [22, 60], [40, 42], [76, 42], [94, 60], [136, 60], [150, 46], [176, 46]] },
  { id: "areia", cor: AREIA, pontos: [[-14, 84], [58, 84], [72, 70], [118, 70], [132, 84], [176, 84]] },
];

/** Uma estação (dois anéis) em cada virada das linhas. */
const ESTACOES: Enfeite[] = LINHAS.flatMap((l) =>
  l.pontos.slice(1, -1).map(([x, y]): Enfeite => ({ k: "aneis", x, y, r0: 1.7, dr: 1.4, n: 2, cor: l.cor, a: 0.7 })),
);

export const LINHA_DE_CABIDES: Cena = {
  id: "linha-de-cabides",
  quadro: 6.3,
  paleta: { fundo: ["#060a18", "#101a33"], luz: LUZ, acentos: [CEU, CORAL] },
  fundo: [
    { k: "halo", x: 120, y: 20, r: 66, cor: CEU, a: 0.16 },
    { k: "halo", x: 30, y: 82, r: 60, cor: CORAL, a: 0.13 },
    { k: "grade", passo: 8, cor: LUZ, a: 0.045, tipo: "linhas" },
    { k: "grade", passo: 4, cor: LUZ, a: 0.06, tipo: "pontos" },
    { k: "poeira", n: 22, semente: 41, cor: LUZ, a: 0.4, r: 0.25 },
    ...ESTACOES,
  ],
  trilhos: LINHAS.map((l, i) => ({
    id: l.id,
    d: quebrada(l.pontos, 4),
    fio: { cor: l.cor, largura: 0.9 },
    pulsos: { n: 2, periodo: 6 + i * 1.7, cor: l.cor, comprimento: 16, sentido: i === 1 ? (-1 as const) : (1 as const) },
  })),
  elenco: [
    { trilho: "ceu", formas: ["cabide-blusa", "cabide-vestido", "cabide-calca"], cores: [CEU, "#b9a6ff", AREIA], n: 5, periodo: 31, escala: 5.4, orienta: "reto", balanco: 9, pendura: 0.93 },
    { trilho: "coral", formas: ["cabide-vestido", "cabide-calca", "cabide-blusa"], cores: [CORAL, CEU, "#ffd9d2"], n: 5, periodo: 38, escala: 5.4, orienta: "reto", balanco: 9, pendura: 0.93, sentido: -1, fase: 0.08 },
    { trilho: "areia", formas: ["cabide-calca", "cabide-blusa", "cabide-vestido"], cores: [AREIA, CORAL, CEU], n: 4, periodo: 27, escala: 5.4, orienta: "reto", balanco: 9, pendura: 0.93, fase: 0.03 },
  ],
  frente: moldura(LUZ, 0.45),
};
