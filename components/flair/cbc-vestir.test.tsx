// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CbcList, CbcPlay } from "@/components/flair/cbc";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";

/**
 * Desafios de Montagem "vestir a cena" (V132): a cena é a imagem ANTES; a carta que o servidor aceita para a vaga veste
 * aquele personagem com o recorte da roupa da imagem DEPOIS; carta recusada não veste e a vaga avisa; tirar a carta
 * despe; as quatro certas mostram a imagem DEPOIS inteira. A lista mostra a imagem ANTES como miniatura.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/desafios" }));

const own = { status: "OPEN", now: "2026-11-26T12:00:00Z", always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const pede = (sub: string, cor: string) => ({ subcategory: [sub], color: [cor] });
const SLOTS = [
  { key: "guitarra", position: "SUP", label: "Casaco militar preto e vermelho", accepts: pede("jacket", "black") },
  { key: "voz", position: "VES", label: "Vestido vermelho com corset dourado", accepts: pede("dress", "red") },
  { key: "bateria", position: "SUP", label: "Colete xadrez vermelho", accepts: pede("vest", "red") },
  { key: "baixo", position: "VES", label: "Macacão preto e dourado", accepts: pede("jumpsuit", "black") },
];
const summary = { id: "v4", slug: "show-no-galpao", name: "Show no galpão", description: "A banda toca de camiseta.", scenario: "vestir-show", difficulty: "HARD", status: "OPEN", time: own, slotsCount: 4, points: 45, multiplier: 1, pointsPreview: 45, requirements: [], levelOpen: true, groupCode: null, locksCards: true, repeatLimit: 1, official: true, moment: null, mine: { submissions: 0, attemptsLeft: 1, done: false } };
const detail = { ...summary, slots: SLOTS, themeTags: [], interpretations: [], suggestedInterpretation: null, mySubmissions: [], communityOpen: false, community: [], memory: { builds: 0, people: 0, averageSintonia: null, readings: null, season: "SPRING" } };
const card = (id: string, name: string, position: string, subcategory: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: null, imageUrl: null, category: position === "VES" ? "full_body_piece" : "upper_piece", subcategory, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: {}, total: 5, cards: [card("j", "Jaqueta militar", "SUP", "jacket"), card("d", "Vestido vermelho", "VES", "dress"), card("t", "Camiseta vermelha", "SUP", "t_shirt"), card("v", "Colete xadrez", "SUP", "vest"), card("m", "Macacão preto", "VES", "jumpsuit")] };
const subOf = Object.fromEntries(CARDS.cards.map((c) => [c.id, c.subcategory]));

function check(_u: URL, init: RequestInit) {
  const placed = (JSON.parse(String(init.body)) as { slots: Record<string, string> }).slots;
  const slots = SLOTS.map((s) => {
    const id = placed[s.key];
    const accepted = !!id && (s.accepts.subcategory as string[]).includes(subOf[id]);
    return { slot: s.key, position: s.position, cardId: id ?? null, positionOk: true, neighbor: false, theme: false, sintonia: id ? 1 : 0, accepted, misses: id && !accepted ? ["subcategory"] : [] };
  });
  const complete = SLOTS.every((s) => placed[s.key]);
  return { status: "OPEN", interpretation: "own", canSubmit: complete && slots.every((s) => s.accepted), story: [], points: { lines: [], total: 45 },
    evaluation: { slots, requirements: [], sintonia: 4, sintoniaMax: 12, filled: Object.keys(placed).length, complete, ok: complete && slots.every((s) => s.accepted), rediscovered: [] } };
}

const cena = () => document.querySelector(".cena-vestir") as HTMLElement;
const vaga = (slot: string) => document.querySelector(`.cbv-slot[data-slot=${slot}]`) as HTMLElement;
const carta = (nome: string) => within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: new RegExp(`^Pôr ${nome}`) });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("vestir a cena", () => {
  it("a lista mostra a imagem ANTES como miniatura, mesmo com um cenário preferido salvo (exercício 16)", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/challenges": { season: "SPRING", groups: [], now: [], always: [summary], upcoming: [], memories: [] },
      "GET /api/flair/challenge-preferences": [{ challengeId: "v4", scenario: { id: "s-livre", codigo: "livre", nome: "Livre" } }] });
    renderApp(<CbcList />);
    await screen.findByRole("heading", { name: "Show no galpão" });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/flair/challenge-preferences")).toBe(true));
    await settle();
    // num desafio de vestir a cena é o próprio desafio: a preferência não troca a arte nem aparece no cartão
    expect(document.querySelector("[data-cbc-cenario]")).toBeNull();
    expect(cena().getAttribute("data-cenario")).toBe("vestir-show");
    expect(cena().querySelector(".cv-antes")?.getAttribute("src")).toBe("/flair/desafios/vestir-show/antes.webp");
    expect(cena().getAttribute("data-vestidos")).toBe("0,0,0,0");
  });

  it("carta certa veste o personagem, a errada não veste e avisa, tirar despe e as quatro mostram a imagem DEPOIS", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/challenges/show-no-galpao": detail, "GET /api/me/flair/cards": CARDS, "POST /api/flair/challenges/show-no-galpao/check": check });
    renderApp(<CbcPlay slug="show-no-galpao" />);
    await screen.findByRole("heading", { name: "Show no galpão" });
    expect(cena().getAttribute("aria-label")).toBe("Show no galpão: 0 de 4 personagens já vestem a roupa nova");
    // sem seletor de cenário preferido (exercício 16): não há outra cena para este desafio
    expect(screen.queryByLabelText("Cenário que você prefere ver")).toBeNull();
    expect(cena().querySelectorAll(".cv-veste")).toHaveLength(4);
    expect(cena().querySelector(".cv-veste[data-vaga=voz]")?.getAttribute("src")).toBe("/flair/desafios/vestir-show/veste-2.webp");
    // a bandeja da vaga 1 põe primeiro a carta que é a roupa pedida
    expect(within(screen.getByTestId("mesa-bandeja")).getAllByRole("button", { name: /^Pôr/ })[0].getAttribute("aria-label")).toContain("Jaqueta militar");
    fireEvent.click(carta("Jaqueta militar"));
    await waitFor(() => expect(cena().getAttribute("data-vestidos")).toBe("1,0,0,0"), { timeout: 3000 });
    expect(cena().querySelector(".cv-veste[data-vaga=guitarra]")?.classList.contains("is-on")).toBe(true);
    // camiseta vermelha na vaga do vestido: o servidor recusa, a cantora continua de camiseta e a vaga avisa
    fireEvent.click(carta("Camiseta vermelha"));
    await waitFor(() => expect(vaga("voz").classList.contains("is-wrong")).toBe(true), { timeout: 3000 });
    expect(cena().getAttribute("data-vestidos")).toBe("1,0,0,0");
    expect(within(vaga("voz")).getByText("Não é esta roupa")).toBeTruthy();
    // troca pelo vestido: veste
    fireEvent.click(vaga("voz"));
    fireEvent.click(carta("Vestido vermelho"));
    await waitFor(() => expect(cena().getAttribute("data-vestidos")).toBe("1,1,0,0"), { timeout: 3000 });
    fireEvent.click(carta("Colete xadrez"));
    fireEvent.click(carta("Macacão preto"));
    await waitFor(() => expect(cena().getAttribute("data-vestidos")).toBe("1,1,1,1"), { timeout: 3000 });
    expect(cena().querySelector(".cv-depois")?.classList.contains("is-on")).toBe(true);
    expect(cena().getAttribute("aria-label")).toBe("Show no galpão: os 4 personagens vestem a roupa nova");
    // tirar a carta do guitarrista: ele volta à roupa de antes e a imagem DEPOIS sai
    fireEvent.click(vaga("guitarra"));
    fireEvent.click(within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: "Tirar" }));
    await waitFor(() => expect(cena().getAttribute("data-vestidos")).toBe("0,1,1,1"));
    expect(cena().querySelector(".cv-depois")?.classList.contains("is-on")).toBe(false);
    expect(calls.some((c) => /\/(preference|scenarios)$/.test(c.path))).toBe(false);
    await settle();
  });
});
