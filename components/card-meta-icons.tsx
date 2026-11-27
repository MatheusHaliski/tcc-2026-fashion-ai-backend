"use client";
/**
 * Ícones das células de informação dos cards de peça e de look: as peças do look como mini-ilustrações (o asset
 * padrão FAI da categoria, na cor da peça), as ocasiões com os ícones FAI e a estação com um glifo. Todo ícone leva o
 * nome por extenso em title/alt; texto visível só onde não há ícone que diga o mesmo.
 */
import { FaiIcon } from "@/components/fai-icon";
import { CATEGORY_LABEL, label, subcategoryLabel } from "@/lib/api/taxonomy";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { occasionIconId, type SeasonCode } from "@/lib/cards/card-icons";

export interface CardPieceRef { name: string; category?: string | null; subcategory?: string | null; colorHex?: string | null; color?: string | null }

const tipoDaPeca = (p: CardPieceRef) => subcategoryLabel(p.subcategory ?? "") || (p.category ? CATEGORY_LABEL[p.category] : "") || "";

/** As peças do look, uma mini-ilustração por peça (categoria + cor); o nome de cada uma fica no title/alt. */
export function CardPieceIcons({ pieces, max = 6 }: { pieces: CardPieceRef[]; max?: number }) {
  const nomes = pieces.map((p) => [tipoDaPeca(p), p.name].filter(Boolean).join(" · "));
  return (
    <span className="card-piece-icons" role="list" aria-label={nomes.join("; ")}>
      {pieces.slice(0, max).map((p, i) => (
        <span key={i} role="listitem" className="card-piece-icon" title={nomes[i]}>
          <img src={defaultGarmentUrl(p.category, p.subcategory, p.colorHex, p.color)} alt={nomes[i]} width={30} height={30} loading="lazy" decoding="async" draggable={false} />
        </span>
      ))}
      {pieces.length > max && <span className="card-meta-more" aria-hidden>+{pieces.length - max}</span>}
    </span>
  );
}

/** Ocasiões: ícone FAI para as conhecidas, texto para as demais. */
export function CardOccasionIcons({ values, max = 3 }: { values: string[]; max?: number }) {
  const nomes = values.map((v) => label(v));
  return (
    <span className="card-occasion-icons" title={nomes.join(" · ")} aria-label={nomes.join(" · ")}>
      {values.slice(0, max).map((v, i) => {
        const id = occasionIconId(v);
        return id ? <FaiIcon key={v} id={id} size={24} title={nomes[i]} /> : <span key={v} className="card-occasion-text">{nomes[i]}</span>;
      })}
      {values.length > max && <span className="card-meta-more" aria-hidden>+{values.length - max}</span>}
    </span>
  );
}

const SEASON_PATH: Record<SeasonCode, string> = {
  SPRING: "M12 21v-8M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5zM12 8a3 3 0 0 1 0-6 3 3 0 0 1 0 6z",
  SUMMER: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  AUTUMN: "M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19l8-8",
  WINTER: "M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2",
};

/** Glifo da estação ao lado do nome (uma palavra só: o texto continua). */
export function SeasonGlyph({ season }: { season: SeasonCode }) {
  return (
    <svg className="card-season-glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={SEASON_PATH[season]} /></svg>
  );
}
