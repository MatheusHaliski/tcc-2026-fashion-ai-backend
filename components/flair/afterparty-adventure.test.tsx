// @vitest-environment jsdom
/**
 * "Como jogar" do FLAIR Roubo ao Afterparty: cada papel (Equipe de serviço, Convidado, VIP, VIP do evento) mostra as
 * cartas do deck da partida que dão esse papel, com o atalho (1–7), a raridade e o custo; o papel em uso aparece marcado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, within } from "@/test-utils/render";
import { AfterpartyAdventure } from "@/components/flair/afterparty-adventure";
import type { AdventureSession } from "@/lib/flair/afterparty";

vi.mock("next/dynamic", () => ({ default: () => function SceneStub() { return <div data-testid="scene" />; } }));
afterEach(() => cleanup());

const card = (id: string, title: string, tier: string, role: string) => ({ id, title, tier, role, color: "#333", techwear: false, imageUrl: null, cost: 20, cooldownMs: 0 });
const SESSION: AdventureSession = { id: "s1", serverTime: 1000, state: {
  x: 0, z: 0, energy: 100, suspicion: 0, status: "ACTIVE", phase: "ACQUIRE", activeDeckId: "d2", role: "GUEST", color: "#333", feedback: "STARTED",
  badge: false, item: false, running: false, activeUntil: 0, distractionUntilLeft: 0, distractionUntilRight: 0, distractionReadyAt: 0, cooldowns: {},
  loadouts: [card("d1", "Look de trabalho", "COMMON", "STAFF"), card("d2", "Jantar", "RARE", "GUEST"), card("d3", "Gala", "LEGENDARY", "VIP")] as AdventureSession["state"]["loadouts"],
} };
const routes = {
  "GET /api/me/points": { balance: 950, lifetime: 950, level: "LOFT", levels: [], rules: [], nextLevel: null },
  "GET /api/flair/decks": [],
  "GET /api/flair/adventure/active": SESSION,
  "GET /api/flair/adventure/sessions/s1": SESSION,
};

describe("FLAIR Afterparty — Como jogar ligado ao deck", () => {
  it("lista, em cada papel, as cartas do deck com atalho, raridade e custo; marca o papel atual", async () => {
    loggedAs(undefined, routes);
    renderApp(<AfterpartyAdventure />);
    await screen.findByRole("group", { name: "Deck de looks FLAIR" });     // a partida em andamento já carregou
    fireEvent.click(screen.getByRole("button", { name: "Como jogar" }));
    const dialog = await screen.findByRole("dialog");
    const staff = within(dialog).getByRole("list", { name: "Cartas do seu deck que dão o papel Equipe de serviço" });
    expect(within(staff).getByText("Look de trabalho")).toBeTruthy();
    expect(within(staff).getByText("1")).toBeTruthy();
    const guest = within(dialog).getByRole("list", { name: "Cartas do seu deck que dão o papel Convidado" });
    expect(within(guest).getByText("Jantar")).toBeTruthy();
    expect(within(guest).getByText("2")).toBeTruthy();
    expect(within(dialog).getByText(/seu papel agora/)).toBeTruthy();
    // nenhum drop do evento no deck: o papel diz isso, em vez de uma lista vazia
    expect(within(dialog).getByText("Nenhuma carta do seu deck dá este papel.")).toBeTruthy();
  });
});
