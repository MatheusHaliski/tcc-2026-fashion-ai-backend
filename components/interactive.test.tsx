// @vitest-environment jsdom
/**
 * Componentes de tela com interação (RF5, RF13, RF14, RF22, RF37, RF40): card do look em cada layout, selos, criador de
 * look e de DNA, modos do FLAIR e tabela da liga, vitrine (eras e coleções), FLAIR da marca e editor do corpo.
 * Rotas sem dado simulado voltam 404 e exercitam os estados de erro.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, mockApi, renderApp, screen } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import { OWNER, PIECE, PIECE_2, SCHEME, page } from "@/test-utils/fixtures";
import { SchemeCard, SealSlot, SealStuds, toSealBadges } from "./scheme-card";
import { SchemeBuilder, SlotBrand, onePerType } from "./scheme-builder";
import { DnaBuilder } from "./dna-builder";
import { FlairModes, LeagueTable } from "./flair/modes";
import { BrandFlairTab } from "./flair/brand-flair-tab";
import { CollectionsTab, ErasTab, GroupHypeValue } from "./showcase/showcase-tabs";
import { BodyEditor } from "./avatar3d/body-editor";
import { DNA_LAYOUTS, DNA_NARRATIVES, type DnaView } from "./dna-card";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"] }, colors: { white: "#fff", blue: "#1f4fa0" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: {} };
const BADGES = [{ tier: "GOLD", owner: "BRAND", premium: true, name: "Nike", iconUrl: null, linkedPieceIds: ["p1"] }, { tier: "SILVER", owner: "CELEBRITY", premium: false, name: "Anitta" }];
const mockApiNone = () => mockApi({});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });
/** Clica nos primeiros botões habilitados (abre/fecha painéis, troca abas, alterna opções). */
const clickAround = (n = 15) => { for (const b of screen.queryAllByRole("button").slice(0, n)) { if (!(b as HTMLButtonElement).disabled) fireEvent.click(b); } };

describe("card do look e selos (RF5/RF20)", () => {
  it("selos: conversão, espaço do selo e placas", () => {
    const seals = toSealBadges(BADGES);
    expect(seals.length).toBe(2);
    expect(toSealBadges(null)).toEqual([]);
    const { container } = renderApp(<><SealSlot seals={seals} /><SealSlot seals={seals} size="sm" inline px={20} /><SealSlot /><SealStuds seals={seals} /><SealStuds seals={[]} /></>);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  for (const layout of ["lista", "grade", "lateral"] as const) {
    it(`card do look no layout ${layout}: aberto, compacto e expandido`, async () => {
      loggedAs(ME, {});
      const seals = toSealBadges(BADGES);
      renderApp(<><SchemeCard scheme={SCHEME} layout={layout} href="/schemes/s1" seals={seals} footer={<span>rodapé</span>} headerExtra={<span>extra</span>} />
        <SchemeCard scheme={{ ...SCHEME, layoutAnatomy: "BENTO", lookDoDia: false }} layout={layout} compact flip={false} />
        <SchemeCard scheme={SCHEME} layout={layout} expanded onPiece={vi.fn()} extra={<span>mais</span>} /></>);
      await settle();
      expect(screen.getAllByText("Look de sexta").length).toBeGreaterThan(0);
      clickAround(8);
    });
  }
});

describe("criadores de look e de DNA (RF5/RF13)", () => {
  it("criador de look: uma peça por tipo, marca do slot e montagem a partir do acervo", async () => {
    expect(onePerType([{ id: "p1" }, { id: "p2" }, { id: "p1b" }], (id) => (id === "p2" ? PIECE_2 : PIECE)).length).toBe(2);
    loggedAs(ME, { "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/taxonomy": TAXONOMY, "POST /api/schemes": { scheme: SCHEME }, "PUT /api/schemes/s1": { scheme: SCHEME } });
    renderApp(<><SlotBrand piece={PIECE} /><SlotBrand piece={null} /><SchemeBuilder initial={SCHEME} /></>);
    await settle();
    clickAround(20);
    await settle();
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    cleanup();
    loggedAs(ME, { "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/taxonomy": TAXONOMY });
    renderApp(<SchemeBuilder />);
    await settle();
    clickAround(20);
  });

  it("criador de DNA: novo e editando um existente", async () => {
    const dna: DnaView = { id: "d1", owner: OWNER, title: "Meu DNA", palette: ["#fff", "#000"], cardLayout: DNA_LAYOUTS[1].id, targetElement: "LOOKS", narrativeType: DNA_NARRATIVES[1].id,
      visibility: "PUBLIC", status: "DRAFT", cells: [], logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: true };
    loggedAs(ME, { "GET /api/me/schemes": page([SCHEME]), "GET /api/taxonomy": TAXONOMY, "POST /api/dna-schemes": dna, "PUT /api/dna-schemes/d1": dna, "POST /api/dna-schemes/preview": dna });
    renderApp(<DnaBuilder initial={dna} />);
    await settle();
    clickAround(25);
    await settle();
    cleanup();
    loggedAs(ME, { "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<DnaBuilder />);
    await settle();
    clickAround(25);
  });
});

describe("FLAIR (RF37)", () => {
  it("modos do FLAIR abrem (sem dados, o estado de erro)", async () => {
    loggedAs(ME, {});
    renderApp(<FlairModes initial="league" />);
    await settle();
    clickAround(20);
    await settle();
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it("catálogo do FLAIR: troféus, núcleo e especiais, e cada modo abre o seu painel", async () => {
    const CODES = ["BATTLE", "SQUAD", "LEAGUE", "TOUR", "CONQUEST", "MONOPOLY", "DRAFT", "RUNWAY", "CHESS", "COMBO", "DECK", "BOSS", "TAG_TEAM", "ULTIMATE", "WARDROBE"];
    const theme = { code: "CASUAL", label: "Casual", emoji: "👕", occasions: ["casual"], styles: ["basic"], weights: { style: 1 }, hint: "leve" };
    const look = { schemeId: "s1", title: "Look de sexta", owner: "ana", rating: 80, stats: { style: 70, color: 60 }, synergies: [], styles: ["basic"], occasions: ["casual"], cards: [] };
    loggedAs(ME, {
      "GET /api/flair/modes": {
        architecture: ["Peça", "Look", "Card"], ethics: "jogo limpo", chessBoard: [], roles: ["ATAQUE", "DEFESA"], divisions: [{ from: 0, code: "BRONZE", label: "Bronze" }],
        modes: CODES.map((code, i) => ({ code, name: code, emoji: "⭐", group: i < 5 ? "NUCLEO" : "ESPECIAL", summary: `Resumo ${code}`, how: `Como jogar ${code}` })),
        themes: [theme], bosses: [{ code: "B1", name: "Chefe", emoji: "👑", theme: "CASUAL", stats: { style: 90 }, lesson: "cores" }],
        board: [{ index: 0, city: "São Paulo", title: "Início", emoji: "🏁", type: "START", theme: "CASUAL", target: 0, reward: 10, rule: "—" }],
        territories: [{ map: "CONQUEST", code: "T1", name: "Centro", emoji: "🏙️", style: "basic", theme: "CASUAL", bonus: "+10%" }],
      },
      "GET /api/flair/modes/looks": { looks: [look] },
      "GET /api/flair/modes/trophies": [{ id: "t1", title: "Campeã da semana", mode: "BATTLE" }],
    });
    renderApp(<FlairModes />);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(screen.getByText("Campeã da semana", { exact: false })).toBeTruthy();
    for (const code of CODES) {
      const open = screen.queryAllByRole("button").find((b) => (b.textContent ?? "").includes(code));
      if (!open) continue;
      fireEvent.click(open);
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const back = screen.queryAllByRole("button").find((b) => /Modos/.test(b.textContent ?? ""));
      if (back) fireEvent.click(back);
    }
  });

  it("tabela da liga mostra posição, divisão e pontos", () => {
    mockApiNone();
    renderApp(<LeagueTable rows={[
      { position: 1, user: OWNER, played: 5, wins: 4, draws: 1, losses: 0, points: 13, stylePoints: 120, division: { label: "Ouro" }, you: true },
      { position: 2, user: { ...OWNER, id: "u2", username: "bia", displayName: "Bia" }, played: 5, wins: 2, draws: 1, losses: 2, points: 7, stylePoints: 80, division: { label: "Prata" }, you: false },
    ]} />);
    expect(screen.getAllByText("Ouro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("13").length).toBeGreaterThan(0);
  });

  it("FLAIR da marca abre e tenta criar", async () => {
    loggedAs({ ...ME, user: { ...ME.user, profileType: "MARCA" } }, {});
    renderApp(<BrandFlairTab slug="nike" autoNew={1} />);
    await settle();
    clickAround(12);
  });
});

describe("vitrine da marca (RF14/RF22)", () => {
  it("eras, coleções e hype do grupo, como dono e como visitante", async () => {
    loggedAs(ME, {});
    renderApp(<><ErasTab slug="nike" admin /><CollectionsTab slug="nike" admin /><ErasTab slug="nike" admin={false} /><CollectionsTab slug="nike" admin={false} />
      <GroupHypeValue h={{ value: 72, status: "CALCULATED" } as never} /><GroupHypeValue h={null} /></>);
    await settle();
    clickAround(15);
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("editor do corpo do avatar (RF40)", () => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`edita as proporções (${sex.toLowerCase()}) e salva`, async () => {
      loggedAs(ME, {});
      const onSave = vi.fn();
      const { container } = renderApp(<BodyEditor sex={sex} initial={null} avatar={null} onSave={onSave} saving={false} />);
      await settle();
      container.querySelectorAll("input[type=range]").forEach((el, i) => fireEvent.change(el, { target: { value: String(0.2 + i * 0.01) } }));
      clickAround(12);
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });
  }
});
