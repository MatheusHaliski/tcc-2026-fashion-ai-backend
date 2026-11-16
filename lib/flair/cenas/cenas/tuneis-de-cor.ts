/**
 * Túneis de cor: batons, perfumes, esmaltes, pincéis, pós e rímeis deslizam por três túneis de vidro que se trançam
 * (cada um passa por cima de um e por baixo do outro), com pulsos de luz correndo pelo vidro.
 */
import { laco, suave } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena } from "@/lib/flair/cenas/tipos";

const ROSA = "#ff5c9f";
const LILAS = "#9a86ff";
const AGUA = "#4fe0d2";
const OURO = "#f2cf8f";

export const TUNEIS_DE_COR: Cena = {
  id: "tuneis-de-cor",
  quadro: 7.4,
  paleta: { fundo: ["#0a0a1c", "#190f2e"], luz: "#e9e4ff", acentos: [ROSA, AGUA] },
  fundo: [
    { k: "halo", x: 26, y: 18, r: 64, cor: ROSA, a: 0.2 },
    { k: "halo", x: 136, y: 84, r: 70, cor: LILAS, a: 0.22 },
    { k: "halo", x: 92, y: 44, r: 40, cor: AGUA, a: 0.08 },
    { k: "grade", passo: 5, cor: "#e9e4ff", a: 0.1, tipo: "pontos" },
    { k: "aneis", x: 80, y: 50, r0: 38, dr: 9, n: 5, cor: "#e9e4ff", a: 0.1 },
    { k: "poeira", n: 34, semente: 11, cor: "#ffffff", a: 0.5, r: 0.28 },
  ],
  trilhos: [
    {
      id: "rosa",
      d: suave([[-16, 27], [20, 21], [56, 47], [94, 77], [130, 68], [176, 76]]),
      tubo: { largura: 12.5, cor: ROSA },
      sobre: ["lilas"],
      mangas: [{ de: 0.13, ate: 0.17, cor: "#2a2440" }, { de: 0.8, ate: 0.84, cor: "#2a2440" }],
      pulsos: { n: 2, periodo: 6.5, cor: ROSA, comprimento: 12 },
    },
    {
      id: "lilas",
      d: suave([[-16, 73], [22, 79], [58, 53], [96, 24], [132, 33], [176, 21]]),
      tubo: { largura: 12.5, cor: LILAS },
      sobre: ["anel"],
      mangas: [{ de: 0.14, ate: 0.18, cor: "#2a2440" }, { de: 0.82, ate: 0.86, cor: "#2a2440" }],
      pulsos: { n: 2, periodo: 7.8, cor: LILAS, comprimento: 12, sentido: -1 },
    },
    {
      id: "anel",
      d: laco(80, 50, 47, 31),
      tubo: { largura: 12, cor: AGUA },
      sobre: ["rosa"],
      mangas: [{ de: 0.235, ate: 0.265, cor: "#2a2440" }, { de: 0.735, ate: 0.765, cor: "#2a2440" }],
      pulsos: { n: 3, periodo: 9, cor: AGUA, comprimento: 10 },
    },
  ],
  elenco: [
    { trilho: "rosa", formas: ["batom", "perfume", "esmalte"], cores: [ROSA, OURO, "#ff8a5c"], n: 5, periodo: 27, escala: 5.2, orienta: "tangente" },
    { trilho: "lilas", formas: ["pincel", "rimel", "batom"], cores: [LILAS, OURO, ROSA], n: 5, periodo: 33, escala: 5.2, orienta: "tangente", sentido: -1, fase: 0.07 },
    { trilho: "anel", formas: ["compacto", "esmalte", "perfume"], cores: [AGUA, ROSA, LILAS], n: 6, periodo: 30, escala: 5, orienta: "tangente", fase: 0.03 },
  ],
  frente: moldura("#e9e4ff"),
};
