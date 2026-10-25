// @vitest-environment jsdom
/**
 * Tutorial dos controles do quarto: voltar um passo, pausar/retomar a animação, desmarcar o "não mostrar" e funcionar
 * mesmo sem armazenamento do navegador; desligado, não abre sozinho.
 */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import RoomControlsTutorial from "./room-controls-tutorial";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("voltar um passo e pausar/retomar a animação do comando", async () => {
  mockApi(); renderApp(<RoomControlsTutorial enabled />);
  await screen.findByRole("dialog");
  const back = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
  expect(back.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
  expect(screen.getByText(/2 \/ 9/)).toBeTruthy();
  fireEvent.click(back);
  expect(screen.getByText(/1 \/ 9/)).toBeTruthy();
  const anim = () => document.querySelector("svg g.room-demo [style*='roomDemoWalk']") ?? document.querySelector("[style*='roomDemoWalk']");
  expect(anim()).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pausar animação" }));
  expect(anim()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reproduzir animação" }));
  expect(anim()).toBeTruthy();
});

it("desmarcar o 'não mostrar novamente' volta a mostrar na próxima visita", async () => {
  mockApi(); localStorage.setItem("fai:room-controls:v1:local", "hidden");
  renderApp(<RoomControlsTutorial enabled />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver comandos ilustrados" }));
  const box = screen.getByRole("checkbox", { name: "Não mostrar novamente" }) as HTMLInputElement;
  expect(box.checked).toBe(true);
  fireEvent.click(box);
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(localStorage.getItem("fai:room-controls:v1:local")).toBeNull();
});

it("sem armazenamento do navegador o tutorial abre e fecha normalmente", async () => {
  mockApi();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("bloqueado"); });
  renderApp(<RoomControlsTutorial enabled />);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("desligado não abre sozinho", () => {
  mockApi(); renderApp(<RoomControlsTutorial enabled={false} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Ver comandos ilustrados" })).toBeTruthy();
});
