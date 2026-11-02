// @vitest-environment jsdom
/*
 * Retrato (caracterização) do laboratório das pessoas: para cada cena (`preset`), o DOM que a cena monta (sala, apoio,
 * câmera, controles de órbita, multidão) e o SceneView de exemplo nos instantes 0 s, 0,7 s e 2,9 s (posições, gestos,
 * objetos na mão, olhar, arredondados; os figurantes viram contagem + SHA-256 e os dois primeiros ficam legíveis).
 * O react-three/fiber é falso (os quadros rodam à mão), a multidão é um stub.
 * Gravado no código original; a divisão de heist-gente-scene.tsx tem de manter o retrato idêntico.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import * as THREE from "three";

type Frame = (st: { clock: { elapsedTime: number } }, dt: number) => void;
const fiber = vi.hoisted(() => ({ frames: [] as Frame[], three: {} as Record<string, unknown> }));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => {
    fiber.frames.length = 0;                                          // só os quadros registrados nesta renderização
    return <div data-testid="canvas" data-props={JSON.stringify(rest, (_k, v) => (typeof v === "function" ? "[fn]" : v))}>{children}</div>;
  },
  useFrame: (cb: Frame) => { fiber.frames.push(cb); },
  useThree: () => fiber.three,
}));
vi.mock("@react-three/drei", () => ({ OrbitControls: (p: Record<string, unknown>) => <div data-testid="orbit" data-props={JSON.stringify(p)} /> }));
const people = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("@/components/heist/people/people", () => ({
  HeistPeople: (p: { view: { current: unknown }; playerPieces: { id: string }[]; quality: string }) => {
    people.props = p;
    return <div data-testid="people" data-quality={p.quality} data-pieces={p.playerPieces.map((x) => x.id).join(",")} />;
  },
}));

import HeistGenteScene, { type Preset } from "./heist-gente-scene";
import type { SceneView } from "@/lib/heist/view";

const PRESETS: Preset[] = ["multidao", "close", "anims", "troca", "caida", "tiro", "agachada", "jogadora", "pessoa", "pista", "dj", "comer", "salao60"];
const round = (v: unknown): unknown => typeof v === "number" ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
const view = () => (people.props!.view as { current: SceneView }).current;
const sample = (t: number) => {
  act(() => { for (const f of fiber.frames) f({ clock: { elapsedTime: t } }, 1 / 60); });
  const actors = round(view().actors) as unknown[];
  return { time: view().time, player: round(view().player), actors: { count: actors.length, sha: createHash("sha256").update(JSON.stringify(actors)).digest("hex"), first: actors.slice(0, 2) } };
};

beforeEach(() => {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(1.5, 1.7, 4);
  fiber.three = { camera, scene: new THREE.Scene(), gl: { info: { render: { calls: 12, triangles: 345 }, memory: { geometries: 6, textures: 7 }, programs: [1, 2] } } };
  vi.spyOn(THREE.PMREMGenerator.prototype, "fromScene").mockReturnValue({ texture: { dispose() {} } } as never);
  vi.spyOn(THREE.PMREMGenerator.prototype, "dispose").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});          // props 3D em elementos desconhecidos do DOM
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("retrato do laboratório das pessoas", () => {
  for (const preset of PRESETS) {
    it(`cena ${preset}: DOM e SceneView em 0 s, 0,7 s e 2,9 s`, () => {
      const { container } = render(<HeistGenteScene preset={preset} quality={preset === "salao60" ? "low" : "high"} look="guard" seed={5} anim="eat" />);
      const dom0 = container.innerHTML;
      const t0 = sample(0), t1 = sample(0.7), t2 = sample(2.9);
      const info = (window as unknown as { __heistGenteInfo?: unknown }).__heistGenteInfo;
      const scene = fiber.three.scene as THREE.Scene;
      expect({ dom0, t0, t1, t2, info, env: { intensity: scene.environmentIntensity, background: (scene.background as THREE.Color)?.getHexString?.() }, domEnd: container.innerHTML }).toMatchSnapshot();
    });
  }
  it("`at` fixa o instante da cena e `pessoa` usa look/seed/anim", () => {
    render(<HeistGenteScene preset="pessoa" quality="high" at={1.3} look="dj" seed={9} anim="dj" />);
    expect({ t0: sample(0), t5: sample(5) }).toMatchSnapshot();
  });
});
