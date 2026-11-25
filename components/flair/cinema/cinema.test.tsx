// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { assinarFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";

/** Cutscenes na tela de jogo: a abertura com faixas e legenda ao entrar, o pular, e o final pelo desfecho. */
const PARTIDA = { id: "p9", nucleo: "PASSARELA" as const, status: "ABERTA", semente: 1 };
const RUIM: NucleoResultado = { pontos: 20, estrelas: 0, resultado: "REPROVADO", status: "ENTREGUE", regras: [], eventos: [] };
let eventos: FxEvento[] = [];
let cancelar = () => undefined as void;

beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
  eventos = [];
  cancelar = assinarFx((e) => eventos.push(e));
});
afterEach(() => {
  cancelar();
  cleanup();
  vi.restoreAllMocks();
});

function montar(extra: Partial<Parameters<typeof NucleoGame>[0]> = {}) {
  loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS, "GET /api/flair/3d/partidas/p9/recursos": { recursos: { VIDA: 60, ENERGIA: 40, FOCO: 40, MOEDAS: 0 }, usados: {} } });
  renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} partida={PARTIDA} {...extra} />);
}

describe("cutscenes da partida", () => {
  it("a abertura toca ao entrar, com o nome do jogo na legenda, a câmera da cena recebe a cutscene e o pular encerra", async () => {
    montar();
    const cena = await screen.findByTestId("cinema");
    expect(cena.dataset.gatilho).toBe("ABERTURA");
    expect(screen.getByTestId("cinema-legenda").textContent).toBe("Passarela");
    const inicio = eventos.find((e) => e.tipo === "cinema");
    expect(inicio && inicio.tipo === "cinema" && inicio.cutscene?.id).toBe("PASSARELA.ABERTURA");
    fireEvent.click(screen.getByTestId("cinema-pular"));
    expect(screen.queryByTestId("cinema")).toBeNull();
    expect(eventos.filter((e) => e.tipo === "cinema").at(-1)).toMatchObject({ cutscene: null });
  });

  it("○ (Shift) só pula a cena", async () => {
    montar();
    await screen.findByTestId("cinema");
    fireEvent.keyDown(window, { key: "Shift" });
    expect(screen.queryByTestId("cinema")).toBeNull();
  });

  it("o resultado que fecha a partida mal toca a derrota, com o final da narrativa", async () => {
    montar({ momento: "RESULTADO", resultado: RUIM });
    const cena = await screen.findByTestId("cinema");
    expect(cena.dataset.gatilho).toBe("DERROTA");
    expect(screen.getByTestId("cinema-legenda").textContent).toContain("O tema escapou");
  });
});
