// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElencoCompleto } from "@/components/flair/elencos/elenco-completo";
import { ElencoList } from "@/components/flair/elencos/elenco-list";
import { ElencoScreen } from "@/components/flair/elencos/elenco-screen";
import { quebraCabecaDe } from "@/lib/flair/elencos/quebra-cabecas";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Elencos em quebra-cabeça: a lista com as imagens, as peças que encaixam conforme o /conferir simulado, a entrega
 * automática quando o deck inteiro encaixa e o modal "Parabéns, você completou!" com o vídeo (ou o logo se montando).
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/elencos" }));

const card = (id: string, name: string, cor: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position: "SUP", name, brandName: "Atelier Lumi", imageUrl: `/img/${id}.png`, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED", tags: { colors: [cor] } });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 5, BRONZE: 0 }, total: 5, cards: [card("r1", "Blusa", "red"), card("r2", "Saia", "crimson"), card("r3", "Bolsa", "red"), card("r4", "Tênis", "burgundy"), card("b1", "Jaqueta", "navy")] };
const VERMELHAS = new Set(["r1", "r2", "r3", "r4"]);

function conferir(_u: URL, init: RequestInit) {
  const cartas = (JSON.parse(String(init.body)) as { cartas: Record<string, string> }).cartas;
  const pecas = Object.fromEntries(["p1", "p2", "p3", "p4"].map((p) => [p, VERMELHAS.has(cartas[p])]));
  const completas = Object.values(pecas).filter(Boolean).length;
  const n = Object.keys(cartas).length;
  return { pecas, completas, total: 4, requisitos: [{ tipo: "COR", ok: completas === 4, valor: completas, alvo: 4 }, { tipo: "CARTAS", ok: n === 4, valor: n, alvo: 4 }], ok: completas === 4 };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("lista", () => {
  it("os elencos com a imagem, o número de peças e a edição dos concluídos", async () => {
    loggedAs(ME, { "GET /api/flair/elencos": { elencos: [{ codigo: "DESAFIO_FOGO", pecas: 4, concluido: true, edicao: 12 }, { codigo: "LOGO_CACOS", pecas: 12, concluido: false, edicao: null }] } });
    renderApp(<ElencoList />);
    const lista = await screen.findByTestId("elenco-list");
    await within(lista).findByText("Concluído · edição 12");
    const cacos = within(lista).getByRole("link", { name: /Logo FAI em cacos de vidro/ });
    expect(cacos.getAttribute("href")).toBe("/flair/elencos/logo-cacos");
    expect(cacos.textContent).toContain("12 peças");
    expect(cacos.querySelector("img")?.getAttribute("src")).toBe("/flair/elencos/logo-cacos.webp");
  });
});

const ROTAS = {
  "GET /api/me/flair/cards": CARDS,
  "POST /api/flair/elencos/DESAFIO_FOGO/conferir": conferir,
  "POST /api/flair/elencos/DESAFIO_FOGO/entrega": (u: URL, i: RequestInit) => ({ ...conferir(u, i), edicao: 3 }),
};
const pecas = () => Array.from(screen.getByTestId("elenco-pecas").querySelectorAll("li")).map((p) => p.getAttribute("data-state"));
const carta = (nome: string) => within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: new RegExp(`^Pôr ${nome}`) });

describe("um elenco", () => {
  it("a carta que cumpre o pedido encaixa a peça; o deck completo entrega sozinho e abre o modal com o vídeo", async () => {
    const { calls } = loggedAs(ME, ROTAS);
    renderApp(<ElencoScreen elenco="desafio-fogo" />);
    const vagas = await screen.findByTestId("elenco-vagas");
    expect(pecas()).toEqual(["vazia", "vazia", "vazia", "vazia"]);
    expect(within(vagas).getAllByRole("button")[0].getAttribute("aria-label")).toBe("Peça 1, pede carta vermelha: vaga vazia, vazia");
    // a bandeja abre na peça 1 com as cartas que combinam (vermelhas) na frente; a azul vai para o fim
    const opcoes = within(screen.getByTestId("mesa-bandeja")).getAllByRole("button", { name: /^Pôr/ });
    expect(opcoes.at(-1)?.getAttribute("aria-label")).toMatch(/^Pôr Jaqueta/);
    fireEvent.click(carta("Jaqueta"));
    await waitFor(() => expect(pecas()[0]).toBe("fora"));
    expect(screen.getByTestId("elenco-requirements").textContent).toContain("Todas as peças vermelhas (agora 0 de 4)");
    // troca a azul por uma vermelha: a peça encaixa
    fireEvent.click(within(vagas).getAllByRole("button")[0]);
    fireEvent.click(carta("Blusa"));
    await waitFor(() => expect(pecas()[0]).toBe("encaixada"));
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByTestId("elenco-puzzle").querySelector("svg")?.getAttribute("aria-label")).toBe("Quebra-cabeça Desafio do Fogo: 1 de 4 peças encaixadas");
    fireEvent.click(carta("Saia"));
    fireEvent.click(carta("Bolsa"));
    fireEvent.click(carta("Tênis"));
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText("Parabéns, você completou!")).toBeTruthy();
    expect(modal.textContent).toContain("Você completou Desafio do Fogo. A imagem é sua, edição nº 3.");
    const video = within(modal).getByTestId("elenco-video") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/flair/elencos/cenas-firefly.mp4");
    expect(video.muted).toBe(true);
    expect([video.autoplay, video.loop, video.controls, video.hasAttribute("playsinline")]).toEqual([true, true, true, true]);
    expect(pecas()).toEqual(["encaixada", "encaixada", "encaixada", "encaixada"]);
    expect(screen.getByTestId("elenco-puzzle").className).toContain("is-complete");
    expect(calls.filter((c) => c.path.endsWith("/entrega"))).toHaveLength(1);
    // fechar o modal deixa a imagem completa e um botão para ver a conclusão de novo
    fireEvent.click(within(modal).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Ver a conclusão" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("os logos sem vídeo próprio mostram o quebra-cabeça se montando no modal", () => {
    loggedAs(ME, {});
    renderApp(<ElencoCompleto qc={quebraCabecaDe("LOGO_SETORES")!} nome="Logo FAI em 12 setores" edicao={1} aberto onFechar={() => {}} />);
    const montagem = screen.getByTestId("elenco-montagem");
    expect(montagem.className).toContain("is-assembling");
    expect(montagem.querySelectorAll("clipPath")).toHaveLength(12);
    expect(screen.queryByTestId("elenco-video")).toBeNull();
  });
});
