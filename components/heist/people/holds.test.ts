import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { makeChefButtons, makeEarrings, makeFork, makeHeadphones, makeHold, makeNecklace, makePocketSquare, makeToque } from "./holds";

const meshes = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse((x) => { if ((x as THREE.Mesh).isMesh) out.push(x as THREE.Mesh); }); return out; };
const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const transmissive = (o: THREE.Object3D) => meshes(o).some((m) => ([] as THREE.Material[]).concat(m.material).some((x) => ((x as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0));

describe("objetos das pessoas (medidas reais e poucas chamadas de desenho)", () => {
  it("prato de sobremesa com bolo e garfo; bandeja com cinco taças com líquido", () => {
    const plate = makeHold("plate"), s = size(plate);
    expect(meshes(plate).length).toBe(2);                                           // prato + doce
    expect(Math.max(s.x, s.y)).toBeGreaterThan(0.16); expect(Math.max(s.x, s.y)).toBeLessThan(0.18);   // Ø 17 cm
    expect(size(makeFork()).y).toBeGreaterThan(0.13);                               // garfo de sobremesa
    const tray = makeHold("tray");
    expect(meshes(tray).length).toBe(6);                                            // bandeja, vidro, 3 líquidos, guardanapo
    expect(transmissive(tray), "vidro sem transmissão").toBe(false);
  });
  it("fone de DJ na cabeça (arco por cima do cabelo) e no pescoço; touca de chef alta; botões do dólmã numa malha", () => {
    const head = makeHeadphones(true), sh = new THREE.Box3().setFromObject(head);
    expect(meshes(head).length).toBe(1);
    expect(sh.max.y).toBeGreaterThan(0.19); expect(sh.max.x).toBeGreaterThan(0.1);  // acima do crânio, conchas fora das orelhas
    expect(meshes(makeHeadphones(false)).length).toBe(1);
    const toque = makeToque({ y: 0.095, z: 0.02, rx: 0.08, rz: 0.1 });
    expect(new THREE.Box3().setFromObject(toque).max.y).toBeGreaterThan(0.3);      // ~25 cm acima da faixa
    expect(meshes(makeChefButtons([new THREE.Vector3(), new THREE.Vector3(0, 0.1, 0)])).length).toBe(1);
  });
  it("joias e lenço: no máximo duas malhas por peça e nada transmissivo", () => {
    for (const style of ["diamond", "gold", "pearl"] as const) {
      const ear = makeEarrings(style), neck = makeNecklace(style, { x: 0, y: 0, z: 0.02, rx: 0.06, rz: 0.055 });
      expect(meshes(ear).length).toBeLessThanOrEqual(2); expect(meshes(neck).length).toBeLessThanOrEqual(2);
      expect(transmissive(ear) || transmissive(neck), style).toBe(false);
      expect(size(neck).x).toBeGreaterThan(0.12);                                     // do tamanho do pescoço
    }
    expect(meshes(makePocketSquare(new THREE.Vector3())).length).toBe(1);
  });
});
