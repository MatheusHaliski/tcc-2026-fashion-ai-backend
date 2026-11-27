"use client";
/**
 * Móvel com objeto GLB (licenciado ou do motor Blender do projeto, scripts/blender3d): carrega o arquivo sob demanda
 * (drei useGLTF, com Suspense) e o põe no lugar do móvel. O objeto é encaixado na caixa do móvel procedural — mesma
 * altura, mesmo centro, mesma base —, então serve também ao que pende do teto ou encosta na parede. Os materiais
 * `sala:<papel>` do arquivo são pintados com os materiais da sala. Enquanto carrega, ou se o arquivo falha, aparece o
 * móvel procedural da descrição — a sala nunca fica com um buraco.
 */
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { geometriaDaParte } from "@/components/flair/nucleos/scene/part-geometry";
import type { MateriaisDaSala } from "@/components/flair/nucleos/scene/use-room-materials";
import { materialDoPapel, urlDoGlb } from "@/lib/flair/nucleos/scene/assets";
import { qualidadeDeLargada } from "@/lib/flair/nucleos/scene/qualidade";
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

/** A caixa que as partes procedurais do móvel ocupam, no espaço do móvel (é nela que o objeto GLB se encaixa). */
export function caixaDoMovel(movel: Movel): THREE.Box3 {
  const caixa = new THREE.Box3();
  for (const parte of movel.partes) {
    const g = geometriaDaParte(parte, 0);
    g.computeBoundingBox();
    if (g.boundingBox) caixa.union(g.boundingBox);
    g.dispose();
  }
  return caixa;
}

/** Sem placa de vídeo (desenho por software) a sala carrega a versão leve do objeto, quando o manifesto diz que existe. */
function useVersaoLeve(temLeve: boolean): boolean {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    if (!temLeve) return false;
    try {
      const contexto = gl.getContext();
      const info = contexto.getExtension("WEBGL_debug_renderer_info");
      return qualidadeDeLargada(info ? String(contexto.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null) === "BAIXA";
    } catch {
      return false;
    }
  }, [gl, temLeve]);
}

/**
 * O objeto no espaço do móvel (sem a posição nem o giro do móvel na sala): quem chama o põe num grupo no lugar — o
 * móvel fixo, pela posição; o animado, dentro do grupo que a sequência move.
 */
export function ObjetoGlb({ movel, slug, materiais, leve = false }: { movel: Movel; slug: string; materiais?: MateriaisDaSala; leve?: boolean }) {
  const ref = movel.glb ?? { slug };
  const { scene } = useGLTF(urlDoGlb(slug, useVersaoLeve(leve)));
  const { objeto, escala, apoio } = useMemo(() => {
    const copia = scene.clone(true);
    copia.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const pintar = (m: THREE.Material) => materiais?.[materialDoPapel(m.name, movel) ?? ""] ?? m;
      o.material = Array.isArray(o.material) ? o.material.map(pintar) : pintar(o.material);
    });
    const doGlb = new THREE.Box3().setFromObject(copia);
    const tamanho = doGlb.getSize(new THREE.Vector3());
    const centro = doGlb.getCenter(new THREE.Vector3());
    const alvo = caixaDoMovel(movel);
    const vazio = alvo.isEmpty();
    const altura = vazio ? 0 : alvo.max.y - alvo.min.y;
    const k = ref.escala ?? (tamanho.y > 0 && altura > 0 ? altura / tamanho.y : 1);
    const meio = vazio ? new THREE.Vector3() : alvo.getCenter(new THREE.Vector3());
    const base = vazio ? 0 : alvo.min.y;
    return { objeto: copia, escala: k, apoio: [meio.x - centro.x * k, base - doGlb.min.y * k, meio.z - centro.z * k] as [number, number, number] };
  }, [scene, ref.escala, movel, materiais]);
  return (
    <group name={`glb-${slug}`} rotation={[0, (ref.giro ?? 0) * RAD, 0]}>
      <primitive object={objeto} position={apoio} scale={escala} />
    </group>
  );
}

/** Móvel fixo: o objeto no lugar do móvel na sala, com o móvel procedural de reserva. */
export function MovelGlb({ movel, slug, reserva, materiais, leve }: { movel: Movel; slug: string; reserva: ReactNode; materiais?: MateriaisDaSala; leve?: boolean }) {
  return (
    <Reserva reserva={reserva}>
      <Suspense fallback={reserva}>
        <group position={movel.pos} rotation={[0, movel.giro * RAD, 0]}>
          <ObjetoGlb movel={movel} slug={slug} materiais={materiais} leve={leve} />
        </group>
      </Suspense>
    </Reserva>
  );
}
