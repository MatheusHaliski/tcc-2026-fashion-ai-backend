// @vitest-environment jsdom
/**
 * O Espelho tem casa própria: é um item do menu lateral (grupo Guarda-roupa, /mirror) e não há mais "Meu Quarto" (/room).
 * A navegação derivada (lib/nav/active-override.ts) continua disponível para qualquer pai: com um sub-item definido,
 * aparece recuado logo abaixo do pai (que continua visível) e é ele a página atual; sem sub-item, o pai volta a ser a página.
 */
import { afterEach, expect, it } from "vitest";
import { act, cleanup, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { AppShell } from "./app-shell";
import { setNavSub } from "@/lib/nav/active-override";

afterEach(() => { act(() => setNavSub(null)); cleanup(); nav.pathname = "/"; });

const current = () => Array.from(document.querySelectorAll("[aria-current=page]"));
const link = (href: string) => screen.getAllByRole("link").find((a) => a.getAttribute("href") === href)!;
const shell = async () => {
  loggedAs(ME, { "GET /api/notifications/unread-count": { unread: 0 }, "GET /api/me/preferences": {} });
  renderApp(<AppShell><p>espelho</p></AppShell>);
  await waitFor(() => expect(screen.getByText("espelho")).toBeTruthy());
  await waitFor(() => expect(link("/mirror")).toBeTruthy());
};

it("'Espelho' é um item do menu (Guarda-roupa) e não há mais 'Meu Quarto'; em /mirror ele é a página atual", async () => {
  nav.pathname = "/mirror";
  await shell();
  expect(screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/room")).toBe(false);
  const mirror = link("/mirror");
  expect(mirror.textContent).toBe("Espelho");
  expect(mirror.closest("section")!.getAttribute("aria-labelledby")).toBe("nav-nav.group.wardrobe");
  expect(mirror.getAttribute("aria-current")).toBe("page");
  expect(current()).toEqual([mirror]);
  expect(document.querySelector(".nav-link-sub")).toBeNull();
});

it("sub-item recuado sob o pai (navegação derivada) é a página atual; ao sair, o pai volta a ser a página", async () => {
  nav.pathname = "/atelier";                                                // pai só no menu lateral (fora da barra inferior)
  await shell();
  expect(link("/atelier").getAttribute("aria-current")).toBe("page");

  act(() => setNavSub({ parent: "/atelier", key: "nav.mirror", icon: "ACT-32" }));
  const sub = document.querySelector(".nav-link-sub")!;
  expect(sub.textContent).toBe("Espelho");
  expect(sub.tagName).toBe("SPAN");                                         // não é link: é o estado da própria página
  expect(sub.getAttribute("aria-current")).toBe("page");
  expect(sub.previousElementSibling).toBe(link("/atelier"));                // logo abaixo do pai, no mesmo item
  expect(link("/atelier").getAttribute("aria-current")).toBeNull();
  expect(link("/atelier").getAttribute("data-ancestor")).toBe("true");      // o pai continua visível e marcado
  expect(current()).toEqual([sub]);

  act(() => setNavSub(null));
  expect(document.querySelector(".nav-link-sub")).toBeNull();
  expect(link("/atelier").getAttribute("aria-current")).toBe("page");
});

it("o sub-item só aparece sob o pai certo e só quando a rota é a dele", async () => {
  nav.pathname = "/mirror";
  await shell();
  act(() => setNavSub({ parent: "/atelier", key: "nav.mirror", icon: "ACT-32" }));
  expect(document.querySelector(".nav-link-sub")).toBeNull();
  expect(link("/mirror").getAttribute("aria-current")).toBe("page");
});
