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
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { QualidadeDaCena } from "@/components/flair/nucleos/scene/scene-quality";
import { CORPOS_DA_TRANSMISSAO } from "@/lib/flair/esporte/torcida";
import type { Qualidade } from "@/lib/flair/nucleos/scene/qualidade";
import { atorDoJogador, elencoDaPartida } from "@/lib/flair/esporte/elenco";
import { planoDaCamera, poseDaCamera, poseEscolhida, seguir, tapaOReplay, type Plano, type Pose } from "@/lib/flair/esporte/camera";
import { noMundo, UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";
import { pontoNaRede } from "@/lib/flair/esporte/rede";
import { CHEGADA_AO_GOL, gol, naTrave } from "@/lib/flair/esporte/bola";
import { quadroDoLance, type Quadro } from "@/lib/flair/esporte/timeline";
import { humorDaTorcida } from "@/lib/flair/esporte/torcida";
import { aplicarCapita, SEM_CAPITA, type Capita } from "@/lib/flair/esporte/capita";
import { eixoDeAndar } from "@/lib/flair/entrada/eixo-de-andar";
import { definirDesvioDaCapita } from "@/lib/flair/esporte/capita-posicao";

/** O ponto do chão (x, z) a 2 cm do piso: o anel da capitã. */
const withY = ([x, z]: [number, number]): [number, number, number] => [x, 0.02, z];
import type { HumorDaTorcida } from "@/lib/flair/nucleos/gente/torcida";
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
  /** semente da partida: o elenco (corpo, pele, cabelo de cada jogador) sai dela */
  semente?: number;
  /** a carga do estádio: "CAMPO" quando a cena 3D entra na tela, "PRONTA" depois do primeiro quadro pintado */
  onEtapa?: (etapa: "CAMPO" | "PRONTA") => void;
  /** a partida fechou: a torcida e os bancos reagem ao placar final */
  fim?: boolean;
  /** a janela da jogada aberta: o analógico leva a capitã pelo campo (lib/flair/esporte/capita.ts) */
  capita?: boolean;
}

interface Estado {
  quadro: Quadro;
  plano: Plano | string;
}

function Cena({ campo, anterior, atual, inicio, duracao, reduzido, uniforme, camera: escolha, semente = 1, onEtapa, fim = false, capita = false }: Omit<Transmissao3DProps, "rotulo">) {
  /** quadros já pintados: no segundo, o primeiro já está na tela e a tela de carga pode sair */
  const quadros = useRef(0);
  /** o que a torcida e os bancos fazem agora: o ponto, a bola na trave, o apito final */
  const humor = useRef<HumorDaTorcida | null>(null);
  /** a bola na rede ou na trave: depois que ela chega ao gol (k 0,72), com o ponto do impacto */
  const batida = useRef<Batida | null>(null);
  const estado = useRef<Estado>({ quadro: quadroDoLance(campo, anterior, atual, reduzido ? 1 : 0), plano: "geral" });
  const pose = useRef<Pose | null>(null);
  const bola = useRef<THREE.Mesh>(null);
  /** a capitã que a pessoa leva com o analógico, e o anel no chão dela */
  const capitaDaVez = useRef<Capita>(SEM_CAPITA);
  const anel = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();
  const paraOMundo = useMemo(() => (x: number, y: number) => noMundo(campo, [x, y]), [campo]);
  const lados: Lado[] = ["NOS", "ELES"];
  const elenco = useMemo(() => elencoDaPartida(semente, campo, uniforme), [semente, campo, uniforme]);
  /** quem já é gente (o corpo humano montou): a figura simples dele sai de cena */
  const prontos = useRef(new Set<string>());
  /** a qualidade em uso (cai sozinha quando a máquina é lenta): menos jogadores de corpo inteiro ao mesmo tempo */
  const qualidade = useRef<Qualidade>("ALTA");
  const atores = () => {
    const { quadro } = estado.current;
    const vez = atual ? `${atual.time}-${atual.jogador}` : "";
    return quadro.figuras.map((f) => atorDoJogador(f, paraOMundo, `${f.time}-${f.n}` === vez));
  };

  useFrame((_, dt) => {
    if (quadros.current < 2 && ++quadros.current === 2) onEtapa?.("PRONTA");
    const k = reduzido ? 1 : Math.max(0, Math.min(1, (performance.now() - inicio) / Math.max(1, duracao)));
    const quadro = quadroDoLance(campo, anterior, atual, k);
    const ativa = capita && !reduzido;
    capitaDaVez.current = aplicarCapita(capitaDaVez.current, campo, quadro.figuras, quadro.bola, ativa, atual?.n ?? null, k, eixoDeAndar().mover, dt);
    const dela = quadro.figuras.find((f) => `${f.time}:${f.n}` === capitaDaVez.current.chave);
    definirDesvioDaCapita(ativa ? capitaDaVez.current.desvio : null);
    if (anel.current) {
      anel.current.visible = ativa && !!dela;
      if (dela) anel.current.position.set(...withY(noMundo(campo, [dela.x, dela.y])));
    }
    const novo = humorDaTorcida(atual, k, fim);
    if (novo?.chave !== humor.current?.chave || novo?.reacao !== humor.current?.reacao) humor.current = novo;
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
      <directionalLight name="luz-principal" position={[8, 18, 12]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 20, -20, 1, 60]} />
      </directionalLight>
      <Campo3D campo={campo} batida={() => batida.current} reduzido={reduzido} humor={() => humor.current} camisa={uniforme.camisa} />
      {lados.flatMap((time) =>
        Array.from({ length: campo.jogadores }, (_, i) => (
          <Jogador3D
            key={`${time}-${i + 1}`}
            nome={`jogador-${time}-${i + 1}`}
            uniforme={time === "NOS" ? uniforme : UNIFORME_VISITANTE}
            noMundo={paraOMundo}
            figura={() => estado.current.quadro.figuras.find((f) => f.time === time && f.n === i + 1)}
            pronto={() => prontos.current.has(`${time}-${i + 1}`)}
          />
        )),
      )}
      <Elenco3D pessoas={elenco} atores={atores} prontos={prontos} reduzido={reduzido} limite={() => CORPOS_DA_TRANSMISSAO[qualidade.current]} />
      <QualidadeDaCena nivel={qualidade} />
      <mesh ref={anel} name="anel-da-capita" rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.45, 0.6, 32]} />
        <meshBasicMaterial color="#F2C230" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {campo.bola && (
        <mesh ref={bola} name="bola" castShadow>
          <sphereGeometry args={[campo.bolaRaio, 16, 12]} />
          <meshStandardMaterial color={campo.bolaCor} roughness={0.5} />
        </mesh>
      )}
    </>
  );
}

export default function Transmissao3D({ rotulo, ...cena }: Transmissao3DProps) {
  return (
    <Canvas shadows camera={{ fov: 32, position: [0, 14, 26], near: 0.1, far: 160 }} dpr={[1, 2]} aria-label={rotulo} onCreated={() => cena.onEtapa?.("CAMPO")}>
      <color attach="background" args={["#11141A"]} />
      <Cena {...cena} />
    </Canvas>
  );
}

export { Cena as CenaDaTransmissao };
