// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { MultiPieceReview, MultiPieceUpload, type MultiDetection } from "./multi-piece-review";

// O editor tem sua própria suíte; aqui testamos o contrato controlado e a persistência por slot.
vi.mock("@/components/piece-art-editor", () => ({
  PieceArtEditor: ({ value, onChange, piece }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; piece: { name: string } }) => <section aria-label={`Arte de ${piece.name}`}>
    <label>Cor de fundo<input value={String(value.backgroundColor ?? "")} onChange={(event) => onChange({ ...value, backgroundColor: event.target.value })} /></label>
  </section>,
}));

function advanceToReview() {
  fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
  expect(screen.getByRole("radio", { name: "3 · Arte de fundo" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("button", { name: /^Salvar \d/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
  expect(screen.getByRole("radio", { name: "4 · Revisar e salvar" }).getAttribute("aria-checked")).toBe("true");
}

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans", "skirt"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { blue: "#1f4fa0", black: "#111111", white: "#ffffff", red: "#be2439", green: "#475a35" }, materials: ["COTTON", "LEATHER"], sizes: ["m"], sexes: ["UNISSEX", "FEMININO"],
  occasions: ["casual", "work"], styles: ["basic", "streetwear"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"], lower_piece: ["casual", "work"] },
};

const DETECTION: MultiDetection = {
  draftId: "d1", originalUrl: "/media/o.jpg", width: 1000, height: 800, source: "ia",
  pieces: [
    { index: 0, name: "Saia azul", category: "lower_piece", subcategory: "skirt", color: "blue", material: "COTTON", sex: "FEMININO", style: ["basic"], occasion: ["casual"], box: { x: 10, y: 5, width: 30, height: 80 }, confidence: 0.93 },
    { index: 1, name: "Calça jeans", category: "lower_piece", subcategory: "jeans", color: "blue", material: "COTTON", sex: "UNISSEX", style: [], occasion: [], box: { x: 60, y: 5, width: 25, height: 85 }, confidence: 0.9 },
  ],
};

const photo = () => new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });

const drawImage = vi.fn();

beforeEach(() => {
  drawImage.mockClear();
  // recorte no navegador: sem canvas no jsdom, o bitmap e o toBlob são simulados
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback, type?: string) { cb(new Blob(["x"], { type: type ?? "image/png" })); };
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("várias peças numa foto — revisão (RF4)", () => {
  it("fotografar tem quatro etapas, avança para cinco slots e preserva dados, marcas e arte próprios até salvar", async () => {
    const saved = vi.fn();
    const five: MultiDetection = { ...DETECTION, pieces: ["black", "white", "blue", "red", "green"].map((color, index) => ({
      ...DETECTION.pieces[0], index, name: `Camiseta ${index + 1}`, category: "upper_piece", subcategory: "t_shirt", color,
      brandName: index === 0 ? "Nike" : index === 1 ? "Adidas" : null,
      box: { x: index < 3 ? index * 32 : (index - 3) * 48, y: index < 3 ? 0 : 50, width: index < 3 ? 30 : 45, height: 48 },
    })) };
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": five,
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "cropped" }, "POST /api/pieces": { id: "new" },
    });
    const { container } = renderApp(<MultiPieceUpload onSaved={saved} />);
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["1 · Peça", "2 · Mais detalhes", "3 · Arte de fundo", "4 · Revisar e salvar"]);
    expect(screen.getByRole("radio", { name: "1 · Peça" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo()] } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar peças" }));
    await screen.findByDisplayValue("Camiseta 1");
    expect(screen.getByRole("radio", { name: "2 · Mais detalhes" }).getAttribute("aria-checked")).toBe("true");
    const slots = screen.getByRole("group", { name: "Selecionar peça para editar" });
    expect(within(slots).getAllByRole("button", { name: /^Peça \d ·/ })).toHaveLength(5);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Salvar \d/ })).toBeNull();
    expect(screen.getByRole("complementary", { name: "pré-visualização" })).toBeTruthy();
    expect(container.querySelector("details")?.open).toBe(false);
    fireEvent.change(screen.getByDisplayValue("Camiseta 1"), { target: { value: "Minha Nike" } });
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("Nike");
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Nike Sportswear" } });
    fireEvent.change(screen.getByLabelText("Esquerda"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Visibilidade"));
    fireEvent.click(screen.getByRole("option", { name: "Público" }));
    fireEvent.click(within(slots).getByRole("button", { name: /Peça 2 · Camiseta 2/ }));
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("Adidas");
    fireEvent.change(screen.getByDisplayValue("Camiseta 2"), { target: { value: "Minha Adidas" } });
    fireEvent.click(within(slots).getByRole("button", { name: /Peça 1 · Minha Nike/ }));
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("Nike Sportswear");
    expect((screen.getByLabelText("Esquerda") as HTMLInputElement).value).toBe("2");
    expect(screen.getByLabelText("Visibilidade").textContent).toBe("Público");
    fireEvent.click(screen.getByRole("radio", { name: "1 · Peça" }));
    expect(screen.queryByRole("region", { name: "Mais detalhes" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "2 · Mais detalhes" }));
    expect(screen.getByDisplayValue("Minha Nike")).toBeTruthy();
    expect(calls.filter((call) => call.path === "/api/pieces/analysis/multi")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.queryByRole("complementary", { name: "pré-visualização" })).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    fireEvent.change(screen.getByLabelText("Cor de fundo"), { target: { value: "#c51a53" } });
    fireEvent.click(screen.getByRole("button", { name: /Peça 2 · Minha Adidas/ }));
    expect((screen.getByLabelText("Cor de fundo") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Cor de fundo"), { target: { value: "#16854a" } });
    fireEvent.click(screen.getByRole("button", { name: /Peça 1 · Minha Nike/ }));
    expect((screen.getByLabelText("Cor de fundo") as HTMLInputElement).value).toBe("#c51a53");
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(within(screen.getByRole("list", { name: "Revisar e salvar" })).getAllByRole("listitem")).toHaveLength(5);
    expect(calls.some((call) => call.path === "/api/pieces")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Salvar 5 peças" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(5));
    const payloads = calls.filter((call) => call.method === "POST" && call.path === "/api/pieces").map((call) => call.body as Record<string, unknown>);
    expect(payloads.map((payload) => payload.color)).toEqual(["black", "white", "blue", "red", "green"]);
    expect(payloads[0]).toMatchObject({ name: "Minha Nike", brandName: "Nike Sportswear", visibility: "PUBLIC", background: { skin: "atelier", backgroundColor: "#c51a53" } });
    expect(payloads[1]).toMatchObject({ name: "Minha Adidas", brandName: "Adidas", visibility: "PRIVATE", background: { skin: "atelier", backgroundColor: "#16854a" } });
    expect(payloads[2]).toMatchObject({ background: { skin: "atelier" } });
    expect(calls.filter((call) => call.path.includes("/d1/pieces?")).map((call) => call.path)).toEqual([0, 1, 2, 3, 4].map((index) => `/api/pieces/analysis/multi/d1/pieces?index=${index}`));
  });

  it("permite escolher uma marca cadastrada ou texto livre por slot e persiste a escolha sem copiar para outra peça", async () => {
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/brands": (url: URL) => ({ brands: url.searchParams.get("q") === "Nik" ? [{ id: "brand-nike", name: "Nike", slug: "nike", logoUrl: "/media/nike.png" }] : [] }),
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "cropped" }, "POST /api/pieces": { id: "new" },
    });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByLabelText("Marca");
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Nik" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Nike/ }));
    fireEvent.click(screen.getByRole("button", { name: /Peça 2 · Calça jeans/ }));
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Ateliê local" } });
    fireEvent.click(screen.getByRole("button", { name: /Peça 1 · Saia azul/ }));
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("Nike");
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: "Salvar 2 peças" }));
    await waitFor(() => expect(calls.filter((call) => call.path === "/api/pieces")).toHaveLength(2));
    const payloads = calls.filter((call) => call.path === "/api/pieces").map((call) => call.body);
    expect(payloads[0]).toMatchObject({ brandId: "brand-nike", brandName: "Nike", brandLogoUrl: "/media/nike.png" });
    expect(payloads[1]).toMatchObject({ brandId: null, brandName: "Ateliê local", brandLogoUrl: null });
  });

  it("edita cinco slots em Mais detalhes sem modal e preserva nome, cor e recorte ao alternar", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const five = { ...DETECTION, pieces: Array.from({ length: 5 }, (_, index) => ({ ...DETECTION.pieces[0], index, name: `Camiseta ${index + 1}` })) };
    renderApp(<MultiPieceReview file={photo()} detection={five} onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByDisplayValue("Camiseta 1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "Mais detalhes" })).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Camiseta 1"), { target: { value: "Minha camiseta preta" } });
    fireEvent.click(screen.getByLabelText(/Cor/));
    fireEvent.click(screen.getByRole("option", { name: "Preto" }));
    fireEvent.change(screen.getByLabelText("Esquerda"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Peça 5 · Camiseta 5/ }));
    expect(screen.queryByDisplayValue("Minha camiseta preta")).toBeNull();
    fireEvent.change(screen.getByDisplayValue("Camiseta 5"), { target: { value: "Minha camiseta branca" } });
    fireEvent.click(screen.getByRole("button", { name: /Peça 1 · Minha camiseta preta/ }));
    expect(screen.getByDisplayValue("Minha camiseta preta")).toBeTruthy();
    expect(screen.getByLabelText(/Cor/).textContent).toContain("Preto");
    expect((screen.getByLabelText("Esquerda") as HTMLInputElement).value).toBe("20");
    fireEvent.click(screen.getByRole("button", { name: /Peça 5 · Minha camiseta branca/ }));
    expect(screen.getByDisplayValue("Minha camiseta branca")).toBeTruthy();
  });

  it("salva recortes independentes automaticamente, mesmo sem clicar em Recortar", async () => {
    const saved = vi.fn();
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "crop" }, "POST /api/pieces": { id: "p" } });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={saved} />);
    await screen.findByDisplayValue("Saia azul");
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(2));
    const uploads = calls.filter((c) => c.path.includes("/d1/pieces"));
    expect(uploads.map((u) => ((u.body as FormData).get("file") as File).name)).toEqual(["peca-0.jpg", "peca-1.jpg"]);
    const crops = drawImage.mock.calls;
    expect(crops.some((c) => c[1] === 94 && c[3] === 312)).toBe(true);
    expect(crops.some((c) => c[1] === 595 && c[3] === 260)).toBe(true);
  });

  it("permite adicionar uma peça não detectada e exige recorte antes de salvar várias roupas", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByDisplayValue("Saia azul");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar peça" }));
    expect(screen.getByDisplayValue("Peça 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await screen.findByText(/Ajuste o recorte desta peça/);
    expect(calls.some((c) => c.path.includes("/d1/pieces"))).toBe(false);
    fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Altura"), { target: { value: "40" } });
    expect(screen.queryByText(/Ajuste o recorte desta peça/)).toBeNull();
  });

  it("abre com cada peça detectada, marcações na foto e dados pré-preenchidos", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    expect(screen.queryByDisplayValue("Calça jeans")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Peça 2 · Calça jeans/ }));
    expect(screen.getByDisplayValue("Calça jeans")).toBeTruthy();
    expect(screen.getByText(/2 peças encontradas/)).toBeTruthy();
    expect(screen.getAllByText(/Confiança do recorte/).length).toBe(1);
  });

  it("recorta todas de uma vez e salva cada peça pelo rascunho próprio", async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "p-draft" },
      "POST /api/pieces": { id: "novo" },
    });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Recortar todas/ }));
    await waitFor(() => expect(screen.getAllByText(/Recortada da foto original/).length).toBe(1));
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
    expect(calls.filter((c) => c.path.startsWith("/api/pieces/analysis/multi/d1/pieces")).length).toBe(2);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/pieces").length).toBe(2);
  });

  it("peça desmarcada não é salva; erro de uma peça aparece nela e as outras seguem", async () => {
    const onSaved = vi.fn();
    let n = 0;
    mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi/d1/pieces": () => ({ draftId: `p${n}` }),
      "POST /api/pieces": () => (n++ === 0 ? new Response(JSON.stringify({ status: 409, code: "LIMITE", message: "Limite de peças" }), { status: 409, headers: { "content-type": "application/json" } }) : { id: "ok" }),
    });
    const three = { ...DETECTION, pieces: [...DETECTION.pieces, { ...DETECTION.pieces[0], index: 2, name: "Boné" }] };
    renderApp(<MultiPieceReview file={photo()} detection={three} onClose={vi.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Peça 3 · Boné/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Peça 3" }));
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(screen.getByText(/Limite de peças/)).toBeTruthy());
    expect(screen.getByText(/Algumas peças não foram salvas/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("valida os campos antes de enviar", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue("Saia azul"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("radio", { name: "4 · Revisar e salvar" }));
    await waitFor(() => expect(screen.getByText(/Corrija os campos destacados/)).toBeTruthy());
    expect(calls.some((c) => c.path.includes("/pieces"))).toBe(false);
  });

  it("retenta apenas a peça que falhou e mantém as peças já salvas", async () => {
    const saved = vi.fn();
    let requests = 0;
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "retry-draft" },
      "POST /api/pieces": () => ++requests === 1
        ? new Response(JSON.stringify({ status: 503, code: "TEMPORARIO", message: "Tente novamente" }), { status: 503, headers: { "content-type": "application/json" } })
        : { id: `saved-${requests}` },
    });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={saved} />);
    await screen.findByDisplayValue("Saia azul");
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: "Salvar 2 peças" }));
    await screen.findByText(/Algumas peças não foram salvas/);
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar 1 peça" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(2));
    expect(calls.filter((call) => call.method === "POST" && call.path === "/api/pieces").map((call) => (call.body as { name: string }).name)).toEqual(["Saia azul", "Calça jeans", "Saia azul"]);
    expect(calls.filter((call) => call.path === "/api/pieces/analysis/multi/d1/pieces?index=1")).toHaveLength(1);
  });

  it("cópia por IA: gera, mostra o selo, alterna com a foto e salva pela cópia", async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi/d1/ai-image": { aiImageId: "ai1", previewUrl: "/media/ai1-preview.jpg" },
      "POST /api/pieces/analysis/multi/d1/ai-images/ai1/piece": { draftId: "p-ai" },
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "p2" },
      "POST /api/pieces": { id: "novo" },
    });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /Criar cópia com IA/ })[0]);
    await waitFor(() => expect(screen.getByAltText(/gerada por IA/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Usar a minha foto/ }));
    fireEvent.click(screen.getByRole("button", { name: /Usar a cópia da IA/ }));
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
    expect(calls.some((c) => c.path === "/api/pieces/analysis/multi/d1/ai-images/ai1/piece")).toBe(true);
  });

  it("sem IA de imagem, o erro aparece na peça e ela segue com a foto", async () => {
    mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi/d1/ai-image": new Response(JSON.stringify({ status: 503, code: "IA_INDISPONIVEL", message: "A cópia por IA não está disponível agora." }), { status: 503, headers: { "content-type": "application/json" } }),
    });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /Criar cópia com IA/ })[0]);
    await waitFor(() => expect(screen.getByText(/não está disponível agora/)).toBeTruthy());
  });

  it("sem IA de visão: aviso e a foto inteira; sem nenhuma peça: opção de cadastrar a foto inteira", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const local: MultiDetection = { ...DETECTION, source: "local", pieces: [{ ...DETECTION.pieces[0], name: null, category: null, subcategory: null, box: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0 }] };
    const { unmount } = renderApp(<MultiPieceReview file={photo()} detection={local} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/A IA de visão está indisponível/)).toBeTruthy());
    unmount();
    renderApp(<MultiPieceReview file={photo()} detection={{ ...DETECTION, pieces: [] }} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Nenhuma peça foi encontrada/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar a foto inteira/ }));
    await waitFor(() => expect(screen.getByDisplayValue("Peça 1")).toBeTruthy());
  });

  it("entrada: escolhe a foto, analisa e abre a revisão; erro de análise aparece", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": DETECTION });
    const { container } = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await waitFor(() => expect(screen.getByRole("region", { name: /Mais detalhes/ })).toBeTruthy());

    cleanup();
    mockApi({ "POST /api/pieces/analysis/multi": new Response(JSON.stringify({ status: 500, code: "ERRO", message: "x" }), { status: 500, headers: { "content-type": "application/json" } }) });
    const r2 = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(r2.container.querySelector("input[type=file]")!, { target: { files: [photo()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });

  it("libera a primeira foto enquanto a segunda analisa e preserva edições ao trocar de foto", async () => {
    const second = { ...DETECTION, draftId: "d2", pieces: [{ ...DETECTION.pieces[0], name: "Outra camiseta" }] };
    const { fetchMock } = mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": DETECTION });
    const base = fetchMock.getMockImplementation()!;
    let resolveSecond!: (response: Response) => void;
    let n = 0;
    fetchMock.mockImplementation((input, init) => {
      if (String(input).endsWith("/api/pieces/analysis/multi") && ++n === 2) return new Promise<Response>((resolve) => { resolveSecond = resolve; });
      return base(input, init);
    });
    const { container } = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo(), photo()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await screen.findByRole("region", { name: /foto 1 de/ });
    await waitFor(() => expect(n).toBe(2));
    fireEvent.change(screen.getByDisplayValue("Saia azul"), { target: { value: "Nome conferido" } });
    resolveSecond(new Response(JSON.stringify(second), { headers: { "content-type": "application/json" } }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Revisar" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar" })[1]);
    expect(screen.getByRole("region", { name: /foto 2 de 2/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar" })[0]);
    expect(screen.getByDisplayValue("Nome conferido")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("valida também os slots de outras fotos antes de liberar Arte de fundo", async () => {
    let analysis = 0;
    const second: MultiDetection = { ...DETECTION, draftId: "d2", pieces: [{ ...DETECTION.pieces[0], name: "Camiseta da segunda foto" }] };
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": () => analysis++ === 0 ? DETECTION : second });
    const { container } = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo(), photo()] } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar peças" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Revisar" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar" })[1]);
    await screen.findByDisplayValue("Camiseta da segunda foto");
    fireEvent.change(screen.getByDisplayValue("Camiseta da segunda foto"), { target: { value: " " } });
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByRole("radio", { name: "2 · Mais detalhes" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("region", { name: /foto 2 de 2/ })).toBeTruthy();
    expect(screen.getByText(/Corrija os campos destacados/)).toBeTruthy();
    expect(calls.some((call) => call.path === "/api/pieces")).toBe(false);
    fireEvent.change(within(screen.getByRole("region", { name: /foto 2 de 2/ })).getByRole("textbox", { name: /Nome/ }), { target: { value: "Camiseta corrigida" } });
    advanceToReview();
  });

  it("várias fotos: analisa cada uma, revisa foto por foto e cadastra todas as peças detectadas", async () => {
    const onSaved = vi.fn();
    const second: MultiDetection = { ...DETECTION, draftId: "d2", pieces: [{ ...DETECTION.pieces[0], index: 0, name: "Tênis branco", category: "shoes_piece", subcategory: "casual_sneakers", color: "white" }] };
    let analysed = 0;
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi": () => (analysed++ === 0 ? DETECTION : second),
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "p1" },
      "POST /api/pieces/analysis/multi/d2/pieces": { draftId: "p2" },
      "POST /api/pieces": { id: "novo" },
    });
    const { container } = renderApp(<MultiPieceUpload onSaved={onSaved} />);
    expect(container.querySelector("input[type=file]")!.hasAttribute("multiple")).toBe(true);
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo(), photo()] } });
    expect(screen.getByText("Foto 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await waitFor(() => expect(screen.getByRole("region", { name: /foto 1 de 2/ })).toBeTruthy());
    expect(calls.filter((c) => c.path === "/api/pieces/analysis/multi").length).toBe(2);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(screen.getByRole("region", { name: /foto 2 de 2/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: "2 · Mais detalhes" }));
    await waitFor(() => expect(screen.getByDisplayValue("Tênis branco")).toBeTruthy());
    advanceToReview();
    fireEvent.click(screen.getByRole("button", { name: /Salvar 1 peça/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(3));
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/pieces").length).toBe(3);
  });

  it("várias fotos: respeita o limite por envio e deixa remover uma foto antes de analisar", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const { container } = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: Array.from({ length: 12 }, photo) } });
    expect(screen.getByText(/Até 10 fotos por vez/)).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /^Foto \d+$/ }).length).toBe(10);
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));
    expect(screen.getAllByRole("img", { name: /^Foto \d+$/ }).length).toBe(9);
  });

  it("antes de escolher as fotos abre o guia da categoria; com 'Não mostrar novamente' vai direto às fotos", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    localStorage.removeItem("fai.captureTutorial");
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    const { unmount } = renderApp(<MultiPieceUpload category="lower_piece" onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher fotos" }));
    expect(await screen.findByText("Fotografe preferencialmente a parte de trás")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Não mostrar novamente"));
    fireEvent.click(screen.getByRole("button", { name: "Entendi, adicionar foto" }));
    expect(click).toHaveBeenCalledTimes(1);
    unmount();
    renderApp(<MultiPieceUpload category="lower_piece" onSaved={vi.fn()} />);
    await waitFor(() => expect(localStorage.getItem("fai.captureTutorial")).toContain("hidden"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher fotos" }));
    expect(screen.queryByText("Fotografe preferencialmente a parte de trás")).toBeNull();
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
});
