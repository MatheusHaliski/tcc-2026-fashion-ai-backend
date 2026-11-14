"use client";
/**
 * ACERVO — encaixe de GLB: se o manifesto (public/acervo/3d/manifest.json) trouxer um modelo para o encaixe, ele é
 * carregado e ajustado ao tamanho da forma procedural; enquanto carrega, se falha ou se não existe (o caso de hoje),
 * aparece a forma procedural. É o mesmo padrão de components/flair/nucleos/scene/glb-prop.tsx.
 */
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AssetGlb } from "@/lib/flair/nucleos/scene/assets";
import { ACERVO_GLB_MANIFESTO, glbDoEncaixe, lerManifestoDoAcervo, urlDoGlbDoAcervo, type EncaixeGlb } from "@/lib/acervo/cena/assets";
import type { V3 } from "@/lib/acervo/cena/modelo";

let pedido: Promise<AssetGlb[]> | null = null;
const VAZIO: AssetGlb[] = [];

function buscar(): Promise<AssetGlb[]> {
  pedido ??= fetch(ACERVO_GLB_MANIFESTO)
    .then((r) => (r.ok ? r.json() : []))
    .then(lerManifestoDoAcervo)
    .catch(() => VAZIO);
  return pedido;
}

/** Manifesto dos GLBs do ACERVO, buscado uma vez por sessão; vazio enquanto não chega ou quando não existe. */
export function useManifestoDoAcervo(): AssetGlb[] {
  const [manifesto, setManifesto] = useState<AssetGlb[]>(VAZIO);
  useEffect(() => {
    let vivo = true;
    if (typeof fetch !== "function") return;
    void buscar().then((m) => {
      if (vivo && m.length > 0) setManifesto(m);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return manifesto;
}

class Reserva extends Component<{ children: ReactNode; reserva: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

function Modelo({ slug, tam, pos }: { slug: string; tam: V3; pos: V3 }) {
  const { scene } = useGLTF(urlDoGlbDoAcervo(slug));
  const { objeto, escala, apoio } = useMemo(() => {
    const copia = scene.clone(true);
    const caixa = new THREE.Box3().setFromObject(copia);
    const tamanho = caixa.getSize(new THREE.Vector3());
    const centro = caixa.getCenter(new THREE.Vector3());
    const k = Math.min(tam[0] / (tamanho.x || 1), tam[1] / (tamanho.y || 1), tam[2] / (tamanho.z || 1));
    return { objeto: copia, escala: k, apoio: [-centro.x * k, -centro.y * k, -centro.z * k] as V3 };
  }, [scene, tam]);
  return (
    <group position={pos} name={`glb-${slug}`}>
      <primitive object={objeto} position={apoio} scale={escala} />
    </group>
  );
}

/** Desenha o GLB do encaixe quando ele existe; senão, a forma procedural recebida em `children`. */
export function EncaixeGlb({ encaixe, manifesto, tam, pos, children }: { encaixe: EncaixeGlb | null; manifesto: AssetGlb[]; tam: V3; pos: V3; children: ReactNode }) {
  const asset = encaixe ? glbDoEncaixe(encaixe, manifesto) : null;
  if (!asset) return <>{children}</>;
  return (
    <Reserva reserva={children}>
      <Suspense fallback={children}>
        <Modelo slug={asset.slug} tam={tam} pos={pos} />
      </Suspense>
    </Reserva>
  );
}
