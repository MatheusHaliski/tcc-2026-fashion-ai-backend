import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ESCALA_DO_REFLETOR, SALA_PERSONAGEM_FILME } from "@/lib/flair/nucleos/scene/salas/personagem-filme";

/**
 * Auditoria dos jogos, PF-2: o refletor do set tapava um terço do quadro do preparo. O objeto licenciado é um canhão
 * de chão largo; ajustado à altura do refletor de tripé ficava com 2 m de largura. Aqui se mede o arquivo de verdade.
 */
interface No { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number; children?: number[] }
interface Gltf { scenes: { nodes: number[] }[]; nodes: No[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[]; accessors: { min: number[]; max: number[] }[] }

/** A caixa do objeto GLB no espaço da cena dele (as matrizes dos nós aplicadas). */
function caixaDoGlb(arquivo: string): THREE.Box3 {
  const bytes = readFileSync(arquivo);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as Gltf;
  const caixa = new THREE.Box3();
  const andar = (i: number, pai: THREE.Matrix4) => {
    const n = gltf.nodes[i];
    const m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
    const mundo = pai.clone().multiply(m);
    if (n.mesh !== undefined) {
      for (const p of gltf.meshes[n.mesh].primitives) {
        const a = gltf.accessors[p.attributes.POSITION];
        caixa.union(new THREE.Box3(new THREE.Vector3(...a.min), new THREE.Vector3(...a.max)).applyMatrix4(mundo));
      }
    }
    (n.children ?? []).forEach((c) => andar(c, mundo));
  };
  gltf.scenes[0].nodes.forEach((n) => andar(n, new THREE.Matrix4()));
  return caixa;
}

describe("set do Personagem de Filme", () => {
  const refletores = SALA_PERSONAGEM_FILME.moveis.filter((m) => m.tipo === "refletor");

  it("os dois refletores usam o objeto licenciado com escala fixa", () => {
    expect(refletores).toHaveLength(2);
    for (const r of refletores) expect(r.glb).toEqual({ slug: "refletor", escala: ESCALA_DO_REFLETOR });
  });

  it("o refletor fica do tamanho de um canhão de chão: menos de 1 m de altura e de largura", () => {
    const tamanho = caixaDoGlb(join(process.cwd(), "public/flair/3d/assets/refletor.glb")).getSize(new THREE.Vector3());
    // ajustado à altura do refletor de tripé (cerca de 2 m), o objeto passava de 1,5 m de largura
    expect((tamanho.x / tamanho.y) * 2).toBeGreaterThan(1.5);
    expect(tamanho.y * ESCALA_DO_REFLETOR).toBeLessThan(1);
    expect(Math.max(tamanho.x, tamanho.z) * ESCALA_DO_REFLETOR).toBeLessThan(1);
    expect(tamanho.y * ESCALA_DO_REFLETOR).toBeGreaterThan(0.5);
  });

  it("nenhum refletor fica entre a câmera do preparo e o avatar", () => {
    // a câmera do preparo (três quartos) fica na frente do avatar, em z positivo; os refletores ficam atrás da linha dele
    for (const r of refletores) {
      expect(r.pos[2]).toBeLessThan(0);
      expect(Math.abs(r.pos[0])).toBeGreaterThan(3);
    }
  });
});
