/** Product-chart evidence is separate from the generic avatar preview grade. */
export interface ChartDimension {
  region: "CHEST" | "WAIST" | "HIP" | "THIGH" | "INSEAM";
  protocol: string;
  min: number;
  max: number;
}
export interface ChartSize { label: string; order: number; measurements: ChartDimension[] }
export interface ProductChart {
  type: "BODY_RANGE" | "GARMENT_MEASUREMENT";
  sourceName: string;
  sourceRevision: string;
  sourceDate: string;
  validUntil: string | null;
  sourceAuthorized: boolean;
  options: ChartSize[];
}
export interface ChartResponse { productId: string; revision: number; chart: ProductChart | null }
export type ChartState = "AVAILABLE" | "NO_CHART" | "EXPIRED" | "UNVERIFIED" | "INVALID";
const regions = new Set(["CHEST", "WAIST", "HIP", "THIGH", "INSEAM"]);
const protocols = new Set(["BODY_CIRCUMFERENCE_V1", "BODY_LENGTH_V1", "GARMENT_CIRCUMFERENCE_V1", "GARMENT_FLAT_WIDTH_V1", "GARMENT_LENGTH_V1"]);

export function chartState(response: ChartResponse, productId: string, now = Date.now()): ChartState {
  if (!response || response.productId !== productId) return "INVALID";
  const chart = response.chart;
  if (!chart) return "NO_CHART";
  if (chart.sourceAuthorized !== true) return "UNVERIFIED";
  if (chart.validUntil != null) {
    if (typeof chart.validUntil !== "string") return "INVALID";
    const expiry = Date.parse(chart.validUntil);
    if (!Number.isFinite(expiry)) return "INVALID";
    if (expiry <= now) return "EXPIRED";
  }
  if (!Number.isInteger(response.revision) || response.revision < 1
    || !["BODY_RANGE", "GARMENT_MEASUREMENT"].includes(chart.type)
    || typeof chart.sourceName !== "string" || !chart.sourceName.trim()
    || typeof chart.sourceRevision !== "string" || !chart.sourceRevision.trim()
    || typeof chart.sourceDate !== "string"
    || !Number.isFinite(Date.parse(chart.sourceDate)) || Date.parse(chart.sourceDate) > now
    || !Array.isArray(chart.options) || !chart.options.length) return "INVALID";
  const labels = new Set<string>();
  for (const size of chart.options) {
    if (!size || typeof size.label !== "string" || !size.label.trim() || labels.has(size.label)
      || !Number.isFinite(size.order) || !Array.isArray(size.measurements) || !size.measurements.length) return "INVALID";
    labels.add(size.label);
    for (const dimension of size.measurements) {
      if (!dimension || !regions.has(dimension.region) || !protocols.has(dimension.protocol)
        || (chart.type === "BODY_RANGE") !== dimension.protocol.startsWith("BODY_")
        || !Number.isFinite(dimension.min) || !Number.isFinite(dimension.max)
        || dimension.min <= 0 || dimension.max < dimension.min) return "INVALID";
    }
  }
  return "AVAILABLE";
}

const key = (productId: string) => `fai.fit.product.v1:${productId}`;
export function readProductChoice(productId: string, revision: number, options: ChartSize[]): string | null {
  try {
    const choice = JSON.parse(localStorage.getItem(key(productId)) ?? "null");
    return choice?.productId === productId && choice.revision === revision
      && options.some((o) => o.label === choice.label) ? choice.label : null;
  } catch { return null; }
}
export function saveProductChoice(productId: string, revision: number, label: string): void {
  try { localStorage.setItem(key(productId), JSON.stringify({ productId, revision, label })); }
  catch { /* Choice remains usable in component state when storage is unavailable. */ }
}
