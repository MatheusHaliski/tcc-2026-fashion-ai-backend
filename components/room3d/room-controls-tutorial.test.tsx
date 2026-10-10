// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import RoomControlsTutorial from "./room-controls-tutorial";
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
it("opens for beginners, explains all eight commands and remembers explicit opt-out", async () => {
  mockApi(); renderApp(<RoomControlsTutorial enabled />);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
  expect(screen.getByText(/8 \/ 8/)).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente" }));
  fireEvent.click(screen.getByRole("button", { name: "Entendi, começar" }));
  cleanup(); renderApp(<RoomControlsTutorial enabled />); expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver comandos ilustrados" })); expect(await screen.findByRole("dialog")).toBeTruthy();
});
it("keeps showing on later visits unless the user checks the opt-out", async () => {
  mockApi(); renderApp(<RoomControlsTutorial enabled />); expect(await screen.findByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fechar" })); cleanup(); renderApp(<RoomControlsTutorial enabled />);
  expect(await screen.findByRole("dialog")).toBeTruthy();
});
