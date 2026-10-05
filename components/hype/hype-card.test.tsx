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

