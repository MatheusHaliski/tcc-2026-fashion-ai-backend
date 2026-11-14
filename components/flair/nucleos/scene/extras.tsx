"use client";
/**
 * Figurantes da cena (seção 2): silhuetas sem rosto, atrás ou ao lado do avatar. O corpo é uma malha; os braços
 * giram no ombro. Cada figurante segue as sequências do diretor (aplaude, recua, prova e gira, comemora) e o
 * movimento de ambiente do jogo (o manequim gira devagar, a torcida acena).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { figurante, MAT_FIGURANTE, type Postura } from "@/lib/flair/nucleos/scene/figurantes";
import type { Parte } from "@/lib/flair/nucleos/scene/types";
import { fundirPorMaterial, pintarPorVertice } from "@/components/flair/nucleos/scene/part-geometry";
import { aplicarNoObjeto, estadoDoAtor, useCena } from "@/components/flair/nucleos/scene/stage-context";

const RAD = Math.PI / 180;

function malha(partes: Parte[], cor: string): THREE.BufferGeometry | null {
  if (partes.length === 0) return null;
  const g = fundirPorMaterial(partes, {}).get(MAT_FIGURANTE);
  return g ? pintarPorVertice(g, cor) : null;
}

/** Corpo e braço na cor do figurante (o braço esquerdo e o direito usam a mesma malha). */
function useMalhas(postura: Postura, cor: string) {
  const malhas = useMemo(() => {
    const f = figurante(postura);
    return { corpo: malha(f.corpo, cor), braco: malha(f.braco, cor), ombros: f.ombros };
  }, [postura, cor]);
  useEffect(
    () => () => {
      malhas.corpo?.dispose();
      malhas.braco?.dispose();
    },
    [malhas],
  );
  return malhas;
}

export function Figurante({ p, ator, material }: { p: NucleoPersonagem; ator: string; material: THREE.Material }) {
  const cena = useCena();
  const { corpo, braco, ombros } = useMalhas(p.postura ?? "em_pe", p.cor);
  const fora = useRef<THREE.Group>(null);
  const raiz = useRef<THREE.Group>(null);
  const bracoE = useRef<THREE.Mesh>(null);
  const bracoD = useRef<THREE.Mesh>(null);
  const origem = useMemo(() => ({ x: p.pos[0], z: p.pos[2], giro: p.giro ?? 0 }), [p]);
  useFrame(() => {
    if (!fora.current || !raiz.current) return;
    const { amostra, lugar } = estadoDoAtor(cena, ator, origem);
    fora.current.position.set(lugar.x, p.pos[1], lugar.z);
    fora.current.rotation.y = lugar.giro * RAD;
    aplicarNoObjeto(raiz.current, amostra, "raiz");
    if (ombros && bracoE.current) aplicarNoObjeto(bracoE.current, amostra, "bracoE", ombros.e);
    if (ombros && bracoD.current) aplicarNoObjeto(bracoD.current, amostra, "bracoD", ombros.d);
  });
  return (
    <group ref={fora} name={`personagem-${p.papel}`} position={p.pos} rotation={[0, origem.giro * RAD, 0]} scale={p.escala ?? 1}>
      <group ref={raiz}>
        {corpo && <mesh geometry={corpo} material={material} castShadow />}
        {ombros && braco && <mesh ref={bracoE} geometry={braco} material={material} position={ombros.e} castShadow />}
        {ombros && braco && <mesh ref={bracoD} geometry={braco} material={material} position={ombros.d} castShadow />}
      </group>
    </group>
  );
}

/** Todos os figurantes, cada um com o nome de ator "fig:<PAPEL>:<índice no papel>". */
export function Figurantes({ personagens }: { personagens: NucleoPersonagem[] }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const porPapel = new Map<string, number>();
  return (
    <group name="figurantes">
      {personagens.map((p, i) => {
        const indice = porPapel.get(p.papel) ?? 0;
        porPapel.set(p.papel, indice + 1);
        return <Figurante key={`${p.papel}-${i}`} p={p} ator={`fig:${p.papel}:${indice}`} material={material} />;
      })}
    </group>
  );
}
