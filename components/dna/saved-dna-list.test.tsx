// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp, screen, settle } from "@/test-utils/render";
import { SavedDnaList } from "./saved-dna-list";
import { dnaReason } from "@/components/history/history-style";

afterEach(cleanup);

describe("DNA de estilo › DNAs salvos no topo da aba", () => {
  it("lista cada DNA salvo com link, arquétipo e visibilidade", async () => {
    loggedAs(undefined, { "GET /api/me/dna-schemes": [
      { id: "d1", title: "DNA da reauditoria", archetypeLabel: "Natural", visibility: "PRIVATE", createdAt: "2026-11-14T14:00:00Z" },
    ] });
    renderApp(<SavedDnaList />);
    const link = await screen.findByRole("link", { name: "DNA da reauditoria" });
    expect(link.getAttribute("href")).toBe("/dna-schemes/d1");
    expect(screen.getByRole("list", { name: "Seus DNAs de estilo salvos" }).textContent).toMatch(/Natural · Privado · 14 de nov\. de 2026/);
  });

  it("sem DNA salvo, a seção não aparece", async () => {
    loggedAs(undefined, { "GET /api/me/dna-schemes": [] });
    const { container } = renderApp(<SavedDnaList />);
    await settle();
    expect(container.textContent).not.toContain("Seus DNAs de estilo salvos");
  });
});

describe("Histórico › versões do DNA", () => {
  it("cada versão diz por que existe, para duas versões iguais não parecerem repetidas", () => {
    const t = (key: string) => ({ "history.style.dna_reason.GERACAO": "criado", "history.style.dna_reason.EVOLUCAO": "atualizado com o seu uso" })[key] ?? key;
    expect(dnaReason("GERACAO", t)).toBe(" · criado");
    expect(dnaReason("EVOLUCAO", t)).toBe(" · atualizado com o seu uso");
    expect(dnaReason(undefined, t)).toBe("");
  });
});
