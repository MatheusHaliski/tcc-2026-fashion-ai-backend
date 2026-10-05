// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { FlairCardView, rarityBasis, type FlairCard } from "@/components/flair/flair-card";
import { LookTile, STAT_HINT, STAT_LABEL, type ModeLook } from "@/components/flair/modes-shared";
import { LeagueTable, type LeagueRow } from "@/components/flair/modes";
import ptBR from "@/lib/i18n/messages/pt-BR.json";

afterEach(() => cleanup());

const CARD: FlairCard = {
  id: "p1", name: "Bota Sete Léguas", category: "shoes_piece", subcategory: "boots", styles: [], occasions: [], season: "ALL",
  stats: { EDGE: 20, RANGE: 0, CLOUT: 20, GLOW: 70, ART: 10, SYNC: 100 }, rarity: "RARE", multiplier: 1.5, power: 165,
  hype: { score: 72, level: "HOT", rarity: 82 },
};
const LOOK: ModeLook = {
  schemeId: "s1", title: "Neon Street", owner: "ana", rating: 64, synergies: [], styles: [], occasions: [], cards: [],
  stats: { HYPE: 50, STYLE: 70, COLOR: 80, OCCASION: 46, ORIGINALITY: 60, BRAND: 60, RARITY: 40, TREND: 70, COMMUNITY: 18, AI: 70 },
};
const row = (over: Partial<LeagueRow>): LeagueRow => ({ position: 1, user: { id: "u1", username: "ana", displayName: "Ana", profileType: "PESSOAL", verified: false, privateAccount: false },
  played: 3, wins: 2, draws: 0, losses: 1, points: 6, division: { label: "Prata" }, you: true, ...over });

describe("FLAIR em v2 (RF53 · Lote 8)", () => {
  it("atributo HYPE: rótulo diz que é o HypeScore público e a dica explica neutro 50 e peso", () => {
    renderApp(<LookTile look={LOOK} />);
    expect(STAT_LABEL.HYPE).toBe("HypeScore (público)");
    expect(STAT_HINT.HYPE).toMatch(/não qualidade/);
    expect(STAT_HINT.HYPE).toMatch(/50 \(neutro\)/);
    const hype = screen.getByText("HypeScore (público)").closest("li")!;
    expect(hype.getAttribute("title")).toBe(STAT_HINT.HYPE);
    expect(hype.textContent).toContain("50");
  });

  it("liga: a coluna de soma das rodadas é 'Pontos de estilo', não 'Hype'", () => {
    renderApp(<LeagueTable rows={[row({ stylePoints: 1234 }), row({ position: 2, user: { id: "u2", username: "bia", displayName: "Bia", profileType: "PESSOAL", verified: false, privateAccount: false }, you: false, hype: 77 })]} />);
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toContain("Pontos de estilo");
    expect(headers).not.toContain("Hype");
    expect(screen.getByRole("columnheader", { name: "Pontos de estilo" }).getAttribute("title")).toMatch(/Não é o HypeScore/);
    expect(screen.getByText("1.234")).toBeTruthy();       // stylePoints
    expect(screen.getByText("77")).toBeTruthy();          // payload antigo: alias hype ainda é lido
  });

  it("carta: a base da raridade vem do Hype v2 público em texto, nunca do preço", () => {
    renderApp(<FlairCardView card={CARD} />);
    const card = screen.getByLabelText(/Bota Sete Léguas/);
    expect(card.getAttribute("aria-label")).toContain("Raridade do modelo 82 · Em alta");
    expect(screen.getByText("Rare").getAttribute("title")).toBe("Raridade do modelo 82 · Em alta");
    expect(rarityBasis({ hype: null })).toBe("Sem Hype público: só selo, 3D e foto contam");
    expect(rarityBasis({ hype: { score: null, level: null, rarity: 64 } })).toBe("Raridade do modelo 64 · Dados insuficientes");
    expect(rarityBasis({ hype: { score: 91, level: "VIRAL", rarity: null } })).toBe("Raridade do modelo — · Viral");
  });

  it("textos de regra: raridade sem preço e sem juízo de qualidade", () => {
    const msgs = ptBR as Record<string, string>;
    expect(msgs["hypeFlair.raridade_regra"]).toMatch(/Preço nunca conta/);
    expect(msgs["hypeFlair.raridade_regra"]).not.toMatch(/R\$/);
    expect(msgs["hypeFlair.modes_nota"]).not.toMatch(/força-base/);
  });
});
