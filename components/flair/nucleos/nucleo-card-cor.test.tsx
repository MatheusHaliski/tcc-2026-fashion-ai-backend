// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/** Efeito da cor da peça ao entrar em cena: o nome do efeito do jogo e o pulso na cor da família. */
beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("efeito da cor ao inserir a carta", () => {
  const fileira = () => Array.from(screen.getByTestId("nucleo-resource-window").querySelectorAll<HTMLButtonElement>(".n3d-row .n3d-res"));

  it("Passarela: a peça azul dispara os flashes da plateia; a peça sem cor de efeito não mostra nada", async () => {
    const fx = { efeitos: [
      { cardId: "c1", itens: [{ codigo: "MARCA_BR", valor: 10 }, { codigo: "COR_FLASHES", valor: 4 }] },
      { cardId: "c5", itens: [{ codigo: "MARCA_BR", valor: 10 }] },
    ] };
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": fx });
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} />);
    await waitFor(() => expect(fileira()[0].querySelector(".n3d-card-fx")?.textContent).toBe("+10 marca BR"));
    fireEvent.click(fileira()[0]);
    const cor = screen.getByTestId("nucleo-fx-color");
    expect(cor.textContent).toBe("flashes da plateia");
    expect(cor.style.getPropertyValue("--n3d-fx-peca")).toBe("#2A5FA8");
    expect(within(screen.getByTestId("nucleo-card-fx")).getByRole("status").textContent).toContain("Camisa verde: flashes da plateia");
    fireEvent.click(fileira()[1]);
    await waitFor(() => expect(screen.queryByTestId("nucleo-fx-color")).toBeNull());
  });
});
