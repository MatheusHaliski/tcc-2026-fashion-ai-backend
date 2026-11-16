// @vitest-environment jsdom
/**
 * ACERVO · a ficha da peça é a entrada para o Passaporte, o Editor 3D e os Tamanhos. As três abas reusam o que o app já
 * tem (passaporte digital, personalização 3D da peça e opções de tamanho); estes testes conferem o que aparece dentro
 * do ACERVO.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { rotasDoAcervo } from "@/test-utils/acervo";
import { AcervoApp } from "./acervo-app";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const f = (value: unknown, provenance: string) => ({ value, provenance, informed: value != null && value !== "" });
const medida = { region: "CHEST", protocol: "GARMENT_FLAT_WIDTH_V1", min: 52, max: 54, unit: "cm", provenance: "OFFICIAL", sourceName: "Tabela oficial", sourceUrl: null, sourceRevision: "2026", chartRevision: 2 };
const tamanho = (label: string, extra: Record<string, unknown> = {}) => ({ label, source: "CHART", availability: "AVAILABLE", ownerDeclared: false, representation: "VISUAL_APPROXIMATION", measurements: [], ...extra });
const modelo = { kind: "SHOWCASE_GLB", approvedForTryOn: false, quarantine: "IN_REVIEW", origin: "GENERATED_FROM_PHOTO", reviewStatus: "IN_REVIEW", provenance: "ESTIMATED", sizeVariants: "RELATIVE_VISUAL_APPROXIMATION" };
const passaporte = {
  identifier: "FAI-PIECE-p1", pieceId: "p1", catalogProductId: "prod1", access: "OWNER",
  identification: { name: f("Jaqueta de couro", "OWNER_DECLARED"), brand: f("Marca X", "SOURCE_DECLARED"), category: f("upper_piece", "OWNER_DECLARED"), subcategory: f("jacket", "OWNER_DECLARED"),
    description: f(null, "NOT_INFORMED"), productCode: f("JAQ-1", "SOURCE_DECLARED"), gtin: f(null, "NOT_INFORMED"), catalogVerifiedAt: f("2026-10-01T00:00:00Z", "VERIFIED") },
  images: { reference: f(null, "NOT_INFORMED"), sourceUrl: f("https://marca.example/jaqueta", "SOURCE_DECLARED"), sourceDomain: f("marca.example", "SOURCE_DECLARED") },
  materials: { composition: f("Couro", "SOURCE_DECLARED"), catalogMaterial: f("Couro", "SOURCE_DECLARED"), care: f(null, "NOT_INFORMED"), washing: f(null, "NOT_INFORMED"), condition: f("GOOD", "OWNER_DECLARED"),
    origin: f(null, "NOT_INFORMED"), manufacturing: f(null, "NOT_INFORMED") },
  sizes: { grid: "letter", availabilityKnown: true, measurementsKnown: true, visualApproximationNote: "SIZES_ON_3D_ARE_RELATIVE_VISUAL_APPROXIMATIONS", avatarMeasurementsChanged: false, fitClaim: "NONE", representation3d: modelo,
    sizes: [tamanho("P"), tamanho("M", { ownerDeclared: true, measurements: [medida] }), tamanho("G", { availability: "UNAVAILABLE" }), tamanho("GG", { representation: "NONE", availability: "UNKNOWN" })] },
  model3d: { ...modelo, viewerUrl: f("/media/jaqueta.glb", "ESTIMATED"), status: "COMPLETED", displayAllowed: true, tryOnApproved: false, generatedAt: null },
  provenanceLegend: [], notices: ["ESTIMATED_IS_NOT_CERTIFICATION"], lastUpdated: "2026-11-04T10:00:00Z",
};
const personalizacao = { pieceId: "p1", baseModelUrl: "/media/jaqueta.glb", modelAvailable: true, editable: true, viewOnly: false, assetApproval: "IN_REVIEW", quarantine: true, tryOnApproved: false,
  supports: { camera: true, materials: true, transforms: true, undoRedo: true, vertices: true }, document: { nodes: {}, materials: {}, vertices: {} }, revision: 2, savedAt: null, baseChanged: false,
  scaleIsVisualOnly: true, affectsOfficialMeasurements: false, affectsPassport: false, fitClaim: "NONE" };

async function abrirFicha(rotas: Record<string, unknown> = {}) {
  const api = loggedAs(undefined, rotasDoAcervo({ "GET /api/me/acervo/pecas/p1/looks": [], "GET /api/pieces/p1/digital-passport": passaporte, "GET /api/pieces/p1/customization": personalizacao, ...rotas }));
  renderApp(<AcervoApp />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir a ficha de Jaqueta de couro" }));
  return { ...api, ficha: await screen.findByTestId("acervo-ficha") };
}

describe("ACERVO · ficha da peça: Passaporte, Editor 3D e Tamanhos", () => {
  it("a ficha tem as quatro abas e começa nos dados da peça, com a localização", async () => {
    const { ficha } = await abrirFicha();
    expect(within(ficha).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Ficha", "Passaporte", "Editor 3D", "Tamanhos"]);
    expect(ficha.textContent).toContain("Closet principal / Armário 01 / Cabideiro");
    expect(ficha.textContent).toContain("Marca X");
  });

  it("Passaporte: identificador estável, procedência por campo, “Não informado”, endereço da fonte e modelo em quarentena", async () => {
    const { ficha, calls } = await abrirFicha();
    fireEvent.click(within(ficha).getByRole("tab", { name: "Passaporte" }));
    expect(await within(ficha).findByText("FAI-PIECE-p1")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/pieces/p1/digital-passport")).toBe(true);
    expect(within(ficha).getAllByText("Não informado").length).toBeGreaterThanOrEqual(5);
    expect(within(ficha).getAllByText("declarado pela fonte").length).toBeGreaterThan(0);
    expect(within(ficha).getAllByText("verificado").length).toBeGreaterThan(0);
    expect(within(ficha).getAllByText("estimado").length).toBeGreaterThan(0);
    expect(within(ficha).getByRole("link", { name: "marca.example" }).getAttribute("href")).toBe("https://marca.example/jaqueta");
    expect(within(ficha).getByText(/em quarentena \(IN_REVIEW\)/)).toBeTruthy();
    expect(within(ficha).getByText(/só assets revisados vestem o avatar no provador/)).toBeTruthy();
    expect(within(ficha).getByText(/não são certificações nem informações oficiais da marca/)).toBeTruthy();
    fireEvent.click(within(ficha).getByRole("button", { name: "Ver modelo 3D" }));
    expect(within(ficha).getByRole("button", { name: "Ocultar modelo 3D" })).toBeTruthy();
    expect(within(ficha).getByRole("link", { name: "Declarar composição e cuidados" }).getAttribute("href")).toBe("/pieces/p1/passport");
    expect(within(ficha).getByRole("link", { name: "Abrir o passaporte em página inteira" }).getAttribute("href")).toBe("/pieces/p1/sheet");
  });

  it("Editor 3D: modelo em quarentena não aparece como aprovado, escala é ajuste visual e o editor da peça abre daqui", async () => {
    const { ficha } = await abrirFicha();
    fireEvent.click(within(ficha).getByRole("tab", { name: "Editor 3D" }));
    const aba = await within(ficha).findByTestId("acervo-editor3d");
    expect(within(aba).getByText("Modelo em quarentena: não aprovado para o provador")).toBeTruthy();
    expect(within(aba).queryByText("Asset aprovado para o provador")).toBeNull();
    expect(within(aba).getByText("Ajuste visual")).toBeTruthy();
    expect(aba.textContent).toContain("não alteram medidas oficiais, tamanhos comerciais nem o passaporte, e não comprovam caimento físico");
    expect(aba.textContent).toContain("O modelo original fica como está; a personalização é só sua.");
    expect(aba.textContent).toContain("Você ainda não personalizou esta peça.");
    expect(within(aba).getByRole("link", { name: "Abrir editor 3D da peça" }).getAttribute("href")).toBe("/pieces/p1/editor-3d");
  });

  it("Editor 3D: sem modelo compatível a aba diz isso e não oferece o editor; sem permissão, só visualização", async () => {
    const semModelo = await abrirFicha({ "GET /api/pieces/p1/customization": { ...personalizacao, modelAvailable: false, baseModelUrl: null } });
    fireEvent.click(within(semModelo.ficha).getByRole("tab", { name: "Editor 3D" }));
    expect(await within(semModelo.ficha).findByText("Esta peça ainda não tem modelo 3D compatível com o editor.")).toBeTruthy();
    expect(within(semModelo.ficha).queryByRole("link", { name: "Abrir editor 3D da peça" })).toBeNull();
    cleanup();
    const soLeitura = await abrirFicha({ "GET /api/pieces/p1/customization": { ...personalizacao, editable: false, viewOnly: true } });
    fireEvent.click(within(soLeitura.ficha).getByRole("tab", { name: "Editor 3D" }));
    expect(await within(soLeitura.ficha).findByText("Somente visualização")).toBeTruthy();
    expect(within(soLeitura.ficha).getByRole("link", { name: "Ver o modelo 3D" })).toBeTruthy();
  });

  it("Tamanhos: mostra os tamanhos, bloqueia o indisponível, diz quando falta 3D e marca a variação como aproximação", async () => {
    const { ficha } = await abrirFicha();
    fireEvent.click(within(ficha).getByRole("tab", { name: "Tamanhos" }));
    const aba = await within(ficha).findByTestId("acervo-tamanhos");
    const opcoes = within(aba).getAllByRole("radio");
    expect(opcoes.map((o) => o.getAttribute("title"))).toEqual(["P", "M · tamanho da sua peça", "G · indisponível no cadastro da loja", "GG"]);
    await waitFor(() => expect(within(aba).getByRole("radio", { name: "M · tamanho da sua peça" }).getAttribute("aria-checked")).toBe("true"));
    expect(within(aba).getByRole("status").textContent).toBe("Tamanho M no 3D é uma aproximação visual relativa, não medida oficial nem caimento validado.");
    expect(within(aba).getByText("Aproximação visual")).toBeTruthy();
    expect(aba.textContent).toContain("não são medidas oficiais, ajuste por molde nem caimento validado");
    expect(aba.textContent).toContain("CHEST · 52–54 cm · GARMENT_FLAT_WIDTH_V1 · medida oficial autorizada (Tabela oficial)");

    const g = within(aba).getByRole("radio", { name: "G · indisponível no cadastro da loja" }) as HTMLButtonElement;
    expect(g.disabled).toBe(true);
    fireEvent.click(g);
    expect(g.getAttribute("aria-checked")).toBe("false");
    expect(within(aba).getByRole("radio", { name: "M · tamanho da sua peça" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(within(aba).getByRole("radio", { name: "GG" }));
    expect(within(aba).getByRole("status").textContent).toBe("O tamanho GG não tem representação 3D; nenhum outro tamanho é mostrado como equivalente.");
    expect(aba.textContent).toContain("Escolher o tamanho não altera as medidas do seu avatar.");
    expect(aba.textContent).toContain("Ver o tamanho no avatar não garante que a peça vai servir.");
    expect(aba.textContent).toContain("só assets revisados vestem o avatar no provador");
  });

  it("Tamanhos sem 3D: o tamanho da peça fora da grade vem primeiro, em maiúscula, e cada toque diz o tamanho escolhido", async () => {
    const numerica = ["34", "36", "38", "40"].map((n) => tamanho(n, { source: "GRID", availability: "UNKNOWN", representation: "NONE" }));
    const sizes = { ...passaporte.sizes, grid: "numeric", availabilityKnown: false, measurementsKnown: false, representation3d: { ...modelo, kind: "NONE" },
      sizes: [...numerica, tamanho("M", { source: "OWNER", ownerDeclared: true, availability: "UNKNOWN", representation: "NONE" })] };
    const { ficha } = await abrirFicha({ "GET /api/pieces/p1/digital-passport": { ...passaporte, sizes } });
    fireEvent.click(within(ficha).getByRole("tab", { name: "Tamanhos" }));
    const aba = await within(ficha).findByTestId("acervo-tamanhos");
    expect(within(aba).getAllByRole("radio").map((o) => o.querySelector("[aria-hidden]")?.textContent)).toEqual(["M", "34", "36", "38", "40"]);
    expect(aba.textContent).toContain("Tamanho desta peça: M.");
    await waitFor(() => expect(within(aba).getByRole("status").textContent).toBe("Tamanho M escolhido. Esta peça não tem representação 3D por tamanho."));
    fireEvent.click(within(aba).getByRole("radio", { name: "40" }));
    expect(within(aba).getByRole("status").textContent).toBe("Tamanho 40 escolhido. Esta peça não tem representação 3D por tamanho.");
  });

  it("Tamanhos: medida oficial e medida por outro método aparecem com origens diferentes (RF tamanhos #6)", async () => {
    const outro = { ...medida, min: 50, max: 51, provenance: "OTHER_METHOD", sourceName: "Medida da vendedora", chartRevision: 1 };
    const sizes = { ...passaporte.sizes, sizes: [tamanho("P", { measurements: [outro] }), tamanho("M", { ownerDeclared: true, measurements: [medida] })] };
    const { ficha } = await abrirFicha({ "GET /api/pieces/p1/digital-passport": { ...passaporte, sizes } });
    fireEvent.click(within(ficha).getByRole("tab", { name: "Tamanhos" }));
    const aba = await within(ficha).findByTestId("acervo-tamanhos");
    await waitFor(() => expect(aba.textContent).toContain("medida oficial autorizada (Tabela oficial)"));
    fireEvent.click(within(aba).getByRole("radio", { name: "P" }));
    expect(aba.textContent).toContain("CHEST · 50–51 cm · GARMENT_FLAT_WIDTH_V1 · medida obtida por outro método (Medida da vendedora)");
    expect(aba.textContent).not.toContain("medida oficial autorizada");
  });

  it("Tamanhos: peça sem tamanhos nem medidas aparece como não informado", async () => {
    const { ficha } = await abrirFicha({ "GET /api/pieces/p1/digital-passport": { ...passaporte, sizes: { ...passaporte.sizes, sizes: [] } } });
    fireEvent.click(within(ficha).getByRole("tab", { name: "Tamanhos" }));
    expect(await within(ficha).findByText("Não informado: esta peça não tem tamanhos cadastrados.")).toBeTruthy();
  });
});
