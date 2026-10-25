// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlairSection } from "./sections";
import type { FlairCard, FlairDeck } from "./flair-card";
import type { Combination, Voucher } from "./flair-shared";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Sub-rotas do FLAIR: cabeçalho com rank/coins/recorde, álbum de cartas, decks, lojas (combinações e troca por
 * cupom), carteira (cupons, skins, extrato, partidas) e missões (resgatar recompensa).
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const ME_FLAIR = {
  coins: 120, rank: { code: "PRATA", label: "Prata", points: 250, next: { label: "Ouro", at: 500 } }, wins: 4, losses: 2, draws: 1,
  skins: ["HOLOGRAFICO"], activeSkin: "CHAMPION", skinShop: { CHAMPION: 50, HOLOGRAFICO: 80, BRAND_FRAME: 500, NOVA: 10 }, season: "SPRING",
  team: { id: "t1", name: "Equipe Rosa", code: "X", color: "#f00", points: 12, owner: ME.user, members: [], mine: true },
  ledger: [{ delta: 40, reason: "DUEL_WIN", ref: "m1", at: "" }, { delta: -50, reason: "SKIN_BUY", ref: "s", at: "" }],
  recent: [{ matchId: "m1", mode: "DUEL", theme: "casual", date: "", power: 300, outcome: "WIN" }, { matchId: "m2", mode: "OUTRO", date: "", power: 1, score: 77, outcome: null }],
  ethics: "Ética.",
};
const card = (id: string): FlairCard => ({ id, name: `Carta ${id}`, category: "upper_piece", subcategory: "tshirt", styles: [], occasions: [], season: "SPRING", stats: { EDGE: 50 }, rarity: "RARE", multiplier: 1, power: 70 });
const deck = (id: string | null, title: string): FlairDeck => ({ schemeId: id, title, cards: [card(`${title}-1`)], combos: [{ code: "x", label: "Combo X", points: 5 }], brandMultiplier: 1, seasonBonus: 0, power: 300, avg: { EDGE: 50 }, abilities: [] });
const VOUCHER: Voucher = { id: "v1", code: "FLR-1111", status: "EMITIDO", expiresAt: "2026-12-31T12:00:00Z", createdAt: "", user: ME.user,
  combination: { id: "c1", name: "Combo Azul", brandName: "Azul", coupon: "15% na coleção", discountPercent: 15, discountAmount: "", minPurchase: "", accentColor: "#123" } };
const combo = (id: string, extra: Partial<Combination> = {}): Combination => ({
  id, brand: ME.user, brandName: "Azul", name: `Combo ${id}`, gameType: "COMBINACAO", requiredCategories: [], requiredStyles: [], requiredOccasions: [], minBrandPieces: 0, minDeckPower: 0, minWins: 0,
  coupon: { title: `Cupom ${id}`, discountPercent: 10, discountAmount: "", minPurchase: "", validDays: 30 }, redeemed: 0, active: true, available: true, accentColor: "#123", ...extra,
});
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });
const base = (extra: Record<string, unknown> = {}) => loggedAs(ME, { "GET /api/flair/me": ME_FLAIR, ...extra });

describe("FlairSection — cabeçalho e cartas", () => {
  it("mostra rank, coins e recorde; o álbum marca o que foi coletado; cartas vazias convidam a cadastrar", async () => {
    base({ "GET /api/flair/cards": { season: "SPRING", cards: [card("a")], album: { slots: 8, collected: 1, rows: [{ category: "upper_piece", rarities: { STANDARD: true, RARE: false } }] } } });
    renderApp(<FlairSection section="cartas" />);
    expect(await screen.findByText("Álbum de raridades")).toBeTruthy();
    expect(screen.getByText("1/8 figurinhas")).toBeTruthy();
    expect(screen.getByLabelText("coletada").textContent).toBe("✓");
    expect(screen.getByLabelText("faltando").textContent).toBe("");
    expect(await screen.findByText("120 coins")).toBeTruthy();
    expect(screen.getByText("4 vitórias · 1 empates · 2 derrotas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Central FLAIR/ }).getAttribute("href")).toBe("/flair?mode=cards");
    expect(screen.getByLabelText(/^Carta Carta a, Rare/)).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/cards": { season: "SPRING", cards: [], album: { slots: 0, collected: 0, rows: [] } } });
    renderApp(<FlairSection section="cartas" />);
    expect(await screen.findByText("Nenhuma carta ainda.")).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/cards": err(500, "x") });
    renderApp(<FlairSection section="cartas" />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });
});

describe("FlairSection — decks", () => {
  it("lista decks com links para jogar e abrir; sem decks mostra o vazio; erro mostra o estado de erro", async () => {
    base({ "GET /api/flair/decks": [deck("d1", "Noite"), deck(null, "Solto")] });
    renderApp(<FlairSection section="decks" />);
    expect(await screen.findByText("Noite")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "Jogar com este deck" });
    expect(links[0].getAttribute("href")).toBe("/flair/partidas?mode=DUEL&deck=d1");
    expect(links[1].getAttribute("href")).toBe("/flair/partidas?mode=DUEL&deck=");
    expect(screen.getAllByRole("link", { name: "Abrir look" })).toHaveLength(1);
    expect(screen.getAllByText("Combo X +5").length).toBe(2);
    cleanup();
    base({ "GET /api/flair/decks": [] });
    renderApp(<FlairSection section="decks" />);
    expect(await screen.findByText("Nenhum deck.")).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/decks": err(500, "x") });
    renderApp(<FlairSection section="decks" />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });
});

describe("FlairSection — lojas", () => {
  const COMBOS = [
    combo("c1", { brandSlug: "azul", description: "Monte um look", complete: true, bestDeck: { schemeId: "d1", title: "Noite", power: 320 }, stock: 10, redeemed: 3,
      checks: [{ kind: "CATEGORY", value: "upper_piece", label: "", ok: true }, { kind: "POWER", value: "300", label: "Poder 300", ok: false }] }),
    combo("c2", { gameType: "COLECAO", complete: false }),
    combo("c3", { gameType: "DUELO_PATROCINADO", redemption: VOUCHER }),
    combo("c4", { complete: true, available: true }),
  ];
  it("filtra por tipo e prontas, troca pelo cupom com o melhor deck e abre o cupom já trocado", async () => {
    const { calls } = base({ "GET /api/flair/combinations": COMBOS, "POST /api/flair/combinations/c1/redeem": VOUCHER, "POST /api/flair/combinations/c4/redeem": err(409, "Sem estoque") });
    renderApp(<FlairSection section="lojas" />);
    expect(await screen.findByText("Combo c1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Azul" }).getAttribute("href")).toBe("/brands/azul");
    expect(screen.getByText("Monte um look")).toBeTruthy();
    expect(screen.getByText("Poder 300")).toBeTruthy();
    expect(screen.getByText("cumprido")).toBeTruthy();
    expect(screen.getByText(/7 cupons restantes/)).toBeTruthy();
    expect(screen.getByText("Noite")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Complete os requisitos" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Prontas para trocar" }));
    expect(screen.queryByText("Combo c2")).toBeNull();
    expect(screen.queryByText("Combo c3")).toBeNull();
    expect(screen.getByText("Combo c4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Coleção (guarda-roupa)" }));
    expect(screen.getByText("Combo c2")).toBeTruthy();
    expect(screen.queryByText("Combo c1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Duelo patrocinado" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver cupom FLR-1111" }));
    let dialog = await screen.findByRole("dialog", { name: "Cupom Azul" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Trocar pelo cupom" })[0]);
    dialog = await screen.findByRole("dialog", { name: "Cupom Azul" });
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/flair/combinations/c1/redeem?schemeId=d1")).toBe(true);
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click((await screen.findAllByRole("button", { name: "Trocar pelo cupom" }))[1]);
    expect(await screen.findByText("Sem estoque")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/flair/combinations/c4/redeem")).toBe(true);
  });

  it("sem combinações mostra o vazio; erro mostra o estado de erro", async () => {
    base({ "GET /api/flair/combinations": [] });
    renderApp(<FlairSection section="lojas" />);
    expect(await screen.findByText("Nenhuma loja com combinação ativa.")).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/combinations": err(500, "x") });
    renderApp(<FlairSection section="lojas" />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });
});

describe("FlairSection — carteira", () => {
  it("mostra o progresso do rank, a equipe, cupons, skins (ativa, usar, comprar), extrato e partidas", async () => {
    const { calls } = base({ "GET /api/flair/vouchers": [VOUCHER, { ...VOUCHER, id: "v2", code: "FLR-2", status: "USADO" }, { ...VOUCHER, id: "v3", code: "FLR-3", status: "EXPIRADO" }], "POST /api/flair/skins/HOLOGRAFICO": { ...ME_FLAIR, activeSkin: "HOLOGRAFICO" } });
    renderApp(<FlairSection section="carteira" />);
    expect(await screen.findByText("Rank Prata · 250 pts → Ouro em 500")).toBeTruthy();
    expect(screen.getByText("Equipe Rosa")).toBeTruthy();
    expect(await screen.findByText("FLR-1111")).toBeTruthy();
    expect(screen.getByText("USADO")).toBeTruthy();
    expect(screen.getByText("Campeão")).toBeTruthy();
    expect(screen.getByText("NOVA")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ativa" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "500 coins" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "10 coins" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("duel win")).toBeTruthy();
    expect(screen.getByText("+40")).toBeTruthy();
    expect(screen.getByText("-50")).toBeTruthy();
    expect(screen.getByText("Vitória")).toBeTruthy();
    expect(screen.getByText("77")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/flair/skins/HOLOGRAFICO")).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Ativa" })).toHaveLength(1));
    // o cupom aparece em mais de um cartão da carteira; qualquer um abre o mesmo cupom
    fireEvent.click(screen.getAllByRole("button", { name: /15% na coleção/ })[0]);
    expect(await screen.findByRole("dialog", { name: "Cupom Azul" })).toBeTruthy();
  });

  it("sem cupons e no rank máximo sem equipe", async () => {
    base({ "GET /api/flair/me": { ...ME_FLAIR, rank: { code: "OURO", label: "Ouro", points: 900, next: null }, team: null, season: "XYZ" }, "GET /api/flair/vouchers": [] });
    renderApp(<FlairSection section="carteira" />);
    expect(await screen.findByText("Rank Ouro · 900 pts")).toBeTruthy();
    expect(screen.getByText("XYZ")).toBeTruthy();
    expect(await screen.findByText("Nenhum cupom ainda.")).toBeTruthy();
    expect(screen.queryByText(/Equipe/)).toBeNull();
  });
});

describe("FlairSection — missões", () => {
  it("resgata missão concluída e mostra diária/semanal, em andamento e resgatada", async () => {
    const quests = [
      { code: "q1", label: "Jogue 3", period: "DAY", rule: "3 partidas", coins: 20, progress: 3, target: 3, done: true, claimed: false },
      { code: "q2", label: "Vença 5", period: "WEEK", rule: "5 vitórias", coins: 50, progress: 2.4, target: 5, done: false, claimed: false },
      { code: "q3", label: "Login", period: "DAY", rule: "entre", coins: 5, progress: 1, target: 1, done: true, claimed: true },
    ];
    const { calls } = base({ "GET /api/flair/quests": quests, "POST /api/flair/quests/q1/claim": { ...ME_FLAIR, coins: 140 } });
    renderApp(<FlairSection section="missoes" />);
    expect(await screen.findByText("Jogue 3")).toBeTruthy();
    expect(screen.getAllByText("Diária")).toHaveLength(2);
    expect(screen.getByText("Semanal")).toBeTruthy();
    expect(screen.getByText("2/5")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Em andamento" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Resgatada" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }));
    expect(await screen.findByText("140 coins")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/flair/quests/q1/claim")).toBe(true);
  });

  it("sem missões, erro e falha ao resgatar", async () => {
    base({ "GET /api/flair/quests": [] });
    renderApp(<FlairSection section="missoes" />);
    expect(await screen.findByText("Nenhuma missão hoje")).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/quests": err(500, "x") });
    renderApp(<FlairSection section="missoes" />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
    cleanup();
    base({ "GET /api/flair/quests": [{ code: "q1", label: "Jogue", period: "DAY", rule: "", coins: 1, progress: 1, target: 1, done: true, claimed: false }], "POST /api/flair/quests/q1/claim": err(409, "Já resgatada") });
    renderApp(<FlairSection section="missoes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Resgatar" }));
    expect(await screen.findByText("Já resgatada")).toBeTruthy();
  });
});
