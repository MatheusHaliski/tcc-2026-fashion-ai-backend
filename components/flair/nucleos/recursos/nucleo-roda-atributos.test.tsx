// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";

/**
 * A regra peça-recurso na tela: vestir uma peça muda na hora a roda de atributos do look, mostra o que mudou
 * ("+26 Resistência") e as ações que a peça destravou — sem nova requisição, só com o perfil que o servidor mandou
 * em POST .../efeitos. Servidor antigo (sem perfil): a roda não aparece.
 */
const BLAZER = { vaga: "SUP", atributos: { CARISMA: 8, RESISTENCIA: 26 }, recurso: "VIDA", quantidade: 25, usos: 1, acoes: ["BLOQUEAR"], dominante: "RESISTENCIA" };
const COM_PERFIL = { efeitos: EFEITOS.efeitos.map((e) => (e.cardId === "c1" ? { ...e, perfil: BLAZER } : e)) };

function montar(resposta: unknown) {
  const { calls } = loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": resposta });
  renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} />);
  return calls;
}

const fileira = () => Array.from(screen.getByTestId("nucleo-resource-window").querySelectorAll<HTMLButtonElement>(".n3d-row .n3d-res"));
const carregou = () => waitFor(() => expect(fileira()[0].querySelector(".n3d-card-fx")?.textContent).toBe("+10 marca BR"));

beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("roda de atributos do look", () => {
  it("vestir o blazer sobe resistência e carisma na hora, mostra a troca e destrava bloquear", async () => {
    const calls = montar(COM_PERFIL);
    await carregou();
    expect(screen.queryByTestId("nucleo-roda-atributos")).toBeNull();
    const pedidos = calls.length;
    fireEvent.click(fileira()[0]);
    const roda = await screen.findByTestId("nucleo-roda-atributos");
    expect(screen.getByTestId("nucleo-roda-mudanca").textContent).toBe("+26 Resistência · +8 Carisma");
    expect(screen.getByTestId("nucleo-roda-acoes").textContent).toContain("Bloquear");
    expect(roda.querySelector('[data-atributo="RESISTENCIA"]')?.classList.contains("is-up")).toBe(true);
    expect(screen.getByTestId("nucleo-roda-brilho")).toBeTruthy();
    expect(roda.querySelector('[role="status"]')?.textContent).toContain("+26 Resistência");
    // nada de requisição a mais para mostrar o efeito
    expect(calls.filter((c) => c.path.endsWith("/efeitos")).length).toBe(calls.slice(0, pedidos).filter((c) => c.path.endsWith("/efeitos")).length);
  });

  it("servidor sem perfil: a roda não aparece e o jogo segue como antes", async () => {
    montar(EFEITOS);
    await carregou();
    fireEvent.click(fileira()[0]);
    expect(screen.queryByTestId("nucleo-roda-atributos")).toBeNull();
  });
});
