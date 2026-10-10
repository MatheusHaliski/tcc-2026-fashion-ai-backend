// @vitest-environment jsdom
/**
 * Prova no espelho dentro do Meu Quarto: a rota continua /room, mas o menu lateral passa para "Espelho" enquanto a
 * prova está aberta e volta para "Meu Quarto" quando a pessoa se afasta (ou sai da tela).
 */
import { afterEach, expect, it } from "vitest";
import { act, cleanup, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { AppShell } from "./app-shell";
import { setNavActiveOverride } from "@/lib/nav/active-override";

afterEach(() => { act(() => setNavActiveOverride(null)); cleanup(); nav.pathname = "/"; });

const current = () => screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"));

it("no quarto acende Meu Quarto; com a prova aberta, só Espelho; ao sair, volta para Meu Quarto", async () => {
  nav.pathname = "/room";
  loggedAs(ME, { "GET /api/notifications/unread-count": { unread: 0 }, "GET /api/me/preferences": {} });
  renderApp(<AppShell><p>quarto</p></AppShell>);
  await waitFor(() => expect(screen.getByText("quarto")).toBeTruthy());
  await waitFor(() => expect(current()).toContain("/room"));
  expect(current()).not.toContain("/mirror");
  act(() => setNavActiveOverride("/mirror"));
  expect(current()).toContain("/mirror");
  expect(current()).not.toContain("/room");
  act(() => setNavActiveOverride(null));
  expect(current()).toContain("/room");
  expect(current()).not.toContain("/mirror");
});
