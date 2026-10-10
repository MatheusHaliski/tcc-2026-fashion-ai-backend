// @vitest-environment jsdom
/**
 * Passarela 3D e Eras/Coleções no HypeScore v2 — RF53 · Lote 1 (P1-03, P2-07): a tabela e o card do look mostram o
 * `HypeBadge` v2 com a faixa em texto ("—" sem Hype público, nunca 0 nem o número v1), as curtidas à parte e a análise
 * completa só quando há Hype visível.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { RunwayPanel } from "@/components/showcase/runway-panel";
import { GroupHypeValue } from "@/components/showcase/showcase-tabs";

const owner = (u: string) => ({ id: u, username: u, displayName: u.toUpperCase(), avatarUrl: null });
const mannequin = { sex: "FEMININO", head: "PADRAO" };
const PUBLIC = { status: "AVAILABLE", score: 77.4, level: "TRENDING", direction: "UP", deltaPercent: 12, publicEligible: true };
const look = (id: string, title: string, hype: object, likes: number, hypeScore: number) =>
  ({ schemeId: id, title, owner: owner(`u${id}`), hypeScore, hype, likes, mannequin, pieces: [] });
const RUNWAY = (ranking: string) => ({
  date: "2026-10-05", nextUpdate: "2026-10-06T03:00:00Z", total: 2, totalToday: 2, ranking,
  rankings: ["TOP100_GLOBAL", "TOP100_REGIONAL", "TOP100_PAIS", "SEGUINDO", "EM_ALTA", "RECENTES"],
  looks: [
    { position: 1, source: "MANUAL", carriedOver: false, look: look("s1", "Look público", PUBLIC, 3, 10) },
    { position: 2, source: "MANUAL", carriedOver: true, look: look("s2", "Look só para seguidores", { status: "NOT_CALCULATED" }, 900, 99) },
  ],
  table: [
    { position: 1, schemeId: "s1", title: "Look público", owner: owner("us1"), hypeScore: 10, hype: PUBLIC, likes: 3, country: "BR", region: "América do Sul", you: false },
    { position: 2, schemeId: "s2", title: "Look só para seguidores", owner: owner("us2"), hypeScore: 99, hype: { status: "NOT_CALCULATED" }, likes: 900, country: "BR", region: "América do Sul", you: false },
  ],
  batch: { offset: 0, limit: 12, from: 1, to: 2, hasNext: false, hasPrev: false },
  facets: { regions: [], countries: [], colors: [], occasions: [], styles: [] },
});

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Passarela 3D › HypeScore v2 (P1-03)", () => {
  it("a tabela mostra o badge v2 com a faixa; sem Hype público é —; o v1 sumiu", async () => {
    mockApi({ "GET /api/explorer/runway": (url: URL) => RUNWAY(url.searchParams.get("ranking") ?? "TOP100_GLOBAL") });
    const { container } = renderApp(<RunwayPanel />);
    await screen.findByText(/Ordem: HypeScore v2 público/);
    const rows = within(container.querySelector("ol.divide-y") as HTMLElement).getAllByRole("listitem");
    expect(rows[0].textContent).toContain("🔥 77");
    expect(rows[0].textContent).toContain("Tendência");
    expect(rows[1].textContent).toContain("🔥 —");
    expect(rows[1].textContent).not.toContain("99");      // número v1 não aparece
    expect(screen.getByText(/Ordem: HypeScore v2 público/)).toBeTruthy();
    expect(container.querySelector(".hype-badge.is-trending")).toBeTruthy();
  });

  it("o card do look separa curtidas e Hype e só oferece a análise com Hype visível", async () => {
    mockApi({ "GET /api/explorer/runway": RUNWAY("TOP100_GLOBAL") });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("♥ 3 curtidas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver análise completa" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Look #2/ }));   // escolhe o look sem Hype público na passarela 2D
    expect(await screen.findByText(/♥ 900 curtidas/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver análise completa" })).toBeNull();
  });

  it("Em alta explica que a ordem é crescimento, não curtidas", async () => {
    mockApi({ "GET /api/explorer/runway": RUNWAY("EM_ALTA") });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText(/crescimento recente .* não curtidas/)).toBeTruthy();
  });
});

describe("Eras e Coleções › Hype v2 do grupo (P2-07)", () => {
  it("média com faixa em texto; sem Hype visível é — com o motivo", () => {
    renderApp(<><GroupHypeValue h={{ top: 81, avg: 69.6, level: "HOT", items: 2 }} /><GroupHypeValue h={{ top: null, avg: null, level: null, items: 0 }} /></>);
    expect(screen.getByText("70")).toBeTruthy();
    expect(screen.getByText("Em alta")).toBeTruthy();
    expect(screen.getByTitle("Maior Hype: 81")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Sem Hype público")).toBeTruthy();
  });
});
