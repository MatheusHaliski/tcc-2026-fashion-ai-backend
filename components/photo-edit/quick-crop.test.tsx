// @vitest-environment jsdom
/**
 * Editar imagem › Enquadramento (quadro 4:5 em escalas fixas) e Recorte (janela retangular livre): os dois salvam a
 * versão canônica pelo editor RF15 — o Enquadramento com aspect "4:5", o Recorte com aspect "FREE".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { QuickCrop, nearestZoom, windowFrom, zoomCrop } from "./quick-crop";

const SESSION = { originalUrl: "/media/users/u/pieces/p/original.png", width: 1000, height: 1000, currentRecipe: null };
const PIECE = { id: "p1", name: "Camisa" };

afterEach(() => cleanup());

/** jsdom não carrega imagens: simula o onLoad com o tamanho natural e uma caixa de 100×100 px na tela. */
function loadImage(container: HTMLElement) {
  const img = container.querySelector(".qc-stage img") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: 1000 });
  Object.defineProperty(img, "naturalHeight", { value: 1000 });
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.load(img);
}

describe("geometria do quadro", () => {
  it("escalas fixas: 1× é o maior 4:5 que cabe, 2× tem metade da largura, mesmo centro", () => {
    const one = zoomCrop(1, 1000, 1000), two = zoomCrop(2, 1000, 1000);
    expect(one.h).toBeCloseTo(1, 3);
    expect(one.w).toBeCloseTo(0.8, 3);
    expect(two.w).toBeCloseTo(0.4, 3);
    expect(two.x + two.w / 2).toBeCloseTo(0.5, 3);
    expect(nearestZoom(two, 1000, 1000)).toBe(2);
    expect(nearestZoom(zoomCrop(1.5, 1000, 1000), 1000, 1000)).toBe(1.5);
  });
  it("janela livre normaliza os cantos e não sai da foto", () => {
    expect(windowFrom([0.8, 0.9], [0.2, 0.1])).toEqual({ x: 0.2, y: 0.1, w: 0.6, h: 0.8 });
    expect(windowFrom([-0.2, 0.5], [0.5, 1.4])).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 });
  });
});

describe("QuickCrop", () => {
  it("Enquadramento: escolhe 2× e salva a canônica com o quadro 4:5", async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({ "GET /api/pieces/p1/photo-edits/session": SESSION, "POST /api/pieces/p1/photo-edits": { id: "v1", current: true, piece: PIECE } });
    const { container } = renderApp(<QuickCrop pieceId="p1" mode="framing" onSaved={onSaved} />);
    await waitFor(() => expect(container.querySelector(".qc-stage img")).toBeTruthy());
    loadImage(container);
    expect(screen.queryByRole("img", { name: /antes|depois|before|after/i })).toBeNull();
    fireEvent.click(await screen.findByRole("radio", { name: "2×" }));
    expect(screen.getByRole("radio", { name: "2×" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Salvar enquadramento" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(PIECE));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")!.body as { target: string; ops: { op: string; aspect?: string; rect?: { w: number } }[] };
    expect(body.target).toBe("CANONICAL");
    expect(body.ops[0]).toMatchObject({ op: "crop", aspect: "4:5" });
    expect(body.ops[0].rect!.w).toBeCloseTo(0.4, 3);
  });

  it("Recorte: arrasta para marcar a janela e salva exatamente ela (aspect FREE)", async () => {
    const { calls } = mockApi({ "GET /api/pieces/p1/photo-edits/session": SESSION, "POST /api/pieces/p1/photo-edits": { id: "v1", current: true, piece: PIECE } });
    const { container } = renderApp(<QuickCrop pieceId="p1" mode="window" onSaved={() => undefined} />);
    await waitFor(() => expect(container.querySelector(".qc-stage img")).toBeTruthy());
    loadImage(container);
    await screen.findByRole("button", { name: "Foto inteira" });
    // a janela inicial é a foto toda; reduz pelo canto inferior direito e depois move
    const se = await screen.findByTestId("qc-se");
    fireEvent.pointerDown(se, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(se, { clientX: 60, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(se, { pointerId: 1 });
    expect(screen.getByText("Janela: 600 × 300 px")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar recorte" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")!.body as { ops: unknown[] };
    expect(body.ops[0]).toEqual({ op: "crop", rect: { x: 0, y: 0, w: 0.6, h: 0.3 }, aspect: "FREE" });
  });

  it("Recorte: com a janela na foto inteira, arrastar desenha a janela nova", async () => {
    const { calls } = mockApi({ "GET /api/pieces/p1/photo-edits/session": SESSION, "POST /api/pieces/p1/photo-edits": { id: "v1", current: true, piece: PIECE } });
    const { container } = renderApp(<QuickCrop pieceId="p1" mode="window" onSaved={() => undefined} />);
    await waitFor(() => expect(container.querySelector(".qc-stage img")).toBeTruthy());
    loadImage(container);
    await screen.findByTestId("qc-rect");
    const stage = container.querySelector(".qc-stage") as HTMLElement;
    fireEvent.pointerDown(stage, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 70, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(screen.getByText("Janela: 500 × 800 px")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar recorte" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")).toBe(true));
    expect((calls.find((c) => c.method === "POST")!.body as { ops: unknown[] }).ops[0]).toEqual({ op: "crop", rect: { x: 0.2, y: 0.1, w: 0.5, h: 0.8 }, aspect: "FREE" });
  });

  it("peça do catálogo: explica que não há foto própria e oferece trocar a imagem", async () => {
    const onReplace = vi.fn();
    mockApi({ "GET /api/pieces/p1/photo-edits/session": new Response(JSON.stringify({ status: 409, code: "SEM_FOTO_PROPRIA", message: "x" }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<QuickCrop pieceId="p1" mode="window" onSaved={() => undefined} onReplace={onReplace} />);
    expect(await screen.findByText(/imagem do catálogo da marca/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trocar foto" }));
    expect(onReplace).toHaveBeenCalled();
  });
});
