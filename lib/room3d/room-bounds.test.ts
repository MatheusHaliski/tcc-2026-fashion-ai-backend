import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BODY_RADIUS, moveInRoom, penetration } from "./interaction";
import { cameraFor } from "./mirror-session";
import {
  NORTH_CLEAR, ROOM, ROOM_CAMERA, W2, WALL_BEHIND, WALL_MARGIN, WALLS, clampCamera, dropPoint, insideW2, inputYaw, reachPlane, roomView, rotateView, toWall, viewYaw, walkArea, wallById,
  wallOpacity, wallSide, w2ToWorld,
} from "./room-bounds";

/** Segura as setas por `frames` quadros de 50 ms (o passo por quadro é limitado). */
const hold = (p: THREE.Vector3, keys: string[], frames = 300, yaw = 0, solids: THREE.Object3D[] = []) => { for (let i = 0; i < frames; i++) moveInRoom(p, new Set(keys), .05, ROOM, solids, yaw); return p; };
const center = new THREE.Vector3((ROOM.minX + ROOM.maxX) / 2, 0, (ROOM.minZ + ROOM.maxZ) / 2);

describe("quarto de quatro paredes (room-bounds)", () => {
  it("quatro paredes com a normal para dentro: a câmera atrás de uma delas fica do lado negativo só dela", () => {
    expect(WALLS.map((w) => w.id).sort()).toEqual(["east", "north", "south", "west"]);
    for (const w of WALLS) {
      expect(wallSide(center, w)).toBeGreaterThan(2);                                   // o centro do quarto está na frente de todas
      expect(Math.hypot(w.normal[0], w.normal[2])).toBeCloseTo(1);
      // o espaço local gira para que o z local seja a normal (para dentro do quarto)
      expect(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), w.yaw).toArray().map((v) => +v.toFixed(6) + 0)).toEqual(w.normal.map((v) => v + 0));
    }
    const outsideSouth = new THREE.Vector3(1, 2.5, ROOM.maxZ + 2);
    expect(wallSide(outsideSouth, wallById("south"))).toBeLessThan(0);
    for (const id of ["north", "east", "west"] as const) expect(wallSide(outsideSouth, wallById(id))).toBeGreaterThan(0);
    expect(wallSide(new THREE.Vector3(ROOM.minX - 1, 0, 2), wallById("west"))).toBeLessThan(0);
    expect(WALL_BEHIND).toEqual(["south", "east", "north", "west"]);
  });
  it("a parede some aos poucos só quando a câmera chega nela e fica invisível atrás", () => {
    expect(wallOpacity(1)).toBe(1); expect(wallOpacity(0.4)).toBe(1);
    expect(wallOpacity(0)).toBe(0); expect(wallOpacity(-0.5)).toBe(0);
    const mid = wallOpacity(0.2); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1);
    expect(wallOpacity(0.1)).toBeLessThan(wallOpacity(0.3));
  });
  it("pontos do quarto no espaço local da parede (o 2º guarda-roupa na oeste, a 2ª janela na leste)", () => {
    const w2 = toWall(wallById("west"), [W2.x, 0, W2.z]);
    expect(w2[0]).toBeCloseTo(-(W2.z - center.z)); expect(w2[2]).toBeCloseTo(0.32);
    const win = toWall(wallById("east"), [ROOM.maxX - 0.015, 2.05, 2.45]);
    expect(win[0]).toBeCloseTo(2.45 - center.z); expect(win[1]).toBe(2.05); expect(win[2]).toBeCloseTo(0.015);
    expect(toWall(wallById("north"), [0, 0, 0])).toEqual([-center.x, 0, -ROOM.minZ]);
    // 2º guarda-roupa: x local vira −z do quarto; z local (para fora do móvel) vira +x
    expect(w2ToWorld(0.5, 1, 0.3)).toEqual([W2.x + 0.3, 1, W2.z - 0.5]);
  });
  it("o personagem para nas quatro paredes com folga (e na frente do guarda-roupa 1 na norte)", () => {
    expect(hold(center.clone(), ["ArrowLeft"]).x).toBeCloseTo(ROOM.minX + WALL_MARGIN);
    expect(hold(center.clone(), ["ArrowRight"]).x).toBeCloseTo(ROOM.maxX - WALL_MARGIN);
    expect(hold(center.clone(), ["ArrowDown"]).z).toBeCloseTo(ROOM.maxZ - WALL_MARGIN);
    expect(hold(center.clone(), ["ArrowUp"]).z).toBeCloseTo(NORTH_CLEAR);
    expect(walkArea(ROOM)).toEqual({ minX: ROOM.minX + WALL_MARGIN, maxX: ROOM.maxX - WALL_MARGIN, minZ: NORTH_CLEAR, maxZ: ROOM.maxZ - WALL_MARGIN });
    expect(walkArea(1.2)).toEqual({ minX: -2.85, maxX: 2.8, minZ: 0.55, maxZ: 4.4 });   // formato antigo (borda do guarda-roupa)
  });
  it("o 2º guarda-roupa, girado 90° na parede oeste, é obstáculo pela caixa orientada", () => {
    const w2 = new THREE.Group(); w2.position.set(W2.x, 0, W2.z); w2.rotation.y = W2.yaw; w2.userData.collider = { ...W2.collider }; w2.updateMatrixWorld();
    // andando para oeste na frente dele: para na frente da carcaça, sem entrar no raio do tronco
    const front = hold(new THREE.Vector3(-1.5, 0, W2.z), ["ArrowLeft"], 300, 0, [w2]);
    expect(penetration(w2, front)).toBe(0);
    expect(front.x).toBeCloseTo(W2.x + W2.collider.hz + BODY_RADIUS, 1);
    // girado: a caixa cobre 1,84 m ao longo da parede (z) e só 0,62 m de fundo (x)
    expect(penetration(w2, new THREE.Vector3(W2.x + 0.4, 0, W2.z + 0.8))).toBeGreaterThan(0);
    expect(penetration(w2, new THREE.Vector3(W2.x + 0.8, 0, W2.z))).toBe(0);
    // ao lado dele (mais ao norte), chega até a parede
    expect(hold(new THREE.Vector3(-1.5, 0, 1.5), ["ArrowLeft"], 300, 0, [w2]).x).toBeCloseTo(ROOM.minX + WALL_MARGIN);
  });
  it("as setas seguem a câmera: na vista girada 90°, ↑ anda para oeste (o fundo da tela)", () => {
    const p = new THREE.Vector3(0.5, 0, 2.5), start = p.clone();
    const heading = moveInRoom(p, new Set(["ArrowUp"]), .05, ROOM, [], viewYaw(1));
    expect(p.x).toBeLessThan(start.x); expect(p.z).toBeCloseTo(start.z);
    expect(Math.sin(heading)).toBeCloseTo(-1);                                           // virado para −x
    const q = new THREE.Vector3(0.5, 0, 2.5); moveInRoom(q, new Set(["ArrowUp"]), .05, ROOM, [], viewYaw(2));
    expect(q.z).toBeGreaterThan(2.5); expect(q.x).toBeCloseTo(0.5);                      // vista 2 (de norte para sul): ↑ anda para o sul
    const r = new THREE.Vector3(0.5, 0, 2.5); moveInRoom(r, new Set(["ArrowRight"]), .05, ROOM, [], viewYaw(1));
    expect(r.z).toBeLessThan(2.5);                                                       // → vai para o norte (direita da tela)
  });
  it("4 vistas: a 0 é a visão geral de sempre; todas ficam dentro do quarto e longe do personagem", () => {
    const actor = new THREE.Vector3(0, 0, 1.65), mirror = new THREE.Vector3(1.95, 0, 1.1);
    const base = cameraFor("room", actor, mirror, 1.2);
    expect(cameraFor("room", actor, mirror, 1.2, 0).position).toEqual(base.position);
    expect(rotateView(base.position, base.target, 4).position.distanceTo(base.position)).toBeLessThan(1e-9);
    const v1 = cameraFor("room", actor, mirror, 1.2, 1); expect(v1.position.y).toBeCloseTo(2.65); expect(v1.target.x).toBeLessThan(v1.position.x);   // câmera a leste, olhando para oeste
    for (let view = 0; view < 4; view++) {
      const cam = cameraFor("room", actor, mirror, 1.2, view, ROOM);
      expect(cam.position.x).toBeGreaterThanOrEqual(ROOM.minX + 0.3 - 1e-9); expect(cam.position.x).toBeLessThanOrEqual(ROOM.maxX - 0.3 + 1e-9);
      expect(cam.position.z).toBeGreaterThanOrEqual(ROOM.minZ + 0.75 - 1e-9); expect(cam.position.z).toBeLessThanOrEqual(ROOM.maxZ - 0.3 + 1e-9);
      expect(cam.position.y).toBeLessThanOrEqual(ROOM.height - 0.1 + 1e-9);
      expect(Math.hypot(cam.position.x - actor.x, cam.position.z - actor.z)).toBeGreaterThanOrEqual(ROOM_CAMERA.minDistance - 1e-3);
      // olha para a frente da vista (a câmera pode deslizar e olhar na diagonal; as setas usam viewYaw, não este ângulo)
      const yaw = viewYaw(view), look = cam.target.clone().sub(cam.position).setY(0).normalize();
      expect(look.dot(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)))).toBeGreaterThan(0.5);
    }
    // a prova continua de frente para o espelho e dentro do quarto
    const tryon = cameraFor("tryon", actor, mirror, 1.2, 2, ROOM);
    expect(tryon.position.z).toBeGreaterThan(mirror.z + 2); expect(tryon.position.z).toBeLessThanOrEqual(ROOM.maxZ - 0.3);
    expect(inputYaw(tryon.position, tryon.target)).toBeCloseTo(0);
  });
  it("modo andar: a câmera não troca de lado quando o personagem cruza a linha dela (o lado vem da posição atual da câmera)", () => {
    const mirror = new THREE.Vector3(2.05, 0, 1.1), far = new THREE.Vector3(0.3, 0, 0.9);
    for (let view = 0; view < 4; view++) {
      // a câmera da vista sem deslizar (personagem longe) e as direções da vista no chão
      const p = cameraFor("room", far, mirror, 1.2, view, ROOM).position, yaw = viewYaw(view);
      const front = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const at = (lateral: number) => p.clone().setY(0).addScaledVector(front, 2).addScaledVector(right, lateral);
      // o controlador com movimento reduzido: a câmera vai direto para a pose pedida, que é a "atual" do quadro seguinte
      let cam = cameraFor("room", at(-0.5), mirror, 1.2, view, ROOM).position;
      const side = Math.sign(cam.clone().sub(p).dot(right));
      for (let lateral = -0.5; lateral <= 0.5 + 1e-9; lateral += 0.002) {                // 2 mm por passo, cruzando a linha
        const next = cameraFor("room", at(lateral), mirror, 1.2, view, ROOM, cam).position;
        expect(Math.hypot(next.x - cam.x, next.z - cam.z)).toBeLessThan(0.05);
        cam = next;
      }
      expect(Math.sign(cam.clone().sub(p).dot(right))).toBe(side);                          // ficou do mesmo lado
      expect(Math.hypot(cam.x - at(0.5).x, cam.z - at(0.5).z)).toBeGreaterThanOrEqual(ROOM_CAMERA.minDistance - 1e-3);
    }
    // sem a posição atual, o lado continua o mais perto da câmera da vista (quem não passa `prev` não muda)
    const base = { position: new THREE.Vector3(1.3, 2.65, 5.8), target: new THREE.Vector3(0.3, 1.1, 0.85) }, actor = { x: 1.117, z: 3.0 };
    expect(roomView(base.position, base.target, actor, 0, ROOM).position).toEqual(cameraFor("room", new THREE.Vector3(actor.x, 0, actor.z), mirror, 1.2, 0, ROOM).position);
  });
  it("a peça solta pousa dentro do quarto e fora dos dois guarda-roupas", () => {
    const area = walkArea(ROOM);
    // a mão do personagem parado na frente do 2º guarda-roupa fica dentro da carcaça: a peça vai para a frente dele
    const atW2 = dropPoint(new THREE.Vector3(-2.89, 0.035, 3.1), area);
    expect(atW2.x).toBeCloseTo(W2.x + W2.collider.hz + 0.22); expect(atW2.z).toBe(3.1); expect(atW2.y).toBe(0.035);
    expect(atW2.x - 0.19).toBeGreaterThan(W2.x + W2.collider.hz);                            // a peça deitada (0,38 m) fica toda fora
    expect(dropPoint({ x: -2.9, z: W2.z - W2.collider.hx - 0.3 }, area).x).toBeCloseTo(W2.x + W2.collider.hz + 0.22);   // a peça avança para o sul
    expect(dropPoint({ x: 0.4, z: 2 }, area)).toEqual({ x: 0.4, z: 2 });                     // no meio do quarto: não mexe
    expect(dropPoint({ x: -2.9, z: 1.2 }, area)).toEqual({ x: -2.9, z: 1.2 });               // ao norte do 2º, até a parede
    expect(dropPoint({ x: 9, z: 0.3 }, area)).toEqual({ x: area.maxX, z: 0.8 });             // fora do quarto e na frente do 1
  });
  it("câmera dentro da carcaça do 2º guarda-roupa (a órbita gira inteira)", () => {
    expect(insideW2(new THREE.Vector3(-2.94, 2.0, 3.44), 2.5)).toBe(true);
    expect(insideW2(new THREE.Vector3(-2.94, 2.7, 3.44), 2.5)).toBe(false);                  // acima do móvel
    expect(insideW2(new THREE.Vector3(-2.6, 2.0, 3.44), 2.5)).toBe(false);                   // na frente dele
    expect(insideW2(new THREE.Vector3(-2.94, 2.0, 1.5), 2.5)).toBe(false);                   // ao lado (mais ao norte)
  });
  it("câmera fora do quarto volta para dentro pela reta até o alvo e sobe para ver o mesmo chão", () => {
    const target = new THREE.Vector3(0.3, 1.1, 0.85), out = clampCamera(new THREE.Vector3(1.3, 2.65, 5.8), target);
    expect(out.z).toBeCloseTo(ROOM.maxZ - 0.3); expect(out.y).toBeGreaterThan(2.65); expect(out.y).toBeLessThanOrEqual(ROOM.height - 0.1);
    expect(clampCamera(new THREE.Vector3(1, 2, 3), target).toArray()).toEqual([1, 2, 3]);   // já dentro: não muda
  });
  it("o alcance da mão usa a frente do guarda-roupa mais perto", () => {
    const toW2 = reachPlane({ x: -2.2, z: W2.z });
    expect(toW2.normal.x).toBe(1); expect(toW2.distanceToPoint(new THREE.Vector3(W2.x + W2.collider.hz + 0.03, 1, W2.z))).toBeCloseTo(0);
    const toW1 = reachPlane({ x: 0, z: 0.9 }); expect(toW1.normal.z).toBe(1); expect(toW1.distanceToPoint(new THREE.Vector3(0, 1, 0.34))).toBeCloseTo(0);
    expect(reachPlane({ x: -2.2, z: 0.8 }).normal.z).toBe(1);                               // canto noroeste, longe do 2º: o 1
  });
});
