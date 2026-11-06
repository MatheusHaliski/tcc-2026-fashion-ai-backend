// @vitest-environment jsdom
/**
 * O Espelho com casa própria (/mirror, RF28): o palco 2D (sem WebGL, as peças sobre o vidro) e o painel do espelho sobre
 * /api/me/mirror — sem o quarto como anfitrião. O link `?vestir=<id>` (mirrorHref) veste a peça ao abrir, uma vez só, e
 * os parâmetros saem da URL; a falha vira aviso e o espelho continua; erro ao carregar oferece tentar de novo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import MirrorRoute from "@/app/(site)/(app)/mirror/page";

const TEE = { id: "p1", name: "Camiseta preta", category: "upper_piece", subcategory: "t_shirt", slot: "upper", imageUrl: "/media/p1.png" };
const state = (slots: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  slots: { outer_layer: null, upper: null, dress: null, lower: null, shoes: null, accessory: [], ...slots }, complete: false, missing: [], warnings: [], postIt: null, light: { kelvin: 4000 }, ...extra,
});
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const base = { "GET /api/tipos-look": [], "GET /api/me/avatar3d": { exists: false } };
const posts = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces");

beforeEach(() => { router.replace.mockClear(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); });

describe("/mirror — o Espelho com casa própria", () => {
  it("palco 2D (sem WebGL: as peças sobre o vidro) + painel do espelho, sem redirecionar; o recado fica no vidro", async () => {
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state({ upper: TEE }, { postIt: "Hoje: casual" }) });
    renderApp(<MirrorRoute />);
    const region = within(await screen.findByRole("region", { name: "Espelho" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Espelho");
    expect(region.getByTestId("mirror-controls")).toBeTruthy();
    expect(region.getByTestId("mirror-flat-still")).toBeTruthy();            // jsdom não tem WebGL
    expect(region.getByRole("note").textContent).toContain("Hoje: casual");
    expect(screen.queryByText("O espelho está vazio")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    // nada de quarto: nem "Mostrar no quarto", nem link para /room
    expect(screen.queryAllByRole("link").some((a) => (a.getAttribute("href") ?? "").startsWith("/room"))).toBe(false);
    expect(screen.getByRole("link", { name: "Minhas peças" }).getAttribute("href")).toBe("/closet");
    expect(screen.getByRole("link", { name: "Provador" }).getAttribute("href")).toBe("/try-on");
  });

  it("espelho vazio: a dica no vidro e as partes do look vazias", async () => {
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state() });
    renderApp(<MirrorRoute />);
    expect(await screen.findByText("O espelho está vazio")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Parte de cima:/ })).toBeTruthy();
  });

  it("?vestir=<id>&vista=2d: veste a peça ao abrir (uma vez) e tira os parâmetros da URL", async () => {
    nav.search = new URLSearchParams("vestir=p1&vista=2d");
    const { calls } = loggedAs(undefined, { ...base, "GET /api/me/mirror": state(), "POST /api/me/mirror/pieces": state({ upper: TEE }, { notice: "Vestida: Camiseta preta" }) });
    const { rerender } = renderApp(<MirrorRoute />);
    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ pieceId: "p1" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mirror", { scroll: false }));
    expect(await screen.findByRole("button", { name: /^Parte de cima: Camiseta preta/ })).toBeTruthy();
    expect(await screen.findByText("Vestida: Camiseta preta")).toBeTruthy();
    // o efeito roda de novo (busca igual): não veste outra vez
    rerender(<MirrorRoute />); await settle();
    expect(posts(calls)).toHaveLength(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("falha ao vestir pelo link: o aviso aparece e o espelho continua com o look de antes", async () => {
    nav.search = new URLSearchParams("vestir=p9");
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state({ upper: TEE }), "POST /api/me/mirror/pieces": fail(422, "Peça indisponível") });
    renderApp(<MirrorRoute />);
    expect(await screen.findByText("Peça indisponível")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Parte de cima: Camiseta preta/ })).toBeTruthy();
  });

  it("erro ao carregar o espelho: o erro com tentar de novo, que recarrega", async () => {
    let first = true;
    loggedAs(undefined, { ...base, "GET /api/me/mirror": () => { if (first) { first = false; return fail(500, "Espelho fora")(); } return state(); } });
    renderApp(<MirrorRoute />);
    expect(await screen.findByText("Espelho fora")).toBeTruthy();
    expect(screen.queryByTestId("mirror-controls")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Tentar de novo|Tentar novamente/ })); });
    expect(await screen.findByTestId("mirror-controls")).toBeTruthy();
  });
});
