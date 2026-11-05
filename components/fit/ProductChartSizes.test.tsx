// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { tr } from "@/lib/i18n/core";
import { readMySizes } from "@/lib/tryon/sizes";
import type { ChartResponse } from "@/lib/fit/product-chart";
import { ProductFitDialog } from "./ProductFitDialog";
const product = { id: "p1", productName: "Camisa", category: "upper_piece", subcategory: "t_shirt" };
const chart = (): ChartResponse => ({ productId: "p1", revision: 1, chart: {
  type: "GARMENT_MEASUREMENT", sourceName: "Marca real", sourceRevision: "2026-r1", sourceDate: "2025-01-01",
  sourceAuthorized: true, validUntil: null,
  options: [{ label: "Marca 42", order: 1, measurements: [{ region: "CHEST", protocol: "GARMENT_FLAT_WIDTH_V1", min: 50, max: 52 }] }],
} });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); document.cookie = "fai_rt_h=; Max-Age=0; path=/"; });
it("shows the authenticated product chart and saves only a product preference", async () => {
  loggedAs(undefined, { "GET /api/catalog/products/p1/size-chart": chart() });
  renderApp(<ProductFitDialog product={product} open onClose={vi.fn()} />);
  const group = await screen.findByRole("radiogroup", { name: tr("size.productChart.choose") });
  expect(screen.getByText(/Marca real/)).toBeTruthy();
  expect(screen.getByRole("table").textContent).toContain("50–52 cm");
  expect(screen.getByRole("table").textContent).toContain(tr("size.productChart.flatWidth"));
  expect(screen.queryByText(tr("size.productChart.reference"))).toBeNull();
  fireEvent.click(within(group).getByRole("radio", { name: "Marca 42" }));
  expect(JSON.parse(localStorage.getItem("fai.fit.product.v1:p1")!)).toEqual({ productId: "p1", revision: 1, label: "Marca 42" });
  expect(readMySizes()).toEqual({});
});
it.each(["NO_CHART", "EXPIRED", "UNVERIFIED", "INVALID"] as const)("explains %s before offering the reference grade", async (state) => {
  const data = chart();
  if (state === "NO_CHART") data.chart = null;
  if (state === "EXPIRED") data.chart!.validUntil = "2020-01-01";
  if (state === "UNVERIFIED") data.chart!.sourceAuthorized = false;
  if (state === "INVALID") data.chart!.options = [];
  loggedAs(undefined, { "GET /api/catalog/products/p1/size-chart": data });
  renderApp(<ProductFitDialog product={product} open onClose={vi.fn()} />);
  expect(await screen.findByText(tr(`size.productChart.${state}`))).toBeTruthy();
  expect(screen.getByText(tr("size.productChart.reference"))).toBeTruthy();
  expect(screen.getByRole("radiogroup", { name: tr("size.meu_tamanho") })).toBeTruthy();
});
it("recovers from a chart API failure through retry", async () => {
  loggedAs(undefined, { "GET /api/catalog/products/p1/size-chart": new Response(JSON.stringify({ message: "Unavailable", code: "TEST" }), { status: 500, headers: { "content-type": "application/json" } }) });
  renderApp(<ProductFitDialog product={product} open onClose={vi.fn()} />);
  const retry = await screen.findByRole("button", { name: tr("common.retry") });
  mockApi({ "GET /api/catalog/products/p1/size-chart": chart() });
  fireEvent.click(retry);
  expect(await screen.findByRole("radio", { name: "Marca 42" })).toBeTruthy();
});
it("resets product state instead of displaying the previous product's chart", async () => {
  loggedAs(undefined, {
    "GET /api/catalog/products/p1/size-chart": chart(),
    "GET /api/catalog/products/p2/size-chart": { productId: "p2", revision: 1, chart: null },
  });
  const view = renderApp(<ProductFitDialog product={product} open onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Marca 42" }));
  view.rerender(<ProductFitDialog product={{ ...product, id: "p2" }} open onClose={vi.fn()} />);
  expect(screen.queryByRole("radio", { name: "Marca 42" })).toBeNull();
  expect(await screen.findByText(tr("size.productChart.NO_CHART"))).toBeTruthy();
});
