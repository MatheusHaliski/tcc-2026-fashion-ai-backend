"use client";
/**
 * A detetive na cena 3D. Com o analógico (ou WASD), anda livre pelos corredores entre o ponto em que está e os vizinhos
 * (lib/flair/detetive/andar-livre.ts), no sentido em que a câmera olhava quando o analógico saiu do centro; ao chegar perto de um vizinho, o passo vai ao servidor
 * (IR:<ponto>). Sem o analógico, quando o servidor a põe num ponto novo (clique na planta, no chão ou no botão), ela
 * desliza até lá, virada para onde anda. Com "reduzir movimento", salta. Extraído de detetive-cena-3d.tsx.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoAvatar, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NA_MARCA, type Jogador } from "@/components/flair/nucleos/scene/andarilho";
import { eixoDeAndar } from "@/lib/flair/entrada/eixo-de-andar";
import { chegouEm, passoDaDetetive } from "@/lib/flair/detetive/andar-livre";
import type { Retrato } from "@/lib/flair/detetive/types";

const PARADO = { giro: 0, zoom: 0, poses: 0, desfilando: false };
const DIRECAO = new THREE.Vector3();

export interface AlvoDaCamera {
  x: number;
  z: number;
  giro: number;
}

interface Props {
  r: Retrato;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  reduzido: boolean;
  alvo: React.MutableRefObject<AlvoDaCamera>;
  /** os pontos a um passo daqui (ids) e o pedido de ir até um deles */
  vizinhos: string[];
  onIr: (ponto: string) => void;
  /** dá para andar agora (sem cutscene, folha aberta, resposta pendente nem final) */
  livre: boolean;
}

export function DetetiveJogador({ r, pecas, protagonista, reduzido, alvo, vizinhos, onIr, livre }: Props) {
  const g = useRef<THREE.Group>(null);
  const passo = useRef<React.MutableRefObject<Jogador>["current"]>({ pos: NA_MARCA, andando: false });
  const jogador = passo as React.MutableRefObject<Jogador>;
  /** a pessoa levou a detetive para fora do ponto: ela fica onde parou até o servidor dar um ponto novo */
  const solta = useRef({ ponto: r.ponto, andou: false, pedido: null as string | null });
  /** o rumo da câmera quando o analógico saiu do centro: fica até soltar (a câmera de ombro gira com a detetive) */
  const rumo = useRef<number | null>(null);
  const p = r.layout.pontos.find((x) => x.id === r.ponto) ?? { x: 0, z: 0 };
  const pontos = r.layout.pontos.filter((x) => vizinhos.includes(x.id));
  useFrame(({ camera }, dt) => {
    if (!g.current) return;
    const s = solta.current;
    if (s.ponto !== r.ponto) solta.current = { ponto: r.ponto, andou: false, pedido: null };
    const { mover, ativo } = eixoDeAndar();
    const pos = g.current.position;
    const empurra = livre && ativo && Math.hypot(mover.x, mover.y) > 1e-3;
    if (!empurra) rumo.current = null;
    if (empurra) {
      if (rumo.current === null) {
        camera.getWorldDirection(DIRECAO);
        rumo.current = Math.atan2(DIRECAO.x, -DIRECAO.z);
      }
      const novo = passoDaDetetive({ x: pos.x, z: pos.z }, mover, dt, rumo.current, p, pontos);
      const dx = novo.x - pos.x;
      const dz = novo.z - pos.z;
      if (Math.hypot(dx, dz) > 1e-4) g.current.rotation.y = Math.atan2(dx, dz);
      pos.x = novo.x;
      pos.z = novo.z;
      solta.current.andou = true;
      jogador.current = { pos: NA_MARCA, andando: Math.hypot(dx, dz) > 1e-4 };
      const chegou = chegouEm(novo, pontos);
      if (chegou && solta.current.pedido !== chegou) {
        solta.current.pedido = chegou;
        onIr(chegou);
      }
    } else if (!solta.current.andou) {
      const dx = p.x - pos.x;
      const dz = p.z - pos.z;
      const k = reduzido ? 1 : Math.min(1, dt * 3.5);
      const longe = Math.hypot(dx, dz) > 0.05;
      if (longe) g.current.rotation.y = Math.atan2(dx, dz);
      pos.x += dx * k;
      pos.z += dz * k;
      jogador.current = { pos: NA_MARCA, andando: longe && !reduzido };
    } else if (jogador.current.andando) {
      jogador.current = { pos: NA_MARCA, andando: false };
    }
    alvo.current = { x: pos.x, z: pos.z, giro: (g.current.rotation.y * 180) / Math.PI };
  });
  return (
    <group ref={g} position={[p.x, 0, p.z]} rotation={[0, Math.PI, 0]} name="detetive">
      <NucleoAvatar estado={PARADO} pecas={pecas} reduzido={reduzido} protagonista={protagonista} jogador={jogador} />
    </group>
  );
}
