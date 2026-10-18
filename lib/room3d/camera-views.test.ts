/**
 * Pontos de vista do Meu Quarto (aba Configurações): os cantos do teto ficam dentro do quarto, no alto, e olham para o
 * centro (andando, viram para o personagem); a planta cabe o quarto inteiro na tela e o "para cima" é o norte; a casa de
 * bonecas fica de fora e pede as paredes baixas; a primeira pessoa sai dos olhos, à frente do rosto; a cinematográfica
 * gira por dentro das paredes e para com movimento reduzido.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CORNERS, availableViews, nextCorner, nextView, plantaHeight, poseYaw, viewPose, wallsFor, type CameraViewId } from "./camera-views";
import { ROOM } from "./room-bounds";
import { MIRROR_NORMAL } from "./mirror-session";

const ctx = { mirror: { x: 1.95, z: 1.1 }, mirrorNormal: { x: MIRROR_NORMAL.x, z: MIRROR_NORMAL.z }, aspect: 16 / 9 };
const inside = (p: THREE.Vector3) => p.x > ROOM.minX && p.x < ROOM.maxX && p.z > ROOM.minZ && p.z < ROOM.maxZ && p.y > 0 && p.y < ROOM.height;

describe("pontos de vista da câmera", () => {
  it("livre não muda nada: a câmera de sempre (órbita ou a do modo andar)", () => {
    expect(viewPose("livre", ctx)).toBeNull();
  });

  it("os 4 cantos do teto ficam dentro do quarto, a 20 cm do teto, um em cada canto, olhando para baixo, para o centro", () => {
    const poses = CORNERS.map((id) => viewPose(id, ctx)!);
    for (const p of poses) {
      expect(inside(p.position)).toBe(true);
      expect(p.position.y).toBeCloseTo(ROOM.height - 0.2, 5);
      expect(p.target.y).toBeLessThan(p.position.y);
      expect(p.fov).toBeGreaterThanOrEqual(60);                          // grande angular, como câmera de segurança
    }
    // quatro cantos diferentes: dois a oeste, dois a leste, dois ao norte, dois ao sul
    expect(new Set(poses.map((p) => `${Math.sign(p.position.x - 0.5)}${Math.sign(p.position.z - 2.44)}`)).size).toBe(4);
  });

  it("andando, o canto do teto vira o olhar para o personagem (sem sair do lugar)", () => {
    const still = viewPose("teto-porta", ctx)!, walking = viewPose("teto-porta", { ...ctx, actor: { x: 3.5, z: 4.5 } })!;
    expect(walking.position.equals(still.position)).toBe(true);
    expect(walking.target.distanceTo(new THREE.Vector3(3.5, 1, 4.5))).toBeLessThan(still.target.distanceTo(new THREE.Vector3(3.5, 1, 4.5)));
  });

  it("planta: de cima, alta o bastante para caber o quarto inteiro, com o norte para cima da tela", () => {
    const p = viewPose("planta", ctx)!;
    const half = Math.tan(THREE.MathUtils.degToRad(p.fov!) / 2);
    expect(p.position.y * half).toBeGreaterThan((ROOM.maxZ - ROOM.minZ) / 2);                 // cabe a profundidade
    expect(p.position.y * half * ctx.aspect).toBeGreaterThan((ROOM.maxX - ROOM.minX) / 2);    // e a largura
    expect(poseYaw(p)).toBeCloseTo(0, 2);                                                    // "para cima" anda para o norte (−z)
    // tela em pé (celular): a câmera sobe para caber a largura
    expect(plantaHeight(0.5, p.fov!)).toBeGreaterThan(plantaHeight(16 / 9, p.fov!));
  });

  it("casa de bonecas: de fora e de cima, pedindo as paredes baixas (a planta também)", () => {
    const p = viewPose("casa", ctx)!;
    expect(inside(p.position)).toBe(false);
    expect(p.position.y).toBeGreaterThan(ROOM.height);
    expect(wallsFor("casa", "inteiras")).toBe("baixas");
    expect(wallsFor("planta", "recortadas")).toBe("baixas");
    expect(wallsFor("teto-cama", "inteiras")).toBe("inteiras");
  });

  it("o que o espelho vê: sai do vidro para fora e, andando, olha para o personagem", () => {
    const p = viewPose("espelho", { ...ctx, actor: { x: 2.6, z: 2.4 } })!;
    const out = new THREE.Vector3(p.position.x - ctx.mirror.x, 0, p.position.z - ctx.mirror.z);
    expect(out.dot(MIRROR_NORMAL)).toBeGreaterThan(0.2);                  // na frente do vidro
    expect(Math.hypot(p.target.x - 2.6, p.target.z - 2.4)).toBeLessThan(1e-6);
  });

  it("primeira pessoa: só com o personagem (cabeça e para onde olha); a lente fica à frente do rosto e inclinar olha para cima", () => {
    expect(viewPose("primeira-pessoa", ctx)).toBeNull();
    const head = { x: 0, y: 1.55, z: 2 };
    const level = viewPose("primeira-pessoa", { ...ctx, head, facing: 0 })!, up = viewPose("primeira-pessoa", { ...ctx, head, facing: 0, pitch: 0.4 })!;
    expect(level.position.z).toBeGreaterThan(head.z + 0.1);              // olha para +z (a frente do modelo): a lente vai à frente
    expect(level.target.z).toBeGreaterThan(level.position.z);
    expect(up.target.y).toBeGreaterThan(level.target.y);
  });

  it("cinematográfica: gira com o tempo por dentro das paredes; com movimento reduzido fica parada", () => {
    const a = viewPose("cinema", { ...ctx, time: 0 })!, b = viewPose("cinema", { ...ctx, time: 15 })!;
    expect(a.position.distanceTo(b.position)).toBeGreaterThan(1);
    for (const p of [a, b]) expect(inside(p.position)).toBe(true);
    const s1 = viewPose("cinema", { ...ctx, time: 0, still: true })!, s2 = viewPose("cinema", { ...ctx, time: 15, still: true })!;
    expect(s1.position.distanceTo(s2.position)).toBeLessThan(1e-9);
  });

  it("V passa pelas vistas em ordem (e volta ao começo); sem andar, pula a primeira pessoa; Q/E nos cantos passam ao vizinho", () => {
    const walking = availableViews(true).map((v) => v.id), orbit = availableViews(false).map((v) => v.id);
    expect(orbit).not.toContain("primeira-pessoa"); expect(walking).toContain("primeira-pessoa");
    expect(nextView("livre", 1, false)).toBe(orbit[1]);
    expect(nextView(orbit[0], -1, false)).toBe(orbit[orbit.length - 1]);
    let v: CameraViewId = "espelho"; const seen = new Set<CameraViewId>();
    for (let i = 0; i < orbit.length; i++) { v = nextView(v, 1, false); seen.add(v); }
    expect(seen.size).toBe(orbit.length);
    expect(nextCorner("teto-arara", 1)).toBe("teto-porta"); expect(nextCorner("teto-porta", -1)).toBe("teto-arara");
  });
});
