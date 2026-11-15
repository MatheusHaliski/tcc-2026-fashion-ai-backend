// @vitest-environment jsdom
/**
 * Caracterização da visão 3D do quarto (antes de sair do capítulo da Suíte de Vidro): sem WebGL cai no `fallback` sem
 * buscar o quarto; com WebGL busca GET /api/me/room uma vez e entrega os dados, os módulos acesos e a luz à cena;
 * à noite o período vira "night"; erro de carga também cai no `fallback`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";
import { RoomScenario } from "@/components/flair/games/room-scenario";

const webgl = vi.hoisted(() => ({ value: true as boolean | null }));
const scene = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("next/dynamic", () => ({ default: () => function RoomSceneStub(props: Record<string, unknown>) { scene.props = props; return <div data-testid="room-scene" />; } }));
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), useWebGL: () => webgl.value }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); scene.props = null; webgl.value = true; });

const ROOM = { modules: [{ id: "door:1", slotType: "DOOR", label: "Porta 1" }], ambient: { period: "day", reduceMotion: false }, level: "STUDIO" };
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "fora" }), { status: 500, headers: { "content-type": "application/json" } });

describe("visão 3D do quarto", () => {
  it("sem WebGL mostra o fallback e não busca o quarto", async () => {
    webgl.value = false;
    const { calls } = loggedAs(undefined, { "GET /api/me/room": ROOM });
    renderApp(<RoomScenario lit={new Set()} fallback={<p>cena 2D</p>} />);
    expect(await screen.findByText("cena 2D")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/me/room")).toBe(false);
    expect(screen.queryByTestId("room-scene")).toBeNull();
  });

  it("com WebGL busca o quarto e entrega dados, módulos acesos e luz à cena", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/room": ROOM });
    renderApp(<RoomScenario lit={new Set(["door:1"])} fallback={<p>cena 2D</p>} />);
    expect(await screen.findByTestId("room-scene")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/me/room")).toHaveLength(1);
    expect(scene.props?.data).toEqual(ROOM);
    expect([...(scene.props?.lit as Set<string>)]).toEqual(["door:1"]);
    expect(scene.props?.focusModule).toBeNull();
    expect(screen.queryByText("cena 2D")).toBeNull();
  });

  it("à noite o período vira night e a luz acende", async () => {
    loggedAs(undefined, { "GET /api/me/room": ROOM });
    renderApp(<RoomScenario lit={new Set()} night fallback={<p>cena 2D</p>} />);
    await screen.findByTestId("room-scene");
    expect((scene.props?.data as typeof ROOM).ambient.period).toBe("night");
    expect(scene.props?.lightOn).toBe(true);
  });

  it("erro ao buscar o quarto cai no fallback", async () => {
    loggedAs(undefined, { "GET /api/me/room": fail });
    renderApp(<RoomScenario lit={new Set()} fallback={<p>cena 2D</p>} />);
    expect(await screen.findByText("cena 2D")).toBeTruthy();
    expect(screen.queryByTestId("room-scene")).toBeNull();
  });
});
