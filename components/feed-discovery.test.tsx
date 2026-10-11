// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";
import { OWNER } from "@/test-utils/fixtures";
import { FeedDiscovery } from "./feed-discovery";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows available discovery results without suggesting the current or blocked account", async () => {
  loggedAs(undefined, { "GET /api/search": (url: URL) => ({ results: url.searchParams.get("tab") === "MARCAS"
    ? [{ slug: "marca-teste", name: "Marca de teste" }]
    : [{ ...OWNER, relation: "NENHUMA" }, { ...OWNER, id: "p2", username: "bia", displayName: "Bia", relation: "NENHUMA" }, { ...OWNER, id: "blocked", username: "blocked", displayName: "Bloqueada", relation: "BLOQUEADO" }] }) });
  renderApp(<FeedDiscovery />);
  expect(await screen.findByRole("link", { name: /Bia/ })).toBeTruthy();
  expect((await screen.findByRole("link", { name: "Marca de teste" })).getAttribute("href")).toBe("/brands/marca-teste");
  expect(screen.queryByRole("link", { name: /Ana Souza|Bloqueada/ })).toBeNull();
});
