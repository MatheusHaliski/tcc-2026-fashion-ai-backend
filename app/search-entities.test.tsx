// @vitest-environment jsdom
/**
 * Buscar → Marcas e Buscar → Celebridades no mesmo formato de Buscar → Pessoas (cards em grade), não uma lista
 * empilhada: nome, @, selo do tipo, Hype, "Abrir perfil"; marca só do catálogo mostra as peças públicas e leva às peças.
 */
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import SearchPage from "@/app/(site)/(app)/search/page";

const nav = vi.hoisted(() => ({ search: new URLSearchParams("q=n&tab=MARCAS") }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), useSearchParams: () => nav.search, usePathname: () => "/search" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Buscar: Marcas e Celebridades em cards", () => {
  it("marcas: card com logo, @, selo Marca, contador e Abrir perfil; marca do catálogo sem perfil vai às peças", async () => {
    nav.search = new URLSearchParams("q=n&tab=MARCAS");
    const api = mockApi({
      "GET /api/search": (url: URL) => ({ results: url.searchParams.get("tab") === "MARCAS"
        ? [{ name: "Nike", slug: "nike", userId: "b1", registered: true, publicPieces: 12 }, { name: "Marca Nova", registered: false, publicPieces: 3 }]
        : [{ name: "Bia", slug: "bia", userId: "u2", avatarUrl: "/media/bia.jpg" }], nextCursor: null }),
      "GET /api/public-pieces": { items: [], nextCursor: null },
      "GET /api/catalog/products": { items: [], page: 0, size: 24, total: 0, hasMore: false }, "GET /api/catalog/summary": { products: 14000, brands: 120 },
    });
    const { container } = renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    const cards = await waitFor(() => { const c = container.querySelectorAll("ul.institutional-profile-feed article.institutional-profile-card"); expect(c).toHaveLength(2); return c; });
    expect(container.querySelector("ul.fai-list")).toBeNull();
    expect(cards[0].querySelector("h2")?.textContent).toBe("Nike");
    expect(cards[0].querySelector(".institutional-profile-username")?.textContent).toBe("@nike");
    expect(screen.getAllByText("Marca").length).toBeGreaterThan(0);
    expect(cards[0].querySelector("dd")?.textContent).toBe("12");
    expect((cards[0].querySelector("a.btn") as HTMLAnchorElement).getAttribute("href")).toBe("/brands/nike");
    expect(cards[1].textContent).toContain("Marca do catálogo");
    // marca só do catálogo: "Ver peças" abre o ACERVO inteiro dela (catálogo paginado), sem o termo digitado
    fireEvent.click(screen.getByRole("button", { name: /Ver peças/ }));
    await waitFor(() => expect(api.calls.some((c) => c.path.startsWith("/api/catalog/products") && c.path.includes("brand=Marca+Nova") && !c.path.includes("q="))).toBe(true));
  });

  it("acervo: aba lista o catálogo inteiro (paginado, total real) e leva a peça ao criador", async () => {
    nav.search = new URLSearchParams("q=&tab=ACERVO");
    const product = (i: number) => ({ id: `p${i}`, brand: { id: "b1", name: "Nike", slug: "nike" }, productName: `Camiseta ${i}`, category: "upper_piece", subcategory: "tshirt",
      source: { type: "OFFICIAL", domain: "x", productUrl: "https://x/p", status: "OK", lastVerifiedAt: "2026-10-10" }, ingestionStatus: "VALIDATED", ownersCount: 0 });
    const api = mockApi({
      "GET /api/catalog/summary": { products: 14000, brands: 120 },
      "GET /api/catalog/products": (url: URL) => { const page = Number(url.searchParams.get("page") ?? 0); return { items: Array.from({ length: 24 }, (_, i) => product(page * 24 + i)), page, size: 24, total: 14000, hasMore: true }; },
    });
    renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    expect(await screen.findByText(/Acervo completo: 14\.?000 peças de 120 marcas/)).toBeTruthy();
    const list = await screen.findByRole("list", { name: "Acervo" });
    await waitFor(() => expect(list.querySelectorAll("li")).toHaveLength(24));
    expect(screen.getByText("Mostrando 24 de 14.000")).toBeTruthy();
    const first = api.calls.find((c) => c.path.startsWith("/api/catalog/products"));
    expect(first?.path).toContain("page=0");
    expect(first?.path).toContain("size=24");
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/ }));
    await waitFor(() => expect(list.querySelectorAll("li")).toHaveLength(48));
    expect(api.calls.filter((c) => c.path.startsWith("/api/catalog/products")).map((c) => new URL(c.path, "http://x").searchParams.get("page"))).toEqual(["0", "1"]);
    fireEvent.click(screen.getAllByRole("button", { name: /Usar no criador/ })[0]);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/pieces\/new\?brand=Nike&q=Camiseta\+0&category=upper_piece&subcategory=tshirt$/));
  });

  it("celebridades: o mesmo card, com @, selo verificada e link para o perfil da pessoa", async () => {
    nav.search = new URLSearchParams("q=n&tab=CELEBRIDADES");
    mockApi({ "GET /api/search": { results: [{ name: "Bia", slug: "bia", userId: "u2", avatarUrl: "/media/bia.jpg" }], nextCursor: null } });
    const { container } = renderApp(<Suspense fallback={null}><SearchPage /></Suspense>);
    const card = await waitFor(() => { const c = container.querySelector("ul.institutional-profile-feed article.institutional-profile-card"); expect(c).toBeTruthy(); return c!; });
    expect(card.querySelector("h2")?.textContent).toBe("Bia");
    expect(card.querySelector(".institutional-profile-username")?.textContent).toBe("@bia");
    expect(card.textContent).toContain("Celebridade");
    expect(card.textContent).toContain("verificado");
    expect((card.querySelector("a.btn") as HTMLAnchorElement).getAttribute("href")).toBe("/u/bia");
    expect(card.querySelector(".institutional-profile-avatar img")?.getAttribute("src")).toContain("bia.jpg");
  });
});
