"use client";
/**
 * Cena 3D do núcleo (carregada só no navegador, com WebGL): a sala do jogo (casca, móveis, materiais e luzes de
 * lib/flair/nucleos/scene), os figurantes sem rosto atrás ou ao lado do avatar e o avatar na zona dele. A câmera é a
 * do jogo (scene/game-camera.tsx, docs/flair/flair-3d/CAMERAS.md): a escolhida no seletor ou a do momento da partida; o
 * zoom aproxima e mira mais alto (até o rosto).
 */
import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraDeAbertura } from "@/components/flair/nucleos/scene/opening-camera";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoAvatar, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { LuzDeEfeito, PecaPintada } from "@/components/flair/nucleos/scene/effects-3d";
import { CameraDoJogo } from "@/components/flair/nucleos/scene/game-camera";
import { Figurantes } from "@/components/flair/nucleos/scene/extras";
import { FigurantesHumanos } from "@/components/flair/nucleos/gente/figurantes-humanos";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { useSceneDirector } from "@/components/flair/nucleos/scene/use-scene-director";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import { cameraEmUso, type MomentoDaCamera } from "@/lib/flair/nucleos/camera/jogos";
import { poseDoRig } from "@/lib/flair/nucleos/camera/rigs";
import { comZoom, limitesDaSala } from "@/lib/flair/nucleos/camera/sala";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import { placarDaCena } from "@/lib/flair/nucleos/scene/sequences-auto";
import { temAbertura } from "@/lib/flair/nucleos/scene/opening";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";
import type { NucleoConfig, NucleoResultado, V3, ZonaEscolha } from "@/lib/flair/nucleos/types";

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
  /** sala do jogo quando ele tem mais de uma (o salão da vez, a modalidade) */
  variante?: string | null;
  /** semente da partida: o corpo de cada pessoa de cena sai dela (sem partida, o do jogo) */
  semente?: number;
  /** zonas da rodada (modos do Ateliê), na ordem, e o que a pessoa já pintou em cada uma */
  zonasDaPeca?: string[];
  zonas?: Record<string, ZonaEscolha>;
  /** a câmera escolhida no seletor do HUD ("AUTO" ou nula = a do momento) e o momento da partida */
  camera?: string | null;
  momento?: MomentoDaCamera;
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

export default function NucleoScene3D({ config, avatar, pecas, reduzido, desfile, rotulo, protagonista, resultado, variante, semente, zonasDaPeca, zonas, camera, momento = "PREPARO" }: NucleoScene3DProps) {
  const manequim = config.personagens.find((p) => p.papel === "MANEQUIM");
  const sala = salaDe(config.codigo, variante);
  // a abertura toca no começo da partida (e a cada salão da gala); quem volta a uma partida já na ação não a revê
  const abertura = momento === "PREPARO" ? variante ?? config.codigo : variante;
  const cena = useSceneDirector({ codigo: config.codigo, avatar, resultado, reduzido, abertura });
  // onde a abertura do salão termina: a câmera do preparo, parada
  const fim = useMemo(() => {
    const pose = poseDoRig(comZoom(cameraEmUso(config.codigo, camera, "PREPARO"), avatar.zoom), { pos: [0, sala.zonas.avatar.altura, 0], limites: limitesDaSala(sala) }, 0, 1.5, true);
    return { pos: pose.pos, alvo: pose.alvo };
  }, [config.codigo, camera, avatar.zoom, sala]);
  const figurantes = useMemo(() => figurantesDaCena(sala, config.personagens), [sala, config.personagens]);
  /** os figurantes que já são gente (o corpo humano montou): a silhueta deles sai de cena */
  const prontos = useRef(new Set<string>());
  return (
    <Canvas shadows camera={{ fov: 35, position: [1.7, 1.35, 3.8], near: 0.1, far: 60 }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={[sala.fundo]} />
      <CenaContexto.Provider value={cena}>
        <Sala3D sala={sala} placar={placarDaCena(config.codigo, resultado)} />
        <Figurantes personagens={figurantes} prontos={prontos} />
        <FigurantesHumanos codigo={config.codigo} semente={semente} personagens={figurantes} prontos={prontos} reduzido={reduzido} />
        <LuzDeEfeito altura={sala.zonas.avatar.altura} />
        {manequim && zonasDaPeca && zonas && <PecaPintada pos={manequim.pos} zonas={zonasDaPeca} escolhas={zonas} />}
        <NucleoAvatar estado={avatar} pecas={pecas} reduzido={reduzido} desfile={desfile} protagonista={protagonista} altura={sala.zonas.avatar.altura} />
        <CameraDoJogo codigo={config.codigo} escolha={camera} momento={momento} sala={sala} zoom={avatar.zoom} reduzido={reduzido} />
      </CenaContexto.Provider>
      {temAbertura(config.codigo) && <CameraDeAbertura chave={abertura} sala={sala} fim={fim} reduzido={reduzido} />}
    </Canvas>
  );
}
