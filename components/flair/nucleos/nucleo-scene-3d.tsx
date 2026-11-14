"use client";
/**
 * Cena 3D do núcleo (carregada só no navegador, com WebGL): a sala do jogo (casca, móveis, materiais e luzes de
 * lib/flair/nucleos/scene), os figurantes sem rosto atrás ou ao lado do avatar e o avatar na zona dele. A câmera usa
 * o Rig do provador (components/three/fitting-camera.tsx): o zoom muda a distância e mira mais alto (até o rosto).
 */
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Rig } from "@/components/three/fitting-camera";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoAvatar, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { Figurantes } from "@/components/flair/nucleos/scene/extras";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { useSceneDirector } from "@/components/flair/nucleos/scene/use-scene-director";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import { placarDaCena } from "@/lib/flair/nucleos/scene/sequences-auto";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";
import type { NucleoConfig, NucleoResultado, V3 } from "@/lib/flair/nucleos/types";

export interface NucleoScene3DProps {
  config: NucleoConfig;
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  reduzido: boolean;
  desfile: boolean;
  rotulo: string;
  protagonista: Protagonista;
  /** resultado da entrega: dispara a sequência automática do jogo e a reação do avatar */
  resultado?: NucleoResultado | null;
}

/**
 * Distância e alvo da câmera pelo nível de zoom: 0 = corpo inteiro; cada passo aproxima e sobe até o rosto. Com a
 * sala, a distância respeita o limite dela (quatro paredes) e o alvo sobe a altura do piso do avatar.
 */
export function enquadramento(zoom: number, sala?: Sala): { dist: number; alvo: V3 } {
  const livre = Math.max(0.55, 4.2 - zoom * 0.8);
  const dist = sala ? Math.min(livre, limiteDaCamera(sala)) : livre;
  const altura = Math.min(1.58, 1.0 + Math.max(0, zoom) * 0.12);
  return { dist, alvo: [0, altura + (sala?.zonas.avatar.altura ?? 0), 0] };
}

export default function NucleoScene3D({ config, avatar, pecas, reduzido, desfile, rotulo, protagonista, resultado }: NucleoScene3DProps) {
  const sala = SALAS[config.codigo];
  const cena = useSceneDirector({ codigo: config.codigo, avatar, resultado, reduzido });
  const { dist, alvo } = enquadramento(avatar.zoom, sala);
  const target = useMemo<V3>(() => alvo, [alvo[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const figurantes = useMemo(() => figurantesDaCena(sala, config.personagens), [sala, config.personagens]);
  return (
    <Canvas shadows camera={{ fov: 35, position: [0, 1.2, 4.2], near: 0.1, far: 60 }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={[sala.fundo]} />
      <CenaContexto.Provider value={cena}>
        <Sala3D sala={sala} placar={placarDaCena(config.codigo, resultado)} />
        <Figurantes personagens={figurantes} />
        <NucleoAvatar estado={avatar} pecas={pecas} reduzido={reduzido} desfile={desfile} protagonista={protagonista} altura={sala.zonas.avatar.altura} />
      </CenaContexto.Provider>
      <Rig view="front" target={target} dist={dist} />
    </Canvas>
  );
}
