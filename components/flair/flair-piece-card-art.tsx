"use client";
import { CardFlipButton } from "@/components/fashion-card";
import { LedNumber } from "@/components/led-number";
import { useI18n } from "@/lib/i18n/i18n";
import { STAT_META } from "./flair-card";
import { seasonName, type FlairCollectionCard } from "./flair-game-card";

/**
 * Arte de fundo da carta FLAIR: a ÚNICA diferença visual para o card comum. Ocupa a camada artística do card em camadas
 * (.pc-art, atrás do container) com o metal do nível (--fpc-metal, definido por .tier-*) e o reflexo que corre pelo
 * metal; o brilho "raro" é um ::after da mesma camada. Decorativa: sem clique, sem foco, fora do leitor de tela.
 */
export function FlairPieceCardArt() {
  return <span className="pc-art fpc-art" aria-hidden="true"><i className="fpc-art-light" /></span>;
}

/**
 * Cabeçalho da carta no lugar de "quem publicou" do card comum: nota (OVR em LED) com a posição, o nível ESCRITO (nunca
 * só pelo metal) e, quando a carta está entregue num desafio, o texto do bloqueio. À direita, o ↻ de virar, como no card
 * comum (só quando a carta vira).
 */
export function FlairPieceCardHeader({ card, tierName, flip }: { card: FlairCollectionCard; tierName: string; flip: boolean }) {
  const { t } = useI18n();
  const locked = card.state === "LOCKED_CHALLENGE";
  return (
    <div className="c-header pc-header fpc-header">
      <span className="fpc-ovr tabular"><LedNumber value={card.ovr} /><small aria-hidden>{card.position}</small><span className="sr-only">{card.position}</span></span>
      <span className="c-who">
        <b className="fpc-tier">{tierName}{card.rare ? ` · ${t("flairCard.rare")}` : ""}</b>
        {locked ? <span>{t("flairCard.locked")}</span> : null}
      </span>
      {flip && <CardFlipButton side="front" />}
    </div>
  );
}

/**
 * Verso simples para cartas que não vêm de uma peça (look, programa): atributos de jogo em barras, Hype do snapshot,
 * habilidade, temporada e preço. Cartas de peça usam o mesmo verso do card comum (HypeCardBack).
 */
export function FlairPieceCardBack({ card }: { card: FlairCollectionCard }) {
  const { t, fmtPrice } = useI18n();
  const stats = Object.entries(card.stats ?? {});
  return (
    <article className="fai-card hype-back flair-piece-back" aria-label={t("flairCard.backLabel", { name: card.name })}>
      <header className="hype-back-head">
        <span className="min-w-0"><span className="hype-back-kicker">{t("flairCard.statsLabel")}</span><b className="fpc-back-title">{card.name}</b></span>
        <CardFlipButton side="back" />
      </header>
      <div className="hype-back-body">
        {stats.length ? (
          <ul className="fpc-bars">
            {stats.map(([k, v]) => <li key={k} title={STAT_META[k]?.hint ?? k}><span>{k}</span><span className="fpc-bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span><b className="tabular">{Math.round(v)}</b></li>)}
          </ul>
        ) : <p className="fpc-meta">{t("fashionHype.unavailable")}</p>}
        {card.ability?.name && <p className="fpc-meta"><b>{card.ability.name}</b>{card.ability.text ? ` · ${card.ability.text}` : ""}</p>}
        <p className="fpc-meta">{t("flairCard.season", { season: seasonName(t, card.season) })}</p>
        {card.basis?.priceUsed != null && <p className="fpc-meta">{t(card.priceVerified ? "flairCard.priceVerified" : "flairCard.priceTyped", { price: fmtPrice(card.basis.priceUsed) })}</p>}
        {card.basis?.cappedByUnverifiedPrice && <p className="fpc-meta">{t("flairCard.unverified")}</p>}
        {card.state === "LOCKED_CHALLENGE" && <p className="fpc-meta">{t("flairCard.locked")}</p>}
      </div>
    </article>
  );
}
