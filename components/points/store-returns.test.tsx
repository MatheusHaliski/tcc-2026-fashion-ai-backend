// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { StoreOrders } from "./store-orders";
import { ReturnsInbox } from "./store-returns-inbox";

const order = { id: "o1", listingId: "l1", product: { id: "p1", productName: "Jaqueta Neon" }, pricePoints: 100, status: "DELIVERED", createdAt: "2026-11-01T10:00:00Z", variant: { id: "v1", sku: "JN-M", colorName: "Azul", sizeLabel: "M" }, variantInfo: "PRESENT" };
const eligible = { eligible: true, reason: null, deadlineAt: "2026-11-10T10:00:00Z", policyVersion: "RETURN_POLICY_V1", windowDays: 7, legacyPolicy: false, reasonCodes: ["FIT_TOO_SMALL", "QUALITY_DEFECT"] };
const received = { id: "c1", orderId: "o1", kind: "RETURN", reasonCode: "QUALITY_DEFECT", reasonNotes: null, variantId: "v1", exchangeVariantId: null, exchangeOrderId: null, status: "RECEIVED", policyVersion: "RETURN_POLICY_V1", windowDays: 7, deadlineAt: "2026-11-10T10:00:00Z", inspectionOutcome: null, divergenceReason: null, restocked: false, refunded: false, fitFeedbackConsent: false, closedAt: null, version: 3, role: "SELLER", createdAt: "2026-11-02T10:00:00Z", events: [{ id: "e1", fromStatus: null, toStatus: "REQUESTED", notes: null, at: "2026-11-02T10:00:00Z" }], evidence: [{ id: "ev1", uploaderId: "u1", createdAt: "2026-11-02T10:00:00Z" }] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-02 returns", () => {
  it("shows the policy frozen on the order and sends the request with the chosen reason once", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/me/physical-store/orders": [order], "GET /api/me/physical-store/returns": [], "GET /api/me/physical-store/orders/o1/return-eligibility": eligible,
      "POST /api/me/physical-store/orders/o1/returns": { ...received, status: "REQUESTED", version: 0, role: "BUYER" },
    });
    renderApp(<StoreOrders />);
    await screen.findByText(/política RETURN_POLICY_V1/);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar troca ou devolução" }));
    await screen.findByText(/Prazo de 7 dias após a entrega/);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar solicitação" }));
    await waitFor(() => expect(calls.filter((call) => call.method === "POST" && call.path === "/api/me/physical-store/orders/o1/returns")).toHaveLength(1));
    const sent = calls.find((call) => call.method === "POST" && call.path === "/api/me/physical-store/orders/o1/returns")!.body as { reasonCode: string; kind: string; fitFeedbackConsent: boolean };
    expect(sent).toMatchObject({ kind: "RETURN", reasonCode: "FIT_TOO_SMALL", fitFeedbackConsent: false });
  });

  it("explains ineligibility instead of offering the request", async () => {
    loggedAs(undefined, { "GET /api/me/physical-store/orders": [order], "GET /api/me/physical-store/returns": [], "GET /api/me/physical-store/orders/o1/return-eligibility": { ...eligible, eligible: false, reason: "WINDOW_EXPIRED" } });
    renderApp(<StoreOrders />);
    await screen.findByText(/O prazo da política deste pedido terminou/);
    expect(screen.queryByRole("button", { name: "Solicitar troca ou devolução" })).toBeNull();
  });

  it("requires a divergence reason and does not refund or restock by default on the inbox", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/physical-store/returns/inbox": [received], "POST /api/physical-store/returns/c1/inspection": { ...received, status: "CLOSED" } });
    renderApp(<ReturnsInbox />);
    await screen.findByText(/1 comprovante\(s\) com acesso restrito/);
    fireEvent.click(screen.getByLabelText("Resultado da inspeção"));
    fireEvent.click(await screen.findByRole("option", { name: "Inspeção: condição divergente" }));
    const finish = screen.getByRole("button", { name: "Concluir inspeção" }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sem etiqueta" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir inspeção" }));
    await waitFor(() => expect(calls.some((call) => call.path === "/api/physical-store/returns/c1/inspection")).toBe(true));
    expect(calls.find((call) => call.path === "/api/physical-store/returns/c1/inspection")!.body).toMatchObject({ expectedVersion: 3, outcome: "DIVERGENT", divergenceReason: "Sem etiqueta", restock: false, settle: false });
  });
});
