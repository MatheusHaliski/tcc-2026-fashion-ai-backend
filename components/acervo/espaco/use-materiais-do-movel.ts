"use client";
/**
 * ACERVO — materiais three.js de um móvel, feitos da descrição (lib/acervo/cena/materiais.ts). A madeira usa a textura
 * procedural das salas do FLAIR 3D; vidro e portas em Raio-X são transparentes; a luz embutida emite.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { texturaDoMaterial } from "@/components/flair/nucleos/scene/textures";
import type { MaterialDesc } from "@/lib/flair/nucleos/scene/types";
import { materiaisDoMovel } from "@/lib/acervo/cena/materiais";
import type { MaterialDaParte } from "@/lib/acervo/cena/modelo";
import type { AcervoMovel } from "@/lib/acervo/types";

export type MateriaisDoMovel = Record<MaterialDaParte, THREE.MeshStandardMaterial>;

export function materialDe(m: MaterialDesc): THREE.MeshStandardMaterial {
  const map = texturaDoMaterial(m);
  if (map && m.repete) map.repeat.set(1 / m.repete, 1 / m.repete);
  const emissiva = m.emissiva ?? 0;
  const transparente = m.opacidade !== undefined;
  return new THREE.MeshStandardMaterial({
    color: map ? "#FFFFFF" : m.cor,
    map,
    roughness: m.rugosidade,
    metalness: m.metal,
    emissive: emissiva > 0 ? m.cor : "#000000",
    emissiveIntensity: emissiva,
    transparent: transparente,
    opacity: m.opacidade ?? 1,
    depthWrite: !transparente,
  });
}

export function useMateriaisDoMovel(movel: AcervoMovel, raioX: boolean): MateriaisDoMovel {
  const { material, cor, porta, puxadorAcabamento, modo } = movel;
  const materiais = useMemo(() => {
    const descricao = materiaisDoMovel({ material, cor, porta, puxadorAcabamento, modo } as AcervoMovel, raioX);
    const out = {} as MateriaisDoMovel;
    for (const chave of Object.keys(descricao) as MaterialDaParte[]) out[chave] = materialDe(descricao[chave]);
    return out;
  }, [material, cor, porta, puxadorAcabamento, modo, raioX]);
  useEffect(() => () => {
    for (const m of Object.values(materiais)) {
      m.map?.dispose();
      m.dispose();
    }
  }, [materiais]);
  return materiais;
}
