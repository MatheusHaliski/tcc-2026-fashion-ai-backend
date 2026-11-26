/**
 * Grade de células de informação dos cards do feed (peça e look). Por padrão aparecem só os campos mínimos; a pessoa
 * escolhe os demais e a forma da grade no Background Studio, e a escolha é gravada na arte do card
 * ({@code background.infoGrid}). Valores desconhecidos são ignorados: um card antigo ou adulterado cai no padrão.
 */
export type InfoField = "brand" | "color" | "category" | "size" | "occasion" | "style" | "material" | "condition" | "pieces" | "season";
export type InfoGridKind = "piece" | "look";
export type InfoCells = "boxed" | "plain" | "pill";
export type InfoAlign = "start" | "center";
export type InfoDensity = "normal" | "compact";

/** Campos que cada card pode mostrar, na ordem em que aparecem. */
export const INFO_FIELDS: Record<InfoGridKind, InfoField[]> = {
  piece: ["brand", "color", "category", "size", "occasion", "style", "material", "condition"],
  look: ["pieces", "brand", "color", "occasion", "style", "season"],
};
/** O mínimo que aparece sem configurar nada (estado de conservação é sempre opcional e começa desligado). */
export const INFO_DEFAULT: Record<InfoGridKind, InfoField[]> = {
  piece: ["brand", "color", "category", "size"],
  look: ["pieces", "brand", "color", "occasion"],
};
export const INFO_CELLS: InfoCells[] = ["boxed", "plain", "pill"];
export const INFO_COLUMNS = [1, 2, 3] as const;
export type InfoColumns = (typeof INFO_COLUMNS)[number];

/** O que é gravado na arte do card; tudo opcional (ausente = padrão). */
export interface InfoGridConfig { fields?: string[]; columns?: number; cells?: string; labels?: boolean; align?: string; density?: string }
export interface InfoGridView { fields: InfoField[]; columns: InfoColumns; cells: InfoCells; labels: boolean; align: InfoAlign; density: InfoDensity }

export function infoGridView(config: unknown, kind: InfoGridKind): InfoGridView {
  const c = (config && typeof config === "object" ? config : {}) as InfoGridConfig;
  const escolhidos = Array.isArray(c.fields) ? new Set(c.fields) : null;
  return {
    fields: escolhidos ? INFO_FIELDS[kind].filter((f) => escolhidos.has(f)) : INFO_DEFAULT[kind],
    columns: INFO_COLUMNS.includes(c.columns as InfoColumns) ? (c.columns as InfoColumns) : 2,
    cells: INFO_CELLS.includes(c.cells as InfoCells) ? (c.cells as InfoCells) : "boxed",
    labels: c.labels !== false,
    align: c.align === "center" ? "center" : "start",
    density: c.density === "compact" ? "compact" : "normal",
  };
}

/** A grade do card a partir da arte dele (background). */
export function infoGridOf(background: Record<string, unknown> | null | undefined, kind: InfoGridKind): InfoGridView {
  return infoGridView(background?.infoGrid, kind);
}

/** Liga/desliga um campo mantendo a ordem do catálogo. */
export function toggleInfoField(view: InfoGridView, kind: InfoGridKind, field: InfoField): InfoField[] {
  const ligados = new Set(view.fields);
  if (ligados.has(field)) ligados.delete(field); else ligados.add(field);
  return INFO_FIELDS[kind].filter((f) => ligados.has(f));
}

/** Chave i18n do nome de cada campo (as mesmas dos rótulos das células). */
export const INFO_FIELD_LABEL: Record<InfoField, string> = {
  brand: "common.brand", color: "common.color", category: "common.category", size: "common.size", occasion: "common.occasion",
  style: "common.style", material: "common.material", condition: "pieceReferences.condition.label", pieces: "common.pecas", season: "common.season",
};
