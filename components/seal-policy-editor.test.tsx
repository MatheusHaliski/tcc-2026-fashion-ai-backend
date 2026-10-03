// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { EMPTY_POLICY, SealPolicyEditor, cleanPolicy, describePolicy, type SealPolicy, type SealTierId } from "./seal-policy-editor";

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
