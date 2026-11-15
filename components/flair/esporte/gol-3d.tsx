"use client";
/**
 * O gol do futebol de 5: duas traves, travessão, a rede com profundidade (teto, laterais e o fundo) e o fundo da rede
 * como uma grade que balança quando a bola entra (lib/flair/esporte/rede.ts). A rede é desenhada em linhas, como uma
 * rede de verdade, e nunca cobre o jogador: ela fica atrás da linha do gol.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avancar, bater, COLUNAS, estufar, LINHAS, redeParada } from "@/lib/flair/esporte/rede";

export const LARGURA_DO_GOL = 3;
export const ALTURA_DO_GOL = 2;
export const FUNDO_DO_GOL = 1.1;
const TRAVE = "#F4F7F2";

/** Linhas da grade do fundo da rede, no espaço do gol (x para o fundo, y para cima, z na largura). */
function linhasDaGrade(desloca: Float32Array, posicoes: Float32Array): void {
  let k = 0;
  const ponto = (i: number, j: number) => {
    const z = (i / (COLUNAS - 1) - 0.5) * LARGURA_DO_GOL;
    const y = (j / (LINHAS - 1)) * ALTURA_DO_GOL;
    // a rede presa nas bordas não sai do lugar: o deslocamento some perto do contorno
    const preso = Math.sin((Math.PI * i) / (COLUNAS - 1)) * Math.sin((Math.PI * Math.max(j, 0.5)) / (LINHAS - 1));
    return [FUNDO_DO_GOL + desloca[j * COLUNAS + i] * Math.max(0, preso), y, z];
  };
  for (let j = 0; j < LINHAS; j++) {
    for (let i = 0; i < COLUNAS - 1; i++) {
      for (const p of [ponto(i, j), ponto(i + 1, j)]) posicoes.set(p, (k++) * 3);
    }
  }
  for (let i = 0; i < COLUNAS; i++) {
    for (let j = 0; j < LINHAS - 1; j++) {
      for (const p of [ponto(i, j), ponto(i, j + 1)]) posicoes.set(p, (k++) * 3);
    }
  }
}

export interface Batida {
  /** o gol da direita (+1, onde a pessoa marca) ou da esquerda (−1) */
  lado: 1 | -1;
  u: number;
  v: number;
  chave: number;
}

const SEGMENTOS = LINHAS * (COLUNAS - 1) + COLUNAS * (LINHAS - 1);

interface Props {
  /** x da linha do gol, em metros; lado = para onde fica o fundo (+1 à direita, −1 à esquerda) */
  x: number;
  lado: 1 | -1;
  /** lida a cada quadro: a bola na rede deste gol ([u, v] do impacto e um número que muda a cada batida), ou null */
  batida: () => Batida | null;
  reduzido: boolean;
  nome: string;
}

export function Gol3D({ x, lado, batida, reduzido, nome }: Props) {
  const rede = useMemo(() => redeParada(), []);
  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SEGMENTOS * 2 * 3), 3));
    return g;
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: TRAVE, transparent: true, opacity: 0.55 }), []);
  const vista = useRef<number | null>(null);
  useEffect(() => () => {
    geometria.dispose();
    material.dispose();
  }, [geometria, material]);

  useFrame((_, dt) => {
    const b = batida();
    // só a bola que entra neste gol mexe nesta rede
    if (b && b.lado === lado && vista.current !== b.chave) {
      vista.current = b.chave;
      if (reduzido) estufar(rede, b.u, b.v);
      else bater(rede, b.u, b.v);
    }
    if (!reduzido) avancar(rede, dt);
    const attr = geometria.getAttribute("position") as THREE.BufferAttribute;
    linhasDaGrade(rede.desloca, attr.array as Float32Array);
    attr.needsUpdate = true;
  });

  const m = LARGURA_DO_GOL / 2;
  return (
    <group name={nome} position={[x, 0, 0]} scale={[lado, 1, 1]}>
      {[-m, m].map((z) => (
        <mesh key={z} position={[0, ALTURA_DO_GOL / 2, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, ALTURA_DO_GOL, 12]} />
          <meshStandardMaterial color={TRAVE} roughness={0.35} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, ALTURA_DO_GOL, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, LARGURA_DO_GOL + 0.12, 12]} />
        <meshStandardMaterial color={TRAVE} roughness={0.35} metalness={0.2} />
      </mesh>
      {/* teto e laterais da rede: telas finas, presas nas traves e nos ferros do fundo */}
      <mesh position={[FUNDO_DO_GOL / 2, ALTURA_DO_GOL, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FUNDO_DO_GOL, LARGURA_DO_GOL, 6, 9]} />
        <meshBasicMaterial color={TRAVE} wireframe transparent opacity={0.35} />
      </mesh>
      {[-m, m].map((z) => (
        <mesh key={`lado${z}`} position={[FUNDO_DO_GOL / 2, ALTURA_DO_GOL / 2, z]}>
          <planeGeometry args={[FUNDO_DO_GOL, ALTURA_DO_GOL, 6, 6]} />
          <meshBasicMaterial color={TRAVE} wireframe transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <lineSegments name={`${nome}-rede`} geometry={geometria} material={material} />
    </group>
  );
}
