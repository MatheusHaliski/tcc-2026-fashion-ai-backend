// @vitest-environment jsdom
/** RF53 · Lote A1 (docs/hype/HYPE_AUDITORIA_ABAS.md): Hype agregado de criador e marca — chips, perfil, busca e Em alta. */
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { __resetHypeGroupStore, hypeGroupKey } from "@/lib/hype/use-hype-group";
import type { HypeGroupSummary } from "@/lib/hype/types";
import type { UserCard } from "@/lib/api/types";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import { HypeTrendingPanel } from "@/components/hype/hype-trending";
import SearchPage from "@/app/(site)/(app)/search/page";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";

const g = (key: string, over: Partial<HypeGroupSummary> = {}): HypeGroupSummary => ({ key, sufficient: true, value: 72.4, level: "HOT", rank: 3, items: 5, pieces: 4, looks: 1, ...over });
const GROUPS: Record<string, HypeGroupSummary> = {
  u1: g("u1"),
  u2: g("u2", { value: 81, level: "TRENDING", rank: 1 }),
  u3: g("u3", { value: 45, level: "RELEVANT", rank: 9 }),
  u4: g("u4", { sufficient: false, value: null, level: null, rank: null, items: 2 }),
  nike: g("nike", { value: 88, level: "TRENDING", name: "Nike", slug: "nike" }),
};
/** /api/hype/groups: o que não está no mapa volta fora da resposta (bloqueio ou sem dado). */
const groups = (url: URL) => {
  const keys = (url.searchParams.get("keys") ?? "").split(",").map((k) => hypeGroupKey(decodeURIComponent(k)));
  return { type: url.searchParams.get("type"), window: 7, algorithmVersion: "HYPE_V2", minItems: 3, total: 12, items: Object.fromEntries(keys.filter((k) => GROUPS[k]).map((k) => [k, GROUPS[k]])) };
};
const person = (id: string, name: string): UserCard => ({ id, username: name.toLowerCase(), displayName: name, profileType: "PESSOAL", verified: false, privateAccount: false });

beforeEach(() => { __resetHypeStore(); __resetHypeGroupStore(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("HypeGroupBadge (P2-02, P2-03, P2-10)", () => {
  it("pede todos os chips do mesmo tipo numa requisição e só mostra 'em alta' a partir da faixa Em alta", async () => {
    const api = mockApi({ "GET /api/hype/groups": groups });
    const { container } = renderApp(<>
      {["u1", "u2", "u3", "u4", "u9"].map((id) => <HypeGroupBadge key={id} type="CREATOR" groupKey={id} />)}
      <HypeGroupBadge type="BRAND" groupKey=" NIKE " />
    </>);
    await waitFor(() => expect(container.querySelectorAll(".hype-group-badge")).toHaveLength(3));
    expect(api.calls.filter((c) => c.path.startsWith("/api/hype/groups?type=CREATOR"))).toHaveLength(1);
    expect(api.calls.filter((c) => c.path.startsWith("/api/hype/groups?type=BRAND"))).toHaveLength(1);
    expect(api.calls.find((c) => c.path.includes("type=BRAND"))!.path).toContain("keys=nike");   // chave normalizada
    expect(screen.getAllByText("Criador em alta")).toHaveLength(2);                                 // u1 (Em alta) e u2 (Tendência)
    expect(screen.getByText("Marca em alta")).toBeTruthy();
    // a faixa aparece em texto quando passa de "Em alta"; "Relevante", insuficiente e sem dado não desenham nada (nunca 0)
    expect(container.querySelector(".hype-group-badge .hype-level-chip.is-trending")?.textContent).toBe("Tendência");
    expect(screen.queryByText(/Relevante/)).toBeNull();
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(screen.getAllByText(/média dos itens públicos mais relevantes entre 5 itens públicos/).length).toBeGreaterThan(0);
  });

  it("variante do cabeçalho: faixa em texto, número, base de itens públicos, posição e link para o Em alta", async () => {
    mockApi({ "GET /api/hype/groups": groups });
    renderApp(<HypeGroupBadge type="CREATOR" groupKey="u3" variant="header" />);
    const link = await screen.findByRole("link", { name: /Hype do criador/ });
    expect(link.getAttribute("href")).toBe("/explorer?tab=trending&type=CREATOR");
    expect(link.textContent).toContain("Relevante");
    expect(link.textContent).toContain("45");
    expect(link.textContent).toContain("5 itens públicos · nº 9 em Em alta");
  });

  it("agregado já recebido (feed de /brands) não gera requisição; nulo não desenha nada", async () => {
    const api = mockApi({ "GET /api/hype/groups": groups });
    const { container } = renderApp(<><HypeGroupBadge type="BRAND" group={GROUPS.nike} /><HypeGroupBadge type="BRAND" group={null} /></>);
    expect(await screen.findByText("Marca em alta")).toBeTruthy();
    expect(container.querySelectorAll(".hype-group-badge")).toHaveLength(1);
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/groups"))).toBe(false);
  });
});

describe("Busca: chips de criador e marca e filtro Em alta (P2-01, P2-02, P2-03)", () => {
  it("Pessoas: o chip aparece sem reordenar os resultados", async () => {
    nav.search = new URLSearchParams("q=a&tab=PESSOAS");
    const results = [person("u3", "Caio"), person("u1", "Ana"), person("u2", "Bia")];
    const api = mockApi({ "GET /api/search": { results, nextCursor: null }, "GET /api/hype/groups": groups });
    const { container } = renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    await waitFor(() => expect(container.querySelectorAll(".hype-group-badge")).toHaveLength(2));
    const names = [...container.querySelectorAll(".fai-list li p.type-body b")].map((b) => b.textContent);
    expect(names).toEqual(["Caio", "Ana", "Bia"]);   // a ordem é a da busca, nunca a do Hype
    expect(api.calls.filter((c) => c.path.startsWith("/api/hype/groups"))).toHaveLength(1);
  });

  it("Marcas e Celebridades: marca pela chave do nome; celebridade pelo id da pessoa", async () => {
    nav.search = new URLSearchParams("q=n&tab=MARCAS");
    const api = mockApi({ "GET /api/search": (url: URL) => ({ results: url.searchParams.get("tab") === "MARCAS"
      ? [{ name: "Nike", slug: "nike", userId: "b1", registered: true }] : [{ name: "Bia", slug: "bia", userId: "u2" }], nextCursor: null }), "GET /api/hype/groups": groups });
    renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    expect(await screen.findByText("Marca em alta")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Celebridades/ }));
    expect(await screen.findByText("Criador em alta")).toBeTruthy();
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/groups?type=CREATOR&keys=u2"))).toBe(true);
  });

  it("Looks: o chip Em alta vira o filtro hypeLevel=HOT do feed comunitário", async () => {
    const api = mockApi({ "GET /api/feed": { items: [], nextCursor: null } });
    renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    await waitFor(() => expect(api.calls.some((c) => c.path.startsWith("/api/feed"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Em alta/ }));
    await waitFor(() => expect(api.calls.some((c) => c.path.startsWith("/api/feed") && c.path.includes("hypeLevel=HOT"))).toBe(true));
  });
});

describe("Perfil pessoal: Hype do criador no cabeçalho (P2-10)", () => {
  const params = Object.assign(Promise.resolve({ username: "bia" }), { status: "fulfilled", value: { username: "bia" } });
  const profile = (over: Record<string, unknown> = {}) => ({ user: person("u2", "Bia"), layout: "PESSOAL", self: false, relation: "NENHUMA", counters: { followers: 0, following: 0, published: 0 }, visibility: "PUBLIC", contentVisible: true, ...over });
  const lookbook = { "GET /api/users/u2/lookbook": { closet: [], schemes: [], groupings: [], self: false }, "GET /api/users/u2/closet": { items: [] } };

  it("mostra o agregado público com a faixa em texto", async () => {
    loggedAs(undefined, { "GET /api/profiles/bia": profile(), "GET /api/hype/groups": groups, ...lookbook });
    renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
    await settle();
    const link = await screen.findByRole("link", { name: /Hype do criador/ });
    expect(link.textContent).toContain("Tendência");
  });

  it("perfil fechado para quem vê não pede nem mostra o agregado", async () => {
    const api = loggedAs(undefined, { "GET /api/profiles/bia": profile({ contentVisible: false }), "GET /api/hype/groups": groups });
    renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
    await settle();
    await screen.findByText("Bia");
    expect(screen.queryByRole("link", { name: /Hype do criador/ })).toBeNull();
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/groups"))).toBe(false);
  });
});

describe("Em alta › grupos (P3-01)", () => {
  const top = { type: "PIECE", id: "p1", hype: { status: "AVAILABLE", score: 80, level: "TRENDING" } };
  it("marca com perfil oficial leva para /brands/{slug} e mostra a faixa; na janela Hoje o valor é crescimento", async () => {
    nav.search = new URLSearchParams("type=BRAND");
    mockApi({ "GET /api/hype/trending": (url: URL) => ({ type: "BRAND", window: Number(url.searchParams.get("window")), metric: url.searchParams.get("window") === "1" ? "TREND" : "HYPE", algorithmVersion: "HYPE_V2", minItems: 3, items: [
      { rank: 1, key: "nike", name: "Nike", slug: "nike-oficial", value: 72.4, level: url.searchParams.get("window") === "1" ? null : "HOT", items: 5, pieces: 5, looks: 0, top },
      { rank: 2, key: "zara", name: "Zara", value: 61, level: url.searchParams.get("window") === "1" ? null : "HOT", items: 3, pieces: 3, looks: 0, top },
    ] }) });
    renderApp(<HypeTrendingPanel />);
    const nike = await screen.findByRole("link", { name: /Nike/ });   // o tipo veio da URL (?type=BRAND)
    expect(nike.getAttribute("href")).toBe("/brands/nike-oficial");
    expect(screen.getByRole("link", { name: /Zara/ }).getAttribute("href")).toBe("/search?tab=PECAS&q=Zara");
    expect(nike.querySelector(".hype-level-chip.is-hot")?.textContent).toBe("Em alta");
    fireEvent.click(screen.getByRole("radio", { name: "Hoje" }));
    await waitFor(() => expect(screen.getAllByText("Crescimento").length).toBe(2));
    expect(screen.getAllByText(/Trend médio 72/).length).toBe(1);
  });
});
