// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { HypeAnalyticsDrawer } from "./hype-analytics-drawer";
import { hypeGuideKey } from "./hype-guide";

const DETAIL = { entityType: "PIECE", entityId: "p1", status: "AVAILABLE", score: 72, level: "HOT", publicEligible: true, reasons: [], signals: {}, sealProgress: [
  { code: "VIRAL", earned: false, criteria: "Nível Viral (≥ 90)", available: true, publicEligible: true, requirements: { rule: "ALL", score: { current: 72, target: 90, maximum: 100, missing: 18, met: false } } },
] };
const routes = {
  "GET /api/hype/pieces/p1": DETAIL,
  "GET /api/hype/pieces/p1/history": { points: [] },
  "GET /api/hype/pieces/p1/positions": { eligible: false, positions: [] },
  "GET /api/hype/PIECE/p1/seal-offers": { type: "PIECE", id: "p1", hype: { available: true }, items: [], total: 0 },
};
beforeEach(() => { tokenStore.clear(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; tokenStore.clear(); });

describe("Hype: ajuda inicial, metas claras e análise segmentada", () => {
  it("abre a ajuda automaticamente; a opção é da conta e a ajuda permanece reabrível", async () => {
    loggedAs(ME, routes);
    renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Camisa" open onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "Entenda o Hype" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente para minha conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Entendi, continuar" }));
    expect(localStorage.getItem(hypeGuideKey(ME.user.id))).toBe("hide");
    expect(screen.getByRole("dialog", { name: "Análise de Hype · Camisa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Selos e metas" }));
    expect(await screen.findByText("72 de 100")).toBeTruthy();
    expect(screen.getByText("90 de 100")).toBeTruthy();
    expect(screen.getByText("Faltam 18 pontos")).toBeTruthy();
    expect(screen.queryByText("Para conquistar: Nível Viral (≥ 90)")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Evolução do Hype" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entenda o Hype" }));
    expect(screen.getByRole("dialog", { name: "Entenda o Hype" })).toBeTruthy();
    // Somente um diálogo de cada vez: o foco não fica preso no painel atrás da ajuda.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("sem marcar, dispensa só na sessão; outra conta ainda recebe a explicação", async () => {
    loggedAs(ME, routes);
    const first = renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Camisa" open onClose={() => {}} />);
    await screen.findByRole("dialog", { name: "Entenda o Hype" });
    fireEvent.click(screen.getByRole("button", { name: "Entendi, continuar" }));
    expect(localStorage.getItem(hypeGuideKey(ME.user.id))).toBeNull();
    first.unmount();
    renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Camisa" open onClose={() => {}} />);
    await screen.findByRole("radio", { name: "Resumo" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Entenda o Hype" })).toBeNull());
    cleanup(); tokenStore.clear();
    loggedAs({ ...ME, user: { ...ME.user, id: "other-user" } }, routes);
    renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Camisa" open onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "Entenda o Hype" })).toBeTruthy();
  });
});
