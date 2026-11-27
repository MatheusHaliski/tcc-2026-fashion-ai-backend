/**
 * Zigue-zague FashionAI: as marcas do app (curtir, favoritar, as reações Trend, Elegante e Criativo, os FAI Points…)
 * correm por três trilhos de luz em zigue-zague, cada um num ritmo e num sentido, com pulsos pelos fios.
 */
import { quebrada } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Enfeite } from "@/lib/flair/cenas/tipos";

const MAGENTA = "#f0447e";
const TURQUESA = "#35c9b8";
const AMBAR = "#ffb347";
const LUZ = "#f6efe6";

/** Zigue-zague de fora a fora da arte entre duas alturas, começando em cima ou embaixo. */
function zigue(alto: number, baixo: number, passo: number, comecaEmCima: boolean): [number, number][] {
  const pontos: [number, number][] = [];
  let cima = comecaEmCima;
  for (let x = -14; x <= 174 + passo; x += passo) {
    pontos.push([x, cima ? alto : baixo]);
    cima = !cima;
  }
  return pontos;
}

const FAIXAS = [
  { id: "magenta", cor: MAGENTA, pontos: zigue(14, 36, 23.5, true) },
  { id: "turquesa", cor: TURQUESA, pontos: zigue(40, 62, 27, false) },
  { id: "ambar", cor: AMBAR, pontos: zigue(66, 88, 23.5, false) },
];

/** Um nó de luz em cada quina do zigue-zague e, atrás, o eco tracejado do trilho. */
const NOS: Enfeite[] = FAIXAS.flatMap((f) => [
  { k: "traco" as const, d: quebrada(f.pontos.map(([x, y]): [number, number] => [x + 5, y + 4.5]), 2), cor: f.cor, largura: 0.22, a: 0.28, tracejado: [1.2, 1.8] },
  ...f.pontos.map(([x, y]): Enfeite => ({ k: "aneis", x, y, r0: 1.5, dr: 1.3, n: 2, cor: f.cor, a: 0.55 })),
]);

export const ZIGUE_ZAGUE: Cena = {
  id: "zigue-zague",
  quadro: 4.2,
  paleta: { fundo: ["#120d12", "#1d1418"], luz: LUZ, acentos: [MAGENTA, TURQUESA] },
  fundo: [
    { k: "halo", x: 20, y: 20, r: 62, cor: MAGENTA, a: 0.18 },
    { k: "halo", x: 150, y: 86, r: 66, cor: AMBAR, a: 0.14 },
    { k: "halo", x: 96, y: 50, r: 46, cor: TURQUESA, a: 0.1 },
    { k: "grade", passo: 7, cor: LUZ, a: 0.045, tipo: "diagonais" },
    { k: "aneis", x: 134, y: 22, r0: 12, dr: 7, n: 6, cor: LUZ, a: 0.09 },
    { k: "poeira", n: 26, semente: 5, cor: LUZ, a: 0.45, r: 0.26 },
    ...NOS,
  ],
  trilhos: FAIXAS.map((f, i) => ({
    id: f.id,
    d: quebrada(f.pontos, 2),
    fio: { cor: f.cor, largura: 0.55 },
    pulsos: { n: 3, periodo: 5.5 + i * 1.3, cor: f.cor, comprimento: 14, sentido: i === 1 ? (-1 as const) : (1 as const) },
  })),
  elenco: [
    { trilho: "magenta", formas: ["fai:soc-01", "fai:soc-07", "fai:act-40", "fai:soc-06"], cores: [MAGENTA, AMBAR], n: 5, periodo: 30, escala: 6.2, orienta: "reto", balanco: 7 },
    { trilho: "turquesa", formas: ["fai:soc-08", "fai:nav-05", "fai:soc-05", "fai:act-43"], cores: [TURQUESA, LUZ], n: 4, periodo: 24, escala: 6.6, orienta: "reto", balanco: 7, sentido: -1, fase: 0.11 },
    { trilho: "ambar", formas: ["fai:soc-09", "fai:act-09", "fai:soc-01", "fai:act-40"], cores: [AMBAR, MAGENTA], n: 5, periodo: 36, escala: 6.2, orienta: "reto", balanco: 7, fase: 0.05 },
  ],
  frente: moldura(LUZ, 0.45),
};
