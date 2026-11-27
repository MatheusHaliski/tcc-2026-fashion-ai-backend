"use client";
import type { CSSProperties } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { cardSceneEffect } from "@/lib/flair/modes/tactics";

export interface HandCard { id: string; name: string; imageUrl?: string | null; category?: string | null; rarity?: string | null; power?: number | null }

/**
 * A mão de cartas de roupa que vai para a partida, em leque: cada carta mostra a peça, o poder e o efeito que acende no
 * cenário quando entra (holofote, passarela, trilha no piso, brilho, aura completa ou vento — pela categoria). É o
 * mesmo efeito que o palco do confronto desenha na foto do modo.
 */
export function DeckHand({ cards, title }: { cards: HandCard[]; title?: string }) {
  const { t } = useI18n();
  if (!cards.length) return null;
  const shown = cards.slice(0, 12);
  const mid = (shown.length - 1) / 2;
  return (
    <figure className="deck-hand" aria-label={title ?? t("flair.arena.sua_mao", { n: cards.length })}>
      <figcaption className="label">{title ?? t("flair.arena.sua_mao", { n: cards.length })}</figcaption>
      <ul>
        {shown.map((c, i) => {
          const fx = cardSceneEffect(c.category);
          const style = { "--fan": `${(i - mid) * Math.min(6, 40 / shown.length)}deg`, "--lift": `${Math.abs(i - mid) * 3}px` } as CSSProperties;
          return (
            <li key={c.id} className={`deck-card fx-${fx} rarity-${(c.rarity ?? "standard").toLowerCase()}`} style={style}>
              {c.imageUrl ? <img src={mediaUrl(c.imageUrl)} alt="" loading="lazy" /> : <span className="deck-card-blank" aria-hidden>👗</span>}
              <b>{c.name}</b>
              <small>{c.power != null ? `${t("flair.arena.poder")} ${c.power} · ` : ""}{t(`flair.arena.efeito.${fx}`)}</small>
            </li>);
        })}
      </ul>
    </figure>
  );
}
