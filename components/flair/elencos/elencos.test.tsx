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

describe("um elenco", () => {
  it("linhas na cor do /conferir, peças do quebra-cabeça por estado, gaveta por posição e entrega com a edição", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/elencos/PRIMEIRO_ELENCO/conferir": conferir,
      "POST /api/flair/elencos/PRIMEIRO_ELENCO/entrega": (u: URL, i: RequestInit) => ({ ...conferir(u, i), edicao: 7 }),
    });
    renderApp(<ElencoScreen elenco="primeiro-elenco" />);
    const board = await screen.findByTestId("elenco-board");
    const pecas = () => Array.from(screen.getByTestId("elenco-jigsaw").querySelectorAll(".el-piece")).map((p) => p.getAttribute("data-state"));
    expect(pecas()).toEqual(["coberta", "coberta", "coberta", "coberta", "coberta"]);
    // teclado: Espaço abre a gaveta da vaga (acessório: só cartas ACE) e põe a carta em foco
    fireEvent.keyDown(window, { key: " " });
    const gaveta = screen.getByTestId("elenco-drawer");
    expect(within(gaveta).getAllByRole("button", { name: /^Pôr/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["Pôr Brinco", "Pôr Bolsa"]);
    fireEvent.keyDown(window, { key: " " });
    expect(screen.queryByTestId("elenco-drawer")).toBeNull();
    const por = (slot: string, nome: string) => {
      fireEvent.click(board.querySelector(`[data-slot=${slot}]`)!);
      fireEvent.click(within(screen.getByTestId("elenco-drawer")).getByRole("button", { name: `Pôr ${nome}` }));
    };
    por("cima", "Camisa");
    por("bolsa", "Bolsa");
    por("baixo", "Saia");
    const nivel = (a: string, b: string) => board.querySelector(`[data-link="${a}-${b}"]`)?.getAttribute("data-level");
    await waitFor(() => expect(nivel("cima", "baixo")).toBe("RED"));
    expect(nivel("acessorio", "cima")).toBe("GREEN");
    expect(nivel("cima", "bolsa")).toBe("ORANGE");
    expect(nivel("bolsa", "baixo")).toBe("GREEN");
    expect(nivel("baixo", "calcado")).toBe("NONE");
    expect(board.querySelector(".el-line.is-red")).toBeTruthy();
    expect(within(board).getByLabelText("Linha acessorio–cima: marca, cor")).toBeTruthy();
    expect(pecas()).toEqual(["verde", "laranja", "vermelha", "verde", "coberta"]);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("20");
    expect(screen.getByTestId("elenco-requirements").textContent).toContain("Química 40 ou mais (agora 20)");
    const entregar = screen.getByRole("button", { name: "Entregar o elenco" }) as HTMLButtonElement;
    expect(entregar.disabled).toBe(true);
    // Backspace tira a carta da vaga selecionada (a saia, posta por último): as linhas dela voltam a ficar cobertas
    fireEvent.keyDown(window, { key: "Backspace" });
    await waitFor(() => expect(pecas()).toEqual(["verde", "laranja", "coberta", "coberta", "coberta"]));
    por("baixo", "Saia");
    por("calcado", "Sapato");
    await waitFor(() => expect(entregar.disabled).toBe(false));
    fireEvent.keyDown(window, { key: "Enter" });
    const reveal = await screen.findByTestId("elenco-reveal");
    expect(pecas().every((p) => p === "verde")).toBe(true);
    expect(within(reveal).getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["Brinco", "Camisa", "Bolsa", "Saia", "Sapato"]);
    expect(screen.getByTestId("elenco-jigsaw").textContent).toContain("edição 7");
    // reauditoria: a entrega diz que deu certo e o que foi ganho (antes só a etiqueta "edição" e o botão desligado)
    const entregue = screen.getByTestId("elenco-delivered");
    expect(entregue.getAttribute("role")).toBe("status");
    expect(entregue.textContent).toContain("Elenco entregue!");
    expect(entregue.textContent).toContain("Você ganhou a imagem exclusiva de Primeiro Elenco, edição nº 7.");
    expect(within(entregue).getByRole("link", { name: "Ver os outros elencos" }).getAttribute("href")).toBe("/flair/elencos");
    expect(calls.filter((c) => c.path.endsWith("/entrega"))[0].body).toEqual({ cartas: { acessorio: "a1", cima: "s1", bolsa: "b1", baixo: "i1", calcado: "c1" } });
  });
});
