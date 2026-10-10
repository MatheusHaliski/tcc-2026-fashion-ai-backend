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
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => nav.search, usePathname: () => "/search" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Buscar: Marcas e Celebridades em cards", () => {
  it("marcas: card com logo, @, selo Marca, contador e Abrir perfil; marca do catálogo sem perfil vai às peças", async () => {
    nav.search = new URLSearchParams("q=n&tab=MARCAS");
    const api = mockApi({
      "GET /api/search": (url: URL) => ({ results: url.searchParams.get("tab") === "MARCAS"
        ? [{ name: "Nike", slug: "nike", userId: "b1", registered: true, publicPieces: 12 }, { name: "Marca Nova", registered: false, publicPieces: 3 }]
        : [{ name: "Bia", slug: "bia", userId: "u2", avatarUrl: "/media/bia.jpg" }], nextCursor: null }),
      "GET /api/public-pieces": { items: [], nextCursor: null },
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
    fireEvent.click(screen.getByRole("button", { name: /Ver peças/ }));
    await waitFor(() => expect(api.calls.some((c) => c.path.startsWith("/api/search") && c.path.includes("tab=PECAS") && c.path.includes("brand=Marca"))).toBe(true));
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
