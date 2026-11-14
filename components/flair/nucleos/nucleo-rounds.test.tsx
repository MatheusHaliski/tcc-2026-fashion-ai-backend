// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Rodadas na tela, com a API simulada: a escolha da rodada antes do deck, a rodada mandada ao abrir a partida, o cartão
 * que apresenta a etapa da vez ou o que o jogo revelou, a rodada em etapas que volta à preparação até a última, o
 * look-alvo que some, o aviso do deck do Labirinto, as zonas da rodada e o resultado com o nome da rodada e as dicas.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/3d" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 4, BRONZE: 0 }, total: 4, cards: [card("c1", "Camisa verde", "SUP"), card("c2", "Calça linho", "INF"), card("c3", "Tênis azul", "CAL"), card("c4", "Bolsa palha", "ACE")] };
const DECK = { tamanhoMax: 8, obrigatorias: [{ posicao: "SUP", quantidade: 1 }], semDeck: false };
const regra = (codigo: string, pontos = 25) => ({ codigo, pontos });
const rodada = (codigo: string, regras: { codigo: string; pontos: number }[], extra: Record<string, unknown> = {}) => ({ codigo, objetivo: { codigo, regras }, ...extra });
const def = (codigo: string, numero: number, over: Record<string, unknown>) => ({ codigo, numero, objetivo: { codigo: "BASE", regras: [] }, recursos: ["CARTAS"], vagas: ["SUP", "INF", "CAL", "ACE"], zonas: [], areas: [], opcoes: [], acoes: [], deck: DECK, ...over });
const corpo = (calls: { path: string; method: string; body?: unknown }[], fim: string) => calls.filter((c) => c.path.endsWith(fim) && c.method === "POST").map((c) => c.body);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function entrarComAPrimeiraCarta() {
  const deck = await screen.findByTestId("nucleo-deck");
  fireEvent.click(deck.querySelectorAll<HTMLButtonElement>(".n3d-deck-card")[0]);
  fireEvent.click(within(deck).getByRole("button", { name: "Entrar na partida" }));
  await screen.findByTestId("nucleo-game");
}

describe("escolha da rodada e rodada em etapas (BOUTIQUE_3D)", () => {
  const BOUTIQUE = def("BOUTIQUE_3D", 7, {
    objetivo: { codigo: "FESTA_EM_PRETO", regras: [regra("PEDIDO", 33)] },
    rodadas: [rodada("FESTA_EM_PRETO", [regra("PEDIDO", 33)]), rodada("PERSONAL_STYLIST", [regra("PEDIDO_OCASIAO", 1), regra("PEDIDO_COR", 1), regra("PEDIDO_ESTILO", 1)], { etapas: 3 })],
  });
  const etapa = (n: number, codigo: string) => ({ etapa: n, codigo, total: 3, tentativa: 1 });
  const regrasDaCliente = [{ codigo: "PEDIDO_OCASIAO", ok: true, pontos: 33.33 }, { codigo: "PEDIDO_COR", ok: false, pontos: 0 }, { codigo: "PEDIDO_ESTILO", ok: true, pontos: 33.33 }];

  it("a lista mostra as rodadas, a escolhida vai na abertura, cada etapa é apresentada e o resultado traz nome e dicas", async () => {
    let entregas = 0;
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/BOUTIQUE_3D": BOUTIQUE,
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/BOUTIQUE_3D/efeitos": { efeitos: [{ cardId: "c1", itens: [{ codigo: "CONFORME_A_ETAPA", valor: 1 }] }] },
      "POST /api/flair/3d/nucleos/BOUTIQUE_3D/partidas": { id: "m7", nucleo: "BOUTIQUE_3D", status: "ABERTA", semente: 5, rodada: "PERSONAL_STYLIST", abertura: { etapa: etapa(1, "CLIENTE_JANTAR") } },
      "POST /api/flair/3d/partidas/m7/previa": { pontos: 67, estrelas: 1, resultado: "EM_PREPARO", regras: regrasDaCliente, eventos: [], status: "ABERTA" },
      "POST /api/flair/3d/partidas/m7/entrega": () => {
        entregas += 1;
        if (entregas === 1) return { pontos: 0, estrelas: 0, resultado: "ETAPA_CUMPRIDA", status: "ABERTA", regras: regrasDaCliente, eventos: [{ codigo: "ESTRELAS_DA_CLIENTE", valor: 2 }, { codigo: "PROXIMA_ETAPA", valor: etapa(2, "CLIENTE_VIAGEM") }] };
        return { pontos: 67, estrelas: 1, resultado: "APROVADO", status: "ENTREGUE", regras: [{ codigo: "CLIENTE_JANTAR", ok: true, pontos: 22.22 }, { codigo: "CLIENTE_VIAGEM", ok: false, pontos: 0 }], eventos: [{ codigo: "ETAPA", valor: { etapa: 1, codigo: "CLIENTE_JANTAR", pontos: 67, tentativas: 1 } }, { codigo: "ESTRELAS_DAS_CLIENTES", valor: 6 }] };
      },
    });
    renderApp(<NucleoScreen nucleo="boutique-3d" />);
    const lista = await screen.findByTestId("nucleo-rounds");
    expect(screen.queryByTestId("nucleo-deck")).toBeNull();
    const botoes = within(lista).getAllByRole("button");
    expect(botoes.map((b) => b.getAttribute("data-rodada"))).toEqual(["FESTA_EM_PRETO", "PERSONAL_STYLIST"]);
    expect(botoes[1].textContent).toContain("Personal Stylist");
    expect(botoes[1].textContent).toContain("3 looks, um por etapa");
    expect(botoes[1].textContent).toContain("2 peças na ocasião da cliente");
    // setas andam pela lista
    botoes[0].focus();
    fireEvent.keyDown(botoes[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(botoes[1]);
    fireEvent.click(botoes[1]);

    await entrarComAPrimeiraCarta();
    expect(corpo(calls, "/partidas")).toEqual([{ deck: ["c1"], rodada: "PERSONAL_STYLIST" }]);
    expect(corpo(calls, "/efeitos")[0]).toEqual({ cartas: ["c1", "c2", "c3", "c4"], rodada: "PERSONAL_STYLIST" });
    await waitFor(() => expect(corpo(calls, "/efeitos").some((b) => (b as { partida?: string }).partida === "m7")).toBe(true));
    // o objetivo no topo é o da rodada, e o cartão apresenta a primeira cliente sem cobrir o palco
    expect(screen.getByTestId("nucleo-objective").textContent).toContain("3 clientes sorteadas");
    const cartao = screen.getByTestId("nucleo-briefing");
    expect(cartao.textContent).toContain("Etapa 1 de 3");
    expect(cartao.textContent).toContain("Cliente do jantar");
    expect(cartao.textContent).toContain("Cor: vermelho");
    expect(cartao.closest(".n3d-lower")).toBeTruthy();
    expect(cartao.closest(".n3d-stage")).toBeNull();
    fireEvent.click(within(cartao).getByRole("button", { name: "Vestir" }));
    expect(screen.queryByTestId("nucleo-briefing")).toBeNull();
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("Etapa 1 de 3 · Cliente do jantar");

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Ver o resultado" }));
    // a partida segue aberta: de volta à preparação, com a segunda cliente apresentada
    const segundo = await screen.findByTestId("nucleo-briefing");
    expect(segundo.textContent).toContain("Etapa 2 de 3");
    expect(segundo.textContent).toContain("Cliente da viagem");
    expect(screen.queryByTestId("nucleo-result")).toBeNull();
    fireEvent.click(within(segundo).getByRole("button", { name: "Vestir" }));

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Ver o resultado" }));
    const result = await screen.findByTestId("nucleo-result");
    expect(screen.getByTestId("nucleo-result-round").textContent).toBe("Personal Stylist");
    expect(result.textContent).toContain("Aprovado");
    expect(result.textContent).toContain("CumpridaCliente do jantar");
    expect(result.textContent).toContain("Etapa 1, Cliente do jantar: 67 pontos em 1 tentativa");
    expect(result.textContent).toContain("Estrelas das 3 clientes: 6 de 9");
    expect(screen.getByTestId("nucleo-result-hints").textContent).toContain("Para cumprir: Cliente da viagem.");
    expect(result.textContent).not.toMatch(/[A-Z]{3,}_[A-Z_]{3,}/);
    // jogar de novo volta à escolha da rodada
    fireEvent.click(within(result).getByRole("button", { name: "Jogar de novo" }));
    expect(await screen.findByTestId("nucleo-rounds")).toBeTruthy();
  });
});

describe("o que o jogo revela ao entrar", () => {
  it("PASSARELA: o tema surpresa só aparece depois de entrar, e o resultado traz a colocação na sala", async () => {
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/PASSARELA": def("PASSARELA", 1, { rodadas: [rodada("TEMA_SURPRESA", [regra("NO_TEMA", 10), regra("TUDO_NO_TEMA", 20)]), rodada("TEMA_BRASIL", [regra("MARCA_BR", 10)])] }),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/PASSARELA/efeitos": { efeitos: [{ cardId: "c1", itens: [{ codigo: "TEMA_SURPRESA", valor: 1 }] }] },
      "POST /api/flair/3d/nucleos/PASSARELA/partidas": { id: "m1", nucleo: "PASSARELA", status: "ABERTA", semente: 7, rodada: "TEMA_SURPRESA", abertura: { tema: "TEMA_NOITE" } },
      "POST /api/flair/3d/partidas/m1/entrega": { pontos: 29, estrelas: 0, resultado: "REPROVADO", regras: [{ codigo: "NO_TEMA", ok: true, pontos: 20 }, { codigo: "TUDO_NO_TEMA", ok: false, pontos: 0 }], eventos: [{ codigo: "TEMA", valor: "TEMA_NOITE" }, { codigo: "DESFILE_DA_CASA", valor: { numero: 1, pontos: 57 } }, { codigo: "COLOCACAO", valor: { lugar: 2, total: 4 } }] },
    });
    renderApp(<NucleoScreen nucleo="passarela" />);
    fireEvent.click(within(await screen.findByTestId("nucleo-rounds")).getAllByRole("button")[0]);
    const deck = await screen.findByTestId("nucleo-deck");
    expect(await within(deck).findByText("o tema aparece ao entrar")).toBeTruthy();
    expect(deck.textContent).not.toContain("Noite");
    await entrarComAPrimeiraCarta();
    const cartao = screen.getByTestId("nucleo-briefing");
    expect(cartao.getAttribute("data-tipo")).toBe("tema");
    expect(cartao.textContent).toContain("Tema da passarela");
    expect(cartao.textContent).toContain("Noite");
    fireEvent.click(within(cartao).getByRole("button", { name: "Vestir" }));
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Ver o resultado" }));
    const result = await screen.findByTestId("nucleo-result");
    expect(result.textContent).toContain("Tema: Noite");
    expect(result.textContent).toContain("Desfile da casa 1: 57 pontos");
    expect(result.textContent).toContain("Sua colocação na sala: 2º de 4");
    expect(screen.getByTestId("nucleo-result-hints").textContent).toContain("Tire ou troque a peça fora do tema");
  });

  it("DRESS_THE_STAR: o look-alvo fica à vista pelos segundos do servidor e depois some", async () => {
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/DRESS_THE_STAR": def("DRESS_THE_STAR", 3, { rodadas: [rodada("ESTRELA_POP_2000", [regra("FIGURINO")]), rodada("LOOK_RELAMPAGO", [regra("IGUAL")])] }),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/DRESS_THE_STAR/efeitos": { efeitos: [] },
      "POST /api/flair/3d/nucleos/DRESS_THE_STAR/partidas": { id: "m3", nucleo: "DRESS_THE_STAR", status: "ABERTA", semente: 2, rodada: "LOOK_RELAMPAGO", abertura: { alvo: { SUP: "c1", CAL: "c3" }, segundos: 10 } },
    });
    renderApp(<NucleoScreen nucleo="dress-the-star" />);
    fireEvent.click(within(await screen.findByTestId("nucleo-rounds")).getAllByRole("button")[1]);
    // o alvo sai do deck da partida: a camisa e o tênis entram nele
    fireEvent.click((await screen.findByTestId("nucleo-deck")).querySelectorAll<HTMLButtonElement>(".n3d-deck-card")[2]);
    await entrarComAPrimeiraCarta();
    const cartao = screen.getByTestId("nucleo-briefing");
    expect(cartao.textContent).toContain("10 segundos");
    expect(cartao.textContent).toContain("Camisa verde");
    expect(cartao.textContent).toContain("Tênis azul");
    // enquanto o alvo está à vista, a régua de vagas mostra as peças dele
    const vagaDeCima = () => screen.getByTestId("nucleo-slot-ruler").querySelector('[data-slot="SUP"]');
    expect(vagaDeCima()?.getAttribute("aria-label")).toContain("Camisa verde");
    fireEvent.click(within(cartao).getByRole("button", { name: "Já decorei" }));
    expect(screen.queryByTestId("nucleo-briefing")).toBeNull();
    expect(vagaDeCima()?.getAttribute("aria-label")).not.toContain("Camisa verde");
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("O look sumiu");
  });

  it("LABIRINTO: o deck sem 3 cartas da mesma família de cor avisa; nas Três Portas a porta é escolhida antes de apresentar", async () => {
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/LABIRINTO": def("LABIRINTO", 10, { rodadas: [rodada("ESPELHO_1", [regra("MESMA_FAMILIA", 100)]), rodada("TRES_PORTAS", [regra("PORTA_FACIL", 1)], { etapas: 3, opcoes: ["PORTA_FACIL", "PORTA_MEDIA", "PORTA_DIFICIL"] })] }),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/LABIRINTO/efeitos": { efeitos: [{ cardId: "c1", itens: [{ codigo: "FAMILIA_VERDE", valor: 1 }] }, { cardId: "c2", itens: [{ codigo: "FAMILIA_AZUL", valor: 1 }] }, { cardId: "c3", itens: [{ codigo: "FAMILIA_AZUL", valor: 1 }] }, { cardId: "c4", itens: [{ codigo: "SEM_FAMILIA_DE_COR", valor: 0, motivo: true }] }] },
      "POST /api/flair/3d/nucleos/LABIRINTO/partidas": { id: "m10", nucleo: "LABIRINTO", status: "ABERTA", semente: 2, rodada: "TRES_PORTAS", abertura: { etapa: { etapa: 1, codigo: "SALA_DA_FESTA", total: 3, tentativa: 1 } } },
    });
    const { unmount } = renderApp(<NucleoScreen nucleo="labirinto" />);
    fireEvent.click(within(await screen.findByTestId("nucleo-rounds")).getAllByRole("button")[0]);
    const deck = await screen.findByTestId("nucleo-deck");
    await within(deck).findByText("família verde");
    expect(screen.queryByTestId("nucleo-deck-warning")).toBeNull();
    fireEvent.click(deck.querySelectorAll<HTMLButtonElement>(".n3d-deck-card")[0]);
    expect(screen.getByTestId("nucleo-deck-warning").textContent).toContain("não tem 3 cartas da mesma família de cor");
    unmount();

    renderApp(<NucleoScreen nucleo="labirinto" />);
    fireEvent.click(within(await screen.findByTestId("nucleo-rounds")).getAllByRole("button")[1]);
    expect(screen.queryByTestId("nucleo-deck-warning")).toBeNull();
    await entrarComAPrimeiraCarta();
    fireEvent.click(within(screen.getByTestId("nucleo-briefing")).getByRole("button", { name: "Vestir" }));
    const janela = screen.getByTestId("nucleo-resource-window");
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Roupas", "Porta"]);
    fireEvent.keyDown(window, { key: " " });
    expect((screen.getByRole("button", { name: "Apresentar ao espelho" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("Escolha a porta antes de apresentar o look.");
    fireEvent.click(screen.getByRole("button", { name: "Escolher a porta" }));
    fireEvent.click(within(janela).getByRole("button", { name: /Porta média/ }));
    expect((screen.getByRole("button", { name: "Apresentar ao espelho" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("nucleo-hint").textContent).toContain("Porta escolhida: Porta média");
  });
});

describe("rodada de zonas (PILOTO_FAVORITO)", () => {
  it("as abas são as zonas da rodada e a partida sem deck abre com a rodada escolhida", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/PILOTO_FAVORITO": def("PILOTO_FAVORITO", 11, {
        recursos: ["ZONAS"], vagas: [], zonas: ["TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA"], deck: { tamanhoMax: null, obrigatorias: [], semDeck: true },
        objetivo: { codigo: "EQUIPE_AURORA", regras: [regra("TOPO_AMARELO")] },
        rodadas: [rodada("EQUIPE_AURORA", [regra("TOPO_AMARELO")]), rodada("TENIS_DOS_SONHOS", [regra("SOLA_CLARA"), regra("ZONA_REFLETIVA")], { zonas: ["CABEDAL", "SOLA", "CADARCO"] })],
      }),
      "POST /api/flair/3d/nucleos/PILOTO_FAVORITO/partidas": { id: "m11", nucleo: "PILOTO_FAVORITO", status: "ABERTA", semente: 3, rodada: "TENIS_DOS_SONHOS", abertura: {} },
      "POST /api/flair/3d/partidas/m11/previa": { pontos: 25, estrelas: 0, resultado: "REPROVADO", regras: [], eventos: [], status: "ABERTA" },
      "POST /api/flair/3d/partidas/m11/entrega": { pontos: 25, estrelas: 0, resultado: "REPROVADO", regras: [{ codigo: "SOLA_CLARA", ok: true, pontos: 25 }, { codigo: "ZONA_REFLETIVA", ok: false, pontos: 0 }], eventos: [] },
    });
    renderApp(<NucleoScreen nucleo="piloto-favorito" />);
    fireEvent.click(within(await screen.findByTestId("nucleo-rounds")).getByRole("button", { name: /Tênis dos Sonhos/ }));
    const janela = await screen.findByTestId("nucleo-resource-window");
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Cabedal", "Sola", "Cadarço"]);
    expect(screen.queryByTestId("nucleo-briefing")).toBeNull();
    fireEvent.click(within(janela).getByRole("button", { name: "Branco" }));
    fireEvent.click(screen.getByRole("button", { name: "Entregar o look" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver o resultado" }));
    const result = await screen.findByTestId("nucleo-result");
    expect(corpo(calls, "/partidas")[0]).toEqual({ deck: [], rodada: "TENIS_DOS_SONHOS" });
    expect(result.textContent).toContain("CumpridaSola clara (branco ou prata)");
    expect(screen.getByTestId("nucleo-result-hints").textContent).toContain("Para cumprir: Uma zona refletiva (espelhada ou metálica).");
  });
});
