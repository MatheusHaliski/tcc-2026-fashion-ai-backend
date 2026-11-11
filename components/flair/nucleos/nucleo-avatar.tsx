"use client";
/**
 * Avatar da pessoa na cena do núcleo (o manequim de components/three/mannequin.tsx, sem rosto de ninguém) e as ações
 * simples: girar, posar (meia-volta e um leve balanço), desfilar (vai até o fim da passarela e volta). Com "reduzir
 * movimento", cada ação chega ao estado final de uma vez, sem animação.
 */
import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { Look3dPiece, Mannequin3d } from "@/components/three/common";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";

const MANEQUIM: Mannequin3d = { sex: "FEMININO", head: "PADRAO" };
const DESFILE_Z = 1.6;
const POSE_S = 1.2;

/** Silhueta simples (cápsula e cabeça lisa) — também é o avatar enquanto o corpo 3D carrega. */
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

export function NucleoAvatar({ estado, pecas, reduzido, desfile }: { estado: AvatarEstado; pecas: Look3dPiece[]; reduzido: boolean; desfile: boolean }) {
  const g = useRef<THREE.Group>(null);
  const pose = useRef({ visto: estado.poses, inicio: -1 });
  useFrame(({ clock }, dt) => {
    const o = g.current;
    if (!o) return;
    const agora = clock.elapsedTime;
    if (pose.current.visto !== estado.poses) {
      pose.current = { visto: estado.poses, inicio: agora };
    }
    const t = pose.current.inicio < 0 ? 1 : Math.min(1, (agora - pose.current.inicio) / POSE_S);
    const posando = t < 1 && !reduzido;
    const giroAlvo = THREE.MathUtils.degToRad(estado.giro + (posando ? 35 * Math.sin(Math.PI * t) : 0));
    const zAlvo = desfile && estado.desfilando ? DESFILE_Z : 0;
    const k = reduzido ? 1 : 1 - Math.exp(-dt * 6);
    o.rotation.y += (giroAlvo - o.rotation.y) * k;
    o.position.z += (zAlvo - o.position.z) * (reduzido ? 1 : 1 - Math.exp(-dt * 1.5));
    o.position.y = posando ? 0.03 * Math.sin(Math.PI * t) : 0;
  });
  return (
    <group ref={g} name="nucleo-avatar">
      <Suspense fallback={<Silhueta cor="#ECE6DC" />}>
        <Mannequin mannequin={MANEQUIM} pieces={pecas} still={reduzido} fallback={<Silhueta cor="#ECE6DC" />} />
      </Suspense>
    </group>
  );
}
