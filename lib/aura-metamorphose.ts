export const AURA_METAMORPHOSE_BRAND_PRESETS = [
  {
    id: "NIKE_ORANGE",
    brand: "Nike",
    garmentColor: "orange",
    mode: "PRISMA",
    palette: ["#f97316", "#ffd08a"],
    outline: "#b64c0b",
  },
  {
    id: "ADIDAS_BLUE",
    brand: "Adidas",
    garmentColor: "blue",
    mode: "FIO_VIVO",
    palette: ["#1676c5", "#8dd6ff"],
    outline: "#104c82",
  },
  {
    id: "ASICS_WHITE",
    brand: "ASICS",
    garmentColor: "white",
    mode: "HOLOGRAFIA",
    palette: ["#f7fafc", "#9cc9e8"],
    outline: "#52758f",
  },
] as const;

export type AuraMetamorphoseBrandPresetId = typeof AURA_METAMORPHOSE_BRAND_PRESETS[number]["id"];

export function auraMetamorphoseBrandPreset(value: unknown) {
  return AURA_METAMORPHOSE_BRAND_PRESETS.find((preset) => preset.id === value);
}
