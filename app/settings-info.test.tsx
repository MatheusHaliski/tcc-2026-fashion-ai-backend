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

it("explica o bloqueio por nível no Mais informações e não permite ativar Impersonation", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": { ...PREFS, auraImpersonation: false },
    "GET /api/me/aura-permissions": { currentTier: "STUDIO", auras: { AURA_IMPERSONATION: { allowed: false, requiredTier: "LOFT" } } } });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Aparência" }));
  await screen.findByText(/Bloqueado: seu nível atual é STUDIO/);
  const toggle = screen.getByRole("switch", { name: "AURA Impersonation" });
  expect((toggle as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Informações sobre AURA Impersonation" }));
  const dialog = await screen.findByRole("dialog", { name: "AURA Impersonation" });
  expect(within(dialog).getByText(/exige o nível LOFT/)).toBeTruthy();
  fireEvent.click(toggle);
  expect(calls.some(c => c.method === "PUT" && (c.body as { auraImpersonation?: boolean })?.auraImpersonation)).toBe(false);
});

it("permite ativar Impersonation no Loft e mostra acesso liberado no Mais informações", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": { ...PREFS, auraImpersonation: false },
    "GET /api/me/aura-permissions": { currentTier: "LOFT", auras: { AURA_IMPERSONATION: { allowed: true, requiredTier: "LOFT" } } },
    "PUT /api/me/preferences": { ...PREFS, auraImpersonation: true } });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Aparência" }));
  await screen.findByText(/Disponível no seu nível atual: LOFT/);
  fireEvent.click(screen.getByRole("button", { name: "Informações sobre AURA Impersonation" }));
  const dialog = await screen.findByRole("dialog", { name: "AURA Impersonation" });
  expect(within(dialog).getByText(/Disponível no seu nível atual: LOFT/)).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("switch", { name: "AURA Impersonation" }));
  await waitFor(() => expect(calls.some(c => c.method === "PUT" && (c.body as { auraImpersonation?: boolean })?.auraImpersonation === true)).toBe(true));
  await waitFor(() => expect(screen.getByRole("switch", { name: "AURA Impersonation" }).getAttribute("aria-checked")).toBe("true"));
});

it("permite desligar Impersonation mesmo abaixo do nível necessário", async () => {
  const { calls } = loggedAs(undefined, { "GET /api/me/preferences": { ...PREFS, auraImpersonation: true },
    "GET /api/me/aura-permissions": { currentTier: "ESTREIA", auras: { AURA_IMPERSONATION: { allowed: false, requiredTier: "LOFT" } } },
    "PUT /api/me/preferences": { ...PREFS, auraImpersonation: false } });
  renderApp(<SettingsPage />);
  fireEvent.click(await screen.findByRole("tab", { name: "Aparência" }));
  await screen.findByText(/Bloqueado: seu nível atual é ESTREIA/);
  const toggle = screen.getByRole("switch", { name: "AURA Impersonation" });
  expect((toggle as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(toggle);
  await waitFor(() => expect(calls.some(c => c.method === "PUT" && (c.body as { auraImpersonation?: boolean })?.auraImpersonation === false)).toBe(true));
});
