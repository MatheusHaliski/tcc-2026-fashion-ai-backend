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
  expect(await screen.findAllByRole("link", { name: /Bia/ })).toHaveLength(2);
  expect((await screen.findAllByRole("link", { name: /Marca de teste|@marca-teste/ }))[0].getAttribute("href")).toBe("/brands/marca-teste");
  expect(screen.queryAllByRole("link", { name: /Ana Souza|Bloqueada/ })).toHaveLength(0);
});
