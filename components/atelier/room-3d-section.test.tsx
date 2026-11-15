// @vitest-environment jsdom
/**
 * Atelier › Quarto: o quarto em 3D ao lado da instalação. "Ver o quarto em 3D" abre e fecha a visão; um objeto instalado
 * tem "Ver … em 3D" com a câmera no módulo dele; instalar abre a visão já no módulo escolhido; o link
 * /atelier?tab=room&quarto=3d&modulo=… (para onde /room leva) chega com a visão aberta. Sem WebGL, um aviso em texto.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { AtelierRoomPanel } from "@/components/atelier/room-panel";
import { room3dHref } from "@/lib/atelier/room-3d";

const webgl = vi.hoisted(() => ({ value: true as boolean | null }));
const scene = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("next/dynamic", () => ({ default: () => function RoomSceneStub(props: Record<string, unknown>) { scene.props = props; return <div data-testid="room-scene" />; } }));
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), useWebGL: () => webgl.value }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); scene.props = null; webgl.value = true; nav.search = new URLSearchParams(); });

const ROOM = { modules: [{ id: "light", slotType: "LIGHT", label: "Luz" }], ambient: { period: "day" }, level: "STUDIO" };
const boxed = { sku: "MIRROR", name: "Espelho FAI", compatibleModules: ["light"], inventory: [{ inventoryId: "owned1" }] };
const installed = { sku: "LAMP", name: "Luminária", compatibleModules: ["light"], inventory: [{ inventoryId: "owned2", appliedModule: "light" }] };

describe("quarto em 3D no Atelier", () => {
  it("o endereço leva ao Atelier › Quarto, com o módulo quando há", () => {
    expect(room3dHref()).toBe("/atelier?tab=room&quarto=3d");
    expect(room3dHref("door:1")).toBe("/atelier?tab=room&quarto=3d&modulo=door%3A1");
  });

  it("abre e fecha pelo botão do cabeçalho, sem foco em módulo", async () => {
    loggedAs(undefined, { "GET /api/points/shop": [boxed], "GET /api/me/room": ROOM });
    renderApp(<AtelierRoomPanel />);
    const open = screen.getByRole("button", { name: "Ver o quarto em 3D" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);
    const region = await screen.findByRole("region", { name: "Seu quarto em 3D" });
    expect(await within(region).findByTestId("room-scene")).toBeTruthy();
    expect(scene.props?.focusModule).toBeNull();
    expect(open.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(within(region).getByRole("button", { name: "Fechar o quarto 3D" }));
    expect(screen.queryByRole("region", { name: "Seu quarto em 3D" })).toBeNull();
  });

  it("um objeto instalado mostra o módulo dele em 3D", async () => {
    loggedAs(undefined, { "GET /api/points/shop": [installed], "GET /api/me/room": ROOM });
    renderApp(<AtelierRoomPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver Luminária em 3D" }));
    await screen.findByTestId("room-scene");
    expect(scene.props?.focusModule).toBe("light");
    expect([...(scene.props?.lit as Set<string>)]).toEqual(["light"]);
  });

  it("instalar abre a visão no módulo escolhido", async () => {
    loggedAs(undefined, { "GET /api/points/shop": [boxed], "GET /api/me/room": ROOM, "POST /api/me/room-inventory/owned1/apply": { applied: true } });
    renderApp(<AtelierRoomPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Instalar no quarto" }));
    const dialog = await screen.findByRole("dialog", { name: "Instalar Espelho FAI" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Instalar no quarto" }));
    await screen.findByTestId("room-scene");
    expect(scene.props?.focusModule).toBe("light");
  });

  it("chega aberto pelo link e, sem WebGL, avisa em texto", async () => {
    webgl.value = false;
    nav.search = new URLSearchParams("tab=room&quarto=3d&modulo=light");
    const { calls } = loggedAs(undefined, { "GET /api/points/shop": [], "GET /api/me/room": ROOM });
    renderApp(<AtelierRoomPanel />);
    const region = await screen.findByRole("region", { name: "Seu quarto em 3D" });
    await waitFor(() => expect(within(region).getByText(/Este navegador não mostra o quarto em 3D/)).toBeTruthy());
    expect(region.textContent).toContain("Em destaque:");
    expect(calls.some((c) => c.path === "/api/me/room")).toBe(false);
  });
});
