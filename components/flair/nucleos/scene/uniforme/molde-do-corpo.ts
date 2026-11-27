/**
 * Onde o uniforme encosta no corpo (uniforme-no-corpo.tsx): lê a superfície da roupa pintada (ou do corpo, sem ela) na
 * pose de repouso, no espaço da malha, e leva o que for construído ali para o espaço de um osso do esqueleto. Assim a
 * estampa abraça o peito, a gola contorna o decote e o capacete cobre a cabeça de qualquer corpo, e tudo acompanha o
 * osso quando a personagem anda. Lê a geometria; não muda nada nela.
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";

/** Os pontos da superfície em repouso (x, y, z em sequência) e onde fica cada osso. */
export interface MoldeDoCorpo {
  pontos: Float32Array;
  /** o osso na pose de repouso, no espaço da malha */
  osso: (nome: string) => THREE.Vector3;
  /** do espaço da malha para o espaço do osso (o que se constrói na malha e se pendura no osso) */
  paraOsso: (nome: string) => THREE.Matrix4;
}

const _m = new THREE.Matrix4();

/** O molde a partir das malhas da roupa pintada (nome peca-pintada-*) ou, sem elas, do corpo em repouso. */
export function moldeDoCorpo(h: HumanParts, prefixo: string): MoldeDoCorpo {
  const malhas: THREE.SkinnedMesh[] = [];
  h.human.root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name.startsWith(`peca-${prefixo}`)) malhas.push(o as THREE.SkinnedMesh);
  });
  const partes = malhas.map((m) => m.geometry.getAttribute("position").array as Float32Array);
  const total = partes.reduce((n, p) => n + p.length, 0);
  const pontos = total ? new Float32Array(total) : h.human.rest.body;
  let o = 0;
  for (const p of partes) {
    pontos.set(p, o);
    o += p.length;
  }
  const corpo = h.human.body;
  const esqueleto = h.human.skeleton;
  const bind = (nome: string) => {
    // os nomes do esqueleto passam por bone() (o asset pode prefixar os ossos)
    const i = esqueleto.bones.indexOf(h.human.bone(nome));
    return _m.copy(esqueleto.boneInverses[Math.max(0, i)]).invert().clone();
  };
  return {
    pontos,
    osso: (nome) => new THREE.Vector3().setFromMatrixPosition(corpo.bindMatrixInverse.clone().multiply(bind(nome))),
    paraOsso: (nome) => bind(nome).invert().multiply(corpo.bindMatrix),
  };
}

/**
 * A profundidade da superfície no ponto (x, y): a frente (maior z) ou as costas (menor z) entre os pontos a menos de
 * `raio` dele; sem ponto perto, nula.
 */
export function profundidade(pontos: Float32Array, x: number, y: number, frente: boolean, raio = 0.018): number | null {
  let melhor: number | null = null;
  for (let i = 0; i < pontos.length; i += 3) {
    if (Math.abs(pontos[i] - x) > raio || Math.abs(pontos[i + 1] - y) > raio) continue;
    const z = pontos[i + 2];
    if (melhor === null || (frente ? z > melhor : z < melhor)) melhor = z;
  }
  return melhor;
}

/** A elipse da roupa numa altura: o centro (x, z) e os dois raios, pelos pontos a menos de `faixa` dela. */
export function elipseNaAltura(pontos: Float32Array, y: number, faixa = 0.012, largura = 0.3): { cx: number; cz: number; rx: number; rz: number } | null {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pontos.length; i += 3) {
    if (Math.abs(pontos[i + 1] - y) > faixa || Math.abs(pontos[i]) > largura) continue;
    x0 = Math.min(x0, pontos[i]);
    x1 = Math.max(x1, pontos[i]);
    z0 = Math.min(z0, pontos[i + 2]);
    z1 = Math.max(z1, pontos[i + 2]);
  }
  if (!Number.isFinite(x0)) return null;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 };
}

/** O ponto mais alto da roupa perto do centro do tronco: o decote (para a gola) e o topo da capa. */
export function alturaDoDecote(pontos: Float32Array, perto: THREE.Vector3, largura = 0.09): number {
  let topo = -Infinity;
  for (let i = 0; i < pontos.length; i += 3) {
    if (Math.abs(pontos[i] - perto.x) > largura || pontos[i + 1] > perto.y + 0.35) continue;
    topo = Math.max(topo, pontos[i + 1]);
  }
  return Number.isFinite(topo) ? topo : perto.y + 0.12;
}
