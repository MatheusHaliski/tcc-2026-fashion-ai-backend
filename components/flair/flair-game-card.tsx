"use client";
import { FashionCard, FashionCardBack, FashionCardFront } from "@/components/fashion-card";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { FlairPieceCardArt, FlairPieceCardBack, FlairPieceCardHeader } from "./flair-piece-card-art";
import { FlairPieceCardPanels } from "./flair-piece-card-panels";

/**
 * Carta FLAIR (FLAIR-UT §3, seção E da prancha): a cópia da peça que a pessoa gerou com "Converter para FLAIR".
 * Desde 06/11/2026 (docs/flair/carta-flair-peca-2026-11-06.md) ela tem a MESMA anatomia do card comum da peça
 * (components/piece-card.tsx): cabeçalho, foto (.pc-media), identificação (.pc-id) e a janela segmentada Info | Hype.
 * A única diferença é a arte de fundo por nível (FlairPieceCardArt: bronze, prata, ouro, especial) e a tinta sobre ela.
 * No cabeçalho, no lugar de quem publicou, ficam a nota (OVR em LED), a posição e o nível ESCRITO (nunca só pela cor);
 * o acabamento "raro" vem do Hype, não do preço. Dados ausentes aparecem como "—", nunca como zero.
 * Com `flip`, vira como o card comum (↻ no cabeçalho): carta de peça mostra o verso do card comum (HypeCardBack);
 * as demais, um verso simples com os atributos de jogo. Sem `flip` (escolha de carta, prévia), só a frente.
 */
export type FlairTier = "BRONZE" | "PRATA" | "OURO" | "ESPECIAL";
export const FLAIR_TIERS: FlairTier[] = ["ESPECIAL", "OURO", "PRATA", "BRONZE"];
export const HYPE_KEYS = ["POP", "RAR", "ENG", "LON", "TRD", "NOV", "ORI", "HYP"] as const;
const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
/** Temporada no idioma da pessoa (o motor grava SPRING, SUMMER…). */
export function seasonName(t: (k: string, v?: Record<string, unknown>) => string, season: string) {
  return SEASONS.includes(season) ? t(`pieceArt.season.${season}`) : season;
}

export interface FlairCollectionCard {
  id: string; originType: "PIECE" | "LOOK"; originId: string; season: string; tier: FlairTier; ovr: number; rare: boolean; position: string;
  name: string; brandName?: string | null; imageUrl?: string | null; category?: string | null; subcategory?: string | null;
  hype?: Partial<Record<(typeof HYPE_KEYS)[number], number | null>> | null; stats?: Record<string, number> | null; rarity?: string | null;
  ability?: { code?: string; name?: string; text?: string } | null; priceVerified: boolean; state: string; tradeable: boolean; acquiredVia: string;
  createdAt?: string; basis?: { priceUsed?: number | null; priceVerified?: boolean; cappedByUnverifiedPrice?: boolean } | null;
}

export function FlairGameCard({ card, size = "md", flip = true, interactive = true }: { card: FlairCollectionCard; size?: "sm" | "md" | "lg"; flip?: boolean;
  /** false = carta dentro de um botão (escolhedor de cartas): janela fixa, sem botões aninhados */ interactive?: boolean }) {
  const { t } = useI18n();
  const tierName = t(`flairCard.tier.${card.tier}`);
  const label = t("flairCard.aria", { tier: tierName, rare: card.rare ? ` ${t("flairCard.rare")}` : "", ovr: card.ovr, name: card.name, brand: card.brandName ? `, ${card.brandName}` : "" });
  const locked = card.state === "LOCKED_CHALLENGE";
  const classes = ["fai-card", "piece-card", "pc", "flair-piece-card", `fpc-${size}`, `tier-${card.tier.toLowerCase()}`, card.rare && "is-rare", locked && "is-locked"].filter(Boolean).join(" ");
  const front = (
    <article className={classes} data-card-mode="feed" aria-label={label}>
      <FlairPieceCardArt />
      <div className="pc-frame">
        <div className="pc-content">
          <FlairPieceCardHeader card={card} tierName={tierName} flip={flip} />
          <div className="pc-media fpc-media">
            {card.imageUrl ? <img src={mediaUrl(card.imageUrl)} alt="" loading="lazy" decoding="async" className="is-contain" /> : null}
          </div>
          <div className="pc-id">
            <span className="pc-name">{card.name}</span>
            <span className="pc-sub">{card.brandName ?? t("flairCard.semMarca")} · {t("flairCard.season", { season: seasonName(t, card.season) })}</span>
            <FlairPieceCardPanels card={card} interactive={interactive} />
          </div>
        </div>
      </div>
    </article>
  );
  if (!flip) return front;
  return (
    <FashionCard name={card.name} className={`fpc-flip fpc-${size}`}>
      <FashionCardFront>{front}</FashionCardFront>
      <FashionCardBack>
        {card.originType === "PIECE" ? <HypeCardBack type="PIECE" id={card.originId} name={card.name} /> : <FlairPieceCardBack card={card} />}
      </FashionCardBack>
    </FashionCard>
  );
}
