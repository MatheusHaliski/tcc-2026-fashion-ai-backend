/** Pele debaixo da roupa de .glb: o corpo perde os triângulos cobertos, o forro os ganha, e vestir de novo devolve a pele. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import { hideSkin, showSkin } from "./outfit-skin";

/** Corpo mínimo: 4 vértices de pele, 6 de render (a costura de UV duplica dois) e 3 triângulos. */
function parts(): HumanParts {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(24), 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(24), 4));
  geometry.setIndex(new THREE.BufferAttribute(Uint16Array.from([0, 1, 2, 3, 4, 5, 0, 2, 5]), 1));
  const skeleton = new THREE.Skeleton([new THREE.Bone()]);
  const body = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); body.bind(skeleton);
  const root = new THREE.Group(); root.add(body);
  const renderVertex = Uint16Array.from([0, 1, 2, 1, 2, 3]);
  return { human: { body, root, skeleton }, asset: { body: { renderVertex } } } as unknown as HumanParts;
}

const indexOf = (g: THREE.BufferGeometry) => Array.from(g.getIndex()!.array);
const skinOf = (p: HumanParts) => indexOf(p.human.body.geometry);

describe("outfit-skin", () => {
  it("troca por forro só o triângulo com os três vértices de pele cobertos (pelo vértice do corpo, não pelo de render)", () => {
    const p = parts();
    const lining = hideSkin(p, Uint8Array.from([1, 1, 1, 0]), "#102030", 2)!;
    expect(skinOf(p)).toEqual([3, 4, 5, 0, 2, 5]);
    expect(indexOf(lining.geometry)).toEqual([0, 1, 2]);
    expect(lining.isSkinnedMesh).toBe(true);
    expect(lining.skeleton).toBe(p.human.skeleton);
    expect(lining.parent).toBe(p.human.root);
    expect(lining.geometry).not.toBe(p.human.body.geometry);          // descartar o forro não descarta o corpo
    expect((lining.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("102030");
    expect(lining.userData.buildPath).toBe("GLB_LINING");
  });

  it("soma a cobertura das peças (cada uma com o seu forro) e volta a pele inteira ao vestir de novo", () => {
    const p = parts();
    expect(hideSkin(p, Uint8Array.from([1, 1, 0, 0]), "#000000", 1)).toBeNull();   // nenhum triângulo inteiro: sem forro
    expect(skinOf(p)).toHaveLength(9);
    const second = hideSkin(p, Uint8Array.from([0, 0, 1, 1]), "#ffffff", 1);
    expect(skinOf(p)).toEqual([]);                                     // as duas juntas cobrem tudo
    expect(second).toBeNull();                                         // mas a segunda, sozinha, não fecha triângulo
    showSkin(p);
    expect(skinOf(p)).toEqual([0, 1, 2, 3, 4, 5, 0, 2, 5]);
    const third = hideSkin(p, Uint8Array.from([0, 1, 1, 1]), "#ffffff", 1)!;
    expect(skinOf(p)).toEqual([0, 1, 2, 0, 2, 5]);
    expect(indexOf(third.geometry)).toEqual([3, 4, 5]);
  });

  it("sem índice guardado, mostrar a pele não faz nada", () => {
    const p = parts();
    showSkin(p);
    expect(skinOf(p)).toHaveLength(9);
  });
});
