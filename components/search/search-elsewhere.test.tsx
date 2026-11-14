// @vitest-environment jsdom
/**
 * Regressão da auditoria: "jaqueta" dizia "Nada encontrado" na aba Looks embora existissem peças com esse nome; a
 * busca só olhava a aba aberta e não avisava. Agora a tela aponta as abas que têm resultado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, ME } from "@/test-utils/render";
import { SearchElsewhere, type SearchTab } from "./search-elsewhere";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const NAMES: Record<SearchTab, string> = { LOOKS: "Looks", PECAS: "Peças", PESSOAS: "Pessoas", MARCAS: "Marcas", CELEBRIDADES: "Celebridades" };
const byTab = (hits: Partial<Record<SearchTab, number>>) => ({
  "GET /api/search": (url: URL) => ({ results: Array.from({ length: hits[url.searchParams.get("tab") as SearchTab] ?? 0 }, (_, i) => ({ id: `r${i}` })), nextCursor: null }),
});

describe("busca vazia na aba aberta", () => {
  it("mostra as outras abas que têm resultado para o mesmo termo e abre a escolhida", async () => {
    const { calls } = loggedAs(ME, byTab({ PECAS: 1, MARCAS: 1 }));
    const onOpen = vi.fn();
    renderApp(<SearchElsewhere term="jaqueta" current="LOOKS" anonymous={false} labelOf={(tab) => NAMES[tab]} onOpen={onOpen} />);
    expect(await screen.findByText("Há resultados para esta busca em:")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Peças" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcas" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pessoas" })).toBeNull();
    // não pergunta de novo pela aba aberta e pede só 1 item por aba
    const asked = calls.filter((c) => c.path.startsWith("/api/search"));
    expect(asked.some((c) => c.path.includes("tab=LOOKS"))).toBe(false);
    expect(asked.every((c) => c.path.includes("size=1") && c.path.includes("q=jaqueta"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Peças" }));
    expect(onOpen).toHaveBeenCalledWith("PECAS");
  });

  it("sem resultado em nenhuma aba (ou sem termo) não mostra nada", async () => {
    loggedAs(ME, byTab({}));
    const { container } = renderApp(<SearchElsewhere term="xyzzy" current="LOOKS" anonymous={false} labelOf={(tab) => NAMES[tab]} onOpen={vi.fn()} />);
    await settle();
    expect(container.querySelector("[data-search-elsewhere]")).toBeNull();
    cleanup();
    const { calls } = loggedAs(ME, byTab({ PECAS: 3 }));
    renderApp(<SearchElsewhere term="  " current="LOOKS" anonymous={false} labelOf={(tab) => NAMES[tab]} onOpen={vi.fn()} />);
    await settle();
    expect(calls.some((c) => c.path.startsWith("/api/search"))).toBe(false);
  });
});
