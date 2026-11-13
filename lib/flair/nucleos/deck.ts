/**
 * Deck da partida (seção "O deck da partida"): tamanho máximo e cartas obrigatórias por posição. A conferência aqui só
 * orienta a tela; quem decide é o servidor (422 com o que falta ao abrir a partida).
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { DeckObrigatoria, DeckRegras } from "@/lib/flair/nucleos/types";

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
