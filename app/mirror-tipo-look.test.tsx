// @vitest-environment jsdom
/**
 * Tipo de look no Espelho — agora dentro do Meu Quarto (/room?espelho=1): "Para quem é o look" em chips de rádio com os
 * nomes do banco; a escolha é salva no espelho e volta ao reabrir; o look salvo mostra o tipo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import RoomPage from "@/app/(site)/(app)/room/page";
import SchemePage from "@/app/(site)/(app)/schemes/[id]/page";
import { SCHEME } from "@/test-utils/fixtures";
import { Suspense } from "react";

// a cena 3D e a foto do reflexo não rodam no jsdom: o espelho abre pelo link de entrada (sem a caminhada)
vi.mock("@/components/room3d/room-scene", () => ({ default: () => <div data-testid="room-scene" /> }));
vi.mock("@/components/three/avatar-still", () => ({ default: () => null }));

const tipos = [
  { id: "t1", codigo: "FEMININO", nome: "Feminino" },
  { id: "t2", codigo: "MASCULINO", nome: "Masculino" },
  { id: "t3", codigo: "UNISEX", nome: "Unisex" },
];
const state = { slots: {}, missing: [], complete: false, tipoLook: null as typeof tipos[number] | null };
const ROOM = { owner: true, level: "ESTREIA", levelInfo: { unlocks: "", aesthetic: "Estreia" }, modules: [], drawerLabels: {}, pieces: {}, capacity: { pieces: 0, positions: 0 } };
const withWebgl = () => { const real = HTMLCanvasElement.prototype.getContext; vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) { return kind === "webgl" || kind === "webgl2" ? ({} as unknown as RenderingContext) : (real as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest); }); };
const roomRoutes = { "GET /api/me/room": ROOM, "GET /api/me/room/list": [], "GET /api/me/avatar3d": { exists: false } };
const openMirror = async () => { renderApp(<RoomPage />); await act(async () => { await new Promise((r) => setTimeout(r, 60)); }); return within(await screen.findByTestId("mirror-controls")); };
beforeEach(() => { withWebgl(); nav.search = new URLSearchParams("espelho=1"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); });

describe("Tipo de look no Espelho", () => {
  it("chips com as opções do catálogo: salva o id e restaura a escolha ao reabrir o espelho", async () => {
    let saved = state;
    const { calls } = loggedAs(undefined, {
      ...roomRoutes,
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
    loggedAs(undefined, { ...roomRoutes, "GET /api/me/mirror": state, "GET /api/tipos-look": [{ id: "banco", codigo: "PERSONALIZADO", nome: "Tipo cadastrado no banco" }] });
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
