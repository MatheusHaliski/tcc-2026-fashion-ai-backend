"use client";
/**
 * Avatar da pessoa na cena do núcleo: o Avatar 3D do perfil ou a modelo da casa (o manequim de
 * components/three/mannequin.tsx, sem rosto de ninguém). Parado, respira (lib/avatar3d/human/pose.ts); gira pelo
 * comando da tela; e toca os clipes das sequências (poses, caminhada, luta, reação) nos ossos do esqueleto. Com
 * "reduzir movimento", cada ação chega à pose final de uma vez, sem transição.
 */
import { Suspense, useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece, Mannequin3d } from "@/components/three/common";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import { aplicarNoEsqueleto } from "@/components/flair/nucleos/scene/avatar-rig";
import { agora, aplicarNoObjeto, CenaContexto, estadoDoAtor } from "@/components/flair/nucleos/scene/stage-context";

/** Protagonista: o Avatar 3D do perfil (PROPRIO) ou a modelo da casa (manequim de vitrine, sem rosto de ninguém). */
export interface Protagonista {
  avatar: Avatar3dRef | null;
  sexo: "FEMININO" | "MASCULINO";
  corpo: BodyParams | null;
}

export const MODELO_CASA: Protagonista = { avatar: null, sexo: "FEMININO", corpo: null };
const ORIGEM = { x: 0, z: 0, giro: 0 };
const RAD = Math.PI / 180;

/** Silhueta simples (cápsula e cabeça lisa): o avatar enquanto o corpo 3D carrega. */
export function Silhueta({ cor, escala = 1 }: { cor: string; escala?: number }) {
  return (
    <group scale={escala}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.75, 6, 12]} />
        <meshStandardMaterial color={cor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color={cor} roughness={0.7} />
      </mesh>
    </group>
  );
}

interface AvatarProps {
  estado: AvatarEstado;
  pecas: Look3dPiece[];
  reduzido: boolean;
  /** mantido pelo contrato da tela: o desfile agora é uma sequência do diretor de cena */
  desfile?: boolean;
  protagonista: Protagonista;
  /** altura do piso onde o avatar fica (passarela, palco, tablado) */
  altura?: number;
}

export function NucleoAvatar({ estado, pecas, reduzido, protagonista, altura = 0 }: AvatarProps) {
  const { avatar, sexo, corpo } = protagonista;
  const manequim = useMemo<Mannequin3d>(() => ({ sex: sexo, head: avatar ? "AVATAR" : "PADRAO", avatar }), [sexo, avatar]);
  const cena = useContext(CenaContexto);
  const fora = useRef<THREE.Group>(null);
  const raiz = useRef<THREE.Group>(null);
  const humano = useRef<HumanParts | null>(null);
  const giro = useRef(estado.giro);
  const guardarHumano = (p: HumanParts) => {
    humano.current = p;
  };
  useFrame((_, dt) => {
    if (!fora.current || !raiz.current) return;
    const t = agora();
    const ator = cena ? estadoDoAtor(cena, "avatar", ORIGEM, t) : { amostra: {}, lugar: ORIGEM };
    // giro da tela: pelo caminho mais curto, suave (ou de uma vez com "reduzir movimento")
    const falta = ((estado.giro - giro.current + 540) % 360) - 180;
    giro.current += falta * (reduzido ? 1 : 1 - Math.exp(-dt * 6));
    fora.current.position.set(ator.lugar.x, altura, ator.lugar.z);
    fora.current.rotation.y = (ator.lugar.giro + giro.current) * RAD;
    aplicarNoObjeto(raiz.current, ator.amostra, "raiz");
    const h = humano.current;
    if (!h) return;
    applyIdle(h.human, h.pose, t, reduzido ? 0 : 1);
    aplicarNoEsqueleto(h.human, ator.amostra);
  });
  return (
    <group ref={fora} name="nucleo-avatar" position={[0, altura, 0]}>
      <group ref={raiz}>
        <Suspense fallback={<Silhueta cor="#ECE6DC" />}>
          <Mannequin mannequin={manequim} body={corpo} pieces={pecas} still={reduzido} externalPose
            onHuman={guardarHumano} fallback={<Silhueta cor="#ECE6DC" />} />
        </Suspense>
      </group>
    </group>
  );
}
