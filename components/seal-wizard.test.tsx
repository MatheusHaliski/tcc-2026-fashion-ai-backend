// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { DEFAULT_DESIGN, SealMedallion, sealKind } from "./seal-medallion";
import { EMPTY_POLICY } from "./seal-policy-editor";
import { SealWizard, displayDesign, type SealFormState } from "./seal-wizard";
import { CIRCULAR_TEMPLATES, FAI_TEMPLATES, FOLHA_TEMPLATES } from "@/lib/seals/templates";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"] }, colors: { blue: "#2A5FA8" }, colorFamilies: { blue: "Azul" },
  materials: [], sizes: [], sexes: [], occasions: ["party"], styles: ["streetwear"], allowedOccasionsByCategory: {}, brands: [],
};
const EMPTY: SealFormState = { open: true, name: "", tier: "LOOK", policyText: "", usageLimit: "", status: "ACTIVE", availableFrom: "", availableUntil: "", design: DEFAULT_DESIGN, policy: EMPTY_POLICY };

const AI_POLICY = { ...EMPTY_POLICY, aiInferenceId: "inference-1", referenceModel: {
  version: 1 as const, tier: "LOOK" as const, title: "Zara Azul", description: "Duas peças azuis da Zara",
  match: "ALL" as const, minPieces: 2, pieces: [{ name: "Peças azuis", quantifier: "AT_LEAST" as const, count: 2, color: "blue", brand: "Zara" }],
} };

function Harness({ initial = EMPTY, onForm, onSave = async () => true }: { initial?: SealFormState; onForm?: (f: SealFormState) => void; onSave?: () => Promise<boolean> }) {
  const [form, setForm] = useState(initial);
  onForm?.(form);
  return <SealWizard form={form} setForm={setForm} brandName="Zara" onSave={onSave} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF25 — criador de selo em etapas", () => {
  it("abre o Copilot especializado e impede avançar sem modelo da IA", () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    renderApp(<Harness />);
    expect(screen.getByText("#createsealpolicy")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Sem IA/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Avançar" }).hasAttribute("disabled")).toBe(true);
  });

  it("oferece Perfil, Peça e Look e envia o nível Perfil ao Copilot", async () => {
    const api = mockApi({ "GET /api/taxonomy": TAXONOMY,
      "POST /api/copilot/seal-policy": { status: "INCOMPLETE", questions: ["Quais selos são necessários?"] },
    });
    renderApp(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Perfil" }));
    expect(screen.getByRole("radio", { name: "Peça" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Look" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Exibir peças e looks com os selos da Nike e Adidas" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar modelo com o Copilot/ }));
    expect(await screen.findByText("Quais selos são necessários?")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/copilot/seal-policy")?.body).toMatchObject({ tier: "PERFIL" });
  });

  it("o tipo escolhido na arte (Folha, Circular, Padrão FashionAI) é aplicado ao selo editado", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let form = EMPTY;
    renderApp(<Harness initial={{ ...EMPTY, id: "s1", name: "Zara Azul" }} onForm={(f) => { form = f; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Arte/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Folha" }));
    expect(sealKind(form.design)).toBe("FOLHA");
    expect(form.design.template).toBe(FOLHA_TEMPLATES[0].id);
    // a folha sem título mostra o nome do selo
    expect(screen.getAllByText("ZARA AZUL").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: "Modelo 4" }));
    expect(form.design.template).toBe(FOLHA_TEMPLATES[3].id);
    fireEvent.click(screen.getByRole("radio", { name: "Padrão FashionAI" }));
    expect(form.design).toMatchObject({ kind: "FASHIONAI", mode: "TEMPLATE", template: FAI_TEMPLATES[0].id });
    fireEvent.click(screen.getByRole("radio", { name: "Circular" }));
    expect(form.design).toMatchObject({ kind: "CIRCULAR", mode: "TEMPLATE", template: CIRCULAR_TEMPLATES[0].id });
    // voltar para Folha recupera o modelo escolhido antes
    fireEvent.click(screen.getByRole("radio", { name: "Folha" }));
    expect(form.design.template).toBe(FOLHA_TEMPLATES[3].id);
  });

  it("envia o pedido ao Copilot e mostra o modelo de referência gerado", async () => {
    const api = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/copilot/seal-policy": { status: "VALID", name: "Zara Azul", tier: "LOOK", policy: AI_POLICY,
        design: DEFAULT_DESIGN, reasons: ["Modelo criado conforme seu pedido."] },
    });
    let form = EMPTY;
    renderApp(<Harness onForm={(f) => { form = f; }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Duas peças azuis da Zara" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar modelo com o Copilot/ }));
    expect(await screen.findByText("Modelo criado conforme seu pedido.")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/copilot/seal-policy")?.body).toMatchObject({ message: "#createsealpolicy Duas peças azuis da Zara" });
    expect(form.name).toBe("Zara Azul");
    expect(form.policy.referenceModel).toEqual(AI_POLICY.referenceModel);
    expect(form.policy.aiInferenceId).toBe("inference-1");
  });

  it("mantém o pedido original ao responder perguntas do Copilot", async () => {
    const api = mockApi({ "GET /api/taxonomy": TAXONOMY,
      "POST /api/copilot/seal-policy": { status: "INCOMPLETE", questions: ["Qual marca?"] },
    });
    renderApp(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Duas peças azuis" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar modelo com o Copilot/ }));
    expect(await screen.findByText("Qual marca?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avançar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Zara" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar modelo com o Copilot/ }));
    await waitFor(() => expect(api.calls.filter((c) => c.path === "/api/copilot/seal-policy")).toHaveLength(2));
    expect(api.calls.filter((c) => c.path === "/api/copilot/seal-policy")[1].body).toMatchObject({ message: "#createsealpolicy Duas peças azuis\nZara" });
  });

  it("salvar só no último passo e com nome", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const onSave = vi.fn(async () => true);
    renderApp(<Harness initial={{ ...EMPTY, id: "s1", name: "Selo X", policy: AI_POLICY }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar e salvar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar selo" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });
});

describe("RF25 — folha e núcleo editáveis", () => {
  it("todos os textos da folha são editáveis e as folhas de marca não trazem nome, cidade ou ano de marca real", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    let form = EMPTY;
    const col = FOLHA_TEMPLATES.find((x) => x.id === "folha/col-01")!;
    renderApp(<Harness initial={{ ...EMPTY, id: "s1", name: "Zara Azul", design: { kind: "FOLHA", mode: "TEMPLATE", template: col.id } }} onForm={(f) => { form = f; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Arte/ }));
    for (const label of ["Título", "Série", "Subtítulo", "Rótulo", "Legenda", "Ano \\(selo redondo\\)"]) expect(screen.getByLabelText(new RegExp(label))).toBeTruthy();
    expect(JSON.stringify(col.slots)).not.toMatch(/NIKE|BEAVERTON|1964/);
    fireEvent.change(screen.getByLabelText(/Série/), { target: { value: "Série Verão · Nº 7" } });
    fireEvent.change(screen.getByLabelText(/Rótulo/), { target: { value: "São Paulo" } });
    fireEvent.change(screen.getByLabelText(/Ano/), { target: { value: "2027" } });
    expect(form.design.texts).toEqual({ series: "Série Verão · Nº 7", style: "São Paulo", year: "2027" });
    expect(screen.getAllByText("SÉRIE VERÃO · Nº 7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SÃO PAULO").length).toBeGreaterThan(0);
  });

  it("o núcleo do circular aceita imagem enviada (com texto) ou texto livre", async () => {
    const api = mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/seals/uploads": { url: "/media/users/u1/seals/core-1.png", width: 300, height: 300 } });
    vi.stubGlobal("Image", class { width = 300; height = 300; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onload?.()); } });
    URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
    let form = EMPTY;
    const { container } = renderApp(<Harness initial={{ ...EMPTY, id: "s1", name: "Selo X", design: { kind: "CIRCULAR", mode: "TEMPLATE", template: CIRCULAR_TEMPLATES[0].id } }} onForm={(f) => { form = f; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Arte/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Imagem" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(form.design.core).toMatchObject({ mode: "IMAGE", imageUrl: "/media/users/u1/seals/core-1.png" }));
    expect(api.calls.some((c) => c.method === "POST" && c.path === "/api/seals/uploads?purpose=core")).toBe(true);
    expect(container.querySelector('image[href$="core-1.png"]')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Texto sobre a imagem/), { target: { value: "Verão 26" } });
    expect(form.design.core?.text).toBe("Verão 26");
    fireEvent.click(screen.getByRole("radio", { name: "Texto" }));
    expect(form.design.core?.mode).toBe("TEXT");
    expect(screen.getAllByText("Verão 26").length).toBeGreaterThan(0);
  });
});

describe("RF25 — medalhão por tipo de selo", () => {
  it("Padrão FashionAI usa a arte pronta; circular de modelo desenha o elemento sobre o anel; folha escreve o título", () => {
    const { container } = renderApp(<>
      <SealMedallion design={{ kind: "FASHIONAI", mode: "TEMPLATE", template: FAI_TEMPLATES[1].id }} title="fai" />
      <SealMedallion design={{ kind: "CIRCULAR", mode: "TEMPLATE", template: CIRCULAR_TEMPLATES[0].id, element: { id: "MONOGRAM", text: "NB" } }} title="circ" />
      <SealMedallion design={displayDesign({ kind: "FOLHA", mode: "TEMPLATE", template: FOLHA_TEMPLATES[0].id, caption: "Verão 26" }, "Zara Azul")} size={100} title="folha" />
    </>);
    expect(container.querySelector(`img[src="${FAI_TEMPLATES[1].src}"]`)).toBeTruthy();
    expect(container.querySelector(`image[href="${CIRCULAR_TEMPLATES[0].src}"]`)).toBeTruthy();
    expect(screen.getByText("NB")).toBeTruthy();
    const folha = container.querySelector(".is-folha") as HTMLElement;
    expect(folha.style.width).toBe("80px");                                     // 4:5
    expect(screen.getByText("ZARA AZUL")).toBeTruthy();
    expect(screen.getByText("Verão 26")).toBeTruthy();
  });

  it("desenhos antigos sem tipo continuam circulares (gerados)", () => {
    expect(sealKind(DEFAULT_DESIGN)).toBe("CIRCULAR");
    expect(sealKind({ template: "folha/mat-01" })).toBe("FOLHA");
  });
});
