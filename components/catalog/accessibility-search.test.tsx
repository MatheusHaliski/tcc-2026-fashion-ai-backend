// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { AccessibilitySearch } from "./accessibility-search";

const info = (productId: string, status: "DECLARED" | "REVIEWED" | "UNKNOWN", keys: string[]) => ({ productId, status, declarationSource: "PHYSICAL_SAMPLE", values: {}, descriptionKeys: keys, notes: null, clinicalClaim: "NONE", validatedWithUsers: false });
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-08 accessibility search", () => {
  it("sends filters per request only, separates confirmed from unknown and uses concrete language", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/catalog/accessibility/search": {
      filters: {}, results: [{ product: { id: "p1", productName: "Camisa magnética" }, accessibility: info("p1", "REVIEWED", ["opening.FRONT", "closure.MAGNETIC"]), unknownFilters: [] }],
      withoutInformation: [{ product: { id: "p2", productName: "Camiseta" }, accessibility: info("p2", "DECLARED", []), unknownFilters: ["frontOpening"] }], withoutInformationCount: 1, notice: "NO_DATA_IS_NOT_UNSUITABLE", preferencesStored: false,
    } });
    renderApp(<AccessibilitySearch />);
    expect(screen.getByText("Escolha ao menos um filtro")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Abertura frontal" }));
    await screen.findByText("Camisa magnética");
    expect(screen.getByText("abertura frontal")).toBeTruthy();
    expect(screen.getByText("fechamento magnético")).toBeTruthy();
    expect(screen.getByText("Revisado pela equipe")).toBeTruthy();
    expect(screen.getByText("Sem informação sobre: Abertura frontal")).toBeTruthy();
    expect(screen.getAllByText(/não promete resultado clínico/).length).toBeGreaterThan(0);
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/accessibility/search") && c.path.includes("frontOpening=true"))).toBe(true));
    expect(calls.filter((c) => c.method !== "GET" && c.path.includes("accessibility")).length).toBe(0);
    expect(Object.keys(localStorage).some((key) => /access/i.test(key))).toBe(false);
  });
});
