// @vitest-environment jsdom
/**
 * RF53 · Lote A5 (P3-15): faixas de insights nos contextos novos — feed, busca, perfil de marca, perfil pessoal (públicos,
 * sem login) e editor de look (pessoal). As faixas começam fechadas (telas cheias) e só buscam ao abrir.
 */
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { __resetHypeGroupStore } from "@/lib/hype/use-hype-group";
import { isPublicInsightContext } from "@/lib/insights/types";
import { InsightStrip } from "@/components/insights/insight-strip";
import FeedPage from "@/app/(site)/(app)/feed/page";
import SearchPage from "@/app/(site)/(app)/search/page";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";
import BrandPage from "@/app/(site)/(app)/brands/[slug]/page";

const insight = (code: string, title: string) => ({ code, tone: "NEUTRAL", title, text: `${title}: Hype 70 (Em alta), estilo mais presente Streetwear.`, metric: null, basis: ["HYPE_V2", "PUBLIC_RANKING"] });
const insights = (url: URL) => ({ context: url.searchParams.get("context"), generatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", source: "local", items: [insight("X", `Insight ${url.searchParams.get("context")}`)] });
const query = (path: string) => new URLSearchParams(path.split("?")[1]);

beforeEach(() => { __resetHypeStore(); __resetHypeGroupStore(); nav.search = new URLSearchParams(); tokenStore.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("contextos novos (lib/insights/types)", () => {
  it("feed, busca e perfis são públicos; o editor de look é pessoal", () => {
    for (const c of ["FEED", "SEARCH", "BRAND_PROFILE", "CREATOR_PROFILE"] as const) expect(isPublicInsightContext(c)).toBe(true);
    expect(isPublicInsightContext("LOOK_EDITOR")).toBe(false);
  });

  it("LOOK_EDITOR sem sessão não desenha nem busca nada", async () => {
    const api = mockApi({ "GET /api/insights": insights });
    const { container } = renderApp(<InsightStrip context="LOOK_EDITOR" params={{ pieces: "p1,p2" }} collapsible />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector("[data-context]")).toBeNull();
    expect(api.calls.some((c) => c.path.startsWith("/api/insights"))).toBe(false);
  });

  it("LOOK_EDITOR com sessão manda as peças escolhidas ao abrir", async () => {
    const api = loggedAs(undefined, { "GET /api/insights": insights });
    renderApp(<InsightStrip context="LOOK_EDITOR" params={{ pieces: "p1,p2" }} collapsible />);
    await settle();
    expect(api.calls.some((c) => c.path.startsWith("/api/insights"))).toBe(false);   // fechada: não busca
    fireEvent.click(await screen.findByRole("button", { name: "Ver insights" }));
    expect(await screen.findByText("Insight LOOK_EDITOR")).toBeTruthy();
    const call = api.calls.find((c) => c.path.startsWith("/api/insights"))!;
    expect(query(call.path).get("pieces")).toBe("p1,p2");
  });
});

describe("telas públicas", () => {
  it("feed: faixa FEED (anônima), fechada até abrir", async () => {
    const api = mockApi({ "GET /api/insights": insights, "GET /api/feed": { items: [], nextCursor: null } });
    const { container } = renderApp(<FeedPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver insights" }));
    expect(await screen.findByText("Insight FEED")).toBeTruthy();
    expect(container.querySelectorAll('[data-context="FEED"]')).toHaveLength(1);
    expect(query(api.calls.find((c) => c.path.startsWith("/api/insights"))!.path).get("window")).toBe("7");
  });

  it("busca: faixa SEARCH só nas abas Looks e Peças, no recorte de categoria", async () => {
    nav.search = new URLSearchParams("q=a&tab=PESSOAS");
    mockApi({ "GET /api/insights": insights, "GET /api/search": { results: [], nextCursor: null } });
    const { container } = renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Looks/ })).toBeTruthy());
    expect(container.querySelector('[data-context="SEARCH"]')).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Looks/ }));
    await waitFor(() => expect(container.querySelector('[data-context="SEARCH"]')).toBeTruthy());
  });

  it("perfil pessoal: CREATOR_PROFILE com o @; perfil fechado não mostra a faixa", async () => {
    const params = Object.assign(Promise.resolve({ username: "bia" }), { status: "fulfilled", value: { username: "bia" } });
    const bia = { id: "u2", username: "bia", displayName: "Bia", profileType: "PESSOAL", verified: false, privateAccount: false };
    const profile = (over: Record<string, unknown>) => ({ user: bia, layout: "PESSOAL", self: false, relation: "NENHUMA", counters: { followers: 0, following: 0, published: 0 }, visibility: "PUBLIC", contentVisible: true, ...over });
    const api = mockApi({ "GET /api/profiles/bia": profile({}), "GET /api/insights": insights });
    const { container } = renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
    fireEvent.click(await screen.findByRole("button", { name: "Ver insights" }));
    expect(await screen.findByText("Insight CREATOR_PROFILE")).toBeTruthy();
    expect(query(api.calls.find((c) => c.path.startsWith("/api/insights"))!.path).get("key")).toBe("bia");
    expect(container.querySelectorAll('[data-context="CREATOR_PROFILE"]')).toHaveLength(1);
    cleanup();
    mockApi({ "GET /api/profiles/bia": profile({ contentVisible: false, visibility: "FOLLOWERS" }), "GET /api/insights": insights });
    const closed = renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
    await screen.findAllByText("Bia");
    expect(closed.container.querySelector('[data-context="CREATOR_PROFILE"]')).toBeNull();
  });

  it("perfil da marca: BRAND_PROFILE com o slug", async () => {
    const params = Object.assign(Promise.resolve({ slug: "nike" }), { status: "fulfilled", value: { slug: "nike" } });
    const api = mockApi({ "GET /api/institutional/nike": { header: { userId: "b1", username: "nike", name: "Nike", slug: "nike", kind: "MARCA", following: 0, activeSeals: 0, viewerFollows: false }, mode: "VISITANTE" }, "GET /api/insights": insights, "GET /api/institutional/nike/tabs/ESQUEMAS_DESTAQUE": [] });
    renderApp(<Suspense fallback={null}><BrandPage params={params} /></Suspense>);
    fireEvent.click(await screen.findByRole("button", { name: "Ver insights" }));
    expect(await screen.findByText("Insight BRAND_PROFILE")).toBeTruthy();
    expect(query(api.calls.find((c) => c.path.startsWith("/api/insights"))!.path).get("key")).toBe("nike");
  });
});
