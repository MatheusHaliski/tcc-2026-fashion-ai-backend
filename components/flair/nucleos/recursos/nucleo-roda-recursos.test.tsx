// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Peça usada como recurso na partida: o medidor sobe na hora com "+25", a peça gasta fica apagada e o valor final é o
 * que o servidor devolveu. Se o servidor recusar, o medidor volta e a recusa aparece.
 */
const BLAZER = { vaga: "SUP", atributos: { RESISTENCIA: 26 }, recurso: "VIDA", quantidade: 25, usos: 1, acoes: ["BLOQUEAR"], dominante: "RESISTENCIA" };
const EFEITOS_COM_PERFIL = { efeitos: EFEITOS.efeitos.map((e) => (e.cardId === "c1" ? { ...e, perfil: BLAZER } : e)) };
const INICIO = { recursos: { VIDA: 60, ENERGIA: 40, FOCO: 40, MOEDAS: 0 }, usados: { c1: 0 } };
const PARTIDA = { id: "p1", nucleo: "PASSARELA" as const, status: "ABERTA", semente: 1 };

function montar(usar: unknown) {
  const api = loggedAs(ME, {
    "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS_COM_PERFIL,
    "GET /api/flair/3d/partidas/p1/recursos": INICIO,
    "POST /api/flair/3d/partidas/p1/usar": usar,
  });
  renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} partida={PARTIDA} />);
  return api;
}

const vida = () => screen.getByTestId("nucleo-roda-recursos").querySelector('[data-recurso="VIDA"] [role="meter"]');

beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("roda de recursos da partida", () => {
  it("usar o blazer: a vida sobe para 85 na hora, aparece +25 e a peça fica gasta; o servidor recebe só a carta e o pedido", async () => {
    let resolver: (v: Response) => void = () => undefined;
    const resposta = new Promise<Response>((r) => (resolver = r));
    const { calls } = montar(() => resposta);
    const roda = await screen.findByTestId("nucleo-roda-recursos");
    await waitFor(() => expect(vida()?.getAttribute("aria-valuenow")).toBe("60"));
    const botao = await within(roda).findByRole("button", { name: /Camisa verde: \+25 Vida/ });
    fireEvent.click(botao);
    // antes da resposta: a tela já mostra o ganho (com a quantidade do perfil do servidor)
    expect(vida()?.getAttribute("aria-valuenow")).toBe("85");
    expect(screen.getByTestId("nucleo-recurso-ganho").textContent).toBe("+25");
    resolver(new Response(JSON.stringify({ recursos: { VIDA: 85, ENERGIA: 40, FOCO: 40, MOEDAS: 0 }, usados: { c1: 1 }, uso: { carta: "c1", recurso: "VIDA", quantidade: 25, antes: 60, depois: 85 } }), { status: 200, headers: { "content-type": "application/json" } }));
    await waitFor(() => expect((within(roda).getByRole("button", { name: /Camisa verde/ }) as HTMLButtonElement).disabled).toBe(true));
    const pedido = calls.find((c) => c.path === "/api/flair/3d/partidas/p1/usar")?.body as Record<string, unknown>;
    expect(Object.keys(pedido).sort()).toEqual(["carta", "pedido"]);
    expect(pedido.carta).toBe("c1");
  });

  it("o servidor recusa: a vida volta a 60 e a recusa aparece", async () => {
    montar(() => new Response(JSON.stringify({ status: 422, code: "SEM_USOS", message: "Esta peça já foi usada." }), { status: 422, headers: { "content-type": "application/json" } }));
    const roda = await screen.findByTestId("nucleo-roda-recursos");
    fireEvent.click(await within(roda).findByRole("button", { name: /Camisa verde/ }));
    expect(await within(roda).findByRole("alert")).toBeTruthy();
    expect(within(roda).getByRole("alert").textContent).toContain("Esta peça já foi usada.");
    expect(vida()?.getAttribute("aria-valuenow")).toBe("60");
  });

  it("o que as decisões gastaram aparece no medidor do recurso-vida do jogo, com o nome dele na história", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS_COM_PERFIL, "GET /api/flair/3d/partidas/p1/recursos": INICIO });
    const previa = { pontos: 40, estrelas: 0, resultado: "EM_PREPARO", regras: [], eventos: [{ codigo: "DESGASTE", valor: { recurso: "FOCO", reserva: 40, gasto: 20, restante: 20, motivos: { PECA_FORA_DO_TEMA: 20 } } }] };
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} partida={PARTIDA} previa={previa} />);
    const roda = await screen.findByTestId("nucleo-roda-recursos");
    const foco = await waitFor(() => {
      const li = roda.querySelector('[data-recurso="FOCO"]');
      expect(li).not.toBeNull();
      return li as HTMLElement;
    });
    expect(foco.textContent).toContain("Confiança da modelo");
    expect(foco.querySelector('[role="meter"]')?.getAttribute("aria-valuenow")).toBe("20");
    expect(within(foco).getByTestId("nucleo-recurso-gasto").textContent).toContain("−20");
    // os outros medidores ficam como o servidor mandou
    expect(vida()?.getAttribute("aria-valuenow")).toBe("60");
  });

  it("jogo de zonas, sem peças para usar: a roda mostra o fôlego que a tinta deixou para a fase de uso", async () => {
    loggedAs(ME, {});
    const previa = { pontos: 100, estrelas: 3, resultado: "EM_PREPARO", regras: [], eventos: [{ codigo: "DESGASTE", valor: { recurso: "ENERGIA", reserva: 80, gasto: 30, restante: 50, motivos: { TINTA: 30 } } }] };
    renderApp(<NucleoGame definicao={definicao("PILOTO_FAVORITO")} cartas={[]} entregando={false} erro={null} onEntregar={vi.fn()} previa={previa} />);
    const roda = await screen.findByTestId("nucleo-roda-recursos");
    expect(roda.querySelectorAll("[data-recurso]")).toHaveLength(1);
    expect(roda.textContent).toContain("Combustível");
    expect(roda.querySelector('[role="meter"]')?.getAttribute("aria-valuenow")).toBe("50");
    expect(roda.textContent).toContain("−30");
  });
});
