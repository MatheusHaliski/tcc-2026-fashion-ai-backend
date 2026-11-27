// @vitest-environment jsdom
/**
 * Exercício 06 — estação preferida do look no criador: a tela mostra o nome traduzido e envia o código do enum
 * (SPRING/SUMMER/AUTUMN/WINTER, nunca "Inverno"); "—" envia null; se o salvar falhar, o erro aparece e a escolha continua
 * na tela para tentar de novo.
 */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { tokenStore } from "@/lib/api/client";
import { SchemeBuilder } from "./scheme-builder";

vi.mock("@/components/look-seal-verification", () => ({ useLookSeals: () => ({ valid: true, requests: [], search: { loading: false, list: [] } }), SealSuggestions: () => null }));
vi.mock("@/components/scheme-card", () => ({ SchemeCard: () => null }));
vi.mock("@/components/hype/look-hype-preview", () => ({ LookHypePreview: () => null, PieceHypeTag: () => null }));
vi.mock("@/components/insights/insight-strip", () => ({ InsightStrip: () => null }));
vi.mock("@/components/expanded-card", () => ({ CreationSuccess: ({ id }: { id: string }) => <p role="status">sucesso {id}</p> }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const BUILDER = { totalPieces: 2, eligiblePieces: 2, status: "OK", lists: { upper_piece: [PIECE], lower_piece: [PIECE_2] }, defaultVisibility: "PRIVATE" };
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Falha ao salvar o look" }), { status: 500, headers: { "content-type": "application/json" } });
const next = async () => fireEvent.click((await screen.findAllByRole("button", { name: "Avançar", exact: true })).at(-1)!);
const season = () => screen.getByLabelText("Estação");
const choose = (option: string) => { fireEvent.click(season()); fireEvent.click(screen.getByRole("option", { name: option })); };
const save = () => {
  fireEvent.click(screen.getAllByRole("button", { name: "Revisar e salvar", exact: true }).find((b) => b.classList.contains("btn-primary"))!);
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
};

it("envia o código do enum (WINTER), não o nome traduzido; falha no salvar mantém Inverno e o reenvio manda o mesmo código", async () => {
  let attempt = 0;
  const api = loggedAs(undefined, { "GET /api/schemes/builder": BUILDER, "GET /api/hype/summaries": { items: {} }, "GET /api/opcoes/niveis-termicos": [],
    "PUT /api/schemes/s1": () => (++attempt === 1 ? fail() : {}) });
  renderApp(<SchemeBuilder initial={{ ...SCHEME, season: null }} />);
  await next(); await next();
  expect(season().textContent).not.toMatch(/Inverno|Verão|Primavera|Outono/);       // look legado: nenhuma estação escolhida
  choose("Inverno");
  save();
  expect(await screen.findByText("Falha ao salvar o look")).toBeTruthy();
  const puts = () => api.calls.filter((c) => c.method === "PUT").map((c) => (c.body as { season: string | null }).season);
  expect(puts()).toEqual(["WINTER"]);
  fireEvent.click(screen.getByRole("navigation", { name: "Etapas da criação" }).querySelectorAll("button")[2]);   // volta a Detalhes
  expect(season().textContent).toContain("Inverno");                                 // a escolha não se perdeu
  save();
  await waitFor(() => expect(puts()).toEqual(["WINTER", "WINTER"]));
});

it("voltar a \"—\" envia season null (sem estação), nunca SUMMER", async () => {
  const api = loggedAs(undefined, { "GET /api/schemes/builder": BUILDER, "GET /api/hype/summaries": { items: {} }, "GET /api/opcoes/niveis-termicos": [], "PUT /api/schemes/s1": {} });
  renderApp(<SchemeBuilder initial={{ ...SCHEME, season: "SUMMER" }} />);
  await next(); await next();
  expect(season().textContent).toContain("Verão");
  choose("—");
  save();
  await waitFor(() => expect(api.calls.some((c) => c.method === "PUT")).toBe(true));
  expect((api.calls.find((c) => c.method === "PUT")!.body as { season: string | null }).season).toBeNull();
});
