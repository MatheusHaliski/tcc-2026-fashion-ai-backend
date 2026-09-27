/*
 * Avatar 3D (RF40) — exportação em GLB (glTF 2.0 binário): o corpo com o esqueleto humanoide (nomes do Mixamo, pose de
 * repouso com rotações identidade), pele com o rosto da foto, olhos, cabelo e as roupas vestidas (todas presas ao mesmo
 * esqueleto), mais a animação "idle" (respiração e troca de apoio). Só exporta o avatar vestido. Abre no Blender, Unity, Unreal, three.js e
 * visualizadores de glTF; animações do Mixamo podem ser reaproveitadas pelo nome dos ossos.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Human } from "./three-human";
import { applyIdle, idleClip, type PoseState } from "./pose";

/** Código do erro quando o avatar ainda não está vestido (a tela traduz). */
export const AVATAR_NOT_DRESSED = "AVATAR_NOT_DRESSED";

export async function exportAvatarGlb(human: Human, pose: PoseState, opts: { animation?: boolean } = {}): Promise<Blob> {
  // nunca exporta o corpo sem roupa: só com tronco, pernas e pés cobertos (HumanOutfit marca root.userData.dressed)
  if (human.root.userData.dressed !== true || !human.root.visible) throw new Error(AVATAR_NOT_DRESSED);
  const clips: THREE.AnimationClip[] = [];
  if (opts.animation !== false) clips.push(idleClip(human, pose));
  applyIdle(human, pose, 0, 0);                              // o arquivo guarda a pose de exibição como pose inicial
  human.root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const out = await exporter.parseAsync(human.root, { binary: true, animations: clips, onlyVisible: true, maxTextureSize: 2048 });
  return new Blob([out as ArrayBuffer], { type: "model/gltf-binary" });
}

/** Baixa o arquivo no navegador. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
