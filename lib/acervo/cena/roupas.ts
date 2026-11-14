/**
 * ACERVO — as peças dentro dos compartimentos, como formas simples e coloridas: penduradas no cabideiro, dobradas em
 * pilhas na prateleira e em fileiras dentro da gaveta. Um item da lista de desejos em simulação entra como
 * peça-fantasma. Medidas em metros, no mesmo sistema do móvel (lib/acervo/cena/modelo.ts).
 */
import type { Celula, Planta } from "@/lib/acervo/planta";
import type { V3 } from "./modelo";

export interface RoupaNaCena {
  /** id da peça, ou do desejo quando é fantasma */
  id: string;
  fantasma: boolean;
  categoria: string;
  cor: string;
  tam: V3;
  pos: V3;
  compartimentoId: string;
}

export interface ItemDoCompartimento {
  id: string;
  categoria: string;
  cor: string;
  fantasma?: boolean;
}

const M = 0.01;
const PASSO_CABIDE = 0.055;
const DOBRADA: V3 = [0.26, 0.035, 0.3];
const CALCADO: V3 = [0.1, 0.09, 0.26];

/** Altura (m) da peça pendurada conforme a categoria. */
function alturaPendurada(categoria: string, vao: number): number {
  const ideal = categoria === "full_body_piece" ? 1.05 : categoria === "lower_piece" ? 0.95 : 0.62;
  return Math.max(0.2, Math.min(ideal, vao - 0.14));
}

function penduradas(p: Planta, c: Celula, itens: ItemDoCompartimento[]): RoupaNaCena[] {
  const [x, y, w, h] = [c.x * M, c.y * M, c.w * M, c.h * M];
  const cabem = Math.max(1, Math.floor((w - 0.08) / PASSO_CABIDE));
  const visiveis = itens.slice(0, cabem);
  const passo = Math.min(PASSO_CABIDE * 1.6, (w - 0.08) / Math.max(1, visiveis.length));
  const inicio = x + w / 2 - (passo * (visiveis.length - 1)) / 2;
  const fundura = Math.min(0.42, p.profundidade * M - 0.12);
  return visiveis.map((item, i) => {
    const altura = alturaPendurada(item.categoria, h);
    return { id: item.id, fantasma: !!item.fantasma, categoria: item.categoria, cor: item.cor, compartimentoId: c.id,
      tam: [0.034, altura, fundura], pos: [inicio + i * passo, y + h - 0.1 - altura / 2, -p.profundidade * M / 2] };
  });
}

function dobradas(p: Planta, c: Celula, itens: ItemDoCompartimento[], naGaveta: boolean): RoupaNaCena[] {
  const [x, y, w, h] = [c.x * M, c.y * M, c.w * M, c.h * M];
  const colunas = Math.max(1, Math.floor((w - 0.04) / (DOBRADA[0] + 0.03)));
  const porPilha = naGaveta ? 2 : Math.max(1, Math.floor((h - 0.06) / DOBRADA[1]));
  const passo = (w - 0.04) / colunas;
  const out: RoupaNaCena[] = [];
  itens.slice(0, colunas * porPilha).forEach((item, i) => {
    const coluna = i % colunas;
    const andar = Math.floor(i / colunas);
    const calcado = item.categoria === "shoes_piece";
    const tam = calcado ? CALCADO : DOBRADA;
    const base = y + (naGaveta ? 0.02 : 0.012);
    out.push({ id: item.id, fantasma: !!item.fantasma, categoria: item.categoria, cor: item.cor, compartimentoId: c.id, tam,
      pos: [x + 0.02 + passo * (coluna + 0.5), base + tam[1] / 2 + andar * (tam[1] + 0.004), -p.profundidade * M / 2 + (naGaveta ? 0 : 0.04)] });
  });
  return out;
}

/** Formas das peças (e fantasmas) de um compartimento. */
export function roupasDaCelula(p: Planta, c: Celula, itens: ItemDoCompartimento[]): RoupaNaCena[] {
  if (itens.length === 0) return [];
  if (c.tipo === "CABIDEIRO") return penduradas(p, c, itens);
  return dobradas(p, c, itens, c.tipo === "GAVETA");
}
