// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";
import { CardFlipButton, FashionCard, FashionCardBack, FashionCardFront } from "@/components/fashion-card";
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeCardBack } from "@/components/hype/hype-card-back";
import { HypeHistoryChart } from "@/components/hype/hype-history-chart";
import { HypeAnalyticsDrawer, signalRows } from "@/components/hype/hype-analytics-drawer";
import { artStars, STARS_BY_LEVEL } from "@/components/hype/hype-back-art";
import { hypeViewState } from "@/lib/hype/model";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { HypeSummary } from "@/lib/hype/types";

const AVAILABLE: HypeSummary = {
  status: "AVAILABLE", stale: false, score: 82, level: "TRENDING", direction: "UP", deltaPoints: 10, deltaPercent: 14, momentum: "RISING",
  dimensions: { POPULARITY: 91, ENGAGEMENT: 84, TREND: 87, ORIGINALITY: 64, RARITY: 72, LONGEVITY: 78, NOVELTY: 69 }, calculatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2",
};
const summaries = (items: Record<string, HypeSummary>) => ({ type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items });
const card = (container: HTMLElement) => container.querySelector(".fcard") as HTMLElement;

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("FashionCard — frente e verso", () => {
  it("abre na frente: o verso nem é montado e a frente é interativa", () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    expect(card(container).dataset.flipped).toBe("front");
    expect(container.querySelector(".fcard-face.is-back")?.children.length).toBe(0);
    expect(container.querySelector(".fcard-face.is-front")?.hasAttribute("inert")).toBe(false);
  });

  it("↻ revela o verso (Hype analytics) e o outro ↻ volta para a frente", async () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver o Hype de Camiseta branca lisa/ }));
    expect(card(container).dataset.flipped).toBe("back");
    expect(container.querySelector(".fcard-face.is-front")?.hasAttribute("inert")).toBe(true);
    expect(await screen.findByText("HypeScore")).toBeTruthy();
    expect(screen.getByText("Popularidade")).toBeTruthy();
    expect(screen.getByText("Tendência")).toBeTruthy();   // faixa TRENDING em texto, não só cor
    fireEvent.click(screen.getByRole("button", { name: /Voltar para a frente do card de Camiseta branca lisa/ }));
    expect(card(container).dataset.flipped).toBe("front");
  });

  it("a frente mostra o Hype discreto com a seta do período", async () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    renderApp(<PieceCard piece={PIECE} />);
    expect(await screen.findByText("82")).toBeTruthy();
    expect(screen.getByText("subiu 14% em 7 dias")).toBeTruthy();
  });

  it("curtir continua curtindo e não vira o card", async () => {
    const api = loggedAs(undefined, { "GET /api/hype/summaries": summaries({ p1: AVAILABLE }), "POST /api/interactions/PIECE/p1/reactions": { active: true, count: 1 } });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    await settle();
    fireEvent.click(screen.getAllByRole("button", { name: /curt/i })[0]);
    await waitFor(() => expect(api.calls.some((c) => c.method === "POST" && c.path === "/api/interactions/PIECE/p1/reactions")).toBe(true));
    expect(card(container).dataset.flipped).toBe("front");
  });

  it("tocar na foto abre o detalhe, não vira o card", () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    fireEvent.click(container.querySelector(".pc-media") as HTMLElement);
    expect(card(container).dataset.flipped).toBe("front");
  });

  it("teclado: o ↻ é um botão focável, o foco segue o giro e Esc volta para a frente", async () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    const flip = screen.getByRole("button", { name: /Ver o Hype de/ });
    expect(flip.tagName).toBe("BUTTON");
    expect(flip.getAttribute("tabindex")).not.toBe("-1");
    fireEvent.click(flip);
    await waitFor(() => expect(document.activeElement?.getAttribute("data-side")).toBe("back"));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(card(container).dataset.flipped).toBe("front");
    await waitFor(() => expect(document.activeElement?.getAttribute("data-side")).toBe("front"));
  });

  it("numa grade, só o card clicado vira", () => {
    mockApi({});
    const { container } = renderApp(<>
      {["a", "b"].map((n) => <FashionCard key={n} name={n}><FashionCardFront><p>{n}</p><CardFlipButton side="front" /></FashionCardFront><FashionCardBack><CardFlipButton side="back" /></FashionCardBack></FashionCard>)}
    </>);
    fireEvent.click(screen.getByRole("button", { name: "Ver o Hype de a" }));
    const cards = container.querySelectorAll<HTMLElement>(".fcard");
    expect(cards[0].dataset.flipped).toBe("back");
    expect(cards[1].dataset.flipped).toBe("front");
  });

  it("look também vira (e o card ampliado não tem verso)", () => {
    mockApi({});
    const { container, rerender } = renderApp(<SchemeCard scheme={SCHEME} />);
    expect(container.querySelector(".fcard")).toBeTruthy();
    rerender(<SchemeCard scheme={SCHEME} expanded />);
    expect(container.querySelector(".fcard")).toBeNull();
  });

  it("movimento reduzido troca o giro 3D por uma troca simples de face (CSS)", () => {
    const css = readFileSync("app/(site)/globals.css", "utf8");
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .fcard-inner"));
    expect(block).toMatch(/\.fcard-inner, \.fcard\.is-flipped \.fcard-inner \{ transform: none; transition: none; \}/);
    expect(css).toMatch(/:root\[data-reduce-motion="true"\] \.fcard-inner/);
  });
});

describe("estados do Hype", () => {
  it("score 0 aparece como 0 (sinal baixo)", () => {
    renderApp(<HypeBadge state={hypeViewState({ status: "AVAILABLE", score: 0, level: "LOW_SIGNAL" })} />);
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Hype 0, Sinal baixo")).toBeTruthy();
  });

  it("score nulo (dados insuficientes) nunca vira 0", () => {
    const { container } = renderApp(<HypeBadge state={hypeViewState({ status: "INSUFFICIENT_DATA", score: null })} />);
    expect(screen.getByText("Hype: Dados insuficientes")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it("carregando e não calculado", () => {
    const { container, rerender } = renderApp(<HypeBadge state={hypeViewState(undefined, { loading: true })} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    rerender(<HypeBadge state={hypeViewState({ status: "NOT_CALCULATED" })} />);
    expect(screen.getByText("Hype: Hype ainda não calculado")).toBeTruthy();
  });

  it("desatualizado avisa, mas mantém o último valor", () => {
    const { container } = renderApp(<HypeBadge state={hypeViewState({ ...AVAILABLE, stale: true })} summary={{ ...AVAILABLE, stale: true }} />);
    expect(container.querySelector(".hype-badge.is-stale")?.getAttribute("title")).toBe("Desatualizado");
    expect(screen.getByText("82")).toBeTruthy();
  });

  it("verso com dados insuficientes explica em vez de mostrar barras zeradas", async () => {
    mockApi({ "GET /api/hype/summaries": summaries({ p9: { status: "INSUFFICIENT_DATA", score: null, calculatedAt: new Date().toISOString() } }) });
    const { container } = renderApp(<HypeCardBack type="PIECE" id="p9" name="Peça nova" />);
    expect(await screen.findByText("Dados insuficientes")).toBeTruthy();
    expect(container.querySelector(".hype-breakdown")).toBeNull();
  });

  it("erro de rede aparece no verso", async () => {
    mockApi({});   // /api/hype/summaries → 404
    renderApp(<HypeCardBack type="PIECE" id="p8" name="Peça" />);
    expect(await screen.findByText("Não foi possível carregar o Hype.")).toBeTruthy();
  });

  it("histórico vazio não desenha linha no zero", () => {
    const { container } = renderApp(<HypeHistoryChart points={[]} />);
    expect(screen.getByText(/Ainda sem histórico suficiente/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("cards da mesma grade pedem o Hype numa requisição só", async () => {
    const api = mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE, p2: AVAILABLE }) });
    renderApp(<><PieceCard piece={PIECE} /><PieceCard piece={{ ...PIECE, id: "p2" }} /></>);
    await waitFor(() => expect(screen.getAllByText("82").length).toBe(2));
    expect(api.calls.filter((c) => c.path.startsWith("/api/hype/summaries"))).toHaveLength(1);
  });
});

describe("fase 9: rede, tema e ações sociais", () => {
  it("salvar continua salvando e não vira o card", async () => {
    const api = loggedAs(undefined, { "GET /api/hype/summaries": summaries({ p1: AVAILABLE }), "POST /api/interactions/PIECE/p1/saves": { active: true } });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "POST" && c.path === "/api/interactions/PIECE/p1/saves")).toBe(true));
    expect(card(container).dataset.flipped).toBe("front");
  });

  it("offline: a frente continua inteira (sem Hype falso) e o verso explica a falha", async () => {
    mockApi({ "GET /api/hype/summaries": () => { throw new TypeError("Failed to fetch"); } });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    expect(screen.getAllByText("Camiseta branca lisa").length).toBeGreaterThan(0);   // identidade e foto seguem na frente
    fireEvent.click(screen.getByRole("button", { name: /Ver o Hype de Camiseta branca lisa/ }));
    expect(await screen.findByText("Não foi possível carregar o Hype.")).toBeTruthy();
    expect(container.querySelector(".fcard-face.is-front .hype-badge:not(.is-loading)")).toBeNull();   // nenhum "🔥 0" inventado
  });

  it("rede lenta: a frente mostra o carregamento e o valor chega depois, sem trocar de face", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const api = mockApi({ "GET /api/hype/summaries": summaries({ p1: AVAILABLE }) });
    const original = api.fetchMock.getMockImplementation()!;
    api.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input instanceof Request ? input.url : input).includes("/api/hype/summaries")) await gate;
      return original(input, init);
    });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    await waitFor(() => expect(container.querySelector(".hype-badge.is-loading[aria-busy='true']")).toBeTruthy());
    expect(screen.queryByText("82")).toBeNull();
    release();
    expect(await screen.findByText("82")).toBeTruthy();
    expect(card(container).dataset.flipped).toBe("front");
  });

  it("a faixa do Hype sempre tem texto (cor nunca é o único sinal, em qualquer tema)", () => {
    for (const [level, name] of [["LOW_SIGNAL", "Sinal baixo"], ["VIRAL", "Viral"]] as const) {
      const { container, unmount } = renderApp(<HypeBadge state={{ kind: "available", score: level === "VIRAL" ? 95 : 5, level, direction: null, stale: false }} />);
      expect(container.textContent).toContain(name);
      unmount();
    }
  });
});

describe("verso com arte dinâmica por faixa", () => {
  it("viral: céu dourado, halo, brilho e muitas estrelas; sinal baixo: arte tímida", async () => {
    mockApi({ "GET /api/hype/summaries": summaries({ v1: { ...AVAILABLE, score: 95, level: "VIRAL" }, l1: { ...AVAILABLE, score: 8, level: "LOW_SIGNAL" } }) });
    const { container: viral } = renderApp(<HypeCardBack type="PIECE" id="v1" name="Tênis" />);
    await waitFor(() => expect(viral.querySelector(".hype-art.is-viral")).toBeTruthy());
    expect(viral.querySelectorAll(".hype-art-star")).toHaveLength(STARS_BY_LEVEL.VIRAL);
    expect(viral.querySelector(".hype-art-halo")).toBeTruthy();
    expect(viral.querySelector(".hype-art-sheen")).toBeTruthy();
    expect(viral.querySelector(".hype-art")?.getAttribute("aria-hidden")).toBe("true");   // decorativa
    cleanup();
    const { container: low } = renderApp(<HypeCardBack type="PIECE" id="l1" name="Meia" />);
    await waitFor(() => expect(low.querySelector(".hype-art.is-low-signal")).toBeTruthy());
    expect(low.querySelectorAll(".hype-art-star")).toHaveLength(STARS_BY_LEVEL.LOW_SIGNAL);
    expect(low.querySelector(".hype-art-sheen, .hype-art-halo")).toBeNull();
  });

  it("cada faixa tem mais estrelas que a anterior, e o mesmo card tem sempre o mesmo céu, nas bordas", () => {
    const order = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"] as const;
    order.slice(1).forEach((lv, i) => expect(STARS_BY_LEVEL[lv]).toBeGreaterThan(STARS_BY_LEVEL[order[i]]));
    expect(artStars("p1", "HOT")).toEqual(artStars("p1", "HOT"));
    expect(artStars("p1", "HOT")).not.toEqual(artStars("p2", "HOT"));
    for (const s of artStars("p1", "VIRAL")) expect(s.y < 25 || s.x < 17 || s.x > 83).toBe(true);   // miolo livre para os dados
  });

  it("o CSS pausa a arte fora do verso, para com movimento reduzido e some no alto contraste", () => {
    const css = readFileSync("app/(site)/globals.css", "utf8");
    expect(css).toMatch(/\.fcard:not\(\.is-flipped\) \.hype-art[^{]*\{[^}]*animation-play-state: paused/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.hype-art \*, \.hype-art \{ animation: none/);
    expect(css).toMatch(/data-theme="contrast"\] \.hype-art \{ display: none; \}/);
  });
});

describe("análise completa conectada aos dados", () => {
  const DETAIL = { ...AVAILABLE, entityType: "SCHEME", entityId: "s1", reasons: [], publicEligible: true, weights: { POPULARITY: 0.2 },
    signals: { byType: { LIKE_CREATED: { current: 5, previous: 2, total: 9 }, LOOK_REMIXED: { current: 1, previous: 0, total: 1 }, PIECE_REMIXED: { current: 1, previous: 1, total: 2 }, SAVE_CREATED: { current: 0, previous: 0, total: 0 } } },
    pieces: [{ id: "p1", name: "Tênis branco", category: "shoes_piece", subcategory: null, imageUrl: null, hype: { ...AVAILABLE, score: 77, level: "TRENDING" } }] };

  it("sinais reais por tipo (remixes somados, sem linha zerada), peso de cada dimensão, peças do look e posição", async () => {
    mockApi({
      "GET /api/hype/looks/s1": DETAIL,
      "GET /api/hype/looks/s1/history": { entityType: "SCHEME", entityId: "s1", points: [] },
      "GET /api/hype/looks/s1/positions": { eligible: true, window: 7, positions: [{ scope: "REGION", key: "AMERICA_DO_SUL", label: "América do Sul", rank: 3, total: 40 }] },
    });
    renderApp(<HypeAnalyticsDrawer type="SCHEME" id="s1" name="Look de sábado" open onClose={() => {}} />);
    expect(await screen.findByText("Sinais que alimentam o Hype")).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "curtidas" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "remixes" }).closest("tr")?.textContent).toContain("2");   // 1 + 1 na janela atual
    expect(screen.queryByRole("rowheader", { name: "salvamentos" })).toBeNull();
    expect(screen.getByText("peso 20%")).toBeTruthy();
    expect(screen.getByText("Tênis branco")).toBeTruthy();
    expect(await screen.findByText("de 40 na região América do Sul")).toBeTruthy();
  });

  it("peça recém-criada: avisa que o cálculo entra em minutos (sem barras zeradas)", async () => {
    mockApi({ "GET /api/hype/pieces/n1": { status: "NOT_CALCULATED" }, "GET /api/hype/pieces/n1/history": { points: [] }, "GET /api/hype/pieces/n1/positions": { eligible: false, window: 7, positions: [] } });
    const { container } = renderApp(<HypeAnalyticsDrawer type="PIECE" id="n1" name="Peça nova" open onClose={() => {}} />);
    expect(await screen.findByText(/entram no cálculo em até 2 minutos/)).toBeTruthy();
    expect(container.ownerDocument.querySelector(".hype-breakdown")).toBeNull();
  });

  it("signalRows agrupa por rótulo e ordena pelos mais ativos", () => {
    expect(signalRows(DETAIL.signals.byType).map(([k]) => k)).toEqual(["LIKES", "REMIXES"]);
    expect(signalRows(undefined)).toEqual([]);
  });
});

