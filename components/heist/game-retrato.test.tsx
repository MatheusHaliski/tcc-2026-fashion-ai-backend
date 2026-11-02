// @vitest-environment jsdom
/*
 * Retrato (caracterização) da composição do jogo (HeistGame): o DOM na tela de briefing e depois de "Começar" (HUD,
 * dica de clique, classes do contêiner, propriedades passadas à cena, à câmera e ao canvas), a alça de laboratório
 * `window.__heist` e o começo num checkpoint (`startAt`). O react-three/fiber e a cena 3D são falsos; o relógio é fixo.
 * Gravado no código original; a divisão de game.tsx tem de manter o retrato idêntico.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import * as THREE from "three";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) =>
    <div data-testid="canvas" data-props={JSON.stringify(rest, (_k, v) => (typeof v === "function" ? "[fn]" : v))}>{children}</div>,
  useFrame: () => {},
  useThree: () => ({ camera: new THREE.PerspectiveCamera() }),
}));
vi.mock("./scene-root", () => ({
  SceneRoot: (p: { onProgress: (n: number) => void; quality: string; debug: boolean; letterbox: boolean; pieces: { id: string }[] }) => {
    useEffect(() => { p.onProgress(1); }, [p]);
    return <div data-testid="scene" data-quality={p.quality} data-debug={String(p.debug)} data-letterbox={String(p.letterbox)} data-pieces={p.pieces.map((x) => x.id).join(",")} />;
  },
}));
vi.mock("./camera", () => ({ HeistCamera: (p: { shot: unknown; reducedMotion: boolean }) => <div data-testid="camera" data-shot={JSON.stringify(p.shot)} data-reduced={String(p.reducedMotion)} /> }));
vi.mock("./fx", () => ({ HeistFx: () => <div data-testid="fx" /> }));

import { HeistGame, type HeistGameProps } from "./game";
import { I18nProvider } from "@/lib/i18n/i18n";
import type { SimState } from "@/lib/heist/types";

type Handle = { s: SimState; ctx: unknown; step: unknown; interact: unknown; loading: () => number; takeDiamond: () => void; hurt: (n: number, by: string) => void };
const handle = () => (window as unknown as { __heist?: Handle }).__heist;
const Game = (p: HeistGameProps) => <I18nProvider initial="pt-BR"><HeistGame {...p} /></I18nProvider>;
const start = () => { fireEvent.click(screen.getByRole("button", { name: "Começar o golpe" })); };
const round = (v: unknown): unknown => typeof v === "number" ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;

beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});          // props 3D em elementos desconhecidos do DOM
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("retrato do jogo (HeistGame)", () => {
  it("briefing: DOM da tela, do canvas e da cena; depois de Começar: HUD, dica de clique e classes", () => {
    const { container } = render(<Game cards={[]} />);
    const brief = container.innerHTML;
    act(start);
    expect({ brief, play: container.innerHTML, stage: container.firstElementChild?.getAttribute("data-stage") }).toMatchSnapshot();
  });
  it("qualidade baixa e depuração: classes do contêiner e propriedades do canvas", () => {
    const { container } = render(<Game cards={[]} quality="low" debug />);
    const root = container.firstElementChild!;
    expect({ className: root.className, canvas: screen.getByTestId("canvas").getAttribute("data-props"), scene: screen.getByTestId("scene").outerHTML }).toMatchSnapshot();
  });
  it("alça de laboratório (window.__heist), enquadramento fixo e começo no checkpoint do cofre", () => {
    render(<Game cards={[]} labHandle labShot={{ pos: [1, 2, 3], target: [0, 1, 0], fov: 40 }} startAt="cofre" />);
    const before = handle()!;
    expect(Object.keys(before).sort()).toEqual(["ctx", "hurt", "interact", "loading", "s", "step", "takeDiamond"]);
    expect(before.loading()).toBe(1);
    const atMount = round({ pos: before.s.player.pos, room: before.s.player.lastRoom, wristband: before.s.player.inv.wristband, phase: before.s.phase, beat: !!before.s.beat });
    act(start);
    const h = handle()!;
    const afterStart = round({ pos: h.s.player.pos, room: h.s.player.lastRoom, wristband: h.s.player.inv.wristband, phase: h.s.phase, beat: !!h.s.beat, hp: h.s.player.hp, difficulty: h.s.difficulty });
    h.hurt(7, "nada");
    act(() => h.takeDiamond());
    expect({ atMount, afterStart, afterHurt: round({ hp: h.s.player.hp, phase: h.s.phase, diamond: h.s.player.inv.diamond }), shot: screen.getByTestId("camera").getAttribute("data-shot") }).toMatchSnapshot();
  });
  it("sem a alça: nada em window.__heist; ao desmontar, a alça some", () => {
    const { unmount } = render(<Game cards={[]} labHandle />);
    expect(handle()).toBeTruthy();
    unmount();
    expect(handle()).toBeUndefined();
    render(<Game cards={[]} />);
    expect(handle()).toBeUndefined();
  });
});
