// @vitest-environment jsdom
/**
 * Carta FLAIR da peça com o desenho do card comum (docs/flair/carta-flair-peca-2026-11-06.md): a mesma anatomia
 * (cabeçalho, foto, identificação, janela Info | Hype) e, como única diferença, a arte de fundo por nível.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { FlairGameCard, type FlairCollectionCard } from "./flair-game-card";
import { flairHypeSummary } from "./flair-piece-card-panels";

afterEach(cleanup);

const CARD = (over: Partial<FlairCollectionCard> = {}): FlairCollectionCard => ({ id: "c1", originType: "PIECE", originId: "p1", season: "SUMMER", tier: "OURO", ovr: 82,
  rare: true, position: "CAL", name: "Tênis Aero", brandName: "Norte Sport", imageUrl: "/media/p.png", category: "shoes_piece", subcategory: "casual_sneakers",
  hype: { POP: 71, RAR: 40, ENG: 66, LON: 58, TRD: 74, NOV: 62, ORI: 55, HYP: 68 }, stats: { EDGE: 72, RANGE: 60, CLOUT: 51, GLOW: 88, ART: 40, SYNC: 95 },
  ability: { code: "A1", name: "Passo leve", text: "+2 de sintonia" }, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED",
  basis: { priceUsed: 399, priceVerified: true }, ...over });

describe("FlairGameCard · a carta FLAIR com a anatomia do card comum", () => {
  it("é um .fai-card.piece-card com a arte de fundo do nível e a janela segmentada Info | Hype", () => {
    loggedAs();
    const { container } = renderApp(<FlairGameCard card={CARD()} />);
    const card = screen.getByRole("article", { name: "Carta FLAIR Ouro rara, nota 82, Tênis Aero, Norte Sport" });
    expect(card.className).toContain("fai-card piece-card pc flair-piece-card fpc-md tier-ouro is-rare");
    expect(card.getAttribute("data-card-mode")).toBe("feed");
    expect(card.querySelector(".pc-art.fpc-art")?.getAttribute("aria-hidden")).toBe("true");         // a arte é decorativa
    expect(card.querySelector(".pc-frame > .pc-content > .pc-header")).toBeTruthy();
    expect(card.querySelector(".pc-content > .pc-media img")?.getAttribute("src")).toContain("/media/p.png");
    expect(card.querySelector(".pc-media img")?.getAttribute("loading")).toBe("lazy");
    expect(card.querySelector(".pc-id .pc-name")?.textContent).toBe("Tênis Aero");
    expect(card.querySelector(".pc-id .pc-sub")?.textContent).toBe("Norte Sport · Temporada Verão");
    expect(card.querySelector(".pc-id .pc-panels .pc-seg")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((b) => b.textContent)).toEqual(["Info🔥 68Hype 68, Em alta", "Hype"]);   // selo de Hype da aba Info, com o texto para leitor de tela
    expect(container.querySelector(".fgc")).toBeNull();                                               // o desenho antigo não existe mais
  });

  it("cabeçalho: nota em LED, posição e o nível escrito (nunca só pela cor), no lugar de quem publicou", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD({ rare: false })} />);
    const head = document.querySelector(".pc-header")!;
    expect(head.querySelector(".fpc-ovr .led-number")?.textContent).toBe("82");
    expect(head.querySelector(".fpc-ovr")?.textContent).toContain("CAL");
    expect(head.querySelector(".c-who b")?.textContent).toBe("Ouro");
    expect(head.querySelector(".c-avatar")).toBeNull();
  });

  it("aba Hype (inicial) mostra a matriz do card comum a partir do snapshot; aba Info traz as linhas do jogo", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD()} />);
    const hype = screen.getByRole("tab", { name: /^Hype/ });
    expect(hype.getAttribute("aria-selected")).toBe("true");
    const cells = Array.from(document.querySelectorAll(".fashion-hype-cell")).map((c) => [c.getAttribute("data-dimension"), c.querySelector("dd")?.textContent]);
    expect(cells).toEqual([["POPULARITY", "71"], ["ENGAGEMENT", "66"], ["TREND", "74"], ["TREND_VELOCITY", "—"], ["ORIGINALITY", "55"], ["RARITY", "40"], ["LONGEVITY", "58"], ["NOVELTY", "62"]]);
    fireEvent.click(screen.getByRole("tab", { name: /Info/ }));
    const rows = Array.from(document.querySelectorAll(".pc-info > div")).map((r) => [r.querySelector("dt")?.textContent, r.querySelector("dd")?.textContent]);
    expect(rows).toEqual([
      ["Marca", "NSNorte Sport"], ["Categoria", "Tênis casual"], ["Nível", "Ouro · rara"], ["Nota", "82"], ["Posição", "CAL"],
      ["Atributos de jogo", "72EDGE60RANGE51CLOUT88GLOW40ART95SYNC"], ["Habilidade", "Passo leve · +2 de sintonia"], ["Temporada", "Verão"],
      ["Preço", "R$\u00a0399,00 · confirmado no catálogo"],
    ]);
  });

  it("setas trocam de aba e o painel aponta para a aba ativa", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD()} flip={false} />);
    const list = screen.getByRole("tablist", { name: "Info e Hype de Tênis Aero" });
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Info/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: /Info/ }).id);
  });

  it("sem snapshot nem preço: '—' em todos os atributos e sem a linha de preço; sem marca diz 'Sem marca'", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD({ hype: null, stats: null, basis: null, brandName: null, ability: null })} flip={false} />);
    expect(Array.from(document.querySelectorAll(".fashion-hype-cell dd")).every((d) => d.textContent === "—")).toBe(true);
    expect(screen.getByRole("tab", { name: /Info/ }).textContent).toContain("🔥 —");
    fireEvent.click(screen.getByRole("tab", { name: /Info/ }));
    const rows = Array.from(document.querySelectorAll(".pc-info > div dt")).map((d) => d.textContent);
    expect(rows).toEqual(["Marca", "Categoria", "Nível", "Nota", "Posição", "Atributos de jogo", "Temporada"]);
    expect(Array.from(document.querySelectorAll(".fpc-stat b")).map((b) => b.textContent)).toEqual(["—", "—", "—", "—", "—", "—"]);
    expect(document.querySelector(".pc-sub")?.textContent).toBe("Sem marca · Temporada Verão");
  });

  it("flip: ↻ no cabeçalho vira para o verso do card comum (Hype da peça); sem flip, só a frente", () => {
    loggedAs(undefined, { "GET /api/hype/PIECE/p1": { status: "AVAILABLE", score: 68, level: "HOT", dimensions: {} } });
    const { unmount } = renderApp(<FlairGameCard card={CARD()} />);
    const flip = screen.getByRole("button", { name: "Ver o Hype de Tênis Aero" });
    expect(flip.closest(".pc-header")).toBeTruthy();
    expect(document.querySelector(".fcard.fpc-flip.fpc-md")).toBeTruthy();
    fireEvent.click(flip);
    expect(document.querySelector(".fcard")?.getAttribute("data-flipped")).toBe("back");
    expect(screen.getByRole("region", { name: "Hype de Tênis Aero" }).querySelector(".hype-back")).toBeTruthy();
    unmount();
    renderApp(<FlairGameCard card={CARD()} flip={false} />);
    expect(screen.queryByRole("button", { name: /Ver o Hype/ })).toBeNull();
    expect(document.querySelector(".fcard")).toBeNull();
  });

  it("carta que não vem de uma peça vira para um verso simples com os atributos de jogo", () => {
    loggedAs();
    renderApp(<FlairGameCard card={CARD({ originType: "LOOK", originId: "s1" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver o Hype de Tênis Aero" }));
    const back = screen.getByRole("article", { name: "Verso da carta Tênis Aero" });
    expect(back.className).toContain("flair-piece-back");
    expect(Array.from(back.querySelectorAll(".fpc-bars li b")).map((b) => b.textContent)).toEqual(["72", "60", "51", "88", "40", "95"]);
    expect(back.textContent).toContain("Passo leve");
    expect(back.textContent).toContain("Temporada Verão");
  });

  it("tamanhos e estados: sm/md/lg viram classes de largura; entregue em desafio fica is-locked com o texto", () => {
    loggedAs();
    const { container } = renderApp(<FlairGameCard card={CARD({ state: "LOCKED_CHALLENGE" })} size="sm" flip={false} />);
    const card = container.querySelector("article")!;
    expect(card.className).toContain("fpc-sm");
    expect(card.className).toContain("is-locked");
    expect(card.querySelector(".pc-header .c-who span")?.textContent).toBe("Entregue em desafio");
  });

  it("flairHypeSummary: snapshot vira HypeSummary com as dimensões do card comum; vazio vira dados insuficientes", () => {
    expect(flairHypeSummary(null)).toEqual({ status: "INSUFFICIENT_DATA" });
    expect(flairHypeSummary({ POP: null, HYP: null })).toEqual({ status: "INSUFFICIENT_DATA" });
    expect(flairHypeSummary({ POP: 12, ENG: 47, HYP: 39 })).toEqual({ status: "AVAILABLE", score: 39, level: "NICHE", dimensions: { POPULARITY: 12, ENGAGEMENT: 47 } });
    expect(flairHypeSummary({ TRD: 90 })).toEqual({ status: "AVAILABLE", score: null, level: null, dimensions: { TREND: 90 } });
  });
});
