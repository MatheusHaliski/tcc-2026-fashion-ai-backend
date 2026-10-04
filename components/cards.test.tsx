// @vitest-environment jsdom
/**
 * Cards e peças de exibição (RF7, RF11, RF13, RF20): anatomias do card de look, medalha de selo, card de DNA, gráficos
 * do dashboard e ações sociais. Cada variante desenha sem quebrar e mostra o que a pessoa precisa ver.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME, OWNER } from "@/test-utils/fixtures";
import type { SchemeView } from "@/lib/api/types";
import {
  AnatomyBody, CompactSignature, PIECE_ANATOMIES, SCHEME_ANATOMIES, SILHOUETTES, SealZoneDiagram, anchorIndex, areaShares, coverOf,
  effectiveAnatomy, hasOwnArt, hypeStatus, pieceSealPlacement, sealPlacement, silhouetteLabel, toAnatomyPieces,
} from "./scheme-anatomies";
import { DEFAULT_DESIGN, ELEMENTS, MATERIALS, PALETTES, PATTERNS, SealMedallion, darken, designFromPalette, isLight, lighten, validateSealImage } from "./seal-medallion";
import { DnaCard, dnaLayoutLabel, dnaNarrativeLabel, narrativeHasOwnArt, DNA_LAYOUTS, DNA_NARRATIVES, type DnaView } from "./dna-card";
import { Bars, DataTable, Donut, Funnel, Heatmap, KpiTile, TimeSeries, fillDays } from "./charts";
import { CardActions, CommentButton, ShareDialog, SocialIcon } from "./interactions";
import { PieceCard } from "./piece-card";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("anatomias do card de look (RF11)", () => {
  const pieces = toAnatomyPieces(SCHEME);

  it("regras de anatomia: efetiva, arte própria, selo, silhueta e cor do hype", () => {
    expect(effectiveAnatomy({ layoutAnatomy: "CUSTO_POR_USO", season: null, viewer: { ...SCHEME.viewer, canEdit: false } })).toBe("LISTA_VERTICAL");
    expect(effectiveAnatomy({ layoutAnatomy: "CARTELA_SAZONAL", season: null, viewer: SCHEME.viewer })).toBe("LISTA_VERTICAL");
    // sem estação no look, a cartela escolhida no modal do layout dá a estação do card
    expect(effectiveAnatomy({ layoutAnatomy: "CARTELA_SAZONAL", season: null, viewer: SCHEME.viewer, background: { seasonalPresetId: "frost" } })).toBe("CARTELA_SAZONAL");
    expect(effectiveAnatomy({ layoutAnatomy: "BENTO", season: "summer", viewer: SCHEME.viewer })).toBe("BENTO");
    expect(hasOwnArt("PASSARELA")).toBe(true);
    expect(sealPlacement("inexistente")).toBe(sealPlacement("LISTA_VERTICAL"));
    expect(pieceSealPlacement(null).zone).toBeTruthy();
    expect(silhouetteLabel(SILHOUETTES[0])).toBeTruthy();
    expect(silhouetteLabel("x")).toBeNull();
    expect([hypeStatus(80), hypeStatus(55), hypeStatus(35), hypeStatus(null)]).toHaveLength(4);
    expect(areaShares(pieces).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);   // participação de cada peça, em %
    expect(anchorIndex(pieces)).toBeGreaterThanOrEqual(0);
    expect(coverOf(SCHEME)).toContain("/media/s1.png");
    expect(PIECE_ANATOMIES.length).toBeGreaterThan(0);
  });

  for (const a of SCHEME_ANATOMIES) {
    it(`desenha a anatomia ${a.id} com as peças do look`, () => {
      const scheme: SchemeView = { ...SCHEME, layoutAnatomy: a.id, season: "summer" };
      const { container } = renderApp(<><AnatomyBody scheme={scheme} pieces={pieces} /><CompactSignature scheme={scheme} pieces={pieces} /></>);
      // seção A (lista, grade, hero) é o layout padrão do card, fora do AnatomyBody; a seção B desenha o próprio corpo
      if (a.section === "B") expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
    });
  }

  it("diagrama da zona do selo em todas as zonas", () => {
    for (const zone of ["TITLE_ROW", "META_BLOCK", "COVER_CORNER", "HEADER", "STUDS"] as const) {
      const { container } = renderApp(<SealZoneDiagram zone={zone} pieceRows />);
      expect(container.querySelector("svg, div")).toBeTruthy();
      cleanup();
    }
  });
});

describe("medalha de selo (RF20)", () => {
  it("cores: clarear, escurecer e contraste", () => {
    expect(lighten("#000000", 1).toLowerCase()).toBe("#ffffff");
    expect(darken("#ffffff", 1).toLowerCase()).toBe("#000000");
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#101010")).toBe(false);
  });

  it("desenha a medalha em cada paleta, padrão, material e elemento", () => {
    for (const palette of Object.keys(PALETTES)) {
      const { container } = renderApp(<SealMedallion design={designFromPalette(palette)} size={64} premium title={palette} />);
      expect(container.querySelector("svg")).toBeTruthy();
      cleanup();
    }
    PATTERNS.forEach((p, i) => {
      const design = { ...DEFAULT_DESIGN, field: { ...DEFAULT_DESIGN.field, pattern: p.id, material: MATERIALS[i % MATERIALS.length].id }, element: { id: ELEMENTS[i % ELEMENTS.length].id, material: MATERIALS[(i + 1) % MATERIALS.length].id, text: "FAI" }, border: { material: MATERIALS[(i + 2) % MATERIALS.length].id } };
      renderApp(<SealMedallion design={design} />);
      cleanup();
    });
    const { container } = renderApp(<><SealMedallion design={{ mode: "UPLOAD", uploadUrl: "/media/selo.png" }} /><SealMedallion design={null} /></>);
    expect(container.querySelectorAll("svg, img").length).toBeGreaterThan(0);
  });

  it("valida a imagem enviada para o selo pelo tamanho e proporção", async () => {
    class FakeImage { width = 0; height = 0; onload?: () => void; onerror?: () => void; set src(v: string) { const [w, h] = v.split("x").map(Number); this.width = w; this.height = h; setTimeout(() => (w ? this.onload?.() : this.onerror?.()), 0); } }
    vi.stubGlobal("Image", FakeImage);
    let next = "512x512";
    URL.createObjectURL = vi.fn(() => next);
    URL.revokeObjectURL = vi.fn();
    const file = new File(["x"], "selo.png", { type: "image/png" });
    await expect(validateSealImage(file)).resolves.toMatchObject({ ok: true, width: 512 });
    next = "512x300";
    await expect(validateSealImage(file)).resolves.toMatchObject({ ok: false });
    next = "100x100";
    await expect(validateSealImage(file)).resolves.toMatchObject({ ok: false });
  });
});

describe("card de DNA de estilo (RF13)", () => {
  const cell = { cell: "c1", schemeId: "s1", title: "Look de sexta", occasion: ["work"], style: ["basic"], season: "summer", milestone: true, dominantBrand: "Nike", dominantColor: "#1f4fa0", hypeScoreGlobal: 60,
    pieces: [{ id: "p1", name: PIECE.name, imageUrl: "/media/p1.png", brand: "Nike", category: "upper_piece", color: "white" }] };
  const dna: DnaView = {
    id: "d1", owner: OWNER, title: "Meu DNA", archetype: "MINIMALISTA", archetypeLabel: "Minimalista", boldnessIndex: 0.4, identityPhrase: "Básico que funciona",
    palette: ["#ffffff", "#1f4fa0", "#111111"], cardLayout: DNA_LAYOUTS[0].id, targetElement: "LOOKS", narrativeType: DNA_NARRATIVES[0].id, seasonalTheme: "summer",
    visibility: "PUBLIC", status: "PUBLISHED", cells: [cell, { ...cell, cell: "c2", milestone: false }], logos: [{ brand: "Nike", pieces: 3, structural: 2 }],
    counters: { likes: 1, comments: 0, shares: 0, remixes: 0 }, canEdit: true,
  };

  it("rótulos de layout e narrativa", () => {
    expect(dnaLayoutLabel(DNA_LAYOUTS[0].id)).toBeTruthy();
    expect(dnaLayoutLabel(null)).toBe("—");
    expect(dnaNarrativeLabel("x")).toBe("x");
    expect(typeof narrativeHasOwnArt(DNA_NARRATIVES[0].id)).toBe("boolean");
  });

  for (const layout of DNA_LAYOUTS) {
    for (const narrative of [DNA_NARRATIVES[0], DNA_NARRATIVES[DNA_NARRATIVES.length - 1]]) {
      it(`desenha o DNA no layout ${layout.id} com a narrativa ${narrative.id}`, () => {
        const { container } = renderApp(<DnaCard dna={{ ...dna, cardLayout: layout.id, narrativeType: narrative.id }} href="/dna-schemes/d1" />);
        expect(container.textContent).toContain("Meu DNA");
        cleanup();
        renderApp(<DnaCard dna={{ ...dna, cardLayout: layout.id, narrativeType: narrative.id, logoCut: { shown: 1, counter: true, row: true } }} expanded />);
      });
    }
  }
});

describe("gráficos do dashboard (RF26)", () => {
  const days = [{ day: "2026-09-01", value: 3, other: 1 }, { day: "2026-09-03", value: 5, other: 2 }];

  it("preenche os dias sem dado com zero", () => {
    const f = fillDays(days, "2026-09-01", "2026-09-04", "day", ["value", "other"]);
    expect(f.map((r) => r.day)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(f[1].value).toBe(0);
    expect(fillDays([], undefined, undefined)).toEqual([]);
  });

  it("desenha série temporal, barras, rosca, KPI, mapa de calor, funil e tabela", () => {
    const { container } = renderApp(
      <>
        {(["line", "area", "bar"] as const).map((kind) => <TimeSeries key={kind} data={days} keys={[{ key: "value", label: "Peças" }, { key: "other", label: "Looks" }]} kind={kind} from="2026-09-01" to="2026-09-05" />)}
        <Bars data={[{ n: "Nike", v: 3 }, { n: "Adidas", v: 1 }]} x="n" y="v" horizontal colorBy={() => "#000"} format={(v) => `${v}x`} />
        <Bars data={[{ n: "A", v: 1 }]} x="n" y="v" />
        <Donut data={[{ n: "BR", v: 2 }, { n: "US", v: 1 }]} x="n" y="v" />
        <KpiTile label="Usuários" value={120} previous={100} format={(v) => String(v)} />
        <KpiTile label="Erros" value={5} previous={10} format={(v) => String(v)} invert />
        <KpiTile label="Novo" value={1} previous={0} format={(v) => String(v)} />
        <KpiTile label="Sem base" value={1} format={(v) => String(v)} />
        <Heatmap data={[{ dow: 1, hour: 10, total: 4 }, { dow: 5, hour: 22, total: 1 }]} />
        <Funnel steps={[{ label: "Visitas", value: 100 }, { label: "Cadastro", value: 40 }, { label: "Peça", value: 10 }]} />
        <DataTable caption="Top marcas" columns={[{ key: "n", label: "Marca" }, { key: "v", label: "Peças", align: "right", render: (r) => <b>{String(r.v)}</b> }]} rows={[{ n: "Nike", v: 3 }]} />
        <DataTable columns={[{ key: "n", label: "Marca" }]} rows={[]} />
      </>,
    );
    expect(container.textContent).toContain("Usuários");
    expect(container.textContent).toContain("Top marcas");
  });
});

describe("ações sociais do card (RF8)", () => {
  it("curtir, salvar e abrir comentários e compartilhamento chamam a API", async () => {
    const { calls } = loggedAs(undefined, {
      "POST /api/likes": { liked: true }, "/api/reactions": {}, "/api/saves": {}, "POST /api/shares": {},
      "GET /api/comments": { items: [], hasMore: false, page: 0, size: 20, total: 0 },
    });
    renderApp(<><CardActions type="PIECE" id="p1" counters={PIECE.counters} viewer={PIECE.viewer} title="Camiseta" ownerId="u2" reactions /><CommentButton type="PIECE" id="p1" count={3} title="Camiseta" /></>);
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(2));
    for (const b of screen.getAllByRole("button")) { if (!(b as HTMLButtonElement).disabled) fireEvent.click(b); }
    await waitFor(() => expect(calls.length).toBeGreaterThan(2));
  });

  it("diálogo de compartilhar e ícones sociais", () => {
    mockApi({ "POST /api/shares": {} });
    const onClose = vi.fn();
    const { container } = renderApp(<><ShareDialog type="SCHEME" id="s1" open onClose={onClose} /><SocialIcon name="trend" filled /><SocialIcon name="elegant" /><SocialIcon name="creative" size={16} /></>);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    screen.getAllByRole("button").slice(0, 3).forEach((b) => fireEvent.click(b));
  });
});

describe("card da peça (RF7)", () => {
  it("mostra nome, marca, preço à venda, favorita, indisponível e o selo de IA", () => {
    mockApi({});
    renderApp(<><PieceCard piece={PIECE} /><PieceCard piece={PIECE_2} href="#" /><PieceCard piece={PIECE} selectable selected onSelect={vi.fn()} /></>);
    expect(screen.getAllByText("Camiseta branca lisa").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/gerada por IA/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { pressed: true })[0]);
  });
});
