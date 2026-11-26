// @vitest-environment jsdom
/**
 * Criador de peça: a etapa "1 · Peça" tem só nome, categoria, subcategoria e cor; material, tamanho, marca, preço,
 * referências (coleção, corte...), ocasião e estilo ficam abertos em "2 · Mais detalhes", sem seção recolhida.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, ME } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"] },
  colors: { white: "#ffffff" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" },
};
const ROUTES = { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] }, "GET /api/cortes": [], "GET /api/colecoes": [] };
const next = () => fireEvent.click(screen.getAllByRole("button").find((b) => /^Próximo$|^Avançar$/.test(b.textContent?.trim() ?? ""))!);
const pick = (id: string, option: string) => { fireEvent.click(document.getElementById(id)!); fireEvent.click(screen.getByRole("option", { name: option })); };
const stepChecked = (name: RegExp) => screen.getByRole("radio", { name }).getAttribute("aria-checked");

describe("criador de peça — campos adicionais na etapa 2 · Mais detalhes", () => {
  it("a etapa 1 só pede os dados da peça e a etapa 2 mostra os demais campos abertos", async () => {
    loggedAs(ME, ROUTES);
    const { container } = renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
    expect(document.getElementById("material")).toBeNull();
    expect(document.getElementById("corteId")).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
    pick("subcategory", "Camiseta");
    pick("color", "Branco");
    next();
    expect(stepChecked(/2 · Mais detalhes/)).toBe("true");
    expect(container.querySelector("details")).toBeNull();
    for (const id of ["material", "size", "price", "colecaoId", "corteId"]) expect(document.getElementById(id)).toBeTruthy();
  });

  it("sair de Mais detalhes sem material e preço não avança e mostra o que falta", async () => {
    loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
    pick("subcategory", "Camiseta");
    pick("color", "Branco");
    next();
    next();
    expect(stepChecked(/2 · Mais detalhes/)).toBe("true");
    expect(document.querySelector("[data-step-problem]")?.textContent).toMatch(/material/i);
  });
  it("com o Tipo Look automático do perfil ligado, o criador não pede o campo Sexo e envia o tipo do perfil", async () => {
    loggedAs(ME, { ...ROUTES, "GET /api/me/preferences/tipo-look": { tipoLook: { id: "t1", codigo: "UNISEX", nome: "Unisex" } } });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
    pick("subcategory", "Camiseta");
    pick("color", "Branco");
    next();
    expect(document.getElementById("material")).toBeTruthy();
    await waitFor(() => expect(document.getElementById("sex")).toBeNull());
  });

  it("sem o automático, o campo Sexo continua no criador", async () => {
    loggedAs(ME, { ...ROUTES, "GET /api/me/preferences/tipo-look": { tipoLook: null } });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
    pick("subcategory", "Camiseta");
    pick("color", "Branco");
    next();
    expect(document.getElementById("sex")).toBeTruthy();
  });
});
