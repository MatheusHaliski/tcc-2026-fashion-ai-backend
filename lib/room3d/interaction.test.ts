import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { arrowAnywhere, BODY_RADIUS, moveInRoom, penetration, RoomInteraction } from "./interaction";
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
  it("o espelho girado é obstáculo pela caixa orientada: para na frente do vidro, desliza na diagonal e sai sem atravessar", () => {
    // espelho como na cena: girado 28° em Y, vidro de 0,94 m × 0,16 m (meias-medidas 0,47 × 0,08)
    const mirror = new THREE.Group(); mirror.position.set(2, 0, 1.1); mirror.rotation.y = THREE.MathUtils.degToRad(28);
    mirror.userData.collider = { hx: .47, hz: .08 }; mirror.updateMatrixWorld();
    const normal = new THREE.Vector3(Math.sin(mirror.rotation.y), 0, Math.cos(mirror.rotation.y));
    // de frente para o vidro, andando em direção a ele por vários segundos: nunca entra no raio do tronco
    const actor = mirror.position.clone().add(normal.clone().multiplyScalar(1.2));
    const toward = new Set(["ArrowUp", "ArrowLeft"]);                        // (-x, -z): na direção do vidro
    for (let i = 0; i < 200; i++) moveInRoom(actor, toward, .05, 1.2, [mirror]);
    expect(penetration(mirror, actor)).toBe(0);
    const local = mirror.worldToLocal(actor.clone());
    expect(local.z).toBeGreaterThan(.08 + BODY_RADIUS - 1e-6);               // continua na frente do vidro
    // a caixa alinhada aos eixos de um painel girado deixaria passar pela quina; a orientada não deixa
    const cross = mirror.position.clone().add(normal.clone().multiplyScalar(.12));
    expect(penetration(mirror, cross)).toBeGreaterThan(0);
    // do outro lado do vidro, ao longe, nada bloqueia
    expect(penetration(mirror, mirror.position.clone().add(normal.clone().multiplyScalar(-.6)))).toBe(0);
    // já dentro (porta abriu sobre o personagem): só aceita passos que diminuem a sobreposição
    const inside = mirror.position.clone().add(normal.clone().multiplyScalar(.1));
    const before = penetration(mirror, inside);
    moveInRoom(inside, new Set(["ArrowDown", "ArrowRight"]), .05, 1.2, [mirror]); // (+x, +z): para fora, na direção da normal
    expect(penetration(mirror, inside)).toBeLessThan(before);
    const deeper = mirror.position.clone().add(normal.clone().multiplyScalar(.2)); const deep0 = penetration(mirror, deeper);
    moveInRoom(deeper, new Set(["ArrowUp", "ArrowLeft"]), .05, 1.2, [mirror]); // para dentro: recusado
    expect(penetration(mirror, deeper)).toBeLessThanOrEqual(deep0);
  });
  it("na diagonal contra a frente do guarda-roupa, desliza ao longo dela em vez de parar", () => {
    const solid = new THREE.Mesh(new THREE.BoxGeometry(2, 1, .5)); solid.position.set(0, .5, 1); solid.updateMatrixWorld();
    const p = new THREE.Vector3(0, 0, 1.44); moveInRoom(p, new Set(["ArrowUp", "ArrowRight"]), .05, 1.2, [solid]);
    expect(p.z).toBe(1.44); expect(p.x).toBeGreaterThan(0);
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
