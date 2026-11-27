// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";

/** Batalha de Looks: a peça que desfilou na rodada anterior chega cansada e não pontua; a prévia do servidor avisa. */
beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("peças cansadas da Batalha de Looks", () => {
  const previa = (eventos: { codigo: string; valor: unknown }[]) => ({ pontos: 25, estrelas: 0, resultado: "EM_PREPARO", regras: [], eventos });

  it("a prévia com peças cansadas mostra quantas não pontuam nesta rodada", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/BATALHA_LOOKS/efeitos": EFEITOS });
    renderApp(<NucleoGame definicao={definicao("BATALHA_LOOKS")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()}
      previa={previa([{ codigo: "CARTAS_CANSADAS", valor: { quantas: 2, vagas: ["SUP", "INF"] } }])} />);
    const aviso = await screen.findByTestId("nucleo-cansadas");
    expect(aviso.textContent).toBe("2 peças cansadas: desfilaram na rodada anterior e não pontuam nesta");
  });

  it("sem peça cansada não há aviso", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/BATALHA_LOOKS/efeitos": EFEITOS });
    renderApp(<NucleoGame definicao={definicao("BATALHA_LOOKS")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} previa={previa([])} />);
    await screen.findByTestId("nucleo-score");
    expect(screen.queryByTestId("nucleo-cansadas")).toBeNull();
  });
});
