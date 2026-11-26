/**
 * O clone de uma pessoa de cena a partir do molde dela (molde-humano.tsx): geometria e materiais do molde, esqueleto
 * próprio (SkeletonUtils), as malhas de acabamento separadas para o nível de detalhe e o estado da locomoção. Saiu de
 * elenco-3d.tsx, que anima e escolhe o nível de detalhe de cada clone.
 */
import * as THREE from "three";
import { clone as clonarComOssos } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Molde } from "@/components/flair/nucleos/gente/molde-humano";
import { cloneRig, newMotionState, type MotionState, type Rig } from "@/lib/avatar3d/human/locomotion";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import type { NivelDeDetalhe } from "@/lib/flair/nucleos/gente/detalhe";

export interface Clone {
  /** o molde de que o clone saiu: muda quando a pessoa troca de roupa */
  chave: string;
  grupo: THREE.Group;
  /** o corpo completo; no nível LONGE ele some e a pessoa aparece na multidão leve */
  raiz: THREE.Object3D;
  rig: Rig;
  st: MotionState;
  malhas: THREE.Mesh[];
  detalhes: THREE.Object3D[];
  nivel: NivelDeDetalhe | null;
  sombra: boolean | null;
  quadro: number;
  acumulado: number;
  anim: Motion;
  desde: number;
}

/** acabamentos de poucos pixels: saem no nível leve (mesmos nomes de malha do corpo humano) */
const DETALHE = /^(córnea|linha-dagua|pelos-sobrancelhas|barra-|punho-|costura-|botoes-|gola-ponta-|cadarco-|colarinho-)/;

export function clonar(m: Molde, id: string, semente: number): Clone {
  const raiz = clonarComOssos(m.raiz);
  let corpo: THREE.SkinnedMesh | null = null;
  raiz.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && s.name === "corpo") corpo = s;
  });
  const malhas: THREE.Mesh[] = [];
  const detalhes: THREE.Object3D[] = [];
  raiz.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && corpo && s !== corpo) s.bind((corpo as THREE.SkinnedMesh).skeleton, s.bindMatrix);
    if ((o as THREE.Mesh).isMesh) {
      o.frustumCulled = false;
      malhas.push(o as THREE.Mesh);
    }
    if (o !== raiz && DETALHE.test(o.name)) detalhes.push(o);
  });
  raiz.visible = true;
  const grupo = new THREE.Group();
  grupo.name = `pessoa-${id}`;
  grupo.add(raiz);
  const rig = cloneRig(m.rig, raiz);
  return { chave: m.chave, grupo, raiz, rig, st: newMotionState(rig, semente, "idle"), malhas, detalhes, nivel: null, sombra: null, quadro: semente % 4, acumulado: 0, anim: "idle", desde: 0 };
}
