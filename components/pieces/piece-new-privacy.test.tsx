// @vitest-environment jsdom
/**
 * Regressão da auditoria (privacidade): /pieces/new salvava a peça como pública com a revisão mostrando "Privado",
 * porque "Compartilhar no feed" vinha ligado. O que é salvo tem de ser o que a revisão mostra.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, ME } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"] },
  colors: { white: "#ffffff" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" },
};
const ROUTES = {
  "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] }, "POST /api/pieces": { id: "nova" },
  "POST /api/interactions/PIECE/nova/shares": {},
};

const next = () => fireEvent.click(screen.getAllByRole("button").find((b) => /^Próximo$|^Avançar$/.test(b.textContent?.trim() ?? ""))!);
const save = () => fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
const pick = (id: string, option: string) => { fireEvent.click(document.getElementById(id)!); fireEvent.click(screen.getByRole("option", { name: option })); };
const visibilityShown = () => screen.getByText("Visibilidade", { selector: "dt" }).nextElementSibling?.textContent;

async function fillAndReview() {
  fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
  pick("subcategory", "Camiseta");
  pick("color", "Branco");
  pick("material", "Algodão");
  fireEvent.change(document.getElementById("price") as HTMLInputElement, { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Casual" }));
  fireEvent.click(screen.getByRole("button", { name: "Básico" }));
  for (let i = 0; i < 3; i++) next();
  await screen.findByRole("heading", { name: "Depois de salvar" });
}

describe("criador de peça — o que é salvo é o que a revisão mostra", () => {
  it("compartilhar no feed começa desligado: a revisão diz Privado e nada é publicado", async () => {
    const { calls } = loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    await fillAndReview();
    const share = screen.getByRole("switch", { name: /Compartilhar no feed/ });
    expect(share.getAttribute("aria-checked")).toBe("false");
    expect(visibilityShown()).toBe("Privado");
    // o preço sai com duas casas no formato do idioma (a revisão mostrava "89.9")
    expect(screen.getByText("Preço", { selector: "dt" }).nextElementSibling?.textContent).toBe("50,00");
    save();
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(true), { timeout: 4000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect((calls.find((c) => c.path === "/api/pieces")!.body as Record<string, unknown>).visibility).toBe("PRIVATE");
    expect(calls.some((c) => c.path.includes("/shares"))).toBe(false);
  });

  it("ao ligar o compartilhamento, a revisão passa a dizer Público antes de salvar", async () => {
    const { calls } = loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    await fillAndReview();
    fireEvent.click(screen.getByRole("switch", { name: /Compartilhar no feed/ }));
    expect(visibilityShown()).toBe("Público");
    expect(screen.getByText(/ela passa a ser pública/)).toBeTruthy();
    save();
    await waitFor(() => expect(calls.some((c) => c.path === "/api/interactions/PIECE/nova/shares")).toBe(true), { timeout: 4000 });
    expect(calls.find((c) => c.path === "/api/interactions/PIECE/nova/shares")!.body).toMatchObject({ channel: "FEED", publish: true });
  });
});
