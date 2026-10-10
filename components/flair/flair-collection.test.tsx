// @vitest-environment jsdom
/**
 * FLAIR-UT F3 + pedidos de 07/10: "Converter para FLAIR" duplica a peça numa carta (Minhas cartas FLAIR, por nível) e
 * nunca publica no feed. No criador de peças, "Compartilhar no feed" vem ligado (o post é o próprio card, sem descrição)
 * e "Converter para FLAIR" desligado; desligando Compartilhar, nenhuma chamada de compartilhamento sai e a peça fica só
 * no perfil.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";
import { FlairGameCard, type FlairCollectionCard } from "./flair-game-card";
import { FlairCollectionTab, FlairPieceBlock } from "./flair-collection";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const CARD = (over: Partial<FlairCollectionCard> = {}): FlairCollectionCard => ({ id: "c1", originType: "PIECE", originId: "p1", season: "SPRING", tier: "PRATA", ovr: 68,
  rare: false, position: "CAL", name: "Tênis Aero", brandName: "Norte Sport", imageUrl: "/media/p.png", hype: null, stats: { EDGE: 40, RANGE: 60 }, rarity: "STANDARD",
  ability: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED", ...over });
const shares = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "POST" && c.path.includes("/shares"));

describe("Carta FLAIR", () => {
  it("frente com nota, posição, nível escrito e Hype em números; sem Hype público, '—' e nunca 0", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD({ rare: true })} />);
    const card = screen.getByRole("article", { name: /Carta FLAIR Prata rara, nota 68, Tênis Aero, Norte Sport/ });
    expect(card.textContent).toContain("68");
    expect(card.textContent).toContain("CAL");
    expect(card.textContent).toMatch(/Prata · rara/);
    expect(card.querySelectorAll(".fgc-hype dd")).toHaveLength(8);
    expect(Array.from(card.querySelectorAll(".fgc-hype dd")).every((d) => d.textContent === "—")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ver o verso da carta" }));
    expect(screen.getByText("EDGE")).toBeTruthy();
  });

  it("Minhas cartas FLAIR: separadas por nível, com a contagem", async () => {
    loggedAs(undefined, { "GET /api/me/flair/cards": { season: "SPRING", total: 3, counts: { ESPECIAL: 0, OURO: 1, PRATA: 2, BRONZE: 0 },
      cards: [CARD({ id: "a", tier: "OURO", ovr: 80, name: "Bolsa" }), CARD({ id: "b" }), CARD({ id: "c", name: "Camisa" })] } });
    renderApp(<FlairCollectionTab ownerId={ME.user.id} self />);
    expect(await screen.findByRole("heading", { name: /Ouro 1/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Prata 2/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Bronze/ })).toBeNull();
  });

  it("detalhe da peça: Converter para FLAIR mostra a prévia e gera a carta sem compartilhar", async () => {
    let made = false;
    const { calls } = loggedAs(undefined, {
      "GET /api/me/flair/cards": () => (made ? { season: "SPRING", total: 1, counts: { ESPECIAL: 0, OURO: 0, PRATA: 1, BRONZE: 0 }, cards: [CARD()] } : { season: "SPRING", total: 0, counts: { ESPECIAL: 0, OURO: 0, PRATA: 0, BRONZE: 0 }, cards: [] }),
      "POST /api/flair/cards/preview": { ovr: 68, tier: "PRATA", position: "CAL", priceVerified: false, cappedByUnverifiedPrice: true, season: "SPRING", basis: { priceUsed: 399 } },
      "POST /api/flair/cards": () => { made = true; return CARD(); },
    });
    renderApp(<FlairPieceBlock pieceId="p1" />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "Converter para FLAIR" }));
    expect(await screen.findByText(/no máximo até Prata/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gerar carta" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/flair/cards")).toBe(true));
    expect(await screen.findByRole("article", { name: /Carta FLAIR Prata/ })).toBeTruthy();
    expect(shares(calls)).toHaveLength(0);                                   // converter nunca publica no feed
  });
});

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { white: "#ffffff", blue: "#1f4fa0", black: "#111111" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" },
};

/** Preenche o criador até a etapa Revisar (o mesmo caminho do teste de salvar a peça). */
async function fillToReview() {
  renderApp(<NewPiecePage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Parte superior$/ }));
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Camiseta branca" } });
  const pick = (id: string, option: string) => { fireEvent.click(document.getElementById(id)!); fireEvent.click(screen.getByRole("option", { name: option })); };
  pick("subcategory", "Camiseta"); pick("color", "Branco"); pick("material", "Algodão");
  fireEvent.change(document.getElementById("price") as HTMLInputElement, { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Casual" }));
  fireEvent.click(screen.getByRole("button", { name: "Básico" }));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getAllByRole("button").find((b) => /Próximo|Avançar|Next/i.test(b.textContent ?? ""))!);
  expect(await screen.findByRole("heading", { name: "Depois de salvar" })).toBeTruthy();
}
const save = async () => {
  fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
};

describe("Criador de peças › Depois de salvar", () => {
  const routes = { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] }, "POST /api/pieces": { id: "nova" },
    "POST /api/interactions/PIECE/nova/shares": { shareId: "s" }, "POST /api/flair/cards": CARD({ id: "f", originId: "nova", tier: "BRONZE", ovr: 52 }),
    "POST /api/flair/cards/preview": { ovr: 52, tier: "BRONZE", position: "SUP", priceVerified: false, cappedByUnverifiedPrice: false, season: "SPRING", basis: { priceUsed: 50 } } };

  it("Compartilhar vem ligado e FLAIR desligado; a prévia ao lado vira a prévia do post; salvar publica sem descrição", async () => {
    const { calls } = loggedAs(ME, routes);
    await fillToReview();
    expect(screen.getByRole("switch", { name: "Compartilhar no feed do FashionAI" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Converter para FLAIR" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Prévia do post")).toBeTruthy();
    expect(screen.queryByLabelText("Legenda (opcional)")).toBeNull();                     // o post não tem descrição
    await save();
    await waitFor(() => expect(shares(calls)).toHaveLength(1), { timeout: 4000 });
    expect((shares(calls)[0] as { body?: unknown }).body).toMatchObject({ channel: "FEED" });
    expect((shares(calls)[0] as { body?: Record<string, unknown> }).body).not.toHaveProperty("caption");
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/flair/cards")).toBe(false);
  });

  it("desligando Compartilhar, nada vai ao feed (a peça fica só no perfil); com FLAIR ligado, a cópia é gerada", async () => {
    const { calls } = loggedAs(ME, routes);
    await fillToReview();
    fireEvent.click(screen.getByRole("switch", { name: "Compartilhar no feed do FashionAI" }));
    expect(screen.getByText("Desligado: a peça fica só no seu perfil.")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Converter para FLAIR" }));
    expect(await screen.findByText("Prévia da carta: Bronze 52")).toBeTruthy();
    await save();
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/flair/cards")?.body).toEqual({ pieceId: "nova" }), { timeout: 4000 });
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(true);
    expect(shares(calls)).toHaveLength(0);
  });
});
