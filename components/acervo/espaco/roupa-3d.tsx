"use client";
/**
 * ACERVO — uma peça na cena 3D: a forma procedural na cor da peça e, quando a peça tem foto, a foto nas faces grandes
 * (laterais da pendurada, tampo da dobrada, tampo e laterais do calçado). Sem foto, ou enquanto ela carrega, fica o
 * bloco colorido. A peça-fantasma da simulação de compra nunca leva foto.
 */
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { COR_LIMA } from "@/lib/acervo/cena/materiais";
import { facesComFoto } from "@/lib/acervo/cena/fotos";
import type { RoupaNaCena } from "@/lib/acervo/cena/roupas";
import { useFotoDaPeca } from "./use-foto-da-peca";

interface Props {
  roupa: RoupaNaCena;
  pendurada: boolean;
  interativa: boolean;
  onPeca: (pieceId: string) => void;
  onCarregar: (pieceId: string | null) => void;
}

function useMateriais(roupa: RoupaNaCena, pendurada: boolean, foto: THREE.Texture | null): THREE.Material | THREE.Material[] {
  const materiais = useMemo(() => {
    if (roupa.fantasma) {
      return new THREE.MeshStandardMaterial({ color: COR_LIMA, roughness: 0.85, transparent: true, opacity: 0.45, emissive: COR_LIMA, emissiveIntensity: 0.5 });
    }
    const cor = new THREE.MeshStandardMaterial({ color: roupa.cor, roughness: 0.85 });
    if (!foto) return cor;
    const comFoto = new THREE.MeshStandardMaterial({ color: "#FFFFFF", map: foto, roughness: 0.8 });
    const forma = pendurada ? "pendurada" : roupa.categoria === "shoes_piece" ? "calcado" : "dobrada";
    return facesComFoto(forma).map((usa) => (usa ? comFoto : cor));
  }, [roupa.fantasma, roupa.cor, roupa.categoria, pendurada, foto]);
  useEffect(() => () => {
    // a textura é da lista de fotos (lib/acervo/cena/fotos.ts), que a descarta; aqui saem só os materiais
    for (const m of new Set(Array.isArray(materiais) ? materiais : [materiais])) m.dispose();
  }, [materiais]);
  return materiais;
}

export function Roupa3D({ roupa, pendurada, interativa, onPeca, onCarregar }: Props) {
  const foto = useFotoDaPeca(roupa.fantasma ? null : roupa.foto);
  const material = useMateriais(roupa, pendurada, foto);
  const clicavel = !roupa.fantasma && interativa;
  return (
    <mesh name={`${roupa.fantasma ? "fantasma" : "roupa"}-${roupa.id}`} position={roupa.pos} castShadow={!roupa.fantasma} material={material}
      userData={{ comFoto: !!foto }}
      onClick={clicavel ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPeca(roupa.id); } : undefined}
      onPointerDown={clicavel ? () => onCarregar(roupa.id) : undefined}>
      <boxGeometry args={roupa.tam} />
    </mesh>
  );
}
