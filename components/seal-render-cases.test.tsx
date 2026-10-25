// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { PieceCard } from "./piece-card";
import { SchemeCard, toSealBadges, type SealBadge } from "./scheme-card";
import { SealSuggestions, useLookSeals } from "./look-seal-verification";
import { suggestionSealBadge } from "@/lib/seals/suggestion-badge";
import { __resetPieceSealsStore } from "@/lib/pieces/piece-seals-store";
import { __resetHypeStore } from "@/lib/hype/use-hype";

/*
 * Selos emitidos por marcas e celebridades chegam aos cards com a arte desenhada pelo emissor:
 * - selo de perfil (tier PERFIL): o item entra na vitrine do emissor pela política de perfil;
 * - selo Hype emitido: o vínculo pedido no painel Hype da peça ou do look.
 */
afterEach(cleanup);
const design = { mode: "TEMPLATE" as const, template: "fai/03" };
const perfil = toSealBadges([{ tier: "PERFIL", owner: "adidas", premium: false, name: "Vitrine Adidas", iconUrl: null, design }]);
const hypeEmitido = toSealBadges([{ tier: "PECA", owner: "shakira", premium: true, name: "Shakira em alta", iconUrl: null, design }]);

describe("selo de perfil", () => {
  it("é rotulado como perfil e não como look", () => {
    expect(perfil[0]).toMatchObject({ label: "Perfil", tier: "PERFIL", kind: "BRAND", design });
  });
  it("no card de peça da vitrine, é a célula Selo da lista Info, com o medalhão do emissor", () => {
    mockApi({});
    renderApp(<PieceCard piece={PIECE} seals={perfil} flip={false} />);
    const medal = screen.getByTitle("Vitrine Adidas · @adidas · PERFIL");
    expect(medal.closest(".pc-info-seal")?.parentElement?.previousElementSibling?.textContent).toBe("Selo");
  });
  it("no card de look da vitrine, aparece no espaço de selos do look", () => {
    mockApi({});
    renderApp(<SchemeCard scheme={SCHEME} seals={perfil} />);
    expect(screen.getAllByTitle(/^Vitrine Adidas/).length).toBeGreaterThan(0);
  });
});

describe("selo Hype emitido por celebridade", () => {
  it("na peça, entra na lista Info com o medalhão premium do emissor", () => {
    mockApi({});
    renderApp(<PieceCard piece={PIECE} seals={hypeEmitido} flip={false} />);
    const medal = screen.getByTitle("Shakira em alta · @shakira · PECA");
    expect(medal.closest(".pc-info-seal")?.textContent).toContain("Shakira em alta");
  });
  it("no look, aparece no espaço de selos do look", () => {
    mockApi({});
    renderApp(<SchemeCard scheme={SCHEME} seals={toSealBadges([{ tier: "LOOK", owner: "shakira", premium: true, name: "Look em alta", iconUrl: null, design }])} />);
    expect(screen.getAllByTitle(/^Look em alta/).length).toBeGreaterThan(0);
  });
});

/*
 * Matriz tipo de selo × card: todo selo com arte cadastrada aparece como medalhão desenhado (.seal-medallion.has-design),
 * nunca como as iniciais de reserva — no card de peça (célula Selo da lista Info; Hype automático na faixa da frente),
 * no card de look (espaço de selos do look; selo de peça também na linha da peça) e nas prévias dos criadores.
 */
describe("matriz: arte do selo em cada tipo × card", () => {
  beforeEach(() => { __resetPieceSealsStore(); __resetHypeStore(); });
  const marca = toSealBadges([{ tier: "PECA", owner: "nike", premium: false, name: "Selo Nike", iconUrl: null, design, linkedPieceIds: ["p1"] }]);
  const celebridade = toSealBadges([{ tier: "PECA", owner: "anitta", premium: true, name: "Selo Anitta", iconUrl: null, design, linkedPieceIds: ["p2"] }]);
  const lookMarca = toSealBadges([{ tier: "LOOK", owner: "nike", premium: false, name: "Look Nike", iconUrl: null, design }]);
  const drawn = (root: ParentNode, title: string) => Array.from(root.querySelectorAll<HTMLElement>(".seal-medallion.has-design")).filter((m) => m.title.startsWith(title));
  const cases: [string, SealBadge[], string][] = [
    ["marca", marca, "Selo Nike"], ["celebridade", celebridade, "Selo Anitta"], ["perfil", perfil, "Vitrine Adidas"], ["Hype emitido", hypeEmitido, "Shakira em alta"],
  ];

  for (const [tipo, seals, title] of cases) {
    it(`peça · ${tipo}: medalhão desenhado na célula Selo da lista Info`, () => {
      mockApi({});
      const { container } = renderApp(<PieceCard piece={PIECE} seals={seals} flip={false} />);
      const [medal] = drawn(container, title);
      expect(medal).toBeTruthy();
      expect(medal.closest(".pc-info-seal")).toBeTruthy();
      if (seals[0].premium) expect(medal.classList.contains("premium")).toBe(true);
    });
  }

  it("peça · Hype automático: medalhão do Selo de Hype na faixa da frente, fora da lista Info", async () => {
    mockApi({ "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: { p1: { status: "AVAILABLE", score: 92, level: "VIRAL", seals: ["VIRAL"], calculatedAt: new Date().toISOString() } } } });
    const { container } = renderApp(<PieceCard piece={PIECE} seals={[]} flip={false} />);
    await screen.findByTitle("Selo de Hype: Viral");
    const [medal] = drawn(container, "Selo de Hype: Viral");
    expect(medal.classList.contains("is-hype")).toBe(true);
    expect(medal.closest(".card-seals")).toBeTruthy();
    expect(medal.closest(".pc-info-seal")).toBeNull();
  });

  it("look · selo de LOOK, de perfil e Hype emitido: medalhões desenhados no espaço de selos do look", () => {
    mockApi({});
    const { container } = renderApp(<SchemeCard scheme={SCHEME} seals={[...lookMarca, ...perfil, ...toSealBadges([{ tier: "LOOK", owner: "shakira", premium: true, name: "Look em alta", iconUrl: null, design }])]} />);
    for (const title of ["Look Nike", "Vitrine Adidas", "Look em alta"]) expect(drawn(container, title).length).toBeGreaterThan(0);
  });

  it("look · selo de PEÇA de marca e de celebridade: no feed, no espaço do look; ampliado, também na linha da peça ligada", () => {
    mockApi({});
    const feed = renderApp(<SchemeCard scheme={SCHEME} seals={[...marca, ...celebridade]} />);
    expect(drawn(feed.container, "Selo Nike")[0]?.closest(".card-seals")).toBeTruthy();
    feed.unmount();
    const { container } = renderApp(<SchemeCard scheme={SCHEME} expanded seals={[...marca, ...celebridade]} />);
    const rowOf = (title: string) => drawn(container, title).map((m) => m.closest(".piece2")?.textContent ?? "").find(Boolean);
    expect(rowOf("Selo Nike")).toContain(PIECE.name);
    expect(rowOf("Selo Anitta")).toContain(PIECE_2.name);
  });

  it("card de peça sem selos da tela busca os aprovados em UM pedido para a grade e desenha a arte do emissor", async () => {
    const api = mockApi({ "GET /api/pieces/seals": (u: URL) => ({ items: Object.fromEntries((u.searchParams.get("ids") ?? "").split(",").map((id) => [id, id === "p1" ? [{ tier: "PECA", owner: "nike", premium: false, name: "Selo Nike", iconUrl: null, design }] : []])) }) });
    const { container } = renderApp(<><PieceCard piece={PIECE} flip={false} /><PieceCard piece={PIECE_2} flip={false} /></>);
    await waitFor(() => expect(drawn(container, "Selo Nike").length).toBe(1));
    expect(drawn(container, "Selo Nike")[0].closest(".pc-info-seal")).toBeTruthy();
    expect(api.calls.filter((c) => c.path.startsWith("/api/pieces/seals"))).toHaveLength(1);
  });

  it("prévia (criador) e exemplo (tutorial) não pedem selos à API", async () => {
    const api = mockApi({});
    renderApp(<><PieceCard piece={{ ...PIECE, id: "preview" }} flip={false} /><PieceCard piece={{ ...PIECE, id: "demo-piece" }} flip={false} /></>);
    await settle();
    expect(api.calls.some((c) => c.path.startsWith("/api/pieces/seals"))).toBe(false);
  });

  it("sugestão marcada: arte do selo do emissor; sem selo cadastrado, logo do perfil e tier do vínculo", () => {
    expect(suggestionSealBadge({ kind: "BRAND", name: "Nike", tier: "LOOK", seal: { name: "Selo Nike", tier: "LOOK", premium: false, owner: "nike", design }, linkedPieceIds: [] }, "LOOK"))
      .toMatchObject({ name: "Selo Nike", owner: "nike", tier: "LOOK", design, kind: "BRAND" });
    expect(suggestionSealBadge({ kind: "CELEBRITY", name: "Anitta", tier: "PECA", logoUrl: "/media/anitta.png", linkedPieceIds: ["p2"] }, "LOOK"))
      .toMatchObject({ name: "Anitta", tier: "PECA", premium: true, iconUrl: "/media/anitta.png", design: null, linkedPieceIds: ["p2"] });
  });

  it("criador de look: ao marcar a sugestão, a prévia do card mostra a arte do selo (look e linha da peça)", async () => {
    mockApi({ "POST /api/seal-suggestions/preview": { suggestions: [
      { targetOwnerId: "o1", kind: "BRAND", name: "Nike", confidence: 0.9, tier: "LOOK", linkedPieceIds: [], seal: { name: "Look Nike", tier: "LOOK", premium: false, owner: "nike", design } },
      { targetOwnerId: "o2", kind: "CELEBRITY", name: "Anitta", confidence: 0.8, tier: "PECA", linkedPieceIds: ["p2"], seal: { name: "Selo Anitta", tier: "PECA", premium: true, owner: "anitta", design } },
    ] } });
    function Builder() {
      const s = useLookSeals({ pieceIds: ["p1", "p2"], occasion: [], style: [], enabled: true });
      return <><SealSuggestions search={s.search} picked={s.picked} onToggle={s.onToggle} consent={s.consent} onConsent={s.onConsent} onRetry={s.onRetry} /><SchemeCard scheme={SCHEME} href="#" seals={s.pickedArts} /></>;
    }
    const { container } = renderApp(<Builder />);
    const boxes = await screen.findAllByRole("checkbox");
    expect(drawn(container, "Look Nike")).toHaveLength(0);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    await waitFor(() => expect(drawn(container, "Look Nike").length).toBeGreaterThan(0));
    expect(drawn(container, "Selo Anitta").length).toBeGreaterThan(0);
  });
});
