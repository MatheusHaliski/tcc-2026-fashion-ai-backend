/**
 * Escadaria de saltos: sapatos de salto sobem três escadarias de luz, degrau a degrau, cada lance num ritmo, sob a
 * luz dos lustres; os pulsos sobem com eles pelos degraus.
 */
import { quebrada } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Enfeite } from "@/lib/flair/cenas/tipos";

const OURO = "#f2cf8f";
const RUBI = "#ff5d7a";
const LUZ = "#fbeee0";

/** Escada: de (x0, y0) sobe `n` degraus para a direita; começa e termina fora da arte. */
function escada(x0: number, y0: number, n: number, piso: number, espelho: number): [number, number][] {
  const pontos: [number, number][] = [[x0 - 30, y0]];
  for (let i = 0; i < n; i++) {
    pontos.push([x0 + i * piso, y0 - i * espelho], [x0 + i * piso, y0 - (i + 1) * espelho]);
  }
  pontos.push([x0 + n * piso + 40, y0 - n * espelho]);
  return pontos;
}

const LANCES = [
  { id: "lance-1", cor: OURO, pontos: escada(8, 92, 7, 11, 7) },
  { id: "lance-2", cor: RUBI, pontos: escada(52, 96, 7, 12, 7.5) },
  { id: "lance-3", cor: LUZ, pontos: escada(-4, 58, 6, 12, 6.5) },
];

/** Os lustres: fios finos que descem do alto, com um anel de luz na ponta. */
const LUSTRES: Enfeite[] = [22, 64, 108, 142].flatMap((x, i): Enfeite[] => [
  { k: "traco", d: `M${x} 0L${x} ${8 + (i % 2) * 6}`, cor: LUZ, largura: 0.2, a: 0.5 },
  { k: "aneis", x, y: 10 + (i % 2) * 6, r0: 1.4, dr: 1.6, n: 3, cor: OURO, a: 0.6 },
  { k: "halo", x, y: 10 + (i % 2) * 6, r: 22, cor: OURO, a: 0.16 },
]);

export const ESCADARIA: Cena = {
  id: "escadaria",
  quadro: 3.3,
  paleta: { fundo: ["#120a12", "#22101c"], luz: LUZ, acentos: [OURO, RUBI] },
  fundo: [
    { k: "halo", x: 130, y: 80, r: 66, cor: RUBI, a: 0.16 },
    { k: "grade", passo: 7, cor: LUZ, a: 0.04, tipo: "diagonais" },
    { k: "poeira", n: 26, semente: 15, cor: LUZ, a: 0.42, r: 0.26 },
    ...LUSTRES,
  ],
  trilhos: LANCES.map((l, i) => ({
    id: l.id,
    d: quebrada(l.pontos, 0.6),
    fio: { cor: l.cor, largura: 0.6 },
    pulsos: { n: 3, periodo: 7 + i * 1.6, cor: l.cor, comprimento: 12 },
  })),
  elenco: [
    { trilho: "lance-1", formas: ["sapato"], cores: [OURO, RUBI, LUZ], n: 5, periodo: 30, escala: 4.6, orienta: "reto", balanco: 6, pendura: -0.98 },
    { trilho: "lance-2", formas: ["sapato"], cores: [RUBI, LUZ, OURO], n: 5, periodo: 37, escala: 4.6, orienta: "reto", balanco: 6, pendura: -0.98, fase: 0.06 },
    { trilho: "lance-3", formas: ["sapato"], cores: [LUZ, OURO, RUBI], n: 4, periodo: 26, escala: 4.2, orienta: "reto", balanco: 6, pendura: -0.98, fase: 0.11 },
  ],
  frente: moldura(LUZ, 0.45),
};
