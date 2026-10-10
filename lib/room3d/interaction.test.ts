import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { arrowAnywhere, moveInRoom, RoomInteraction } from "./interaction";
function target(engine: RoomInteraction, id: string, kind: "handle" | "piece", available = true) {
  const object = new THREE.Group(); object.position.set(0, 1, 0);
  engine.targets.set(id, { id, kind, object, available: () => available }); return object;
}
describe("wardrobe interaction lifecycle", () => {
  it("requires real proximity and an available garment before pickup", () => {
    const engine = new RoomInteraction(); target(engine, "closed", "piece", false); target(engine, "shirt", "piece");
    engine.keyDown("KeyD"); engine.keyUp("KeyD", new THREE.Vector3(1, 1, 0)); expect(engine.held).toBeNull();
    engine.keyDown("KeyD"); engine.keyUp("KeyD", new THREE.Vector3(0, 1, .05)); expect(engine.held).toBe("shirt");
  });
  it("carries while walking and across focus loss, and drops on a second deliberate arm release", () => {
    const engine = new RoomInteraction(); target(engine, "shirt", "piece");
    engine.keyDown("KeyA"); engine.keyUp("KeyA", new THREE.Vector3(0, 1, 0));
    engine.keyDown("ArrowRight"); moveInRoom(engine.actor, engine.keys, .05, 1.2); engine.blur(); expect(engine.held).toBe("shirt");
    engine.keyUp("KeyA", new THREE.Vector3()); expect(engine.held).toBe("shirt");
    engine.keyDown("KeyA"); engine.keyUp("KeyA", new THREE.Vector3(1, 1, 2));
    expect(engine.held).toBeNull(); expect(engine.dropped.get("shirt")?.toArray()).toEqual([1, 1, 2]);
  });
  it("offers try-on only near the mirror and consumes carry only after success", () => {
    const engine = new RoomInteraction(); engine.held = "shirt";
    expect(engine.state.nearMirror).toBe(false); engine.actor.copy(engine.mirror); expect(engine.state.nearMirror).toBe(true);
    engine.consume("other"); expect(engine.held).toBe("shirt"); engine.consume("shirt"); expect(engine.state.nearMirror).toBe(false);
  });
  it("latches a handle and releases it without dropping another arm's clothing", () => {
    const engine = new RoomInteraction(); target(engine, "door", "handle"); engine.held = "shirt"; engine.heldArm = "Left";
    engine.keyDown("KeyD"); engine.keyUp("KeyD", new THREE.Vector3(0, 1, 0)); expect(engine.grip?.id).toBe("door");
    engine.keyDown("KeyD"); engine.keyUp("KeyD"); expect(engine.grip).toBeNull(); expect(engine.held).toBe("shirt");
  });
  it("normalizes diagonal speed, clamps large frames and stops at solid furniture", () => {
    const straight = new THREE.Vector3(0, 0, 2), diagonal = straight.clone();
    moveInRoom(straight, new Set(["ArrowRight"]), 1, 1.2); moveInRoom(diagonal, new Set(["ArrowRight", "ArrowDown"]), .05, 1.2);
    expect(straight.distanceTo(new THREE.Vector3(0, 0, 2))).toBeCloseTo(diagonal.distanceTo(new THREE.Vector3(0, 0, 2)));
    const solid = new THREE.Mesh(new THREE.BoxGeometry(.5, 1, .5)); solid.position.set(0, .5, 1); solid.updateMatrixWorld();
    const position = new THREE.Vector3(0, 0, 1.44); moveInRoom(position, new Set(["ArrowUp"]), .05, 1.2, [solid]); expect(position.z).toBe(1.44);
  });
});
describe("setas na página inteira durante a prova (QUARTO-ESPELHO)", () => {
  it("valem só na prova, só para setas, fora do canvas e fora de campos de texto", () => {
    const canvas = {} as EventTarget, input = {} as EventTarget, body = {} as EventTarget;
    const editable = (t: EventTarget | null) => t === input;
    expect(arrowAnywhere({ code: "ArrowUp", target: body }, canvas, true, editable)).toBe(true);
    expect(arrowAnywhere({ code: "ArrowLeft", target: null }, canvas, true, editable)).toBe(true);
    expect(arrowAnywhere({ code: "ArrowUp", target: body }, canvas, false, editable)).toBe(false);   // fora da prova: só com o canvas focado
    expect(arrowAnywhere({ code: "ArrowUp", target: canvas }, canvas, true, editable)).toBe(false);  // o canvas já trata as próprias teclas
    expect(arrowAnywhere({ code: "ArrowUp", target: input }, canvas, true, editable)).toBe(false);   // digitando no Vista-me
    expect(arrowAnywhere({ code: "KeyA", target: body }, canvas, true, editable)).toBe(false);       // pegar/largar só com o canvas focado
  });
});
