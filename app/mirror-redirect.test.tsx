// @vitest-environment jsdom
/**
 * O Meu Quarto deixou de ser uma tela e o Espelho ganhou casa própria (/mirror). A rota /room só redireciona os links
 * antigos: /room → catálogo da Suíte de Vidro; /room?espelho=1[&vestir=X][&vista=2d] → /mirror com os mesmos parâmetros;
 * /room?piece=X ("Mostrar no quarto") → o Guarda-roupa. mirrorHref (lib/nav/mirror-href.ts) é o contrato dos links do app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import RoomPage from "@/app/(site)/(app)/room/page";
import MirrorRoute from "@/app/(site)/(app)/mirror/page";
import { MIRROR_ROOM_PATH, mirrorHref } from "@/lib/nav/mirror-href";

beforeEach(() => { router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); });

describe("/room → links antigos redirecionados", () => {
  it("sem parâmetros: o catálogo de jogos da Suíte de Vidro", async () => {
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/flair/jogos?district=SUITE"));
  });
  it("espelho com peça para vestir: /mirror?vestir=<id>", async () => {
    nav.search = new URLSearchParams("espelho=1&vestir=p1");
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mirror?vestir=p1"));
  });
  it("espelho com a prévia 2D: /mirror?vista=2d (e com peça, os dois parâmetros)", async () => {
    nav.search = new URLSearchParams("espelho=1&vista=2d");
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mirror?vista=2d"));
    cleanup(); router.replace.mockClear();
    nav.search = new URLSearchParams("espelho=1&vestir=abc&vista=2d");
    renderApp(<RoomPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/mirror?vestir=abc&vista=2d"));
  });
  it("'Mostrar no quarto' (?piece=): o Guarda-roupa", async () => {
    nav.search = new URLSearchParams("piece=p1");
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/closet"));
  });
});

describe("/mirror e mirrorHref", () => {
  it("/mirror não redireciona mais: é a tela do Espelho", async () => {
    loggedAs(ME, { "GET /api/me/mirror": { slots: {}, complete: false }, "GET /api/tipos-look": [], "GET /api/me/avatar3d": { exists: false } });
    renderApp(<MirrorRoute />);
    expect(await screen.findByTestId("mirror-controls")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("mirrorHref monta o mesmo contrato usado pelos links do app", () => {
    expect(MIRROR_ROOM_PATH).toBe("/mirror");
    expect(mirrorHref()).toBe("/mirror");
    expect(mirrorHref({ piece: "p 1" })).toBe("/mirror?vestir=p+1");
    expect(mirrorHref({ piece: "p1", vista: "2d" })).toBe("/mirror?vestir=p1&vista=2d");
    expect(mirrorHref({ vista: "2d" })).toBe("/mirror?vista=2d");
    expect(mirrorHref({ vista: "3d" })).toBe("/mirror");
  });
});
