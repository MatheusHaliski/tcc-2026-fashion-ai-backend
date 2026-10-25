// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArenaPanel, DuelPanel, Rounds, TeamPanel } from "./classic-modes";
import type { FlairCard, FlairDeck } from "./flair-card";
import { nav } from "@/test-utils/setup";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Modos clássicos do FLAIR: duelo 1×1 (e treino com a Casa), batalha de ocasião do dia e equipes 3×3 com liga.
 * Cada painel escolhe o deck, chama a API certa e mostra o resultado (rodadas, placar, recompensa).
 */
const reduceMotion = (on: boolean) => { window.matchMedia = ((q: string) => ({ matches: on, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia; };
beforeEach(() => { nav.search = new URLSearchParams(); reduceMotion(true); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const card = (id: string, name: string): FlairCard => ({ id, name, category: "upper_piece", subcategory: "tshirt", styles: [], occasions: [], season: "SPRING", stats: { EDGE: 50 }, rarity: "RARE", multiplier: 1, power: 70 });
const deck = (id: string | null, title: string, extra: Partial<FlairDeck> = {}): FlairDeck => ({ schemeId: id, title, cards: [card(`${id}-1`, `Carta de ${title}`)], combos: [], brandMultiplier: 1, seasonBonus: 0, power: 300, avg: { EDGE: 50 }, abilities: [], ...extra });
const DECKS = [deck("d1", "Deck Noite"), deck("d2", "Deck Dia")];
const user = (id: string) => ({ ...ME.user, id, username: id, displayName: id });
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });

const DUEL = {
  matchId: "m1", mode: "DUEL", me: deck("d1", "Deck Noite", { brandMultiplier: 1.2, topBrand: "Zara", seasonBonus: 4, abilities: [{ code: "A", label: "Brilho", description: "" }] }),
  opponent: { label: "@bia", deck: deck("x", "Deck Bia") },
  rounds: [{ stat: "EDGE", a: 70, b: 50, winner: "A", notes: ["combo"] }, { stat: "GLOW", a: 40, b: 60, winner: "B", notes: [] }, { stat: "ART", a: 50, b: 50, winner: "DRAW", notes: [] }],
  score: { me: 2, opponent: 1 }, outcome: "WIN", coins: 40, rewardCapReached: false, faiPoints: 8,
};

describe("Rounds", () => {
  it("revela as rodadas uma a uma quando o movimento não é reduzido", () => {
    reduceMotion(false);
    vi.useFakeTimers();
    renderApp(<Rounds rounds={DUEL.rounds as never} a="Você" b="Bia" />);
    expect(screen.queryByText("EDGE")).toBeNull();
    act(() => { vi.advanceTimersByTime(460); });
    expect(screen.getByText("EDGE")).toBeTruthy();
    expect(screen.getByText("Rodada de Você · combo")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Rodada de Bia")).toBeTruthy();
    expect(screen.getByText("Empate")).toBeTruthy();
  });
});

describe("DuelPanel", () => {
  it("sem decks mostra o convite para criar um look", async () => {
    loggedAs(ME, { "GET /api/flair/decks": [] });
    renderApp(<DuelPanel />);
    expect(await screen.findByText("Você ainda não tem decks.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar look" }).getAttribute("href")).toBe("/schemes/new");
  });

  it("duela com o @ informado, mostra o resultado no diálogo e fecha", async () => {
    const onPlayed = vi.fn();
    const { calls } = loggedAs(ME, { "GET /api/flair/decks": DECKS, "POST /api/flair/duels": DUEL });
    renderApp(<DuelPanel onPlayed={onPlayed} skin="CHAMPION" />);
    const duelar = await screen.findByRole("button", { name: "Duelar" });
    await waitFor(() => expect(screen.getByLabelText("Seu deck (look)").textContent).toContain("Deck Noite · poder 300"));
    expect((duelar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Oponente (@usuário)"), { target: { value: "  bia " } });
    fireEvent.click(duelar);
    const dialog = await screen.findByRole("dialog", { name: "Duelo 1×1 · @bia" });
    expect(calls.find((c) => c.path === "/api/flair/duels")?.body).toEqual({ schemeId: "d1", opponent: "bia" });
    expect(within(dialog).getByText("Vitória")).toBeTruthy();
    expect(within(dialog).getByText("2 × 1")).toBeTruthy();
    expect(within(dialog).getByText("+40 coins")).toBeTruthy();
    expect(within(dialog).getByText("+8 FAI Pts")).toBeTruthy();
    expect(within(dialog).getByText(/×1\.20 Zara/)).toBeTruthy();
    expect(within(dialog).getByText(/\+4 estação/)).toBeTruthy();
    expect(within(dialog).getByText(/Brilho/)).toBeTruthy();
    expect(await within(dialog).findByText("Rodada de @bia")).toBeTruthy();
    expect(onPlayed).toHaveBeenCalled();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("treino com a Casa usa o deck de ?deck=, teto diário substitui as moedas e modo desconhecido vira 'Duelo'", async () => {
    nav.search = new URLSearchParams("deck=d2");
    const { calls } = loggedAs(ME, { "GET /api/flair/decks": DECKS, "POST /api/flair/duels": { ...DUEL, mode: "OUTRO", outcome: "LOSS", rewardCapReached: true, faiPoints: 0, opponent: { label: "Casa", deck: deck("c", "Deck Casa") } } });
    renderApp(<DuelPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Treinar com a Casa" }));
    const dialog = await screen.findByRole("dialog", { name: "Duelo · Casa" });
    expect(calls.find((c) => c.path === "/api/flair/duels")?.body).toEqual({ schemeId: "d2", opponent: "CASA" });
    expect(within(dialog).getByText("Derrota")).toBeTruthy();
    expect(within(dialog).getByText(/Teto diário de duelos premiados/)).toBeTruthy();
    expect(within(dialog).queryByText(/FAI Pts/)).toBeNull();
  });

  it("erro do duelo vira aviso e não abre o diálogo", async () => {
    loggedAs(ME, { "GET /api/flair/decks": DECKS, "POST /api/flair/duels": err(409, "Oponente sem deck") });
    renderApp(<DuelPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Treinar com a Casa" }));
    expect(await screen.findByText("Oponente sem deck")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ArenaPanel", () => {
  const ARENA = { date: "2026-10-24", theme: "casual", rule: "Regra da arena", leaderboard: [] as unknown[] };
  it("placar vazio convida a jogar; inscrever o deck atualiza o placar e trava o botão", async () => {
    const board = [{ position: 1, user: user("ana"), deck: "Deck Noite", score: 88, power: 300, you: true }, { position: 2, user: user("bia"), deck: "Deck Bia", score: 70, power: 250, you: false }];
    const { calls } = loggedAs(ME, { "GET /api/flair/decks": DECKS, "GET /api/flair/arena": ARENA, "POST /api/flair/arena": { ...ARENA, leaderboard: board } });
    renderApp(<ArenaPanel />);
    expect(await screen.findByText("Regra da arena")).toBeTruthy();
    expect(screen.getByText("Ninguém jogou hoje ainda — seja a primeira pessoa.")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Inscrever deck" }));
    expect(await screen.findByText("@ana · Deck Noite")).toBeTruthy();
    expect(screen.getByText("2º")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ schemeId: "d1" });
    expect((screen.getByRole("button", { name: "Você já está na batalha de hoje" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem decks mostra o vazio no lugar da inscrição", async () => {
    loggedAs(ME, { "GET /api/flair/decks": [], "GET /api/flair/arena": ARENA });
    renderApp(<ArenaPanel />);
    expect(await screen.findByText("Você ainda não tem decks.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Inscrever deck" })).toBeNull();
  });
});

describe("TeamPanel", () => {
  const team = (id: string, name: string, mine: boolean) => ({ id, name, code: `C-${id}`, color: "#ff0000", points: 9, owner: user("ana"), members: [{ user: user("ana"), role: "CAPITAO" }, { user: user("bia"), role: "MEMBRO" }], mine });
  const LEAGUE = { teams: [team("t1", "Equipe Rosa", false)], mine: null, players: [{ user: user("ana"), rank: { code: "OURO", label: "Ouro", points: 500 }, wins: 3 }], rule: "Regra das equipes" };
  const MINE = { ...LEAGUE, teams: [team("t1", "Equipe Rosa", true)], mine: team("t1", "Equipe Rosa", true), battles: [{ id: "b1", theme: "Gala", winner: "A", date: "01/10", side: "A" }, { id: "b2", theme: "Praia", winner: "B", date: "02/10", side: "A" }, { id: "b3", theme: "Rua", winner: "DRAW", date: "03/10", side: "A" }] };

  it("sem equipe: criar exige 3 letras e manda nome e cor; entrar com código manda o código", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/teams": LEAGUE, "POST /api/flair/teams": MINE, "POST /api/flair/teams/join": MINE, "GET /api/flair/decks": DECKS });
    renderApp(<TeamPanel />);
    expect(await screen.findByText("Regra das equipes")).toBeTruthy();
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.getByText("3V")).toBeTruthy();
    const criar = screen.getByRole("button", { name: "Criar" });
    fireEvent.change(screen.getByLabelText("Nome da nova equipe"), { target: { value: "ab" } });
    expect((criar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nome da nova equipe"), { target: { value: "Rosa" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "#00ff00" } });
    fireEvent.click(criar);
    expect(await screen.findByText(/C-t1/)).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/flair/teams")?.body).toEqual({ name: "Rosa", color: "#00ff00" });
    cleanup();
    const second = loggedAs(ME, { "GET /api/flair/teams": LEAGUE, "POST /api/flair/teams/join": MINE, "GET /api/flair/decks": DECKS });
    renderApp(<TeamPanel />);
    fireEvent.change(await screen.findByLabelText("Entrar com código"), { target: { value: " C-t1 " } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Sair da equipe")).toBeTruthy();
    expect(second.calls.find((c) => c.path === "/api/flair/teams/join")?.body).toEqual({ code: "C-t1" });
  });

  it("com equipe: mostra membros e batalhas, desafia outra equipe e abre o resultado; sair volta a liga", async () => {
    const battle = {
      teamA: team("t1", "Equipe Rosa", true), teamB: team("t2", "Equipe Azul", false), winner: "A", score: { a: 2, b: 1 }, faiPoints: 12,
      duels: [
        { slot: 1, a: { user: user("ana"), deck: "Deck Noite", power: 300 }, b: { user: user("cai"), deck: "Deck Cai", power: 200 }, winner: "A", rounds: [{ stat: "EDGE", a: 1, b: 0, winner: "A", notes: [] }, { stat: "ART", a: 0, b: 1, winner: "B", notes: [] }, { stat: "GLOW", a: 1, b: 1, winner: "DRAW", notes: [] }] },
        { slot: 2, a: null, b: null, winner: "B", rounds: [] },
      ],
    };
    const { calls } = loggedAs(ME, { "GET /api/flair/teams": MINE, "POST /api/flair/teams/battles": battle, "DELETE /api/flair/teams/me": LEAGUE, "GET /api/flair/decks": DECKS });
    renderApp(<TeamPanel />);
    expect(await screen.findByText("Batalhas da minha equipe")).toBeTruthy();
    expect(screen.getByText(/@ana ★/)).toBeTruthy();
    const list = screen.getByText("Batalhas da minha equipe").nextElementSibling as HTMLElement;
    expect(within(list).getByText("Vitória")).toBeTruthy();
    expect(within(list).getByText("Derrota")).toBeTruthy();
    expect(within(list).getByText("Empate")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Desafiar a equipe (código)"), { target: { value: " T2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Duelo de equipes" }));
    const dialog = await screen.findByRole("dialog", { name: "Equipe Rosa × Equipe Azul" });
    expect(calls.find((c) => c.path === "/api/flair/teams/battles")?.body).toEqual({ code: "T2" });
    expect(within(dialog).getByText("Vitória da sua equipe")).toBeTruthy();
    expect(within(dialog).getByText("EDGE ◀ · ART ▶ · GLOW =")).toBeTruthy();
    expect(within(dialog).getAllByText("— sem deck —")).toHaveLength(2);
    expect(within(dialog).getByText("+12 FAI Pts")).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Sair da equipe" }));
    expect(await screen.findByLabelText("Nome da nova equipe")).toBeTruthy();
  });

  it("derrota e empate no duelo de equipes aparecem no resultado", async () => {
    for (const [winner, text] of [["B", "Vitória da equipe rival"], ["DRAW", "Empate"]] as const) {
      loggedAs(ME, { "GET /api/flair/teams": MINE, "POST /api/flair/teams/battles": { teamA: team("t1", "Equipe Rosa", true), teamB: team("t2", "Equipe Azul", false), winner, score: { a: 0, b: 0 }, duels: [] }, "GET /api/flair/decks": DECKS });
      renderApp(<TeamPanel />);
      fireEvent.change(await screen.findByLabelText("Desafiar a equipe (código)"), { target: { value: "T2" } });
      fireEvent.click(screen.getByRole("button", { name: "Duelo de equipes" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getAllByText(text).length).toBeGreaterThan(0);
      cleanup();
    }
  });
});
