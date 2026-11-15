"use client";
/**
 * A câmera do jogo na cena (docs/flair/flair-3d/CAMERAS.md): a cada quadro pergunta qual câmera vale (a escolhida no
 * seletor ou, na automática, a do momento da partida), onde o avatar está e para onde ele olha, e põe a lente onde o
 * rig manda (lib/flair/nucleos/camera). A troca de câmera e o andar do avatar são acompanhados com suavidade; com
 * "reduzir movimento" a câmera salta para o lugar e as que andam sozinhas ficam paradas.
 */
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { agora, useCena } from "@/components/flair/nucleos/scene/stage-context";
import { cameraEmUso, type MomentoDaCamera } from "@/lib/flair/nucleos/camera/jogos";
import { aproximar, poseDoRig, type Pose } from "@/lib/flair/nucleos/camera/rigs";
import { comZoom, limitesDaSala } from "@/lib/flair/nucleos/camera/sala";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

const ORIGEM = { x: 0, z: 0, giro: 0 };
/** Quanto da diferença a câmera anda por quadro (a 60 quadros por segundo: chega em cerca de meio segundo). */
const SUAVIDADE = 0.12;

interface Props {
  codigo: NucleoCodigo;
  /** a câmera escolhida no seletor ("AUTO" ou nula = a do momento) */
  escolha?: string | null;
  momento: MomentoDaCamera;
  sala: Sala;
  zoom: number;
  reduzido: boolean;
}

export function CameraDoJogo({ codigo, escolha, momento, sala, zoom, reduzido }: Props) {
  const cena = useCena();
  const { camera, size } = useThree();
  const pose = useRef<Pose | null>(null);

  useFrame(() => {
    const t = agora();
    const c = comZoom(cameraEmUso(codigo, escolha, momento), zoom);
    const lugar = cena.diretor.lugar("avatar", t, ORIGEM);
    const assunto = { pos: [lugar.x, sala.zonas.avatar.altura, lugar.z] as [number, number, number], giro: lugar.giro, limites: limitesDaSala(sala) };
    const pedida = poseDoRig(c, assunto, t, size.width / Math.max(1, size.height), reduzido);
    pose.current = !pose.current || reduzido ? pedida : aproximar(pose.current, pedida, SUAVIDADE);
    camera.position.set(...pose.current.pos);
    camera.lookAt(...pose.current.alvo);
    const lente = camera as THREE.PerspectiveCamera;
    if (lente.isPerspectiveCamera && Math.abs(lente.fov - pose.current.fov) > 0.01) {
      lente.fov = pose.current.fov;
      lente.updateProjectionMatrix();
    }
    camera.userData.camera = c.id;
  });
  return null;
}
