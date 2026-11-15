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

export function opcoesDaVaga(banco: FlairCollectionCard[], vaga: string, posicao: string, cartas: Cartas, vizinhas: FlairCollectionCard[]): Opcao[] {
  const onde = new Map(Object.entries(cartas).map(([v, id]) => [id, v]));
  const opcoes = banco.map((card): Opcao => {
    const em = onde.get(card.id) ?? null;
    return {
      card,
      cabe: cabeNaVaga(card, posicao),
      aqui: em === vaga,
      outraVaga: em && em !== vaga ? em : null,
      comum: emComumComVizinhas(card, vizinhas),
    };
  });
  return opcoes.sort((a, b) => Number(b.cabe) - Number(a.cabe) || b.comum.length - a.comum.length || b.card.ovr - a.card.ovr || a.card.name.localeCompare(b.card.name));
}
