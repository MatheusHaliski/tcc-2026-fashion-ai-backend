// @vitest-environment jsdom
/**
 * Card do look — layouts da seção A (Lista vertical, Grade de peças, Foto hero + lista lateral) e card compacto.
 * No card do feed a Grade vira mosaico no lugar da foto e a Foto hero ganha a lista lateral (antes nenhum dos dois
 * mudava o feed); no ampliado as peças viram linhas. Extraído de scheme-card.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { SchemeCard, type SealBadge } from "./scheme-card";

vi.mock("@/components/generate-3d", () => ({
  Generate3DDialog: ({ targets, onClose }: { targets: { title: string }[]; onClose: () => void }) => <div role="dialog" aria-label="Manequim 3D">3D de {targets[0].title}<button onClick={onClose}>Fechar 3D</button></div>,
  Generate3DButton: () => null,
}));
vi.mock("@/components/hype/hype-analytics-drawer", () => ({
  HypeAnalyticsDrawer: ({ name, onClose }: { name: string; onClose: () => void }) => <div role="dialog" aria-label="Análise">Análise de {name}<button onClick={onClose}>Fechar análise</button></div>,
}));

const HYPE = { "GET /api/hype/summaries": { type: "SCHEME", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const NO_PRICE: PieceView = { ...PIECE_2, id: "p3", name: "Tênis sem preço", category: "shoes_piece", brandName: null, price: null, size: "shoe_39", color: null, colorHex: null, material: null, wearCount: 0, thumbnailUrl: null, imageUrl: null } as unknown as PieceView;
const look = (extra: Partial<SchemeView> = {}): SchemeView => ({
  ...SCHEME, items: [...SCHEME.items, { wardrobeItemId: "p3", slot: "SHOES", piece: NO_PRICE }], ...extra,
} as SchemeView);
const withPieces = (anatomy: string, extra: Partial<SchemeView> = {}) => look({ background: { skin: "atelier", pieces: { anatomy } }, ...extra });

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; window.history.pushState({}, "", "/"); });

describe("SchemeCard — grade, lista lateral e compacto", () => {
  // os layouts da seção A mudam o card do feed (antes ficavam sem efeito nele): Grade = mosaico no lugar da foto,
  // Foto hero = foto à esquerda e peças à direita; Lista vertical = só a foto. No feed nunca entram linhas nem blocos de peça.
  it("Grade de peças, Foto hero e layout forçado no feed: mosaico, lista lateral ou só a foto, sem linhas nem blocos", () => {
    mockApi(HYPE);
    const cases: [ReturnType<typeof look>, string | null, string | null][] = [
      [look({ layoutAnatomy: "GRADE_PECAS" }), ".grid-pieces.is-mosaic .cell", null],
      [look({ layoutAnatomy: "HERO_LISTA" }), ".hero-lateral-row .piece2-sm", null],
      [look(), ".grid-pieces.is-mosaic .cell", "grade"],
      [look({ layoutAnatomy: "LISTA_VERTICAL" }), null, null],
    ];
    for (const [scheme, expected, layout] of cases) {
      const r = renderApp(<SchemeCard scheme={scheme} layout={layout === "grade" ? "grade" : undefined} seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p2"], name: "Selo" }]} flip={false} />);
      if (expected) expect(r.container.querySelector(expected)).not.toBeNull();
      else expect(r.container.querySelector(".grid-pieces, .hero-lateral-row")).toBeNull();
      expect(r.container.querySelector(".piece2, .lp-block")).toBeNull();
      expect(r.container.querySelector(".card-seals")).not.toBeNull();
      r.unmount();
    }
  });

  it("Grade de peças e Foto hero no ampliado: as peças viram linhas (com o selo da peça); com layout Bento, o bloco", () => {
    mockApi(HYPE);
    const seals: SealBadge[] = [{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p2"], name: "Selo" }];
    const g = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "GRADE_PECAS" })} expanded seals={seals} />);
    expect(g.container.querySelector(".grid-pieces")).toBeNull();
    const rows = Array.from(g.container.querySelectorAll<HTMLElement>(".piece2"));
    expect(rows.map((r) => r.querySelector(".p-price")?.textContent?.replace(/\s/g, " "))).toEqual([expect.stringMatching(/89,90$/), expect.stringMatching(/89,90$/), "—"]);
    expect(rows[1].querySelector(".seal-slot")).not.toBeNull();
    g.unmount();
    const h = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "HERO_LISTA" })} expanded />);
    expect(h.container.querySelector(".hero-lateral-row")).toBeNull();
    expect(h.container.querySelectorAll(".piece2")).toHaveLength(3);
    h.unmount();
    const b = renderApp(<SchemeCard scheme={withPieces("BENTO", { layoutAnatomy: "GRADE_PECAS" })} expanded />);
    expect(b.container.querySelector(".grid-pieces")).toBeNull();
    expect(b.container.querySelectorAll(".lp-block .lp")).toHaveLength(3);
  });

  it("card compacto: miniatura e assinatura da anatomia, sem linhas de peça", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={look()} compact flip={false} />);
    expect(r.container.querySelector(".scheme-container.is-compact")).not.toBeNull();
    expect(r.container.querySelector(".c-thumb")).not.toBeNull();
    expect(r.container.querySelector(".piece2")).toBeNull();
  });

  it("anatomia com arte própria (Passarela) desenha o corpo da anatomia e o selo no canto da capa", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "PASSARELA" })} seals={[{ label: "LOOK", name: "Selo do look" }]} flip={false} />);
    expect(container.querySelector(".runway")).not.toBeNull();
    expect(container.querySelector(".scheme-container > .seal-slot")).toBeNull();   // no feed o selo vai para a linha de selos
    expect(container.querySelector(".card-seals .seal-slot")?.getAttribute("aria-label")).toBe("selos: Selo do look");
    expect(container.querySelector(".piece2")).toBeNull();
    cleanup();
    const r = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "PASSARELA" })} expanded seals={[{ label: "LOOK", name: "Selo do look" }]} />);
    expect(r.container.querySelector(".runway")).not.toBeNull();
    expect(r.container.querySelector(".scheme-container > .seal-slot")?.getAttribute("aria-label")).toBe("selos: Selo do look");
  });

  it("LEGO (ampliado) coloca os selos do look em placas", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "LEGO" })} expanded seals={[{ label: "LOOK", name: "Selo do look" }]} />);
    expect(container.querySelector(".seal-studs")).not.toBeNull();
  });

  it("Bento (ampliado) coloca os selos do look no bloco de metadados", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={look({ layoutAnatomy: "BENTO", occasion: [], style: [], season: null })} expanded seals={[{ label: "LOOK", name: "Selo do look" }]} />);
    expect(r.container.querySelector(".c-chips .seal-slot")).not.toBeNull();
  });

  it("arte do Studio atrás do container: cor manual do container muda o tom e a tinta", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={look({ background: { color: "#223344" }, containerColor: "#000000" })} flip={false} />);
    const article = container.querySelector("article") as HTMLElement;
    expect(article.className).toContain("has-art");
    expect(article.getAttribute("data-art")).toBe("cor #223344");
    expect(article.style.getPropertyValue("--container-bg")).toBe("#000000");
    expect(article.style.getPropertyValue("--card-ink")).not.toBe("");
  });

  it("só a tinta manual, sem arte: o card não ganha arte mas a tinta vale", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={look({ background: { container: { ink: "#ABCDEF" } }, containerColor: undefined })} flip={false} />);
    const a2 = r.container.querySelector("article") as HTMLElement;
    expect(a2.className).not.toContain("has-art");
    expect(a2.style.getPropertyValue("--card-ink")).toBe("#ABCDEF");
  });
});
