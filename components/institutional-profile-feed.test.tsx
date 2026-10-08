// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loggedAs, mockApi, renderApp } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { __resetHypeGroupStore } from "@/lib/hype/use-hype-group";
import BrandsPage from "@/app/(site)/(app)/brands/page";

const ORDERS = ["AFINIDADE", "RECENTES", "EM_ALTA"];
const BIO = "Moda feita no Brasil, com materiais rastreáveis.\nColeções para todos os estilos e corpos.\nConheça a história de cada peça no nosso ateliê.";
const BRAND = {
  id: "brand-user", slug: "atelier-aurora", username: "auroraoficial", name: "Ateliê Aurora", kind: "MARCA", status: "APROVADO",
  avatarUrl: "/photos/aurora-account.jpg", coverUrl: "/photos/aurora-cover.jpg",
  bio: BIO, storeUrl: "https://aurora.example/shop?collection=2026", category: "streetwear", officialHashtag: "#AuroraOficial", country: "Brasil",
  verified: true, privateAccount: false, visibility: "PUBLIC", pieces: 12, schemes: 8, followers: 345, following: 23, activeSeals: 3, affinity: 42.4,
  hype: { key: "atelier-aurora", sufficient: true, value: 78, level: "TRENDING", rank: 2, items: 6, pieces: 4, looks: 2 },
};
const CELEBRITY = {
  id: "celebrity-user", slug: "luna-palco", username: "lunaoficial", name: "Luna", kind: "CELEBRIDADE", status: "APROVADO",
  userAvatarUrl: "/photos/luna-account.jpg", avatarUrl: "/photos/luna-other.jpg", officialPhotoUrl: "/photos/luna-stage.jpg", coverUrl: "/photos/luna-cover.jpg",
  bio: "Cantora e compositora.\nVeja os looks das minhas apresentações.", storeUrl: "https://luna.example/store", areas: ["music"], officialHashtag: "#LunaAoVivo", country: "Brasil",
  verified: true, privateAccount: true, visibility: "PRIVATE", pieces: 4, schemes: 19, followers: 987, following: 0, activeSeals: 1,
};

beforeEach(() => {
  document.cookie = "fai_rt_h=; max-age=0; path=/";
  sessionStorage.clear(); localStorage.clear(); tokenStore.clear(); __resetHypeGroupStore();
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); __resetHypeGroupStore();
  document.cookie = "fai_rt_h=; max-age=0; path=/";
});

const feed = (brands: unknown[]) => ({ brands, orders: ORDERS, order: "RECENTES" });
const card = (name: string) => screen.getByRole("article", { name: `Perfil de ${name}` });
function expectStat(profileCard: HTMLElement, name: string, value: string) {
  const caption = within(profileCard).getByText(name, { exact: true });
  expect(caption.parentElement?.textContent).toContain(value);
}

describe("feed de perfis oficiais /brands", () => {
  it("mostra os dados completos devolvidos pelo feed, incluindo avatarUrl, sem buscar cada perfil separadamente", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/brands": feed([BRAND]) });
    const rendered = renderApp(<BrandsPage />);
    const avatar = await screen.findByRole("img", { name: "Foto de perfil de Ateliê Aurora" });
    expect(avatar.getAttribute("src")).toBe("/photos/aurora-account.jpg");
    const profileCard = card("Ateliê Aurora");
    expect(profileCard.querySelector('img[src="/photos/aurora-cover.jpg"]')).toBeTruthy();
    expect(within(profileCard).getByText("@auroraoficial")).toBeTruthy();
    expect(within(profileCard).getByText(BIO, { normalizer: (text) => text })).toBeTruthy();
    expect(within(profileCard).getByText("Público")).toBeTruthy();
    expect(within(profileCard).getByText("verificado")).toBeTruthy();
    expect(within(profileCard).getByText("Status: Aprovado")).toBeTruthy();
    expect(within(profileCard).getByText("Brasil")).toBeTruthy();
    expect(within(profileCard).getByText("Streetwear")).toBeTruthy();
    expect(within(profileCard).getByText("#AuroraOficial")).toBeTruthy();
    expect(within(profileCard).getByText("3 selos ativos")).toBeTruthy();
    expect(within(profileCard).getByText(/afinidade 42%/)).toBeTruthy();
    expectStat(profileCard, "peças", "12");
    expectStat(profileCard, "looks", "8");
    expectStat(profileCard, "seguidores", "345");
    expectStat(profileCard, "seguindo", "23");
    const officialStore = within(profileCard).getAllByRole("link").find((link) => link.getAttribute("href") === BRAND.storeUrl)!;
    expect(officialStore).toBeTruthy();
    expect(officialStore.getAttribute("target")).toBe("_blank");
    expect(officialStore.getAttribute("rel")).toMatch(/noopener/);
    expect(within(profileCard).getByRole("link", { name: /Hype da marca/ })).toBeTruthy();
    expect(within(profileCard).getByText("6 itens públicos · nº 2 em Em alta")).toBeTruthy();
    expect(rendered.container.querySelector("a a")).toBeNull();
    expect(calls.some((call) => /^\/api\/(institutional\/|profiles\/|hype\/groups)/.test(call.path))).toBe(false);
  });

  it("carrega celebridades na aba própria e prioriza userAvatarUrl, mostrando conta privada e números zero reais", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/brands": feed([BRAND]),
      "GET /api/celebrities": { celebrities: [CELEBRITY, {
        ...CELEBRITY, id: "vera-user", slug: "vera", name: "Vera", username: "veraoficial",
        userAvatarUrl: null, avatarUrl: "/media/avatar/vera.jpg", officialPhotoUrl: "/photos/vera-stage.jpg",
      }], orders: ORDERS, order: "RECENTES" },
    });
    renderApp(<BrandsPage />);
    await screen.findByRole("article", { name: "Perfil de Ateliê Aurora" });
    fireEvent.click(screen.getByRole("tab", { name: "Celebridades" }));
    expect((await screen.findByRole("img", { name: "Foto de perfil de Luna" })).getAttribute("src")).toBe("/photos/luna-account.jpg");
    expect(new URL(screen.getByRole("img", { name: "Foto de perfil de Vera" }).getAttribute("src")!, "http://localhost").pathname).toBe("/media/avatar/vera.jpg");
    const profileCard = card("Luna");
    expect(within(profileCard).getByText("@lunaoficial")).toBeTruthy();
    expect(within(profileCard).getByText("Privado")).toBeTruthy();
    expect(within(profileCard).getByText("#LunaAoVivo")).toBeTruthy();
    expect(within(profileCard).getByText(CELEBRITY.bio, { normalizer: (text) => text })).toBeTruthy();
    expectStat(profileCard, "peças", "4");
    expectStat(profileCard, "looks", "19");
    expectStat(profileCard, "seguidores", "987");
    expectStat(profileCard, "seguindo", "0");
    expect(within(profileCard).getByText("1 selo ativo")).toBeTruthy();
    expect(profileCard.querySelector('img[src="/photos/luna-cover.jpg"]')).toBeTruthy();
    expect(calls.filter((call) => call.path.startsWith("/api/celebrities"))).toHaveLength(1);
    expect(calls.some((call) => /^\/api\/(institutional\/|profiles\/|hype\/groups)/.test(call.path))).toBe(false);
  });

  it("mantém links de perfil acessíveis e aceita username/id quando a resposta não tem slug", async () => {
    loggedAs(undefined, {
      "GET /api/brands": feed([
        { name: "Perfil sem slug", id: "u1", username: "conta-publica", userAvatarUrl: "/photos/account.jpg", avatarUrl: "/photos/fallback.jpg", logoUrl: "/photos/company-logo.jpg", verified: false },
        { name: "Perfil antigo", id: "u2", user: { username: "conta-antiga", avatarUrl: "/photos/old.jpg" }, visibility: "FOLLOWERS", privateAccount: true },
        { name: "Perfil por id", id: "u3" },
      ]),
    });
    renderApp(<BrandsPage />);
    const firstAvatar = await screen.findByRole("img", { name: "Foto de perfil de Perfil sem slug" });
    expect(firstAvatar.getAttribute("src")).toBe("/photos/account.jpg");
    expect(screen.getByRole("img", { name: "Foto de perfil de Perfil antigo" }).getAttribute("src")).toBe("/photos/old.jpg");
    const destinations = ["/brands/conta-publica", "/brands/conta-antiga", "/brands/u3"];
    const profileLinks = screen.getAllByRole("link").filter((link) => destinations.includes(link.getAttribute("href") ?? ""));
    expect(new Set(profileLinks.map((link) => link.getAttribute("href")))).toEqual(new Set(destinations));
    const focused = profileLinks[0];
    expect(focused.tabIndex).toBe(0);
    focused.focus();
    expect(document.activeElement).toBe(focused);
    expect(card("Perfil sem slug").querySelector('img[src="/photos/fallback.jpg"]')).toBeNull();
    expect(within(card("Perfil antigo")).getByText("Só para seguidores")).toBeTruthy();
    expect(within(card("Perfil antigo")).queryByText("Privado")).toBeNull();
    // Missing statistics are unknown rather than fabricated zeros.
    expectStat(card("Perfil por id"), "seguidores", "—");
  });

  it("permite buscar e ordenar sem sessão, enviando os filtros à API sem Bearer ou buscas individuais", async () => {
    const api = mockApi({ "GET /api/brands": feed([BRAND]) });
    renderApp(<BrandsPage />);
    await screen.findByRole("article", { name: "Perfil de Ateliê Aurora" });
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar" }), { target: { value: "moda brasileira" } });
    await waitFor(() => expect(api.calls.some((call) => new URL(call.path, "http://localhost").searchParams.get("term") === "moda brasileira")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Em alta" }));
    await waitFor(() => expect(api.calls.some((call) => {
      const params = new URL(call.path, "http://localhost").searchParams;
      return params.get("term") === "moda brasileira" && params.get("order") === "EM_ALTA";
    })).toBe(true));
    const requests = api.fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/brands"));
    expect(requests.length).toBeGreaterThanOrEqual(3);
    requests.forEach(([, init]) => expect(new Headers(init?.headers).has("Authorization")).toBe(false));
    expect(api.calls.some((call) => call.path.startsWith("/api/me") || call.path.startsWith("/api/hype/") || call.path.startsWith("/api/institutional/"))).toBe(false);
  });

  it("mostra o erro da API sem confundi-lo com lista vazia e permite tentar novamente", async () => {
    let attempts = 0;
    mockApi({ "GET /api/brands": () => ++attempts === 1
      ? new Response(JSON.stringify({ code: "TEMPORARIAMENTE_INDISPONIVEL", message: "O feed está temporariamente indisponível." }), { status: 503, headers: { "content-type": "application/json" } })
      : feed([BRAND]) });
    renderApp(<BrandsPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("O feed está temporariamente indisponível.")).toBeTruthy();
    expect(screen.queryByText("Nada por aqui ainda.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("article", { name: "Perfil de Ateliê Aurora" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(attempts).toBe(2);
  });

  it("mantém a explicação de feed vazio recebida do backend sem montar cartões fictícios", async () => {
    mockApi({ "GET /api/brands": { ...feed([]), empty: "Nenhuma marca atende aos filtros informados." } });
    renderApp(<BrandsPage />);
    expect(await screen.findByText("Nenhuma marca atende aos filtros informados.")).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
