// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { MultiPieceReview, MultiPieceUpload, type MultiDetection } from "./multi-piece-review";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans", "skirt"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { blue: "#1f4fa0", black: "#111111", white: "#ffffff" }, materials: ["COTTON", "LEATHER"], sizes: ["m"], sexes: ["UNISSEX", "FEMININO"],
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

beforeEach(() => {
  // recorte no navegador: sem canvas no jsdom, o bitmap e o toBlob são simulados
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback, type?: string) { cb(new Blob(["x"], { type: type ?? "image/png" })); };
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("várias peças numa foto — revisão (RF4)", () => {
  it("abre com cada peça detectada, marcações na foto e dados pré-preenchidos", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    renderApp(<MultiPieceReview file={photo()} detection={DETECTION} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Saia azul")).toBeTruthy());
    expect(screen.getByDisplayValue("Calça jeans")).toBeTruthy();
    expect(screen.getByText(/2 peças encontradas/)).toBeTruthy();
    expect(screen.getAllByText(/Confiança da IA/).length).toBe(2);
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
    await waitFor(() => expect(screen.getAllByText(/Recortada da foto original/).length).toBe(2));
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
    await waitFor(() => expect(screen.getByDisplayValue("Boné")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
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
    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 peças/ }));
    await waitFor(() => expect(screen.getByText(/Corrija os campos destacados/)).toBeTruthy());
    expect(calls.some((c) => c.path.includes("/pieces"))).toBe(false);
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
    await waitFor(() => expect(screen.getByText(/A IA de visão não respondeu/)).toBeTruthy());
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
    await waitFor(() => expect(screen.getByRole("dialog", { name: /Revisar peças encontradas/ })).toBeTruthy());

    cleanup();
    mockApi({ "POST /api/pieces/analysis/multi": new Response(JSON.stringify({ status: 500, code: "ERRO", message: "x" }), { status: 500, headers: { "content-type": "application/json" } }) });
    const r2 = renderApp(<MultiPieceUpload onSaved={vi.fn()} />);
    fireEvent.change(r2.container.querySelector("input[type=file]")!, { target: { files: [photo()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
