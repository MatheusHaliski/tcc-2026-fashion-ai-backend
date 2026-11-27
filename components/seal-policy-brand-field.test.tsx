// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { cleanPolicy, describePolicy, type SealPolicy, type SealRule } from "./seal-policy-editor";
import { SealPolicyBrandField } from "./seal-policy-brand-field";
import { SealPolicyBrands } from "./seal-policy-brands";

const ZARA = { id: "11111111-1111-4111-8111-111111111111", codigo: "zara", nome: "Zara" };
const ZARA_HOME = { id: "22222222-2222-4222-8222-222222222222", codigo: "zara-home", nome: "Zara Home" };
const AURORA = { id: "33333333-3333-4333-8333-333333333333", codigo: "atelie-aurora", nome: "Ateliê Aurora" };

function Harness({ initial, onRule }: { initial: SealRule; onRule: (r: SealRule) => void }) {
  const [rule, setRule] = useState<SealRule>(initial);
  return <SealPolicyBrandField index={0} rule={rule} onChange={(patch) => { const next = { ...rule, ...patch }; setRule(next); onRule(next); }} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("exercício 13 — marca exigida pela política do selo", () => {
  it("a regra guarda o tipo e o ID da marca escolhida na lista; o texto da busca não vira marca", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/opcoes/marcas-politica": (url: URL) => (url.searchParams.get("kind") === "PROFILE" ? [AURORA] : [ZARA, ZARA_HOME]),
    });
    let last: SealRule = { quantifier: "AT_LEAST", count: 1 };
    renderApp(<Harness initial={last} onRule={(r) => { last = r; }} />);
    const enabled = () => waitFor(() => expect(screen.getByLabelText("Marca exigida").hasAttribute("disabled")).toBe(false));
    const pick = (name: string) => { fireEvent.click(screen.getByLabelText("Marca exigida")); fireEvent.click(screen.getByRole("option", { name })); };
    await enabled();
    fireEvent.change(screen.getByLabelText("Buscar marca"), { target: { value: "Zara" } });
    expect(last.brandReference ?? null).toBeNull();                     // digitar não seleciona nada
    expect(last.brand ?? null).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/opcoes/marcas-politica") && c.path.includes("q=Zara"))).toBe(true));
    await enabled();
    pick("Zara Home");
    expect(last.brandReference).toEqual({ kind: "CATALOG", id: ZARA_HOME.id, nome: "Zara Home" });
    expect(last.brand).toBeNull();
    // trocar o tipo descarta o ID escolhido: ele só vale junto do tipo
    fireEvent.click(screen.getByRole("radio", { name: "Perfil de marca" }));
    expect(last.brandReference).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.path.includes("kind=PROFILE"))).toBe(true));
    await enabled();
    pick("Ateliê Aurora");
    expect(last.brandReference).toEqual({ kind: "PROFILE", id: AURORA.id, nome: "Ateliê Aurora" });
  });

  it("regra antiga com a marca em texto aparece como texto não verificado e pode ser removida", async () => {
    loggedAs(undefined, { "GET /api/opcoes/marcas-politica": [ZARA] });
    let last: SealRule = { quantifier: "ALL", brand: "Zara" };
    renderApp(<Harness initial={last} onRule={(r) => { last = r; }} />);
    expect(await screen.findByText(/Regra antiga com a marca em texto: «Zara»/)).toBeTruthy();
    expect(screen.getByLabelText("Marca exigida").textContent).toContain("Qualquer marca");
    fireEvent.click(screen.getByRole("button", { name: "Remover o texto" }));
    expect(last.brand).toBeNull();
  });

  it("o envio leva só tipo, ID e nome exibido, e a frase usa o nome da marca escolhida", () => {
    const policy: SealPolicy = { match: "ALL", occasions: [], styles: [],
      rules: [{ quantifier: "AT_LEAST", count: 2, brand: "texto antigo", brandReference: { kind: "CATALOG", id: ZARA.id, nome: "Zara", disponivel: true } }] };
    expect(cleanPolicy(policy)!.rules[0]).toMatchObject({ brand: null, brandReference: { kind: "CATALOG", id: ZARA.id, nome: "Zara" } });
    expect(cleanPolicy(policy)!.rules[0].brandReference).not.toHaveProperty("disponivel");
    expect(describePolicy(policy, "LOOK")).toBe("no mínimo 2 peças da marca Zara");
    expect(cleanPolicy({ match: "ALL", occasions: [], styles: [], rules: [{ quantifier: "ALL", brandReference: { kind: "PROFILE", id: AURORA.id } }] })!.rules).toHaveLength(1);
  });

  it("a leitura mostra a marca referenciada, a indisponível e o texto antigo sem confundi-los", () => {
    renderApp(<SealPolicyBrands policy={{ rules: [
      { brandReference: { kind: "CATALOG", id: ZARA.id, nome: "Zara", disponivel: true } },
      { brandReference: { kind: "PROFILE", id: AURORA.id, nome: "Ateliê Aurora", disponivel: false } },
      { brand: "Adidas" },
    ] }} />);
    expect(screen.getByText("Marca exigida: Zara (Catálogo de marcas)")).toBeTruthy();
    expect(screen.getByText("Marca exigida indisponível: Ateliê Aurora (Perfil de marca)")).toBeTruthy();
    expect(screen.getByText("Marca em texto, não verificada: Adidas")).toBeTruthy();
  });

  it("política sem marca não mostra a lista", () => {
    const { container } = renderApp(<SealPolicyBrands policy={{ rules: [{ }] }} />);
    expect(container.querySelector("[data-seal-policy-brands]")).toBeNull();
  });
});
