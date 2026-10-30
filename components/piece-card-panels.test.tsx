// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PieceCardPanels } from "./piece-card-panels";
import { PIECE } from "@/test-utils/fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("follows initial changes until the user chooses, then preserves that selection and panel ID", async () => {
  mockApi({});
  const { rerender } = renderApp(<PieceCardPanels piece={PIECE} initial="info" />);
  const info = screen.getByRole("tab", { name: /info/i });
  const panelId = info.getAttribute("aria-controls");
  expect(info.getAttribute("aria-selected")).toBe("true");
  rerender(<PieceCardPanels piece={PIECE} initial="hype" />);
  const hype = screen.getByRole("tab", { name: "Hype", exact: true });
  await waitFor(() => expect(hype.getAttribute("aria-selected")).toBe("true"));
  fireEvent.click(info);
  rerender(<PieceCardPanels piece={{ ...PIECE, name: "Peça atualizada" }} initial="hype" />);
  expect(info.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").id).toBe(panelId);
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(info.id);
});

it("moves keyboard focus and the selected tab together using the arrow keys", () => {
  mockApi({});
  renderApp(<PieceCardPanels piece={PIECE} />);
  const info = screen.getByRole("tab", { name: /info/i });
  const hype = screen.getByRole("tab", { name: "Hype", exact: true });
  info.focus();
  fireEvent.keyDown(info, { key: "ArrowRight" });
  expect(document.activeElement).toBe(hype);
  expect(hype.tabIndex).toBe(0);
  expect(info.tabIndex).toBe(-1);
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(hype.id);
  fireEvent.keyDown(hype, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(info);
  expect(info.getAttribute("aria-selected")).toBe("true");
});
