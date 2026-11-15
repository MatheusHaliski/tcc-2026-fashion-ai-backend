"use client";
/**
 * A transmissão do Fashion Sports em 3D (carregada só no navegador, com WebGL): o campo da modalidade, os dois times, a
 * bola e a câmera de TV. A cada quadro, a linha do tempo diz onde cada um está no lance da vez; a câmera acompanha a
 * bola do alto da lateral, corta para perto na finalização, na defesa e no desarme, e fecha no jogador que agiu com a
 * carta (o replay, onde a roupa aparece). Com "reduzir movimento", plano geral parado.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Campo3D } from "@/components/flair/esporte/campo-3d";
import { LARGURA_DO_GOL, type Batida } from "@/components/flair/esporte/gol-3d";
import { Jogador3D } from "@/components/flair/esporte/jogador-3d";
import { planoDaCamera, poseDaCamera, seguir, type Plano, type Pose } from "@/lib/flair/esporte/camera";
import { noMundo, UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";
import { pontoNaRede } from "@/lib/flair/esporte/rede";
import { gol, quadroDoLance, type Quadro } from "@/lib/flair/esporte/timeline";
import type { Jogada, Lado } from "@/lib/flair/esporte/types";

export interface Transmissao3DProps {
  campo: Campo;
  anterior: Jogada | null;
  atual: Jogada | null;
  /** quando o lance da vez começou (performance.now) e quanto ele dura, em ms */
  inicio: number;
  duracao: number;
  reduzido: boolean;
  uniforme: Uniforme;
  rotulo: string;
}

interface Estado {
  quadro: Quadro;
  plano: Plano;
}

function Cena({ campo, anterior, atual, inicio, duracao, reduzido, uniforme }: Omit<Transmissao3DProps, "rotulo">) {
  /** a bola na rede: no gol, depois que a bola chega ao fundo (k 0,72), com o ponto do impacto */
  const batida = useRef<Batida | null>(null);
  const estado = useRef<Estado>({ quadro: quadroDoLance(campo, anterior, atual, reduzido ? 1 : 0), plano: "geral" });
  const pose = useRef<Pose | null>(null);
  const bola = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const paraOMundo = useMemo(() => (x: number, y: number) => noMundo(campo, [x, y]), [campo]);
  const lados: Lado[] = ["NOS", "ELES"];

  useFrame(() => {
    const k = reduzido ? 1 : Math.max(0, Math.min(1, (performance.now() - inicio) / Math.max(1, duracao)));
    const quadro = quadroDoLance(campo, anterior, atual, k);
    const plano = planoDaCamera(atual, k, reduzido);
    const cortou = plano !== estado.current.plano;
    estado.current = { quadro, plano };
    batida.current = atual && gol(atual.tipo) && k >= 0.72
      ? { lado: atual.time === "NOS" ? 1 : -1, u: pontoNaRede(atual.para[1], LARGURA_DO_GOL, campo.largura)[0], v: 0.55, chave: atual.n }
      : null;
    if (bola.current) {
      const [x, z] = noMundo(campo, [quadro.bola.x, quadro.bola.y]);
      bola.current.position.set(x, quadro.bola.altura, z);
    }
    const ator = atual ? quadro.figuras.find((f) => f.time === atual.time && f.n === atual.jogador) : null;
    const pedida = poseDaCamera(plano, campo, [quadro.bola.x, quadro.bola.y], ator ? [ator.x, ator.y] : null);
    pose.current = !pose.current || cortou || reduzido ? pedida : seguir(pose.current, pedida, 0.08);
    camera.position.set(...pose.current.pos);
    camera.lookAt(...pose.current.alvo);
    camera.userData.plano = plano;
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 18, 12]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 20, -20, 1, 60]} />
      </directionalLight>
      <Campo3D campo={campo} batida={() => batida.current} reduzido={reduzido} />
      {lados.flatMap((time) =>
        Array.from({ length: campo.jogadores }, (_, i) => (
          <Jogador3D
            key={`${time}-${i + 1}`}
            nome={`jogador-${time}-${i + 1}`}
            uniforme={time === "NOS" ? uniforme : UNIFORME_VISITANTE}
            noMundo={paraOMundo}
            figura={() => estado.current.quadro.figuras.find((f) => f.time === time && f.n === i + 1)}
          />
        )),
      )}
      {campo.bola && (
        <mesh ref={bola} name="bola" castShadow>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshStandardMaterial color="#F4F7F2" roughness={0.5} />
        </mesh>
      )}
    </>
  );
}

export default function Transmissao3D({ rotulo, ...cena }: Transmissao3DProps) {
  return (
    <Canvas shadows camera={{ fov: 32, position: [0, 14, 26], near: 0.1, far: 160 }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={["#11141A"]} />
      <Cena {...cena} />
    </Canvas>
  );
}

export { Cena as CenaDaTransmissao };
