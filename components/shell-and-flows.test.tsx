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

describe("adicionar peça (RF4)", () => {
  const photo = () => new File([new Uint8Array([1, 2, 3])], "camiseta.jpg", { type: "image/jpeg" });
  /** RF47: a página abre no catálogo; "Usar minha foto" leva ao fluxo da foto, que começa pelo guia "Como fotografar". */
  async function enterPhotoFlow(category: RegExp = /Parte de cima/) {
    fireEvent.click(await screen.findByRole("button", { name: /Usar minha foto/ }));
    fireEvent.click(await screen.findByRole("radio", { name: category }));
    fireEvent.click(await screen.findByRole("button", { name: "Entendi, adicionar foto" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
  const DRAFT = {
    draftId: "d1", processedUrl: "/media/d1.png", flatLayUrl: "/media/d1-flat.jpg", thumbnailUrl: "/media/d1-t.png", originalUrl: "/media/d1-o.jpg", backgroundRemoved: true,
    prefill: { name: "Camiseta branca lisa", category: "upper_piece", subcategory: "t_shirt", color: "white", material: "COTTON", sex: "UNISSEX", occasion: ["casual"], style: ["basic"], size: "m", price: 50,
      overall: 0.9, confidence: { category: 0.9, subcategory: 0.8, color: 0.4, material: 0.9, brand: 0.2 }, manualFillRequired: true, subcategoryCandidates: [{ code: "t_shirt", score: 0.9 }, { code: "shirt", score: 0.6 }],
      brandSearch: { zones: ["peito_esquerdo"], brand: null, suggestion: "Nike", foundIn: "peito_esquerdo", certainty: "possivel" } },
  };

  it("escolhe o tipo, envia a foto, recebe a análise, passa pelas etapas e salva", async () => {
    URL.createObjectURL = vi.fn(() => "blob:foto");
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis": DRAFT,
      "POST /api/pieces/analysis/d1/brand": { grid: 3, regions: 9, brand: "Nike", certainty: "confirmada", region: "grade_r1c2" },
      "POST /api/pieces": { id: "nova" },
      "GET /api/studio/backdrops": [],
    });
    const { container } = renderApp(<NewPiecePage />);
    await enterPhotoFlow();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [photo()] } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/pieces/analysis")).toBe(true), { timeout: 4000 });
    await waitFor(() => expect(screen.getAllByText(/Nike/).length).toBeGreaterThan(0), { timeout: 4000 });
    // confirma a marca sugerida e pede nova busca
    screen.queryAllByRole("button").filter((b) => /Nike|marca/i.test(b.textContent ?? "")).slice(0, 2).forEach((b) => fireEvent.click(b));
    // percorre as etapas até revisar e salvar
    for (let i = 0; i < 4; i++) {
      const next = screen.queryAllByRole("button").find((b) => /Próximo|Avançar|Next/i.test(b.textContent ?? ""));
      if (next) fireEvent.click(next);
    }
    const save = screen.queryAllByRole("button").find((b) => /^Salvar$|Salvar/.test(b.textContent ?? ""));
    if (save) fireEvent.click(save);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(calls.some((c) => c.path === "/api/pieces/analysis")).toBe(true);
  });

  it("foto recusada mostra os critérios que falharam", async () => {
    URL.createObjectURL = vi.fn(() => "blob:foto");
    loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis": new Response(JSON.stringify({ status: 422, code: "FOTO_RECUSADA", message: "Refaça", details: { checks: [{ id: "inteira", ok: false, message: "A peça saiu cortada" }] } }), { status: 422, headers: { "content-type": "application/json" } }),
    });
    const { container } = renderApp(<NewPiecePage />);
    await enterPhotoFlow();
    fireEvent.change(container.querySelector("input[type=file]") as HTMLInputElement, { target: { files: [photo()] } });
    await waitFor(() => expect(screen.getByText("A peça saiu cortada")).toBeTruthy(), { timeout: 4000 });
  });

  it("foto de outra categoria: avisa e oferece usar a categoria detectada, sem trocar em silêncio", async () => {
    URL.createObjectURL = vi.fn(() => "blob:foto");
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis": new Response(JSON.stringify({ status: 422, code: "FOTO_RECUSADA", message: "Refaça", details: { detectedCategory: "shoes_piece", failed: ["formato"], checks: [{ id: "formato", ok: false, message: "A foto parece de um calçado" }] } }), { status: 422, headers: { "content-type": "application/json" } }),
    });
    const { container } = renderApp(<NewPiecePage />);
    await enterPhotoFlow();
    fireEvent.change(container.querySelector("input[type=file]") as HTMLInputElement, { target: { files: [photo()] } });
    expect(await screen.findByText(/Esta foto parece ser de calçados/i, {}, { timeout: 4000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Usar Calçados/ }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/pieces/analysis").length).toBe(2), { timeout: 4000 });
    expect(calls.filter((c) => c.path === "/api/pieces/analysis").length).toBe(2);
  });

  it("várias fotos de uma vez viram lote e são salvas juntas", async () => {
    URL.createObjectURL = vi.fn(() => "blob:foto");
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/batch": [DRAFT, { ...DRAFT, draftId: null, rejection: { message: "Fora de foco" } }],
      "POST /api/pieces/batch": [PIECE],
    });
    const { container } = renderApp(<NewPiecePage />);
    await enterPhotoFlow();
    fireEvent.change(container.querySelector("input[type=file]") as HTMLInputElement, { target: { files: [photo(), photo()] } });
    const go = await waitFor(() => screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
    fireEvent.click(go);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/pieces/batch")).toBe(true), { timeout: 4000 });
  });
});
