"use client";
/**
 * A cena 3D do Fashion Detective (carregada só no navegador): a sala (sala-3d.tsx), os vigias e o elenco como gente
 * (components/flair/nucleos/gente, o mesmo corpo humano do avatar), o cone de visão de cada vigia no piso (amarelo; vermelho
 * quando a pessoa está nele), o avatar da pessoa com o look da gala, que anda de ponto a ponto, e a câmera de exploração
 * por trás do ombro (ou a diagonal de cima, ou a aérea, pelo seletor). Com "reduzir movimento", tudo salta para o lugar.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoAvatar, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { Sala3D } from "@/components/flair/detetive/sala-3d";
import { noCone } from "@/lib/flair/detetive/acoes";
import { ELENCO_DAS_SALAS, pessoaDoPapel } from "@/lib/flair/detetive/elenco";
import type { Retrato, VigiaDaSala } from "@/lib/flair/detetive/types";
import { cameraEmUso } from "@/lib/flair/nucleos/camera/jogos";
import { aproximar, poseDoRig, type Pose } from "@/lib/flair/nucleos/camera/rigs";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

const PARADO = { giro: 0, zoom: 0, poses: 0, desfilando: false };
const LIMITES = { x: [-4.7, 4.7] as [number, number], z: [-3.6, 9] as [number, number], teto: 7 };

export interface DetetiveCena3DProps {
  r: Retrato;
  vizinhos: string[];
  onIr: (ponto: string) => void;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  reduzido: boolean;
  camera: string;
  semente: number;
  rotulo: string;
}

/** Cone de visão no piso: um leque de raio = alcance, aberto 2 × meia abertura, virado para onde o vigia olha. */
function Cone({ r, x, z, olhar, visto }: { r: Retrato; x: number; z: number; olhar: number; visto: boolean }) {
  const meia = (r.meiaAbertura * Math.PI) / 180;
  const geo = useMemo(() => new THREE.CircleGeometry(r.alcance, 20, Math.PI / 2 - meia, 2 * meia), [r.alcance, meia]);
  return (
    <mesh geometry={geo} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, ((olhar - 180) * Math.PI) / 180]} name="cone">
      <meshBasicMaterial color={visto ? "#FF4D52" : "#FFD447"} transparent opacity={0.42} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** O avatar da pessoa: desliza até o ponto do servidor, virado para onde anda. */
function Jogador({ r, pecas, protagonista, reduzido, alvo }: { r: Retrato; pecas: Look3dPiece[]; protagonista: Protagonista; reduzido: boolean; alvo: React.MutableRefObject<{ x: number; z: number; giro: number }> }) {
  const g = useRef<THREE.Group>(null);
  const p = r.layout.pontos.find((x) => x.id === r.ponto) ?? { x: 0, z: 0 };
  useFrame((_, dt) => {
    if (!g.current) return;
    const dx = p.x - g.current.position.x;
    const dz = p.z - g.current.position.z;
    const k = reduzido ? 1 : Math.min(1, dt * 3.5);
    if (Math.hypot(dx, dz) > 0.05) g.current.rotation.y = Math.atan2(dx, dz);
    g.current.position.x += dx * k;
    g.current.position.z += dz * k;
    alvo.current = { x: g.current.position.x, z: g.current.position.z, giro: (g.current.rotation.y * 180) / Math.PI };
  });
  return (
    <group ref={g} position={[p.x, 0, p.z]} rotation={[0, Math.PI, 0]} name="detetive">
      <NucleoAvatar estado={PARADO} pecas={pecas} reduzido={reduzido} protagonista={protagonista} />
    </group>
  );
}

function Camera({ escolha, alvo, reduzido }: { escolha: string; alvo: React.MutableRefObject<{ x: number; z: number; giro: number }>; reduzido: boolean }) {
  const { camera, size } = useThree();
  const pose = useRef<Pose | null>(null);
  useFrame(({ clock }) => {
    const c = cameraEmUso("FASHION_DETECTIVE", escolha, "ACAO");
    const a = alvo.current;
    const pedida = poseDoRig(c, { pos: [a.x, 0, a.z], giro: a.giro, limites: LIMITES }, clock.elapsedTime, size.width / Math.max(1, size.height), reduzido);
    pose.current = !pose.current || reduzido ? pedida : aproximar(pose.current, pedida, 0.08);
    camera.position.set(...pose.current.pos);
    camera.lookAt(...pose.current.alvo);
    const lente = camera as THREE.PerspectiveCamera;
    if (Math.abs(lente.fov - pose.current.fov) > 0.01) {
      lente.fov = pose.current.fov;
      lente.updateProjectionMatrix();
    }
  });
  return null;
}

/** O corpo do vigia pelo modo: corre atrás de quem viu, aponta quando alcança, olha em volta quando perde, anda na ronda. */
function movimentoDoVigia(v: VigiaDaSala, andando: boolean): AtorDeCena["anim"] {
  if (v.convencido) return "talk";
  if (v.modo === "PERSEGUE") return andando ? "run" : "point";
  if (v.modo === "PROCURA") return "look";
  return andando ? "walk" : "idle";
}

/** Acima da cabeça de quem está fora da ronda: vermelho perseguindo, amarelo procurando (sem texto na cena). */
function Alerta({ v }: { v: VigiaDaSala }) {
  if (v.modo !== "PERSEGUE" && v.modo !== "PROCURA") return null;
  return (
    <mesh position={[v.x, 2.25, v.z]} name={`alerta-${v.id}`}>
      <sphereGeometry args={[0.11, 12, 8]} />
      <meshBasicMaterial color={v.modo === "PERSEGUE" ? "#E5484D" : "#F2C230"} />
    </mesh>
  );
}

function Cena({ r, vizinhos, onIr, pecas, protagonista, reduzido, camera, semente }: Omit<DetetiveCena3DProps, "rotulo">) {
  /** onde o avatar está e para onde olha: começa virado para o fundo da sala (a câmera fica atrás, do lado da porta) */
  const alvo = useRef({ x: 0, z: 0, giro: 180 });
  const elenco = ELENCO_DAS_SALAS[r.sala] ?? [];
  const pessoas = useMemo(() => {
    const m = new Map<string, PessoaDoElenco>();
    for (const v of r.layout.vigias) m.set(v.id, pessoaDoPapel(semente, v.id, v.papel));
    for (const [papel] of elenco) m.set(`${r.sala}-${papel}`, pessoaDoPapel(semente, papel, papel));
    return m;
  }, [r.sala, r.layout.vigias, elenco, semente]);
  const prontos = useRef(new Set<string>());
  const mostrados = useRef(new Map<string, { x: number; z: number }>());
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto) ?? { x: 0, z: 0 };
  const atores = (): AtorDeCena[] => {
    const out: AtorDeCena[] = r.layout.vigias.map((v) => {
      const antes = mostrados.current.get(v.id) ?? { x: v.x, z: v.z };
      // quem persegue corre até o novo lugar; os outros andam
      const persegue = v.modo === "PERSEGUE";
      const k = reduzido ? 1 : persegue ? 0.09 : 0.05;
      const agora = { x: antes.x + (v.x - antes.x) * k, z: antes.z + (v.z - antes.z) * k };
      mostrados.current.set(v.id, agora);
      const andando = Math.hypot(v.x - agora.x, v.z - agora.z) > 0.05;
      return { id: v.id, x: agora.x, z: agora.z, giro: (v.olhar * Math.PI) / 180, anim: movimentoDoVigia(v, andando), velocidade: andando ? (persegue ? 3.2 : 1.2) : 0, naJogada: v.temBolso || !!v.modo && v.modo !== "RONDA" };
    });
    for (const [papel, x, z, giro] of elenco) out.push({ id: `${r.sala}-${papel}`, x, z, giro: (giro * Math.PI) / 180, anim: "idle", velocidade: 0 });
    return out;
  };
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 7, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <Sala3D r={r} vizinhos={vizinhos} onIr={onIr} />
      {r.layout.vigias.filter((v) => v.vigia && !v.convencido).map((v) => (
        <Cone key={v.id} r={r} x={v.x} z={v.z} olhar={v.olhar} visto={v.modo === "PERSEGUE" || (!r.escondido && noCone(r, v, aqui.x, aqui.z))} />
      ))}
      {r.layout.vigias.map((v) => <Alerta key={`alerta-${v.id}`} v={v} />)}
      <Elenco3D pessoas={pessoas} atores={atores} prontos={prontos} reduzido={reduzido} />
      <Jogador r={r} pecas={pecas} protagonista={protagonista} reduzido={reduzido} alvo={alvo} />
      <Camera escolha={camera} alvo={alvo} reduzido={reduzido} />
    </>
  );
}

export default function DetetiveCena3D({ rotulo, ...props }: DetetiveCena3DProps) {
  return (
    <Canvas shadows camera={{ fov: 42, position: [0, 4, 8], near: 0.1, far: 60 }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={["#0E0F14"]} />
      <Cena key={props.r.sala} {...props} />
    </Canvas>
  );
}
