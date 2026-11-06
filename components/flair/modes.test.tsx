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
  it("keeps the Afterparty locked below Loft and directs users to FAI XP; FLAIR 3D is never locked here", async () => {
    loggedAs(ME, routes("STUDIO"));
    renderApp(<FlairModes />);

    expect(await screen.findByRole("heading", { name: "FLAIR" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FLAIR METAMORFOSE" })).toBeTruthy();
    const locked = await screen.findAllByRole("link", { name: /Bloqueado até o nível Loft/ });
    expect(locked.length).toBe(1);
    for (const l of locked) expect(l.getAttribute("href")).toBe("/points");
    expect(screen.getByRole("link", { name: "Jogar FLAIR 3D" }).getAttribute("href")).toBe("/flair/jogos");
  });

  it("opens the Metamorfose game at Loft; the MET Gala Heist card is no longer listed (the route stays)", async () => {
    loggedAs(ME, routes("LOFT"));
    renderApp(<FlairModes />);

    const game = await screen.findByRole("link", { name: "Jogar FLAIR Metamorfose" });
    expect(game.getAttribute("href")).toBe("/flair/aventura");
    expect(screen.queryByRole("link", { name: "Jogar o MET Gala Heist" })).toBeNull();
    expect(screen.getByRole("link", { name: "Jogar FLAIR 3D" }).getAttribute("href")).toBe("/flair/jogos");
  });
});
