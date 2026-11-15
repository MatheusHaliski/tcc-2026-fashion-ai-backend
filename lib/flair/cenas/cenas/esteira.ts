/**
 * Esteira de costura: camisetas e vestidos passam por três esteiras de vidro e atravessam os portais das máquinas
 * (entram de um lado, somem por trás do portal e saem do outro), com uma linha de pesponto correndo no meio.
 */
import { moldura } from "@/lib/flair/cenas/cenas/comum";
import type { Cena, Trilho } from "@/lib/flair/cenas/tipos";

const LIMA = "#c8ff5a";
const BRANCO = "#f1f4f8";
const AZUL = "#6fb6ff";

const FAIXAS = [
  { id: "esteira-1", cor: BRANCO, y: 22, portais: [0.3, 0.72] },
  { id: "esteira-2", cor: LIMA, y: 50, portais: [0.5] },
  { id: "esteira-3", cor: AZUL, y: 78, portais: [0.28, 0.66] },
];

const ESTEIRAS: Trilho[] = FAIXAS.flatMap((f, i): Trilho[] => [
  {
    id: f.id,
    d: `M-16 ${f.y}L176 ${f.y}`,
    tubo: { largura: 15, cor: f.cor, vidro: 0.05 },
    mangas: f.portais.map((u) => ({ de: u - 0.035, ate: u + 0.035, cor: "#1b2030" })),
    pulsos: { n: 3, periodo: 5 + i * 1.4, cor: f.cor, comprimento: 12, sentido: i === 1 ? -1 : 1 },
  },
  // o pesponto no meio da esteira
  { id: `${f.id}-pesponto`, d: `M-16 ${f.y + 5.4}L176 ${f.y + 5.4}`, fio: { cor: f.cor, largura: 0.3, a: 0.55, tracejado: [1.6, 1.2] } },
]);

export const ESTEIRA: Cena = {
  id: "esteira",
  quadro: 7.7,
  paleta: { fundo: ["#0b0d12", "#151922"], luz: BRANCO, acentos: [LIMA, AZUL] },
  fundo: [
    { k: "halo", x: 80, y: 50, r: 70, cor: LIMA, a: 0.1 },
    { k: "halo", x: 150, y: 16, r: 50, cor: AZUL, a: 0.14 },
    { k: "grade", passo: 8, cor: BRANCO, a: 0.04, tipo: "linhas" },
    { k: "grade", passo: 4, cor: BRANCO, a: 0.05, tipo: "pontos" },
    { k: "poeira", n: 18, semente: 3, cor: BRANCO, a: 0.36, r: 0.25 },
  ],
  trilhos: ESTEIRAS,
  elenco: [
    { trilho: "esteira-1", formas: ["camiseta", "vestido"], cores: [BRANCO, LIMA, AZUL], n: 6, periodo: 28, escala: 5.4, orienta: "reto", balanco: 4 },
    { trilho: "esteira-2", formas: ["vestido", "camiseta", "camiseta"], cores: [LIMA, BRANCO, "#ffb38a"], n: 5, periodo: 22, escala: 5.4, orienta: "reto", balanco: 4, sentido: -1, fase: 0.06 },
    { trilho: "esteira-3", formas: ["camiseta", "vestido"], cores: [AZUL, "#ffb38a", BRANCO], n: 6, periodo: 34, escala: 5.4, orienta: "reto", balanco: 4, fase: 0.11 },
  ],
  frente: moldura(BRANCO, 0.45),
};
