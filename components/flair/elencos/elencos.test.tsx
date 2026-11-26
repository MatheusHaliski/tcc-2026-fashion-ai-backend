// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElencoList } from "@/components/flair/elencos/elenco-list";
import { ElencoScreen } from "@/components/flair/elencos/elenco-screen";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Elencos do Card Building Challenge: a lista, o tabuleiro com as linhas na cor do /conferir simulado, o quebra-cabeça
 * por estado de peça e a entrega com a revelação e a edição.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/elencos" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: `/img/${id}.png`, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 5, BRONZE: 0 }, total: 5, cards: [card("a1", "Brinco", "ACE"), card("s1", "Camisa", "SUP"), card("b1", "Bolsa", "ACE"), card("i1", "Saia", "INF"), card("c1", "Sapato", "CAL")] };
const link = (a: string, b: string, nivel: string, atributos: string[] = []) => ({ a, b, forca: nivel === "VERDE" ? 2 : nivel === "LARANJA" ? 1 : 0, nivel, atributos });
function conferir(_u: URL, init: RequestInit) {
  const cartas = (JSON.parse(String(init.body)) as { cartas: Record<string, string> }).cartas;
  const has = (...k: string[]) => k.every((x) => cartas[x]);
  const links = [
    ...(has("acessorio", "cima") ? [link("acessorio", "cima", "VERDE", ["MARCA", "COR"])] : []),
    ...(has("cima", "bolsa") ? [link("cima", "bolsa", "LARANJA", ["ESTILO"])] : []),
    ...(has("cima", "baixo") ? [link("cima", "baixo", "VERMELHA")] : []),
    ...(has("bolsa", "baixo") ? [link("bolsa", "baixo", "VERDE", ["OCASIAO"])] : []),
    ...(has("baixo", "calcado") ? [link("baixo", "calcado", "VERDE", ["MARCA"])] : []),
  ];
  const full = Object.keys(cartas).length === 5;
  return { links, quimicaCartas: { cima: 2, acessorio: 1 }, quimica: full ? 60 : 20, requisitos: [{ tipo: "QUIMICA", ok: full, valor: full ? 60 : 20, alvo: 40 }, { tipo: "LINHAS_VERDES", ok: full, valor: full ? 3 : 1, alvo: 2 }], ok: full };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("lista", () => {
  it("os cinco elencos com vagas, linhas e a edição dos concluídos", async () => {
    loggedAs(ME, { "GET /api/flair/elencos": { elencos: [{ codigo: "PRIMEIRO_ELENCO", vagas: 5, linhas: 5, concluido: true, edicao: 12 }, { codigo: "PALETA_ATELIE", vagas: 7, linhas: 9, concluido: false, edicao: null }] } });
    renderApp(<ElencoList />);
    const lista = await screen.findByTestId("elenco-list");
    await within(lista).findByText("Concluído · edição 12");
    expect(within(lista).getByRole("link", { name: /Paleta do Ateliê/ }).getAttribute("href")).toBe("/flair/elencos/paleta-atelie");
    expect(lista.textContent).toContain("A montar");
  });
});

/** Arrasta com o ponteiro do elemento de origem até o de destino (o jsdom não tem elementFromPoint). */
function arrastar(origem: Element, destino: Element) {
  const doc = document as unknown as { elementFromPoint?: (x: number, y: number) => Element | null };
  doc.elementFromPoint = () => destino;
  fireEvent(origem, new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, button: 0 }));
  fireEvent(window, new MouseEvent("pointermove", { bubbles: true, clientX: 60, clientY: 80 }));
  fireEvent(window, new MouseEvent("pointerup", { bubbles: true, clientX: 60, clientY: 80 }));
  delete doc.elementFromPoint;
}

const ROTAS = {
  "GET /api/me/flair/cards": CARDS,
  "POST /api/flair/elencos/PRIMEIRO_ELENCO/conferir": conferir,
  "POST /api/flair/elencos/PRIMEIRO_ELENCO/entrega": (u: URL, i: RequestInit) => ({ ...conferir(u, i), edicao: 7 }),
};
const pecas = () => Array.from(screen.getByTestId("elenco-jigsaw").querySelectorAll(".el-piece")).map((p) => p.getAttribute("data-state"));
const vaga = (slot: string) => screen.getByTestId("elenco-board").querySelector(`[data-slot=${slot}]`) as HTMLElement;
const naVaga = (slot: string) => vaga(slot).querySelector(".el-slot-name")?.textContent;
const carta = (nome: string) => within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: new RegExp(`^Pôr ${nome}`) });

describe("um elenco", () => {
  it("um toque põe a carta na vaga em destaque; linhas na cor do /conferir, peças por estado e entrega com a edição", async () => {
    const { calls } = loggedAs(ME, ROTAS);
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    const board = await screen.findByTestId("elenco-board");
    expect(pecas()).toEqual(["coberta", "coberta", "coberta", "coberta", "coberta"]);
    // a bandeja já está aberta na primeira vaga vazia (acessório): as cartas que cabem na frente, as outras apagadas com o motivo
    const bandeja = screen.getByTestId("mesa-bandeja");
    expect(vaga("acessorio").getAttribute("aria-current")).toBe("true");
    const opcoes = within(bandeja).getAllByRole("button", { name: /^Pôr/ });
    expect(opcoes.slice(0, 2).map((b) => b.getAttribute("aria-label"))).toEqual(["Pôr Bolsa · 70 · Acessório", "Pôr Brinco · 70 · Acessório"]);
    expect(carta("Sapato").getAttribute("aria-disabled")).toBe("true");
    expect(carta("Sapato").getAttribute("aria-label")).toContain("É Calçado; a vaga pede Acessório");
    fireEvent.click(carta("Sapato"));
    expect(naVaga("acessorio")).toBe("vaga vazia");
    // um toque: a carta entra e o destaque passa para a próxima vaga vazia
    fireEvent.click(carta("Brinco"));
    expect(naVaga("acessorio")).toBe("Brinco");
    expect(vaga("cima").getAttribute("aria-current")).toBe("true");
    fireEvent.click(carta("Camisa"));
    fireEvent.click(carta("Bolsa"));
    // as duas cartas de uma linha estão postas e o servidor ainda não respondeu: a peça chega, sem cor de nível
    expect(pecas().slice(0, 2)).toEqual(["chegando", "chegando"]);
    expect(board.querySelector('[data-link="cima-bolsa"]')?.getAttribute("data-level")).toBe("PENDING");
    fireEvent.click(carta("Saia"));
    const nivel = (a: string, b: string) => board.querySelector(`[data-link="${a}-${b}"]`)?.getAttribute("data-level");
    await waitFor(() => expect(nivel("cima", "baixo")).toBe("RED"));
    expect(nivel("acessorio", "cima")).toBe("GREEN");
    expect(nivel("cima", "bolsa")).toBe("ORANGE");
    expect(nivel("bolsa", "baixo")).toBe("GREEN");
    expect(nivel("baixo", "calcado")).toBe("NONE");
    expect(within(board).getByLabelText("Linha acessorio–cima: marca, cor")).toBeTruthy();
    expect(pecas()).toEqual(["verde", "laranja", "vermelha", "verde", "coberta"]);
    const rotulo = screen.getByTestId("elenco-jigsaw").querySelector("canvas")?.getAttribute("aria-label");
    expect(rotulo).toContain("Quebra-cabeça de 5 peças: 2 encaixadas, 1 quase no lugar, 1 soltas e 1 faltando.");
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("20");
    expect(screen.getByTestId("elenco-requirements").textContent).toContain("Química 40 ou mais (agora 20)");
    const entregar = screen.getByRole("button", { name: "Entregar o elenco" }) as HTMLButtonElement;
    expect(entregar.disabled).toBe(true);
    // tirar é um gesto: a vaga e o botão Tirar da bandeja; as linhas dela voltam a ficar cobertas
    fireEvent.click(vaga("baixo"));
    fireEvent.click(within(bandeja).getByRole("button", { name: "Tirar" }));
    await waitFor(() => expect(pecas()).toEqual(["verde", "laranja", "coberta", "coberta", "coberta"]));
    fireEvent.click(carta("Saia"));
    fireEvent.click(carta("Sapato"));
    await waitFor(() => expect(entregar.disabled).toBe(false));
    fireEvent.keyDown(window, { key: "Enter" });
    const reveal = await screen.findByTestId("elenco-reveal");
    expect(pecas().every((p) => p === "verde")).toBe(true);
    expect(screen.queryByTestId("mesa-bandeja")).toBeNull();
    expect(within(reveal).getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["Brinco", "Camisa", "Bolsa", "Saia", "Sapato"]);
    expect(screen.getByTestId("elenco-jigsaw").textContent).toContain("edição 7");
    const entregue = screen.getByTestId("elenco-delivered");
    expect(entregue.getAttribute("role")).toBe("status");
    expect(entregue.textContent).toContain("Elenco entregue!");
    expect(entregue.textContent).toContain("Você ganhou a imagem exclusiva de Primeiro Elenco, edição nº 7.");
    expect(within(entregue).getByRole("link", { name: "Ver os outros elencos" }).getAttribute("href")).toBe("/flair/elencos");
    expect(calls.filter((c) => c.path.endsWith("/entrega"))[0].body).toEqual({ cartas: { acessorio: "a1", cima: "s1", bolsa: "b1", baixo: "i1", calcado: "c1" } });
    // entregue, a montagem guardada não volta na próxima visita
    expect(localStorage.getItem("fai.flair.montagem.elenco.PRIMEIRO_ELENCO")).toBeNull();
  });

  it("arrastar: da bandeja para qualquer vaga, de vaga para vaga (troca), para a bandeja (tira) e a vaga errada recusa", async () => {
    loggedAs(ME, ROTAS);
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    await screen.findByTestId("elenco-board");
    // da bandeja direto para a vaga do calçado, sem tocar na vaga antes
    arrastar(carta("Sapato"), vaga("calcado"));
    expect(naVaga("calcado")).toBe("Sapato");
    arrastar(carta("Brinco"), vaga("acessorio"));
    arrastar(carta("Bolsa"), vaga("bolsa"));
    expect([naVaga("acessorio"), naVaga("bolsa")]).toEqual(["Brinco", "Bolsa"]);
    // de vaga para vaga: as duas cartas trocam de lugar
    arrastar(vaga("acessorio"), vaga("bolsa"));
    expect([naVaga("acessorio"), naVaga("bolsa")]).toEqual(["Bolsa", "Brinco"]);
    // vaga de outra posição: recusa e diz por quê
    arrastar(vaga("calcado"), vaga("cima"));
    expect(naVaga("cima")).toBe("vaga vazia");
    expect(within(screen.getByTestId("mesa-bandeja")).getByRole("status").textContent).toBe("Sapato é Calçado; esta vaga pede Parte de cima.");
    // de uma vaga para a bandeja: tira
    arrastar(vaga("calcado"), screen.getByTestId("mesa-bandeja"));
    expect(naVaga("calcado")).toBe("vaga vazia");
    // um toque sem arrasto não põe nada por conta própria (o clique é que põe)
    fireEvent(vaga("acessorio"), new MouseEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5, button: 0 }));
    fireEvent(window, new MouseEvent("pointerup", { bubbles: true, clientX: 5, clientY: 5 }));
    expect([naVaga("acessorio"), naVaga("bolsa")]).toEqual(["Bolsa", "Brinco"]);
    // o clique que o navegador dispara logo depois de soltar é engolido por um instante: espera passar
    await new Promise((r) => setTimeout(r, 80));
  });

  it("desfazer volta a última jogada (botão e tecla Z) e a montagem fica guardada entre visitas", async () => {
    loggedAs(ME, ROTAS);
    const tela = renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    await screen.findByTestId("elenco-board");
    const desfazer = () => within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: "Desfazer" }) as HTMLButtonElement;
    expect(desfazer().disabled).toBe(true);
    fireEvent.click(carta("Brinco"));
    fireEvent.click(carta("Camisa"));
    fireEvent.click(desfazer());
    expect([naVaga("acessorio"), naVaga("cima")]).toEqual(["Brinco", "vaga vazia"]);
    fireEvent.keyDown(window, { key: "z" });
    expect(naVaga("acessorio")).toBe("vaga vazia");
    expect(desfazer().disabled).toBe(true);
    fireEvent.click(vaga("acessorio"));
    fireEvent.click(carta("Brinco"));
    fireEvent.click(carta("Camisa"));
    expect(JSON.parse(localStorage.getItem("fai.flair.montagem.elenco.PRIMEIRO_ELENCO") ?? "{}")).toEqual({ acessorio: "a1", cima: "s1" });
    // sai e volta: as cartas estão onde ficaram, e o destaque vai para a primeira vaga vazia
    tela.unmount();
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    await screen.findByTestId("elenco-board");
    await waitFor(() => expect([naVaga("acessorio"), naVaga("cima")]).toEqual(["Brinco", "Camisa"]));
    expect(vaga("bolsa").getAttribute("aria-current")).toBe("true");
    await waitFor(() => expect(pecas()[0]).toBe("verde"));
  });

  it("teclado e controle: setas escolhem a vaga, Espaço entra na bandeja e põe, Backspace sai ou tira", async () => {
    loggedAs(ME, ROTAS);
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    await screen.findByTestId("elenco-board");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(vaga("cima").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: " " });
    expect(carta("Camisa").className).toContain("is-focus");
    fireEvent.keyDown(window, { key: " " });
    expect(naVaga("cima")).toBe("Camisa");
    // o foco continua na bandeja, já na vaga seguinte (bolsa): Espaço de novo põe a primeira carta que cabe
    expect(vaga("bolsa").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: " " });
    expect(naVaga("bolsa")).toBe("Bolsa");
    // Backspace sai da bandeja; na vaga, tira a carta
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.click(vaga("bolsa"));
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(naVaga("bolsa")).toBe("vaga vazia");
  });

  it("o elenco em montagem volta ao reabrir (também o rascunho antigo), a vaga escolhida fica à vista e a legenda explica cores e letras", async () => {
    const rolar = vi.fn();
    window.scrollBy = rolar as unknown as typeof window.scrollBy;
    localStorage.setItem("fai:cbc:rascunho:PRIMEIRO_ELENCO", JSON.stringify({ bolsa: "b1" }));
    loggedAs(ME, { "GET /api/me/flair/cards": CARDS, "POST /api/flair/elencos/PRIMEIRO_ELENCO/conferir": conferir });
    const first = renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    const board = await screen.findByTestId("elenco-board");
    // o rascunho do formato anterior entra na mesa e é apagado
    await waitFor(() => expect(board.querySelector("[data-slot=bolsa]")?.textContent).toContain("Bolsa"));
    expect(localStorage.getItem("fai:cbc:rascunho:PRIMEIRO_ELENCO")).toBeNull();
    // a vaga escolhida que ficaria atrás da bandeja: a página rola até ela
    const caixa = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute("data-testid") === "mesa-bandeja") return caixa(600, 780);
      return this.getAttribute("data-slot") === "cima" ? caixa(640, 700) : caixa(100, 160);
    };
    fireEvent.click(board.querySelector<HTMLElement>("[data-slot=cima]")!);
    Element.prototype.getBoundingClientRect = original;
    expect(rolar).toHaveBeenCalled();
    fireEvent.click(within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: /^Pôr Camisa/ }));
    expect(screen.getByText(/verde: 2 ou mais coisas em comum/)).toBeTruthy();
    expect(screen.getByText(/E = estilo/)).toBeTruthy();
    first.unmount();
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    const again = await screen.findByTestId("elenco-board");
    await waitFor(() => expect(again.querySelector("[data-slot=cima]")?.textContent).toContain("Camisa"));
    expect(again.querySelector("[data-slot=bolsa]")?.textContent).toContain("Bolsa");
  });

});
