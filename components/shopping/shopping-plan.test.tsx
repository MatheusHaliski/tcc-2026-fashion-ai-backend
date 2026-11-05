// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { ShoppingPlanner } from "./shopping-plan";

const plan = { occasions: ["trabalho"], coverage: { trabalho: ["upper_piece"] }, gaps: [{ occasion: "trabalho", slot: "lower_piece" }], budget: 500, currency: "BRL", guaranteedTotal: 120, remainingBudget: 380, outsideGuaranteedTotal: 1, computedAt: "2026-11-05T12:00:00Z", purchaseExecuted: false, evidenceScope: "OWN_WARDROBE_ONLY",
  candidates: [
    { product: { id: "p1", productName: "Calça básica" }, slot: "lower_piece", coversOccasions: ["trabalho"], complements: [{ id: "w1", name: "Camisa social", category: "upper_piece" }], price: 120, currency: "BRL", priceSource: "brand.example", priceCheckedAt: "2026-11-04T10:00:00Z", priceConfirmed: true, withinBudget: true, reason: "FILLS_GAP" },
    { product: { id: "p2", productName: "Sapato" }, slot: "shoes_piece", coversOccasions: ["trabalho"], complements: [], price: null, currency: null, priceSource: null, priceCheckedAt: null, priceConfirmed: false, withinBudget: false, reason: "FILLS_GAP" },
  ] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-09 shopping plan", () => {
  it("explains complements and price provenance, keeps unconfirmed prices out of the total and recalculates after a dismissal", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/me/shopping-plan": plan, "PUT /api/me/shopping-plan/dismissals/p1": { productId: "p1", kind: "OWNED" } });
    renderApp(<ShoppingPlanner />);
    fireEvent.click(screen.getByRole("button", { name: "Montar plano" }));
    await screen.findByText("Complementa: Camisa social");
    expect(screen.getByText(/fonte brand.example/)).toBeTruthy();
    expect(screen.getByText("Preço não confirmado")).toBeTruthy();
    expect(screen.getByText(/1 item\(ns\) sem preço confirmado fora do somatório/)).toBeTruthy();
    expect(screen.getByText(/não executa compras/)).toBeTruthy();
    const sent = calls.find((c) => c.method === "POST" && c.path === "/api/me/shopping-plan")!.body as { occasions: string[]; budget: number; currency: string };
    expect(sent).toMatchObject({ occasions: ["trabalho"], budget: 500, currency: "BRL" });
    fireEvent.click(screen.getAllByRole("button", { name: "Já possuo" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/me/shopping-plan/dismissals/p1")).toBe(true));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST" && c.path === "/api/me/shopping-plan")).toHaveLength(2));
  });
});
