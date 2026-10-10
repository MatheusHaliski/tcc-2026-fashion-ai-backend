// @vitest-environment jsdom
/**
 * Remixar várias (RF19.CA13) em Minhas peças: o modo de seleção marca 2+ peças e leva ao criador de looks com elas
 * como semente (/schemes/new?pieces=…); com menos de 2 o botão fica desligado e Cancelar volta à grade normal.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { ME } from "@/test-utils/render";
import { PIECE, PIECE_2, page } from "@/test-utils/fixtures";
import ClosetPage from "@/app/(site)/(app)/closet/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

describe("Minhas peças — Remixar várias", () => {
  it("seleciona 2 peças e abre o criador de looks com elas", async () => {
    loggedAs(ME, { "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/taxonomy": { subcategories: {}, colors: {} } });
    const { container } = renderApp(<ClosetPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Remixar várias/ }));
    const go = await screen.findByRole("button", { name: /Remixar selecionadas/ });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>("button.pc-select"));
    expect(cards).toHaveLength(2);
    cards.forEach((c) => fireEvent.click(c));
    expect(cards.every((c) => c.getAttribute("aria-pressed") === "true")).toBe(true);
    expect(screen.getByText(/2 peças selecionadas/)).toBeTruthy();
    expect((go as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(go);
    expect(router.push).toHaveBeenCalledWith(`/schemes/new?pieces=${PIECE.id},${PIECE_2.id}`);
  });

  it("Cancelar sai do modo de seleção", async () => {
    loggedAs(ME, { "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/taxonomy": { subcategories: {}, colors: {} } });
    const { container } = renderApp(<ClosetPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Remixar várias/ }));
    await screen.findByRole("button", { name: /Remixar selecionadas/ });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: /Remixar selecionadas/ })).toBeNull();
    expect(container.querySelector("button.pc-select")).toBeNull();
  });
});
