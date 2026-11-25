// @vitest-environment jsdom
/**
 * O Espelho com casa própria (/mirror, RF28): o espelho ocupa a área inteira (sem WebGL, as peças sobre o vidro) e os
 * controles abrem no painel lateral (fechado ao abrir a página; Esc fecha e devolve o foco), sobre /api/me/mirror — sem o quarto como anfitrião. O link `?vestir=<id>` (mirrorHref) veste a peça ao abrir, uma vez só, e
 * os parâmetros saem da URL; a falha vira aviso e o espelho continua; erro ao carregar oferece tentar de novo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import MirrorRoute from "@/app/(site)/(app)/mirror/page";

const TEE = { id: "p1", name: "Camiseta preta", category: "upper_piece", subcategory: "t_shirt", slot: "upper", imageUrl: "/media/p1.png" };
const state = (slots: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  slots: { outer_layer: null, upper: null, dress: null, lower: null, shoes: null, accessory: [], ...slots }, complete: false, missing: [], warnings: [], light: { kelvin: 4000 }, ...extra,
});
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const base = { "GET /api/tipos-look": [], "GET /api/me/avatar3d": { exists: false } };
const posts = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces");
const openPanel = async () => fireEvent.click(await screen.findByRole("button", { name: "Controles do espelho" }));

beforeEach(() => { router.replace.mockClear(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); });

describe("/mirror — o Espelho com casa própria", () => {
  it("o espelho ocupa a área; os controles abrem no painel lateral (fechado ao entrar), sem GRWM; Esc fecha", async () => {
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state({ upper: TEE }) });
    renderApp(<MirrorRoute />);
    const region = within(await screen.findByRole("region", { name: "Espelho" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Espelho");
    expect(region.getByTestId("mirror-flat-still")).toBeTruthy();            // jsdom não tem WebGL
    expect(region.queryByText(/pendurado|📌/)).toBeNull();                      // sem o recado "Faltou … pendurado aqui"
    const toggle = screen.getByRole("button", { name: "Controles do espelho" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("complementary", { name: "Controles do espelho" })).toBeNull();
    fireEvent.click(toggle);
    const panel = screen.getByRole("complementary", { name: "Controles do espelho" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(panel).getByTestId("mirror-controls")).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "GRWM" })).toBeNull();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Controles do espelho" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText("O espelho está vazio")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    // nada de quarto: nem "Mostrar no quarto", nem link para /room
    expect(screen.queryAllByRole("link").some((a) => (a.getAttribute("href") ?? "").startsWith("/room"))).toBe(false);
    expect(screen.getByRole("link", { name: "Minhas peças" }).getAttribute("href")).toBe("/closet");
    expect(screen.getByRole("link", { name: "Provador" }).getAttribute("href")).toBe("/try-on");
  });

  it("Vista-me no painel próprio, à esquerda, com os ícones FAI das ocasiões; o painel de controles não repete o Vista-me", async () => {
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state({ upper: TEE }) });
    renderApp(<MirrorRoute />);
    const toggle = await screen.findByRole("button", { name: "Vista-me" });
    expect(toggle.getAttribute("data-side")).toBe("left");
    fireEvent.click(toggle);
    const vista = within(screen.getByRole("complementary", { name: "Vista-me" }));
    const trabalho = vista.getByRole("button", { name: /Trabalho/ });
    expect(trabalho.querySelector("img")?.getAttribute("src")).toBe("/icons/fai/glyph/occ-01-48.png");
    expect(trabalho.textContent).not.toMatch(/💼/u);
    fireEvent.click(screen.getByRole("button", { name: "Controles do espelho" }));
    const controls = within(screen.getByRole("complementary", { name: "Controles do espelho" }));
    expect(controls.queryByRole("heading", { name: "Vista-me" })).toBeNull();
    expect(controls.getByRole("button", { name: /^Parte de cima:/ })).toBeTruthy();
    fireEvent.click(vista.getByRole("button", { name: "Fechar Vista-me" }));
    expect(screen.queryByRole("complementary", { name: "Vista-me" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("espelho vazio: a dica no vidro e as partes do look vazias", async () => {
    loggedAs(undefined, { ...base, "GET /api/me/mirror": state() });
    renderApp(<MirrorRoute />);
    expect(await screen.findByText("O espelho está vazio")).toBeTruthy();
    await openPanel();
    expect(screen.getByRole("button", { name: /^Parte de cima:/ })).toBeTruthy();
  });

  it("?vestir=<id>&vista=2d: veste a peça ao abrir (uma vez) e tira os parâmetros da URL", async () => {
    nav.search = new URLSearchParams("vestir=p1&vista=2d");
    const { calls } = loggedAs(undefined, { ...base, "GET /api/me/mirror": state(), "POST /api/me/mirror/pieces": state({ upper: TEE }, { notice: "Vestida: Camiseta preta" }) });
    const { rerender } = renderApp(<MirrorRoute />);
    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ pieceId: "p1" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mirror", { scroll: false }));
    await openPanel();
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
    await openPanel();
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
