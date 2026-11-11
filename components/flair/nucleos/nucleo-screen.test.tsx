// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";
import { NucleoList } from "@/components/flair/nucleos/nucleo-list";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";

/**
 * Tela de um núcleo (layout DREST) com a API simulada: deck com efeitos e obrigatórias (núcleo de cartas), cena 2D de
 * reserva (jsdom não tem WebGL), janela de recursos com abas de cartas, zonas e maquiagem, objetivo, entrega e resultado.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/3d" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 4, BRONZE: 0 }, total: 4, cards: [card("c1", "Camisa verde", "SUP"), card("c2", "Calça linho", "INF"), card("c3", "Tênis azul", "CAL"), card("c4", "Bolsa palha", "ACE")] };
const def = (codigo: string, numero: number, over: Record<string, unknown> = {}) => ({ codigo, numero, objetivo: { codigo: "BASE", regras: [] }, recursos: [], vagas: [], zonas: [], areas: [], opcoes: [], acoes: [], ...over });
const RESULT = { pontos: 80, estrelas: 2, resultado: "PONTUADO", regras: [{ codigo: "MARCA_BR", ok: true, pontos: 30 }, { codigo: "TODAS_BR", ok: false, pontos: 0 }], eventos: ["DESFILE"] };

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("lista", () => {
  it("mostra os 15 núcleos com número, nome e recursos (do registro local quando a API falha)", async () => {
    loggedAs(ME, {});
    renderApp(<NucleoList />);
    const lista = await screen.findByTestId("nucleo-list");
    expect(within(lista).getAllByRole("link")).toHaveLength(15);
    expect(lista.textContent).toContain("Passarela");
    expect(within(lista).getByRole("link", { name: /Clube do Coração/ }).getAttribute("href")).toBe("/flair/3d/clube-coracao");
  });
});

describe("núcleo de cartas com deck (PASSARELA)", () => {
  it("deck: efeitos em selos, contador, obrigatórias, 422 com o que falta e, válido, entra na partida e entrega", async () => {
    let refuse = true;
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/PASSARELA": def("PASSARELA", 1, { recursos: ["CARTAS"], vagas: ["SUP", "INF", "CAL", "ACE"], deck: { tamanhoMax: 8, obrigatorias: [{ posicao: "SUP", quantidade: 1 }, { posicao: "INF", quantidade: 1 }, { posicao: "CAL", quantidade: 1 }], semDeck: false } }),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/PASSARELA/efeitos": { efeitos: [{ cardId: "c1", itens: [{ codigo: "MARCA_BR", valor: 10 }] }, { cardId: "c3", itens: [{ codigo: "DEFESA", valor: 12 }] }] },
      "POST /api/flair/3d/nucleos/PASSARELA/partidas": () => (refuse
        ? new Response(JSON.stringify({ status: 422, code: "DECK_INVALIDO", message: "deck incompleto", details: { faltando: ["CAL"] } }), { status: 422, headers: { "content-type": "application/json" } })
        : { id: "m1", nucleo: "PASSARELA", status: "ABERTA", semente: 7 }),
      "POST /api/flair/3d/partidas/m1/entrega": RESULT,
    });
    renderApp(<NucleoScreen nucleo="passarela" />);
    const deck = await screen.findByTestId("nucleo-deck");
    expect(await within(deck).findByText("+10 marca BR")).toBeTruthy();
    expect(within(deck).getByText("defesa +12")).toBeTruthy();
    const entrar = within(deck).getByRole("button", { name: "Entrar na partida" }) as HTMLButtonElement;
    expect(entrar.disabled).toBe(true);
    const cards = deck.querySelectorAll<HTMLButtonElement>(".n3d-deck-card");
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    expect(within(deck).getByRole("status").textContent).toBe("2 de 8 cartas no deck");
    expect(deck.querySelector(".n3d-checklist .is-miss")?.textContent).toContain("falta 1");
    expect(entrar.disabled).toBe(true);
    fireEvent.click(cards[2]);
    expect(entrar.disabled).toBe(false);
    fireEvent.click(entrar);
    expect((await within(deck).findByRole("alert")).textContent).toContain("deck incompleto");
    expect(within(deck).getByRole("alert").textContent).toContain("CAL");
    refuse = false;
    fireEvent.click(entrar);
    await screen.findByTestId("nucleo-game");
    expect(calls.find((c) => c.path.endsWith("/partidas") && c.method === "POST")?.body).toEqual({ deck: ["c1", "c2", "c3"] });
    expect(await screen.findByTestId("nucleo-scene-fallback")).toBeTruthy();
    const janela = screen.getByTestId("nucleo-resource-window");
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Parte de cima", "Parte de baixo", "Calçado", "Acessório"]);
    expect(within(janela).getAllByRole("button", { pressed: false })).toHaveLength(1);
    expect(screen.getByTestId("nucleo-objective").textContent).toContain("Tema \"Brasil\"");
    expect(screen.getByTestId("nucleo-cast").textContent).toContain("A modelo da casa");
    fireEvent.keyDown(window, { key: " " });
    expect(within(janela).getAllByRole("button", { pressed: true })).toHaveLength(1);
    fireEvent.keyDown(window, { key: "Enter" });
    const result = await screen.findByTestId("nucleo-result");
    expect(result.textContent).toContain("80 pontos");
    expect(within(result).getByLabelText("2 estrelas")).toBeTruthy();
    expect(result.textContent).toContain("Cumprida+10 por peça de marca brasileira");
    expect(result.textContent).toContain("Não cumprida");
    expect(calls.find((c) => c.path === "/api/flair/3d/partidas/m1/entrega")?.body).toEqual({ cartas: { SUP: "c1" }, zonas: {}, maquiagem: {}, resposta: null });
  });
});

describe("núcleo de zonas (CLUBE_CORACAO)", () => {
  it("sem deck: zonas com cores e acabamentos, cena 2D, objetivo e entrega (abre a partida na entrega)", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/CLUBE_CORACAO": { message: "fora do ar" },
      "POST /api/flair/3d/nucleos/CLUBE_CORACAO/partidas": { id: "m8", nucleo: "CLUBE_CORACAO", status: "ABERTA", semente: 3 },
      "POST /api/flair/3d/partidas/m8/entrega": { pontos: 100, estrelas: 3, resultado: "CONCLUIDO", regras: [{ codigo: "CORES_CLUBE", ok: true, pontos: 100 }], eventos: [] },
    });
    renderApp(<NucleoScreen nucleo="CLUBE_CORACAO" />);
    const janela = await screen.findByTestId("nucleo-resource-window");
    expect(screen.queryByTestId("nucleo-deck")).toBeNull();
    expect(await screen.findByTestId("nucleo-scene-fallback")).toBeTruthy();
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Corpo", "Mangas", "Gola", "Punhos"]);
    fireEvent.click(within(janela).getByRole("button", { name: "Azul" }));
    fireEvent.click(within(janela).getByRole("button", { name: "Brilhante" }));
    expect(screen.queryByRole("button", { name: "Tirar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entregar o look" }));
    expect((await screen.findByTestId("nucleo-result")).textContent).toContain("100 pontos");
    expect(calls.find((c) => c.path === "/api/flair/3d/partidas/m8/entrega")?.body).toMatchObject({ zonas: { CORPO: { cor: "#1E4FBF", acabamento: "BRILHANTE" } } });
    expect(calls.find((c) => c.path.endsWith("/partidas"))?.body).toEqual({ deck: [] });
  });
});

describe("núcleo de maquiagem (ROAD_TO_GLORY)", () => {
  it("cartas do guarda-roupa sem deck e abas de maquiagem com famílias e acabamentos; O abre o objetivo", async () => {
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/ROAD_TO_GLORY": def("ROAD_TO_GLORY", 5, { recursos: ["CARTAS", "MAQUIAGEM"], vagas: ["SUP", "INF"], areas: ["LABIOS", "OLHOS", "BOCHECHAS"], deck: { tamanhoMax: 0, obrigatorias: [], semDeck: true }, objetivo: { codigo: "ENSAIO_VERAO", regras: [{ codigo: "OCASIAO", pontos: 25 }] } }),
      "GET /api/me/flair/cards": CARDS,
    });
    renderApp(<NucleoScreen nucleo="road-to-glory" />);
    const janela = await screen.findByTestId("nucleo-resource-window");
    await settle();
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Parte de cima", "Parte de baixo", "Lábios", "Olhos", "Bochechas"]);
    fireEvent.click(within(janela).getByRole("tab", { name: "Lábios" }));
    expect(within(janela).getByRole("button", { name: "Coral" })).toBeTruthy();
    expect(within(janela).getByRole("button", { name: "Gloss" })).toBeTruthy();
    fireEvent.click(within(janela).getByRole("button", { name: "Coral" }));
    await waitFor(() => expect(within(janela).getByRole("button", { name: "Coral" }).getAttribute("aria-pressed")).toBe("true"));
    fireEvent.keyDown(window, { key: "o" });
    expect(screen.getByTestId("nucleo-objective").textContent).toContain("Ocasião casual ou praia");
    expect(screen.getByTestId("nucleo-objective").textContent).toContain("25 pts");
  });
});
