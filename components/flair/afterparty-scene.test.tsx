// @vitest-environment jsdom
/** MET Gala Heist em 3D: o salão do Meu Quarto em versão de gala, e o deck mudando o salão e o avatar. */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@react-three/drei", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/drei")>()), ContactShadows: () => null }));
import { frames, mount3d } from "@/test-utils/three";
import { HeistWorld } from "./afterparty-scene";
import type { AdventureMods, AdventureSession } from "@/lib/flair/afterparty";

afterEach(() => { vi.clearAllMocks(); });
const STEALTH: AdventureMods = { agility: 78, stealth: 86, charm: 40, stamina: 72, speedMul: 1.16, suspicionMul: 0.78, distractMul: 1.08, regenMul: 1.28, light: "PENUMBRA", zoneMul: 0.82, crowd: 0, guests: 2, vipRouteMs: 0 };
const GALA: AdventureMods = { agility: 30, stealth: 18, charm: 92, stamina: 40, speedMul: 0.97, suspicionMul: 1.19, distractMul: 1.44, regenMul: 1.02, light: "HOLOFOTES", zoneMul: 1.15, crowd: 0.67, guests: 6, vipRouteMs: 8000 };
const session = (mods: AdventureMods | null, serverTime = 12_000): AdventureSession => ({ id: "s", serverTime, state: {
  x: 0, z: 5, energy: 100, suspicion: 0, status: "ACTIVE", phase: "ACQUIRE", activeDeckId: null, role: "NONE", color: "#333", feedback: "STARTED",
  badge: false, item: false, running: false, activeUntil: 0, distractionUntilLeft: 0, distractionUntilRight: 0, distractionReadyAt: 0, cooldowns: {}, loadouts: [],
  startedAt: 10_000, mods } });

async function world(s: AdventureSession) {
  const r = await mount3d(<HeistWorld session={s} look={null} onTarget={() => {}} />);
  await frames(r, 2);
  const byName = (n: string) => r.scene.instance.getObjectByName(n);
  const count = (n: string) => { let k = 0; r.scene.instance.traverse((o) => { if (o.name === n) k++; }); return k; };
  return { r, byName, count };
}

describe("salão do Heist", () => {
  it("é o quarto em versão de gala: tapete e letreiro FashionAI, móvel FAI Origem, porta, abajures, vitrine e crachá", async () => {
    const { r, byName, count } = await world(session(null));
    for (const n of ["fai-tapete", "fai-neon", "heist-floor", "heist-jewel", "heist-badge", "heist-player", "heist-rope-gate", "heist-rope-vip", "heist-sight"]) expect(byName(n), n).toBeTruthy();
    expect(count("heist-wardrobe")).toBe(2); expect(count("heist-chandelier")).toBe(3); expect(byName("heist-exit")).toBeTruthy(); expect(count("heist-guard")).toBe(2);
    // partida antiga (sem modificadores): salão aceso, dois convidados, cordão VIP fechado
    expect(count("heist-guest")).toBe(2); expect(byName("heist-searchlights")).toBeUndefined();
    expect(byName("heist-rope-vip")!.userData.open).toBe(false);
    await r.unmount();
  });

  it("deck escuro e furtivo: penumbra (vista menor) e sombra no avatar; deck de gala: holofotes, convidados, rota VIP e brilho", async () => {
    const dark = await world(session(STEALTH));
    expect(dark.byName("heist-sight")!.userData.width).toBeCloseTo(4.8 * 0.82, 5);
    expect(dark.byName("heist-cloak")).toBeTruthy(); expect(dark.byName("heist-exposed")).toBeUndefined(); expect(dark.byName("heist-charm")).toBeUndefined();
    expect(dark.byName("heist-searchlights")).toBeUndefined();
    await dark.r.unmount();
    const gala = await world(session(GALA));
    expect(gala.byName("heist-sight")!.userData.width).toBeCloseTo(4.8 * 1.15, 5);
    expect(gala.byName("heist-searchlights")).toBeTruthy();
    expect(gala.count("heist-guest")).toBe(6);
    expect(gala.byName("heist-exposed")).toBeTruthy(); expect(gala.byName("heist-charm")).toBeTruthy(); expect(gala.byName("heist-cloak")).toBeUndefined();
    expect(gala.byName("heist-rope-vip")!.userData.open).toBe(true);                    // rota VIP: 2 s de 8 já passaram
    expect(gala.byName("heist-rope-gate")!.userData.open).toBe(true);
    await gala.r.unmount();
    const later = await world(session(GALA, 19_000));
    expect(later.byName("heist-rope-vip")!.userData.open).toBe(false);
    await later.r.unmount();
  });
});
