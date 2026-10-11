// @vitest-environment jsdom
/**
 * Espelho como navegação derivada do Meu Quarto: não há item "Espelho" no menu lateral. Com a prova do espelho à vista,
 * aparece "Espelho" recuado logo abaixo de "Meu Quarto" (que continua visível como pai) e é ele a página atual; ao sair
 * do espelho o sub-item some e "Meu Quarto" volta a ser a página. A rota /mirror (só redireciona) acende o quarto.
 */
import { afterEach, expect, it } from "vitest";
import { act, cleanup, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { AppShell } from "./app-shell";
import { setNavSub } from "@/lib/nav/active-override";

afterEach(() => { act(() => setNavSub(null)); cleanup(); nav.pathname = "/"; });

const current = () => Array.from(document.querySelectorAll("[aria-current=page]"));
const roomLink = () => screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/room")!;
const shell = async () => {
  loggedAs(ME, { "GET /api/notifications/unread-count": { unread: 0 }, "GET /api/me/preferences": {} });
  renderApp(<AppShell><p>quarto</p></AppShell>);
  await waitFor(() => expect(screen.getByText("quarto")).toBeTruthy());
  await waitFor(() => expect(roomLink()).toBeTruthy());
};

it("sem item Espelho no menu; na prova, 'Espelho' recuado sob 'Meu Quarto' é a página atual; ao sair, volta para Meu Quarto", async () => {
  nav.pathname = "/room";
  await shell();
  expect(screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/mirror")).toBe(false);
  expect(roomLink().getAttribute("aria-current")).toBe("page");
  expect(document.querySelector(".nav-link-sub")).toBeNull();

  act(() => setNavSub({ parent: "/room", key: "nav.mirror", icon: "ACT-32" }));
  const sub = document.querySelector(".nav-link-sub")!;
  expect(sub.textContent).toBe("Espelho");
  expect(sub.tagName).toBe("SPAN");                                         // não é link: chega-se ao espelho andando
  expect(sub.getAttribute("aria-current")).toBe("page");
  expect(sub.previousElementSibling).toBe(roomLink());                     // logo abaixo de Meu Quarto, no mesmo item
  expect(roomLink().getAttribute("aria-current")).toBeNull();
  expect(roomLink().getAttribute("data-ancestor")).toBe("true");           // o pai continua visível e marcado
  expect(current()).toEqual([sub]);

  act(() => setNavSub(null));
  expect(document.querySelector(".nav-link-sub")).toBeNull();
  expect(roomLink().getAttribute("aria-current")).toBe("page");
});

it("o sub-item só aparece sob o pai certo e só quando a rota é a dele", async () => {
  nav.pathname = "/closet";
  await shell();
  act(() => setNavSub({ parent: "/room", key: "nav.mirror", icon: "ACT-32" }));
  expect(document.querySelector(".nav-link-sub")).toBeNull();
});

it("na rota /mirror (só redireciona para o quarto) o Meu Quarto fica aceso", async () => {
  nav.pathname = "/mirror";
  await shell();
  expect(roomLink().getAttribute("aria-current")).toBe("page");
});
