// @vitest-environment jsdom
/** RF53 · Lote A2 (docs/hype/HYPE_AUDITORIA_ABAS.md): /brands "Em alta", Hype no cabeçalho da marca, ordenação dos destaques e métricas do emissor. */
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { __resetHypeGroupStore } from "@/lib/hype/use-hype-group";
import type { HypeGroupSummary } from "@/lib/hype/types";
import BrandsPage from "@/app/(site)/(app)/brands/page";
import BrandPage from "@/app/(site)/(app)/brands/[slug]/page";

const hot: HypeGroupSummary = { key: "nike", sufficient: true, value: 77.6, level: "TRENDING", rank: 2, items: 6, pieces: 6, looks: 0 };
const params = Object.assign(Promise.resolve({ slug: "nike" }), { status: "fulfilled", value: { slug: "nike" } });
const header = (over: Record<string, unknown> = {}) => ({ header: { userId: "b1", username: "nike", name: "Nike", slug: "nike", kind: "MARCA", status: "Validada", following: 0, activeSeals: 1, viewerFollows: false, ...over }, mode: "VISITANTE" });
const groups = (url: URL) => ({ type: url.searchParams.get("type"), window: 7, algorithmVersion: "HYPE_V2", minItems: 3, total: 9, items: url.searchParams.get("keys") === "nike" ? { nike: hot } : {} });

beforeEach(() => { __resetHypeStore(); __resetHypeGroupStore(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("/brands: ordem Em alta e Hype do perfil (P2-05)", () => {
  it("a ordem Em alta pede order=EM_ALTA; o Hype vem no feed (sem outra requisição) e só aparece com base", async () => {
    const feed = (url: URL) => ({ order: url.searchParams.get("order") || "RECENTES", orders: ["AFINIDADE", "RECENTES", "EM_ALTA"], brands: [
      { slug: "nike", name: "Nike", affinity: 42, hype: hot },
      { slug: "zara", name: "Zara", hype: { key: "zara", sufficient: false, items: 2, pieces: 2, looks: 0 } },
      { slug: "nova", name: "Nova", hype: null },
    ] });
    const api = mockApi({ "GET /api/brands": feed });
    const { container } = renderApp(<BrandsPage />);
    expect(await screen.findByText("Nike")).toBeTruthy();
    expect(container.querySelectorAll(".hype-group-header")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Hype da marca/ })).toBeTruthy();
    expect(screen.getByText("Tendência")).toBeTruthy();                 // a faixa sempre em texto
    expect(screen.getByText("6 itens públicos · nº 2 em Em alta")).toBeTruthy();
    expect(screen.getByText(/afinidade 42%/)).toBeTruthy();             // 0–100 do backend, sem multiplicar de novo
    fireEvent.click(screen.getByRole("button", { name: "Em alta" }));
    await waitFor(() => expect(api.calls.some((c) => c.path.includes("order=EM_ALTA"))).toBe(true));
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/groups"))).toBe(false);
  });
});

describe("/brands/[slug]: Hype da marca e ordenação dos destaques (P2-06, P3-17)", () => {
  it("cabeçalho com o Hype agregado da marca e o seletor Recentes · Hype · Em crescimento mapeado para filter=", async () => {
    const api = mockApi({ "GET /api/institutional/nike": header(), "GET /api/hype/groups": groups, "GET /api/institutional/nike/tabs/ESQUEMAS_DESTAQUE": [], "GET /api/institutional/nike/tabs/LOOKS_CONSAGRADOS": [] });
    renderApp(<Suspense fallback={null}><BrandPage params={params} /></Suspense>);
    const link = await screen.findByRole("link", { name: /Hype da marca/ });
    expect(link.textContent).toContain("Tendência");
    expect(link.textContent).toContain("78");
    expect(api.calls.some((c) => c.path === "/api/hype/groups?type=BRAND&keys=nike")).toBe(true);

    const sort = screen.getByRole("radiogroup", { name: "Ordenar destaques" });
    expect(sort.querySelector("[aria-checked=true]")?.textContent).toBe("Hype");   // padrão dos destaques: sem filter
    expect(api.calls.some((c) => c.path === "/api/institutional/nike/tabs/ESQUEMAS_DESTAQUE")).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Em crescimento" }));
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/institutional/nike/tabs/ESQUEMAS_DESTAQUE?filter=GROWTH")).toBe(true));
    expect(screen.getByText(/não por curtidas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Looks consagrados" }));
    await waitFor(() => expect(screen.getByRole("radiogroup", { name: "Ordenar destaques" }).querySelector("[aria-checked=true]")?.textContent).toBe("Recentes"));
    fireEvent.click(screen.getByRole("radio", { name: "Hype" }));
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/institutional/nike/tabs/LOOKS_CONSAGRADOS?filter=HYPE")).toBe(true));
  });

  it("aba sem ordenação (Selos) não mostra o seletor; marca sem base não mostra o Hype", async () => {
    mockApi({ "GET /api/institutional/zara": { ...header({ name: "Zara", username: "zara", slug: "zara" }) }, "GET /api/hype/groups": groups });
    const p = Object.assign(Promise.resolve({ slug: "zara" }), { status: "fulfilled", value: { slug: "zara" } });
    renderApp(<Suspense fallback={null}><BrandPage params={p} /></Suspense>);
    await screen.findAllByText("Zara");
    fireEvent.click(screen.getByRole("tab", { name: /Selos/ }));
    await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "Ordenar destaques" })).toBeNull());
    expect(screen.queryByRole("link", { name: /Hype da marca/ })).toBeNull();
  });

  it("Métricas do emissor: Hype dos looks vinculados com faixa, Δ e top; sem base, Dados insuficientes", async () => {
    const metrics = { suggested: 4, approved: 3, hype: { bonded: 3, withHype: 2, avgScore: 70, level: "HOT", deltaPoints: 4, direction: "UP", deltaWindowDays: 7,
      top: [{ schemeId: "s1", title: "Look de sexta", score: 80, level: "TRENDING" }, { schemeId: "s2", title: "Look de sábado", score: 60, level: "HOT" }] } };
    loggedAs({ user: { id: "b1", username: "nike", displayName: "Nike", profileType: "MARCA", verified: true, privateAccount: false }, email: "n@x.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false },
      { "GET /api/institutional/nike": { ...header(), mode: "ADMINISTRADOR" }, "GET /api/hype/groups": groups, "GET /api/me/issuer-metrics": metrics });
    renderApp(<Suspense fallback={null}><BrandPage params={params} /></Suspense>);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Métricas" }));
    expect(await screen.findByText("Hype dos looks vinculados")).toBeTruthy();
    expect(screen.getByText("↑ 4 pts em 7 dias")).toBeTruthy();
    expect(screen.getByText("2 de 3 looks vinculados com Hype público calculado")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Look de sexta" }).getAttribute("href")).toBe("/schemes/s1");
    cleanup();
    __resetHypeGroupStore();
    loggedAs({ user: { id: "b1", username: "nike", displayName: "Nike", profileType: "MARCA", verified: true, privateAccount: false }, email: "n@x.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false },
      { "GET /api/institutional/nike": { ...header(), mode: "ADMINISTRADOR" }, "GET /api/me/issuer-metrics": { approved: 1, hype: { bonded: 1, withHype: 0, avgScore: null, level: null, top: [] } } });
    renderApp(<Suspense fallback={null}><BrandPage params={params} /></Suspense>);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Métricas" }));
    expect(await screen.findByText("Dados insuficientes")).toBeTruthy();
  });
});
