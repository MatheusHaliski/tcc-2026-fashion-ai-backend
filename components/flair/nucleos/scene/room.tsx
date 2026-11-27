"use client";
/**
 * Sala 3D de um jogo: desenha a descrição pura (lib/flair/nucleos/scene) — a casca (piso, paredes, teto ou céu), os
 * móveis fixos fundidos por material e os móveis animados (porta, claquete, bola, capa), cada um no próprio grupo.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glbDoMovel, type AssetGlb } from "@/lib/flair/nucleos/scene/assets";
import { partesNoLugar } from "@/lib/flair/nucleos/scene/parts";
import { cascaDaSala } from "@/lib/flair/nucleos/scene/shell";
import type { Movel, Parte, Sala } from "@/lib/flair/nucleos/scene/types";
import { MovelGlb, ObjetoGlb } from "@/components/flair/nucleos/scene/glb-prop";
import { SalaAlta } from "@/components/flair/salas-altas/sala-alta";
import { salaAltaDoJogo } from "@/lib/flair/salas-altas/manifesto";
import { fundirPorMaterial } from "@/components/flair/nucleos/scene/part-geometry";
import { LuzesDaSala } from "@/components/flair/nucleos/scene/room-lights";
import { Placar } from "@/components/flair/nucleos/scene/scoreboard";
import { aplicarNoObjeto, estadoDoAtor, useCena } from "@/components/flair/nucleos/scene/stage-context";
import { useGlbManifest } from "@/components/flair/nucleos/scene/use-glb-manifest";
import { fazSombra, useRoomMaterials, type MateriaisDaSala } from "@/components/flair/nucleos/scene/use-room-materials";

const RAD = Math.PI / 180;

/** Geometrias fundidas por material, descartadas ao trocar de sala. */
function useFundidas(partes: () => Parte[], sala: Sala, deps: unknown[]): [string, THREE.BufferGeometry][] {
  const fundidas = useMemo(() => [...fundirPorMaterial(partes(), sala.materiais)], deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => fundidas.forEach(([, g]) => g.dispose()), [fundidas]);
  return fundidas;
}

function Malhas({ fundidas, sala, materiais, sombra }: { fundidas: [string, THREE.BufferGeometry][]; sala: Sala; materiais: MateriaisDaSala; sombra: boolean }) {
  return (
    <>
      {fundidas.map(([mat, g]) => (
        <mesh key={mat} name={`mat-${mat}`} geometry={g} material={materiais[mat]} receiveShadow castShadow={sombra && fazSombra(sala.materiais[mat])} />
      ))}
    </>
  );
}

/**
 * Móvel animado: o grupo de fora fica no lugar do móvel; o de dentro recebe o movimento da sequência. Com objeto GLB
 * no manifesto (`glb`), é o objeto que se move; as partes procedurais ficam de reserva enquanto ele carrega.
 */
function MovelAnimado({ movel, sala, materiais, glb }: { movel: Movel; sala: Sala; materiais: MateriaisDaSala; glb?: AssetGlb | null }) {
  const cena = useCena();
  const fora = useRef<THREE.Group>(null);
  const dentro = useRef<THREE.Group>(null);
  const fundidas = useFundidas(() => movel.partes, sala, [movel, sala]);
  const origem = useMemo(() => ({ x: movel.pos[0], z: movel.pos[2], giro: movel.giro }), [movel]);
  useFrame(() => {
    if (!fora.current || !dentro.current) return;
    const { amostra, lugar } = estadoDoAtor(cena, `movel:${movel.id}`, origem);
    fora.current.position.set(lugar.x, movel.pos[1], lugar.z);
    fora.current.rotation.y = lugar.giro * RAD;
    aplicarNoObjeto(dentro.current, amostra, "movel");
  });
  return (
    <group ref={fora} name={`movel-${movel.id}`} position={movel.pos} rotation={[0, movel.giro * RAD, 0]}>
      <group ref={dentro}>
        {glb ? (
          <Suspense fallback={<Malhas fundidas={fundidas} sala={sala} materiais={materiais} sombra />}>
            <ObjetoGlb movel={movel} slug={glb.slug} materiais={materiais} leve={!!glb.leve} />
          </Suspense>
        ) : <Malhas fundidas={fundidas} sala={sala} materiais={materiais} sombra />}
      </group>
    </group>
  );
}

/** Móvel fixo desenhado sozinho (a reserva procedural de um móvel que tem objeto GLB). */
function MovelFixo({ movel, sala, materiais }: { movel: Movel; sala: Sala; materiais: MateriaisDaSala }) {
  const fundidas = useFundidas(() => partesNoLugar(movel), sala, [movel, sala]);
  return <Malhas fundidas={fundidas} sala={sala} materiais={materiais} sombra />;
}

const SEM_OBJETOS: AssetGlb[] = [];

/** `semObjetos`: só os móveis procedurais (o laboratório usa para comparar com e sem os objetos GLB). */
export function Sala3D({ sala, placar, semObjetos = false }: { sala: Sala; placar: string | null; semObjetos?: boolean }) {
  const materiais = useRoomMaterials(sala);
  const publicado = useGlbManifest();
  const manifesto = semObjetos ? SEM_OBJETOS : publicado;
  // móveis com objeto GLB disponível saem da malha fundida: cada um carrega o arquivo e tem a própria reserva
  const comGlb = useMemo(() => sala.moveis.filter((m) => !m.id && glbDoMovel(m, manifesto, sala.codigo)), [sala, manifesto]);
  const casca = useFundidas(() => cascaDaSala(sala), sala, [sala]);
  const fixos = useFundidas(() => sala.moveis.filter((m) => !m.id && !comGlb.includes(m)).flatMap(partesNoLugar), sala, [sala, comGlb]);
  const animados = useMemo(() => sala.moveis.filter((m) => !!m.id), [sala]);
  // a casca e os móveis fixos são a reserva da sala high poly (scripts/blender3d_high), quando o jogo tem uma
  const procedural = (
    <>
      <group name="casca">
        <Malhas fundidas={casca} sala={sala} materiais={materiais} sombra={false} />
      </group>
      <group name="moveis">
        <Malhas fundidas={fixos} sala={sala} materiais={materiais} sombra />
      </group>
      {comGlb.map((m, i) => (
        <MovelGlb key={`${m.tipo}-${i}`} movel={m} slug={glbDoMovel(m, manifesto, sala.codigo)?.slug ?? ""} materiais={materiais}
          leve={!!glbDoMovel(m, manifesto, sala.codigo)?.leve} reserva={<MovelFixo movel={m} sala={sala} materiais={materiais} />} />
      ))}
    </>
  );
  return (
    <group name="sala">
      <SalaAlta slug={semObjetos ? null : salaAltaDoJogo(sala.codigo)} reserva={procedural} />
      {animados.map((m) => <MovelAnimado key={m.id} movel={m} sala={sala} materiais={materiais} glb={glbDoMovel(m, manifesto, sala.codigo)} />)}
      {sala.placar && <Placar em={sala.placar} texto={placar} />}
      <LuzesDaSala sala={sala} />
    </group>
  );
}
