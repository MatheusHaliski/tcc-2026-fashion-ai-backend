/**
 * Corrida de contas: botões e contas descem rolando por duas rampas de vidro em ziguezague e dão a volta num laço,
 * como numa pista de bolinhas; as rampas se cruzam por cima e por baixo do laço.
 */
import { laco, quebrada } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena } from "@/lib/flair/cenas/tipos";

const VIOLETA = "#a98bff";
const ROSA = "#ff6fae";
const SOL = "#ffd45c";
const LUZ = "#f3ecff";

export const CORRIDA_DE_CONTAS: Cena = {
  id: "corrida-de-contas",
  quadro: 6.9,
  paleta: { fundo: ["#0e0920", "#1c0f33"], luz: LUZ, acentos: [ROSA, SOL] },
  fundo: [
    { k: "halo", x: 28, y: 20, r: 60, cor: VIOLETA, a: 0.2 },
    { k: "halo", x: 132, y: 78, r: 64, cor: ROSA, a: 0.16 },
    { k: "grade", passo: 5, cor: LUZ, a: 0.07, tipo: "pontos" },
    { k: "aneis", x: 80, y: 50, r0: 30, dr: 6, n: 4, cor: LUZ, a: 0.08 },
    { k: "poeira", n: 34, semente: 88, cor: LUZ, a: 0.45, r: 0.27 },
  ],
  trilhos: [
    {
      id: "laco",
      d: laco(80, 50, 26, 26),
      tubo: { largura: 11, cor: SOL, vidro: 0.06 },
      pulsos: { n: 2, periodo: 7, cor: SOL, comprimento: 10 },
    },
    {
      id: "rampa-1",
      d: quebrada([[-16, 10], [60, 22], [20, 44], [112, 58], [50, 84], [176, 96]], 7),
      tubo: { largura: 11, cor: VIOLETA, vidro: 0.06 },
      sobre: ["laco"],
      pulsos: { n: 3, periodo: 8, cor: VIOLETA, comprimento: 12 },
    },
    {
      id: "rampa-2",
      d: quebrada([[176, 6], [104, 18], [142, 40], [96, 50], [150, 70], [110, 86], [176, 110]], 7),
      tubo: { largura: 11, cor: ROSA, vidro: 0.06 },
      pulsos: { n: 3, periodo: 9.5, cor: ROSA, comprimento: 12 },
    },
  ],
  elenco: [
    { trilho: "rampa-1", formas: ["conta", "botao"], cores: [VIOLETA, SOL, ROSA], n: 7, periodo: 30, escala: 4, orienta: "rola" },
    { trilho: "rampa-2", formas: ["botao", "conta", "conta"], cores: [ROSA, LUZ, SOL], n: 6, periodo: 36, escala: 4, orienta: "rola", fase: 0.05 },
    { trilho: "laco", formas: ["conta", "botao"], cores: [SOL, VIOLETA], n: 4, periodo: 16, escala: 3.8, orienta: "rola", fase: 0.02 },
  ],
  frente: moldura(LUZ, 0.45),
};
