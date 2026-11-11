"use client";
/**
 * Painel de cima da tela (layout DREST): a cena 3D do núcleo com o avatar e os personagens. Sem WebGL (ou se a cena
 * falhar), uma cena 2D leve com as mesmas cores, os personagens e as peças escolhidas — nunca um painel em branco.
 */
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion, useWebGL, type Look3dPiece } from "@/components/three/common";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

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
}

function Cena2D({ config, avatar, pecas }: Props) {
  const tx = useNucleoText();
  const papeis = Array.from(new Set(config.personagens.map((p) => p.papel)));
  return (
    <div className="n3d-scene2d" data-testid="nucleo-scene-fallback" role="img" aria-label={tx.t("flair3d.ui.scene.aria", { nome: tx.nome(config.codigo) })}
      style={{ ["--n3d-fundo" as string]: config.cena.fundo, ["--n3d-piso" as string]: config.cena.piso }}>
      <div className="n3d-scene2d-chars" aria-hidden>
        {config.personagens.slice(0, 9).map((p, i) => <span key={i} className="n3d-char" style={{ background: p.cor }} />)}
      </div>
      <div className="n3d-scene2d-avatar" style={{ transform: `rotateY(${avatar.giro}deg) scale(${1 + Math.max(0, avatar.zoom) * 0.08})` }} aria-hidden />
      <p className="n3d-scene2d-note">{tx.t("flair3d.ui.scene.fallback")}</p>
      {papeis.length > 0 && <p className="n3d-scene2d-cast">{tx.t("flair3d.ui.scene.characters", { lista: papeis.map(tx.papel).join(", ") })}</p>}
      {pecas.length > 0 && <p className="n3d-scene2d-cast">{pecas.map((p) => p.name).join(" · ")}</p>}
    </div>
  );
}

export function NucleoScene(props: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const fallback = <Cena2D {...props} />;
  if (webgl === false) return fallback;
  if (webgl === null) return <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div>;
  return (
    <SceneBoundary fallback={fallback}>
      <div className="n3d-scene3d" data-testid="nucleo-scene-3d">
        <NucleoScene3D {...props} reduzido={reduzido} desfile={props.config.acoes.includes("DESFILAR")}
          rotulo={tx.t("flair3d.ui.scene.aria", { nome: tx.nome(props.config.codigo) })} />
      </div>
    </SceneBoundary>
  );
}
