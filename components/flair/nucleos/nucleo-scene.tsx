"use client";
/**
 * Palco da tela de jogo: a cena 3D do núcleo com a sala, o avatar e os figurantes. Sem WebGL (ou se a cena falhar),
 * uma cena 2D leve com as cores da sala, os personagens e as peças escolhidas — nunca um painel em branco. Com
 * "reduzir movimento", o resultado aparece também como quadro parado (a nota e o placar), sem depender de animação.
 */
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion, useWebGL, type Look3dPiece } from "@/components/three/common";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { Cena2D, QuadroParado } from "@/components/flair/nucleos/scene/scene-2d";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import type { NucleoConfig, NucleoResultado } from "@/lib/flair/nucleos/types";

const NucleoScene3D = dynamic(() => import("@/components/flair/nucleos/nucleo-scene-3d"), { ssr: false, loading: () => null });

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  config: NucleoConfig;
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  /** resultado da entrega (opcional): a cena toca a sequência automática do jogo e a reação do avatar */
  resultado?: NucleoResultado | null;
  /** sala do jogo quando ele tem mais de uma (o salão da vez, a modalidade) */
  variante?: string | null;
}

export function NucleoScene(props: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const fallback = <Cena2D config={props.config} avatar={props.avatar} pecas={props.pecas} resultado={props.resultado} variante={props.variante} />;
  if (webgl === false) return fallback;
  if (webgl === null) return <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div>;
  return (
    <SceneBoundary fallback={fallback}>
      <div className="n3d-scene3d" data-testid="nucleo-scene-3d">
        <NucleoScene3D {...props} reduzido={reduzido} desfile={props.config.acoes.includes("DESFILAR")}
          rotulo={tx.t("flair3d.ui.scene.aria", { nome: tx.nome(props.config.codigo) })} />
        {reduzido && props.resultado && <QuadroParado config={props.config} resultado={props.resultado} />}
      </div>
    </SceneBoundary>
  );
}
