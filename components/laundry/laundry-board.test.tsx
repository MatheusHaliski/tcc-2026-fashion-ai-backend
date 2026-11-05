// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { LaundryBoard } from "./laundry-board";

const piece = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, category: "upper_piece", thumbnailUrl: null, material: "Algodão", washCode: "MAQUINA_FRIA", washName: "Máquina fria", careInstructions: null, disponivel: true, archived: false, wearState: "WORN", batchId: null, changedAt: "2026-11-05T12:00:00Z", ...extra });
const board = {
  clean: 4, worn: [piece("p1", "Camisa"), piece("p2", "Peça misteriosa", { material: null, washCode: null, washName: null })], inWash: [],
  batches: [{ id: "b1", status: "WASHING", instructionCode: "MAQUINA_FRIA", instructions: null, startedAt: "2026-11-04T12:00:00Z", finishedAt: null, version: 2, pieces: [piece("p3", "Jeans", { wearState: "IN_WASH", disponivel: false })] }],
  suggestions: [{ key: "WASH:MAQUINA_FRIA", source: "DECLARED_INSTRUCTION", pieceIds: ["p1"] }], missingData: ["p2"],
  conflicts: [{ day: "2026-11-06", eventLabel: "Reunião", pieceId: "p3", pieceName: "Jeans" }],
};
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RF-PESQ-03 laundry board", () => {
  it("warns about planned looks, flags missing data and requires confirmation before sending a batch", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/laundry": board, "POST /api/me/laundry/batches": { id: "b2", status: "WASHING", version: 0, pieces: [] } });
    renderApp(<LaundryBoard />);
    await screen.findByText(/Jeans está em lavagem e faz parte de "Reunião"/);
    expect(screen.getByText("Sem instrução nem composição")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Instrução MAQUINA_FRIA (1)" }));
    const send = await screen.findByRole("button", { name: "Enviar para lavagem" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: /Confirmo o lote/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Enviar para lavagem" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para lavagem" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.path === "/api/me/laundry/batches")).toBe(true));
    expect(calls.find((call) => call.path === "/api/me/laundry/batches")!.body).toMatchObject({ pieceIds: ["p1"], instructionCode: "MAQUINA_FRIA", confirmed: true });
  });

  it("finishes a batch with the explicit availability confirmation", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/laundry": board, "POST /api/me/laundry/batches/b1/finish": { ...board.batches[0], status: "DONE" } });
    renderApp(<LaundryBoard />);
    fireEvent.click(await screen.findByRole("switch", { name: "Devolver as peças aos looks ao concluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Lavagem concluída" }));
    await waitFor(() => expect(calls.some((call) => call.path === "/api/me/laundry/batches/b1/finish")).toBe(true));
    expect(calls.find((call) => call.path === "/api/me/laundry/batches/b1/finish")!.body).toEqual({ expectedVersion: 2, restoreAvailability: false });
  });
});
