// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, within } from "@/test-utils/render";
import { CreatorWelcome, SuppressCreatorWelcome } from "./creator-welcome";

vi.mock("@/components/piece-creation-guide", () => ({ PieceCreationGuide: ({ open, onClose }: { open: boolean; onClose: () => void }) => open ? <div role="dialog" aria-label="Guia da peça"><button onClick={onClose}>Começar</button></div> : null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("abre o guia da peça uma vez por visita sem oferecer botão de reabertura", async () => {
  loggedAs();
  const { unmount } = renderApp(<CreatorWelcome kind="piece" onEntry />);
  const guide = await screen.findByRole("dialog", { name: "Guia da peça" });
  expect(screen.queryByRole("button", { name: "Como funciona" })).toBeNull();
  fireEvent.click(within(guide).getByRole("button", { name: "Começar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  unmount();
  renderApp(<CreatorWelcome kind="piece" onEntry />);
  expect(await screen.findByRole("dialog", { name: "Guia da peça" })).toBeTruthy();
});

it("suprime o guia do estúdio somente no contexto solicitado", async () => {
  loggedAs();
  const { rerender } = renderApp(<SuppressCreatorWelcome><CreatorWelcome kind="studio" /></SuppressCreatorWelcome>);
  expect(screen.queryByRole("button", { name: "Como funciona" })).toBeNull();
  rerender(<SuppressCreatorWelcome active={false}><CreatorWelcome kind="studio" /></SuppressCreatorWelcome>);
  expect(await screen.findByRole("button", { name: "Como funciona" })).toBeTruthy();
});
