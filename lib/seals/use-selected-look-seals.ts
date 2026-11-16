"use client";

import { useState } from "react";
import type { SealSearch } from "@/components/look-seal-verification";
import { selectedSealsFromBackground, type SelectedSeal } from "@/lib/seals/selected-seals";

export function useSelectedLookSeals(background: Record<string, unknown> | null | undefined, search: SealSearch) {
  const [selected, setSelected] = useState<SelectedSeal[]>(() => selectedSealsFromBackground(background));
  const list = [...search.list, ...selected.filter((seal) => !search.list.some((option) => option.targetOwnerId === seal.targetOwnerId))];
  const onToggle = (id: string) => {
    const option = list.find((item) => item.targetOwnerId === id);
    if (!option) return;
    setSelected((current) => current.some((item) => item.targetOwnerId === id)
      ? current.filter((item) => item.targetOwnerId !== id)
      : [...current, { targetOwnerId: option.targetOwnerId, kind: option.kind, name: option.name }]);
  };
  return { selected, search: { ...search, list }, picked: selected.map((item) => item.targetOwnerId), onToggle };
}
