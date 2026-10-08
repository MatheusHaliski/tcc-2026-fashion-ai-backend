// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import MirrorPage from "@/app/(site)/(app)/mirror/page";
import SchemePage from "@/app/(site)/(app)/schemes/[id]/page";
import { SCHEME } from "@/test-utils/fixtures";
import { Suspense } from "react";

const tipos = [
  { id: "t1", codigo: "FEMININO", nome: "Feminino" },
  { id: "t2", codigo: "MASCULINO", nome: "Masculino" },
  { id: "t3", codigo: "UNISEX", nome: "Unisex" },
];
const state = { slots: {}, missing: [], complete: false, tipoLook: null as typeof tipos[number] | null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Tipo de look no Espelho", () => {
  it("carrega as opções do catálogo, salva o id e restaura a escolha ao reabrir", async () => {
    let saved = state;
    const { calls } = loggedAs(undefined, {
      "GET /api/me/mirror": () => saved,
      "GET /api/tipos-look": tipos,
      "GET /api/me/avatar3d": { exists: false },
      "PUT /api/me/mirror/tipo-look": (_url: URL, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        saved = { ...state, tipoLook: tipos.find(t => t.id === body.tipoLookId) ?? null };
        return saved;
      },
    });
    renderApp(<MirrorPage />);
    const select = await screen.findByLabelText("Tipo de look");
    await waitFor(() => expect((select as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(select);
    await screen.findByRole("option", { name: "Unisex" });
    expect(screen.getByRole("option", { name: "Feminino" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Masculino" }));
    await waitFor(() => expect(calls.find(c => c.method === "PUT" && c.path === "/api/me/mirror/tipo-look")?.body).toEqual({ tipoLookId: "t2" }));
    await waitFor(() => expect(select.textContent).toContain("Masculino"));
    cleanup();
    renderApp(<MirrorPage />);
    await waitFor(() => expect(screen.getByLabelText("Tipo de look").textContent).toContain("Masculino"));
  });

  it("as opções exibem o nome vindo do banco, sem uma lista fixa no formulário", async () => {
    loggedAs(undefined, { "GET /api/me/mirror": state, "GET /api/tipos-look": [{ id: "banco", codigo: "PERSONALIZADO", nome: "Tipo cadastrado no banco" }], "GET /api/me/avatar3d": { exists: false } });
    renderApp(<MirrorPage />);
    const select = await screen.findByLabelText("Tipo de look");
    await waitFor(() => expect((select as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(select);
    expect(await screen.findByRole("option", { name: "Tipo cadastrado no banco" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Feminino" })).toBeNull();
  });

  it("mostra o tipo persistido na outra página: detalhes do look", async () => {
    loggedAs(undefined, { [`GET /api/schemes/${SCHEME.id}`]: { scheme: { ...SCHEME, tipoLook: tipos[0] } } });
    const value = { id: SCHEME.id };
    const params = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
    renderApp(<Suspense fallback={null}><SchemePage params={params} /></Suspense>);
    expect(await screen.findByText("Tipo de look: Feminino")).toBeTruthy();
  });
});
