// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PiecePhotoEditor } from "./piece-photo-editor";

const SESSION = { originalUrl: "/media/users/u/pieces/p/original.png", width: 1000, height: 1250, category: "upper_piece", currentRecipe: null };
const PREVIEW = { png: "iVBORw0KGgo=", quality: { sharpness: 0.8, exposure: 0.9, occupancy: 0.84, colorDeltaE: 1.2 }, warnings: [] };
const AUTO = { recipe: { version: 1, target: "CANONICAL", ops: [{ op: "crop", rect: { x: 0.1, y: 0, w: 0.8, h: 0.8 }, aspect: "4:5" }, { op: "background", kind: "WHITE", shadow: "NONE", strokes: [] }] } };

afterEach(() => cleanup());

describe("editor de fotografia da peça (RF15)", () => {
  it("carrega a sessão, pede a prévia ao servidor e o Automático leva à revisão com a receita sugerida", async () => {
    const { calls } = mockApi({
      "GET /api/pieces/p1/photo-edits/session": SESSION, "GET /api/pieces/p1/photo-edits": [],
      "POST /api/pieces/p1/photo-edits/preview": PREVIEW, "POST /api/pieces/p1/photo-edits/auto": AUTO,
      "POST /api/pieces/p1/photo-edits": { id: "v1", target: "CANONICAL", current: true },
    });
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    expect(await screen.findByRole("heading", { name: "Editar foto da peça" })).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.path === "/api/pieces/p1/photo-edits/preview")).toBe(true), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: "Automático" }));
    expect(await screen.findByRole("button", { name: "Salvar como foto da peça" })).toBeTruthy();
    expect(screen.getByText("Ocupação do quadro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar como foto da peça" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")!.body as { target: string; ops: { op: string }[] };
    expect(body.target).toBe("CANONICAL");
    expect(body.ops.map((o) => o.op)).toEqual(["crop", "background"]);
  });

  it("sem quadro 4:5 a foto da peça não salva; a versão de apresentação libera filtros", async () => {
    mockApi({ "GET /api/pieces/p1/photo-edits/session": SESSION, "GET /api/pieces/p1/photo-edits": [], "POST /api/pieces/p1/photo-edits/preview": PREVIEW });
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByRole("heading", { name: "Editar foto da peça" });
    fireEvent.click(screen.getByRole("radio", { name: /Detalhes/ }));
    fireEvent.change(screen.getByLabelText(/Nitidez/), { target: { value: "0.2" } });
    fireEvent.click(screen.getByRole("radio", { name: /Revisar/ }));
    expect(screen.getByText(/precisa do quadro 4:5/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar como foto da peça" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Versão de apresentação" }));
    expect(screen.getByRole("radio", { name: "P&B" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar versão de apresentação" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("peça sem foto própria mostra o aviso e o caminho de volta", async () => {
    mockApi({ "GET /api/pieces/p1/photo-edits/session": new Response(JSON.stringify({ status: 409, code: "SEM_FOTO_PROPRIA", message: "Esta peça não tem foto sua para editar. Envie uma foto primeiro." }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    expect(await screen.findByText("Esta peça não tem foto sua para editar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar à peça" })).toBeTruthy();
  });
});
