// @vitest-environment jsdom
/*
 * Retrato (caracterização) da multidão (HeistPeople): o DOM que o componente monta (multidão, lanternas, grupo dos
 * modelos escondidos, corpo da jogadora), o plano de carga depois de alguns quadros (que modelos montam primeiro: os de
 * quem está mais perto, dois por vez), as propriedades passadas a cada HumanAvatar e o progresso informado. O
 * react-three/fiber é falso (os quadros rodam à mão) e o HumanAvatar é um stub que nunca fica pronto.
 * Gravado no código original; a divisão de people.tsx tem de manter o retrato idêntico.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import * as THREE from "three";

type Frame = (st: { camera: THREE.Camera }, dt: number) => void;
const fiber = vi.hoisted(() => ({ frames: [] as Frame[] }));
vi.mock("@react-three/fiber", () => ({ useFrame: (cb: Frame) => { fiber.frames.push(cb); }, useThree: () => ({}) }));
vi.mock("@/components/three/human-avatar", () => ({
  HumanAvatar: (p: Record<string, unknown>) => {
    const { atlas, onReady, pieces, ...rest } = p;
    const props = { ...rest, atlas: atlas instanceof HTMLCanvasElement ? `canvas ${atlas.width}` : String(atlas), onReady: typeof onReady, pieces: (pieces as { id: string }[]).map((x) => x.id) };
    return <div data-testid="avatar" data-props={JSON.stringify(props)} />;
  },
}));

import { HeistPeople } from "./people";
import { emptyView, type ActorView, type SceneView } from "@/lib/heist/view";
import { PLAYER_ARRIVAL } from "@/lib/heist/outfits";
import type { LookId } from "@/lib/heist/types";

const actor = (id: string, look: LookId, seed: number, x: number, z: number, extra: Partial<ActorView> = {}): ActorView =>
  ({ ...emptyView().player, id, kind: look === "guard" ? "guard" : "civ", look, seed, x, z, room: "salao", ...extra });
const frame = (camera: THREE.Camera, dt = 1 / 60) => { act(() => { for (const f of [...new Set(fiber.frames)]) f({ camera }, dt); }); };
const people = () => (window as unknown as { __heistPeople?: unknown }).__heistPeople;

beforeEach(() => { fiber.frames.length = 0; vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("retrato da multidão (HeistPeople)", () => {
  for (const quality of ["high", "low"] as const) {
    it(`qualidade ${quality}: DOM, plano de carga (modelos dos mais perto primeiro, dois por vez) e progresso`, () => {
      const view = { current: emptyView() } as React.MutableRefObject<SceneView>;
      view.current.actors = [
        actor("g1", "guard", 5, 14, 2), actor("w1", "waiter", 11, 1.5, 0.5, { hold: "tray", anim: "serve" }), actor("f1", "guestF", 2, -2, 3),
        actor("m1", "guestM", 3, 4, -9), actor("dj", "dj", 3, 0, -4, { anim: "dj", hold: "headphones" }), actor("c1", "chef", 21, 22, 20), actor("f2", "guestF", 9, 0.3, 1.2, { visible: false }),
      ];
      view.current.player.x = 0; view.current.player.z = 0;
      const progress = vi.fn();
      const { container } = render(<HeistPeople view={view} playerPieces={PLAYER_ARRIVAL} quality={quality} onProgress={progress} />);
      const dom0 = container.innerHTML;
      const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200); camera.position.set(0, 1.6, 6); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
      frame(camera); frame(camera); frame(camera);
      const avatars = [...container.querySelectorAll("[data-testid=avatar]")].map((el) => JSON.parse(el.getAttribute("data-props")!));
      expect({ dom0, domAfter: container.innerHTML, avatars, people: people(), progress: progress.mock.calls }).toMatchSnapshot();
    });
  }
});
