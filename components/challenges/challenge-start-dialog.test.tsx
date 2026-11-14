// @vitest-environment jsdom
/**
 * Regressão da auditoria: o desafio 10×10 não começava — a API exige exatamente 10 peças e a janela não tinha onde
 * escolhê-las. A janela agora traz o seletor, mostra a contagem e só liga "Começar" com 10.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, ME } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import { ChallengeStartDialog } from "./challenge-start-dialog";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const closet = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ ...PIECE, id: `p${i}`, name: `Peça ${i}` })), page: 0, size: 100, total: n, hasMore: false });
const TEN = { code: "TEN_X_TEN", name: "10×10", rule: "10 peças, 10 looks, 10 dias.", modes: ["SOLO"] };
const startButton = () => screen.getByRole("button", { name: "Começar" }) as HTMLButtonElement;

describe("janela Começar do desafio", () => {
  it("10×10: escolhe as peças, mostra a contagem e só libera Começar com exatamente 10", async () => {
    loggedAs(ME, { "GET /api/me/closet": closet(12) });
    const onStart = vi.fn();
    renderApp(<ChallengeStartDialog template={TEN} onClose={() => undefined} onStart={onStart} />);
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(12);
    expect(startButton().disabled).toBe(true);
    boxes.slice(0, 9).forEach((b) => fireEvent.click(b));
    expect(screen.getByText("9 de 10 escolhidas")).toBeTruthy();
    expect(screen.getByText("Falta 1 peça para começar.")).toBeTruthy();
    expect(startButton().disabled).toBe(true);
    fireEvent.click(boxes[9]);
    expect(screen.getByText("10 de 10 escolhidas")).toBeTruthy();
    // com 10 marcadas, as outras ficam desligadas até desmarcar uma
    expect((boxes[10] as HTMLButtonElement).disabled).toBe(true);
    expect(startButton().disabled).toBe(false);
    fireEvent.click(startButton());
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][0]).toEqual({ code: "TEN_X_TEN", mode: "SOLO", invitees: [], params: { piece_ids: Array.from({ length: 10 }, (_, i) => `p${i}`) } });
  });

  it("guarda-roupa com menos peças do que a regra pede: explica e leva ao cadastro", async () => {
    loggedAs(ME, { "GET /api/me/closet": closet(3) });
    renderApp(<ChallengeStartDialog template={TEN} onClose={() => undefined} onStart={vi.fn()} />);
    expect(await screen.findByText(/Você tem 3 peças no guarda-roupa e este desafio usa 10/)).toBeTruthy();
    expect(startButton().disabled).toBe(true);
  });

  it("desafio sem conjunto de peças começa direto, sem seletor", async () => {
    loggedAs(ME, {});
    const onStart = vi.fn();
    renderApp(<ChallengeStartDialog template={{ code: "NO_REPEAT", name: "Sem repetir", rule: "r", modes: ["SOLO", "DUELO"] }} onClose={() => undefined} onStart={onStart} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(startButton());
    await waitFor(() => expect(onStart).toHaveBeenCalledWith({ code: "NO_REPEAT", mode: "SOLO", params: {}, invitees: [] }));
  });
});
