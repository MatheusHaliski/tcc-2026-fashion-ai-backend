// @vitest-environment jsdom
/**
 * MET Gala Heist: as cartas do deck mudam o avatar e o salão. Antes de começar, a tela mostra o que o deck escolhido
 * muda (vantagens, desvantagens e neutros); durante a partida, só o que muda alguma coisa, e a contagem da rota VIP.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { AfterpartyAdventure } from "@/components/flair/afterparty-adventure";
import { NEUTRAL_MODS, modEffects, vipRouteLeft, type AdventureMods, type AdventureSession } from "@/lib/flair/afterparty";

vi.mock("next/dynamic", () => ({ default: () => function SceneStub() { return <div data-testid="scene" />; } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const STEALTH: AdventureMods = { agility: 78, stealth: 86, charm: 40, stamina: 72, speedMul: 1.16, suspicionMul: 0.78, distractMul: 1.08, regenMul: 1.28, light: "PENUMBRA", zoneMul: 0.82, crowd: 0, guests: 2, vipRouteMs: 0 };
const GALA: AdventureMods = { agility: 30, stealth: 18, charm: 92, stamina: 40, speedMul: 0.97, suspicionMul: 1.19, distractMul: 1.44, regenMul: 1.02, light: "HOLOFOTES", zoneMul: 1.15, crowd: 0.67, guests: 6, vipRouteMs: 8000 };
const deck = (id: string, title: string) => ({ schemeId: id, title, cards: [{ id: `${id}-c` }] });
const points = { balance: 950, lifetime: 950, level: "LOFT", levels: [], rules: [], nextLevel: null };

describe("vantagens do deck (lib)", () => {
  it("sinais: velocidade e energia a mais são vantagem; suspeita a mais é desvantagem; penumbra, convidados e rota VIP ajudam", () => {
    const s = Object.fromEntries(modEffects(STEALTH).map((e) => [e.key, e.tone]));
    expect(s).toEqual({ agility: "plus", stealth: "plus", charm: "plus", stamina: "plus", light: "plus", crowd: "neutral", vip: "neutral" });
    const g = Object.fromEntries(modEffects(GALA).map((e) => [e.key, e.tone]));
    expect(g).toMatchObject({ agility: "minus", stealth: "minus", charm: "plus", light: "minus", crowd: "plus", vip: "plus" });
    expect(modEffects(NEUTRAL_MODS).every((e) => e.tone === "neutral")).toBe(true);
  });
  it("rota VIP: conta os segundos que faltam desde o começo da partida", () => {
    const session = { id: "s", serverTime: 13_000, state: { startedAt: 10_000, mods: GALA } } as unknown as AdventureSession;
    expect(vipRouteLeft(session)).toBe(5);
    expect(vipRouteLeft({ ...session, serverTime: 19_000 })).toBe(0);
  });
});

describe("tela do Heist", () => {
  it("escolher os looks mostra o que o deck muda, calculado pelo servidor", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/me/points": points, "GET /api/flair/adventure/active": null,
      "GET /api/flair/decks": [deck("d1", "Look preto"), deck("d2", "Gala dourada")],
      "POST /api/flair/adventure/preview": (_u: URL, init: RequestInit) => ({ mods: JSON.parse(String(init.body)).deckIds.includes("d2") ? GALA : STEALTH }),
    });
    renderApp(<AfterpartyAdventure />);
    const panel = await screen.findByRole("region", { name: "O que o seu deck muda" });
    await waitFor(() => expect(within(panel).getByText("−3 % de velocidade")).toBeTruthy());
    expect(within(panel).getByText("Holofotes: os seguranças enxergam mais")).toBeTruthy();
    expect(within(panel).getByText("Cordão VIP aberto nos primeiros 8 s")).toBeTruthy();
    expect(within(panel).getByText("6 convidados: a suspeita cai mais rápido fora da vista")).toBeTruthy();
    expect(within(panel).getByText("+19 % de suspeita")).toBeTruthy();
    // tirar o look de gala: o deck preto deixa o salão na penumbra e o avatar furtivo
    fireEvent.click(screen.getByRole("checkbox", { name: /Gala dourada/ }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "O que o seu deck muda" })).getByText("Penumbra: os seguranças enxergam menos")).toBeTruthy());
    expect(screen.getByText("−22 % de suspeita")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/flair/adventure/preview").at(-1)!.body).toEqual({ deckIds: ["d1"] });
  });

  it("durante a partida: só o que muda alguma coisa, e a rota VIP aberta no objetivo", async () => {
    const session: AdventureSession = { id: "s1", serverTime: 12_000, state: {
      x: 0, z: 5, energy: 100, suspicion: 0, status: "ACTIVE", phase: "ACQUIRE", activeDeckId: null, role: "NONE", color: "#333", feedback: "STARTED",
      badge: false, item: false, running: false, activeUntil: 0, distractionUntilLeft: 0, distractionUntilRight: 0, distractionReadyAt: 0, cooldowns: {}, loadouts: [],
      startedAt: 10_000, mods: GALA } };
    loggedAs(undefined, { "GET /api/me/points": points, "GET /api/flair/decks": [], "GET /api/flair/adventure/active": session, "GET /api/flair/adventure/sessions/s1": session });
    renderApp(<AfterpartyAdventure />);
    expect(await screen.findByText("Rota VIP aberta: 6 s")).toBeTruthy();
    const hud = screen.getByRole("region", { name: "O que o seu deck muda" });
    expect(within(hud).queryByText(/Fôlego/)).toBeNull();                               // neutro: fica de fora
    expect(within(hud).getByText("Carisma")).toBeTruthy();
  });
});
