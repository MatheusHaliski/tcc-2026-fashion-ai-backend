// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { PIECE, PIECE_2 } from "@/test-utils/fixtures";
import { SchemeBuilderSlots } from "./scheme-builder-slots";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("permite remover e reordenar peças sem usar o arraste", () => {
  mockApi({});
  const onRemove = vi.fn();
  const onMove = vi.fn();
  renderApp(<SchemeBuilderSlots selected={[{ id: PIECE.id, slot: "TOP" }, { id: PIECE_2.id, slot: "BOTTOM" }]} byId={new Map([[PIECE.id, PIECE], [PIECE_2.id, PIECE_2]])} slotLabels={{ TOP: "Cima", BOTTOM: "Baixo" }} onRemove={onRemove} onMove={onMove} />);
  const slots = screen.getByRole("region", { name: "partes do look" });
  fireEvent.click(within(slots).getByRole("button", { name: `Mover ${PIECE_2.name} para cima` }));
  expect(onMove).toHaveBeenCalledWith(PIECE_2.id, PIECE.id);
  fireEvent.click(within(slots).getByRole("button", { name: `Remover ${PIECE.name}` }));
  expect(onRemove).toHaveBeenCalledWith(PIECE.id);
  const rows = slots.querySelectorAll("[draggable=true]");
  fireEvent.dragStart(rows[0]);
  fireEvent.dragOver(rows[1]);
  fireEvent.drop(rows[1]);
  expect(onMove).toHaveBeenCalledWith(PIECE.id, PIECE_2.id);
});
