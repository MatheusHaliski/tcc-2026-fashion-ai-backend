// @vitest-environment jsdom
/**
 * Globo interativo (RF26) sem e com Hype: nomes dos países, pontos acesos/apagados, arrastar para girar, giro automático,
 * centralizar o país selecionado e a lista numerada de cards em telas estreitas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { COUNTRIES, Globe, countryName, levelColor, reducedMotion, type GlobePoint } from "@/components/globe";
import type { HypeGlobe, HypeGlobeCountry } from "@/lib/hype/types";

const top = (iso: string, score: number, level: string, available = true) => ({ id: `p-${iso}`, type: "PIECE" as const, name: `Bolsa de ${iso}`, imageUrl: available ? `/assets_pecas/${iso}.png` : null, category: "bags",
  owner: { username: `ana.${iso.toLowerCase()}` }, hype: available ? { status: "AVAILABLE" as const, score, level: level as never } : { status: "INSUFFICIENT_DATA" as const, score: null, level: null } });
const country = (iso: string, over: Partial<HypeGlobeCountry> = {}): HypeGlobeCountry => ({
  country: iso, region: "AMERICA_DO_SUL", regionLabel: "América do Sul", count: 5, creators: 2, avgHype: 50, maxHype: 80, avgLevel: "RELEVANT", maxLevel: "TRENDING",
  trend: 40, rising: 1, levels: { RELEVANT: 3 }, topLevel: "TRENDING", dominantColorHex: "#1f4f7a", topCategory: "bags", top: top(iso, 80, "TRENDING"), sufficient: true, ...over,
});
const GLOBE = (countries: HypeGlobeCountry[]): HypeGlobe => ({
  type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", filters: { category: null, subcategory: null, minLevel: null }, minItems: 3,
  world: { count: 20, avgHype: 50, maxHype: 90, creators: 8 }, countries, regions: [],
} as HypeGlobe);

const POINTS: GlobePoint[] = [
  { country: "BR", total: 10, schemes: 4, pieces: 6, avg_hype: 72, dominantColorHex: "#AA3300", sufficient: true },
  { country: "AR", total: 2, schemes: 1, pieces: 1, avg_hype: null, dominantColorHex: null, sufficient: false },
  { country: "US", total: 6, schemes: 3, pieces: 3, sufficient: true },
  { country: "ZZ", total: 3, schemes: 1, pieces: 2, sufficient: true },   // país sem centroide: não aparece
  { country: "JP", total: 4, schemes: 2, pieces: 2, sufficient: true },   // atrás do horizonte na rotação inicial
];

const media = (reduce: boolean) => (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, onchange: null, addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
let frames: FrameRequestCallback[] = [];
const flush = (n = 1, dt = 16) => act(() => { for (let i = 0; i < n; i++) { const now = performance.now() + (i + 1) * dt; frames.splice(0).forEach((cb) => cb(now)); } });

beforeEach(() => {
  frames = [];
  vi.stubGlobal("matchMedia", media(true));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.reduceMotion; });

const landD = (c: HTMLElement) => c.querySelectorAll("svg > path")[1].getAttribute("d");

describe("Globo › nomes e cores", () => {
  it("todo país do acervo tem nome em português; ISO desconhecido volta como veio", () => {
    for (const iso of Object.keys(COUNTRIES)) {
      expect(countryName(iso)).not.toBe(iso);
      expect(countryName(iso).length).toBeGreaterThan(2);
    }
    expect(countryName("BR")).toBe("Brasil");
    expect(countryName("XX")).toBe("XX");
  });

  it("cor da faixa usa a variável do tema; sem faixa usa o cinza apagado", () => {
    expect(levelColor("LOW_SIGNAL")).toBe("var(--globe-lvl-low-signal, #7E8794)");
    expect(levelColor(null)).toBe("var(--globe-dim, #8a96a3)");
  });

  it("reduzir movimento vale pelo sistema ou pela preferência do app", () => {
    vi.stubGlobal("matchMedia", media(false));
    expect(reducedMotion()).toBe(false);
    document.documentElement.dataset.reduceMotion = "true";
    expect(reducedMotion()).toBe(true);
  });
});

describe("Globo › pontos por país (sem Hype)", () => {
  it("país com dados suficientes acende com rótulo; com poucos dados fica apagado; sem centroide ou atrás do horizonte some", () => {
    const onSelect = vi.fn();
    const { container } = renderApp(<Globe points={POINTS} selected="BR" onSelect={onSelect} />);
    const pts = Array.from(container.querySelectorAll(".globe-point"));
    const br = pts.find((g) => g.querySelector("title")!.textContent!.startsWith("Brasil"))!;
    const ar = pts.find((g) => g.querySelector("title")!.textContent!.startsWith("Argentina"))!;
    expect(br.getAttribute("class")).toContain("lit");
    expect(br.getAttribute("class")).toContain("on");
    expect(br.querySelector("text")!.textContent).toBe("BR");
    expect(br.querySelector("title")!.textContent).toContain("72");
    expect(ar.getAttribute("class")).toContain("dim");
    expect(ar.querySelector("text")).toBeNull();
    expect(ar.querySelector("title")!.textContent).toContain("—");
    expect(pts).toHaveLength(3);   // BR, AR, US (ZZ sem centroide, JP atrás)
    fireEvent.click(ar);
    expect(onSelect).toHaveBeenCalledWith("AR");
    expect(screen.getByText("arraste para girar · clique num ponto para ver o país")).toBeTruthy();
  });

  it("arrastar gira o globo (latitude limitada) e soltar encerra o arraste", () => {
    const { container } = renderApp(<Globe points={POINTS} onSelect={() => undefined} size={300} />);
    const svg = container.querySelector("svg")!;
    const before = landD(container);
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 50 });   // sem arraste: nada muda
    expect(landD(container)).toBe(before);
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 220, clientY: 900 });
    const moved = landD(container);
    expect(moved).not.toBe(before);
    fireEvent.pointerUp(svg);
    fireEvent.pointerMove(svg, { clientX: 0, clientY: 0 });
    expect(landD(container)).toBe(moved);
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 2 });
    fireEvent.pointerLeave(svg);
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 10 });
    expect(landD(container)).toBe(moved);
  });

  it("sem reduzir movimento o globo gira sozinho e pausa sob o ponteiro ou foco", () => {
    vi.stubGlobal("matchMedia", media(false));
    const { container } = renderApp(<Globe points={POINTS} onSelect={() => undefined} />);
    const d0 = landD(container);
    flush(3);
    const d1 = landD(container);
    expect(d1).not.toBe(d0);
    const box = container.querySelector(".globe")!;
    fireEvent.pointerEnter(box);
    flush(3);
    expect(landD(container)).toBe(d1);
    fireEvent.pointerLeave(box);
    fireEvent.focus(box);
    flush(2);
    expect(landD(container)).toBe(d1);
    fireEvent.blur(box);
    flush(2);
    expect(landD(container)).not.toBe(d1);
  });

  it("selecionar um país centraliza o globo nele (o Japão passa para a frente)", () => {
    const { container, rerender } = renderApp(<Globe points={POINTS} onSelect={() => undefined} />);
    expect(container.querySelectorAll(".globe-point")).toHaveLength(3);
    rerender(<Globe points={POINTS} selected="JP" onSelect={() => undefined} />);
    flush(120);
    const titles = Array.from(container.querySelectorAll(".globe-point title")).map((t) => t.textContent);
    expect(titles.some((t) => t!.startsWith("Japão"))).toBe(true);
    expect(titles.some((t) => t!.startsWith("Brasil"))).toBe(false);
  });

  it("selecionar um ISO sem centroide não mexe no globo", () => {
    const { container, rerender } = renderApp(<Globe points={POINTS} onSelect={() => undefined} />);
    const d0 = landD(container);
    rerender(<Globe points={POINTS} selected="ZZ" onSelect={() => undefined} />);
    flush(5);
    expect(landD(container)).toBe(d0);
  });
});

describe("Globo › Hype com pontos-âncora e cards", () => {
  const DATA = GLOBE([
    country("BR", { avgHype: 70 }),
    country("US", { avgHype: 60, top: top("US", 0, "", false) }),   // destaque sem Hype disponível
    country("AR", { avgHype: 40 }),
  ]);

  it("no modo Hype os pontos viram âncoras discretas e o anel marca o país selecionado", () => {
    const { container } = renderApp(<Globe points={POINTS} selected="AR" onSelect={() => undefined} hype={{ data: DATA, layers: ["numbers"], metric: "avg" }} />);
    expect(container.querySelector(".globe")!.getAttribute("class")).toContain("has-hype");
    const anchors = container.querySelectorAll(".globe-point.is-anchor");
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors[0].querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelector(".globe-sel-ring")).toBeTruthy();
    expect(screen.getByRole("group", { name: /3/ })).toBeTruthy();
  });

  it("card sem Hype disponível mostra 'dados insuficientes'; sem onOpen, abrir o card seleciona o país", () => {
    const onSelect = vi.fn();
    const { container } = renderApp(<Globe points={[]} onSelect={onSelect} hype={{ data: DATA, layers: ["cards"], metric: "avg" }} />);
    const us = container.querySelector('.globe-card[data-country="US"]')!;
    expect(us.querySelector(".globe-card-chip")).toBeNull();
    expect(us.querySelector(".globe-card-level")!.textContent!.length).toBeGreaterThan(0);
    expect(us.querySelector("image")).toBeNull();
    expect(container.querySelector('.globe-card[data-country="BR"] image')).toBeTruthy();
    const body = us.querySelector(".globe-card-body")!;
    fireEvent.keyDown(body, { key: "a" });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(body, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("US");
    fireEvent.pointerDown(body);
    fireEvent.click(container.querySelector('.globe-card[data-country="BR"] .globe-card-body')!);
    expect(onSelect).toHaveBeenLastCalledWith("BR");
  });

  it("tela estreita: os cards viram lista numerada sob o globo, com marcador no país", () => {
    class NarrowRO { cb: ResizeObserverCallback; constructor(cb: ResizeObserverCallback) { this.cb = cb; } observe() { this.cb([{ contentRect: { width: 380 } } as ResizeObserverEntry], this as unknown as ResizeObserver); } unobserve() {} disconnect() {} }
    vi.stubGlobal("ResizeObserver", NarrowRO);
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    const { container } = renderApp(<div><Globe points={[]} selected="BR" onSelect={onSelect} hype={{ data: DATA, layers: ["cards"], metric: "avg", onOpen }} /></div>);
    expect(container.querySelector(".globe-layer-cards")).toBeNull();
    const rows = container.querySelectorAll(".globe-cards-list li");
    expect(rows).toHaveLength(3);
    expect(container.querySelectorAll(".globe-card-marker")).toHaveLength(3);
    expect(rows[0].querySelector(".globe-card-num")!.textContent).toBe("1");
    expect(rows[0].querySelector("button")!.getAttribute("class")).toContain("is-selected");
    expect(rows[0].querySelector(".globe-card-row-score")!.textContent).toContain("80");
    expect(rows[0].querySelector("img")).toBeTruthy();
    const usRow = Array.from(rows).find((r) => r.textContent!.includes("Bolsa de US"))!;
    expect(usRow.querySelector(".globe-card-row-score")).toBeNull();
    expect(usRow.querySelector("img")).toBeNull();
    fireEvent.click(rows[0].querySelector("button")!);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p-BR" }), "BR");
  });
});
