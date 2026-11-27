/**
 * O acabamento do uniforme pintado no avatar (rodada zonas: "o avatar veste só a cor dominante"). Além das peças na cor
 * das zonas (pecas-pintadas.ts), cada jogo ganha os adereços que fazem a roupa se ler como o que ela é: a camisa do
 * clube com o escudo no peito, o número nas costas e a gola de contraste; o figurino do show com a estrela no peito e as
 * dragonas metálicas; o macacão do piloto com o número, o cinto e, na pista, o capacete com a viseira; o traje do herói
 * com o emblema escolhido, o cinto e a capa. As cores e o acabamento (fosco, brilhante, metálico, espelhado) são os das
 * zonas que a pessoa pintou; nada é logo, nome ou escudo real. Só a descrição: quem desenha é a cena. Puro.
 */
import type { NucleoCodigo, ZonaEscolha } from "@/lib/flair/nucleos/types";

export type Osso = "Spine2" | "Hips" | "Neck" | "Head" | "LeftShoulder" | "RightShoulder";
export type Forma = "NUMERO" | "ESCUDO" | "ESTRELA" | "RAIO" | "ASA" | "LISTRAS";

/** Uma estampa colada na roupa (frente ou costas do tronco): a forma, as cores e o texto (o número). */
export interface Estampa {
  tipo: "ESTAMPA";
  lado: "FRENTE" | "COSTAS";
  forma: Forma;
  /** a cor principal, a de contraste e a do contorno */
  cores: [string, string, string];
  texto?: string;
  /** a altura (em metros, a partir do osso do peito) e o lado (x, negativo = direita da personagem) */
  y: number;
  x: number;
  largura: number;
  altura: number;
  acabamento: string;
  /** o emblema do herói: a forma vai sobre um losango de contraste */
  selo?: boolean;
}

/** Uma peça a mais presa ao esqueleto: a gola, o cinto, as dragonas, a capa e o capacete. */
export interface Adereco {
  tipo: "GOLA" | "CINTO" | "DRAGONA" | "CAPA" | "CAPACETE";
  osso: Osso;
  cor: string;
  /** a segunda cor (a faixa do capacete, a fivela do cinto, o forro da capa) e a terceira (a viseira) */
  cor2: string;
  cor3?: string;
  acabamento: string;
  /** só na fase de uso (o capacete não cobre o rosto no ateliê) */
  soNoUso?: boolean;
}

export type ItemDoUniforme = Estampa | Adereco;

const BRANCO = "#F4F4F2";
const PRETO = "#151515";

/** A primeira zona pintada da lista, com a cor e o acabamento dela. */
function zona(zonas: Record<string, ZonaEscolha>, ...nomes: string[]): { cor: string; acabamento: string } | null {
  for (const n of nomes) {
    const z = zonas[n];
    if (z?.cor) return { cor: z.cor, acabamento: z.acabamento ?? "FOSCO" };
  }
  return null;
}

/** Claro sobre escuro: a cor de contraste legível sobre a dada (branco ou quase preto). */
export function contraste(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return BRANCO;
  const n = parseInt(m[1], 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.6 ? PRETO : BRANCO;
}

/** O número da camisa e do macacão: sai da semente da partida (1 a 99), sem semente o 10. */
export function numeroDaCamisa(semente: number | undefined): string {
  if (semente == null || !Number.isFinite(semente)) return "10";
  return String((Math.abs(Math.trunc(semente)) % 99) + 1);
}

const EMBLEMAS: Record<string, Forma> = { EMBLEMA_ESTRELA: "ESTRELA", EMBLEMA_RAIO: "RAIO", EMBLEMA_ASA: "ASA" };

const estampa = (lado: Estampa["lado"], forma: Forma, cores: [string, string, string], medida: Pick<Estampa, "y" | "x" | "largura" | "altura">, acabamento = "FOSCO", texto?: string): Estampa =>
  ({ tipo: "ESTAMPA", lado, forma, cores, texto, acabamento, ...medida });

/** Os adereços e as estampas do uniforme de cada jogo de zonas (vazio sem nenhuma zona pintada). */
export function uniformeDasZonas(codigo: NucleoCodigo, zonas: Record<string, ZonaEscolha> | undefined, emblema?: string | null, semente?: number): ItemDoUniforme[] {
  if (!zonas) return [];
  const numero = numeroDaCamisa(semente);
  if (codigo === "CLUBE_CORACAO") {
    const corpo = zona(zonas, "FRENTE", "COSTAS", "MANGAS");
    if (!corpo) return [];
    const costas = zona(zonas, "COSTAS", "FRENTE") ?? corpo;
    const gola = zona(zonas, "GOLA", "MANGAS") ?? { cor: contraste(corpo.cor), acabamento: "FOSCO" };
    return [
      estampa("FRENTE", "ESCUDO", [gola.cor, corpo.cor, contraste(corpo.cor)], { y: 0.07, x: -0.075, largura: 0.09, altura: 0.105 }),
      estampa("COSTAS", "NUMERO", [contraste(costas.cor), gola.cor, contraste(costas.cor)], { y: 0.03, x: 0, largura: 0.2, altura: 0.2 }, "FOSCO", numero),
      { tipo: "GOLA", osso: "Neck", cor: gola.cor, cor2: corpo.cor, acabamento: gola.acabamento },
    ];
  }
  if (codigo === "FAVORITE_SINGER") {
    const corpo = zona(zonas, "FRENTE", "CORPO", "COSTAS", "MANGAS");
    if (!corpo) return [];
    const brilho = zona(zonas, "FERRAGENS", "GOLA", "MANGAS") ?? { cor: "#D9C48A", acabamento: "METALICO" };
    const fin = brilho.acabamento === "FOSCO" ? "METALICO" : brilho.acabamento;
    return [
      // a jaqueta fica aberta: a estrela vai no peito esquerdo, na lapela
      estampa("FRENTE", "ESTRELA", [brilho.cor, corpo.cor, contraste(corpo.cor)], { y: 0.06, x: -0.085, largura: 0.08, altura: 0.08 }, fin),
      estampa("COSTAS", "LISTRAS", [brilho.cor, corpo.cor, brilho.cor], { y: 0.02, x: 0, largura: 0.22, altura: 0.22 }, fin),
      { tipo: "DRAGONA", osso: "LeftShoulder", cor: brilho.cor, cor2: corpo.cor, acabamento: fin },
      { tipo: "DRAGONA", osso: "RightShoulder", cor: brilho.cor, cor2: corpo.cor, acabamento: fin },
      { tipo: "GOLA", osso: "Neck", cor: brilho.cor, cor2: corpo.cor, acabamento: fin },
    ];
  }
  if (codigo === "PILOTO_FAVORITO") {
    const corpo = zona(zonas, "TRONCO", "TOPO", "LATERAIS", "CABEDAL");
    if (!corpo) return [];
    const faixa = zona(zonas, "MANGAS", "FAIXA_VISEIRA", "LATERAIS", "GOLA") ?? { cor: contraste(corpo.cor), acabamento: "FOSCO" };
    const casco = zona(zonas, "TOPO", "TRONCO") ?? corpo;
    const viseira = zona(zonas, "VISEIRA") ?? { cor: "#1A1D24", acabamento: "ESPELHADO" };
    const cinto = zona(zonas, "CINTO", "GOLA") ?? { cor: PRETO, acabamento: "FOSCO" };
    return [
      estampa("FRENTE", "NUMERO", [contraste(corpo.cor), faixa.cor, contraste(corpo.cor)], { y: 0.06, x: -0.06, largura: 0.08, altura: 0.08 }, "FOSCO", numero),
      estampa("COSTAS", "NUMERO", [contraste(corpo.cor), faixa.cor, contraste(corpo.cor)], { y: 0.03, x: 0, largura: 0.18, altura: 0.18 }, "FOSCO", numero),
      estampa("FRENTE", "LISTRAS", [faixa.cor, corpo.cor, faixa.cor], { y: -0.06, x: 0.06, largura: 0.06, altura: 0.16 }),
      { tipo: "GOLA", osso: "Neck", cor: faixa.cor, cor2: corpo.cor, acabamento: faixa.acabamento },
      { tipo: "CINTO", osso: "Hips", cor: cinto.cor, cor2: "#C9CDD3", acabamento: cinto.acabamento },
      { tipo: "CAPACETE", osso: "Head", cor: casco.cor, cor2: faixa.cor, cor3: viseira.cor, acabamento: viseira.acabamento, soNoUso: true },
    ];
  }
  if (codigo === "SUPER_HEROI") {
    const peito = zona(zonas, "PEITO", "BRACOS");
    if (!peito) return [];
    const capa = zona(zonas, "CAPA", "BRACOS");
    const forma = EMBLEMAS[emblema ?? ""] ?? "ESTRELA";
    const destaque = capa?.cor ?? contraste(peito.cor);
    const itens: ItemDoUniforme[] = [
      { ...estampa("FRENTE", forma, [destaque, peito.cor, contraste(peito.cor)], { y: 0.06, x: 0, largura: 0.15, altura: 0.15 }, peito.acabamento), selo: true },
      { tipo: "CINTO", osso: "Hips", cor: destaque, cor2: "#E0B04D", acabamento: "METALICO" },
    ];
    if (capa) itens.push({ tipo: "CAPA", osso: "Spine2", cor: capa.cor, cor2: peito.cor, acabamento: capa.acabamento });
    return itens;
  }
  return [];
}
