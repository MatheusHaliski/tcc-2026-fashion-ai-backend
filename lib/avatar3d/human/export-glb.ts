/*
 * Avatar 3D (RF40) — exportação em GLB (glTF 2.0 binário): o corpo com o esqueleto humanoide (nomes do Mixamo, pose de
 * repouso com rotações identidade), pele com o rosto da foto, olhos, cabelo e as roupas vestidas (todas presas ao mesmo
 * esqueleto), mais a animação "idle" (respiração e troca de apoio). Só exporta o avatar vestido. Abre no Blender, Unity, Unreal, three.js e
 * visualizadores de glTF; animações do Mixamo podem ser reaproveitadas pelo nome dos ossos.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { clipEyeGeometryForExport, type Human } from "./three-human";
import { applyIdle, idleClip, type PoseState } from "./pose";

/** Código do erro quando o avatar ainda não está vestido (a tela traduz). */
export const AVATAR_NOT_DRESSED = "AVATAR_NOT_DRESSED";

/**
 * `opts.hair`: o cabelo em cena (`live`) e quem monta o cabelo do arquivo (`build`, nível 2 — cards, hair-lod.ts).
 * Durante a exportação o cabelo em cena fica oculto e o de cards entra no lugar; depois tudo volta como estava.
 */
export async function exportAvatarGlb(human: Human, pose: PoseState, opts: { animation?: boolean; hair?: { live: THREE.Object3D | null; build?: () => THREE.SkinnedMesh | null } } = {}): Promise<Blob> {
  // nunca exporta o corpo sem roupa: só com tronco, pernas e pés cobertos (HumanOutfit marca root.userData.dressed)
  if (human.root.userData.dressed !== true || !human.root.visible) throw new Error(AVATAR_NOT_DRESSED);
  const clips: THREE.AnimationClip[] = [];
  if (opts.animation !== false) clips.push(idleClip(human, pose));
  applyIdle(human, pose, 0, 0);                              // o arquivo guarda a pose de exibição como pose inicial
  const live = opts.hair?.live ?? null; const wasVisible = live?.visible ?? false;
  // a córnea é só reflexo em cena (mistura aditiva, que o glTF não tem): fica fora do arquivo; o globo já tem verniz
  const corneaVisible = human.cornea.visible, tearVisible = human.tearLines.visible; human.cornea.visible = false; human.tearLines.visible = false;
  const fileHair = opts.hair?.build?.() ?? null;            // já preso ao esqueleto (HumanParts.exportHair)
  if (fileHair && live) live.visible = false;
  fileHair?.geometry.deleteAttribute("hairS");                // só do movimento em cena (hair-motion.ts), não vai para o arquivo
  // sem a córnea no arquivo, o globo leva o verniz (em cena ele é fosco e o brilho é o da córnea)
  const eyeMat = human.eyes.material as THREE.MeshPhysicalMaterial; const eyeCoat = [eyeMat.clearcoat, eyeMat.clearcoatRoughness] as const;
  eyeMat.clearcoat = 1; eyeMat.clearcoatRoughness = 0.08;
  const eyeGeometry = human.eyes.geometry;
  let clippedEyeGeometry: THREE.BufferGeometry | null = null;
  try {
    // glTF does not carry the live eyelid shader: bake the measured opening into export-only geometry.
    clippedEyeGeometry = clipEyeGeometryForExport(human);
    if (clippedEyeGeometry) human.eyes.geometry = clippedEyeGeometry;
    human.root.updateMatrixWorld(true);
    const exporter = new GLTFExporter();
    const out = await exporter.parseAsync(human.root, { binary: true, animations: clips, onlyVisible: true, maxTextureSize: 2048 });
    return new Blob([out as ArrayBuffer], { type: "model/gltf-binary" });
  } finally {
    human.eyes.geometry = eyeGeometry; clippedEyeGeometry?.dispose();
    if (fileHair) {
      fileHair.removeFromParent(); fileHair.geometry.dispose();
      for (const m of ([] as THREE.Material[]).concat(fileHair.material)) { (m as THREE.MeshPhysicalMaterial).map?.dispose(); m.dispose(); }
    }
    if (live) live.visible = wasVisible;
    eyeMat.clearcoat = eyeCoat[0]; eyeMat.clearcoatRoughness = eyeCoat[1];
    human.cornea.visible = corneaVisible; human.tearLines.visible = tearVisible;
  }
}

/** Baixa o arquivo no navegador. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
