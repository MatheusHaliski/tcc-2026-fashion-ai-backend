// @vitest-environment jsdom
/**
 * RF53 · Lote 3 do HypeScore (P1-09): a anatomia "Hype Focus" do card de look lê o HypeScore v2 de cada peça em lote
 * (o mesmo cache dos cards), com a faixa em texto, sem "%", sem paleta de alerta e com "—"/"Dados insuficientes" no
 * lugar de 0. Antes ela mostrava o v1 (hypeScore/hypeScoreGlobal) ao lado do badge v2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { HypeSummary } from "@/lib/hype/types";
import type { SchemeView } from "@/lib/api/types";
import { AnatomyBody, CompactSignature, HYPE_LEVEL_COLOR, hypeStatus, rankPiecesByHype, toAnatomyPieces } from "./scheme-anatomies";

const NOW = new Date().toISOString();
const PIECE_3 = { ...PIECE, id: "p3", name: "Tênis branco", category: "shoes_piece" } as typeof PIECE;
const LOOK: SchemeView = { ...SCHEME, layoutAnatomy: "HYPE_FOCUS", items: [...SCHEME.items, { wardrobeItemId: "p3", slot: "shoes", piece: PIECE_3 }] };

function hypeApi(items: Record<string, HypeSummary>) {
  return mockApi({
    "GET /api/hype/summaries": (url: URL) => {
      const ids = (url.searchParams.get("ids") ?? "").split(",");
      return { type: url.searchParams.get("type"), algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: Object.fromEntries(ids.filter((id) => items[id]).map((id) => [id, items[id]])) };
    },
  });
}

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("anatomia Hype Focus em v2 (P1-09)", () => {
  it("medidor com o score v2 e a faixa em texto, sem \"%\"; peça sem dados aparece com \"—\" e o motivo, nunca 0", async () => {
    const api = hypeApi({
      p1: { status: "AVAILABLE", score: 41.6, level: "RELEVANT", calculatedAt: NOW },
      p2: { status: "INSUFFICIENT_DATA", calculatedAt: NOW },
      p3: { status: "AVAILABLE", score: 88.7, level: "TRENDING", calculatedAt: NOW },
    });
    const { container } = renderApp(<AnatomyBody scheme={LOOK} pieces={toAnatomyPieces(LOOK)} />);
    const focus = await screen.findByLabelText("hype focus");
    await waitFor(() => expect(focus.querySelector(".hypef-top")).toBeTruthy());
    // a peça com mais Hype (88,7 → 89) vai para o topo, com a faixa em texto ao lado do medidor
    expect(focus.querySelector(".hypef-top")?.textContent).toContain("Tênis branco");
    expect(focus.querySelector(".hype-gauge text")?.textContent).toBe("89");
    expect(focus.querySelector(".hypef-top .hype-level-chip")?.textContent).toBe("Tendência");
    expect(screen.getByText("Tênis branco: HypeScore 89, faixa Tendência")).toBeTruthy();
    const rows = [...focus.querySelectorAll(".hypef-row")].map((r) => r.textContent);
    expect(rows[0]).toContain("Camiseta branca lisa");
    expect(rows[0]).toContain("Relevante");
    expect(rows[0]).toContain("42");
    expect(rows[1]).toContain("Calça jeans reta");
    expect(rows[1]).toContain("Dados insuficientes");
    expect(rows[1]).toContain("—");
    expect(focus.textContent).not.toContain("%");
    // legenda com as 6 faixas v2 em texto; nada da paleta de alerta do v1
    expect(focus.querySelector(".hypef-legend")?.textContent).toBe("Sinal baixoNichoRelevanteEm altaTendênciaViral");
    expect(container.innerHTML).not.toContain("status-critical");
    // as três peças vão num pedido só
    const calls = api.calls.filter((c) => c.path.startsWith("/api/hype/summaries"));
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toContain("type=PIECE");
  });

  it("nenhuma peça com dados: \"Dados insuficientes\", sem medidor e sem 0", async () => {
    hypeApi({ p1: { status: "INSUFFICIENT_DATA", calculatedAt: NOW } });
    const { container } = renderApp(<><AnatomyBody scheme={LOOK} pieces={toAnatomyPieces(LOOK)} /><CompactSignature scheme={LOOK} pieces={toAnatomyPieces(LOOK)} /></>);
    await waitFor(() => expect(screen.getAllByText("Dados insuficientes").length).toBe(2));
    expect(container.querySelector(".hype-gauge")).toBeNull();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it("assinatura compacta: medidor da peça com mais Hype + nome + faixa", async () => {
    hypeApi({ p1: { status: "AVAILABLE", score: 63, level: "HOT", calculatedAt: NOW } });
    const { container } = renderApp(<CompactSignature scheme={LOOK} pieces={toAnatomyPieces(LOOK)} />);
    expect(await screen.findByText("Camiseta branca lisa · Em alta")).toBeTruthy();
    expect(container.querySelector(".hype-gauge text")?.textContent).toBe("63");
  });

  it("o card não usa mais o v1 da peça (hypeScore/hypeScoreGlobal)", () => {
    const pieces = toAnatomyPieces({ ...LOOK, items: [{ wardrobeItemId: "p1", slot: "upper", piece: { ...PIECE, hypeScore: 99, hypeScoreGlobal: 99 } }, { wardrobeItemId: "p2", slot: "lower", piece: PIECE_2 }] });
    expect(pieces[0].hype).toBeUndefined();
    expect(pieces[0].hypeGlobal).toBeUndefined();
  });

  it("ranking puro: com score do maior para o menor; sem score por último; carregando = pendente", () => {
    const pieces = toAnatomyPieces(LOOK);
    const loading = rankPiecesByHype(pieces, {});
    expect(loading.ranked).toEqual([]);
    expect(loading.pending).toBe(true);
    const r = rankPiecesByHype(pieces, {
      p1: { summary: { status: "AVAILABLE", score: 30, level: "NICHE" }, loading: false, error: false },
      p2: { summary: { status: "NOT_CALCULATED" }, loading: false, error: false },
      p3: { summary: { status: "AVAILABLE", score: 70, level: "HOT" }, loading: false, error: false },
    });
    expect(r.ranked.map((x) => x.p.id)).toEqual(["p3", "p1"]);
    expect(r.others.map((x) => [x.p.id, x.state.kind])).toEqual([["p2", "not_calculated"]]);
    expect(r.pending).toBe(false);
  });

  it("cores decorativas por faixa, sem o vermelho de alerta; hypeStatus (deprecado) segue a faixa v2 e sem dado é neutro", () => {
    expect(Object.values(HYPE_LEVEL_COLOR).join(" ")).not.toContain("critical");
    expect(hypeStatus(null)).toBe(HYPE_LEVEL_COLOR.LOW_SIGNAL);
    expect(hypeStatus(10)).toBe(HYPE_LEVEL_COLOR.LOW_SIGNAL);
    expect(hypeStatus(59.6)).toBe(HYPE_LEVEL_COLOR.HOT);
    expect(hypeStatus(95)).toBe(HYPE_LEVEL_COLOR.VIRAL);
  });
});
