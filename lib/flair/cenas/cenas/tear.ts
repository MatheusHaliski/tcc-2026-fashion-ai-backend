/**
 * Tear de luz: os fios da urdidura descem retos, de cima a baixo; as agulhas levam a trama de um lado ao outro, em
 * ondas que passam ora pela frente, ora por trás, cada linha num sentido, com a luz correndo pelos fios.
 */
import { suave } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Enfeite } from "@/lib/flair/cenas/tipos";

const ROSE = "#ffb199";
const GELO = "#cfe4ff";
const INDIGO = "#8ea2ff";

/** Trama: onda curta de fora a fora da arte, em torno da altura dada. */
function trama(altura: number, fase: number): [number, number][] {
  const pontos: [number, number][] = [];
  for (let i = 0; i <= 19; i++) pontos.push([-14 + i * 10, altura + 4.2 * Math.sin(i * (Math.PI / 2) + fase)]);
  return pontos;
}

/** Urdidura: fios verticais finos, de 10 em 10, um pouco mais fortes de 40 em 40. */
const URDIDURA: Enfeite[] = Array.from({ length: 15 }, (_, i): Enfeite => ({
  k: "traco",
  d: `M${10 + i * 10} 6L${10 + i * 10} 94`,
  cor: GELO,
  largura: i % 4 === 0 ? 0.32 : 0.2,
  a: i % 4 === 0 ? 0.5 : 0.28,
}));

const LINHAS = [
  { id: "trama-1", cor: ROSE, altura: 20, fase: 0 },
  { id: "trama-2", cor: INDIGO, altura: 40, fase: Math.PI },
  { id: "trama-3", cor: GELO, altura: 60, fase: 0 },
  { id: "trama-4", cor: ROSE, altura: 80, fase: Math.PI },
];

export const TEAR: Cena = {
  id: "tear",
  quadro: 8.4,
  paleta: { fundo: ["#090b1c", "#131735"], luz: GELO, acentos: [ROSE, INDIGO] },
  fundo: [
    { k: "halo", x: 34, y: 26, r: 58, cor: ROSE, a: 0.15 },
    { k: "halo", x: 126, y: 74, r: 64, cor: INDIGO, a: 0.2 },
    { k: "grade", passo: 5, cor: GELO, a: 0.05, tipo: "pontos" },
    { k: "traco", d: "M6 6L154 6", cor: GELO, largura: 0.5, a: 0.6, brilho: true },
    { k: "traco", d: "M6 94L154 94", cor: GELO, largura: 0.5, a: 0.6, brilho: true },
    { k: "poeira", n: 20, semente: 63, cor: GELO, a: 0.4, r: 0.25 },
  ],
  trilhos: LINHAS.map((l, i) => ({
    id: l.id,
    d: suave(trama(l.altura, l.fase)),
    fio: { cor: l.cor, largura: 0.6 },
    pulsos: { n: 3, periodo: 5 + i * 1.2, cor: l.cor, comprimento: 12, sentido: i % 2 ? (-1 as const) : (1 as const) },
  })),
  elenco: LINHAS.map((l, i) => ({
    trilho: l.id,
    formas: ["agulha"],
    cores: [l.cor, i % 2 ? ROSE : GELO],
    n: 3,
    periodo: 22 + i * 5,
    escala: 7.5,
    orienta: "tangente" as const,
    sentido: i % 2 ? (-1 as const) : (1 as const),
    fase: i * 0.07,
  })),
  // a urdidura fica na frente da trama: as agulhas passam por trás dos fios
  frente: [...URDIDURA, ...moldura(GELO, 0.45)],
};
