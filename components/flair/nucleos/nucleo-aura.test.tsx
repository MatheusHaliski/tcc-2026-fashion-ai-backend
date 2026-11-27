// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { NucleoAura } from "@/components/flair/nucleos/nucleo-aura";
import { NucleoResult } from "@/components/flair/nucleos/nucleo-result";
import { CARTAS } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import type { AuraDaCarta } from "@/lib/flair/nucleos/aura-na-partida";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** A Aura na partida na tela (rodada 8g): a plateia pela faixa de Hype, as famílias vestidas e o trunfo de uso único. */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const AURAS: Record<string, AuraDaCarta> = {
  c1: { familia: "SPLASH", faixa: "VIRAL", trunfo: 5, metamorfose: false },
  c2: { familia: "ELECTRO", faixa: "HOT", trunfo: 3, metamorfose: false },
};
const aura = (id: string) => AURAS[id];

describe("Aura na partida", () => {
  it("antes da prévia lê a regra dos selos; o trunfo chama o servidor uma vez e mostra o que rende", async () => {
    const { calls } = loggedAs(ME, { "POST /api/flair/3d/partidas/p1/hype": { hype: { carta: "c1", faixa: "VIRAL", bonus: 5, etapa: 0 } } });
    renderApp(<NucleoAura codigo="PASSARELA" vestidas={{ SUP: "c1", INF: "c2" }} cartas={CARTAS} aura={aura} partida="p1" />);
    // (5 + 3) / 2 = 4, Tendência; com Splash, Viral: +6
    expect(screen.getByTestId("nucleo-aura-plateia").textContent).toBe("A plateia do desfile reage ao Hype Viral do look: +6 quando o look fechar (até +6; Hype baixo não tira ponto).");
    expect(document.querySelectorAll("[data-familia]")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Chamar o Hype de Camisa verde \(\+5\)/ }));
    await waitFor(() => expect(screen.getByTestId("nucleo-aura-trunfo").textContent).toContain("Trunfo chamado: Camisa verde, Hype Viral, +5"));
    expect(calls.filter((c) => c.path.endsWith("/hype"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Chamar o Hype/ })).toBeNull();
  });

  it("fora dos jogos com Aura na partida, nada aparece; a Batalha fala do júri", () => {
    loggedAs(ME, {});
    const { unmount } = renderApp(<NucleoAura codigo="LABIRINTO" vestidas={{ SUP: "c1" }} cartas={CARTAS} aura={aura} partida="p1" />);
    expect(screen.queryByTestId("nucleo-aura")).toBeNull();
    unmount();
    renderApp(<NucleoAura codigo="BATALHA_LOOKS" vestidas={{ SUP: "c1" }} cartas={CARTAS} aura={aura} partida="p1" />);
    expect(screen.getByTestId("nucleo-aura-plateia").textContent).toMatch(/^O júri reage/);
    expect(screen.getByTestId("nucleo-aura-trunfo").textContent).toContain("no empate, vota em você");
  });

  it("o resultado diz o que a plateia, o trunfo e a execução renderam", () => {
    loggedAs(ME, {});
    const r: NucleoResultado = { pontos: 82, estrelas: 2, resultado: "APROVADO", status: "ENTREGUE", regras: [{ codigo: "PLATEIA_DO_HYPE", ok: true, pontos: 4 }], eventos: [
      { codigo: "AURA_NA_PARTIDA", valor: { faixa: "TRENDING", plateia: 4, splash: false, electroMs: 150, comum: true, metamorfose: false, trunfo: { carta: "c1", faixa: "VIRAL", bonus: 5, etapa: 0 } } },
      { codigo: "AURA_NA_EXECUCAO", valor: { electroMs: 150, perdoados: 1, metamorfoses: [] } }] };
    renderApp(<NucleoResult codigo="PASSARELA" resultado={r} onAgain={vi.fn()} />);
    const linhas = Array.from(screen.getByTestId("nucleo-result-aura").querySelectorAll("li")).map((li) => li.textContent);
    expect(linhas).toEqual(["A plateia do desfile reagiu ao Hype Tendência do look: +4.", "O trunfo do Hype (Viral) rendeu +5.", "Electro: a execução teve +150 ms em cada marca.", "Comum: o primeiro erro não drenou o recurso."]);
    expect(screen.getByText("Plateia pelo Hype das cartas (até +6)")).toBeTruthy();
  });
});
