// @vitest-environment jsdom
/**
 * Busto do Avatar 3D (RF40): a cabeça medida (forma do rosto, cabelo, ajustes finos) sobre o corpo, com e sem textura.
 * O "rosto medido" é o rosto canônico — um modelo válido pelas regras do validateModel.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import * as THREE from "three";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return { ...actual, Canvas: ({ children }: { children?: ReactNode }) => children };
});

import { frames, meshes, mount3d } from "@/test-utils/three";
import { AvatarBust, type AvatarRef } from "./avatar-bust";
import { CANON_POS } from "@/lib/avatar3d/canonical-face";
import { faceMetrics } from "@/lib/avatar3d/geometry";
import { MODEL_VERSION, type AvatarModel } from "@/lib/avatar3d/model";

const shape = Array.from(CANON_POS.slice(0, 468 * 3));
const model = (hair: Partial<AvatarModel["hair"]>): AvatarModel => ({
  v: MODEL_VERSION, shape, skin: "#c99a6e", metrics: faceMetrics(shape), views: [{ role: "front", yaw: 0, pitch: 0, roll: 0 }], warnings: [],
  hair: { present: true, color: "#3b2a20", top: 14, side: 8, bottom: -4, fringe: 0.3, cut: false, length: "short", ...hair },
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("busto do Avatar 3D", () => {
  const cases: [string, AvatarRef][] = [
    ["curto, sem textura", { model: model({}) }],
    ["longo e cacheado, com textura e ajustes", { model: model({ length: "long", texture: "curly", bottom: -22, volume: 1.4 }), texture: new THREE.Texture(), adjust: { headScale: 1.05, neck: 0.4, hairVolume: 1.2 } }],
    ["careca", { model: model({ present: false, color: null, length: "bald" }) }],
    ["com cobertura de cabeça", { model: model({ cover: "#aa2233" }) }],
  ];
  for (const [name, avatar] of cases) {
    it(`monta a cabeça (${name})`, async () => {
      const r = await mount3d(<AvatarBust avatar={avatar} stature={1.68} torsoTopY={1.35} />);
      await frames(r, 2);
      expect(meshes(r).length).toBeGreaterThan(0);
      await r.unmount();
    });
  }

  it("modelo inválido não monta nada", async () => {
    const r = await mount3d(<AvatarBust avatar={{ model: { ...model({}), v: 999 } }} stature={1.7} torsoTopY={1.4} />);
    expect(meshes(r).length).toBe(0);
    await r.unmount();
  });

  it("textura do servidor que não carrega fica sem textura", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const r = await mount3d(<AvatarBust avatar={{ model: model({}), textureUrl: "/api/me/avatar3d/texture" }} stature={1.7} torsoTopY={1.4} />);
    await frames(r, 2);
    expect(meshes(r).length).toBeGreaterThan(0);
    await r.unmount();
  });
});
