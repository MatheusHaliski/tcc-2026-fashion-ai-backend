"use client";
/**
 * Modelos prontos de uma sala high poly: os GLB do MET Gala Heist (public/heist/models, gerados pela Meshy, já com
 * meshopt e WebP), reaproveitados sem copiar bytes. Cada um carrega sozinho (a sala aparece sem esperar por eles), é
 * escalado pela altura final, com o centro da caixa no ponto e a base no piso — o mesmo encaixe da cena do Blender que
 * assou a sombra de contato deles. No nível médio entra a versão simplificada.
 */
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { arquivoDoImportado, type ImportadoNaSala, type NivelDaSala } from "@/lib/flair/salas-altas/manifesto";

const RAD = Math.PI / 180;

class SemModelo extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? null : this.props.children;
  }
}

/** Escala e deslocamento que põem a caixa do objeto com a altura pedida, centrada em x/z e com a base em y = 0. */
export function encaixe(caixa: THREE.Box3, altura: number): { escala: number; desvio: [number, number, number] } {
  const tamanho = caixa.getSize(new THREE.Vector3());
  const escala = tamanho.y > 1e-6 ? altura / tamanho.y : 1;
  const centro = caixa.getCenter(new THREE.Vector3());
  return { escala, desvio: [-centro.x * escala, -caixa.min.y * escala, -centro.z * escala] };
}

function Importado({ item, url }: { item: ImportadoNaSala; url: string }) {
  const { scene } = useGLTF(url);
  const { objeto, escala, desvio } = useMemo(() => {
    const copia = scene.clone(true);
    copia.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    copia.updateMatrixWorld(true);
    return { objeto: copia, ...encaixe(new THREE.Box3().setFromObject(copia), item.height) };
  }, [scene, item.height]);
  return (
    <group name={`importado-${item.model}`} position={item.pos} rotation={[0, item.rotation * RAD, 0]}>
      <group position={desvio} scale={escala}>
        <primitive object={objeto} />
      </group>
    </group>
  );
}

export function ImportadosDaSala({ lista, nivel }: { lista: ImportadoNaSala[]; nivel: NivelDaSala }) {
  return (
    <group name="importados">
      {lista.map((item, i) => (
        <SemModelo key={`${item.model}-${i}`}>
          <Suspense fallback={null}>
            <Importado item={item} url={arquivoDoImportado(item, nivel)} />
          </Suspense>
        </SemModelo>
      ))}
    </group>
  );
}
