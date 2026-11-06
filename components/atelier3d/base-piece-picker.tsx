"use client";
import { Field, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, subcategoryLabel } from "@/lib/api/taxonomy";
import { BASE_PIECE_CATEGORIES } from "@/lib/atelier3d/base-pieces";

export interface BasePieceChoice { category: string; subcategory: string }
export const DEFAULT_BASE_PIECE: BasePieceChoice = { category: "upper_piece", subcategory: "sweatshirt" };

/** Categoria e subcategoria da taxonomia que têm peça base (GLB publicado ou base procedural). */
export function BasePiecePicker({ value, onChange, disabled }: { value: BasePieceChoice; onChange: (next: BasePieceChoice) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const categories = Object.keys(BASE_PIECE_CATEGORIES);
  return <>
    <Field id="base-piece-category" label={t("atelier3d.create.category")}>
      <Select id="base-piece-category" disabled={disabled} value={value.category} onChange={(event) => {
        const category = event.target.value;
        onChange({ category, subcategory: BASE_PIECE_CATEGORIES[category][0] });
      }}>
        {categories.map((category) => <option key={category} value={category}>{CATEGORY_LABEL[category] ?? category}</option>)}
      </Select>
    </Field>
    <Field id="base-piece-subcategory" label={t("atelier3d.create.subcategory")}>
      <Select id="base-piece-subcategory" disabled={disabled} value={value.subcategory} onChange={(event) => onChange({ ...value, subcategory: event.target.value })}>
        {BASE_PIECE_CATEGORIES[value.category].map((subcategory) => <option key={subcategory} value={subcategory}>{subcategoryLabel(subcategory)}</option>)}
      </Select>
    </Field>
  </>;
}
