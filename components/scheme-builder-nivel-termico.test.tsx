// @vitest-environment jsdom
/**
 * Construtor de looks › nível térmico (docs/banco-de-dados/solucoes/04-nivel-termico.md): o campo lista os níveis ativos
 * com "Não informado" à parte; o salvar leva o ID escolhido; voltar a "Não informado" num look que tinha nível manda o
 * clear explícito (sem ele o backend preserva o nível anterior).
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

const NIVEIS = [{ id: "n1", codigo: "LEVE", nome: "Leve" }, { id: "n2", codigo: "MODERADO", nome: "Moderado" }];
const BUILDER = { totalPieces: 2, eligiblePieces: 2, status: "OK", lists: { upper_piece: [PIECE], lower_piece: [PIECE_2] }, defaultVisibility: "PRIVATE" };
const setup = () => loggedAs(undefined, { "GET /api/schemes/builder": BUILDER, "GET /api/hype/summaries": { items: {} }, "GET /api/opcoes/niveis-termicos": NIVEIS, "PUT /api/schemes/s1": {} });
const next = async () => fireEvent.click((await screen.findAllByRole("button", { name: "Avançar", exact: true })).at(-1)!);
const field = () => screen.getByLabelText("Nível térmico do look");
const choose = (option: string) => { fireEvent.click(field()); fireEvent.click(screen.getByRole("option", { name: option })); };
async function save(api: ReturnType<typeof setup>) {
  fireEvent.click(screen.getAllByRole("button", { name: "Revisar e salvar", exact: true }).find((b) => b.classList.contains("btn-primary"))!);
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() => expect(api.calls.some((c) => c.method === "PUT")).toBe(true));
  return api.calls.find((c) => c.method === "PUT")!.body as Record<string, unknown>;
}

it("look sem nível: escolher Leve envia o ID, sem clear", async () => {
  const api = setup();
  renderApp(<SchemeBuilder initial={{ ...SCHEME, nivelTermico: null }} />);
  await next(); await next();
  await waitFor(() => expect(field().hasAttribute("disabled")).toBe(false));
  choose("Leve");
  expect(await save(api)).toMatchObject({ nivelTermicoId: "n1", clearNivelTermico: false });
});

it("look com nível: voltar a 'Não informado' envia nivelTermicoId nulo e o clear explícito", async () => {
  const api = setup();
  renderApp(<SchemeBuilder initial={{ ...SCHEME, nivelTermico: NIVEIS[1] }} />);
  await next(); await next();
  await waitFor(() => expect(field().hasAttribute("disabled")).toBe(false));
  expect(field().textContent).toContain("Moderado");
  choose("Não informado");
  expect(await save(api)).toMatchObject({ nivelTermicoId: null, clearNivelTermico: true });
});

it("look com nível sem mexer no campo: mantém o ID e não limpa", async () => {
  const api = setup();
  renderApp(<SchemeBuilder initial={{ ...SCHEME, nivelTermico: NIVEIS[1] }} />);
  await next(); await next();
  await waitFor(() => expect(field().hasAttribute("disabled")).toBe(false));
  expect(await save(api)).toMatchObject({ nivelTermicoId: "n2", clearNivelTermico: false });
});
