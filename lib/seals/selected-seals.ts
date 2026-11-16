export interface SelectedSeal {
  targetOwnerId: string;
  kind: "BRAND" | "CELEBRITY";
  name: string;
}

export function selectedSealsFromBackground(background?: Record<string, unknown> | null): SelectedSeal[] {
  if (!Array.isArray(background?.selectedSeals)) return [];
  return background.selectedSeals.filter((item): item is SelectedSeal =>
    !!item && typeof item === "object" && typeof item.targetOwnerId === "string" &&
    (item.kind === "BRAND" || item.kind === "CELEBRITY") && typeof item.name === "string" && !!item.name.trim());
}

export function selectedPieceSealNames(seals?: string[] | null): string[] {
  return (seals ?? []).flatMap((seal) => {
    const match = /^(?:BRAND|CELEBRITY):(.+)$/.exec(seal);
    return match ? [match[1]] : [];
  });
}
