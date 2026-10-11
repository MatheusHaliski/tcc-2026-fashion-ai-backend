// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/i18n";
import type { Avatar3dRef } from "@/components/three/common";
import type { FittingCameraApi, OrbitLimitState } from "@/lib/scene3d/orbit-steps";
import { resolveEnvironment } from "@/lib/tryon/fitting-room";
import { FittingOrbitButtons } from "./fitting-orbit-buttons";
import { FittingStage } from "./fitting-stage";

// a cena 3D vira um stub que entrega os passos de câmera, como a cena de verdade faz ao montar o Canvas
const scene = vi.hoisted(() => ({ api: null as FittingCameraApi | null }));
vi.mock("next/dynamic", async () => {
  const { useEffect } = await import("react");
  return { default: () => function FittingSceneStub({ onCamera }: { onCamera?: (api: FittingCameraApi | null) => void }) {
    useEffect(() => { onCamera?.(scene.api); return () => onCamera?.(null); }, [onCamera]);
    return <div data-testid="fitting-scene" />;
  } };
});

afterEach(() => { cleanup(); scene.api = null; });

function fakeApi() {
  let listener: ((s: OrbitLimitState) => void) | null = null;
  const unsubscribe = vi.fn();
  const api = {
    step: vi.fn(),
    subscribe: vi.fn((l: (s: OrbitLimitState) => void) => { listener = l; l({ atMin: false, atMax: false }); return unsubscribe; }),
  } satisfies FittingCameraApi;
  return { api, unsubscribe, limits: (s: OrbitLimitState) => act(() => listener?.(s)) };
}
const ui = (node: ReactNode) => render(<I18nProvider initial="pt-BR">{node}</I18nProvider>);

describe("botões de girar o palco 3D do provador (acessibilidade)", () => {
  it("cada botão é um <button> com nome acessível e chama o passo de câmera certo", () => {
    const { api } = fakeApi();
    ui(<FittingOrbitButtons api={api} />);
    const group = screen.getByRole("group", { name: "Girar e aproximar a cena" });
    const names: [string, string][] = [["Girar para a esquerda", "left"], ["Girar para a direita", "right"], ["Aproximar", "in"], ["Afastar", "out"], ["Voltar à frente", "front"]];
    for (const [name, action] of names) {
      const button = within(group).getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON"); expect(button.getAttribute("type")).toBe("button");
      expect(button.getAttribute("title")).toBe(name);
      fireEvent.click(button);
      expect(api.step).toHaveBeenLastCalledWith(action);
    }
    expect(api.step).toHaveBeenCalledTimes(5);
    // alcançáveis pelo teclado (sem tabindex negativo)
    const left = screen.getByRole("button", { name: "Girar para a esquerda" }); left.focus();
    expect(document.activeElement).toBe(left);
  });

  it("no limite de distância, Aproximar/Afastar ficam indisponíveis sem perder o foco", () => {
    const { api, unsubscribe, limits } = fakeApi();
    const view = ui(<FittingOrbitButtons api={api} />);
    const zoomIn = screen.getByRole("button", { name: "Aproximar" }), zoomOut = screen.getByRole("button", { name: "Afastar" });
    zoomIn.focus();
    limits({ atMin: true, atMax: false });
    expect(zoomIn.getAttribute("aria-disabled")).toBe("true");
    expect((zoomIn as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(zoomIn);
    fireEvent.click(zoomIn);
    expect(api.step).not.toHaveBeenCalled();
    expect(zoomOut.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(zoomOut);
    expect(api.step).toHaveBeenCalledWith("out");
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("o palco mostra os botões quando a cena entrega os passos de câmera (e só com o avatar)", () => {
    const { api } = fakeApi(); scene.api = api;
    const props = { mannequin: { sex: "FEMININO" as const, build: "MEDIUM", skinTone: "media" }, pieces: [], environment: resolveEnvironment([]), scene: null, light: "store" as const, view: "front" as const, sex: "FEMININO" as const, onCanvas: vi.fn() };
    const withAvatar = ui(<FittingStage {...props} avatar={{ model: {} } as unknown as Avatar3dRef}><span /></FittingStage>);
    const stage = screen.getByRole("region", { name: /Provador da marca/ });
    expect(within(stage).getByTestId("fitting-scene")).toBeTruthy();
    fireEvent.click(within(stage).getByRole("button", { name: "Girar para a direita" }));
    expect(api.step).toHaveBeenCalledWith("right");
    withAvatar.unmount();
    ui(<FittingStage {...props} avatar={null}><span /></FittingStage>);
    expect(screen.queryByRole("button", { name: "Girar para a direita" })).toBeNull();
  });
});
