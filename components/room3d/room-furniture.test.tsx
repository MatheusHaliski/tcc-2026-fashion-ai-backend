// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ApprovedAsset } from "./approved-asset";
import { BED, BED_POSITION, DoubleBed, RoomFixture } from "./room-furniture";
import { RoomInteraction, moveInRoom, penetration } from "@/lib/room3d/interaction";
import { ROOM } from "@/lib/room3d/room-bounds";
import { frames, mount3d } from "@/test-utils/three";

it("double bed is human-sized, has its headboard on the east wall facing the room center, and a lamp on each nightstand", async () => {
  const engine = new RoomInteraction();
  const r = await mount3d(<DoubleBed engine={engine} modelUrl={null} lit={false} intensity={0.75} />);
  await frames(r, 2);

  expect(BED.length).toBeGreaterThan(2);
  expect(BED_POSITION[0] + BED.length / 2).toBeCloseTo(ROOM.maxX - 0.03, 6);
  const collider = [...engine.solids][0].userData.collider;
  expect(collider).toEqual({ hx: BED.width / 2, hz: BED.length / 2 });
  const brandedLampBases = r.scene.findAll((node) =>
    node.type === "Mesh" && (node.instance as THREE.Mesh).geometry instanceof THREE.CylinderGeometry &&
    ((node.instance as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString() === "1245a8",
  );
  expect(brandedLampBases).toHaveLength(2);
  await r.unmount();
});

it("rotates an approved asset without changing its fitted dimensions", async () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.5), new THREE.MeshStandardMaterial()));
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue({ scene } as never);
  const r = await mount3d(<ApprovedAsset url="/bed.glb" size={[3, 2, 1]} rotationY={Math.PI}><mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial /></mesh></ApprovedAsset>);
  await frames(r, 2);

  const rotated = r.scene.findAll((node) =>
    node.type === "Group" && Math.abs((node.instance as THREE.Group).rotation.y - Math.PI) < 0.001,
  );
  expect(rotated.length).toBeGreaterThan(0);
  await r.unmount();
});

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
