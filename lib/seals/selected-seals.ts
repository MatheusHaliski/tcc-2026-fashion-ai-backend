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

/** Selo escolhido como o card o mostra: a chave "BRAND:Nome" / "CELEBRITY:Nome" (busca a arte) e o nome. */
export interface SelectedSealRef { key: string; name: string }

export function selectedPieceSeals(seals?: string[] | null): SelectedSealRef[] {
  return (seals ?? []).flatMap((seal) => {
    const match = /^(?:BRAND|CELEBRITY):(.+)$/.exec(seal);
    return match ? [{ key: seal, name: match[1] }] : [];
  });
}

export function selectedLookSeals(background?: Record<string, unknown> | null): SelectedSealRef[] {
  return selectedSealsFromBackground(background).map((seal) => ({ key: `${seal.kind}:${seal.name}`, name: seal.name }));
}
