/**
 * Rio de tecido: três rolos de tecido giram à esquerda e se desenrolam em faixas que correm como um rio, em ondas;
 * contas e botões descem rolando pela correnteza, e a luz corre pelas dobras.
 */
import { suave } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Enfeite } from "@/lib/flair/cenas/tipos";

const AGUA = "#43d6e6";
const AREIA = "#f4d9a6";
const ROSA = "#ff8fb1";
const LUZ = "#e2fbff";

/** Onda de x = 18 até fora da arte, em torno da altura dada. */
function onda(altura: number, amplitude: number, fase: number): [number, number][] {
  const pontos: [number, number][] = [];
  for (let i = 0; i <= 8; i++) pontos.push([18 + i * 20, altura + amplitude * Math.sin(i * 1.25 + fase)]);
  return pontos;
}

const FAIXAS = [
  { id: "agua", cor: AGUA, altura: 24, fase: 0 },
  { id: "areia", cor: AREIA, altura: 50, fase: 1.6 },
  { id: "rosa", cor: ROSA, altura: 76, fase: 3.1 },
];

/** As dobras do tecido: linhas finas paralelas a cada faixa, acima e abaixo. */
const DOBRAS: Enfeite[] = FAIXAS.flatMap((f) =>
  [-4.2, -2.1, 2.1, 4.2].map((d): Enfeite => ({ k: "traco", d: suave(onda(f.altura + d, 5, f.fase)), cor: f.cor, largura: 0.2, a: 0.34 - Math.abs(d) * 0.04 })),
);

export const RIO_DE_TECIDO: Cena = {
  id: "rio-de-tecido",
  quadro: 5.6,
  paleta: { fundo: ["#04131b", "#082935"], luz: LUZ, acentos: [AGUA, AREIA] },
  fundo: [
    { k: "halo", x: 20, y: 50, r: 60, cor: AGUA, a: 0.2 },
    { k: "halo", x: 140, y: 30, r: 60, cor: AREIA, a: 0.1 },
    { k: "grade", passo: 6, cor: LUZ, a: 0.06, tipo: "pontos" },
    { k: "poeira", n: 30, semente: 9, cor: LUZ, a: 0.4, r: 0.26 },
    ...DOBRAS,
  ],
  trilhos: FAIXAS.map((f, i) => ({
    id: f.id,
    d: suave(onda(f.altura, 5, f.fase)),
    tubo: { largura: 12.5, cor: f.cor, vidro: 0.06 },
    pulsos: { n: 3, periodo: 6 + i * 1.5, cor: f.cor, comprimento: 14 },
  })),
  giros: FAIXAS.map((f, i) => ({ forma: "rolo", cor: f.cor, x: 12, y: f.altura + 5 * Math.sin(f.fase), escala: 9.5, periodo: 9 + i * 2, z: 0 })),
  elenco: [
    { trilho: "agua", formas: ["conta", "botao"], cores: [AGUA, LUZ, AREIA], n: 5, periodo: 26, escala: 4.4, orienta: "rola" },
    { trilho: "areia", formas: ["botao", "conta", "conta"], cores: [AREIA, ROSA, AGUA], n: 5, periodo: 33, escala: 4.6, orienta: "rola", fase: 0.07 },
    { trilho: "rosa", formas: ["conta", "botao"], cores: [ROSA, AREIA, LUZ], n: 5, periodo: 29, escala: 4.4, orienta: "rola", fase: 0.13 },
  ],
  frente: moldura(LUZ, 0.45),
};
