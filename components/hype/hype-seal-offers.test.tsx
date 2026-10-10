// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { HypeIssuerSealOffers } from "./hype-seal-offers";
const PATH = "/api/hype/PIECE/p1/seal-offers";
const OFFER = { seal: { id: "seal-1", name: "Nike em alta", tier: "PECA", premium: false, owner: { ...ME.user, id: "issuer", username: "nike", displayName: "Nike" } }, eligible: true, canRequest: true, requiredImageRightsConsent: true, requiresReview: true, issuerProfileUrl: "/brands/nike" };
const DATA = { type: "PIECE", id: "p1", hype: { available: true, score: 72 }, items: [OFFER], total: 1, page: 0, size: 12 };
beforeEach(() => { tokenStore.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; tokenStore.clear(); });
describe("pedidos de selos de Hype dos emissores", () => {
  it("exige consentimento e segue o status real de revisão da API", async () => {
    const api = loggedAs(ME, { [`GET ${PATH}`]: DATA, [`POST ${PATH}/seal-1/request`]: { id: "bond-1", status: "PENDING_REVIEW" } });
    renderApp(<HypeIssuerSealOffers type="PIECE" id="p1" enabled />);
    const button = await screen.findByRole("button", { name: "Solicitar selo" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "Nike" }).getAttribute("href")).toBe("/brands/nike");
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button);
    await waitFor(() => expect(api.calls.filter((call) => call.method === "POST" && call.path.endsWith("/request"))).toHaveLength(1));
    expect(api.calls.find((call) => call.path.endsWith("/request"))?.body).toEqual({ imageRightsConsent: true });
    expect(await screen.findByText("Aguardando aprovação")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Solicitar selo" })).toBeNull();
  });
  it("não libera um pedido com métricas antigas mesmo quando uma resposta inconsistente traz elegibilidade", async () => {
    const api = loggedAs(ME, { [`GET ${PATH}`]: { ...DATA, hype: { available: true, stale: true } } });
    renderApp(<HypeIssuerSealOffers type="PIECE" id="p1" enabled />);
    const button = await screen.findByRole("button", { name: "Solicitar selo" });
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button);
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(api.calls.some((call) => call.method === "POST" && call.path.endsWith("/request"))).toBe(false);
  });
});
