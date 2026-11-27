// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlairModes } from "./modes";
import type { ModeLook } from "./modes-shared";
import { nav } from "@/test-utils/setup";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Partidas FLAIR refatoradas: o adversário vem da busca na rede FAI (nunca digitando o @), a leitura tática sugere looks,
 * a mão mostra as cartas de roupa com o efeito no cenário, o resultado abre a arena (palco + MVP + convite à rede) e
 * quem chega por convite (?rival=) já encontra o rival escolhido.
 */
beforeEach(() => { nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const THEME = { code: "GALA", label: "Gala", emoji: "🎭", occasions: [], styles: [], weights: { STYLE: 2, HYPE: 1 }, hint: "Noite de gala" };
const look = (id: string, title: string, style: number): ModeLook => ({
  schemeId: id, title, owner: "ana", rating: 70, stats: { STYLE: style, HYPE: 50 }, synergies: [], styles: [], occasions: [],
  cards: [{ id: `${id}-c`, name: `Blazer ${title}`, imageUrl: "/x.png", category: "upper_piece", rarity: "RARE", power: 60 }, { id: `${id}-s`, name: `Tênis ${title}`, imageUrl: "/y.png", category: "shoes_piece", rarity: "STANDARD", power: 40 }],
});
const LOOKS = [look("s1", "Look Alfa", 40), look("s2", "Look Beta", 95)];
const person = (u: string, relation = "NENHUMA") => ({ ...ME.user, id: `u-${u}`, username: u, displayName: u.toUpperCase(), relation, counters: { schemes: 3 } });
const MODES = ["BATTLE", "WARDROBE", "TAG_TEAM", "CHESS"].map((code) => ({ code, name: `Modo ${code}`, emoji: "🎮", group: "NUCLEO", summary: `resumo ${code}`, how: `como ${code}` }));
const CATALOG = { architecture: [], modes: MODES, themes: [THEME], board: [], territories: [], chessBoard: [], roles: [], ethics: "Ética.", divisions: [], bosses: [] };
const RESULT = {
  matchId: "m1", mode: "BATTLE", outcome: "WIN", coins: 20, rewardCapReached: false, scoreA: 2, scoreB: 1, theme: THEME, opponent: { label: "@bia" },
  rounds: [{ label: "Estilo", a: "Look Beta", b: "Rival", scoreA: 90, scoreB: 60, winner: "A", notes: [], breakdown: [] }, { label: "Cor", a: "Look Beta", b: "Rival", scoreA: 50, scoreB: 70, winner: "B", notes: [], breakdown: [] }],
};

function base(extra: Record<string, unknown> = {}) {
  return loggedAs(ME, {
    "GET /api/flair/modes": CATALOG, "GET /api/flair/modes/looks": { looks: LOOKS }, "GET /api/flair/modes/trophies": [],
    "GET /api/search": { results: [person("bia", "ACEITO"), person("caio"), person("duda"), person(ME.user.username)] },
    [`GET /api/users/${ME.user.id}/connections`]: { followers: [person("caio"), person("bia")], following: [person("bia")] },
    ...extra,
  });
}
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const invite = async (user: string) => fireEvent.click(await screen.findByRole("button", { name: `Convidar @${user}` }));

describe("multiplayer pela rede FAI", () => {
  it("Battle: troca para multiplayer, busca na rede, convida e manda o @ escolhido; a própria pessoa não aparece", async () => {
    const { calls } = base({ "POST /api/flair/modes/battle": RESULT });
    renderApp(<FlairModes initial="BATTLE" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Beta/ }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /Look Beta/ })[0]);
    fireEvent.click(screen.getByRole("radio", { name: "👥 Multiplayer (rede FAI)" }));
    expect(screen.queryByRole("button", { name: `Convidar @${ME.user.username}` })).toBeNull();
    expect(screen.getByLabelText("Buscar pessoas na rede FAI")).toBeTruthy();
    await invite("bia");
    expect(btn("@bia convidado; tocar desfaz").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn("⚔️ Batalhar"));
    expect(await screen.findByRole("region", { name: "Arena do confronto" })).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/modes/battle")?.body).toEqual({ schemeId: "s2", opponent: "bia", theme: null });
    expect(screen.getByText("Carta MVP da partida")).toBeTruthy();
    expect(screen.getByRole("button", { name: "👥 Convidar da rede FAI" })).toBeTruthy();
  });

  it("recortes da minha rede: quem sigo e mútuos vêm das conexões", async () => {
    base();
    renderApp(<FlairModes initial="WARDROBE" />);
    fireEvent.click(await screen.findByRole("radio", { name: "👥 Multiplayer (rede FAI)" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Me seguem" }));
    expect(await screen.findByRole("button", { name: "Convidar @caio" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Mútuos" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Convidar @caio" })).toBeNull());
    expect(screen.getByRole("button", { name: "Convidar @bia" })).toBeTruthy();
  });

  it("Wardrobe Wars: solo contra a Casa ou multiplayer com alguém escolhido na rede", async () => {
    const cards = [{ id: "k1", name: "Bota Couro", category: "shoes_piece", rarity: "RARE", power: 90 }, { id: "k2", name: "Camiseta", category: "upper_piece", rarity: "STANDARD", power: 20 }];
    const { calls } = base({ "POST /api/flair/modes/wardrobe-wars": { ...RESULT, mode: "WARDROBE" }, "GET /api/flair/cards": { cards } });
    renderApp(<FlairModes initial="WARDROBE" />);
    const go = await screen.findByRole("button", { name: "🧥 Guarda-roupa × guarda-roupa" });
    const hand = await screen.findByRole("figure", { name: /Seu guarda-roupa em jogo: 2 cartas/ });
    expect(within(hand).getAllByRole("listitem")[0].textContent).toContain("Bota Couro");
    fireEvent.click(go);
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/wardrobe-wars"))?.body).toEqual({ opponent: "CASA" }));
    expect(await screen.findByRole("region", { name: "Arena do confronto" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "👥 Multiplayer (rede FAI)" }));
    expect((go as HTMLButtonElement).disabled).toBe(true);
    await invite("duda");
    fireEvent.click(go);
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/wardrobe-wars")).at(-1)?.body).toEqual({ opponent: "duda" }));
  });

  it("Tag Team: parceira e a dupla adversária saem da busca; a parceira some da lista de adversários", async () => {
    const { calls } = base({ "POST /api/flair/modes/tag-team": { ...RESULT, mode: "TAG_TEAM", rounds: [], teamA: { harmony: 88 }, teamB: { harmony: 70 } } });
    renderApp(<FlairModes initial="TAG_TEAM" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /Look Alfa/ })[0]);
    expect((btn("🤝 Jogar em dupla") as HTMLButtonElement).disabled).toBe(true);
    const [partner, rivals] = screen.getAllByRole("group").filter((g) => g.classList.contains("fai-net"));
    fireEvent.click(await within(partner).findByRole("button", { name: "Convidar @bia" }));
    await waitFor(() => expect(within(rivals).queryByRole("button", { name: "Convidar @bia" })).toBeNull());
    fireEvent.click(within(rivals).getByRole("button", { name: "Convidar @caio" }));
    fireEvent.click(btn("🤝 Jogar em dupla"));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/tag-team"))?.body).toEqual({ schemeId: "s1", partner: "bia", opponents: [] }));
    fireEvent.click(within(rivals).getByRole("button", { name: "Convidar @duda" }));
    fireEvent.click(btn("🤝 Jogar em dupla"));
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/tag-team")).at(-1)?.body).toMatchObject({ opponents: ["caio", "duda"] }));
  });

  it("quem chega por convite já vê o rival escolhido e o aviso de quem convidou", async () => {
    nav.search = new URLSearchParams("mode=BATTLE&rival=bia&alvo=87");
    base();
    renderApp(<FlairModes initial="BATTLE" />);
    expect(await screen.findByText("👥 Desafio de @bia: supere 87 pontos neste modo.")).toBeTruthy();
    expect(screen.getByText("@bia")).toBeTruthy();
  });
});

describe("tática, mão de cartas e convite de placar", () => {
  it("a leitura tática ordena pelo tema e a sugestão escolhe o look; a mão mostra o efeito de cada carta no cenário", async () => {
    base();
    renderApp(<FlairModes initial="BATTLE" />);
    fireEvent.click(await screen.findByLabelText("Tema"));
    fireEvent.click(screen.getByRole("option", { name: "🎭 Gala" }));
    expect(screen.getByText("O tema valoriza:")).toBeTruthy();
    fireEvent.click(btn("Sugestão do estrategista"));
    expect(screen.getAllByRole("button", { name: /Look Beta/ })[0].getAttribute("aria-pressed")).toBe("true");
    const hand = screen.getByRole("figure", { name: "Sua mão: 2 cartas de roupa" });
    expect(within(hand).getByText("Blazer Look Beta")).toBeTruthy();
    expect(within(hand).getByText(/acende o holofote/)).toBeTruthy();
    expect(within(hand).getByText(/trilha de luz no piso/)).toBeTruthy();
  });

  it("no modo contra a IA, o convite leva o placar a superar para até 5 pessoas", async () => {
    const { calls } = base({
      "GET /api/flair/modes/chess": { slots: ["TOP", "HERO", "BOTTOM"], cards: [], suggestion: { TOP: "a", HERO: "b", BOTTOM: "c" }, rules: [] },
      "POST /api/flair/modes/chess": { ...RESULT, mode: "CHESS", scoreA: 87 },
      "POST /api/flair/modes/invites": { mode: "CHESS", invited: ["bia"], skipped: [] },
    });
    renderApp(<FlairModes initial="CHESS" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugestão" }));
    fireEvent.click(btn(/Jogar contra a IA/));
    fireEvent.click(await screen.findByRole("button", { name: "👥 Desafiar a rede a superar 87" }));
    await invite("bia");
    fireEvent.click(btn("Enviar convites"));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/flair/modes/invites")?.body).toEqual({ mode: "CHESS", usernames: ["bia"], target: 87 }));
    expect(await screen.findByText("1 convite enviado")).toBeTruthy();
  });

  it("catálogo: filtros por multiplayer e cartas, com o cenário e a complexidade de cada modo", async () => {
    base();
    renderApp(<FlairModes />);
    expect(await screen.findByRole("heading", { name: "Duelos" })).toBeTruthy();
    expect(screen.getAllByLabelText(/Complexidade \d de 5/).length).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole("radio", { name: "Cartas soltas" }));
    expect(screen.queryByRole("button", { name: /Modo BATTLE/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Modo CHESS/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Contra pessoas" }));
    expect(screen.getByRole("button", { name: /Modo TAG_TEAM/ })).toBeTruthy();
  });
});
