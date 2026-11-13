"use client";
/**
 * Móvel com objeto GLB licenciado: carrega o arquivo sob demanda (drei useGLTF, com Suspense) e o põe no lugar do
 * móvel, ajustado à altura do móvel procedural e apoiado no piso. Enquanto carrega, ou se o arquivo falha, aparece
 * o móvel procedural da descrição — a sala nunca fica com um buraco.
 */
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { alturaDoMovel, urlDoGlb } from "@/lib/flair/nucleos/scene/assets";
import type { Movel } from "@/lib/flair/nucleos/scene/types";

const RAD = Math.PI / 180;

class Reserva extends Component<{ children: ReactNode; reserva: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

function Objeto({ movel }: { movel: Movel }) {
  const ref = movel.glb!;
  const { scene } = useGLTF(urlDoGlb(ref.slug));
  const { objeto, escala, apoio } = useMemo(() => {
    const copia = scene.clone(true);
    copia.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const caixa = new THREE.Box3().setFromObject(copia);
    const tamanho = caixa.getSize(new THREE.Vector3());
    const centro = caixa.getCenter(new THREE.Vector3());
    const k = ref.escala ?? (tamanho.y > 0 ? alturaDoMovel(movel) / tamanho.y : 1);
    return { objeto: copia, escala: k, apoio: [-centro.x * k, -caixa.min.y * k, -centro.z * k] as [number, number, number] };
  }, [scene, ref.escala, movel]);
  return (
    <group name={`glb-${ref.slug}`} position={movel.pos} rotation={[0, (movel.giro + (ref.giro ?? 0)) * RAD, 0]}>
      <primitive object={objeto} position={apoio} scale={escala} />
    </group>
  );
}

export function MovelGlb({ movel, reserva }: { movel: Movel; reserva: ReactNode }) {
  return (
    <Reserva reserva={reserva}>
      <Suspense fallback={reserva}>
        <Objeto movel={movel} />
      </Suspense>
    </Reserva>
  );
}
