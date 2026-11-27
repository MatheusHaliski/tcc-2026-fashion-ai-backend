/**
 * As cartas que a bandeja oferece para uma vaga, puras: as que cabem primeiro (as que têm mais em comum com as
 * vizinhas na frente, depois as de maior OVR) e, por último, as que não cabem, apagadas e com o motivo. A ordem só
 * ajuda a ver; quem escolhe é a pessoa e quem julga é o servidor.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { emComumComVizinhas, type Atributo } from "@/lib/flair/montagem/afinidade";
import type { Cartas } from "@/lib/flair/montagem/mesa";

export interface Opcao {
  card: FlairCollectionCard;
  /** a posição da carta é a que a vaga pede (ou a vaga aceita qualquer uma) */
  cabe: boolean;
  /** a carta já está nesta vaga */
  aqui: boolean;
  /** vaga em que a carta está agora, se for outra (escolher troca ou move) */
  outraVaga: string | null;
  comum: Atributo[];
}

export function cabeNaVaga(card: Pick<FlairCollectionCard, "position">, posicao: string): boolean {
  return posicao === "ANY" || card.position === posicao;
}

/**
 * O que a vaga pede da peça (`accepts` do desafio): categoria e subcategoria, conferidas aqui só para ordenar a bandeja
 * (cor, estilo e o resto quem julga é o servidor, que conhece as famílias de cor da taxonomia).
 */
export function atendeAoPedido(card: Pick<FlairCollectionCard, "category" | "subcategory">, pedido?: Record<string, unknown> | null): boolean {
  const lista = (v: unknown) => (v == null ? null : (Array.isArray(v) ? v : [v]).map((x) => String(x).toLowerCase()));
  const ok = (v: unknown, valor?: string | null) => { const l = lista(v); return !l || (!!valor && l.includes(valor.toLowerCase())); };
  return ok(pedido?.category, card.category) && ok(pedido?.subcategory, card.subcategory);
}

export function opcoesDaVaga(banco: FlairCollectionCard[], vaga: string, posicao: string, cartas: Cartas, vizinhas: FlairCollectionCard[],
  pedido?: Record<string, unknown> | null): Opcao[] {
  const onde = new Map(Object.entries(cartas).map(([v, id]) => [id, v]));
  const opcoes = banco.map((card): Opcao => {
    const em = onde.get(card.id) ?? null;
    return {
      card,
      cabe: cabeNaVaga(card, posicao) && atendeAoPedido(card, pedido),
      aqui: em === vaga,
      outraVaga: em && em !== vaga ? em : null,
      comum: emComumComVizinhas(card, vizinhas),
    };
  });
  return opcoes.sort((a, b) => Number(b.cabe) - Number(a.cabe) || b.comum.length - a.comum.length || b.card.ovr - a.card.ovr || a.card.name.localeCompare(b.card.name));
}
