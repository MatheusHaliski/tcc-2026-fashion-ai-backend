// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import RoomPage from "@/app/(site)/(app)/room/page";
import { useNavSub } from "@/lib/nav/active-override";

// a cena 3D e a foto do reflexo não rodam no jsdom: aqui só a página (abas, listas, painel ao lado da cena)
vi.mock("@/components/room3d/room-scene", () => ({ default: () => <div data-testid="room-scene" /> }));
vi.mock("@/components/three/avatar-still", () => ({ default: () => null }));
// a textura da peça (pré-carregada antes de vestir) não carrega no jsdom
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), loadTexture: () => Promise.resolve(null) }));

beforeEach(() => { router.replace.mockClear(); window.history.replaceState(null, "", "/room"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); });
/** o sub-item "Espelho" do menu lateral (navegação derivada do Meu Quarto) */
function NavSubProbe() { const sub = useNavSub(); return <i data-testid="nav-sub">{sub ? `${sub.parent}>${sub.key}` : ""}</i>; }
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

  it("QUARTO-ESPELHO: Ir ao espelho sem a caminhada (jsdom: sem cena 3D) abre a prova direto; o painel troca a lista de posições sem repetir as roupas em mãos; Voltar ao quarto e a trilha devolvem", async () => {
    withWebgl();
    const rack = [{ id: "b", name: "Peça b", imageUrl: "/media/b.png", category: "upper_piece", slot: "upper", worn: false }, { id: "c", name: "Peça c", imageUrl: "/media/c.png", category: "upper_piece", slot: "upper", worn: false }];
    const { calls } = loggedAs(ME, { "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": { ...MIRROR, rack }, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [{ id: "t1", codigo: "UNISEX", nome: "Unisex" }],
      "GET /api/me/mirror/wardrobe?slot=upper": { pieces: [] }, "GET /api/me/mirror/wardrobe?slot=outer_layer": { pieces: [] },
      "POST /api/me/mirror/pieces": { ...MIRROR, slots: { upper: { id: "b", name: "Peça b", imageUrl: "/media/b.png", slot: "upper" }, lower: null }, rack: [{ ...rack[0], worn: true }] },
      "DELETE /api/me/mirror/rack/c": { ...MIRROR, rack: [rack[0]] } });
    const { container } = renderApp(<><RoomPage /><NavSubProbe /></>);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    const room3d = container.querySelector(".room3d")!, walkStatus = container.querySelector(".room3d-walk-status")!;
    expect(room3d.getAttribute("data-mode")).toBeNull();
    expect(screen.getByText("Posições")).toBeTruthy(); expect(screen.queryByTestId("mirror-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir espelho/ })).toBeNull();      // um caminho só: Ir ao espelho (anda até o espelho)
    expect(walkStatus.getAttribute("aria-live")).toBe("polite"); expect(walkStatus.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Ir ao espelho" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(room3d.getAttribute("data-mode")).toBe("mirror");
    expect(screen.getByTestId("mirror-controls")).toBeTruthy();                       // as opções de vestimenta, na aba Espelho embutida
    expect(walkStatus.textContent).toBe("");                                          // sem caminhada possível: abriu direto, sem "Indo ao espelho…"
    expect(screen.queryByText("Posições")).toBeNull();
    expect(screen.queryByRole("link", { name: /Meu Quarto/ })).toBeNull();            // já estamos no quarto
    expect(screen.getByRole("navigation", { name: "Espelho" })).toBeTruthy();
    // sem lista duplicada: nada de "Roupas em mãos" por lugar do corpo ao lado do painel; a peça trazida fica na célula da parte
    expect(screen.queryByRole("region", { name: "Roupas em mãos" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^(Vestir|Tirar|Trocar) · / })).toHaveLength(0);
    const top = within(screen.getByRole("group", { name: "Partes do look" })).getByRole("button", { name: /^Parte de cima:/ });
    expect(within(top).getByText("2 em mãos")).toBeTruthy();
    // navegação derivada: trilha "Meu Quarto › Espelho", título Espelho, sub-item no menu e a URL do espelho
    const trail = within(screen.getByRole("navigation", { name: "Você está em" }));
    expect(trail.getByRole("button", { name: "Meu Quarto" })).toBeTruthy();
    expect(trail.getByText("Espelho").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Espelho");
    expect(screen.getByTestId("nav-sub").textContent).toBe("/room>nav.mirror");
    expect(window.location.pathname + window.location.search).toBe("/room?espelho=1");
    // a folha da parte faz o que a lista fazia, do jeito do quarto (pedido mais recente vence, aviso do que mudou)
    fireEvent.click(top);
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    expect(sheet.getByRole("heading", { name: "Roupas em mãos" })).toBeTruthy();
    fireEvent.click(sheet.getByRole("button", { name: "Tirar Peça c da lista do espelho" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/mirror/rack/c")).toBe(true));
    await waitFor(() => expect(sheet.queryByRole("button", { name: /Peça c/ })).toBeNull());
    fireEvent.click(sheet.getByRole("button", { name: "Vestir Peça b em Parte de cima" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces")?.body).toEqual({ pieceId: "b" }));
    expect(await screen.findByText("Pronto: Peça b no espelho.")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    fireEvent.click(screen.getByRole("button", { name: /Voltar ao quarto/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(room3d.getAttribute("data-mode")).toBeNull();
    expect(screen.queryByTestId("mirror-controls")).toBeNull(); expect(screen.getByText("Posições")).toBeTruthy();
    expect(screen.getByTestId("nav-sub").textContent).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/room");
    // de novo pelo cabeçalho; a trilha "Meu Quarto" também volta ao quarto
    fireEvent.click(screen.getByRole("button", { name: "Ir ao espelho" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.getByTestId("mirror-controls")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Você está em" })).getByRole("button", { name: "Meu Quarto" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByTestId("mirror-controls")).toBeNull(); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Meu Quarto");
    // trocar de aba esconde o espelho e tira o sub-item
    fireEvent.click(screen.getByRole("button", { name: "Ir ao espelho" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.getByTestId("mirror-controls")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "2.5D" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.getByTestId("nav-sub").textContent).toBe("");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Meu Quarto");
  }, 20000);

  it("link de entrada /room?espelho=1 (o /mirror redireciona para cá): vai ao espelho — sem a cena 3D, a prova abre direto — e a URL fica", async () => {
    withWebgl();
    nav.search = new URLSearchParams("espelho=1");
    window.history.replaceState(null, "", "/room?espelho=1");
    const { calls } = loggedAs(ME, { "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": MIRROR, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [] });
    const { container } = renderApp(<><RoomPage /><NavSubProbe /></>);
    await waitFor(() => expect(screen.getByTestId("mirror-controls")).toBeTruthy());
    expect(container.querySelector(".room3d")!.getAttribute("data-mode")).toBe("mirror");
    expect(container.querySelector(".room3d-walk-status")!.textContent).toBe("");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Espelho");
    expect(screen.getByTestId("nav-sub").textContent).toBe("/room>nav.mirror");
    expect(router.replace).not.toHaveBeenCalled();                                    // sem parâmetros de uma vez só: a URL fica
    expect(window.location.pathname + window.location.search).toBe("/room?espelho=1");
    expect(calls.some((c) => c.method === "POST")).toBe(false);                       // só ir ao espelho: nada vai à lista
  });

  it("link de entrada /room?espelho=1&vestir=a&vista=2d: abre o espelho, leva a peça à lista e veste, mostra a prévia 2D e limpa a URL", async () => {
    withWebgl();
    nav.search = new URLSearchParams("espelho=1&vestir=a&vista=2d");
    const worn = { ...MIRROR, slots: { upper: { id: "a", name: "Peça a", imageUrl: "/media/a.png", category: "upper_piece", slot: "upper" }, lower: null } };
    const { calls } = loggedAs(ME, { "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": { ...MIRROR, slots: { upper: null, lower: null } }, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [],
      "POST /api/me/mirror/rack": { ...MIRROR, slots: { upper: null, lower: null }, rack: [{ id: "a", name: "Peça a", category: "upper_piece", slot: "upper", worn: false }] },
      "POST /api/me/mirror/pieces": worn });
    renderApp(<><RoomPage /><NavSubProbe /></>);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces")?.body).toEqual({ pieceId: "a" }));
    const rackAt = calls.findIndex((c) => c.method === "POST" && c.path === "/api/me/mirror/rack");
    expect(calls[rackAt].body).toEqual({ pieceId: "a" });
    expect(rackAt).toBeLessThan(calls.findIndex((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces"));
    expect(screen.getByTestId("mirror-controls")).toBeTruthy();
    expect(screen.getByTestId("mirror-preview-2d")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prévia 2D" }).getAttribute("aria-pressed")).toBe("true");
    expect(router.replace).toHaveBeenCalledWith("/room?espelho=1", { scroll: false });
    expect(screen.getByTestId("nav-sub").textContent).toBe("/room>nav.mirror");
  });

  it("sem WebGL: o espelho abre embutido na aba 2.5D (palco 2D + o mesmo painel) e a peça do módulo vai ao espelho sem sair do quarto", async () => {
    const { calls } = loggedAs(ME, { "GET /api/me/room": ROOM, "GET /api/me/room/list": LIST, "GET /api/me/mirror": MIRROR, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [],
      "POST /api/me/mirror/rack": MIRROR });
    renderApp(<><RoomPage /><NavSubProbe /></>);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    fireEvent.click(screen.getByRole("button", { name: /Monte o look de hoje/ }));
    const region = within(await screen.findByRole("region", { name: "Espelho" }));
    expect(region.getByTestId("mirror-controls")).toBeTruthy();
    expect(screen.getByTestId("nav-sub").textContent).toBe("/room>nav.mirror");
    fireEvent.click(region.getAllByRole("button", { name: "Voltar ao quarto" })[0]);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole("region", { name: "Espelho" })).toBeNull();
    // diálogo da porta: "Levar ao espelho" (antes um link para /mirror)
    fireEvent.click(screen.getByRole("button", { name: /Porta 1/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Levar ao espelho" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/rack")?.body).toEqual({ pieceId: "a" }));
    expect(await screen.findByRole("region", { name: "Espelho" })).toBeTruthy();
    expect(screen.queryAllByRole("link").some((a) => (a.getAttribute("href") ?? "").startsWith("/mirror"))).toBe(false);
  });

  it("quarto que não carrega mostra o erro com tentar de novo", async () => {
    loggedAs(ME, {});
    renderApp(<RoomPage />);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
