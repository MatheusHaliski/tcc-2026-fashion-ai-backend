"use client";
/**
 * Mapa de ambiente da sala high poly: o panorama que o Cycles capturou no meio da sala vira `scene.environment` (o
 * three.js o filtra com PMREM) — é o reflexo da laca, do latão e do vidro, e a luz de ambiente dos materiais PBR. Sai
 * da cena quando a sala sai (volta o ambiente que havia).
 */
import { useEffect } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function AmbienteDaSala({ url, intensidade = 0.55 }: { url: string; intensidade?: number }) {
  const textura = useLoader(THREE.TextureLoader, url);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    textura.mapping = THREE.EquirectangularReflectionMapping;
    textura.colorSpace = THREE.SRGBColorSpace;
    const antes = { ambiente: scene.environment, forca: scene.environmentIntensity };
    scene.environment = textura;
    scene.environmentIntensity = intensidade;
    return () => {
      scene.environment = antes.ambiente;
      scene.environmentIntensity = antes.forca;
    };
  }, [textura, scene, intensidade]);
  return null;
}
