// @vitest-environment jsdom
/**
 * Números nas sugestões (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote 6): Copilot › Experimentação mostra os seis números de
 * cada combinação nova (P2-16) e Autopiloto › Semana mostra os de cada dia com look (P3-09). Hype é só uma dimensão, ao
 * lado da compatibilidade com o DNA; "—" = sem base, nunca 0; lacuna da semana não tem números.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, within } from "@/test-utils/render";
import { PIECE, PIECE_2 } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import CopilotPage from "@/app/(site)/(app)/copilot/page";
import AutopilotPage from "@/app/(site)/(app)/autopilot/page";

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"] }, colors: { white: "#fff" }, materials: [], sizes: [], sexes: [], occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: {} };
const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const score = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling?.textContent;

beforeEach(() => { __resetHypeStore(); try { localStorage.clear(); } catch { /* sem storage */ } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Copilot › Experimentação", () => {
  it("cada combinação nova traz os seis números lado a lado, com \"—\" para dimensão sem base", async () => {
    loggedAs(undefined, { ...HYPE,
      "GET /api/copilot/context": { userId: "u1", view: "COPILOT", pieces: 6, available: 6, ready: true, suggestedPrompts: [] },
      "GET /api/copilot/suggestions": { readyLooks: [], forgottenPieces: [], weatherPieces: [], trendingLooks: [],
        newCombinations: [{ title: "Combinação nova", rationale: "Traz de volta peças paradas.", occasions: ["casual"], pieces: [PIECE, PIECE_2], pieceIds: ["p1", "p2"],
          scores: { compatibility: 76, hype: null, novelty: 100, reuse: 50, usage: 40, sustainability: 60 } }] } });
    renderApp(<CopilotPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Experimentação" }));
    const card = (await screen.findByRole("article", { name: "Combinação nova" })) as HTMLElement;
    expect(score(card, "Compatibilidade")).toBe("76");
    expect(score(card, "Hype")).toBe("—");
    expect(score(card, "Novidade")).toBe("100");
    expect(score(card, "Reutilização")).toBe("50");
    expect(score(card, "Uso comprovado")).toBe("40");
    expect(score(card, "Sustentabilidade")).toBe("60");
    expect(card.textContent).not.toMatch(/Hype\s*0/);
  });

  it("combinação sem números (backend antigo) continua sem a grade", async () => {
    loggedAs(undefined, { ...HYPE,
      "GET /api/copilot/context": { userId: "u1", view: "COPILOT", pieces: 6, available: 6, ready: true, suggestedPrompts: [] },
      "GET /api/copilot/suggestions": { readyLooks: [], forgottenPieces: [], weatherPieces: [], trendingLooks: [],
        newCombinations: [{ title: "Combinação antiga", pieces: [PIECE], pieceIds: ["p1"] }] } });
    renderApp(<CopilotPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Experimentação" }));
    const card = (await screen.findByRole("article", { name: "Combinação antiga" })) as HTMLElement;
    expect(card.querySelector(".copilot-scores")).toBeNull();
  });
});

describe("Autopiloto › Semana", () => {
  it("cada dia com look mostra os seis números; a lacuna não tem números", async () => {
    loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY,
      "GET /api/autopilot/weeks/current": { active: true, id: "w1", weekStart: "2026-10-05", distinctLooks: 1, gaps: [],
        days: [{ id: "d1", date: "2026-10-05", occasion: "work", title: "Segunda de trabalho", pieces: [], scores: { compatibility: 90, hype: 45, novelty: 20, reuse: 0, usage: 80, sustainability: null } },
          { id: "d2", date: "2026-10-06", occasion: "casual", gap: true, scores: null }] } });
    const { container } = renderApp(<AutopilotPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Semana" }));
    expect(await screen.findByText("Segunda de trabalho")).toBeTruthy();
    const grids = container.querySelectorAll(".copilot-scores");
    expect(grids).toHaveLength(1);
    const day = grids[0] as HTMLElement;
    expect(score(day, "Compatibilidade")).toBe("90");
    expect(score(day, "Hype")).toBe("45");
    expect(score(day, "Reutilização")).toBe("0");      // 0 de verdade (nada parado) é número; sem base é "—"
    expect(score(day, "Sustentabilidade")).toBe("—");
  });
});
