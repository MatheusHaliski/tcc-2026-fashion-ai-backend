// @vitest-environment jsdom
/**
 * Modo Fotografar no criador de peças: sem modal. As peças detectadas aparecem na página, "Usar esta peça" preenche os
 * dados e o card, e o caminho segue pelo botão Avançar (Mais detalhes → Arte → Revisar), como na busca catalogada. Ao
 * salvar, o recorte vai ao rascunho da análise e a peça é criada com ele; havendo outra peça na foto, volta à etapa Peça.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { loggedAs, renderApp, ME } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import { router } from "@/test-utils/setup";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans", "skirt"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"], full_body_piece: ["dress"] },
  colors: { blue: "#1f4fa0", black: "#111111" }, materials: ["COTTON", "DENIM"], sizes: ["m"], sexes: ["UNISSEX", "FEMININO"],
  occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: { lower_piece: ["casual"], upper_piece: ["casual"] }, brands: [],
};
const DETECTION = {
  draftId: "d1", originalUrl: "/media/o.jpg", width: 1000, height: 800, source: "ia",
  pieces: [
    { index: 0, name: "Saia azul", category: "lower_piece", subcategory: "skirt", color: "blue", material: "COTTON", sex: "FEMININO", style: ["basic"], occasion: ["casual"], box: { x: 10, y: 5, width: 30, height: 80 }, confidence: 0.93 },
    { index: 1, name: "Calça jeans", category: "lower_piece", subcategory: "jeans", color: "blue", material: "DENIM", sex: "UNISSEX", style: [], occasion: [], box: { x: 60, y: 5, width: 25, height: 85 }, confidence: 0.9 },
  ],
};

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback, type?: string) { cb(new Blob(["x"], { type: type ?? "image/png" })); };
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  localStorage.setItem("fai.captureTutorial", JSON.stringify({ hidden: ["*"] }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const next = () => fireEvent.click(screen.getAllByRole("button").find((b) => /^Próximo$|^Avançar$/.test(b.textContent?.trim() ?? ""))!);

describe("criador de peças — modo Fotografar sem modal", () => {
  it("usa a peça detectada, segue por Avançar e salva com o recorte; depois volta para a próxima peça", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "POST /api/pieces/analysis/multi": DETECTION,
      "POST /api/pieces/analysis/multi/d1/pieces": { draftId: "draft-saia" },
      "POST /api/pieces": { ...PIECE, id: "nova-saia", name: "Saia azul" },
      "POST /api/interactions/PIECE/nova-saia/shares": {},
    });
    const { container } = renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Fotografar/ }));
    // as etapas do criador continuam visíveis no modo Fotografar
    expect(screen.getByRole("radio", { name: /Mais detalhes/ })).toBeTruthy();
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [new File([new Uint8Array([1])], "foto.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await waitFor(() => expect(screen.getAllByTestId("detected-piece")).toHaveLength(2));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Usar esta peça" })[0]);
    await waitFor(() => expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Saia azul"));
    expect(screen.getByText(/Em edição/)).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);

    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(true), { timeout: 4000 });
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/analysis/multi/d1/pieces?index=0")).toBe(true);
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/pieces")!.body as Record<string, unknown>;
    expect(body.draftId).toBe("draft-saia");
    expect(body.useDefaultImage).toBe(false);
    expect(body.name).toBe("Saia azul");
    // a calça ainda falta: volta à etapa Peça com a saia marcada como salva
    await waitFor(() => expect(screen.getByText(/✓ Salva/)).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "Usar esta peça" })).toHaveLength(1);
  });

  it("sem escolher uma peça da foto, salvar avisa em vez de criar a peça com a ilustração", async () => {
    const { calls } = loggedAs(ME, { "GET /api/taxonomy": TAXONOMY });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Fotografar/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Revisar/ }));
    fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
    expect(await screen.findByText(/Escolha uma das peças encontradas na foto/)).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(false);
  });
});
