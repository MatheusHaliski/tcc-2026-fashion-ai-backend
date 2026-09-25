"use client";
import { label } from "@/lib/api/taxonomy";
import { cn } from "@/components/ui";
import { tr, useI18n } from "@/lib/i18n/i18n";

/** Tipos do FLAIR (espelham FlairEngine no backend). */
export interface FlairAbility { code: string; label: string; description: string; }
export interface FlairCard {
  id: string; name: string; category: string; subcategory: string; imageUrl?: string | null; colorHex?: string | null; brandName?: string | null;
  styles: string[]; occasions: string[]; material?: string | null; season: string; stats: Record<string, number>; rarity: string; multiplier: number; power: number;
  ability?: FlairAbility | null;
}
export interface FlairCombo { code: string; label: string; points: number; }
export interface FlairDeck {
  schemeId: string | null; title: string; cards: FlairCard[]; combos: FlairCombo[]; brandMultiplier: number; topBrand?: string | null; seasonBonus: number;
  power: number; avg: Record<string, number>; abilities: FlairAbility[];
}
export interface FlairRound { stat: string; a: number; b: number; winner: "A" | "B" | "DRAW"; notes: string[]; }

export const STAT_META: Record<string, { label: string; hint: string; color: string }> = {
  EDGE: { label: "EDGE", get hint() { return tr("flair.flairCard.ousadia_vem_dos_estilos_da"); }, color: "#E0457B" },
  RANGE: { label: "RANGE", get hint() { return tr("flair.flairCard.versatilidade_20_por_ocasiao"); }, color: "#2D55C9" },
  CLOUT: { label: "CLOUT", get hint() { return tr("flair.flairCard.forca_da_marca_e_selos"); }, color: "#B8860B" },
  GLOW: { label: "GLOW", get hint() { return tr("flair.flairCard.qualidade_da_foto_estudio_88"); }, color: "#E9B949" },
  ART: { label: "ART", get hint() { return tr("flair.flairCard.estudio_logo_3d_e_foto"); }, color: "#7B4FD6" },
  SYNC: { label: "SYNC", get hint() { return tr("flair.flairCard.sintonia_com_a_estacao_atual"); }, color: "#1F7A76" },
};
export const RARITY_META: Record<string, { label: string; frame: string; glow: string }> = {
  STANDARD: { get label() { return tr("flair.flairCard.standard"); }, frame: "linear-gradient(135deg,#d9d6cf,#b9b4aa)", glow: "transparent" },
  PREMIUM: { get label() { return tr("flair.flairCard.premium"); }, frame: "linear-gradient(135deg,#9fb7e8,#2D55C9)", glow: "rgba(45,85,201,.35)" },
  LIMITED: { get label() { return tr("flair.flairCard.limited"); }, frame: "linear-gradient(135deg,#c9a7ff,#7B4FD6)", glow: "rgba(123,79,214,.4)" },
  RARE: { get label() { return tr("flair.flairCard.rare"); }, frame: "linear-gradient(135deg,#ffe29a,#c8961e 45%,#fff3c4 60%,#b8860b)", glow: "rgba(232,185,73,.55)" },
};
export const SEASON_LABEL: Record<string, string> = { get SUMMER() { return tr("flair.flairCard.verao"); }, get AUTUMN() { return tr("flair.flairCard.outono"); }, get WINTER() { return tr("flair.flairCard.inverno"); }, get SPRING() { return tr("flair.flairCard.primavera"); }, get ALL() { return tr("flair.todas"); } };
const SKIN_BG: Record<string, string> = {
  BRAND_FRAME: "repeating-linear-gradient(45deg,#1f2a44 0 6px,#26345a 6px 12px)",
  HOLOGRAFICO: "linear-gradient(120deg,#ffd1f0,#c7f0ff,#e8ffc7,#ffe6c7,#e0d1ff)",
  CHAMPION: "linear-gradient(160deg,#141414,#3a2f12 60%,#8a6a1c)",
};

/** Carta FLAIR: moldura por raridade, foto da peça, poder, 6 atributos e a habilidade especial. */
export function FlairCardView({ card, skin, size = "md", selected, onClick, dim }: { card: FlairCard; skin?: string | null; size?: "sm" | "md"; selected?: boolean; onClick?: () => void; dim?: boolean }) {
  const { t } = useI18n();
  const r = RARITY_META[card.rarity] ?? RARITY_META.STANDARD;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("flair-card text-left", size === "sm" && "flair-card-sm", selected && "flair-card-selected", dim && "opacity-40")}
      style={{ background: r.frame, boxShadow: `0 6px 22px ${r.glow}` }}
      aria-label={t("flair.flairCard.carta_poder", { name: card.name, label: r.label, power: card.power })}>
      <div className="flair-card-inner" style={skin && SKIN_BG[skin] ? { background: SKIN_BG[skin] } : undefined}>
        <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
          <span className="flair-rarity">{r.label}</span>
          <span className="flair-power tabular" title={t("flair.flairCard.poder_da_carta")}>{card.power}</span>
        </div>
        <div className="flair-art" style={{ background: card.colorHex ? `radial-gradient(circle at 50% 40%, #fff 0%, ${card.colorHex}22 70%)` : undefined }}>
          {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" draggable={false} /> : <span className="type-caption text-faint">{label(card.subcategory)}</span>}
          {card.brandName && <span className="flair-brand">{card.brandName}</span>}
        </div>
        <p className="flair-name" title={card.name}>{card.name}</p>
        <p className="flair-sub">{label(card.category)} · {SEASON_LABEL[card.season] ?? card.season}</p>
        {size === "md" && (
          <ul className="flair-stats">
            {Object.entries(card.stats).map(([k, v]) => (
              <li key={k} title={STAT_META[k]?.hint}>
                <span>{k}</span><i><b style={{ width: `${v}%`, background: STAT_META[k]?.color }} /></i><em className="tabular">{v}</em>
              </li>
            ))}
          </ul>
        )}
        {card.ability && <p className="flair-ability" title={card.ability.description}>★ {card.ability.label}</p>}
      </div>
    </Tag>
  );
}

/** Resumo de um deck (esquema): poder, combos, marca e os atributos médios. */
export function DeckSummary({ deck, compact }: { deck: FlairDeck; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-h3 min-w-0 flex-1 truncate">{deck.title}</p>
        <span className="flair-power tabular" title={t("flair.flairCard.poder_do_deck")}>{deck.power}</span>
      </div>
      <p className="type-caption text-muted">{t("flair.flairCard.cartas", { cardsCount: deck.cards.length, value: deck.brandMultiplier > 1 ? ` · ×${deck.brandMultiplier.toFixed(2)} ${deck.topBrand ?? ""}` : "", value2: deck.seasonBonus ? t("flair.flairCard.estacao", { seasonBonus: deck.seasonBonus }) : "" })}{deck.abilities.length ? ` · ${deck.abilities.map((a) => a.label).join(", ")}` : ""}
      </p>
      {!compact && deck.combos.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{deck.combos.map((c) => <span key={c.code} className="flair-combo">{c.label} +{c.points}</span>)}</div>}
      {!compact && (
        <div className="mt-2 grid grid-cols-6 gap-1">
          {Object.entries(deck.avg).map(([k, v]) => (
            <div key={k} className="flair-avg" title={STAT_META[k]?.hint}><span>{k}</span><b className="tabular" style={{ color: STAT_META[k]?.color }}>{v}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}
