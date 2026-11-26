// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, ME, renderApp, screen } from "@/test-utils/render";
import { AuraUnlocksDeepDrawer } from "./aura-unlocks-deep-drawer";

/** Circuito Aura — o link do aviso de marco ("?destrava=<id>") abre a análise do Hype na peça ampliada. */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("AuraUnlocksDeepDrawer", () => {
  it("sem o parâmetro (ou com outro card) não renderiza nada", () => {
    window.history.replaceState(null, "", "/pieces/p1?destrava=p2");
    renderApp(<AuraUnlocksDeepDrawer type="PIECE" id="p1" name="Jaqueta" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Análise de Hype/)).toBeNull();
  });

  it("com ?destrava=<id do card> abre a análise do Hype", async () => {
    window.history.replaceState(null, "", "/pieces/p1?destrava=p1");
    loggedAs(ME, {});
    renderApp(<AuraUnlocksDeepDrawer type="PIECE" id="p1" name="Jaqueta" />);
    expect(await screen.findByRole("dialog", { name: /Jaqueta/ })).toBeTruthy();
  });
});
