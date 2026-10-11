import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { arrowAnywhere, BODY_RADIUS, GOAL_REACHED, moveInRoom, penetration, RoomInteraction, stepToward, WALK_SPEED, type GoalOutcome } from "./interaction";
import { MIRROR_COLLIDER, MirrorSession, mirrorDistance, mirrorFront, mirrorRoute } from "./mirror-session";
import { ROOM, walkArea } from "./room-bounds";
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

describe("vista da câmera do quarto (girar a cena)", () => {
  it("gira de 90° em 90° nos dois sentidos, dá a volta e avisa quem acompanha", () => {
    const engine = new RoomInteraction(); let calls = 0; engine.listeners.add(() => { calls++; });
    expect(engine.view).toBe(0);
    engine.turn(1); expect(engine.view).toBe(1);
    engine.turn(-1); engine.turn(-1); expect(engine.view).toBe(3);
    engine.turn(1); expect(engine.view).toBe(0);
    for (let i = 0; i < 5; i++) engine.turn(1);
    expect(engine.view).toBe(1); expect(calls).toBe(9);
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

describe("caminhar até um ponto (Ir ao espelho / Voltar ao quarto)", () => {
  // o espelho como na cena (room-scene.tsx): no layout do quarto, girado 28°, com a caixa orientada da colisão
  const scene = (actor: [number, number]) => {
    const engine = new RoomInteraction(), mirror = new THREE.Group();
    mirror.position.set(1.95, 0, 1.1); mirror.rotation.y = THREE.MathUtils.degToRad(28); mirror.userData.collider = { ...MIRROR_COLLIDER }; mirror.updateMatrixWorld();
    engine.solids.add(mirror); engine.mirror.copy(mirror.position); engine.actor.set(actor[0], 0, actor[1]);
    return { engine, mirror };
  };
  const walk = (engine: RoomInteraction, frames: number, each?: (i: number) => void, dt = 1 / 60) => {
    for (let i = 0; i < frames && engine.goal; i++) { engine.followGoal(dt, ROOM); each?.(i); }
  };
  it("walkTo chega à frente do espelho sem atravessar a colisão: reto, pela quina e vindo de trás do vidro; a zona abre a prova", () => {
    for (const start of [[0, 1.65], [2.2, .62], [3.5, 1.0], [1.0, 4.0], [-2.5, 3.4]] as [number, number][]) {
      const { engine, mirror } = scene(start), session = new MirrorSession();
      const outcomes: GoalOutcome[] = [], area = walkArea(ROOM);
      engine.walkTo(mirrorRoute(engine.actor, engine.mirror), (o) => outcomes.push(o));
      let t = 0;
      walk(engine, 900, () => {
        t += 1000 / 60;
        expect(penetration(mirror, engine.actor)).toBe(0);                       // nunca entra no espelho
        expect(engine.actor.x).toBeGreaterThanOrEqual(area.minX); expect(engine.actor.z).toBeLessThanOrEqual(area.maxZ);
        session.update(mirrorDistance(engine.actor, engine.mirror), t, !!engine.goal);
      });
      expect(outcomes).toEqual(["arrived"]);
      expect(engine.actor.distanceTo(mirrorFront(engine.mirror))).toBeLessThanOrEqual(GOAL_REACHED);
      for (let i = 1; i <= 30; i++) session.update(mirrorDistance(engine.actor, engine.mirror), t + i * 20, false);
      expect(session.phase).toBe("tryon");                                        // o movimento é a navegação
    }
  });
  it("anda na velocidade das setas e vira para onde anda", () => {
    const { engine } = scene([0, 1.65]); const goal = new THREE.Vector3(1, 0, 1.65);
    const step = stepToward(engine.actor, goal, .05, ROOM, engine.solids);
    expect(step.moved).toBeCloseTo(.05 * WALK_SPEED); expect(step.heading).toBeCloseTo(Math.PI / 2); expect(step.arrived).toBe(false);
    const last = new THREE.Vector3(.95, 0, 1.65);                                  // o último passo para em cima do ponto
    expect(stepToward(last, goal, .05, ROOM).arrived).toBe(true); expect(last.x).toBeCloseTo(1, 9);
  });
  it("contorna um obstáculo no caminho (desliza ao longo dele) e chega", () => {
    const engine = new RoomInteraction(), box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, .5)); box.position.set(0, .5, 2); box.updateMatrixWorld();
    engine.solids.add(box); engine.actor.set(0, 0, 3);
    let outcome: GoalOutcome | null = null;
    engine.walkTo(new THREE.Vector3(0, 0, 1), (o) => { outcome = o; });
    walk(engine, 900, () => expect(penetration(box, engine.actor)).toBe(0));
    expect(outcome).toBe("arrived"); expect(engine.actor.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThanOrEqual(GOAL_REACHED);
  });
  it("qualquer seta (teclado ou direcional) cancela a caminhada; uma nova caminhada substitui a anterior", () => {
    const { engine } = scene([0, 1.65]); const outcomes: GoalOutcome[] = [];
    engine.walkTo(mirrorFront(engine.mirror), (o) => outcomes.push(`a:${o}` as GoalOutcome));
    engine.walkTo(mirrorFront(engine.mirror), (o) => outcomes.push(`b:${o}` as GoalOutcome));
    expect(outcomes).toEqual(["a:cancelled"]);
    walk(engine, 20); const at = engine.actor.clone();
    engine.keyDown("KeyD"); expect(engine.goal).not.toBeNull();                    // mirar a mão não cancela
    engine.keyDown("ArrowLeft"); expect(engine.goal).toBeNull(); expect(engine.route).toEqual([]);
    expect(outcomes).toEqual(["a:cancelled", "b:cancelled"]);
    expect(engine.followGoal(1 / 60, ROOM)).toBeNull(); expect(engine.actor.equals(at)).toBe(true);
  });
  it("andar solta o puxador segurado (a caminhada não fica presa na porta)", () => {
    const engine = new RoomInteraction(); const handle = new THREE.Group(); handle.position.set(0, 1, 0);
    engine.targets.set("door", { id: "door", kind: "handle", object: handle, available: () => true });
    engine.keyDown("KeyD"); engine.keyUp("KeyD", new THREE.Vector3(0, 1, 0)); expect(engine.grip?.id).toBe("door");
    engine.walkTo(new THREE.Vector3(1, 0, 2)); expect(engine.grip).toBeNull();
  });
  it("sem se aproximar por ~1 s (parado na parede), desiste e avisa", () => {
    const { engine } = scene([0, 2.4]); let outcome: GoalOutcome | null = null, frames = 0, lastMove = 0;
    engine.walkTo(new THREE.Vector3(10, 0, 2.4), (o) => { outcome = o; });           // fora das paredes: para na parede leste
    let x = engine.actor.x;
    walk(engine, 900, (i) => { frames = i + 1; if (engine.actor.x > x + 1e-6) lastMove = i + 1; x = engine.actor.x; });
    expect(outcome).toBe("stuck"); expect(engine.goal).toBeNull();
    expect(engine.actor.x).toBeCloseTo(walkArea(ROOM).maxX);
    expect((frames - lastMove) / 60).toBeGreaterThan(.9); expect((frames - lastMove) / 60).toBeLessThan(1.2);
  });
});
