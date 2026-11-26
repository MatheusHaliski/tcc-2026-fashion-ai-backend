// @vitest-environment jsdom
/**
 * Exercício 12 · política do selo: quantidade mínima por cor. O editor emite a regra estruturada
 * {quantifier, count, color} (nunca texto livre), a quantidade é inteira de 1 a 4, e a prévia de selos do look mostra
 * quantas peças contaram para a regra.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { EMPTY_POLICY, SealPolicyEditor, cleanPolicy, describePolicy, type SealPolicy } from "./seal-policy-editor";
import { SealSuggestions, type SealSearch } from "./look-seal-verification";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"], full_body_piece: ["dress"] },
  colors: { blue: "#2A5FA8", red: "#C62B28" }, colorFamilies: { blue: "Azul", red: "Vermelho" },
  materials: [], sizes: [], sexes: [], occasions: ["casual"], styles: ["classic"], allowedOccasionsByCategory: {}, brands: [],
};

function Editor({ onPolicy }: { onPolicy: (p: SealPolicy) => void }) {
  const [p, setP] = useState<SealPolicy>({ ...EMPTY_POLICY, rules: [{ quantifier: "AT_LEAST", count: 1, color: "blue" }] });
  return <SealPolicyEditor value={p} tier="LOOK" onTier={() => {}} onChange={(np) => { setP(np); onPolicy(np); }} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("exercício 12 · editor da política", () => {
  it("o passo + leva a quantidade a 2 e o que vai para a API é a regra estruturada", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let last: SealPolicy | null = null;
    renderApp(<Editor onPolicy={(p) => { last = p; }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mais uma peça" }));
    await waitFor(() => expect(last).not.toBeNull());
    expect(cleanPolicy(last)!.rules).toEqual([{ quantifier: "AT_LEAST", count: 2, color: "blue", brand: null, category: null, subcategory: null }]);
    expect(describePolicy(last, "LOOK")).toContain("no mínimo 2 peças");
  });

  it("a quantidade para em 4 e em 1: o editor não manda 0, 5 nem fração", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let last: SealPolicy | null = null;
    renderApp(<Editor onPolicy={(p) => { last = p; }} />);
    const mais = await screen.findByRole("button", { name: "Mais uma peça" }) as HTMLButtonElement;
    const menos = screen.getByRole("button", { name: "Menos uma peça" }) as HTMLButtonElement;
    expect(menos.disabled).toBe(true);
    for (let i = 0; i < 6; i++) fireEvent.click(mais);
    expect(last!.rules[0].count).toBe(4);
    expect(mais.disabled).toBe(true);
    expect(cleanPolicy({ ...EMPTY_POLICY, rules: [{ quantifier: "AT_LEAST", count: 0, color: "blue" }] })!.rules[0].count).toBe(1);
    expect(cleanPolicy({ ...EMPTY_POLICY, rules: [{ quantifier: "AT_LEAST", count: 9, color: "blue" }] })!.rules[0].count).toBe(4);
  });
});

describe("exercício 12 · prévia de selos do look", () => {
  const base = { picked: [], onToggle: () => {}, consent: false, onConsent: () => {}, onRetry: () => {} };

  it("mostra o motivo e quantas peças contaram para a regra", () => {
    const search: SealSearch = { loading: false, list: [{ targetOwnerId: "b1", kind: "BRAND", name: "Maison", justification: "Atende ao selo Azul em dobro: no mínimo 2 peças na cor azul", pieceIds: ["p1", "p2"] }] };
    const { container } = renderApp(<SealSuggestions {...base} search={search} />);
    expect(screen.getByText("2 peças contaram para a regra")).toBeTruthy();
    expect(container.querySelector("[data-seal-counted]")?.getAttribute("data-seal-counted")).toBe("2");
    expect(screen.getByText(/no mínimo 2 peças na cor azul/)).toBeTruthy();
  });

  it("look que não atende mostra a mensagem do servidor; carregando e falha têm estado próprio", () => {
    const nenhum = renderApp(<SealSuggestions {...base} search={{ loading: false, list: [], message: "Nenhuma marca ou celebridade atingiu os critérios." }} />);
    expect(screen.getByText("Nenhuma marca ou celebridade atingiu os critérios.")).toBeTruthy();
    expect(nenhum.container.querySelector("[data-seal-counted]")).toBeNull();
    nenhum.unmount();
    const carregando = renderApp(<SealSuggestions {...base} search={{ loading: true, list: [] }} />);
    expect(screen.getByRole("status").textContent).toContain("Pesquisando selos possíveis");
    carregando.unmount();
    renderApp(<SealSuggestions {...base} search={{ loading: false, list: [], failed: true }} />);
    expect(screen.getByRole("button", { name: "Verificar selos" })).toBeTruthy();
  });
});
