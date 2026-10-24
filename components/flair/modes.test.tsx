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
  it("keeps Metamorfose games locked below Loft and directs users to FAI XP", async () => {
    loggedAs(ME, routes("STUDIO"));
    renderApp(<FlairModes />);

    expect(await screen.findByRole("heading", { name: "FLAIR" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FLAIR METAMORFOSE" })).toBeTruthy();
    expect((await screen.findByRole("link", { name: /Bloqueado até o nível Loft/ })).getAttribute("href")).toBe("/points");
  });

  it("opens the Metamorfose game at Loft", async () => {
    loggedAs(ME, routes("LOFT"));
    renderApp(<FlairModes />);

    const game = await screen.findByRole("link", { name: "Jogar FLAIR Metamorfose" });
    expect(game.getAttribute("href")).toBe("/flair/aventura");
  });
});
