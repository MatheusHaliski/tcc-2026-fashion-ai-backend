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
import { planoDaCamera, poseDaCamera, poseEscolhida, seguir, tapaOReplay, type Plano, type Pose } from "@/lib/flair/esporte/camera";
import { noMundo, UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";
import { pontoNaRede } from "@/lib/flair/esporte/rede";
import { CHEGADA_AO_GOL, gol, naTrave } from "@/lib/flair/esporte/bola";
import { quadroDoLance, type Quadro } from "@/lib/flair/esporte/timeline";
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
  /** a câmera escolhida no seletor ("AUTO" = a transmissão com cortes) */
  camera?: string;
}

interface Estado {
  quadro: Quadro;
  plano: Plano | string;
}

function Cena({ campo, anterior, atual, inicio, duracao, reduzido, uniforme, camera: escolha }: Omit<Transmissao3DProps, "rotulo">) {
  /** a bola na rede ou na trave: depois que ela chega ao gol (k 0,72), com o ponto do impacto */
  const batida = useRef<Batida | null>(null);
  const estado = useRef<Estado>({ quadro: quadroDoLance(campo, anterior, atual, reduzido ? 1 : 0), plano: "geral" });
  const pose = useRef<Pose | null>(null);
  const bola = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();
  const paraOMundo = useMemo(() => (x: number, y: number) => noMundo(campo, [x, y]), [campo]);
  const lados: Lado[] = ["NOS", "ELES"];

  useFrame(() => {
    const k = reduzido ? 1 : Math.max(0, Math.min(1, (performance.now() - inicio) / Math.max(1, duracao)));
    const quadro = quadroDoLance(campo, anterior, atual, k);
    const aspecto = size.width / Math.max(1, size.height);
    const fixa = poseEscolhida(escolha, campo, [quadro.bola.x, quadro.bola.y], performance.now() / 1000, aspecto, reduzido);
    // com uma câmera escolhida não há cortes: o "plano" é o nome dela, e trocar de câmera é o único salto
    const plano: Plano | string = fixa ? (escolha as string) : planoDaCamera(atual, k, reduzido);
    const cortou = plano !== estado.current.plano;
    estado.current = { quadro, plano };
    batida.current = atual && (gol(atual.tipo) || naTrave(atual.tipo)) && k >= CHEGADA_AO_GOL
      ? { lado: atual.time === "NOS" ? 1 : -1, u: pontoNaRede(atual.para[1], LARGURA_DO_GOL, campo.largura)[0], v: 0.55, chave: atual.n, naTrave: naTrave(atual.tipo) }
      : null;
    if (bola.current) {
      const [x, z] = noMundo(campo, [quadro.bola.x, quadro.bola.y]);
      bola.current.position.set(x, quadro.bola.altura, z);
    }
    const ator = atual ? quadro.figuras.find((f) => f.time === atual.time && f.n === atual.jogador) : null;
    // no replay, quem está entre a lente e o jogador da carta some até o replay acabar
    if (plano === "replay" && ator) {
      for (const f of quadro.figuras) f.oculto = f !== ator && tapaOReplay(campo, [ator.x, ator.y], [f.x, f.y]);
    }
    const pedida = fixa ?? poseDaCamera(plano as Plano, campo, [quadro.bola.x, quadro.bola.y], ator ? [ator.x, ator.y] : null, aspecto);
    pose.current = !pose.current || cortou || reduzido ? pedida : seguir(pose.current, pedida, 0.08);
    camera.position.set(...pose.current.pos);
    camera.lookAt(...pose.current.alvo);
    camera.userData.plano = plano;
    // prioridade negativa: roda antes dos jogadores, que leem o quadro deste mesmo instante (e não tira a renderização automática)
  }, -1);

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
