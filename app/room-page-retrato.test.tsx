// @vitest-environment jsdom
/*
 * Retrato (caracterização) da página Meu Quarto (app/(site)/(app)/room/page.tsx): o DOM inteiro (ids do React
 * normalizados pela ordem em que aparecem) e as props que a página passa à cena 3D, com e sem WebGL, nos estados
 * principais — quarto, cada diálogo (organizar, Vista-me, Copilot, etiqueta, chaves, gaveta vazia, módulo), modo foto,
 * prova no espelho e o espelho plano sem WebGL — e as chamadas à API de cada ação. Gravado no código original; a
 * divisão da página em hooks e seções tem de manter o retrato idêntico.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";

/** a cena 3D não roda no jsdom: o substituto guarda as props da última renderização e as mostra resumidas no DOM */
const scene = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("@/components/room3d/room-scene", () => ({
  default: (p: Record<string, unknown>) => { scene.props = p; return <div data-testid="room-scene" />; },
}));
vi.mock("@/components/three/avatar-still", () => ({ default: (p: { hidden?: boolean; pieces?: unknown[]; background?: string }) => <i data-still={`${!!p.hidden}|${p.pieces?.length ?? 0}|${p.background}`} /> }));
// next/dynamic carrega de verdade (o setup comum o troca por um nulo): o módulo (já substituído acima) entra depois do efeito
vi.mock("next/dynamic", async () => {
  const { createElement, useEffect, useState } = await import("react");
  return { default: (load: () => Promise<{ default: (p: object) => unknown }>) => function Dynamic(p: object) {
    const [C, setC] = useState<((p: object) => unknown) | null>(null);
    useEffect(() => { void load().then((m) => setC(() => m.default)); }, []);
    return C ? createElement(C as never, p) : null;
  } };
});
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), loadTexture: () => Promise.resolve(null) }));
import RoomPage from "@/app/(site)/(app)/room/page";

beforeEach(() => { router.replace.mockClear(); router.push.mockClear(); window.history.replaceState(null, "", "/room"); localStorage.clear(); scene.props = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); });
const withWebgl = () => {
  const real = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    return kind === "webgl" || kind === "webgl2" ? ({} as unknown as RenderingContext) : (real as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
  });
};

const P = (id: string, moduleId: string, category = "upper_piece") => ({ id, name: `Peça ${id}`, category, subcategory: "t_shirt", colorHex: "#336699", imageUrl: `/media/${id}.png`, moduleId, addressLabel: moduleId, wearCount: 3, states: [] });
const ROOM = {
  owner: true, level: "LOFT", levelInfo: { unlocks: "extensão", aesthetic: "industrial" },
  modules: [
    { id: "door:1", slotType: "DOOR", label: "Porta 1", capacity: 10, sku: "PORTA", finish: { texture: "carvalho" }, hangers: [{ k: 1, address: "door:1:h1", pieceId: "a" }], pieces: [P("a", "door:1")] },
    { id: "drawer:1", slotType: "DRAWER", label: "Gaveta 1", capacity: 6, slots: [{ k: 1, address: "drawer:1:s1", pieceId: "b" }], pieces: [P("b", "drawer:1", "lower_piece")] },
    { id: "drawer:2", slotType: "DRAWER", label: "Gaveta 2", capacity: 6, empty: true, pieces: [] },
    { id: "season", slotType: "SEASON", label: "Baú", capacity: 8, pieces: [] },
  ],
  drawerLabels: { "1": "Camisetas" }, pieces: { a: P("a", "door:1"), b: P("b", "drawer:1", "lower_piece"), c: P("c", "basket", "accessory_piece") }, basket: [P("c", "basket")], chair: [], saleRack: { name: "Bazar", pieces: [] },
  capacity: { pieces: 3, max: 30, positions: 12 }, unboxing: [{ inventoryId: "i1", sku: "LAMP", name: "Luminária", slotType: "DOOR" }], keys: [{ id: "k1", username: "bia" }],
  light: { kelvin: 3500, guided: false, on: false, intensity: 0.5 }, decorations: [], closetLights: { score: 60, band: "ok", milestones: [{ at: 25, label: "25", lit: true }], lit: 1 },
  celebrations: [{ code: "PRIMEIRA_LUZ" }], ambient: { period: "afternoon" },
};
const MIRROR = { slots: { upper: { id: "a", name: "Peça a", imageUrl: "/media/a.png", moduleId: "door:1", addressLabel: "Porta 1" }, lower: null }, complete: true, postIt: "Hoje: casual",
  sequence: [{ pieceId: "a", name: "Peça a", moduleId: "door:1", legend: "Porta 1" }], message: "Bom dia", rack: [] };
const TAG = { id: "a", name: "Peça a", composition: "COTTON", care: null, origin: "GARIMPADA", garimpo: true, wearCount: 31, thirtyWears: true, costPerUse: 2.5, location: { address: "door:1", label: "Porta 1" }, diary: [{ date: "2026-10-01", occasion: "trabalho" }] };
const ROUTES = {
  "GET /api/me/room": ROOM, "GET /api/me/mirror": MIRROR, "GET /api/me/avatar3d": { exists: false }, "GET /api/tipos-look": [], "GET /api/pieces/a/tag": TAG, "GET /api/points/shop": [],
  "GET /api/me/room/organization/preview": { moves: [{ pieceId: "a", from: "door:1", to: "drawer:2", why: "categoria" }], labels: { "2": "Jeans" }, message: "1 peça" },
  "POST /api/me/mirror/vista-me": { ...MIRROR, message: "Sugestão" }, "POST /api/copilot/messages": { text: "Na porta 1", roomHighlight: { pieceId: "a", moduleId: "door:1" } },
  "PUT /api/me/room/light": { on: true }, "POST /api/me/mirror/use": { message: "Registrado" },
};

/** DOM com os ids gerados pelo React trocados por #1, #2… (na ordem em que aparecem) */
function dom(container: HTMLElement) {
  const ids = new Map<string, string>();
  return container.innerHTML.replace(/«[^»]*»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, (m) => { if (!ids.has(m)) ids.set(m, `#${ids.size + 1}`); return ids.get(m)!; });
}
/** As props da cena: funções como "fn", conjuntos como listas, objetos rasos. */
function sceneProps() {
  const out = (v: unknown, d = 0): unknown => typeof v === "function" ? "fn" : v instanceof Set ? [...v].sort() : Array.isArray(v) ? v.map((x) => out(x, d + 1))
    : v && typeof v === "object" ? (d > 2 ? "obj" : Object.fromEntries(Object.entries(v).filter(([k]) => k !== "engine" && k !== "session" && k !== "poseRef" && k !== "data").map(([k, x]) => [k, out(x, d + 1)]))) : v;
  return out(scene.props);
}
const wait = (ms = 60) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** fecha todos os diálogos abertos (inclusive o tutorial de comandos, que abre sozinho na primeira visita) */
const closeAll = async () => { for (const b of screen.queryAllByRole("button", { name: "Fechar" })) fireEvent.click(b); await wait(); };
async function open(webgl: boolean) {
  if (webgl) withWebgl();
  const api = loggedAs(ME, ROUTES);
  const r = renderApp(<RoomPage />);
  await wait(80);
  await closeAll();
  return { ...r, calls: api.calls };
}
const callsOf = (calls: { method: string; path: string; body?: unknown }[]) => calls.filter((c) => !c.path.startsWith("/bff") && c.path !== "/api/me").map((c) => `${c.method} ${c.path} ${JSON.stringify(c.body ?? null)}`);
const click = async (name: string | RegExp) => { fireEvent.click(screen.getAllByRole("button", { name })[0]); await wait(); };

describe("retrato da página Meu Quarto", () => {
  it("com WebGL: quarto, props da cena e diálogos da barra (Organizar, Vista-me, Copilot)", async () => {
    const { container, calls } = await open(true);
    expect(dom(container)).toMatchSnapshot("quarto");
    expect(sceneProps()).toMatchSnapshot("props da cena");
    await click("Organizar"); expect(dom(document.body)).toMatchSnapshot("organizar");
    await click("Cancelar");
    await click(/Vista-me/); expect(dom(document.body)).toMatchSnapshot("vista-me aberto");
    await closeAll();
    await click(/Busto/); expect(dom(document.body)).toMatchSnapshot("copilot aberto");
    await closeAll();
    await click("Modo foto"); expect(dom(container)).toMatchSnapshot("modo foto");
    expect(sceneProps()).toMatchSnapshot("props no modo foto");
    await click("Espelho"); await click("P&B"); fireEvent.click(screen.getByRole("switch", { name: "Profundidade de campo" })); await wait(); expect(dom(container)).toMatchSnapshot("modo foto, espelho e P&B");
    await click("Sair do modo foto"); expect(sceneProps()).toMatchSnapshot("props depois do modo foto");
    expect(callsOf(calls)).toMatchSnapshot("chamadas");
  });

  it("com WebGL: ações vindas da cena (etiqueta, chaves, gaveta vazia, abrir módulo, luz, Vista-me e o look)", async () => {
    const { calls } = await open(true);
    const p = scene.props as Record<string, (...a: unknown[]) => unknown>;
    await act(async () => { await p.onPick("a"); }); await wait(); expect(dom(document.body)).toMatchSnapshot("etiqueta");
    await closeAll();
    await act(async () => { p.onKeys(); }); await wait(); expect(dom(document.body)).toMatchSnapshot("chaves");
    await closeAll();
    await act(async () => { (scene.props as Record<string, (...a: unknown[]) => unknown>).onAddToDrawer("drawer:2"); }); await wait(); expect(dom(document.body)).toMatchSnapshot("gaveta vazia");
    await closeAll();
    await act(async () => { (scene.props as Record<string, (...a: unknown[]) => unknown>).onToggle("door:1"); }); await wait();
    expect(sceneProps()).toMatchSnapshot("props depois de abrir a porta 1");
    await act(async () => { await (scene.props as Record<string, (...a: unknown[]) => unknown>).onToggleLight(); }); await wait();
    const mirror = (scene.props as { mirror: Record<string, () => unknown> }).mirror;
    await act(async () => { await mirror.onAnother(); }); await wait();
    await act(async () => { await (scene.props as { mirror: Record<string, () => unknown> }).mirror.onUse(); }); await wait();
    expect(sceneProps()).toMatchSnapshot("props depois do Vista-me e do look");
    expect(callsOf(calls)).toMatchSnapshot("chamadas");
  });

  it("com WebGL: Ir ao espelho abre a prova no quarto e Voltar ao quarto devolve", async () => {
    const { container } = await open(true);
    await click("Ir ao espelho");
    expect(dom(container)).toMatchSnapshot("prova");
    expect(sceneProps()).toMatchSnapshot("props na prova");
    expect(window.location.pathname + window.location.search).toMatchSnapshot("url na prova");
    fireEvent.click(screen.getAllByRole("button", { name: /Voltar ao quarto/ })[0]); await wait();
    expect(dom(container)).toMatchSnapshot("de volta");
  });

  it("sem WebGL: aviso, Configurações, espelho plano e o diálogo do módulo pelo link da peça", async () => {
    nav.search = new URLSearchParams("piece=b");
    const { container } = await open(false);
    expect(dom(document.body)).toMatchSnapshot("sem webgl com o módulo aberto");
    await closeAll();
    await click("Ir ao espelho");
    expect(dom(container)).toMatchSnapshot("espelho plano");
    expect(scene.props).toBeNull();
  });
});
