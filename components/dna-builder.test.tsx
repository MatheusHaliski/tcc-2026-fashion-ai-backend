// @vitest-environment jsdom
/**
 * Criador de DNA de estilo no mesmo padrão do Background Studio do look: a narrativa B11 (Cartela sazonal) abre o
 * modal de cartela e animação em Layout & Estilo — com a cartela automática pela estação do DNA —, nada muda até
 * Aplicar, e o resumo da cartela aparece abaixo das narrativas.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { OWNER, SCHEME } from "@/test-utils/fixtures";
import type { BgCatalog } from "./background-studio";
import type { DnaCellView, DnaView } from "./dna-card";
import { DnaBuilder } from "./dna-builder";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CATALOG: Partial<BgCatalog> = {
  colors: ["#FFFFFF"], gradients: [], auraPresets: [], materials: [], skins: [], directions: {}, anatomies: [], imageGenerationAvailable: false,
  seasonal: [{ id: "frost", name: "Frost", season: "WINTER", stops: ["#E8F1F8", "#5C7A99"] }], animations: ["NONE", "SNOW"],
};
const cell = (schemeId: string, title: string): DnaCellView => ({ cell: schemeId, schemeId, title, occasion: [], style: [], milestone: false, pieces: [] });
const DNA: DnaView = {
  id: "d1", owner: OWNER, title: "Meu DNA", palette: [], cardLayout: "AMPLIADO", targetElement: "DNA_COMPLETO", narrativeType: "TIMELINE",
  seasonalTheme: "WINTER", visibility: "PRIVATE", status: "PUBLISHED", background: {}, cardSkin: "atelier",
  cells: [cell("s1", "Look de sexta"), cell("s2", "Look de domingo")], logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: true,
};

describe("DNA de estilo — Cartela sazonal no padrão do Background Studio", () => {
  it("B11 abre o modal com cartela, cartela automática e animação; Aplicar entra na narrativa", async () => {
    loggedAs(undefined, {
      "GET /api/dna-schemes/builder": { totalSchemes: 2, status: "OK", schemes: [SCHEME, { ...SCHEME, id: "s2", title: "Look de domingo" }], defaultVisibility: "PRIVATE" },
      "GET /api/backgrounds/catalog": CATALOG, "/api/backgrounds/recommendations": {},
    });
    renderApp(<DnaBuilder initial={DNA} />);
    fireEvent.click(await screen.findByRole("button", { name: /Aparência/ }));
    fireEvent.click(await screen.findByRole("radio", { name: "Layout & Estilo" }));
    const b11 = screen.getByRole("button", { name: /B11\s*Cartela sazonal/ });
    expect(b11.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(b11);
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Cartela sazonal automática/)).toBeTruthy();   // o DNA tem estação: a automática aparece
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: /B11\s*Cartela sazonal/ }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /B11\s*Cartela sazonal/ }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Frost/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Neve" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /B11\s*Cartela sazonal/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Frost · Neve/)).toBeTruthy();
  });
});
