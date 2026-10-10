// @vitest-environment jsdom
/**
 * RF53 · Lote 9 (docs/hype/HYPE_AUDITORIA_ABAS.md): detalhes pessoais e privacidade do HypeScore.
 * P2-19 Configurações › Privacidade explica o Hype · P3-05 Hype de cada look em "Looks com esta peça" · P3-10 Uso de
 * peças: Hype nas paradas + Redescoberta · P3-11 Destaques: maior crescimento de Hype · P3-13 dica da exportação LGPD.
 * Regras: faixa sempre em texto, "sem dados" nunca vira 0, um pedido de Hype por lista (lote).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, page } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { API_BASE } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";
import SettingsPage from "@/app/(site)/(app)/settings/page";
import HighlightsPage from "@/app/(site)/(app)/highlights/page";
import { HistoryUsage } from "@/components/history/history-usage";
import { ExpandedPiece } from "@/components/expanded-card";

const AVAILABLE = { status: "AVAILABLE", score: 81, level: "TRENDING", direction: "UP", deltaPoints: 9, deltaPercent: 12, calculatedAt: new Date().toISOString() };
/** /api/hype/summaries: só devolve os ids conhecidos (o resto some, como item sem cálculo ou sem permissão). */
const summaries = (known: Record<string, object>) => ({
  "GET /api/hype/summaries": (u: URL) => {
    const ids = (u.searchParams.get("ids") ?? "").split(",");
    return { type: u.searchParams.get("type"), algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: Object.fromEntries(ids.filter((i) => known[i]).map((i) => [i, known[i]])) };
  },
});
const hypeCalls = (calls: { method: string; path: string }[], type: string) => calls.filter((c) => c.path.startsWith(`/api/hype/summaries?type=${type}`));

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("P2-19 · Configurações › Privacidade explica o HypeScore", () => {
  const routes = { "GET /api/me/preferences": { theme: "AUTO", language: "PT_BR", density: "COMFORTABLE", fontScale: 100, highContrast: false, reduceMotion: false }, "GET /api/me/consents": [], "GET /api/me/exports": [] };

  it("mostra o que entra no Hype público, o Hype pessoal, perfil privado fora dos rankings, patrocínio fora e o link do método", async () => {
    loggedAs({ ...ME, profileVisibility: "PRIVATE" } as Me & { profileVisibility: string }, routes);
    renderApp(<SettingsPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Privacidade" }));
    expect(await screen.findByRole("heading", { name: "HypeScore e privacidade" })).toBeTruthy();
    expect(screen.getByText(/só peças e looks públicos e aprovados, de perfis não privados/)).toBeTruthy();
    expect(screen.getByText(/o item tem só Hype pessoal, que apenas você vê/)).toBeTruthy();
    expect(screen.getByText(/Perfil privado: nenhum item seu entra nos rankings/)).toBeTruthy();
    expect(screen.getByText(/Patrocínio, promoções, cupons e FAI Points nunca entram no Hype/)).toBeTruthy();
    // o estado atual do perfil da pessoa
    expect(screen.getByText(/Seu perfil está privado: hoje nenhum item seu entra nos rankings/)).toBeTruthy();
    // marcos só de subida, com o caminho para desligar
    expect(screen.getByText(/nunca quando cai/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Notificações" }).getAttribute("href")).toBe("/notifications");
    const method = screen.getByRole("link", { name: "Ver o método e os pesos (técnico)" });
    expect(method.getAttribute("href")).toBe(`${API_BASE}/api/hype/method`);
    expect(method.getAttribute("rel")).toContain("noopener");
  });

  it("perfil aberto: diz que itens públicos podem entrar no Hype público; a aba Dados avisa que a exportação leva o Hype pessoal", async () => {
    loggedAs(undefined, routes);
    renderApp(<SettingsPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Privacidade" }));
    expect(await screen.findByText(/Seu perfil não é privado/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Seus dados (LGPD)" }));
    expect(await screen.findByText("Inclui o seu Hype pessoal: estado atual, histórico diário e marcos.")).toBeTruthy();
  });
});

describe("P3-05 · Looks com esta peça", () => {
  it("cada look mostra o próprio Hype v2 (faixa em texto) num pedido só; sem dados = —, nunca 0", async () => {
    const api = loggedAs(undefined, {
      ...summaries({ s1: AVAILABLE }),
      "GET /api/pieces/p1": { piece: PIECE, originSchemes: [{ schemeId: "s1", title: "Look de sábado" }, { schemeId: "s2", title: "Look sem cálculo" }] },
    });
    renderApp(<ExpandedPiece id="p1" />);
    await settle();
    const heading = await screen.findByRole("heading", { name: "Looks com esta peça" });
    const section = heading.closest("section") as HTMLElement;
    await waitFor(() => expect(section.textContent).toContain("Hype 81, Tendência"));
    const rows = Array.from(section.querySelectorAll("button"));
    expect(rows[0].querySelector(".hype-badge b")?.textContent).toBe("81");
    expect(rows[1].querySelector(".hype-badge.is-empty")?.textContent).toContain("—");
    expect(rows[1].textContent).not.toMatch(/🔥\s*0/);
    expect(hypeCalls(api.calls, "SCHEME")).toHaveLength(1);
    expect(hypeCalls(api.calls, "SCHEME")[0].path).toContain("ids=s1,s2");
  });
});

describe("P3-10 · Histórico › Uso de peças", () => {
  it("só a lista das paradas mostra o Hype (em lote) e leva à Redescoberta", async () => {
    const api = loggedAs(undefined, {
      ...summaries({ p2: AVAILABLE }),
      "GET /api/me/closet": (u: URL) => page(u.searchParams.get("sort") === "idle" ? [PIECE_2, PIECE] : [PIECE]),
    });
    const { container } = renderApp(<HistoryUsage />);
    await settle();
    await waitFor(() => expect(container.textContent).toContain("Hype 81, Tendência"));
    const cards = Array.from(container.querySelectorAll(".hype-items"));
    expect(cards).toHaveLength(3);
    expect(cards[0].querySelector(".hype-badge")).toBeNull();   // mais usadas: uso ≠ Hype, sem badge
    expect(cards[1].querySelector(".hype-badge")).toBeNull();
    expect(cards[2].querySelectorAll(".hype-badge")).toHaveLength(2);
    expect(cards[2].querySelector(".hype-badge.is-empty")?.textContent).toContain("—");   // p1 sem cálculo
    expect(screen.getByRole("link", { name: "Ver redescobertas (Histórico › Hype)" }).getAttribute("href")).toBe("/history?tab=hype");
    expect(hypeCalls(api.calls, "PIECE")).toHaveLength(1);
  });
});

describe("P3-11 · Destaques › maior crescimento de Hype", () => {
  const HIGHLIGHTS = { eligible: true, pieces: 12, manifesto: "Seu guarda-roupa", score: 640, band: "Bom", dimensions: [], highlights: [{ emoji: "⭐", title: "Peça do mês", name: "Jaqueta", value: "8 usos" }], achievements: [] };

  it("mostra a peça que mais cresceu, com a janela da variação e separado do Inventory Score", async () => {
    loggedAs(undefined, {
      "GET /api/me/highlights": HIGHLIGHTS,
      "GET /api/me/hype/wardrobe": { algorithmVersion: "HYPE_V2", deltaWindowDays: 7, pieces: 12, piecesWithHype: 5, looks: 2, highlights: { biggestGrowth: { type: "PIECE", id: "p2", metric: "deltaPoints", value: 14, hype: AVAILABLE, piece: PIECE_2 } }, rediscoveries: [] },
    });
    renderApp(<HighlightsPage />);
    expect(await screen.findByRole("heading", { name: "Maior crescimento de Hype" })).toBeTruthy();
    expect(await screen.findByText(/Variação em 7 dias\. O Hype mede relevância no FashionAI e é separado do Inventory Score/)).toBeTruthy();
    const row = screen.getByRole("link", { name: /Calça jeans reta/ });
    expect(row.getAttribute("href")).toBe("/pieces/p2");
    expect(row.textContent).toContain("+14 pts no período");
    expect(row.textContent).toContain("Hype 81, Tendência");
    expect(screen.getByRole("link", { name: "Ver Hype no Histórico" }).getAttribute("href")).toBe("/history?tab=hype");
    expect(screen.getByText(/Peça do mês/)).toBeTruthy();   // os destaques do Inventory Score continuam
  });

  it("sem crescimento: texto neutro, nunca um 0", async () => {
    loggedAs(undefined, {
      "GET /api/me/highlights": HIGHLIGHTS,
      "GET /api/me/hype/wardrobe": { algorithmVersion: "HYPE_V2", deltaWindowDays: 7, pieces: 3, piecesWithHype: 0, looks: 0, highlights: {}, rediscoveries: [] },
    });
    renderApp(<HighlightsPage />);
    expect(await screen.findByText("Nenhuma peça cresceu de forma clara nesse período.")).toBeTruthy();
  });
});
