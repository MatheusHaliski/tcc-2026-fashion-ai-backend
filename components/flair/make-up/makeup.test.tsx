// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MakeUpCareer } from "@/components/flair/make-up/makeup-career";
import { MakeUpScreen } from "@/components/flair/make-up/makeup-screen";
import { FASHIONAI_PROVADOR, prestigioParaSair } from "@/lib/flair/make-up/briefs";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, within } from "@/test-utils/render";

/** FLAIR 3D MAKE UP: carreira e briefs, a tela do brief com Roupas e Maquiagem (cena 2D no jsdom) e a entrega com Prestígio. */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/make-up" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 2, BRONZE: 0 }, total: 2, cards: [card("c1", "Regata linho", "SUP"), card("c2", "Short praia", "INF")] };

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("regras locais", () => {
  it("Prestígio para sair do nível e o provador com logo e cores do FashionAI", () => {
    expect([1, 2, 3, 4, 5, 6].map(prestigioParaSair)).toEqual([60, 90, 120, 150, 180, Math.round(15 * Math.pow(6, 1.5))]);
    expect(FASHIONAI_PROVADOR.featured).toMatchObject({ logoUrl: "/brand/fai-logo.png", wall: "#FBE7EE", accent: "#C6275E", floor: "#1F7A76" });
  });
});

describe("carreira", () => {
  it("nível, Prestígio, progresso e briefs com cadeado e melhores estrelas", async () => {
    loggedAs(ME, {
      "GET /api/flair/make-up/carreira": { nivel: 1, prestigio: 20, faltaParaProximo: 40, desbloqueios: [] },
      "GET /api/flair/make-up/briefs": { briefs: [{ codigo: "ENSAIO_VERAO", nivelMin: 1, liberado: true, melhoresEstrelas: 2 }, { codigo: "PRIMEIRO_ENCONTRO", nivelMin: 2, liberado: false, melhoresEstrelas: 0 }] },
    });
    renderApp(<MakeUpCareer />);
    const carreira = await screen.findByTestId("makeup-career");
    expect(carreira.textContent).toContain("Nível 1");
    expect(carreira.textContent).toContain("Prestígio: 20");
    expect(within(carreira).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33");
    const briefs = await screen.findByTestId("makeup-briefs");
    await within(briefs).findByText("Primeiro Encontro");
    expect(within(briefs).getByRole("link", { name: /Ensaio de Verão/ }).getAttribute("href")).toBe("/flair/make-up/ensaio-verao");
    expect(within(briefs).getByLabelText("Melhor: 2 estrelas")).toBeTruthy();
    expect(within(briefs).queryByRole("link", { name: /Primeiro Encontro/ })).toBeNull();
    expect(briefs.textContent).toContain("Libera no nível 2");
  });
});

describe("brief", () => {
  it("Roupas e Maquiagem, comandos sem desfilar e entrega com Prestígio", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/flair/make-up/briefs/ENSAIO_VERAO": { codigo: "ENSAIO_VERAO", nivelMin: 1, regras: [{ codigo: "OCASIAO", pontos: 25 }, { codigo: "BATOM_CORAL", pontos: 25 }], vagas: ["SUP", "INF"], areas: ["LABIOS", "BOCHECHAS", "OLHOS"], paleta: { familias: { LABIOS: ["NUDE", "CORAL"], BOCHECHAS: ["ROSA"], OLHOS: ["PRETO"] }, acabamentos: ["FOSCO", "CETIM", "GLOSS"] } },
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/make-up/briefs/ENSAIO_VERAO/entrega": { pontos: 50, estrelas: 0, regras: [{ codigo: "OCASIAO", ok: true, pontos: 25 }, { codigo: "BATOM_CORAL", ok: true, pontos: 25 }], prestigioGanho: 0, carreira: { nivel: 1, prestigio: 20, faltaParaProximo: 40, desbloqueios: [] } },
    });
    renderApp(<MakeUpScreen brief="ensaio-verao" />);
    const game = await screen.findByTestId("makeup-game");
    expect(await screen.findByTestId("makeup-scene-fallback")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ensaio de Verão" })).toBeTruthy();
    const janela = screen.getByTestId("nucleo-resource-window");
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Parte de cima", "Parte de baixo"]);
    fireEvent.keyDown(window, { key: " " });
    expect(within(janela).getAllByRole("button", { pressed: true })).toHaveLength(1);
    fireEvent.click(within(game).getByRole("button", { name: "Maquiagem" }));
    expect(within(janela).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Lábios", "Bochechas", "Olhos"]);
    expect(within(janela).queryByRole("button", { name: "Vinho" })).toBeNull();
    expect(game.textContent).toContain("Cada tom maquia a área escolhida.");
    fireEvent.click(within(janela).getByRole("button", { name: "Coral" }));
    fireEvent.click(within(janela).getByRole("button", { name: "Gloss" }));
    expect(screen.queryByRole("button", { name: "Desfilar" })).toBeNull();
    expect(within(game).getByRole("button", { name: "Aproximar" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Enter" });
    const result = await screen.findByTestId("makeup-result");
    expect(result.textContent).toContain("50 pontos");
    expect(result.textContent).toContain("+0 de Prestígio");
    expect(result.textContent).toContain("Agora: nível 1, 20 de Prestígio");
    expect(result.textContent).toContain("Lábios na família coral");
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ cartas: { SUP: "c1" }, maquiagem: { LABIOS: { familia: "CORAL", acabamento: "GLOSS" } } });
  });

  it("abaixo do nível mínimo o servidor responde 403 e a tela mostra o cadeado", async () => {
    loggedAs(ME, {
      "GET /api/flair/make-up/briefs/PRIMEIRO_ENCONTRO": () => new Response(JSON.stringify({ status: 403, code: "NIVEL", message: "nível" }), { status: 403, headers: { "content-type": "application/json" } }),
      "GET /api/me/flair/cards": CARDS,
    });
    renderApp(<MakeUpScreen brief="primeiro-encontro" />);
    expect(await screen.findByText("Libera no nível 2")).toBeTruthy();
    expect(screen.queryByTestId("makeup-game")).toBeNull();
  });
});
