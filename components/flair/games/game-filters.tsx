"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { FILTERS, hasFilter, type GameCounts, type GameFilters as Filters } from "@/lib/flair/games";
import { Button, Chip, Input } from "@/components/ui";
import { useGameLabels } from "@/components/flair/games/game-card";

type Axis = "level" | "wardrobe" | "difficulty" | "rarity" | "series" | "district";

/**
 * Barra de filtros do catálogo: um grupo de chips por eixo (nível de XP, guarda-roupa, dificuldade, raridade, série,
 * distrito), o toggle "Só o que posso jogar" e a busca. Cada chip liga/desliga um valor (um por eixo); o estado vive
 * na URL (parse/serialize em lib/flair/games.ts) e é aplicado sobre a lista inteira no cliente.
 */
export function GameFilters({ value, onChange, counts }: { value: Filters; onChange: (f: Filters) => void; counts?: GameCounts | null }) {
  const { t } = useI18n(); const L = useGameLabels();
  const searchId = useId();
  const set = (k: Axis, v: string) => onChange({ ...value, [k]: value[k] === v ? null : v });
  const axes: { k: Axis; values: readonly string[]; label: (v: string) => string; count?: Record<string, number> }[] = [
    { k: "level", values: FILTERS.levels, label: L.tier, count: counts?.byTier },
    { k: "wardrobe", values: FILTERS.wardrobeLevels, label: L.wardrobe },
    { k: "difficulty", values: FILTERS.difficulties, label: (v) => t(`cbc.difficulty.${v}`), count: counts?.byDifficulty },
    { k: "rarity", values: FILTERS.rarities, label: L.rarity, count: counts?.byRarity },
    { k: "series", values: FILTERS.series, label: (v) => t("games.series.short", { series: v }), count: counts?.bySeries },
    { k: "district", values: FILTERS.districts, label: L.district },
  ];
  return (
    <div className="ge-filters" role="group" aria-label={t("games.filters.label")}>
      {axes.map((a) => (
        <div key={a.k} className="ge-filter" role="group" aria-label={t(`games.filters.${a.k}`)}>
          <span className="ge-filter-name" aria-hidden>{t(`games.filters.${a.k}`)}</span>
          <div className="ge-filter-chips">
            {a.values.map((v) => (
              <Chip key={v} active={value[a.k] === v} onClick={() => set(a.k, v)}>
                {a.label(v)}{a.count && a.count[v] != null ? <small className="tabular"> {a.count[v]}</small> : null}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <div className="ge-filter-foot">
        <div className="ge-filter-search">
          <label htmlFor={searchId} className="sr-only">{t("games.filters.search")}</label>
          <Input id={searchId} type="search" value={value.q ?? ""} placeholder={t("games.filters.search")} onChange={(e) => onChange({ ...value, q: e.target.value || null })} />
        </div>
        <Chip active={!!value.playable} onClick={() => onChange({ ...value, playable: !value.playable })}>{t("games.filters.playable")}</Chip>
        {hasFilter(value) && <Button size="sm" onClick={() => onChange({})}>{t("games.filters.clear")}</Button>}
      </div>
    </div>
  );
}
