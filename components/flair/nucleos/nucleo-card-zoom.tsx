"use client";
/**
 * Carta ampliada (toque longo ou tecla I): aqui aparecem o nome, a marca, o nível escrito, a nota, o Hype e todos os
 * efeitos da carta neste jogo, que não cabem na carta do deck. Fecha com Esc, com I ou pelo botão.
 */
import { cn } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { HudIcon } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

interface Props {
  card: FlairCollectionCard;
  /** efeitos da carta neste jogo (undefined = o servidor ainda não respondeu) */
  itens: EfeitoItem[] | undefined;
  onFechar: () => void;
}

export function NucleoCardZoom({ card, itens, onFechar }: Props) {
  const tx = useNucleoText();
  const hype = card.hype?.HYP;
  const fechar = tx.t("flair3d.ui.zoom.close");
  return (
    <div className="n3d-zoom" role="dialog" aria-modal="true" aria-labelledby="n3d-zoom-name" data-testid="nucleo-card-zoom">
      <div className="n3d-zoom-backdrop" onClick={onFechar} aria-hidden />
      <article className={cn("n3d-zoom-card", `tier-${card.tier.toLowerCase()}`)}>
        <header className="n3d-zoom-head">
          <span className="n3d-zoom-tier">{tx.t(`flairCard.tier.${card.tier}`)}</span>
          <span className="tabular">{tx.t("flair3d.ui.zoom.ovr", { n: card.ovr })}</span>
          <span>{tx.posicao(card.position)}</span>
        </header>
        <div className="n3d-zoom-photo">
          {card.imageUrl ? <img src={mediaUrl(card.imageUrl)} alt="" decoding="async" /> : null}
        </div>
        <h3 id="n3d-zoom-name" className="n3d-zoom-name">{card.name}</h3>
        <p className="n3d-zoom-brand">{card.brandName ?? tx.t("flairCard.semMarca")}</p>
        <p className="n3d-zoom-hype tabular">{tx.t("flair3d.ui.zoom.hype", { n: hype ?? "—" })}</p>
        {itens && (
          <ul className="n3d-zoom-fx" aria-label={tx.t("flair3d.ui.zoom.effects")}>
            {itens.length === 0 && <li className="n3d-badge is-none">{tx.t("flair3d.ui.deck.noEffect")}</li>}
            {itens.map((e, i) => (
              <li key={i} className="n3d-badge">{tx.efeito(e)}</li>
            ))}
          </ul>
        )}
        <button type="button" className="n3d-icon-btn n3d-zoom-close" aria-label={fechar} title={fechar} autoFocus onClick={onFechar}>
          <HudIcon name="fechar" />
        </button>
      </article>
    </div>
  );
}
