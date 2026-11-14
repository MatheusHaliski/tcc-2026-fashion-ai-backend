/**
 * Deck da partida (seção "O deck da partida"): tamanho máximo e cartas obrigatórias por posição. A conferência aqui só
 * orienta a tela; quem decide é o servidor (422 com o que falta ao abrir a partida).
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { DeckObrigatoria, DeckRegras, EfeitoItem } from "@/lib/flair/nucleos/types";

export interface ObrigatoriaStatus {
  regra: DeckObrigatoria;
  /** posições aceitas pela regra (vazio = qualquer) */
  posicoes: string[];
  tem: number;
  falta: number;
}

export interface DeckStatus {
  total: number;
  tamanhoMax: number | null;
  excesso: number;
  obrigatorias: ObrigatoriaStatus[];
  valido: boolean;
}

/** "SUP|VES" → ["SUP", "VES"]; "ANY" (ou vazio) → [] (qualquer posição). */
export function posicoesDaRegra(posicao: string | null | undefined): string[] {
  const p = (posicao ?? "").trim().toUpperCase();
  if (!p || p === "ANY" || p === "QUALQUER") return [];
  return p.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
}

export function conferirDeck(regras: DeckRegras, deck: FlairCollectionCard[]): DeckStatus {
  const obrigatorias = regras.obrigatorias.map((regra) => {
    const posicoes = posicoesDaRegra(regra.posicao);
    const tem = posicoes.length ? deck.filter((c) => posicoes.includes(c.position)).length : deck.length;
    return { regra, posicoes, tem, falta: Math.max(0, regra.quantidade - tem) };
  });
  const excesso = regras.tamanhoMax == null ? 0 : Math.max(0, deck.length - regras.tamanhoMax);
  const valido = deck.length > 0 && excesso === 0 && obrigatorias.every((o) => o.falta === 0);
  return { total: deck.length, tamanhoMax: regras.tamanhoMax, excesso, obrigatorias, valido };
}

/** Liga/desliga uma carta no deck sem passar do tamanho máximo. */
export function alternarCarta(deck: string[], id: string, tamanhoMax: number | null): string[] {
  if (deck.includes(id)) return deck.filter((x) => x !== id);
  return tamanhoMax != null && deck.length >= tamanhoMax ? deck : [...deck, id];
}

/** Peças da mesma família de cor que o Espelho 1 do Labirinto pede. */
export const PECAS_DO_ESPELHO = 3;

/**
 * O deck escolhido não abre o Espelho 1 do Labirinto sozinho? Conta as cartas de cada família de cor pelos selos do
 * servidor (FAMILIA_<COR>); com menos de 3 na família mais cheia, a tela avisa antes de a pessoa entrar. Só vale para o
 * espelho da base, com deck já começado e selos carregados.
 */
export function avisoDoDeck(codigo: string, rodada: string | null | undefined, efeitos: (EfeitoItem[] | undefined)[]): boolean {
  if (codigo !== "LABIRINTO" || (rodada && rodada !== "ESPELHO_1")) return false;
  if (efeitos.length === 0 || efeitos.some((e) => e === undefined)) return false;
  const porFamilia = new Map<string, number>();
  for (const itens of efeitos) {
    for (const item of itens ?? []) {
      if (item.codigo.startsWith("FAMILIA_")) porFamilia.set(item.codigo, (porFamilia.get(item.codigo) ?? 0) + 1);
    }
  }
  return Math.max(0, ...porFamilia.values()) < PECAS_DO_ESPELHO;
}
