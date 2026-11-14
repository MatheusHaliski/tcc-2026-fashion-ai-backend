// @vitest-environment jsdom
/**
 * Regressão da auditoria: o criador de peça deixava avançar todas as etapas sem nome, categoria e cor; ocasião e
 * estilo só eram cobrados ao salvar. A etapa Peça agora segura a pessoa e diz o que falta.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, ME } from "@/test-utils/render";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";
import { pieceStepProblem } from "./step-guard";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"] }, colors: { white: "#ffffff" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: { upper_piece: ["casual"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" },
};
const next = () => fireEvent.click(screen.getAllByRole("button").find((b) => /^Próximo$|^Avançar$/.test(b.textContent?.trim() ?? ""))!);

describe("etapa Peça do criador — campos obrigatórios", () => {
  it("sem erros, deixa avançar; com erros, diz quais campos faltam pelo nome da tela", () => {
    expect(pieceStepProblem({})).toBeNull();
    expect(pieceStepProblem({ name: "x", color: "y", occasion: "z" })).toBe("Para avançar, preencha: nome, cor, ocasião.");
  });

  it("Avançar com o formulário vazio fica na etapa, marca os campos e lista o que falta", async () => {
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<NewPiecePage />);
    await screen.findByRole("heading", { name: "Dados" });
    next();
    const problem = await screen.findByText(/Para avançar, preencha: nome, categoria, subcategoria, cor, material, preço/);
    expect(problem.getAttribute("role")).toBe("alert");
    expect(screen.getByRole("heading", { name: "Dados" })).toBeTruthy();
    expect(screen.getByText("Dê um nome à peça.")).toBeTruthy();
  });

  it("pular direto para Revisar pelas abas das etapas também é barrado", async () => {
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<NewPiecePage />);
    await screen.findByRole("heading", { name: "Dados" });
    fireEvent.click(screen.getByRole("radio", { name: /Revisar/ }));
    expect(await screen.findByText(/Para avançar, preencha:/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Depois de salvar" })).toBeNull();
  });
});
