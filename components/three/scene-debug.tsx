"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyTestPose, type TestPose } from "@/lib/avatar3d/human/pose";

/*
 * Depuração do vestir (laboratório e auditoria — PROVADOR-3D): prova que a roupa é geometria que envolve o corpo.
 *  - "wire": a malha das peças em wireframe (frente, costas e laterais);
 *  - "sem-corpo": o corpo, os olhos e o cabelo ocultos — só as peças ficam (um volume fechado, não uma pintura);
 *  - "pesos": cada vértice da peça na cor do osso que mais a move (skinning herdado do corpo);
 *  - pose: braços erguidos, caminhada (animada) ou agachamento, aplicada depois do movimento parado do avatar.
 * Nada aqui roda no produto: só quando a cena recebe `debug`.
 */
export type DebugView = "normal" | "wire" | "sem-corpo" | "pesos";
export interface SceneDebugOptions { view?: DebugView; pose?: TestPose | "caminhada-animada" | null }

const BODY_PARTS = new Set(["corpo", "olhos", "córnea"]);
const boneColor = (i: number) => new THREE.Color().setHSL(((i * 47) % 360) / 360, 0.75, 0.55);

export function SceneDebug({ parts, options }: { parts: HumanParts | null; options: SceneDebugOptions }) {
  const applied = useRef(new WeakMap<THREE.Object3D, string>());
  useFrame(({ clock }) => {
    if (!parts) return;
    const { human, pose } = parts;
    if (options.pose) applyTestPose(human, pose, options.pose === "caminhada-animada" ? "caminhada" : options.pose, options.pose === "caminhada-animada" ? (clock.elapsedTime * 0.8) % 1 : 0.25);
    const view = options.view ?? "normal";
    human.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
      const isBody = BODY_PARTS.has(m.name) || /cabelo|hair/i.test(m.name) || o.parent?.name === "linha-dagua";
      if (isBody) { m.visible = view !== "sem-corpo" && view !== "pesos"; return; }
      if (applied.current.get(m) === view) return;
      applied.current.set(m, view);
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      if (view === "pesos") {
        const g = m.geometry; const si = g.getAttribute("skinIndex"), sw = g.getAttribute("skinWeight"); if (!si || !sw) return;
        const col = new Float32Array(si.count * 4); const prev = g.getAttribute("color");
        for (let v = 0; v < si.count; v++) {
          let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
          const c = boneColor(best); col.set([c.r, c.g, c.b, prev && prev.itemSize === 4 ? prev.getW(v) : 1], v * 4);
        }
        g.setAttribute("debugColor", new THREE.BufferAttribute(col, 4));
        m.userData.debugMaterial ??= m.material;
        m.material = new THREE.MeshBasicMaterial({ vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
        g.setAttribute("color", g.getAttribute("debugColor"));
      } else {
        for (const mat of mats) if ("wireframe" in mat) mat.wireframe = view === "wire";
      }
    });
  });
  return null;
}
