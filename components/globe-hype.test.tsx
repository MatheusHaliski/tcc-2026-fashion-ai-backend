// @vitest-environment jsdom
/**
 * Globo do Painel global com camadas de Hype (RF53 × RF26): regras puras (filtros ⇄ URL, altura e topo das colunas,
 * bonecos, escolha e empilhamento dos cards), o desenho de cada camada no globo (some atrás do horizonte) e a aba do
 * Explorador (barra de filtros → consulta e URL, tabela, painel do país, busca anônima para quem não entrou).
 * Lote A3: colunas com altura na tela proporcional à métrica (mínimo visível para país suficiente), bonecos 2× e a
 * pílula do número sempre acima da coluna e da cabeça dos bonecos (countryMarks).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import { Globe } from "@/components/globe";
import ExplorerPage from "@/app/(site)/(app)/explorer/page";
import {
  COLUMN_CAP, COLUMN_MAX, COLUMN_MIN, COLUMN_W, DEFAULT_GLOBE_LAYERS, FIGURE_H, FIGURE_SCALE, columnDirection, columnHeight, columnTop, countryMarks, figuresFor, globeFiltersFrom,
  globeQuery, globeSearch, hypeShown, levelFromScore, overlaps, pickCards, pillWidth, stackCards, type GlobeLayer,
} from "@/lib/hype/globe";
import type { HypeGlobe, HypeGlobeCountry } from "@/lib/hype/types";

const top = (iso: string, score: number, level: string) => ({ id: `p-${iso}`, type: "PIECE" as const, name: `Tênis de ${iso}`, imageUrl: `/assets_pecas/${iso}.png`, category: "shoes_piece",
  owner: { username: `ana.${iso.toLowerCase()}` }, hype: { status: "AVAILABLE" as const, score, level: level as never } });
const country = (iso: string, over: Partial<HypeGlobeCountry> = {}): HypeGlobeCountry => ({
  country: iso, region: "AMERICA_DO_SUL", regionLabel: "América do Sul", count: 5, creators: 2, avgHype: 50, maxHype: 80, avgLevel: "RELEVANT", maxLevel: "TRENDING",
  trend: 40, rising: 1, levels: { RELEVANT: 3, TRENDING: 2 }, topLevel: "TRENDING", dominantColorHex: "#1f4f7a", topCategory: "shoes_piece", top: top(iso, 80, "TRENDING"), sufficient: true, ...over,
});
const GLOBE: HypeGlobe = {
  type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", filters: { category: null, subcategory: null, minLevel: null }, minItems: 3,
  world: { count: 48, avgHype: 55.4, maxHype: 95, creators: 19 },
  countries: [
    country("BR", { count: 14, creators: 6, avgHype: 52.3, maxHype: 91, avgLevel: "RELEVANT", maxLevel: "VIRAL", rising: 5, trend: 18.4,
      levels: { LOW_SIGNAL: 1, NICHE: 3, RELEVANT: 4, HOT: 3, TRENDING: 2, VIRAL: 1 }, topLevel: "VIRAL", top: top("BR", 91, "VIRAL") }),
    country("AR", { creators: 1, avgHype: 30, avgLevel: "NICHE" }),
    country("US", { creators: 3, avgHype: 70, avgLevel: "HOT" }),
    country("FR", { creators: 5, avgHype: 60, avgLevel: "HOT" }),
    country("MX", { count: 2, creators: 2, avgHype: 90, avgLevel: "VIRAL", sufficient: false }),   // poucos dados: apagado e sem card
    country("JP", { creators: 4, avgHype: 99, avgLevel: "VIRAL" }),                                // atrás do horizonte na rotação inicial
  ],
  regions: [{ key: "AMERICA_DO_SUL", label: "América do Sul", count: 20, avgHype: 48 }],
};
const C: [number, number] = [210, 210];
/** raio do disco no globo de 420 (size / 2 − 8) */
const R = 202;
const dist = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

beforeEach(() => {
  // "reduzir movimento" do sistema (o app pode reescrever o data-reduce-motion): sem giro nem crescimento, desenho determinístico
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  router.replace.mockClear();
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  nav.search = new URLSearchParams(); nav.pathname = "/";
  tokenStore.clear(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("Globo de Hype › regras puras", () => {
  it("coluna em pé: sobe a partir do país, inclinada para fora, com a mesma altura na tela em qualquer ponto do globo", () => {
    expect(columnDirection(C, [210, 300], R)).toEqual([0, -1]);   // no meio do disco: em pé
    const [dx, dy] = columnDirection(C, [412, 210], R);           // na borda direita: tomba para a direita
    expect(dx).toBeGreaterThan(0.3); expect(dy).toBeLessThan(-0.8); expect(Math.hypot(dx, dy)).toBeCloseTo(1);
    expect(columnDirection(C, [8, 210], R)[0]).toBeCloseTo(-dx);   // espelhada na borda esquerda
    // contínua ao cruzar o centro (a radial pura virava de lado)
    expect(dist(columnDirection(C, [209, 260], R), columnDirection(C, [211, 260], R))).toBeLessThan(0.01);
    // a altura desenhada é h·R em qualquer posição — a radial encurtava perto do centro do disco
    for (const p of [[210, 210], [300, 150], [30, 380], [400, 60]] as [number, number][]) {
      expect(dist(columnTop(C, p, 0.2, R), p)).toBeCloseTo(0.2 * R, 6);
      expect(columnTop(C, p, 0.2, R)[1]).toBeLessThan(p[1]);   // sempre para cima
    }
    expect(columnTop(C, [250, 180], 0, R)).toEqual([250, 180]);   // altura zero = na superfície
  });

  it("altura da coluna: Hype e crescimento na escala 0–100, volume relativo ao maior país; mínimo visível só com dados suficientes", () => {
    expect(COLUMN_MAX).toBeCloseTo(0.22);
    expect(columnHeight(50, "avg")).toBeCloseTo(COLUMN_MAX / 2);
    expect(columnHeight(100, "max")).toBeCloseTo(COLUMN_MAX);
    expect(columnHeight(150, "growth")).toBeCloseTo(COLUMN_MAX);   // nunca passa do máximo
    expect(columnHeight(5, "volume", 10)).toBeCloseTo(COLUMN_MAX / 2);
    expect(columnHeight(null, "avg")).toBe(0);
    expect(columnHeight(0, "avg")).toBe(0);
    // país suficiente nunca some: valor baixo ganha a altura mínima; acima dela, segue proporcional
    expect(columnHeight(2, "avg", 1, true)).toBe(COLUMN_MIN);
    expect(columnHeight(2, "avg", 1, false)).toBeCloseTo(COLUMN_MAX * 0.02);
    expect(columnHeight(80, "avg", 1, true)).toBeCloseTo(COLUMN_MAX * 0.8);
    expect(columnHeight(null, "avg", 1, true)).toBe(0);   // sem dados não vira coluna (nunca um "0" desenhado)
  });

  it("marcas do país: pílula, coluna, bonecos e marcador nunca se sobrepõem", () => {
    const pillW = pillWidth("100");
    for (const x of [20, 120, 205, 215, 320, 400]) for (const y of [40, 210, 380]) for (const h of [0, COLUMN_MIN, 0.1, COLUMN_MAX]) for (const n of [1, 2, 3]) {
      const m = countryMarks({ center: C, p: [x, y], radius: R, h, k: 1, pillW, figures: n, extra: n === 3 });
      const figs = m.figures!; const pill = m.pill!;
      expect(figs.dir).toBe(x > C[0] ? -1 : 1);   // bonecos do lado de dentro do disco
      expect(overlaps(pill, figs.box)).toBe(false);
      expect(pill.y + pill.h).toBeLessThanOrEqual(figs.box.y);   // número acima da cabeça dos bonecos
      expect(pill.y + pill.h).toBeLessThanOrEqual(m.top[1] - (h > 0 ? COLUMN_CAP : 0));   // e acima da tampa da coluna
      const half = Math.max(COLUMN_W / 2, COLUMN_CAP);
      const col = { x: Math.min(x, m.top[0]) - half, y: m.top[1] - half, w: Math.abs(m.top[0] - x) + 2 * half, h: y - m.top[1] + 2 * half };
      expect(overlaps(col, figs.box)).toBe(false);
      const mk = { x: m.marker[0] - 7, y: m.marker[1] - 7, w: 14, h: 14 };
      expect(overlaps(mk, pill)).toBe(false); expect(overlaps(mk, figs.box)).toBe(false);
    }
    // bonecos 2× (e proporcionais ao tamanho do globo): ~28 px de altura no globo de 420, metade no de 210
    const big = countryMarks({ center: C, p: [100, 200], radius: R, h: 0.1, k: 1, figures: 2 }).figures!;
    expect(big.scale).toBe(FIGURE_SCALE);
    expect(big.box.h).toBeCloseTo(FIGURE_H * 2);
    expect(countryMarks({ center: [105, 105], p: [50, 100], radius: 97, h: 0.1, k: 0.5, figures: 2 }).figures!.box.h).toBeCloseTo(FIGURE_H);
    // sem bonecos nem número: só o topo da coluna
    expect(countryMarks({ center: C, p: [100, 200], radius: R, h: 0.1, k: 1 })).toMatchObject({ pill: null, figures: null });
  });

  it("bonecos: um por criador até 3, o resto vira +N", () => {
    expect(figuresFor(0)).toEqual({ shown: 0, extra: 0 });
    expect(figuresFor(2)).toEqual({ shown: 2, extra: 0 });
    expect(figuresFor(3)).toEqual({ shown: 3, extra: 0 });
    expect(figuresFor(8)).toEqual({ shown: 3, extra: 5 });
  });

  it("cards: os K mais altos entre os visíveis suficientes, mais o selecionado; abaixo do mínimo nunca", () => {
    const vis = [
      { country: "BR", sufficient: true, hasTop: true, value: 52 }, { country: "AR", sufficient: true, hasTop: true, value: 30 },
      { country: "US", sufficient: true, hasTop: true, value: 70 }, { country: "FR", sufficient: true, hasTop: true, value: 60 },
      { country: "MX", sufficient: false, hasTop: true, value: 90 }, { country: "CL", sufficient: true, hasTop: false, value: 99 },
    ];
    expect(pickCards(vis)).toEqual(["US", "FR", "BR"]);
    expect(pickCards(vis, "AR")).toEqual(["US", "FR", "BR", "AR"]);
    expect(pickCards(vis, "BR")).toEqual(["US", "FR", "BR"]);   // já está entre os K
    expect(pickCards(vis, "MX")).toEqual(["US", "FR", "BR"]);   // poucos dados: sem card
  });

  it("empilhamento: cada card no lado do país, na altura dele, sem sobreposição e dentro da área", () => {
    const slots = stackCards([{ country: "A", at: [100, 200] }, { country: "B", at: [120, 205] }, { country: "C", at: [130, 400] }, { country: "D", at: [300, 50] }],
      { centerX: 210, leftX: -130, rightX: 430, cardH: 48, gap: 8, top: 6, bottom: 414 });
    const left = slots.filter((s) => s.side === "left").sort((a, b) => a.y - b.y);
    expect(left.map((s) => s.country)).toEqual(["A", "B", "C"]);
    for (let i = 1; i < left.length; i++) expect(left[i].y).toBeGreaterThanOrEqual(left[i - 1].y + 48 + 8);
    expect(left.at(-1)!.y + 48).toBeLessThanOrEqual(414);
    expect(left.every((s) => s.x === -130)).toBe(true);
    expect(slots.find((s) => s.country === "D")).toMatchObject({ side: "right", x: 430, y: 26 });
  });

  it("faixa pelo número exibido (régua padrão) e o Hype mostrado por métrica", () => {
    expect(levelFromScore(19.4)).toBe("LOW_SIGNAL");
    expect(levelFromScore(89.6)).toBe("VIRAL");   // 90 exibido = viral
    expect(levelFromScore(74)).toBe("HOT");
    const br = GLOBE.countries[0];
    expect(hypeShown(br, "avg")).toEqual({ value: 52.3, level: "RELEVANT", kind: "avg" });
    expect(hypeShown(br, "max")).toEqual({ value: 91, level: "VIRAL", kind: "max" });
    expect(hypeShown(br, "volume").kind).toBe("avg");
    expect(hypeShown({ ...br, avgLevel: null }, "avg").level).toBe("RELEVANT");   // sem faixa da API: régua padrão
  });

  it("filtros ⇄ URL: padrões fora da URL, look vai como LOOK, valores inválidos voltam ao padrão", () => {
    const f = globeFiltersFrom(new URLSearchParams("layers=heat,figures,xx&metric=growth&type=look&window=30&category=SHOES_PIECE&minLevel=hot"));
    expect(f).toEqual({ layers: ["figures", "heat"], metric: "growth", type: "SCHEME", window: "30", category: "shoes_piece", minLevel: "HOT" });
    expect(globeQuery(f)).toBe("?type=LOOK&window=30&category=shoes_piece&minLevel=HOT");
    const d = globeFiltersFrom(new URLSearchParams("metric=zzz&window=9&minLevel=SUPER"));
    expect(d).toEqual({ layers: DEFAULT_GLOBE_LAYERS, metric: "avg", type: "PIECE", window: "7", category: "", minLevel: "" });
    expect(globeQuery(d)).toBe("?type=PIECE&window=7");
    expect(globeSearch(d, "tab=ranking&region=EUROPA")).toBe("tab=map&region=EUROPA");
    expect(new URLSearchParams(globeSearch(f, "", "BR")).get("layers")).toBe("figures,heat");
    expect(globeSearch({ ...d, layers: [] }, "", "")).toBe("tab=map&layers=");   // nenhuma camada também fica na URL
  });
});

function drawGlobe(layers: GlobeLayer[], opts: { selected?: string; metric?: "avg" | "max" | "volume" | "growth"; onOpen?: () => void; onSelect?: (iso: string) => void } = {}) {
  return renderApp(<Globe points={[]} selected={opts.selected} onSelect={opts.onSelect ?? (() => undefined)} size={420}
    hype={{ data: GLOBE, layers, metric: opts.metric ?? "avg", onOpen: opts.onOpen }} />);
}
const drawn = (container: HTMLElement, sel: string) => Array.from(container.querySelectorAll(sel)).map((e) => e.getAttribute("data-country"));

describe("Globo de Hype › camadas no globo", () => {
  it("cada camada aparece só quando ligada", () => {
    for (const layer of ["numbers", "columns", "figures", "cards", "heat"] as GlobeLayer[]) {
      const { container, unmount } = drawGlobe([layer]);
      for (const other of ["numbers", "columns", "figures", "cards", "heat"]) {
        expect(container.querySelectorAll(`.globe-layer-${other}`).length).toBe(other === layer ? 1 : 0);
      }
      expect(container.querySelector("svg")!.getAttribute("data-layers")).toBe(layer);
      unmount();
    }
    // sem camada: o globo de antes (um ponto por país, imagem)
    const { container } = drawGlobe([]);
    expect(container.querySelector(".globe-layer")).toBeNull();
    expect(screen.getByRole("img", { name: /globo interativo/i })).toBeTruthy();
  });

  it("números: o Hype do país em texto, com a faixa por escrito no rótulo (nunca só cor); o país atrás do horizonte some", () => {
    const { container } = drawGlobe(["numbers"]);
    expect(drawn(container, ".globe-pill")).toEqual(expect.arrayContaining(["BR", "AR", "US", "FR", "MX"]));
    expect(drawn(container, ".globe-pill")).not.toContain("JP");
    const br = screen.getByRole("img", { name: /^Brasil · Hype médio 52 · Relevante$/ });
    expect(br.textContent).toContain("52");
    expect(br.getAttribute("data-level")).toBe("RELEVANT");
    expect(screen.getByRole("img", { name: /México · Hype médio 90 · Viral · poucos dados/ }).getAttribute("class")).toContain("is-dim");
  });

  it("Hype máximo troca o número e a faixa da pílula", () => {
    drawGlobe(["numbers"], { metric: "max" });
    expect(screen.getByRole("img", { name: /^Brasil · Hype máximo 91 · Viral$/ })).toBeTruthy();
  });

  it("colunas: altura na tela = h·R com h proporcional à métrica, sempre para cima; nada atrás do horizonte", () => {
    const { container } = drawGlobe(["columns"]);
    expect(drawn(container, ".globe-col")).not.toContain("JP");
    const seg = (c: HTMLElement, iso: string) => {
      const l = c.querySelector(`.globe-col[data-country="${iso}"] line`)!; const n = (a: string) => Number(l.getAttribute(a));
      return { base: [n("x1"), n("y1")] as [number, number], top: [n("x2"), n("y2")] as [number, number] };
    };
    const len = (c: HTMLElement, iso: string) => { const s = seg(c, iso); return dist(s.top, s.base); };
    expect(len(container, "BR")).toBeCloseTo(columnHeight(52.3, "avg", 1, true) * R, 4);
    expect(len(container, "US")).toBeCloseTo(columnHeight(70, "avg", 1, true) * R, 4);
    expect(len(container, "US")).toBeGreaterThan(len(container, "BR"));
    for (const iso of ["BR", "AR", "US", "FR"]) expect(seg(container, iso).top[1]).toBeLessThan(seg(container, iso).base[1]);
    // a coluna mais alta passa de 40 px no globo de 420 (antes, perto do centro, mal aparecia)
    expect(columnHeight(100, "avg", 1, true) * R).toBeGreaterThan(40);
    expect(container.querySelector('.globe-col[data-country="BR"] line')!.getAttribute("stroke-width")).toBe(String(COLUMN_W));
    cleanup();
    // volume: relativo ao maior país do recorte (BR, 14 itens)
    const vol = drawGlobe(["columns"], { metric: "volume" }).container;
    expect(len(vol, "AR")).toBeCloseTo(columnHeight(5, "volume", 14, true) * R, 4);
    expect(len(vol, "BR")).toBeCloseTo(COLUMN_MAX * R, 4);
  });

  it("as colunas crescem do chão quando o recorte chega (sem reduzir movimento)", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
    const { container } = drawGlobe(["columns"]);
    expect(container.querySelectorAll(".globe-col")).toHaveLength(0);   // começa na superfície
    act(() => { const later = performance.now() + 1000; queue.splice(0).forEach((cb) => cb(later)); });
    const l = container.querySelector('.globe-col[data-country="BR"] line')!; const n = (a: string) => Number(l.getAttribute(a));
    expect(dist([n("x2"), n("y2")], [n("x1"), n("y1")])).toBeCloseTo(columnHeight(52.3, "avg", 1, true) * R, 4);
  });

  it("bonecos: 1 a 3 por criadores e +N além disso, 2× maiores, só na frente do globo", () => {
    const { container } = drawGlobe(["figures"]);
    const figs = (iso: string) => container.querySelector(`.globe-figs[data-country="${iso}"]`)!;
    expect(figs("BR").getAttribute("data-scale")).toBe(String(FIGURE_SCALE));
    expect(figs("BR").querySelector(".globe-fig")!.parentElement!.getAttribute("transform")).toContain(`scale(${FIGURE_SCALE})`);
    expect(figs("AR").querySelectorAll(".globe-fig")).toHaveLength(1);
    expect(figs("US").querySelectorAll(".globe-fig")).toHaveLength(3);
    expect(figs("US").querySelector(".globe-fig-more")).toBeNull();
    expect(figs("BR").querySelectorAll(".globe-fig")).toHaveLength(3);
    expect(figs("BR").querySelector(".globe-fig-more")!.textContent).toBe("+3");   // 6 criadores
    expect(figs("FR").querySelector(".globe-fig-more")!.textContent).toBe("+2");
    expect(figs("BR").querySelector(".globe-fig-outfit")!.getAttribute("fill")).toBe("#1f4f7a");   // roupa na cor dominante
    expect(drawn(container, ".globe-figs")).not.toContain("JP");
  });

  it("números acima das colunas e da cabeça dos bonecos do mesmo país (nada se cobre)", () => {
    const { container } = drawGlobe(["numbers", "columns", "figures"]);
    const xy = (el: Element) => { const m = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(el.getAttribute("transform")!)!; return [Number(m[1]), Number(m[2])] as const; };
    for (const iso of ["BR", "AR", "US", "FR", "MX"]) {
      const pill = container.querySelector(`.globe-pill[data-country="${iso}"]`)!;
      const figs = container.querySelector(`.globe-figs[data-country="${iso}"]`)!;
      const col = container.querySelector(`.globe-col[data-country="${iso}"] line`)!;
      const [, py] = xy(pill); const ph = Number(pill.querySelector("rect")!.getAttribute("height"));
      const [, fy] = xy(figs); const headTop = fy - FIGURE_H * Number(figs.getAttribute("data-scale"));
      expect(py + ph / 2).toBeLessThanOrEqual(headTop);                                       // pílula acima dos bonecos
      expect(py + ph / 2).toBeLessThanOrEqual(Number(col.getAttribute("y2")) - COLUMN_CAP);   // e acima da tampa da coluna
    }
  });

  it("cards: os 3 mais altos visíveis + o selecionado, com linha até o país; clique abre a análise", () => {
    const onOpen = vi.fn();
    const { container } = drawGlobe(["cards"], { onOpen });
    expect(drawn(container, ".globe-card")).toEqual(expect.arrayContaining(["US", "FR", "BR"]));
    expect(drawn(container, ".globe-card")).toHaveLength(3);
    expect(container.querySelectorAll(".globe-card-leader")).toHaveLength(3);
    const card = screen.getByRole("button", { name: /Abrir a análise de Tênis de BR · Hype 91, Viral · Brasil/ });
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p-BR" }), "BR");
    fireEvent.keyDown(screen.getByRole("button", { name: /Tênis de US/ }), { key: "Enter" });
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: "p-US" }), "US");
    // os cards não se sobrepõem (mesmo lado: um abaixo do outro)
    const boxes = Array.from(container.querySelectorAll(".globe-card-body")).map((g) => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute("transform")!)!; return { x: Number(m[1]), y: Number(m[2]) };
    });
    for (const a of boxes) for (const b of boxes) if (a !== b && a.x === b.x) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(48);
    cleanup();
    const sel = drawGlobe(["cards"], { selected: "AR" }).container;
    expect(drawn(sel, ".globe-card")).toHaveLength(4);
    expect(drawn(sel, ".globe-card")).toContain("AR");
    expect(drawn(sel, ".globe-card")).not.toContain("MX");   // poucos dados: nunca tem card
  });

  it("calor: halo pela faixa, dourado pulsando só no viral suficiente", () => {
    const { container } = drawGlobe(["heat"]);
    const heat = (iso: string) => container.querySelector(`.globe-heat[data-country="${iso}"]`)!;
    expect(heat("US").getAttribute("data-level")).toBe("HOT");
    expect(heat("US").getAttribute("fill")).toMatch(/url\(#.*-heat-hot\)/);
    expect(heat("MX").getAttribute("class")).toContain("is-dim");
    expect(heat("MX").getAttribute("class")).not.toContain("is-viral");
    expect(heat("JP" as string)).toBeNull();
  });

  it("clicar numa camada seleciona o país", () => {
    const onSelect = vi.fn();
    const { container } = drawGlobe(["numbers", "columns"], { onSelect });
    fireEvent.click(container.querySelector('.globe-col[data-country="FR"]')!);
    expect(onSelect).toHaveBeenCalledWith("FR");
  });
});

const V1 = { countries: [{ country: "BR", total: 9, schemes: 4, pieces: 5, avg_hype: 61, dominantColorHex: "#12100F", sufficient: true }], minData: 3,
  facets: { seasons: ["SUMMER"], hypeBands: [], colors: [] }, legend: "Um ponto por país" };
const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], shoes_piece: ["casual_sneakers"] }, colors: {}, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] };
const ROUTES = {
  "GET /api/explorer/global": (url: URL) => ({ ...V1, selected: url.searchParams.get("country") ? { country: url.searchParams.get("country"), hypeBySeason: [], topColors: [] } : undefined }),
  "GET /api/hype/globe": GLOBE,
  "GET /api/insights": { context: "EXPLORER_MAP", items: [] },
  "GET /api/taxonomy": TAXONOMY,
};
const globeCalls = (api: { calls: { path: string }[] }) => api.calls.filter((c) => c.path.startsWith("/api/hype/globe"));
const lastGlobe = (api: { calls: { path: string }[] }) => new URL(globeCalls(api).at(-1)!.path, "http://x").searchParams;
const lastReplace = () => new URLSearchParams(String(router.replace.mock.calls.at(-1)![0]).split("?")[1]);

describe("Explorador › Painel global com camadas de Hype", () => {
  beforeEach(() => { nav.pathname = "/explorer"; nav.search = new URLSearchParams("tab=map"); });

  it("busca o globo anônimo para quem não entrou; a barra de filtros muda a consulta e a URL", async () => {
    const api = mockApi(ROUTES);
    renderApp(<ExplorerPage />);
    await screen.findByRole("group", { name: /Globo de Hype/ });
    const first = api.fetchMock.mock.calls.find(([u]) => String(u).includes("/api/hype/globe"))!;
    expect((first[1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
    expect(Object.fromEntries(lastGlobe(api))).toEqual({ type: "PIECE", window: "7" });
    // camadas padrão: números, colunas e cards
    const layers = screen.getByRole("group", { name: "Camadas" });
    expect(within(layers).getByRole("button", { name: /Números/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(layers).getByRole("button", { name: /Bonecos/ }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(within(layers).getByRole("button", { name: /Bonecos/ }));
    expect(lastReplace().get("layers")).toBe("numbers,columns,figures,cards");
    expect(lastReplace().get("tab")).toBe("map");
    expect(document.querySelector(".globe-layer-figures")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Looks" }));
    await waitFor(() => expect(lastGlobe(api).get("type")).toBe("LOOK"));
    expect(lastReplace().get("type")).toBe("LOOK");
    fireEvent.click(screen.getByRole("radio", { name: "30 dias" }));
    await waitFor(() => expect(lastGlobe(api).get("window")).toBe("30"));

    fireEvent.click(screen.getByRole("button", { name: /^Nível mínimo/ }));
    fireEvent.click(within(await screen.findByRole("listbox", { name: "Nível mínimo" })).getByRole("option", { name: "Em alta" }));
    await waitFor(() => expect(lastGlobe(api).get("minLevel")).toBe("HOT"));
    fireEvent.click(screen.getByRole("button", { name: /^Categoria/ }));
    fireEvent.click(within(await screen.findByRole("listbox", { name: "Categoria" })).getByRole("option", { name: /Calçado/ }));
    await waitFor(() => expect(lastGlobe(api).get("category")).toBe("shoes_piece"));
    expect(Object.fromEntries(lastReplace())).toMatchObject({ tab: "map", type: "LOOK", window: "30", minLevel: "HOT", category: "shoes_piece" });

    // métrica é só desenho: não busca de novo
    const before = globeCalls(api).length;
    fireEvent.click(screen.getByRole("button", { name: /^Métrica/ }));
    fireEvent.click(within(await screen.findByRole("listbox", { name: "Métrica" })).getByRole("option", { name: "Crescimento" }));
    expect(lastReplace().get("metric")).toBe("growth");
    await new Promise((r) => setTimeout(r, 10));
    expect(globeCalls(api).length).toBe(before);
    expect(screen.getByText(/Altura da coluna = Crescimento/)).toBeTruthy();   // a legenda acompanha a métrica
  });

  it("logado: a mesma consulta vai com a sessão", async () => {
    const api = loggedAs(undefined, ROUTES);
    renderApp(<ExplorerPage />);
    await screen.findByRole("group", { name: /Globo de Hype/ });
    await waitFor(() => expect(api.fetchMock.mock.calls.some(([u, i]) => String(u).includes("/api/hype/globe") && (i as { headers: Record<string, string> }).headers.Authorization === "Bearer test-token")).toBe(true));
  });

  it("abre com os filtros da URL e mostra os mesmos números como tabela", async () => {
    nav.search = new URLSearchParams("tab=map&layers=heat&metric=max&type=LOOK&window=1&minLevel=NICHE");
    const api = mockApi(ROUTES);
    const { container } = renderApp(<ExplorerPage />);
    await screen.findByRole("group", { name: /Globo de Hype/ });
    expect(Object.fromEntries(lastGlobe(api))).toEqual({ type: "LOOK", window: "1", minLevel: "NICHE" });
    expect(container.querySelector("svg[data-layers]")!.getAttribute("data-layers")).toBe("heat");
    expect(screen.getByText("Halo = faixa do Hype do país (viral em dourado)")).toBeTruthy();
    expect(screen.getByText(/48 itens públicos · 6 países · Hype médio 55/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabela" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["País", "Itens", "Criadores", "Hype médio", "Hype máximo", "Crescimento", "Nível topo"]);
    const br = within(table).getByRole("row", { name: /Brasil/ });
    expect(within(br).getAllByRole("cell").map((c) => c.textContent)).toEqual(["14", "6", "52", "91", "18", "Viral"]);
    expect(within(table).getByRole("row", { name: /México/ }).textContent).toContain("poucos dados");
    expect(within(table).getByRole("row", { name: /Mundo/ }).textContent).toContain("48");
    expect(container.querySelector("svg[data-layers]")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver no globo" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("selecionar um país mostra o Hype dele (médio, máximo, subindo, faixas e destaque) e grava o país na URL", async () => {
    mockApi(ROUTES);
    renderApp(<ExplorerPage />);
    await screen.findByRole("group", { name: /Globo de Hype/ });
    fireEvent.click(screen.getByRole("button", { name: "Ver como tabela" }));
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Brasil" }));
    expect(lastReplace().get("country")).toBe("BR");
    const panel = await screen.findByRole("region", { name: "Hype de Brasil" });
    expect(panel.textContent).toContain("52");
    expect(panel.textContent).toContain("Relevante");
    expect(panel.textContent).toContain("91");
    expect(panel.textContent).toContain("Viral");
    expect(panel.textContent).toContain("de 14 itens");
    expect(within(panel).getByRole("img", { name: /Sinal baixo: 1, Nicho: 3, Relevante: 4, Em alta: 3, Tendência: 2, Viral: 1/ })).toBeTruthy();
    expect(within(panel).getByText("Tênis de BR")).toBeTruthy();
    expect(within(panel).getByText(/@ana\.br/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Ver análise" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
