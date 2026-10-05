// @vitest-environment jsdom
/**
 * Casca do app (menu, tema, notificações), abas do perfil (Lookbook) e o fluxo de adicionar peça (RF4): as partes que
 * a pessoa mais usa, com a API simulada e a sessão logada.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { ME } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME, page } from "@/test-utils/fixtures";
import { AppShell } from "./app-shell";
import { LookbookTabs, type TabId } from "./lookbook-tabs";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); router.replace.mockClear(); });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { white: "#ffffff", blue: "#1f4fa0", black: "#111111" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" },
};

describe("casca do app", () => {
  for (const [label, me, path] of [["pessoa", ME, "/closet"], ["admin", { ...ME, role: "ADMIN" as const }, "/admin/dashboard"], ["marca", { ...ME, user: { ...ME.user, profileType: "MARCA" as const } }, "/feed"]] as const) {
    it(`menu e atalhos para ${label}`, async () => {
      nav.pathname = path;
      loggedAs(me, { "GET /api/notifications/unread-count": { unread: 3 }, "GET /api/me/preferences": { theme: "dark", highContrast: true }, "PUT /api/me/preferences": {}, "PATCH /api/me/preferences": {} });
      renderApp(<AppShell><p>conteúdo</p></AppShell>);
      await waitFor(() => expect(screen.getByText("conteúdo")).toBeTruthy());
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      // abre e fecha o que houver: menu lateral, criar, tema, recolher
      for (const b of screen.getAllByRole("button").slice(0, 12)) { fireEvent.click(b); fireEvent.keyDown(document, { key: "Escape" }); }
      expect(screen.getAllByRole("link").length).toBeGreaterThan(3);
    });
  }

  it("sem sessão mostra o acesso", async () => {
    loggedAs(ME, {});
    document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    const { tokenStore } = await import("@/lib/api/client"); tokenStore.clear(); localStorage.clear();
    nav.pathname = "/";
    renderApp(<AppShell><p>público</p></AppShell>);
    await waitFor(() => expect(screen.getByText("público")).toBeTruthy());
  });
});

describe("abas do perfil (Lookbook)", () => {
  const routes = {
    "GET /api/users/u1/closet": page([PIECE, PIECE_2]), "GET /api/me/closet": page([PIECE, PIECE_2]),
    "GET /api/me/schemes": page([SCHEME]), "GET /api/users/u1/schemes": page([SCHEME]),
    "GET /api/taxonomy": TAXONOMY,
  };
  for (const tab of ["closet", "looks", "dna", "saved_looks", "saved_pieces", "daily", "capsule", "groups", "coupons"] as TabId[]) {
    it(`aba ${tab} abre sem quebrar`, async () => {
      loggedAs(ME, routes);
      const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab={tab} />);
      await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
      // troca para a próxima aba pelo seletor
      const tabs = screen.queryAllByRole("tab");
      if (tabs.length > 1) fireEvent.click(tabs[1]);
    });
  }
});

describe("adicionar peça (RF4/RF47) — etapa única Peça, foto opcional", () => {
  it("tipo, busca catalogada e dados na mesma etapa; a foto é opcional e aceita várias fotos", async () => {
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    const { container } = renderApp(<NewPiecePage />);
    expect(await screen.findByRole("heading", { name: "Buscar no catálogo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dados" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prefere fotografar?" })).toBeTruthy();
    const input = container.querySelector("input[type=file]")!;
    expect(input.hasAttribute("multiple")).toBe(true);
  });

  it("sem produto do catálogo, salva a peça com os dados do formulário e a ilustração da categoria", async () => {
    const { calls } = loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] }, "POST /api/pieces": { id: "nova" } });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
    // o Select desenha a própria lista (Dropdown): abre pelo botão do campo e escolhe a opção
    const pick = (id: string, option: string) => { fireEvent.click(document.getElementById(id)!); fireEvent.click(screen.getByRole("option", { name: option })); };
    pick("subcategory", "Camiseta");
    pick("color", "Branco");
    pick("material", "Algodão");
    fireEvent.change(document.getElementById("price") as HTMLInputElement, { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Casual" }));
    fireEvent.click(screen.getByRole("button", { name: "Básico" }));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getAllByRole("button").find((b) => /Próximo|Avançar|Next/i.test(b.textContent ?? ""))!);
    expect(await screen.findByText(/Ilustração da categoria/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(true), { timeout: 4000 });
    const body = calls.find((c) => c.path === "/api/pieces")!.body as Record<string, unknown>;
    expect(body.name).toBe("Camiseta branca");
    expect(body.useDefaultImage).toBe(true);
    expect(body.draftId ?? null).toBeNull();
  });
});
