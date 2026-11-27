"use client";
/**
 * A qualidade da cena 3D em uso (lib/flair/nucleos/scene/qualidade.ts): mede os quadros de verdade e, quando a máquina
 * não dá conta, desce de nível — menos pontos por pixel, a luz principal sem sombra e menos corpos inteiros —, sem a
 * pessoa precisar mexer em nada. Quem desenha gente lê o nível em `nivel` a cada quadro. O nível fica escrito no canvas
 * (data-qualidade), para a medida no navegador e para os testes de tela.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { AJUSTES, pontosPorPixel, qualidadeDeLargada, qualidadeInicial, quadroMedido, type Qualidade } from "@/lib/flair/nucleos/scene/qualidade";

/** O nome do renderizador (a placa de vídeo, ou o desenho por software), quando o navegador informa. */
function renderizador(gl: THREE.WebGLRenderer): string | null {
  try {
    const contexto = gl.getContext();
    const info = contexto.getExtension("WEBGL_debug_renderer_info");
    return info ? String(contexto.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
  } catch {
    return null;
  }
}

interface Props {
  /** o nível em uso, lido por quem desenha as pessoas de cena */
  nivel: React.MutableRefObject<Qualidade>;
  /** o nome da luz que faz sombra na cena */
  luz?: string;
}

export function QualidadeDaCena({ nivel, luz = "luz-principal" }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const setDpr = useThree((s) => s.setDpr);
  const estado = useRef(qualidadeInicial(nivel.current));
  const aplicado = useRef<Qualidade | null>(null);

  const aplicar = (q: Qualidade) => {
    aplicado.current = q;
    nivel.current = q;
    setDpr(pontosPorPixel(q, typeof window === "undefined" ? 1 : window.devicePixelRatio));
    // a sombra sai pela luz (o three refaz os programas sozinho quando o número de luzes com sombra muda)
    const principal = scene.getObjectByName(luz) as THREE.DirectionalLight | undefined;
    if (principal) principal.castShadow = AJUSTES[q].sombra;
    if (gl.domElement?.dataset) gl.domElement.dataset.qualidade = q;
  };

  // o nível de partida, uma vez, antes do primeiro quadro (as luzes da sala já estão montadas: são irmãs anteriores na
  // cena): sem placa de vídeo a cena já larga no nível baixo
  useEffect(() => {
    estado.current = qualidadeInicial(qualidadeDeLargada(renderizador(gl)));
    aplicar(estado.current.nivel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const q = quadroMedido(estado.current, dt).nivel;
    if (q !== aplicado.current) aplicar(q);
  });
  return null;
}
