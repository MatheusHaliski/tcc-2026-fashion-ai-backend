// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuscarAdversario } from "@/components/flair/multi/buscar-adversario";
import { ConvidarDialog } from "@/components/flair/multi/convidar-dialog";
import { SalaTela } from "@/components/flair/multi/sala-tela";
import type { Adversario, Sala, Turnos } from "@/lib/flair/multi/types";
import { nav, router } from "@/test-utils/setup";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Multiplayer do FLAIR 3D na tela: busca com filtros (sem tag), convite que leva à sala, aceite, lance por turnos
 * selado até a outra pessoa e o resultado com revanche. A API é simulada com os DTOs do servidor.
 */
beforeEach(() => { nav.search = new URLSearchParams(); router.push.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const pessoa = (u: string, extra: Partial<Adversario> = {}): Adversario => ({
  id: `id-${u}`, username: u, nome: u.toUpperCase(), nivel: "TRENDSETTER", nivelLabel: "Trendsetter", pontos: 600, ativo: true, relacao: "MUTUOS",
  status: "DISPONIVEL", convidavel: true, estilo: "CLASSIC", pais: "BR", temDeck: true, ...extra,
});
const ADV = { resultados: [pessoa("bia"), pessoa("eva", { convidavel: false, motivo: "CONTA_PRIVADA", relacao: "NENHUMA", ativo: false })], niveis: [] };
const ana = { id: ME.user.id, username: ME.user.username };
const sala = (extra: Partial<Sala> = {}): Sala => ({
  id: "s1", jogo: "BATALHA_LOOKS", rodada: "BATALHA_DE_3_RODADAS", modo: "TURNOS", estado: "JOGANDO", prazo: "2026-11-29T12:00:00Z", voce: "DE",
  de: ana, para: { id: "id-bia", username: "bia" }, ...extra,
});
const turnos = (extra: Partial<Turnos> = {}): Turnos => ({
  total: 3, vagas: ["SUP", "INF", "CAL", "ACE"], minimo: 1, repete: true, vez: 1, esperando: false, outroLancou: false, meuDeck: ["c1", "c2", "c3"],
  deckDoOutroPronto: true, usadas: [], julgados: [], pontos: { de: 0, para: 0 }, encerrado: false, desafios: ["MONO_AZUL"], ...extra,
});
const carta = (id: string, position: string) => ({ id, originType: "PIECE", originId: id, season: "SPRING", tier: "OURO", ovr: 80, rare: false, position, name: `Carta ${id}`,
  priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "X", tags: { colors: ["blue"] } });
const BANCO = { season: "SPRING", counts: {}, total: 3, cards: [carta("c1", "SUP"), carta("c2", "INF"), carta("c3", "CAL")] };

describe("BuscarAdversario", () => {
  it("busca pela rede FAI com filtros, mostra nível e estilo e não deixa convidar conta privada", async () => {
    const onEscolher = vi.fn();
    const { calls } = loggedAs(ME, { "GET /api/flair/3d/adversarios": ADV });
    renderApp(<BuscarAdversario jogo="PASSARELA" onEscolher={onEscolher} />);
    const bia = await screen.findByTestId("fm-pessoa-bia");
    expect(within(bia).getByText("Trendsetter")).toBeTruthy();
    expect(within(bia).getByText("Clássico")).toBeTruthy();
    expect(within(bia).getByText("vocês se seguem")).toBeTruthy();
    const eva = screen.getByTestId("fm-pessoa-eva");
    expect((within(eva).getByRole("button", { name: "Convidar @eva" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(eva).getByText("Conta privada: siga a pessoa para convidar.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mútuos" }));
    fireEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    fireEvent.click(screen.getByLabelText("Nível FLAIR mínimo"));
    fireEvent.click(await screen.findByRole("option", { name: "Iconic" }));
    fireEvent.change(screen.getByTestId("fm-busca-termo"), { target: { value: "@bi" } });
    await waitFor(() => expect(calls.map((c) => c.path)).toContain("/api/flair/3d/adversarios?q=bi&relacao=MUTUOS&nivel=ICONIC&jogo=PASSARELA"), { timeout: 2000 });
    fireEvent.click(within(screen.getByTestId("fm-pessoa-bia")).getByRole("button", { name: "Convidar @bia" }));
    expect(onEscolher).toHaveBeenCalledWith(expect.objectContaining({ id: "id-bia" }));
  });
});

describe("ConvidarDialog", () => {
  it("convida a pessoa escolhida no modo por turnos e vai para a sala", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/3d/adversarios": ADV, "POST /api/flair/3d/convites": sala({ estado: "CONVIDADO" }) });
    renderApp(<ConvidarDialog jogo="BATALHA_LOOKS" onClose={() => undefined} />);
    expect(screen.getByRole("button", { name: "Por turnos" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(await screen.findByRole("button", { name: "Convidar @bia" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/flair/3d/sala/s1"));
    expect(calls.find((c) => c.path === "/api/flair/3d/convites")?.body).toEqual({ para: "id-bia", jogo: "BATALHA_LOOKS", modo: "TURNOS", rodada: null });
  });
});

describe("SalaTela", () => {
  it("quem foi convidada aceita o convite", async () => {
    let atual = sala({ estado: "CONVIDADO", voce: "PARA", de: { id: "id-bia", username: "bia" }, para: ana });
    const { calls } = loggedAs(ME, { "GET /api/flair/3d/salas/s1": () => atual, "POST /api/flair/3d/salas/s1/aceitar": () => { atual = { ...atual, estado: "JOGANDO", turnos: turnos({ meuDeck: [] }) }; return atual; },
      "GET /api/flair/nucleos/BATALHA_LOOKS": {}, "GET /api/me/flair/cards": BANCO });
    renderApp(<SalaTela id="s1" />);
    expect(await screen.findByText(/@bia convidou você/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("fm-aceitar"));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/flair/3d/salas/s1/aceitar")).toBe(true));
    expect(await screen.findByTestId("fm-deck-da-sala")).toBeTruthy();
  });

  it("lance da Batalha por turnos fica selado e o turno julgado mostra os dois lados", async () => {
    const julgado = { turno: 1, desafio: "MONO_AZUL", vencedor: "DE" as const, de: { nota: 85, cartas: { SUP: "c1" } }, para: { nota: 40, cartas: { SUP: "x" } } };
    const depois = sala({ turnos: turnos({ vez: 2, julgados: [julgado], pontos: { de: 85, para: 40 }, desafios: ["MONO_AZUL", "CLIMA_FRIO"] }) });
    const { calls } = loggedAs(ME, { "GET /api/flair/3d/salas/s1": sala({ turnos: turnos({ outroLancou: true }) }), "POST /api/flair/3d/salas/s1/lance": depois,
      "GET /api/flair/3d/nucleos/BATALHA_LOOKS": {}, "GET /api/me/flair/cards": BANCO });
    renderApp(<SalaTela id="s1" />);
    expect(await screen.findByText("@bia já lançou")).toBeTruthy();
    expect(screen.getByTestId("fm-desafio").textContent).toContain("Look monocromático em azul");
    fireEvent.click(await screen.findByTestId("fm-carta-c1"));
    fireEvent.click(screen.getByTestId("fm-carta-c2"));
    fireEvent.click(screen.getByTestId("fm-lancar"));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/flair/3d/salas/s1/lance")?.body).toEqual({ turno: 1, cartas: { SUP: "c1", INF: "c2" } }));
    const lista = await screen.findByTestId("fm-turnos-julgados");
    expect(within(lista).getByText("85")).toBeTruthy();
    expect(within(lista).getByText("40")).toBeTruthy();
    expect(screen.getByTestId("fm-placar").textContent).toContain("85");
  });

  it("sala fechada mostra os dois lados, o histórico e a revanche", async () => {
    loggedAs(ME, { "GET /api/flair/3d/salas/s1": sala({ estado: "FECHADO", vencedor: "PARA", resultado: { de: { pontos: 120 }, para: { pontos: 150 } }, turnos: turnos({ encerrado: true }) }),
      "GET /api/flair/3d/historico/id-bia": { placar: { vitorias: 2, derrotas: 1, empates: 0 }, salas: [] }, "POST /api/flair/3d/salas/s1/revanche": sala({ id: "s2", estado: "CONVIDADO" }) });
    renderApp(<SalaTela id="s1" />);
    const res = await screen.findByTestId("fm-resultado");
    expect(within(res).getByText("Derrota")).toBeTruthy();
    expect(within(res).getByText("150")).toBeTruthy();
    expect((await screen.findByTestId("fm-historico")).textContent).toBe("Contra @bia: 2 vitórias, 1 derrotas, 0 empates");
    fireEvent.click(screen.getByTestId("fm-revanche"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/flair/3d/sala/s2"));
  });
});
