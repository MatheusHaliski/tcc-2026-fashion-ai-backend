// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { tr } from "@/lib/i18n/core";
import { ProductFitDialog } from "./ProductFitDialog";
import { FitMeasurementForm } from "./FitMeasurementForm";
import type { FitChart, FitRecommendation } from "@/lib/api/fit";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const productId = "96d8dbf7-4427-403d-9ab5-12b1c9381310";
const path = `/api/catalog/products/${productId}`;
const chart: FitChart = { productId, version: 0, revision: 1, canEdit: false, chart: {
  type: "BODY_RANGE", family: "TSHIRT", market: "BR", sourceName: "Fonte revisada", sourceUrl: "https://example.com/chart", sourceRevision: "2026-1",
  sourceDate: "2026-10-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z", sourceAuthorized: true,
  options: [{ label: "M", order: 1, measurements: [{ region: "CHEST", protocol: "BODY_CIRCUMFERENCE_V1", min: 90, max: 100 }] }],
} };
const recommendation: FitRecommendation = { id: "r1", productId, stale: false, feedback: [], priorExperience: [], result: {
  status: "INSUFFICIENT_MEASUREMENTS", recommendedSize: null, candidates: [{ sizeLabel: "M", order: 1, compatible: false,
    regions: [{ region: "CHEST", reason: "MISSING_MEASUREMENT", chartProtocol: "BODY_CIRCUMFERENCE_V1" }] }], preference: "REGULAR", preferenceApplied: false,
  preferenceExplanation: "PREFERENCE_NOT_SUPPORTED_BY_SOURCE", rulesVersion: "fit-adult-v1", chartRevision: 1, profileVersion: null,
  sourceName: "Fonte revisada", sourceRevision: "2026-1", sourceDate: "2026-10-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z", qualitativeEvidence: "INSUFFICIENT_EVIDENCE", missingInformation: [],
} };
it("shows an honest no-chart state without requesting private measurements", async () => {
  const { calls } = mockApi({ [`GET ${path}/size-chart`]: { ...chart, chart: null } });
  renderApp(<ProductFitDialog productId={productId} open onClose={vi.fn()} />);
  expect((await screen.findByText(tr("fit.status.NO_CHART"))).textContent).toBe(tr("fit.status.NO_CHART"));
  expect(screen.queryByRole("button", { name: tr("fit.recommend") })).toBeNull();
  expect(calls.some(call => call.path === "/api/me/fit-measurements")).toBe(false);
});
it("loads nothing while closed", () => {
  const { calls } = mockApi(); renderApp(<ProductFitDialog productId={productId} open={false} onClose={vi.fn()} />);
  expect(screen.queryByRole("dialog")).toBeNull(); expect(calls.some(call => call.path.includes("size-chart"))).toBe(false);
});
it("displays source and per-region abstention and reuses the request key after a failed response", async () => {
  let attempts = 0;
  const { calls } = mockApi({ [`GET ${path}/size-chart`]: chart, "GET /api/me/fit-measurements": undefined,
    [`POST ${path}/size-recommendations`]: () => ++attempts === 1
      ? new Response(JSON.stringify({ message: "Falha temporária" }), { status: 503, headers: { "content-type": "application/json" } }) : recommendation });
  renderApp(<ProductFitDialog productId={productId} productName="Camiseta" open onClose={vi.fn()} />);
  expect((await screen.findByRole("link", { name: "Fonte revisada" })).getAttribute("href")).toBe("https://example.com/chart");
  fireEvent.click(screen.getByRole("button", { name: tr("fit.recommend") }));
  expect((await screen.findByRole("alert")).textContent).toContain("Falha temporária");
  fireEvent.click(screen.getByRole("button", { name: tr("fit.recommend") }));
  await screen.findByText(tr("fit.status.INSUFFICIENT_MEASUREMENTS"));
  expect(screen.getByText(new RegExp(tr("fit.reason.MISSING_MEASUREMENT")))).toBeTruthy();
  const writes = calls.filter(call => call.path.endsWith("/size-recommendations")); expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual(writes[1].body); expect(writes[0].body).not.toHaveProperty("ownerId");
  expect((writes[0].body as { preference: string }).preference).toBe("REGULAR");
});
it("saves only explicitly consented private measurements and deletes the owned profile by version", async () => {
  const profile = { version: 3, measuredAt: "2026-10-01T00:00:00Z", source: "MANUAL" as const,
    measurements: [{ region: "CHEST" as const, protocol: "BODY_CIRCUMFERENCE_V1" as const, value: 100, unit: "CM" as const }] };
  const saved = vi.fn();
  const { calls } = mockApi({ "PUT /api/me/fit-measurements": profile, "DELETE /api/me/fit-measurements": undefined });
  renderApp(<FitMeasurementForm profile={profile} onSaved={saved} />);
  expect((screen.getByRole("button", { name: tr("fit.saveMeasurements") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(tr("fit.region.CHEST")), { target: { value: "102" } });
  fireEvent.click(screen.getByRole("checkbox", { name: tr("fit.consent") }));
  fireEvent.click(screen.getByRole("button", { name: tr("fit.saveMeasurements") }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(profile));
  expect(calls.find(call => call.method === "PUT")?.body).toMatchObject({ expectedVersion: 3, measurements: [{ region: "CHEST", protocol: "BODY_CIRCUMFERENCE_V1", value: 102, unit: "CM" }] });
  expect(calls.find(call => call.method === "PUT")?.body).not.toHaveProperty("ownerId");
  fireEvent.click(screen.getByRole("button", { name: tr("fit.deleteMeasurements") }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(null));
  expect(calls.some(call => call.method === "DELETE" && call.path === "/api/me/fit-measurements?expectedVersion=3")).toBe(true);
});
it("keeps protocol-specific values separate when switching to a reference garment", async () => {
  mockApi(); renderApp(<FitMeasurementForm profile={null} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(tr("fit.region.CHEST")), { target: { value: "98" } });
  fireEvent.click(screen.getByLabelText(tr("fit.protocol")));
  fireEvent.click(screen.getByRole("option", { name: tr("fit.protocol.GARMENT_FLAT_WIDTH_V1") }));
  expect((screen.getByLabelText(tr("fit.region.CHEST")) as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByLabelText(tr("fit.protocol")));
  fireEvent.click(screen.getByRole("option", { name: tr("fit.protocol.BODY_CIRCUMFERENCE_V1") }));
  expect((screen.getByLabelText(tr("fit.region.CHEST")) as HTMLInputElement).value).toBe("98");
});
