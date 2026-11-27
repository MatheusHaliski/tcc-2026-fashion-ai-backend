// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { NucleoResult } from "@/components/flair/nucleos/nucleo-result";
import { ME, cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/**
 * O bug da rodada 8g: o resultado da Batalha mostrava "30 pontos", nenhuma estrela e "Vitória" com a tabela 127 × 79.
 * Agora o resultado mostra o que o servidor decidiu: a execução entra na soma e a vitória vale ao menos 1 estrela.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const conta = (regra: number) => ({ voce: { regra, look: 2, recurso: 0 }, adversario: { regra: 20, look: 1, recurso: 0 } });
const rodada = (n: number, voce: number, adversario: number) => ({ codigo: "RODADA_DA_BATALHA", valor: { rodada: n, desafio: "MONO_AZUL", voce, adversario, conta: conta(voce - 2), cansadas: [] } });

describe("resultado final da Batalha de Looks", () => {
  it("seguir sem executar: a execução vazia aparece na tabela, a soma é a do servidor e a vitória tem estrela", async () => {
    loggedAs(ME, {});
    const fim: NucleoResultado = {
      pontos: 60, estrelas: 1, resultado: "VITORIA", status: "ENTREGUE", regras: [],
      eventos: [rodada(1, 52, 27), rodada(2, 40, 26), rodada(3, 35, 26), { codigo: "SOMA_DA_BATALHA", valor: { voce: 115, adversario: 79, rodadas: 127, execucao: -12 } }],
    };
    renderApp(<NucleoResult codigo="BATALHA_LOOKS" resultado={fim} onAgain={vi.fn()} rodada="BATALHA_DE_3_RODADAS" />);
    const tabela = await screen.findByTestId("batalha-placar");
    expect(screen.getByTestId("batalha-execucao").textContent).toContain("-12");
    expect(tabela.querySelector("tfoot")?.textContent).toContain("115");
    expect(tabela.querySelector("tfoot")?.textContent).toContain("79");
    expect(screen.getByTestId("batalha-fecho")).toBeTruthy();
    expect(document.querySelectorAll(".n3d-star.is-on")).toHaveLength(1);
  });
});
