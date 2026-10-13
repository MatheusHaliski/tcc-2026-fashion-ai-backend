// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import SettingsPage from "@/app/(site)/(app)/settings/page";
const PREFS = { theme: "LIGHT", language: "PT_BR", density: "COMFORTABLE", fontScale: 100 };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens an explanation for each consent without granting it and restores focus on Escape", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/consents": [
    { purpose: "AI_RECOMMENDATION", label: "Recomendações por IA", granted: false, description: "Usa os dados das peças para recomendar looks." },
    { purpose: "LOCATION_HISTORY", label: "Localização para clima", granted: true, description: "Usa a localização aproximada para consultar o clima." },
  ] });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Privacidade" }));
  const info = await screen.findByRole("button", { name: "Informações sobre RECOMENDAÇÕES POR IA" });
  info.focus(); fireEvent.click(info);
  const dialog = await screen.findByRole("dialog", { name: "RECOMENDAÇÕES POR IA" });
  expect(within(dialog).getByText("Usa os dados das peças para recomendar looks.")).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(info);
  expect(calls.some(c => c.method === "PUT" && c.path.includes("consents"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Informações sobre LOCALIZAÇÃO PARA CLIMA" }));
  expect(await screen.findByRole("dialog", { name: "LOCALIZAÇÃO PARA CLIMA" })).toBeTruthy();
});
it("activates AURA locally when an older backend omits the preference, instead of silently resetting it", async () => {
  loggedAs(undefined, { "GET /api/me/preferences": PREFS, "PUT /api/me/preferences": PREFS });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Aparência" }));
  fireEvent.click(screen.getByRole("switch", { name: "AURA Hype" }));
  await screen.findByText(/Preferência aplicada neste navegador/);
  expect(screen.getByRole("switch", { name: "AURA Hype" }).getAttribute("aria-checked")).toBe("true");
  expect(JSON.parse(localStorage.getItem("fai.theme")!).auraHype).toBe(true);
});
it("saves AURA on the account when the backend supports it", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": { ...PREFS, auraHype: false },
    "PUT /api/me/preferences": (_url: URL, init: RequestInit) => ({ ...PREFS, auraHype: JSON.parse(String(init.body)).auraHype }) });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Aparência" }));
  fireEvent.click(screen.getByRole("switch", { name: "AURA Hype" }));
  await waitFor(() => expect(calls.some(c => c.method === "PUT" && (c.body as { auraHype?: boolean }).auraHype === true)).toBe(true));
  expect(screen.getByRole("switch", { name: "AURA Hype" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByText(/Preferência aplicada neste navegador/)).toBeNull();
});

it("encerra a sessão atual depois de revogar todas as sessões", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS,
    "GET /api/auth/sessions": [{ sessionId: "current", device: "Este navegador", current: true }, { sessionId: "other", device: "Celular", current: false }],
    "DELETE /api/auth/sessions": { revokedSessions: 2 }, "POST /bff/auth/logout": undefined });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Sessões" }));
  await screen.findByText(/Celular/);
  fireEvent.click(screen.getByRole("button", { name: "Sair de todos os dispositivos" }));
  await waitFor(() => expect(calls.some(call => call.path === "/bff/auth/logout")).toBe(true));
  const revoke = calls.findIndex(call => call.method === "DELETE" && call.path === "/api/auth/sessions");
  const logout = calls.findIndex(call => call.path === "/bff/auth/logout");
  expect(revoke).toBeGreaterThanOrEqual(0); expect(logout).toBeGreaterThan(revoke);
});
