// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import RoomPage from "@/app/(site)/(app)/room/page";

// a cena 3D e a foto do reflexo não rodam no jsdom: aqui só a página (abas, listas, painel ao lado da cena)
vi.mock("@/components/room3d/room-scene", () => ({ default: () => <div data-testid="room-scene" /> }));
vi.mock("@/components/three/avatar-still", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
/** o jsdom não tem WebGL: a página abre a aba 3D só quando o canvas responde a webgl/webgl2 */
const withWebgl = () => { const real = HTMLCanvasElement.prototype.getContext; vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) { return kind === "webgl" || kind === "webgl2" ? ({} as unknown as RenderingContext) : (real as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest); }); };

const P = (id: string, moduleId: string) => ({ id, name: `Peça ${id}`, category: "upper_piece", subcategory: "t_shirt", colorHex: "#336699", imageUrl: `/media/${id}.png`, moduleId, addressLabel: moduleId, wearCount: 3, states: [] });
const ROOM = {
  owner: true, level: "LOFT", levelInfo: { unlocks: "extensão", aesthetic: "industrial" },
  modules: [
    { id: "door:1", slotType: "DOOR", label: "Porta 1", capacity: 10, pieces: [P("a", "door:1")] },
    { id: "drawer:1", slotType: "DRAWER", label: "Gaveta 1", capacity: 6, pieces: [P("b", "drawer:1")] },
    { id: "drawer:2", slotType: "DRAWER", label: "Gaveta 2", capacity: 6, empty: true, pieces: [] },
    { id: "shoe", slotType: "SHOE", label: "Sapateira", capacity: 8, pieces: [] },
  ],
  drawerLabels: { "1": "Camisetas" }, pieces: { a: P("a", "door:1"), b: P("b", "drawer:1") }, basket: [P("c", "basket")], chair: [], saleRack: { name: "Bazar", pieces: [] },
  capacity: { pieces: 2, max: 30 }, unboxing: [{ inventoryId: "i1", sku: "LAMP", name: "Luminária", slotType: "DECOR" }], keys: [{ id: "k1", username: "bia" }],
  light: { kelvin: 3500, guided: false }, decorations: [], closetLights: { score: 60, band: "ok", milestones: [], lit: 0 },
};
const LIST = [{ moduleId: "door:1", label: "Porta 1", count: 1, pieces: [P("a", "door:1")], actions: ["MOVE", "OPEN"] }, { moduleId: "drawer:1", label: "Gaveta 1", count: 1, pieces: [P("b", "drawer:1")], actions: ["RENAME"] }];
const MIRROR = { slots: { upper: { id: "a", name: "Peça a", imageUrl: "/media/a.png", moduleId: "door:1", addressLabel: "Porta 1" }, lower: null }, complete: false, postIt: "Hoje: casual",
  sequence: [{ pieceId: "a", name: "Peça a", moduleId: "door:1", legend: "Porta 1" }], message: null };
const TAG = { id: "a", name: "Peça a", composition: "100% algodão", care: "COTTON", origin: "GARIMPADA", garimpo: true, wearCount: 31, thirtyWears: true, costPerUse: 2.5, location: { address: "door:1", label: "Porta 1" }, diary: [{ date: "2026-10-01", occasion: "work" }] };

describe("Meu Quarto (RF27)", () => {
  it("dono vê módulos, lista, espelho e ações; abre etiqueta e organização", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": MIRROR, "GET /api/pieces/a/tag": TAG,
      "GET /api/me/room/organization/preview": { moves: [{ pieceId: "a", from: "door:1", to: "drawer:2", reason: "categoria" }], summary: "1 peça" },
      "PUT /api/me/room/drawers/1": {}, "PUT /api/pieces/a/room-address": {}, "POST /api/me/room-inventory/i1/apply": {}, "DELETE /api/me/room/organization": {},
      "PUT /api/me/room/light": {},
    });
    const { container } = renderApp(<RoomPage />);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(container.textContent).toContain("Porta 1");
    
    for (const tab of screen.queryAllByRole("tab")) fireEvent.click(tab);
    for (const b of screen.queryAllByRole("button").slice(0, 30)) {
      if ((b as HTMLButtonElement).disabled) continue;
      fireEvent.click(b);
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
      fireEvent.keyDown(document, { key: "Escape" });
    }
    container.querySelectorAll("input").forEach((i) => fireEvent.change(i, { target: { value: i.type === "range" ? "4000" : "Camisetas" } }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(calls.some((c) => c.path === "/api/me/room")).toBe(true);
  });

  it("QUARTO-ESPELHO: abrir o espelho troca a lista de posições pelas opções de vestimenta ao lado da cena; Voltar ao quarto devolve a lista", async () => {
    withWebgl();
    loggedAs(ME, { "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": MIRROR, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [{ id: "t1", codigo: "UNISEX", nome: "Unisex" }] });
    const { container } = renderApp(<RoomPage />);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    const room3d = container.querySelector(".room3d")!;
    expect(room3d.getAttribute("data-mode")).toBeNull();
    expect(screen.getByText("Posições")).toBeTruthy(); expect(screen.queryByTestId("mirror-controls")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Abrir espelho/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(room3d.getAttribute("data-mode")).toBe("mirror");
    expect(screen.getByTestId("mirror-controls")).toBeTruthy();                       // as opções de vestimenta, na aba Espelho embutida
    expect(screen.queryByText("Posições")).toBeNull();
    expect(screen.queryByRole("link", { name: /Meu Quarto/ })).toBeNull();            // já estamos no quarto
    expect(screen.getByRole("navigation", { name: "Espelho" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Voltar ao quarto/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(room3d.getAttribute("data-mode")).toBeNull();
    expect(screen.queryByTestId("mirror-controls")).toBeNull(); expect(screen.getByText("Posições")).toBeTruthy();
  });

  it("quarto que não carrega mostra o erro com tentar de novo", async () => {
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
