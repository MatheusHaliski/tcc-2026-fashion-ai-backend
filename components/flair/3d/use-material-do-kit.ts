"use client";
/**
 * Material do kit da mansão pronto para uma superfície (piso, parede ou teto de um cômodo): carrega os quatro mapas
 * assados no Blender (cor, normal, aspereza, oclusão), repete pela medida da superfície e devolve um
 * MeshStandardMaterial. A oclusão usa o mesmo mapa de UV da cor (o three.js lê `aoMap` no canal 0 desde a r152).
 * Suspende enquanto as texturas chegam (use dentro de <Suspense>).
 */
import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { repeticoes, type MaterialDoKit, type NivelDoKit } from "@/lib/flair/3d/kit-mansao";

export function useMaterialDoKit(material: MaterialDoKit, largura: number, altura: number, nivel: NivelDoKit = "alto"): THREE.MeshStandardMaterial {
  const m = nivel === "medio" ? material.mapasMedio : material.mapas;
  const [cor, normal, aspereza, ao] = useLoader(THREE.TextureLoader, [m.cor, m.normal, m.aspereza, m.ao]);
  const pronto = useMemo(() => {
    const [rx, ry] = repeticoes(material, largura, altura);
    const copia = (t: THREE.Texture, srgb: boolean) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rx, ry);
      c.anisotropy = 8;
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      c.needsUpdate = true;
      return c;
    };
    return new THREE.MeshStandardMaterial({
      name: `kit-${material.slug}`, map: copia(cor, true), normalMap: copia(normal, false), roughnessMap: copia(aspereza, false),
      aoMap: copia(ao, false), roughness: 1, metalness: 0, aoMapIntensity: 1,
    });
  }, [material, largura, altura, cor, normal, aspereza, ao]);
  useEffect(() => () => {
    for (const t of [pronto.map, pronto.normalMap, pronto.roughnessMap, pronto.aoMap]) t?.dispose();
    pronto.dispose();
  }, [pronto]);
  return pronto;
}
