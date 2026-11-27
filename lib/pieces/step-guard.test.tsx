// @vitest-environment jsdom
/**
 * Regressão da auditoria: o criador de peça deixava avançar todas as etapas sem nome, categoria e cor; ocasião e
 * estilo só eram cobrados ao salvar. A etapa Peça agora segura a pessoa e diz o que falta.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, within, ME } from "@/test-utils/render";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";
import { readFileSync } from "node:fs";
import { waitFor } from "@testing-library/react";
import { liveFieldErrors, pieceStepProblem } from "./step-guard";

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

  it("reauditoria: Avançar com campo faltando leva o foco ao primeiro campo com erro, em vez de voltar ao topo", async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<NewPiecePage />);
    await screen.findByRole("heading", { name: "Dados" });
    next();
    await screen.findByText("Dê um nome à peça.");
    await waitFor(() => expect((document.activeElement as HTMLElement | null)?.id).toBe("name"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("reauditoria: o aviso da categoria some quando o tipo da peça é escolhido nos botões do topo", async () => {
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<NewPiecePage />);
    await screen.findByRole("heading", { name: "Dados" });
    next();
    expect(await screen.findByText("Campo obrigatório: categoria.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Parte superior" }));
    await waitFor(() => expect(screen.queryByText("Campo obrigatório: categoria.")).toBeNull());
    expect(liveFieldErrors({ category: "x", color: "y" }, { category: "upper_piece", color: "" })).toEqual({ color: "y" });
  });

  it("a prévia não reserva uma coluna nem fica presa sobre o formulário", () => {
    const css = readFileSync("app/(site)/_styles/24-metamorfoses-layouts.css", "utf8");
    expect(css).not.toContain(".piece-create-preview");
    expect(css).not.toContain(".piece-create-layout:not(.is-art)");
    expect(css).toMatch(/\.piece-create-main \{ grid-row: 1; \}/);
  });

  it("abre a prévia atualizada em modal e preserva o formulário ao fechar", async () => {
    loggedAs(ME, { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<NewPiecePage />);
    await screen.findByRole("heading", { name: "Dados" });
    expect(screen.queryByRole("dialog", { name: "Prévia do card" })).toBeNull();
    expect(document.querySelector(".piece-card")).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camisa de teste" } });
    const trigger = screen.getByRole("button", { name: "Ver prévia do card" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Prévia do card" });
    expect(within(dialog).getByText("Camisa de teste")).toBeTruthy();
    expect(within(dialog).getByRole("radiogroup", { name: "Enquadramento da foto" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Peça inteira (Total frame)" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Prévia do card" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Camisa de teste");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia do card" }));
    expect(within(screen.getByRole("dialog", { name: "Prévia do card" })).getByRole("radio", { name: "Peça inteira (Total frame)" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Prévia do card" })).toBeNull();
  });
});
