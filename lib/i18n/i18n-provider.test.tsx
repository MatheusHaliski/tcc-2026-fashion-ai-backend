// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, useI18n, useT, type I18n } from "./i18n";
import { tokenStore } from "@/lib/api/client";
import { mockApi } from "@/test-utils/render";
import { setCurrentLocale } from "./state";
import { setPreferredCurrency, setRates } from "./money";

let ctx: I18n;
function Probe() {
  ctx = useI18n();
  const t = useT();
  return <div><span data-testid="locale">{ctx.locale}</span><span data-testid="title">{t("auraHype.title")}</span><span data-testid="currency">{ctx.currency}</span></div>;
}
const plain = (s: string) => s.replace(/ | /g, " ");

beforeEach(() => { localStorage.clear(); document.cookie = "fai.locale=; max-age=0; path=/"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); tokenStore.clear(); setCurrentLocale("pt-BR"); setRates(null); setPreferredCurrency(null); });

describe("I18nProvider", () => {
  it("useI18n fora do provider lança erro", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow("useI18n fora do I18nProvider");
  });

  it("usa o idioma salvo no navegador acima do inicial", async () => {
    localStorage.setItem("fai.locale", "es");
    mockApi({ "GET /api/exchange-rates": { base: "BRL", date: null, source: "ECB", rates: { EUR: 0.16 } } });
    render(<I18nProvider initial="pt-BR"><Probe /></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("es"));
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByTestId("currency").textContent).toBe("EUR");
  });

  it("sem inicial e sem nada salvo, detecta o idioma do navegador", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
    const { calls } = mockApi({ "GET /api/exchange-rates": { base: "BRL", date: null, source: "ECB", rates: { USD: 0.2 } } });
    render(<I18nProvider><Probe /></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en"));
    await waitFor(() => expect(ctx.rates?.rates.USD).toBe(0.2));
    expect(calls.some((c) => c.path === "/api/exchange-rates")).toBe(true);
    expect(JSON.parse(localStorage.getItem("fai.fx")!).rates.base).toBe("BRL");
    expect(plain(ctx.price(100).text)).toBe("≈ $20.00");
  });

  it("idioma inicial inválido cai no padrão; cotação guardada evita a chamada à API", async () => {
    localStorage.setItem("fai.fx", JSON.stringify({ at: Date.now(), rates: { base: "BRL", date: null, source: "ECB", rates: { USD: 0.25 } } }));
    const { calls } = mockApi({});
    render(<I18nProvider initial={"xx" as never}><Probe /></I18nProvider>);
    expect(screen.getByTestId("locale").textContent).toBe("pt-BR");
    act(() => ctx.setCurrency("USD", { persist: false }));
    await waitFor(() => expect(ctx.rates?.rates.USD).toBe(0.25));
    expect(calls.some((c) => c.path === "/api/exchange-rates")).toBe(false);
    expect(localStorage.getItem("fai.currency")).toBe("USD");
  });

  it("falha ao buscar cotação mantém sem cotação", async () => {
    mockApi({ "GET /api/exchange-rates": new Response("x", { status: 500 }) });
    render(<I18nProvider initial="en"><Probe /></I18nProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(ctx.rates).toBeNull();
    expect(ctx.currency).toBe("USD");
  });

  it("setLocale grava cookie/storage e, com sessão, salva no perfil (nunca o pseudo)", async () => {
    tokenStore.set("tok");
    const { calls } = mockApi({ "PUT /api/me/preferences": {}, "GET /api/exchange-rates": { base: "BRL", date: null, source: "ECB", rates: {} } });
    render(<I18nProvider initial="pt-BR"><Probe /></I18nProvider>);
    act(() => ctx.setLocale("en"));
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(localStorage.getItem("fai.locale")).toBe("en");
    expect(document.cookie).toContain("fai.locale=en");
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ language: "EN" }));
    act(() => ctx.setLocale("qps-ploc"));
    act(() => ctx.setLocale("es", { persist: false }));
    act(() => ctx.setLocale("fr" as never));
    expect(screen.getByTestId("locale").textContent).toBe("es");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
    act(() => ctx.setCurrency(null));
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PUT")[1].body).toMatchObject({ currency: "AUTO" });
  });

  it("sem sessão, setLocale não chama a API; pseudo ajusta lang para pt-BR", () => {
    const { calls } = mockApi({});
    render(<I18nProvider initial="pt-BR"><Probe /></I18nProvider>);
    act(() => ctx.setLocale("qps-ploc"));
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(screen.getByTestId("title").textContent).toBe("[ÁÚŘÁ Ĥýþé ~~]");
    act(() => ctx.setCurrency("EUR"));
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("formata datas, números, moeda e tempo relativo com travessão para vazio", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    mockApi({});
    render(<I18nProvider initial="pt-BR"><Probe /></I18nProvider>);
    expect(ctx.fmtDate(null)).toBe("—");
    expect(ctx.fmtDate("2026-10-10T12:00:00Z", { year: "numeric" })).toBe("2026");
    expect(ctx.fmtDate(new Date("2026-10-10T12:00:00Z"))).toContain("2026");
    expect(ctx.fmtDateTime(undefined)).toBe("—");
    expect(ctx.fmtDateTime("2026-10-10T12:00:00Z")).toContain("10/10/2026");
    expect(ctx.fmtNumber(null)).toBe("—");
    expect(ctx.fmtNumber(1234.5)).toBe("1.234,5");
    expect(ctx.fmtMoney(undefined)).toBe("—");
    expect(plain(ctx.fmtMoney(10))).toBe("R$ 10,00");
    expect(plain(ctx.fmtMoney(10, "USD"))).toBe("US$ 10,00");
    expect(ctx.fmtPrice(null)).toBe("—");
    expect(plain(ctx.fmtPriceShort(5, "BRL", 0))).toBe("R$ 5");
    expect(ctx.relative(null)).toBe("—");
    expect(ctx.relative(new Date("2026-10-10T11:59:30Z"))).toBe("há 30 segundos");
    expect(ctx.relative(new Date("2026-10-10T11:55:00Z"))).toBe("há 5 minutos");
    expect(ctx.relative(new Date("2026-10-10T09:00:00Z"))).toBe("há 3 horas");
    expect(ctx.relative(new Date("2026-10-08T12:00:00Z"))).toBe("anteontem");
    expect(ctx.relative("2026-01-10T12:00:00Z")).toContain("2026");
    expect(ctx.rich("auraHype.title")).toEqual(["AURA Hype"]);
    expect(ctx.intl).toBe("pt-BR");
    expect(ctx.locales.some((l) => l.code === "qps-ploc")).toBe(true);
  });

  it("storage indisponível: idioma fica no inicial", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    mockApi({});
    render(<I18nProvider initial="pt-BR"><Probe /></I18nProvider>);
    act(() => ctx.setLocale("pt-BR"));
    expect(screen.getByTestId("locale").textContent).toBe("pt-BR");
  });
});
