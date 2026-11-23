"use client";
/**
 * A câmera do jogo na cena (docs/flair/flair-3d/CAMERAS.md): a cada quadro pergunta qual câmera vale (a escolhida no
 * seletor ou, na automática, a do momento da partida), onde o avatar está e para onde ele olha, e põe a lente onde o
 * rig manda (lib/flair/nucleos/camera). A troca de câmera e o andar do avatar são acompanhados com suavidade, por fora
 * do corpo da avatar e das pessoas de cena, num tempo fixo em segundos (colisao.ts); com "reduzir movimento" a câmera
 * salta para o lugar e as que andam sozinhas ficam paradas.
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { agora, useCena } from "@/components/flair/nucleos/scene/stage-context";
import { cameraEmUso, type MomentoDaCamera } from "@/lib/flair/nucleos/camera/jogos";
import { aproximarEmVolta, fracaoDoQuadro } from "@/lib/flair/nucleos/camera/colisao";
import { obstaculosDaSala, obstaculosDasPessoas } from "@/lib/flair/nucleos/camera/enquadramento";
import { poseDoRig, type Pose } from "@/lib/flair/nucleos/camera/rigs";
import { idDoFigurante } from "@/lib/flair/nucleos/gente/figurantes";
import { comZoom, limitesDaSala } from "@/lib/flair/nucleos/camera/sala";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo, NucleoPersonagem } from "@/lib/flair/nucleos/types";

const ORIGEM = { x: 0, z: 0, giro: 0 };

interface Props {
  codigo: NucleoCodigo;
  /** a câmera escolhida no seletor ("AUTO" ou nula = a do momento) */
  escolha?: string | null;
  momento: MomentoDaCamera;
  sala: Sala;
  zoom: number;
  reduzido: boolean;
  /** as pessoas de cena da sala: a lente nunca entra no corpo delas */
  pessoas?: NucleoPersonagem[];
}

const NINGUEM: NucleoPersonagem[] = [];

export function CameraDoJogo({ codigo, escolha, momento, sala, zoom, reduzido, pessoas = NINGUEM }: Props) {
  const cena = useCena();
  const { camera, size } = useThree();
  const pose = useRef<Pose | null>(null);
  // as pessoas de cena como obstáculos, no lugar para onde o diretor levou cada uma (a oponente vem até a avatar)
  const evita = useMemo(() => obstaculosDasPessoas(pessoas), [pessoas]);
  const atores = useMemo(() => pessoas.map((p, i) => ({ id: idDoFigurante(pessoas, i), origem: { x: p.pos[0], z: p.pos[2], giro: p.giro ?? 0 } })), [pessoas]);
  const limites = useMemo(() => limitesDaSala(sala), [sala]);
  const caixas = useMemo(() => obstaculosDaSala(sala), [sala]);

  useFrame((_, dt) => {
    const t = agora();
    const c = comZoom(cameraEmUso(codigo, escolha, momento), zoom);
    const lugar = cena.diretor.lugar("avatar", t, ORIGEM);
    atores.forEach((a, i) => {
      const onde = cena.diretor.lugar(a.id, t, a.origem);
      evita[i].pos = [onde.x, pessoas[i].pos[1], onde.z];
    });
    const assunto = { pos: [lugar.x, sala.zonas.avatar.altura, lugar.z] as [number, number, number], giro: lugar.giro, limites, evita, caixas };
    const pedida = poseDoRig(c, assunto, t, size.width / Math.max(1, size.height), reduzido);
    pose.current = !pose.current || reduzido ? pedida : aproximarEmVolta(pose.current, pedida, fracaoDoQuadro(dt), assunto);
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
