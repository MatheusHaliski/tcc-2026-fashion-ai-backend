// @vitest-environment jsdom
/**
 * Guarda-roupa (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.2): a família da peça é ABA (muda o contexto) e o estado
 * (favoritas, indisponíveis, à venda, para doar) é filtro rápido. "Para doar" aparece no card para todos, a frente do
 * card mostra no máximo duas tags de estilo e o detalhe da peça liga/desliga "para doar" e "à venda".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { PIECE, PIECE_2, page } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { PieceView } from "@/lib/api/types";
import ClosetPage from "@/app/(site)/(app)/closet/page";
import { PieceCard } from "./piece-card";
import { ExpandedPiece } from "./expanded-card";

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"] }, colors: { white: "#fff" }, materials: [], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: {} };
const closetCalls = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "GET" && c.path.startsWith("/api/me/closet"));

beforeEach(() => { __resetHypeStore(); router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Minhas peças — categoria é aba, estado é filtro", () => {
  it("a aba de categoria envia a categoria ao closet e vai para a URL; o filtro de categoria saiu do FilterBar", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/taxonomy": TAXONOMY, "GET /api/me/closet": page([PIECE, PIECE_2]) });
    renderApp(<ClosetPage />);
    await settle();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Todas", label("upper_piece"), label("lower_piece"), label("shoes_piece"), label("accessory_piece")]);
    expect(screen.getByRole("tab", { name: "Todas" }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(closetCalls(api.calls).length).toBeGreaterThan(0));
    expect(closetCalls(api.calls)[0].path).not.toContain("category=");

    fireEvent.click(screen.getByRole("tab", { name: label("lower_piece") }));
    await waitFor(() => expect(closetCalls(api.calls).some((c) => c.path.includes("category=lower_piece"))).toBe(true));
    expect(screen.getByRole("tab", { name: label("lower_piece") }).getAttribute("aria-selected")).toBe("true");
    expect(router.replace).toHaveBeenCalledWith("/closet?category=lower_piece", { scroll: false });
    // a categoria virou aba: entre os filtros ficam cor, ocasião e Hype, sem "Categoria"
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(await screen.findByRole("group", { name: "Cor" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Ocasião" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Categoria" })).toBeNull();
  });

  it("abre na aba da URL (?category=) e o chip \"Para doar\" envia state=doar sem perder a aba", async () => {
    nav.search = new URLSearchParams("category=shoes_piece");
    const api = loggedAs(undefined, { ...HYPE, "GET /api/taxonomy": TAXONOMY, "GET /api/me/closet": page([PIECE]) });
    renderApp(<ClosetPage />);
    await settle();
    expect((await screen.findByRole("tab", { name: label("shoes_piece") })).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(closetCalls(api.calls)[0]?.path).toContain("category=shoes_piece"));

    fireEvent.click(screen.getByRole("button", { name: "Para doar" }));
    await waitFor(() => expect(closetCalls(api.calls).some((c) => c.path.includes("state=doar") && c.path.includes("category=shoes_piece"))).toBe(true));
    expect(screen.getByRole("button", { name: "Para doar" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("PieceCard — \"Para doar\" e tags essenciais", () => {
  const donated: PieceView = { ...PIECE, forDonation: true, forSale: false, style: ["basic", "casual", "streetwear"] };

  it("mostra o selo \"Para doar\" para quem visita (estado público) e no máximo duas tags de estilo", () => {
    mockApi(HYPE);
    const { container } = renderApp(<PieceCard piece={donated} />);
    expect(container.querySelector(".pc-flags")?.textContent).toContain("Para doar");
    const tags = container.querySelector(".pc-tags") as HTMLElement;
    expect(tags.title).toBe(`${label("basic")} · ${label("casual")}`);
    expect(tags.textContent).not.toContain(label("streetwear"));
    expect(tags.title.split(" · ")).toHaveLength(2);
  });

  it("sem estilo não há linha de tags; peça comum não mostra \"Para doar\"; na seleção (montar look) as tags somem", () => {
    mockApi(HYPE);
    const { container } = renderApp(<><PieceCard piece={{ ...PIECE, style: [] }} /><PieceCard piece={donated} selectable onSelect={vi.fn()} /></>);
    const [plain, selectable] = Array.from(container.querySelectorAll<HTMLElement>(".piece-card"));
    expect(plain.querySelector(".pc-tags")).toBeNull();
    expect(plain.textContent).not.toContain("Para doar");
    expect(selectable.querySelector(".pc-tags")).toBeNull();
  });
});

describe("detalhe da peça — \"Mais opções\" liga \"para doar\" e \"à venda\"", () => {
  it("o dono marca a peça para doar (PATCH /flags) e o detalhe acompanha a resposta (à venda sai)", async () => {
    let current: PieceView = { ...PIECE, forSale: true, forDonation: false };
    const api = loggedAs(undefined, {
      ...HYPE,
      "GET /api/pieces/p1": () => ({ piece: current }),
      "PATCH /api/pieces/p1/flags": (_u: URL, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Partial<PieceView>;
        // o backend deixa "à venda" e "para doar" exclusivos
        current = { ...current, ...body, ...(body.forDonation ? { forSale: false } : {}), ...(body.forSale ? { forDonation: false } : {}) };
        return current;
      },
    });
    renderApp(<ExpandedPiece id="p1" />);
    await settle();
    const more = await screen.findByRole("button", { name: /Mais opções/ });
    fireEvent.click(more);
    expect(screen.getByRole("menuitem", { name: "Tirar da venda" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Marcar para doar" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && c.path === "/api/pieces/p1/flags" && (c.body as { forDonation?: boolean })?.forDonation === true)).toBe(true));
    // a situação da peça mostra "Para doar" e o menu oferece desmarcar (e voltar a vender)
    await waitFor(() => expect(screen.getByText("Para doar")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    expect(screen.getByRole("menuitem", { name: "Desmarcar para doar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Colocar à venda" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && (c.body as { forSale?: boolean })?.forSale === true)).toBe(true));
    await waitFor(() => expect(screen.queryByText("Para doar")).toBeNull());
  });
});
