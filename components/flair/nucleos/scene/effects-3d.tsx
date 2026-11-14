"use client";
/**
 * Dois elementos da cena que não são da sala: a luz de efeito da cor da peça (acende atrás do avatar e desenha um halo
 * no piso, na cor da família, quando uma carta com cor é vestida) e a peça pintada dos modos do Ateliê (cada zona
 * escolhida vira uma faixa no manequim, com a cor e o acabamento dela, na hora). Nada fica na frente da roupa: a luz e
 * o halo ficam atrás e no piso, e a peça pintada fica no manequim, ao lado do avatar.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { estadoDoAtor, useCena } from "@/components/flair/nucleos/scene/stage-context";
import { LUZ_DE_EFEITO } from "@/lib/flair/nucleos/scene/sequences-color";
import type { V3, ZonaEscolha } from "@/lib/flair/nucleos/types";

const SEM_LUGAR = { x: 0, z: 0, giro: 0 };
/** Onde a luz de efeito fica: atrás do avatar, à altura do tronco. */
export const POSICAO_DA_LUZ_DE_EFEITO: V3 = [0, 1.5, -1.3];
const INTENSIDADE = 34;

/** `altura`: a altura do piso do avatar (o tablado, a passarela). */
export function LuzDeEfeito({ altura = 0 }: { altura?: number }) {
  const cena = useCena();
  const luz = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame(() => {
    const v = Math.max(0, Math.min(1, estadoDoAtor(cena, `luz:${LUZ_DE_EFEITO}`, SEM_LUGAR).amostra["luz.v"] ?? 0));
    const cor = cena.efeito?.cor ?? "#ffffff";
    if (luz.current) {
      luz.current.color.set(cor);
      luz.current.intensity = INTENSIDADE * v;
    }
    if (halo.current) {
      material.color.set(cor);
      material.opacity = 0.55 * v;
      halo.current.visible = v > 0.01;
    }
  });
  const [x, y, z] = POSICAO_DA_LUZ_DE_EFEITO;
  return (
    <group name="efeito-da-cor">
      <pointLight ref={luz} name="luz-efeito" position={[x, y + altura, z]} intensity={0} distance={7} />
      <mesh ref={halo} name="halo-efeito" position={[x, altura + 0.012, z + 0.35]} rotation={[-Math.PI / 2, 0, 0]} material={material} visible={false}>
        <ringGeometry args={[0.55, 0.95, 40]} />
      </mesh>
    </group>
  );
}

/** Brilho e metal de cada acabamento do editor. */
export const ACABAMENTO_3D: Record<string, { roughness: number; metalness: number }> = {
  FOSCO: { roughness: 0.9, metalness: 0 },
  BRILHANTE: { roughness: 0.25, metalness: 0.05 },
  METALICO: { roughness: 0.35, metalness: 0.85 },
  ESPELHADO: { roughness: 0.05, metalness: 1 },
};

/** O tronco do busto de costura vai de 0,93 m a 1,5 m: as faixas das zonas dividem essa altura, de cima para baixo. */
const BASE = 0.93;
const TOPO = 1.5;

export interface FaixaDaZona {
  zona: string;
  y: number;
  altura: number;
  cor: string;
  acabamento: string;
}

/** As faixas da peça pintada: uma por zona da rodada, na ordem delas; zona ainda sem cor não aparece. */
export function faixasDasZonas(zonas: string[], escolhas: Record<string, ZonaEscolha>): FaixaDaZona[] {
  const altura = zonas.length ? (TOPO - BASE) / zonas.length : 0;
  return zonas.flatMap((zona, i) => {
    const escolha = escolhas[zona];
    if (!escolha?.cor) return [];
    return [{ zona, y: TOPO - altura * (i + 0.5), altura, cor: escolha.cor, acabamento: escolha.acabamento ?? "FOSCO" }];
  });
}

interface PecaProps {
  /** onde está o manequim (o ator "fig:MANEQUIM:0" gira devagar: a peça gira junto) */
  pos: V3;
  zonas: string[];
  escolhas: Record<string, ZonaEscolha>;
}

export function PecaPintada({ pos, zonas, escolhas }: PecaProps) {
  const cena = useCena();
  const grupo = useRef<THREE.Group>(null);
  const faixas = faixasDasZonas(zonas, escolhas);
  useFrame(() => {
    if (!grupo.current) return;
    const giro = estadoDoAtor(cena, "fig:MANEQUIM:0", SEM_LUGAR).amostra["raiz.ry"] ?? 0;
    grupo.current.rotation.y = (giro * Math.PI) / 180;
  });
  return (
    <group ref={grupo} name="peca-pintada" position={pos}>
      {faixas.map((f) => (
        <mesh key={f.zona} name={`zona-${f.zona}`} position={[0, f.y, 0]} castShadow>
          <cylinderGeometry args={[0.225, 0.225, f.altura * 0.94, 20, 1, true]} />
          <meshStandardMaterial color={f.cor} side={THREE.DoubleSide} {...(ACABAMENTO_3D[f.acabamento] ?? ACABAMENTO_3D.FOSCO)} />
        </mesh>
      ))}
    </group>
  );
}
