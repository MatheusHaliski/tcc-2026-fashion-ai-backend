"use client";
/**
 * ACERVO — uma peça na cena 3D com a forma dela (roupa-formas.tsx): pendurada no cabide como a silhueta da foto,
 * dobrada como um bloco macio com o tecido por cima, calçado como o par de perfil. Sem foto usável (sem foto, enquanto
 * carrega, fundo que não saiu) a silhueta é a da categoria, na cor da peça. A peça-fantasma da simulação de compra
 * nunca leva foto.
 */
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { COR_LIMA } from "@/lib/acervo/cena/materiais";
import { recorteUsavel, type Recorte } from "@/lib/acervo/cena/silhueta";
import type { RoupaNaCena } from "@/lib/acervo/cena/roupas";
import { Calcado, Dobrada, Pendurada } from "./roupa-formas";
import { useFotoDaPeca } from "./use-foto-da-peca";

interface Props {
  roupa: RoupaNaCena;
  pendurada: boolean;
  interativa: boolean;
  onPeca: (pieceId: string) => void;
  onCarregar: (pieceId: string | null) => void;
}

function useMaterialBase(roupa: RoupaNaCena): THREE.Material {
  const material = useMemo(() => (roupa.fantasma
    ? new THREE.MeshStandardMaterial({ color: COR_LIMA, roughness: 0.85, transparent: true, opacity: 0.45, emissive: COR_LIMA, emissiveIntensity: 0.5 })
    : new THREE.MeshStandardMaterial({ color: roupa.cor, roughness: 0.85, side: THREE.DoubleSide })), [roupa.fantasma, roupa.cor]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

export function Roupa3D({ roupa, pendurada, interativa, onPeca, onCarregar }: Props) {
  const foto = useFotoDaPeca(roupa.fantasma ? null : roupa.foto);
  const base = useMaterialBase(roupa);
  const recorte = foto?.userData.recorte as Recorte | null | undefined;
  const usavel = foto && recorteUsavel(recorte) ? recorte : null;
  const clicavel = !roupa.fantasma && interativa;
  const eventos = clicavel ? {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPeca(roupa.id); },
    onPointerDown: () => onCarregar(roupa.id),
  } : {};
  const props = { nome: `${roupa.fantasma ? "fantasma" : "roupa"}-${roupa.id}`, roupa, base, foto: usavel ? foto : null, recorte: usavel, eventos };
  return (
    <group position={roupa.pos}>
      {pendurada ? <Pendurada {...props} /> : roupa.categoria === "shoes_piece" ? <Calcado {...props} /> : <Dobrada {...props} />}
    </group>
  );
}
