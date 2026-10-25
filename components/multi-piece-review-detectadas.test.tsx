// @vitest-environment jsdom
/**
 * Foto opcional do RF4 no criador em etapas (onPick): a lista de peças encontradas em cada foto, "Usar esta peça",
 * marcas de salva/em edição, foto sem peças (foto inteira) e as mensagens de erro da análise por tipo de falha.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { MultiPieceUpload, type MultiDetection, type PhotoPick } from "./multi-piece-review";

vi.mock("@/components/piece-art-editor", () => ({ PieceArtEditor: () => null }));

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans", "skirt"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { blue: "#1f4fa0", black: "#111111" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { lower_piece: ["work"] },
};
const DETECTION: MultiDetection = {
  draftId: "d1", originalUrl: "/media/o.jpg", width: 1000, height: 800, source: "ia",
  pieces: [
    { index: 0, name: "Saia azul", category: "lower_piece", subcategory: "skirt", color: "blue", box: { x: 10, y: 5, width: 30, height: 80 }, confidence: 0.93, brandHint: { brand: "Zara" } },
    { index: 1, name: null, category: "lower_piece", subcategory: "jeans", box: { x: 60, y: 5, width: 25, height: 85 }, confidence: 0.9 },
    { index: 2, name: null, category: null, box: { x: 0, y: 0, width: 10, height: 10 }, confidence: 0.4 },
  ],
};
const EMPTY: MultiDetection = { ...DETECTION, draftId: "d2", pieces: [], source: "local" };
const jpg = () => new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });
const png = () => new File([new Uint8Array([1])], "foto.png", { type: "image/png" });
const fail = (status: number, message = "Foto recusada") => () => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback, type?: string) { cb(new Blob(["x"], { type: type ?? "image/png" })); };
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:u${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const input = (c: HTMLElement) => c.querySelector("input[type=file]") as HTMLInputElement;

describe("MultiPieceUpload no criador em etapas (onPick)", () => {
  it("lista as peças de cada foto com miniatura, nome lido ou 'Peça N' e categoria; avisa as chaves disponíveis", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": DETECTION });
    const onPick = vi.fn(); const onAvailable = vi.fn();
    const { container } = renderApp(<MultiPieceUpload onPick={onPick} onAvailable={onAvailable} />);
    fireEvent.change(input(container), { target: { files: [jpg()] } });
    expect(screen.getByText("Aguardando análise")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    expect(await screen.findByText("Peças encontradas nas fotos")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();   // sem as etapas próprias: quem embute conduz
    const rows = screen.getAllByTestId("detected-piece");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("Saia azul");
    expect(rows[1].textContent).toContain("Peça 2");
    expect(rows[2].textContent).toContain("Peça 3");
    expect(rows[2].textContent).not.toContain("·");
    await waitFor(() => expect(rows[0].querySelector("img")).toBeTruthy());
    const ids = onAvailable.mock.calls.at(-1)![0] as string[];
    expect(ids).toHaveLength(3);
    expect(ids[0]).toMatch(/#0$/);
    expect(screen.getByText("3 peças encontradas")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revisar" })).toBeNull();
  });

  it("'Usar esta peça' recorta e entrega o arquivo, o rascunho, os dados e a dica de marca", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": DETECTION });
    const onPick = vi.fn();
    const { container } = renderApp(<MultiPieceUpload onPick={onPick} />);
    fireEvent.change(input(container), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await screen.findByText("Peças encontradas nas fotos");
    fireEvent.click(screen.getAllByRole("button", { name: "Usar esta peça" })[0]);
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const pick = onPick.mock.calls[0][0] as PhotoPick;
    expect(pick).toMatchObject({ draftId: "d1", index: 0, photo: 1, piece: 1, hint: { brand: "Zara" } });
    expect(pick.file.name).toBe("peca-1-1.png");
    expect(pick.value).toMatchObject({ name: "Saia azul", category: "lower_piece", subcategory: "skirt", color: "blue", occasion: ["work"] });
    fireEvent.click(screen.getAllByRole("button", { name: "Usar esta peça" })[2]);
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(2));
    const second = onPick.mock.calls[1][0] as PhotoPick;
    expect(second.value).toMatchObject({ name: "Peça 3", category: "upper_piece", subcategory: "t_shirt" });
    expect(second.hint).toBeNull();
  });

  it("peça salva e peça em edição não oferecem o botão de novo", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": DETECTION });
    const onAvailable = vi.fn();
    const { container, rerender } = renderApp(<MultiPieceUpload onPick={() => {}} onAvailable={onAvailable} />);
    fireEvent.change(input(container), { target: { files: [jpg()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await screen.findByText("Peças encontradas nas fotos");
    const [k0, k1] = onAvailable.mock.calls.at(-1)![0] as string[];
    rerender(<MultiPieceUpload onPick={() => {}} onAvailable={onAvailable} picked={k1} savedKeys={[k0]} />);
    const rows = screen.getAllByTestId("detected-piece");
    expect(rows[0].textContent).toContain("Salva no guarda-roupa");
    expect(rows[1].textContent).toContain("Em edição");
    expect(rows[1].className).toContain("border-ink");
    expect(screen.getAllByRole("button", { name: "Usar esta peça" })).toHaveLength(1);
  });

  it("foto sem peça separada vira uma entrada com a foto inteira (sem recorte)", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": EMPTY });
    const onPick = vi.fn();
    const file = jpg();
    const { container } = renderApp(<MultiPieceUpload onPick={onPick} />);
    fireEvent.change(input(container), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    await screen.findByText("Peças encontradas nas fotos");
    expect(screen.getByText("Nenhuma peça encontrada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar esta peça" }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect((onPick.mock.calls[0][0] as PhotoPick).file).toBe(file);
    expect((onPick.mock.calls[0][0] as PhotoPick).index).toBe(-1);
  });

  it("só imagens entram; escolher nada não muda a lista", () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const { container } = renderApp(<MultiPieceUpload onPick={() => {}} />);
    fireEvent.change(input(container), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(screen.queryByRole("img", { name: "Foto 1" })).toBeNull();
    fireEvent.change(input(container), { target: { files: [new File(["x"], "sem-tipo", { type: "" })] } });
    expect(screen.getByRole("img", { name: "Foto 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar mais fotos" })).toBeTruthy();
  });
});

describe("MultiPieceUpload › mensagens de erro da análise", () => {
  async function analyseWith(route: unknown) {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "POST /api/pieces/analysis/multi": route });
    const { container } = renderApp(<MultiPieceUpload onPick={() => {}} />);
    fireEvent.change(input(container), { target: { files: [jpg()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    return screen.findByRole("alert");
  }

  it("413 (foto grande) avisa que a foto não chegou", async () => {
    expect((await analyseWith(fail(413))).textContent).toBe("A foto não chegou ao servidor (conexão ou tamanho). Tente de novo ou use uma foto menor.");
  });

  it("erro de validação mostra a mensagem do servidor e a foto pode ser removida", async () => {
    expect((await analyseWith(fail(422, "Foto recusada pela moderação"))).textContent).toBe("Foto recusada pela moderação");
    await waitFor(() => expect((screen.getByRole("button", { name: "Remover foto 1" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));
    expect(screen.queryByRole("img", { name: "Foto 1" })).toBeNull();
  });

  it("falha de rede (sem resposta) e recorte leve indisponível: usa o arquivo original e avisa a conexão", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("sem bitmap"); }));
    const { fetchMock } = mockApi({ "GET /api/taxonomy": TAXONOMY });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((i, init) => String(i).endsWith("/api/pieces/analysis/multi") ? Promise.reject(new TypeError("Failed to fetch")) : base(i, init));
    const { container } = renderApp(<MultiPieceUpload onPick={() => {}} />);
    fireEvent.change(input(container), { target: { files: [jpg()] } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar peças/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent!.length).toBeGreaterThan(0);
    expect(screen.getByText("Fotografias analisadas: 1 de 1.")).toBeTruthy();
  });
});
