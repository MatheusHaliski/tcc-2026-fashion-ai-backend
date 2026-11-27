"use client";
/**
 * A cena 3D da demonstração (carregada só no navegador): avança a simulação a cada quadro com as setas ou o analógico
 * (no sentido da câmera), desenha a sala (demo-sala-3d.tsx), a detetive e os vigias como gente (o mesmo corpo humano
 * das pessoas de cena, components/flair/nucleos/gente), os alfinetes, os impactos e as barras de vida
 * (demo-efeitos-3d.tsx). A câmera fica atrás e acima; mirando (A), desce para trás do ombro, olhando para o alvo. Levar
 * golpe treme a câmera (sem tremor com "reduzir movimento").
 */
import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { DemoEfeitos3D } from "@/components/flair/detetive/demo/demo-efeitos-3d";
import { DemoSala3D } from "@/components/flair/detetive/demo/demo-sala-3d";
import { atoresDaDemo } from "@/lib/flair/detetive/demo/atores";
import { passo } from "@/lib/flair/detetive/demo/passo";
import type { EstadoDaDemo, EventoDaDemo } from "@/lib/flair/detetive/demo/tipos";
import { pessoaDoPapel } from "@/lib/flair/detetive/elenco";
import { eixoDeAndar } from "@/lib/flair/entrada/eixo-de-andar";
import { estadoDoConsole } from "@/lib/flair/nucleos/controle/estado-do-console";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import type { Simulacao } from "@/components/flair/detetive/demo/use-demo";

const SEMENTE = 11;
const OLHAR = new THREE.Vector3();
const POS = new THREE.Vector3();
const ALVO = new THREE.Vector3();
const DIRECAO = new THREE.Vector3();

interface Props {
  sim: MutableRefObject<Simulacao>;
  onQuadro: (e: EstadoDaDemo) => void;
  onEventos: (eventos: EventoDaDemo[]) => void;
  mirando: boolean;
  reduzido: boolean;
  rotulo: string;
}

/** Avança a simulação e manda o retrato para o HUD dez vezes por segundo. */
function Simulador({ sim, onQuadro, onEventos, mirando }: Pick<Props, "sim" | "onQuadro" | "onEventos" | "mirando">) {
  const { camera } = useThree();
  const ultimo = useRef(0);
  useFrame(({ clock }, delta) => {
    const s = sim.current;
    if (s.escala === 0) return;
    const ctl = estadoDoConsole();
    const toque = eixoDeAndar().mover;
    const v = Math.hypot(ctl.mover.x, ctl.mover.y) > 1e-3 ? ctl.mover : toque;
    // as setas no sentido da câmera: para cima = para onde ela olha
    camera.getWorldDirection(DIRECAO);
    const f = Math.hypot(DIRECAO.x, DIRECAO.z) || 1;
    const fx = DIRECAO.x / f;
    const fz = DIRECAO.z / f;
    const mover = { x: v.y * fx - v.x * fz, z: v.y * fz + v.x * fx };
    const r = passo(s.estado, { mover, correr: ctl.correr, mirando, ...s.fila }, delta * s.escala);
    s.fila = {};
    s.estado = r.estado;
    if (r.eventos.length) onEventos(r.eventos);
    if (clock.elapsedTime - ultimo.current > 0.1 || r.eventos.length) {
      ultimo.current = clock.elapsedTime;
      onQuadro(r.estado);
    }
  });
  return null;
}

function Camera({ sim, mirando, reduzido }: Pick<Props, "sim" | "mirando" | "reduzido">) {
  const { camera, size } = useThree();
  useFrame((_, delta) => {
    const s = sim.current;
    // em pé (celular), a câmera sobe e se afasta para a sala caber na largura
    const longe = size.width < size.height ? 1.55 : 1;
    const j = s.estado.jogador;
    if (mirando) {
      // atrás do ombro direito, olhando para onde ela mira
      const sx = Math.sin(j.giro);
      const cz = Math.cos(j.giro);
      POS.set(j.x - sx * 3.1 - cz * 0.7, 2.35, j.z - cz * 3.1 + sx * 0.7);
      ALVO.set(j.x + sx * 6, 1.2, j.z + cz * 6);
    } else {
      POS.set(j.x * (longe > 1 ? 0.6 : 1), 5.2 * longe, Math.min(j.z + 5.6 * longe, 9.5 * longe));
      ALVO.set(j.x, 0.9, j.z - 0.8);
    }
    const k = reduzido ? 1 : Math.min(1, delta * 6);
    camera.position.lerp(POS, k);
    OLHAR.lerp(ALVO, k);
    if (s.tremor > 0 && !reduzido) {
      s.tremor = Math.max(0, s.tremor - delta);
      const a = s.tremor * 0.25;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    camera.lookAt(OLHAR);
  });
  return null;
}

function Gente({ sim, reduzido, mirando }: Pick<Props, "sim" | "reduzido" | "mirando">) {
  const pessoas = useMemo(() => {
    const m = new Map<string, PessoaDoElenco>();
    m.set("jogadora", pessoaDoPapel(SEMENTE, "jogadora", "LIA"));
    for (const v of sim.current.estado.vigias) m.set(v.id, pessoaDoPapel(SEMENTE, v.id, v.id === "V2" ? "VIGIA" : "SEGURANCA"));
    return m;
  }, [sim]);
  const prontos = useRef(new Set<string>());
  return <Elenco3D pessoas={pessoas} atores={() => atoresDaDemo(sim.current.estado, mirando)} prontos={prontos} reduzido={reduzido} />;
}

export default function DemoCena3D({ sim, onQuadro, onEventos, mirando, reduzido, rotulo }: Props) {
  return (
    <Canvas shadows camera={{ fov: 50, position: [0, 5.4, 10], near: 0.1, far: 80 }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={["#0E0F14"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 9, 6]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2.6, -4.8]} intensity={6} distance={9} color="#F2D9A0" />
      <Simulador sim={sim} onQuadro={onQuadro} onEventos={onEventos} mirando={mirando} />
      <DemoSala3D sim={sim} reduzido={reduzido} />
      <Gente sim={sim} reduzido={reduzido} mirando={mirando} />
      <DemoEfeitos3D sim={sim} mirando={mirando} reduzido={reduzido} />
      <Camera sim={sim} mirando={mirando} reduzido={reduzido} />
    </Canvas>
  );
}
