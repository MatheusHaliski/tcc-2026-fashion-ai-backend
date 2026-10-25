// @vitest-environment jsdom
/**
 * Página de referência visual (só admin) e layout do app: os controles reais respondem (diálogo abre e fecha, chave
 * liga) e quem não é admin é barrado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import DesignPage from "./page";
import AppLayout from "../layout";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("página de design", () => {
  it("admin abre o diálogo, fecha pelo rodapé e liga a chave", async () => {
    loggedAs({ ...ME, role: "ADMIN" });
    renderApp(<DesignPage />);
    expect(await screen.findByRole("heading", { name: "Sistema visual" }, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("surface-2")).toBeTruthy();
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Diálogo acessível");
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("pessoa comum vê o acesso negado", async () => {
    loggedAs(ME);
    renderApp(<DesignPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByText("Sistema visual")).toBeNull();
  });

  it("layout do app envolve a tela na casca do app", async () => {
    loggedAs(ME);
    renderApp(<AppLayout><p>conteúdo da tela</p></AppLayout>);
    expect(await screen.findByText("conteúdo da tela")).toBeTruthy();
  });
});
