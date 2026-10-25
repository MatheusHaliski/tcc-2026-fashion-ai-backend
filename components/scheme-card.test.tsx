// @vitest-environment jsdom
/**
 * Card do look (anatomias v18 · seção C): as linhas de peça e os layouts de peça escolhidos no Background Studio
 * (Etiqueta, Raio-X, Bento, Espectro, Custo por uso, LEGO, Passarela), grade e lista lateral, card compacto e prévia,
 * selos (slot, placas e selos de peça), arte do Studio atrás do container e o menu ⋯ do post (remixar, 3D, editar,
 * excluir).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { OWNER, PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { Me, PieceView, SchemeView } from "@/lib/api/types";
import { SchemeCard, SealSlot, SealStuds, toSealBadges, type SealBadge } from "./scheme-card";

vi.mock("@/components/generate-3d", () => ({
  Generate3DDialog: ({ targets, onClose }: { targets: { title: string }[]; onClose: () => void }) => <div role="dialog" aria-label="Manequim 3D">3D de {targets[0].title}<button onClick={onClose}>Fechar 3D</button></div>,
  Generate3DButton: () => null,
}));
vi.mock("@/components/hype/hype-analytics-drawer", () => ({
  HypeAnalyticsDrawer: ({ name, onClose }: { name: string; onClose: () => void }) => <div role="dialog" aria-label="Análise">Análise de {name}<button onClick={onClose}>Fechar análise</button></div>,
}));

const HYPE = { "GET /api/hype/summaries": { type: "SCHEME", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const VISITOR: Me = { user: { id: "u9", username: "bia", displayName: "Bia", profileType: "PESSOAL", verified: false, privateAccount: false }, email: "bia@example.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false };
const NO_PRICE: PieceView = { ...PIECE_2, id: "p3", name: "Tênis sem preço", category: "shoes_piece", brandName: null, price: null, size: "shoe_39", color: null, colorHex: null, material: null, wearCount: 0, thumbnailUrl: null, imageUrl: null } as unknown as PieceView;
const look = (extra: Partial<SchemeView> = {}): SchemeView => ({
  ...SCHEME, items: [...SCHEME.items, { wardrobeItemId: "p3", slot: "SHOES", piece: NO_PRICE }], ...extra,
} as SchemeView);
const withPieces = (anatomy: string, extra: Partial<SchemeView> = {}) => look({ background: { skin: "atelier", pieces: { anatomy } }, ...extra });

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; window.history.pushState({}, "", "/"); });

describe("selos do card", () => {
  it("SealSlot: sem selo não ocupa espaço; com selo mostra medalha, ícone ou as iniciais (FAI quando não há letras)", () => {
    mockApi({});
    const seals: SealBadge[] = [
      { label: "LOOK", name: "Nike", owner: "nike", tier: "LOOK", iconUrl: "/media/nike.png" },
      { label: "★★", premium: true },
      { label: "PEÇA", name: "Zara", tier: "PECA", design: { palette: "classic" } as SealBadge["design"], kind: "HYPE" },
      { label: "quarto" },
    ];
    const { container } = renderApp(<><SealSlot seals={[]} /><SealSlot seals={seals} size="sm" inline /></>);
    const slots = container.querySelectorAll(".seal-slot");
    expect(slots).toHaveLength(1);
    const slot = slots[0] as HTMLElement;
    expect(slot.className).toContain("inline");
    expect(slot.className).toContain("many");
    expect(slot.getAttribute("aria-label")).toBe("selos: Nike, ★★, Zara");   // no máximo 3
    const medals = Array.from(slot.querySelectorAll<HTMLElement>("[title]"));
    expect(medals[0].getAttribute("title")).toBe("Nike · @nike · LOOK");
    expect(medals[0].querySelector("img")?.getAttribute("src")).toContain("/media/nike.png");
    expect(medals[1].textContent).toBe("FAI");
    expect(medals[1].className).toContain("premium");
    expect(medals[2].getAttribute("title")).toBe("Zara · PECA");
  });

  it("SealStuds: placas nas cores do sistema (Hype, celebridade, look sem dono, marca) e a contagem", () => {
    mockApi({});
    const seals: SealBadge[] = [{ label: "H", kind: "HYPE" }, { label: "C", kind: "CELEBRITY" }, { label: "L", tier: "LOOK" }, { label: "B", owner: "nike", tier: "LOOK" }, { label: "X", premium: true }];
    const { container } = renderApp(<><SealStuds seals={[]} /><SealStuds seals={seals} /></>);
    expect(container.querySelectorAll(".seal-studs")).toHaveLength(1);
    const studs = Array.from(container.querySelectorAll<HTMLElement>(".seal-stud"));
    expect(studs.map((s) => s.style.getPropertyValue("--stud"))).toEqual(["#F58220", "#C8102E", "#F2C200", "#237841"]);
    expect(studs[3].title).toBe("B · @nike");
    expect(container.querySelector(".seal-stud-tile")?.textContent).toBe("5 selos");
    expect(container.querySelector(".seal-studs")?.getAttribute("aria-label")).toBe("5 selos");
  });

  it("toSealBadges: selo de peça vira PEÇA, premium vira celebridade; lista vazia sem erro", () => {
    expect(toSealBadges(null)).toEqual([]);
    const [peca, look2] = toSealBadges([{ tier: "PECA", owner: "nike", premium: false, linkedPieceIds: ["p1"] }, { tier: "LOOK", owner: "anitta", premium: true, name: "Anitta", iconUrl: "/i.png" }]);
    expect(peca).toMatchObject({ label: "PEÇA", kind: "BRAND", linkedPieceIds: ["p1"], name: null, iconUrl: null, design: null });
    expect(look2).toMatchObject({ label: "LOOK", kind: "CELEBRITY", name: "Anitta", iconUrl: "/i.png", linkedPieceIds: [] });
  });
});

describe("SchemeCard — lista padrão (Peça ampliada)", () => {
  it("card do feed (social): sem linhas de peça nem chips; selos e metadados de moda no bloco do título", () => {
    mockApi(HYPE);
    const scheme = look({ seals: ["BRAND:Nike", "solto"], sealBadges: [], season: "SUMMER" });
    const { container } = renderApp(<SchemeCard scheme={scheme} seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p1"], name: "Selo da camiseta" }]} flip={false} />);
    expect(container.querySelector("article")?.getAttribute("data-card-mode")).toBe("feed");
    expect(container.querySelector("article")?.className).toContain("scheme-card-social");
    expect(container.querySelector(".piece2")).toBeNull();
    expect(container.querySelector(".c-chips")).toBeNull();
    expect(container.querySelector(".c-titleblock .card-seals .seal-slot")?.getAttribute("aria-label")).toBe("selos: Selo da camiseta");
    const meta = Array.from(container.querySelectorAll(".card-fashion-meta > div")).map((d) => d.querySelector("dt")?.textContent);
    expect(meta).toEqual(["Marca", "Cor", "Ocasião", "Estilo"]);
    expect((container.querySelector(".c-photo") as HTMLElement).style.aspectRatio).toBe("4 / 3");
  });

  it("ampliado: linhas de peça com marca · tamanho · cor (ou o slot), preço ou —, chips de ocasião/estilo/estação e o selo da peça", () => {
    mockApi(HYPE);
    const scheme = look({ seals: ["BRAND:Nike", "solto"], sealBadges: [], season: "SUMMER", tipoLook: { nome: "Casual" } as SchemeView["tipoLook"] });
    const { container } = renderApp(<SchemeCard scheme={scheme} expanded seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p1"], name: "Selo da camiseta" }]} />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".piece2"));
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector(".l2")?.textContent).toBe(`Nike · M · ${label("white")}`);
    expect(rows[2].querySelector(".l2")?.textContent).toBe("39");   // sem marca nem cor: só o tamanho legível
    expect(rows[2].querySelector(".p-price")?.textContent).toBe("—");
    expect(rows[2].querySelector("img")).toBeNull();
    expect(rows[0].querySelector(".seal-slot")?.getAttribute("aria-label")).toBe("selos: Selo da camiseta");
    expect(rows[0].getAttribute("role")).toBe("button");   // no ampliado a linha abre a peça pelo modal de detalhe
    expect(Array.from(container.querySelectorAll(".c-chip")).map((c) => c.textContent)).toEqual([label("work"), label("basic"), label("summer")]);
    expect(screen.getByText("Tipo de look: Casual")).toBeTruthy();
    expect(container.querySelector(".c-kicker")?.textContent).toBe("Look · 3 peças");
    expect(screen.getByText("Look do Dia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Look de sexta" }).getAttribute("href")).toBe("/schemes/s1");
  });

  it("sem preço total: soma das peças; sem nenhum preço: \"Preço não informado\"; origem autopiloto e IA viram rótulo", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={look({ totalPrice: undefined, origin: "AUTOPILOTO" })} flip={false} />);
    expect(container.querySelector(".c-total")?.textContent).toMatch(/179,80/);
    expect(container.querySelector(".scheme-container")?.getAttribute("data-label")).toBe("autopiloto");
  });

  it("sem nenhum preço: \"Preço não informado\"; look feito com IA vira rótulo", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={look({ totalPrice: undefined, creationMode: "AI_ASSISTED", items: [{ wardrobeItemId: "p3", slot: "SHOES", piece: NO_PRICE }] })} flip={false} />);
    expect(r.container.querySelector(".c-total")?.textContent).toBe("Preço não informado");
    expect(r.container.querySelector(".scheme-container")?.getAttribute("data-label")).toBe("feito com IA");
  });

  it("capa: sem foto do look usa a foto da primeira peça; visibilidade no cabeçalho", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={look({ coverImageUrl: null, visibility: "FOLLOWERS" })} flip={false} />);
    expect(container.querySelector(".c-photo img")?.getAttribute("src")).toContain("p1.png");
    expect(container.textContent).toContain("Seguidores");
  });

  it("look privado mostra \"Privado\" no cabeçalho", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={look({ visibility: "PRIVATE" })} flip={false} />);
    expect(r.container.textContent).toContain("Privado");
  });

  it("prévia (href #): título sem link, sem ações nem menu e todas as peças", () => {
    mockApi(HYPE);
    const many = Array.from({ length: 5 }, (_, i) => ({ wardrobeItemId: `x${i}`, slot: "ACCESSORY", piece: { ...PIECE, id: `x${i}`, name: `Acessório ${i}` } as PieceView }));
    const { container } = renderApp(<SchemeCard scheme={look({ items: many })} href="#" />);
    expect(container.querySelector("article")?.className).toContain("is-preview");
    expect(screen.queryByRole("link", { name: "Look de sexta" })).toBeNull();
    expect(container.querySelector(".c-post")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais opções do post" })).toBeNull();
    expect(container.querySelector(".piece2")).toBeNull();   // prévia do feed é o card social, sem linhas
    cleanup();
    const r = renderApp(<SchemeCard scheme={look({ items: many })} href="#" expanded />);
    expect(r.container.querySelectorAll(".piece2")).toHaveLength(5);   // prévia ampliada: todas as peças
  });

  it("ampliado mostra todas as peças; com footer e extra, os dois ficam dentro do card", () => {
    mockApi(HYPE);
    const many = Array.from({ length: 6 }, (_, i) => ({ wardrobeItemId: `x${i}`, slot: "ACCESSORY", piece: { ...PIECE, id: `x${i}`, name: `Acessório ${i}` } as PieceView }));
    const { container } = renderApp(<SchemeCard scheme={look({ items: many })} expanded footer={<button>do dono</button>} extra={<span>legenda</span>} />);
    expect(container.querySelectorAll(".piece2")).toHaveLength(6);
    expect(container.querySelector(".c-owner")?.textContent).toBe("do dono");
    expect(container.querySelector(".c-extra")?.textContent).toBe("legenda");
  });
});

describe("SchemeCard — ampliado", () => {
  it("cada peça é um botão: clique e Enter/Espaço chamam onPiece; \"Ver análise completa\" abre a análise", () => {
    mockApi(HYPE);
    const onPiece = vi.fn();
    const { container } = renderApp(<SchemeCard scheme={look()} expanded onPiece={onPiece} />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".piece2"));
    expect(rows[0].getAttribute("role")).toBe("button");
    fireEvent.click(rows[0]);
    fireEvent.keyDown(rows[1], { key: "Enter" });
    fireEvent.keyDown(rows[2], { key: " " });
    fireEvent.keyDown(rows[2], { key: "a" });
    expect(onPiece.mock.calls.map((c) => c[0])).toEqual(["p1", "p2", "p3"]);
    expect(container.querySelector(".c-desc")?.className).toContain("is-full");
    fireEvent.click(screen.getByRole("button", { name: "Ver análise completa" }));
    expect(screen.getByRole("dialog", { name: "Análise" }).textContent).toContain("Análise de Look de sexta");
    fireEvent.click(screen.getByRole("button", { name: "Fechar análise" }));
    expect(screen.queryByRole("dialog", { name: "Análise" })).toBeNull();
  });

  it("layout de peça no ampliado: o Raio-X numera e cada peça abre pelo clique e pelo teclado", () => {
    mockApi(HYPE);
    const onPiece = vi.fn();
    const { container } = renderApp(<SchemeCard scheme={withPieces("RAIO_X")} expanded onPiece={onPiece} />);
    const lps = Array.from(container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps.map((l) => l.querySelector(".lp-pin")?.textContent)).toEqual(["1", "2", "3"]);
    expect(lps[0].className).toContain("is-action");
    fireEvent.click(lps[0]);
    fireEvent.keyDown(lps[1], { key: " " });
    fireEvent.keyDown(lps[2], { key: "Escape" });
    expect(onPiece.mock.calls.map((c) => c[0])).toEqual(["p1", "p2"]);
    expect(lps[0].querySelector(".lp-meta")?.textContent).toBe(`${label("cotton")} · ${label("white")}`);
    expect(lps[2].querySelector(".lp-meta")?.textContent).toBe(label("shoes"));
  });
});

describe("SchemeCard — layouts de peça (seção C)", () => {
  it("Etiqueta: furo, marca em maiúsculas (ou \"SEM MARCA\") e tamanho · cor", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("ETIQUETA")} expanded flip={false} />);
    expect(container.querySelector(".scheme-container")?.getAttribute("data-piece-anatomy")).toBe("ETIQUETA");
    const lps = Array.from(container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps[0].querySelector(".lp-hole")).not.toBeNull();
    expect(lps[0].querySelector(".lp-head")?.textContent).toBe("NIKE");
    expect(lps[2].querySelector(".lp-head")?.textContent).toBe("SEM MARCA");
    expect(lps[0].querySelector(".lp-meta")?.textContent).toBe(`TAM M · ${label("white")}`);
    expect(lps[2].querySelector(".lp-meta")?.textContent).toContain("39");
  });

  it("Bento: marca · preço (ou —) e o selo no bloco de atributos", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("BENTO")} expanded seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p2"], name: "Selo jeans" }]} flip={false} />);
    const lps = Array.from(container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps[0].querySelector(".lp-meta")?.textContent).toMatch(/^Nike · R\$\s?89,90$/);
    expect(lps[2].querySelector(".lp-meta")?.textContent).toBe("—");
    expect(lps[1].querySelector(".lp-meta .seal-slot")?.getAttribute("aria-label")).toBe("selos: Selo jeans");
  });

  it("Espectro: faixa por área estimada, cor e hex da peça (ou —) e a cor da linha", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("ESPECTRO")} expanded flip={false} />);
    const band = container.querySelector(".lp-band") as HTMLElement;
    expect(band.getAttribute("aria-label")).toMatch(new RegExp(`^Paleta por área estimada: ${label("white")} ≈ \\d+%, ${label("blue")} ≈ \\d+%, — ≈ \\d+%$`));
    expect(band.querySelectorAll("i")).toHaveLength(3);
    const lps = Array.from(container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps[0].querySelector(".lp-meta")?.textContent).toBe(`${label("white")} · #FFFFFF`);
    expect(lps[0].style.getPropertyValue("--lp")).toBe("#ffffff");
    expect(lps[2].querySelector(".lp-meta")?.textContent).toBe("—");
    expect(lps[2].style.getPropertyValue("--lp")).toBe("");
  });

  it("Espectro com Foto hero: no ampliado não há lista lateral, a faixa de cor aparece; no feed nenhum bloco de peça", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("ESPECTRO", { layoutAnatomy: "HERO_LISTA" })} expanded />);
    expect(container.querySelector(".hero-lateral-row")).toBeNull();
    expect(container.querySelector(".lp-block.is-side")).toBeNull();
    expect(container.querySelector(".lp-band i")).not.toBeNull();
    cleanup();
    const r = renderApp(<SchemeCard scheme={withPieces("ESPECTRO", { layoutAnatomy: "HERO_LISTA" })} flip={false} />);
    expect(r.container.querySelector(".hero-lateral-row")).toBeNull();
    expect(r.container.querySelector(".lp-block")).toBeNull();
  });

  it("Custo por uso (só para o dono): valor por uso, divisão, \"ainda não usada\" e \"Preço não informado\"", () => {
    mockApi(HYPE);
    const unused: PieceView = { ...PIECE_2, wearCount: 0 } as PieceView;
    const scheme = withPieces("CUSTO_POR_USO", { items: [SCHEME.items[0], { wardrobeItemId: "p2", slot: "lower", piece: unused }, { wardrobeItemId: "p3", slot: "SHOES", piece: NO_PRICE }] });
    const { container } = renderApp(<SchemeCard scheme={scheme} expanded seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p1"], name: "Selo" }]} />);
    const lps = Array.from(container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps[0].querySelector(".lp-cpu")?.textContent).toMatch(/17,98 por uso/);
    expect(lps[0].querySelector(".lp-cpu .seal-slot")).not.toBeNull();   // selo no cabeçalho do valor de uso
    expect(lps[0].querySelector(".lp-meta")?.textContent).toMatch(/89,90 ÷ 5 usos/);
    expect(lps[1].querySelector(".lp-meta")?.textContent).toBe("ainda não usada");
    expect(lps[2].querySelector(".lp-meta")?.textContent).toBe("Preço não informado");
    expect(lps[2].querySelector(".lp-cpu b")).toBeNull();
  });

  it("Custo por uso para quem visita cai na Peça ampliada", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("CUSTO_POR_USO", { viewer: { ...SCHEME.viewer, canEdit: false } })} expanded />);
    expect(container.querySelector(".scheme-container")?.getAttribute("data-piece-anatomy")).toBe("PECA_AMPLIADO");
    expect(container.querySelectorAll(".piece2")).toHaveLength(3);
  });

  it("LEGO: blocos na cor da peça com o selo como placa; Passarela: só nome e preço", () => {
    mockApi(HYPE);
    const { container } = renderApp(<SchemeCard scheme={withPieces("LEGO")} expanded seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p1"], name: "Selo" }]} flip={false} />);
    const bricks = Array.from(container.querySelectorAll<HTMLElement>(".brick-piece"));
    expect(bricks.map((b) => b.querySelector(".brick-label")?.textContent)).toEqual(["Camiseta branca lisa", "Calça jeans reta", "Tênis sem preço"]);
    expect(bricks[0].querySelector(".lp-stud .seal-slot")).not.toBeNull();
    expect(bricks[1].querySelector(".lp-stud")).toBeNull();
    expect(bricks[2].querySelector(".brick-photo img")).toBeNull();
  });

  it("Passarela de peças: só nome e preço, com o selo no canto da foto", () => {
    mockApi(HYPE);
    const r = renderApp(<SchemeCard scheme={withPieces("PASSARELA")} expanded seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p1"], name: "Selo" }]} flip={false} />);
    const lps = Array.from(r.container.querySelectorAll<HTMLElement>(".lp"));
    expect(lps[0].querySelector(".lp-meta")).toBeNull();
    expect(lps[0].querySelector(".lp-thumb .lp-seal")).not.toBeNull();   // selo no canto da foto
  });
});

describe("SchemeCard — grade, lista lateral e compacto", () => {
  it("Grade de peças, Foto hero e layout forçado no feed: card social, sem mosaico, lista lateral nem linhas", () => {
    mockApi(HYPE);
    for (const scheme of [look({ layoutAnatomy: "GRADE_PECAS" }), look({ layoutAnatomy: "HERO_LISTA" }), look()]) {
      const r = renderApp(<SchemeCard scheme={scheme} layout={scheme.layoutAnatomy ? undefined : "grade"} seals={[{ label: "PEÇA", tier: "PECA", linkedPieceIds: ["p2"], name: "Selo" }]} flip={false} />);
      expect(r.container.querySelector(".grid-pieces")).toBeNull();
      expect(r.container.querySelector(".hero-lateral-row")).toBeNull();
      expect(r.container.querySelector(".piece2, .piece2-sm, .lp-block")).toBeNull();
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

describe("SchemeCard — menu ⋯ do post", () => {
  it("quem publicou edita e exclui (DELETE, aviso e volta ao lookbook na página do look)", async () => {
    window.history.pushState({}, "", "/schemes/s1");
    const api = loggedAs(undefined, { ...HYPE, "DELETE /api/schemes/s1": undefined });
    renderApp(<SchemeCard scheme={look()} flip={false} />);
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/me")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Mais opções do post" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: /Editar/ })).toBeTruthy());
    expect(screen.getByRole("menuitem", { name: /Editar/ }).getAttribute("href")).toBe("/schemes/s1/edit");
    expect(screen.queryByRole("menuitem", { name: /Remixar/ })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Excluir/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/O look sai do seu perfil e do feed/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/lookbook"));
    expect(api.calls.some((c) => c.method === "DELETE" && c.path === "/api/schemes/s1")).toBe(true);
    expect(await screen.findByText("Look excluído.")).toBeTruthy();
  });

  it("excluir com erro mostra o aviso e o diálogo continua; cancelar fecha", async () => {
    loggedAs(undefined, { ...HYPE, "DELETE /api/schemes/s1": new Response(JSON.stringify({ status: 409, code: "CONFLITO", message: "Look em uso" }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<SchemeCard scheme={look()} flip={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mais opções do post" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Look em uso")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("Excluir este look?")).toBeNull());
  });

  it("quem visita remixa (POST remixes e abre o remix) e vê o look no manequim 3D", async () => {
    const other = look({ owner: { ...OWNER, id: "u1" }, viewer: { ...SCHEME.viewer, canEdit: false } });
    const api = loggedAs(VISITOR, { ...HYPE, "POST /api/interactions/SCHEME/s1/remixes": { scheme: { id: "s77" } } });
    renderApp(<SchemeCard scheme={other} flip={false} />);
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/me")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Mais opções do post" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: /Remixar: criar a minha versão/ })).toBeTruthy());
    expect(screen.queryByRole("menuitem", { name: /Editar/ })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Remixar: criar a minha versão/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/schemes/s77"));
    fireEvent.click(screen.getByRole("button", { name: "Mais opções do post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Ver no manequim 3D/ }));
    expect(screen.getByRole("dialog", { name: "Manequim 3D" }).textContent).toContain("3D de Look de sexta");
    fireEvent.click(screen.getByRole("button", { name: "Fechar 3D" }));
    expect(screen.queryByRole("dialog", { name: "Manequim 3D" })).toBeNull();
  });
});
