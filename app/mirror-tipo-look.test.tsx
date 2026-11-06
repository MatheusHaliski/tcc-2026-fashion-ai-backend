// @vitest-environment jsdom
/**
 * Tipo de look no Espelho (/mirror): "Para quem é o look" em chips de rádio com os nomes do banco; a escolha é salva no
 * espelho e volta ao reabrir; o look salvo mostra o tipo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import MirrorRoute from "@/app/(site)/(app)/mirror/page";
import SchemePage from "@/app/(site)/(app)/schemes/[id]/page";
import { SCHEME } from "@/test-utils/fixtures";
import { Suspense } from "react";

const tipos = [
  { id: "t1", codigo: "FEMININO", nome: "Feminino" },
  { id: "t2", codigo: "MASCULINO", nome: "Masculino" },
  { id: "t3", codigo: "UNISEX", nome: "Unisex" },
];
const state = { slots: {}, missing: [], complete: false, tipoLook: null as typeof tipos[number] | null };
const routes = { "GET /api/me/avatar3d": { exists: false } };
const openMirror = async () => { renderApp(<MirrorRoute />); return within(await screen.findByTestId("mirror-controls")); };
beforeEach(() => { nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Tipo de look no Espelho", () => {
  it("chips com as opções do catálogo: salva o id e restaura a escolha ao reabrir o espelho", async () => {
    let saved = state;
    const { calls } = loggedAs(undefined, {
      ...routes,
      "GET /api/me/mirror": () => saved,
      "GET /api/tipos-look": tipos,
      "PUT /api/me/mirror/tipo-look": (_url: URL, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        saved = { ...state, tipoLook: tipos.find(t => t.id === body.tipoLookId) ?? null };
        return saved;
      },
    });
    const panel = await openMirror();
    const group = within(panel.getByRole("radiogroup", { name: "Para quem é o look" }));
    expect(await group.findByRole("radio", { name: "Unisex" })).toBeTruthy();
    expect(group.getByRole("radio", { name: "Feminino" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(group.getByRole("radio", { name: "Masculino" }));
    await waitFor(() => expect(calls.find(c => c.method === "PUT" && c.path === "/api/me/mirror/tipo-look")?.body).toEqual({ tipoLookId: "t2" }));
    await waitFor(() => expect(group.getByRole("radio", { name: "Masculino" }).getAttribute("aria-checked")).toBe("true"));
    cleanup();
    const again = await openMirror();
    await waitFor(() => expect(within(again.getByRole("radiogroup", { name: "Para quem é o look" })).getByRole("radio", { name: "Masculino" }).getAttribute("aria-checked")).toBe("true"));
  });

  it("os chips exibem o nome vindo do banco, sem uma lista fixa", async () => {
    loggedAs(undefined, { ...routes, "GET /api/me/mirror": state, "GET /api/tipos-look": [{ id: "banco", codigo: "PERSONALIZADO", nome: "Tipo cadastrado no banco" }] });
    const panel = await openMirror();
    expect(await panel.findByRole("radio", { name: "Tipo cadastrado no banco" })).toBeTruthy();
    expect(panel.queryByRole("radio", { name: "Feminino" })).toBeNull();
  });

  it("mostra o tipo persistido na outra página: detalhes do look", async () => {
    loggedAs(undefined, { [`GET /api/schemes/${SCHEME.id}`]: { scheme: { ...SCHEME, tipoLook: tipos[0] } } });
    const value = { id: SCHEME.id };
    const params = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
    renderApp(<Suspense fallback={null}><SchemePage params={params} /></Suspense>);
    expect(await screen.findByText("Tipo de look: Feminino")).toBeTruthy();
  });
});
