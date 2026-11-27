"use client";
/**
 * Sala high poly (scripts/blender3d_high): carrega o GLB do nível de detalhe da qualidade em uso (drei useGLTF, que já
 * traz o decodificador meshopt; instancing e WebP são lidos pelo GLTFLoader do three), os modelos prontos da sala e o
 * mapa de ambiente capturado no Blender. Enquanto carrega, se o arquivo falha, na qualidade Baixa ou sem a sala no
 * manifesto, aparece `reserva` (a sala procedural) — a cena nunca fica vazia. `children` só aparece com a sala high poly
 * pronta (o que a sala procedural desenhava junto e continua valendo por cima dela, como uma gaveta aberta).
 */
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AmbienteDaSala } from "@/components/flair/salas-altas/ambiente";
import { BrilhoDaSala } from "@/components/flair/salas-altas/brilho";
import { ImportadosDaSala } from "@/components/flair/salas-altas/importados";
import { usePreferenciaDeQualidade, useSalasAltas } from "@/components/flair/salas-altas/use-salas-altas";
import { nivelDaSala, salaAltaPorSlug, type NivelDaSala, type SalaAlta as Entrada } from "@/lib/flair/salas-altas/manifesto";
import { qualidadeEfetiva } from "@/lib/flair/salas-altas/preferencia";

class Reserva extends Component<{ children: ReactNode; reserva: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

/** O nome do renderizador (placa de vídeo ou desenho por software), quando o navegador informa. */
export function useRenderizador(): string | null {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    try {
      const contexto = gl.getContext();
      const info = contexto.getExtension("WEBGL_debug_renderer_info");
      return info ? String(contexto.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
    } catch {
      return null;
    }
  }, [gl]);
}

/** O nível de detalhe que a sala usa agora (nulo = procedural). */
export function useNivelDaSala(entrada: Entrada | null): NivelDaSala | null {
  const preferencia = usePreferenciaDeQualidade();
  const renderizador = useRenderizador();
  const largura = useThree((s) => s.size.width);
  if (!entrada) return null;
  return nivelDaSala(entrada, qualidadeEfetiva(preferencia, renderizador), largura);
}

function Modelo({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const copia = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  useEffect(() => () => {
    copia.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
  }, [copia]);
  return <primitive object={copia} />;
}

/** `brilho`: o pós-processamento de bloom no nível alto (desligue onde a cena já tem pós próprio). */
export function SalaAlta({ slug, reserva, children, brilho = true }: { slug: string | null; reserva: ReactNode; children?: ReactNode; brilho?: boolean }) {
  const entrada = salaAltaPorSlug(useSalasAltas(), slug);
  const nivel = useNivelDaSala(entrada);
  const arquivo = entrada && nivel ? entrada.levels[nivel] : undefined;
  if (!entrada || !nivel || !arquivo) return <>{reserva}</>;
  return (
    <Reserva reserva={reserva} key={arquivo.url}>
      <Suspense fallback={reserva}>
        <group name={`sala-alta-${entrada.slug}`} userData={{ nivel, triangulos: arquivo.triangles, chamadas: arquivo.calls }}>
          <Modelo url={arquivo.url} />
          {entrada.environment && <AmbienteDaSala url={entrada.environment} />}
          {brilho && nivel === "alto" && <BrilhoDaSala />}
          {children}
        </group>
      </Suspense>
      <ImportadosDaSala lista={entrada.imports} nivel={nivel} />
    </Reserva>
  );
}
