"use client";
/**
 * Painel de cima do MAKE UP: o provador 3D (só no navegador, com WebGL). Sem WebGL ou com falha, uma cena 2D nas
 * cores do FashionAI com a protagonista, as peças vestidas e a maquiagem escolhida.
 */
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion, useWebGL, type Look3dPiece } from "@/components/three/common";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import { tomDe } from "@/lib/flair/make-up/palette";
import type { MaquiagemEscolha } from "@/lib/flair/nucleos/types";

const MakeUpScene3D = dynamic(() => import("@/components/flair/make-up/makeup-scene-3d"), { ssr: false, loading: () => null });

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  maquiagem: Record<string, MaquiagemEscolha>;
  protagonista: Protagonista;
}

function Cena2D({ pecas, maquiagem }: Props) {
  const tx = useNucleoText();
  return (
    <div className="n3d-scene2d mk-scene2d" data-testid="makeup-scene-fallback" role="img" aria-label={tx.t("flair3d.makeup.scene.aria")}>
      <div className="n3d-scene2d-avatar" aria-hidden />
      <p className="n3d-scene2d-note">{tx.t("flair3d.ui.scene.fallback")}</p>
      <ul className="mk-face" aria-label={tx.t("flair3d.makeup.scene.face")}>
        {Object.entries(maquiagem).map(([area, m]) => (
          <li key={area}>
            <span className="n3d-swatch" style={{ background: tomDe(area, m.familia ?? "") }} aria-hidden />
            {tx.ou(`flair3d.ui.area.${area}`, area)}
          </li>
        ))}
      </ul>
      {pecas.length > 0 && <p className="n3d-scene2d-cast">{pecas.map((p) => p.name).join(" · ")}</p>}
    </div>
  );
}

export function MakeUpScene(props: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const fallback = <Cena2D {...props} />;
  if (webgl === false) return fallback;
  if (webgl === null) return <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div>;
  const { avatar, protagonista, pecas } = props;
  return (
    <Boundary fallback={fallback}>
      <div className="n3d-scene3d" data-testid="makeup-scene-3d">
        <MakeUpScene3D avatar={protagonista.avatar} sexo={protagonista.sexo} corpo={protagonista.corpo} pecas={pecas}
          giro={avatar.giro} zoom={avatar.zoom} poses={avatar.poses} reduzido={reduzido} />
      </div>
    </Boundary>
  );
}
