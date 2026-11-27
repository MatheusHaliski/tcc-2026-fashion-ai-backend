/**
 * Túneis de moda: uma raposa de lenço, um cisne de colar, um gato de gravata-borboleta e uma garça com a bolsa
 * atravessam três túneis feitos de moda: o zíper (dentes no meio), o cinto (pespontos e fivelas douradas) e a fita de
 * cetim (larga, em laço). Os túneis passam uns por cima dos outros.
 */
import { laco, suave } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena } from "@/lib/flair/cenas/tipos";

const ESMERALDA = "#3ddc97";
const OURO = "#f2cf8f";
const CORAL = "#ff7a6b";
const LUZ = "#eaf6ef";

const ZIPER = suave([[-16, 22], [22, 30], [52, 18], [86, 34], [118, 20], [146, 30], [176, 18]]);
const CINTO = suave([[-16, 80], [20, 70], [50, 84], [84, 62], [116, 82], [146, 68], [176, 78]]);
const FITA = laco(82, 50, 50, 24);

export const TUNEIS_DE_MODA: Cena = {
  id: "tuneis-de-moda",
  quadro: 11.2,
  paleta: { fundo: ["#06110e", "#0d1f1a"], luz: LUZ, acentos: [ESMERALDA, OURO] },
  fundo: [
    { k: "halo", x: 30, y: 78, r: 64, cor: ESMERALDA, a: 0.16 },
    { k: "halo", x: 132, y: 20, r: 60, cor: OURO, a: 0.12 },
    { k: "grade", passo: 6, cor: LUZ, a: 0.07, tipo: "pontos" },
    { k: "grade", passo: 12, cor: LUZ, a: 0.03, tipo: "linhas" },
    { k: "poeira", n: 30, semente: 23, cor: LUZ, a: 0.4, r: 0.26 },
  ],
  trilhos: [
    {
      id: "fita",
      d: FITA,
      tubo: { largura: 12, cor: CORAL, vidro: 0.05 },
      sobre: ["ziper"],
      pulsos: { n: 2, periodo: 11, cor: CORAL, comprimento: 16 },
    },
    {
      id: "ziper",
      d: ZIPER,
      tubo: { largura: 12.5, cor: ESMERALDA, vidro: 0.06 },
      mangas: [{ de: 0.47, ate: 0.5, cor: "#16302a" }],
      pulsos: { n: 2, periodo: 7, cor: ESMERALDA, comprimento: 12 },
    },
    // os dentes do zíper, no meio do túnel
    { id: "dentes", d: ZIPER, fio: { cor: ESMERALDA, largura: 1.5, a: 0.5, tracejado: [0.5, 1.3] } },
    {
      id: "cinto",
      d: CINTO,
      tubo: { largura: 12.5, cor: OURO, vidro: 0.05 },
      sobre: ["fita"],
      mangas: [{ de: 0.2, ate: 0.225, cor: "#caa15a" }, { de: 0.72, ate: 0.745, cor: "#caa15a" }],
      pulsos: { n: 2, periodo: 8.5, cor: OURO, comprimento: 12, sentido: -1 },
    },
  ],
  elenco: [
    { trilho: "ziper", formas: ["raposa", "garca", "gato"], cores: ["#ff9457", "#8fe6c4", "#c3b6ff"], n: 4, periodo: 34, escala: 5.6, orienta: "perfil" },
    { trilho: "cinto", formas: ["gato", "cisne", "raposa"], cores: ["#c3b6ff", "#bfe9ff", "#ff9457"], n: 4, periodo: 40, escala: 5.6, orienta: "perfil", sentido: -1, fase: 0.09 },
    { trilho: "fita", formas: ["cisne", "garca"], cores: ["#ffd9d2", "#8fe6c4"], n: 4, periodo: 46, escala: 5.4, orienta: "perfil", fase: 0.04 },
  ],
  frente: moldura(LUZ),
};
