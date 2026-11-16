/**
 * Relojoaria do ateliê: engrenagens e carretéis giram engatados enquanto tesouras, dedais, agulhas e botões circulam
 * em órbitas de luz em volta deles e por uma correia que liga as duas rodas maiores.
 */
import { laco, suave } from "@/lib/flair/cenas/caminho";
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena } from "@/lib/flair/cenas/tipos";

const OURO = "#f2cf8f";
const VIOLETA = "#b3a2ff";
const GELO = "#dfe6ff";

export const RELOJOARIA: Cena = {
  id: "relojoaria",
  quadro: 9.1,
  paleta: { fundo: ["#0b0914", "#151028"], luz: GELO, acentos: [OURO, VIOLETA] },
  fundo: [
    { k: "halo", x: 48, y: 46, r: 58, cor: OURO, a: 0.15 },
    { k: "halo", x: 118, y: 56, r: 62, cor: VIOLETA, a: 0.17 },
    { k: "grade", passo: 5, cor: GELO, a: 0.07, tipo: "pontos" },
    { k: "aneis", x: 48, y: 46, r0: 34, dr: 2.2, n: 3, cor: OURO, a: 0.16 },
    { k: "aneis", x: 118, y: 56, r0: 30, dr: 2.2, n: 3, cor: VIOLETA, a: 0.18 },
    { k: "poeira", n: 28, semente: 77, cor: GELO, a: 0.42, r: 0.26 },
  ],
  trilhos: [
    { id: "orbita-ouro", d: laco(48, 46, 30, 30), fio: { cor: OURO, largura: 0.45, a: 0.9 }, pulsos: { n: 2, periodo: 8, cor: OURO, comprimento: 14 } },
    { id: "orbita-violeta", d: laco(118, 56, 26, 26), fio: { cor: VIOLETA, largura: 0.45, a: 0.9 }, pulsos: { n: 2, periodo: 6.5, cor: VIOLETA, comprimento: 12, sentido: -1 } },
    {
      id: "correia",
      d: suave([[48, 8], [96, 14], [134, 22], [152, 56], [130, 90], [84, 92], [40, 88], [10, 46]], true),
      fio: { cor: GELO, largura: 0.3, a: 0.55, tracejado: [1.4, 1.4] },
      pulsos: { n: 3, periodo: 12, cor: GELO, comprimento: 10 },
    },
  ],
  giros: [
    { forma: "engrenagem", cor: OURO, x: 48, y: 46, escala: 17, periodo: 36 },
    { forma: "engrenagem", cor: VIOLETA, x: 118, y: 56, escala: 14, periodo: 30, sentido: -1 },
    { forma: "engrenagem", cor: GELO, x: 83, y: 36, escala: 8, periodo: 17, sentido: -1 },
    { forma: "carretel", cor: VIOLETA, x: 82, y: 74, escala: 7.5, periodo: 14 },
    { forma: "carretel", cor: OURO, x: 146, y: 20, escala: 6, periodo: 11, sentido: -1 },
    { forma: "engrenagem", cor: OURO, x: 18, y: 84, escala: 7, periodo: 15, sentido: -1 },
  ],
  elenco: [
    { trilho: "orbita-ouro", formas: ["tesoura", "dedal", "agulha"], cores: [GELO, OURO, VIOLETA], n: 3, periodo: 24, escala: 5.2, orienta: "tangente" },
    { trilho: "orbita-violeta", formas: ["botao", "agulha", "dedal"], cores: [OURO, GELO, VIOLETA], n: 3, periodo: 19, escala: 4.8, orienta: "tangente", sentido: -1, fase: 0.1 },
    { trilho: "correia", formas: ["botao", "tesoura", "conta", "dedal"], cores: [VIOLETA, OURO, GELO], n: 6, periodo: 44, escala: 4.4, orienta: "tangente", fase: 0.05 },
  ],
  frente: moldura(GELO, 0.45),
};
