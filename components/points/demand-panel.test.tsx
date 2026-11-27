// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";
import { DemandPanel } from "./demand-panel";

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-10 demand panel", () => {
  it("shows aggregated cells with period, sample, delay and suppression metadata and no identifiers", async () => {
    loggedAs(undefined, { "GET /api/physical-store/demand": { brandId: "b1", period: { from: "2026-10-06", to: "2026-11-04" }, delayDays: 1, threshold: 5, sampleSize: 42, contributors: 17, suppressedCells: 3,
      cells: [{ productId: "p1", productName: "Jaqueta", colorName: "Azul", sizeLabel: "GG", kind: "UNAVAILABLE", events: 9, contributors: 7 }], semantics: {}, notice: "AGGREGATED_CONSENTED_NOT_A_FORECAST", scope: "OWN_CATALOG_ONLY" } });
    const { container } = renderApp(<DemandPanel />);
    await screen.findByText("Jaqueta");
    expect(screen.getByText("Quis e não havia")).toBeTruthy();
    expect(screen.getByText(/42 evento\(s\) de 17 pessoa\(s\)/)).toBeTruthy();
    expect(screen.getByText(/3 recorte\(s\) suprimido\(s\)/)).toBeTruthy();
    expect(screen.getByText(/não são previsão de demanda validada/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/@|user|hash/i);
  });
});
