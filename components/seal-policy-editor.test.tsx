// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { EMPTY_POLICY, SealPolicyEditor, cleanHype, cleanPolicy, describeHype, describePolicy, type SealPolicy, type SealTierId } from "./seal-policy-editor";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"], full_body_piece: ["dress"] },
  colors: { blue: "#2A5FA8", navy: "#1B2A4A", red: "#C62B28" }, colorFamilies: { blue: "Azul", navy: "Azul", red: "Vermelho" },
  materials: [], sizes: [], sexes: [], occasions: ["casual", "party"], styles: ["streetwear", "classic"], allowedOccasionsByCategory: {}, brands: [],
};

function Harness({ onPolicy, onTier }: { onPolicy: (p: SealPolicy) => void; onTier?: (t: SealTierId) => void }) {
  const [p, setP] = useState<SealPolicy>(EMPTY_POLICY); const [tier, setTier] = useState<SealTierId>("LOOK");
  return <SealPolicyEditor value={p} tier={tier} brandName="Zara" onTier={(t) => { setTier(t); onTier?.(t); }} onChange={(np) => { setP(np); onPolicy(np); }} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF25 — política padronizada do selo", () => {
  it("modelos prontos viram regras (sem texto livre) e a frase acompanha", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let last: { p: SealPolicy } | null = null;
    renderApp(<Harness onPolicy={(p) => { last = { p }; }} />);
    fireEvent.click(await screen.findByRole("button", { name: "no mínimo 3 peças na cor azul da marca Zara" }));
    expect(last!.p.rules).toEqual([{ quantifier: "AT_LEAST", count: 3, color: "Azul", brand: "Zara" }]);
    expect(screen.getAllByText("no mínimo 3 peças na cor azul da marca Zara").length).toBeGreaterThan(0);
    expect(screen.queryByRole("textbox", { name: /política/i })).toBeNull();          // não há mais campo de texto livre
  });

  it("peça vermelha muda o nível para Peça", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let tier: SealTierId = "LOOK";
    renderApp(<Harness onPolicy={() => undefined} onTier={(t) => { tier = t; }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Peça na cor vermelho" }));
    expect(tier).toBe("PECA");
  });

  it("tags de ocasião e estilo são escolhas da taxonomia, não texto separado por vírgula", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let last: SealPolicy = EMPTY_POLICY;
    renderApp(<Harness onPolicy={(p) => { last = p; }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Festa" }));
    expect(last.occasions).toEqual(["party"]);
  });

  it("limpa regras vazias e gera a frase da política inteira", () => {
    expect(cleanPolicy({ match: "ALL", rules: [{ quantifier: "ALL" }], occasions: [], styles: [] })).toBeNull();
    const p: SealPolicy = { match: "ALL", rules: [{ quantifier: "ALL", color: "Amarelo", brand: " Adidas " }], occasions: [], styles: [] };
    expect(cleanPolicy(p)!.rules[0].brand).toBe("Adidas");
    expect(describePolicy(p, "LOOK")).toBe("todas as peças na cor amarelo da marca Adidas");
  });
});

describe("RF53 — Hype na política do selo", () => {
  const nikeHot: SealPolicy = { match: "ALL", rules: [{ quantifier: "AT_LEAST", count: 2, brand: "Nike", hypeMin: "HOT" }], occasions: [], styles: [], hype: { minScore: 60, momentum: ["RISING"] } };

  it("a frase junta a regra com Hype mínimo e o Hype da entidade (como no contrato)", () => {
    expect(describePolicy(nikeHot, "LOOK")).toBe("no mínimo 2 peças da marca Nike com Hype ≥ Em alta; look com Hype ≥ 60 e em crescimento");
    // no nível Peça o Hype vale para a própria peça
    expect(describePolicy({ ...nikeHot, rules: [{ quantifier: "ALL", hypeMin: "VIRAL" }] }, "PECA")).toBe("Peça com Hype ≥ Viral; peça com Hype ≥ 60 e em crescimento");
    expect(describeHype({ minLevel: "HOT", minScore: 70 }, "LOOK")).toBe("look com Hype ≥ Em alta e ≥ 70");
    expect(describeHype({ momentum: ["CLASSIC"] }, "PECA")).toBe("peça clássica");
    expect(describeHype({ momentum: ["RISING", "EMERGING"] }, "LOOK")).toBe("look em crescimento ou emergente");
    expect(describeHype(null, "LOOK")).toBe("");
  });

  it("política só com Hype é válida; regra só com Hype mínimo também conta como filtro", () => {
    const onlyHype: SealPolicy = { ...EMPTY_POLICY, hype: { minLevel: "TRENDING" } };
    expect(cleanPolicy(onlyHype)).toEqual({ match: "ALL", rules: [], occasions: [], styles: [], hype: { minLevel: "TRENDING", minScore: null, momentum: [] } });
    expect(describePolicy(onlyHype, "PECA")).toBe("peça com Hype ≥ Tendência");
    const onlyRule = cleanPolicy({ ...EMPTY_POLICY, rules: [{ quantifier: "AT_LEAST", count: 2, hypeMin: "HOT" }] })!;
    expect(onlyRule.rules).toEqual([{ quantifier: "AT_LEAST", count: 2, color: null, brand: null, category: null, subcategory: null, hypeMin: "HOT" }]);
    expect(describePolicy(onlyRule, "LOOK")).toBe("no mínimo 2 peças com Hype ≥ Em alta");
  });

  it("cleanPolicy/cleanHype: nível inválido sai, score vira inteiro 0–100, momento sem repetição e no máximo 3", () => {
    expect(cleanHype({ minLevel: "SUPER" as never, minScore: 150, momentum: ["RISING", "RISING", "XYZ" as never] })).toEqual({ minLevel: null, minScore: 100, momentum: ["RISING"] });
    expect(cleanHype({ minScore: -5.4 })).toEqual({ minLevel: null, minScore: 0, momentum: [] });
    expect(cleanHype({ momentum: ["EMERGING", "RISING", "STABLE", "CLASSIC"] })!.momentum).toHaveLength(3);
    expect(cleanHype({ minLevel: null, minScore: null, momentum: [] })).toBeNull();
    // Hype vazio não vai no envio; regra com hypeMin inválido e sem outro filtro some
    const c = cleanPolicy({ ...EMPTY_POLICY, rules: [{ quantifier: "ALL", hypeMin: "X" as never }, { quantifier: "ALL", color: "Azul" }], hype: {} })!;
    expect(c.rules).toHaveLength(1);
    expect(c.rules[0]).not.toHaveProperty("hypeMin");
    expect(c).not.toHaveProperty("hype");
  });

  it("o editor tem a seção de Hype (nível, score, momento) e o \"Hype mín.\" por regra, com rótulos acessíveis", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let last: SealPolicy = EMPTY_POLICY;
    renderApp(<Harness onPolicy={(p) => { last = p; }} />);
    expect(await screen.findByText("Critério de Hype")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nível mínimo de Hype" }));
    fireEvent.click(screen.getByRole("option", { name: "Em alta ou mais" }));
    expect(last.hype).toMatchObject({ minLevel: "HOT" });
    fireEvent.change(screen.getByLabelText("Score mínimo de Hype (0–100)"), { target: { value: "60" } });
    expect(last.hype).toMatchObject({ minLevel: "HOT", minScore: 60 });
    const rising = screen.getByRole("button", { name: "Em crescimento" });
    fireEvent.click(rising);
    expect(last.hype?.momentum).toEqual(["RISING"]);
    expect(screen.getByRole("button", { name: /Em crescimento/ }).getAttribute("aria-pressed")).toBe("true");   // estado em atributo, não só cor
    expect(screen.getAllByText("look com Hype ≥ Em alta e ≥ 60 e em crescimento").length).toBeGreaterThan(0);
    // limpar tudo tira o critério de Hype da política
    fireEvent.change(screen.getByLabelText("Score mínimo de Hype (0–100)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Em crescimento/ }));
    fireEvent.click(screen.getByRole("button", { name: "Nível mínimo de Hype" }));
    fireEvent.click(screen.getByRole("option", { name: "Qualquer nível" }));
    expect(last.hype).toBeNull();

    // por regra: "Hype mín." filtra as peças da regra
    fireEvent.click(screen.getByRole("button", { name: "Adicionar regra" }));
    fireEvent.click(screen.getByRole("button", { name: "Hype mín." }));
    fireEvent.click(screen.getByRole("option", { name: "Viral ou mais" }));
    expect(last.rules[0].hypeMin).toBe("VIRAL");
    expect(screen.getAllByText(/ao menos uma peça da marca Zara com Hype ≥ Viral/).length).toBeGreaterThan(0);
  });
});
