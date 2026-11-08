// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { FlairModes } from "./modes";
import { cleanup, loggedAs, ME, renderApp, screen } from "@/test-utils/render";

afterEach(() => { cleanup(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const routes = (level: string) => ({
  "GET /api/flair/modes": { architecture: [], modes: [], themes: [], bosses: [], board: [], territories: [], chessBoard: [], roles: [], ethics: "", divisions: [] },
  "GET /api/flair/modes/looks": { looks: [] },
  "GET /api/flair/modes/trophies": [],
  "GET /api/me/points": { balance: 0, lifetime: level === "LOFT" ? 900 : 899, level, levels: [], rules: [] },
});

describe("FLAIR game categories", () => {
  it("lists FLAIR 3D MAKE UP for everyone, never locked here; the Afterparty card is gone below Loft (the route stays)", async () => {
    loggedAs(ME, routes("STUDIO"));
    renderApp(<FlairModes />);

    expect(await screen.findByRole("heading", { name: "FLAIR" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FLAIR 3D MAKE UP" })).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /Bloqueado até o nível Loft/ })).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Jogar FLAIR 3D MAKE UP" }).getAttribute("href")).toBe("/flair/jogos");
  });

  it("at Loft neither the Afterparty nor the MET Gala Heist is listed (both stay for the future Glass Empire game)", async () => {
    loggedAs(ME, routes("LOFT"));
    renderApp(<FlairModes />);

    expect(await screen.findByRole("link", { name: "Jogar FLAIR 3D MAKE UP" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Jogar FLAIR Metamorfose" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Jogar o MET Gala Heist" })).toBeNull();
    expect(document.querySelector('a[href="/flair/aventura"]')).toBeNull();
  });
});
