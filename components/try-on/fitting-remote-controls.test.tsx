// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/i18n";
import type { FittingCameraApi, OrbitLimitState } from "@/lib/scene3d/orbit-steps";
import type { FittingWalkApi } from "@/lib/scene3d/fitting-walk";
import { FittingRemoteControls } from "./fitting-remote-controls";

function ui(node: ReactNode) { return render(<I18nProvider initial="pt-BR">{node}</I18nProvider>); }
function fakeApis() {
  let listener: ((state: OrbitLimitState) => void) | null = null;
  let placeListener: ((place: "mirror" | "center" | "free") => void) | null = null;
  const camera = { step: vi.fn(), subscribe: vi.fn((l: (state: OrbitLimitState) => void) => { listener = l; l({ atMin: false, atMax: false }); return vi.fn(); }) } satisfies FittingCameraApi;
  const walk = { to: vi.fn(), subscribe: vi.fn((l: (place: "mirror" | "center" | "free") => void) => { placeListener = l; l("center"); return vi.fn(); }) } satisfies FittingWalkApi;
  return { camera, walk, setPlace: (place: "mirror" | "center" | "free") => act(() => placeListener?.(place)), limits: (state: OrbitLimitState) => act(() => listener?.(state)) };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("controle remoto do Provador 3D", () => {
  it("usa a mesma disposição visual do controle do Meu Quarto e mapeia as ações", () => {
    const { camera, walk } = fakeApis();
    ui(<FittingRemoteControls api={camera} walk={walk} />);
    expect(screen.getByRole("group", { name: "Girar e aproximar a cena" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Girar para a esquerda" }));
    fireEvent.click(screen.getByRole("button", { name: "Aproximar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar à frente" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ir ao espelho" })[0]);
    expect(camera.step).toHaveBeenCalledWith("left");
    expect(camera.step).toHaveBeenCalledWith("in");
    expect(camera.step).toHaveBeenCalledWith("front");
    expect(walk.to).toHaveBeenCalledWith("mirror");
  });

  it("mantém o controle de foco e aceita o analógico por teclado", () => {
    const { camera, walk } = fakeApis();
    ui(<FittingRemoteControls api={camera} walk={walk} />);
    const sticks = [...document.querySelectorAll<HTMLButtonElement>(".fitting-remote .room-pad-stick")];
    fireEvent.keyDown(sticks[1], { key: "ArrowRight" });
    fireEvent.keyUp(sticks[1], { key: "ArrowRight" });
    expect(camera.step).toHaveBeenCalledWith("right");
  });
});
