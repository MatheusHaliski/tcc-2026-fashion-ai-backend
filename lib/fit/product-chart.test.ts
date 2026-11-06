// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { chartState, readProductChoice, saveProductChoice, type ChartResponse } from "./product-chart";

function chartFixture(): ChartResponse {
  return { productId: "p1", revision: 1, chart: {
    type: "BODY_RANGE", sourceName: "Marca", sourceRevision: "v1", sourceDate: "2025-01-01",
    validUntil: null, sourceAuthorized: true,
    options: [{ label: "M", order: 1, measurements: [{ region: "CHEST", protocol: "BODY_CIRCUMFERENCE_V1", min: 90, max: 98 }] }],
  } };
}
afterEach(() => localStorage.clear());
it("accepts authorized measurements and distinguishes missing, expired and unverified charts", () => {
  const data = chartFixture();
  expect(chartState(data, "p1")).toBe("AVAILABLE");
  expect(chartState({ ...data, chart: null }, "p1")).toBe("NO_CHART");
  data.chart!.validUntil = "2020-01-01";
  expect(chartState(data, "p1")).toBe("EXPIRED");
  data.chart!.sourceAuthorized = false;
  expect(chartState(data, "p1")).toBe("UNVERIFIED");
});
it.each([
  (d: ChartResponse) => { d.productId = "other"; },
  (d: ChartResponse) => { d.revision = 0; },
  (d: ChartResponse) => { d.chart!.sourceName = ""; },
  (d: ChartResponse) => { d.chart!.sourceDate = "2099-01-01"; },
  (d: ChartResponse) => { d.chart!.options.push(d.chart!.options[0]); },
  (d: ChartResponse) => { d.chart!.options[0].measurements[0].min = NaN; },
  (d: ChartResponse) => { d.chart!.options[0].measurements[0].max = 1; },
  (d: ChartResponse) => { d.chart!.options[0].measurements[0].protocol = "GARMENT_FLAT_WIDTH_V1"; },
])("rejects inconsistent chart data (%#)", (mutate) => {
  const data = chartFixture(); mutate(data);
  expect(chartState(data, "p1")).toBe("INVALID");
});
it("isolates product preferences from other products, chart revisions and generic avatar sizes", () => {
  const options = chartFixture().chart!.options;
  localStorage.setItem("unrelated", "retained");
  saveProductChoice("p1", 1, "M");
  expect(readProductChoice("p1", 1, options)).toBe("M");
  expect(readProductChoice("p2", 1, options)).toBeNull();
  expect(readProductChoice("p1", 2, options)).toBeNull();
  expect(readProductChoice("p1", 1, [])).toBeNull();
  expect(localStorage.getItem("unrelated")).toBe("retained");
  localStorage.setItem("fai.fit.product.v1:p1", "corrupt");
  expect(readProductChoice("p1", 1, options)).toBeNull();
});
