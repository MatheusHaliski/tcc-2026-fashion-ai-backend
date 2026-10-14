// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { RoomFixture } from "./room-furniture";
import { RoomInteraction, moveInRoom, penetration } from "@/lib/room3d/interaction";
import { ROOM } from "@/lib/room3d/room-bounds";
import { mount3d } from "@/test-utils/three";

it("chair footprint blocks walking and its proximity action unregisters when removed", async () => {
  const engine = new RoomInteraction(), run = vi.fn();
  const r = await mount3d(<RoomFixture id="chair" engine={engine} position={[-1.95, 0, 1.75]} collider={[.32, .32]} kind="sit" run={run}><mesh><boxGeometry args={[.45, .8, .45]} /><meshStandardMaterial /></mesh></RoomFixture>);
  expect(engine.solids.size).toBe(1); const solid = [...engine.solids][0]; solid.updateWorldMatrix(true, true);
  engine.actor.set(-1.95, 0, 2.9);
  for (let i = 0; i < 100; i++) moveInRoom(engine.actor, new Set(["ArrowUp"]), .05, ROOM, engine.solids);
  expect(engine.actor.z).toBeGreaterThanOrEqual(2.24); expect(penetration(solid, engine.actor)).toBe(0);
  engine.interact(); expect(run).toHaveBeenCalledOnce();
  await r.unmount(); expect(engine.solids.size).toBe(0); expect(engine.actions.size).toBe(0); expect(engine.nearAction).toBeNull();
});
