import { tr } from "@/lib/i18n/i18n";
import { LEVELS } from "@/lib/hype/model";
import type { FilterDef, FilterOption } from "@/components/filter-bar";

/**
 * HypeSort / HypeFilter para o FilterBar: Hype é FILTRO e ORDENAÇÃO (restringe e ordena os dados), nunca aba. Os valores
 * são os aceitos por /api/me/closet (sort, hypeLevel).
 */
export function hypeSortOptions(): FilterOption[] {
  return [
    { value: "hype_desc", label: tr("hype.sort.hype_desc") },
    { value: "hype_asc", label: tr("hype.sort.hype_asc") },
    { value: "growth", label: tr("hype.sort.growth") },
    { value: "worn", label: tr("hype.sort.worn") },
    { value: "least_worn", label: tr("hype.sort.least_worn") },
    { value: "rarity", label: tr("hype.sort.rarity") },
    { value: "idle", label: tr("hype.sort.idle") },
  ];
}

/** Faixa mínima de Hype (a partir de Nicho); "Sinal baixo" não filtra nada, então fica fora. */
export function hypeLevelFilter(): FilterDef {
  return {
    key: "hypeLevel",
    label: tr("hype.filter.level"),
    // "Todos" já é o primeiro chip do FilterBar
    options: LEVELS.slice(1).map((l) => ({ value: l, label: tr("hype.filter.level_min", { level: tr(`hype.level.${l}`) }) })),
  };
}
