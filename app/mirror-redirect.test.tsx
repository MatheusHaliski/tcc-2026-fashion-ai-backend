// @vitest-environment jsdom
/**
 * /mirror deixou de ser uma tela: o Espelho fica dentro do Meu Quarto (lib/nav/mirror-href.ts). Links antigos — do
 * backend, de insights e de favoritos — levam ao quarto com a prova aberta, carregando a peça (?piece= → &vestir=) e a
 * prévia 2D (?vista=2d).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, ME, renderApp, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import MirrorPage from "@/app/(site)/(app)/mirror/page";
import { mirrorHref } from "@/lib/nav/mirror-href";

beforeEach(() => { router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); });

describe("/mirror → Meu Quarto › Espelho", () => {
  it("sem parâmetros: abre o espelho no quarto", async () => {
    loggedAs(ME, {});
    renderApp(<MirrorPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/room?espelho=1"));
  });
  it("com peça e prévia 2D: leva a peça para vestir e abre a prévia", async () => {
    nav.search = new URLSearchParams("piece=abc&vista=2d");
    loggedAs(ME, {});
    renderApp(<MirrorPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/room?espelho=1&vestir=abc&vista=2d"));
  });
  it("mirrorHref monta o mesmo contrato usado pelos links do app", () => {
    expect(mirrorHref()).toBe("/room?espelho=1");
    expect(mirrorHref({ piece: "p 1" })).toBe("/room?espelho=1&vestir=p+1");
    expect(mirrorHref({ vista: "3d" })).toBe("/room?espelho=1");
  });
});
