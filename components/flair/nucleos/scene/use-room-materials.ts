/**
 * Materiais da sala: um material three.js por material descrito, com a textura procedural (cor e relevo), a
 * rugosidade e o metal de cada acabamento. Vidro e rede são transparentes; céu não recebe luz; a luz acesa emite.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { loadTexture } from "@/components/three/common";
import type { MaterialDesc, Sala } from "@/lib/flair/nucleos/scene/types";
import { RELEVO, texturaDoMaterial } from "@/components/flair/nucleos/scene/textures";

export type MateriaisDaSala = Record<string, THREE.Material>;

function materialDe(m: MaterialDesc): THREE.Material {
  const map = texturaDoMaterial(m);
  if (m.textura === "ceu") return new THREE.MeshBasicMaterial({ map, color: map ? "#FFFFFF" : m.cor, fog: false, toneMapped: false });
  const emissiva = m.emissiva ?? 0;
  const transparente = m.opacidade !== undefined;
  const mat = new THREE.MeshStandardMaterial({
    color: map ? "#FFFFFF" : m.cor,
    map,
    roughness: m.rugosidade,
    metalness: m.metal,
    emissive: emissiva > 0 ? (map ? "#FFFFFF" : m.cor) : "#000000",
    emissiveIntensity: emissiva,
    emissiveMap: emissiva > 0 ? map : null,
    transparent: transparente,
    opacity: m.opacidade ?? 1,
  });
  const relevo = RELEVO[m.textura] ?? 0;
  if (map && relevo > 0) {
    mat.bumpMap = map;
    mat.bumpScale = relevo;
  }
  if (m.textura === "rede" || m.textura === "imagem") {
    mat.alphaTest = 0.25;
    mat.side = THREE.DoubleSide;
  }
  if (transparente && m.textura === "liso") mat.depthWrite = false;
  return mat;
}

/** O material faz sombra? (vidro, rede, luz acesa e céu não) */
export function fazSombra(m: MaterialDesc | undefined): boolean {
  if (!m) return true;
  return m.opacidade === undefined && !m.emissiva && m.textura !== "ceu";
}

export function useRoomMaterials(sala: Sala): MateriaisDaSala {
  const materiais = useMemo(() => {
    const out: MateriaisDaSala = {};
    for (const [id, desc] of Object.entries(sala.materiais)) out[id] = materialDe(desc);
    return out;
  }, [sala]);

  // imagens prontas (o logo) chegam depois: a placa aparece lisa até a textura carregar
  useEffect(() => {
    let vivo = true;
    for (const [id, desc] of Object.entries(sala.materiais)) {
      if (desc.textura !== "imagem" || !desc.url) continue;
      void loadTexture(desc.url).then((t) => {
        const mat = materiais[id] as THREE.MeshStandardMaterial;
        if (!vivo || !t) return;
        mat.map = t;
        mat.needsUpdate = true;
      });
    }
    return () => {
      vivo = false;
    };
  }, [sala, materiais]);

  useEffect(
    () => () => {
      for (const mat of Object.values(materiais)) {
        const padrao = mat as THREE.MeshStandardMaterial;
        // a imagem do logo fica no cache de texturas; só as desenhadas aqui são descartadas
        if (padrao.map instanceof THREE.CanvasTexture) padrao.map.dispose();
        mat.dispose();
      }
    },
    [materiais],
  );
  return materiais;
}
