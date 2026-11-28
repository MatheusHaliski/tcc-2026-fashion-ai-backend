"use client";
/**
 * O que a demonstração desenha por cima da sala, lido da simulação a cada quadro (sem esperar o React): os alfinetes em
 * voo, os impactos sem sangue (faíscas douradas, brilho, retalhos de tecido, a nuvem do laquê, o anel verde da cura),
 * a barra de vida sobre a cabeça de cada vigia (virada para a câmera), o anel vermelho do alvo travado pela mira e o
 * anel dourado do que dá para usar com E. Com "reduzir movimento", os impactos aparecem parados e sem partículas.
 */
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { alvoTravado } from "@/lib/flair/detetive/demo/armas";
import { interativoProximo } from "@/lib/flair/detetive/demo/interacao";
import { LUGAR, VIDA_DO_VIGIA } from "@/lib/flair/detetive/demo/mundo";
import { VIDA_DO_EFEITO } from "@/lib/flair/detetive/demo/passo";
import type { Efeito } from "@/lib/flair/detetive/demo/tipos";
import type { Simulacao } from "@/components/flair/detetive/demo/use-demo";

const ALFINETES = 12;
const IMPACTOS = 16;
const PARTICULAS = 6;
const COR: Record<Efeito["tipo"], string> = { FAISCA: "#FFD86B", BRILHO: "#FFF3C4", TECIDO: "#E86A9A", NUVEM: "#CFE8FF", CURA: "#7BE3A0" };

interface Props {
  sim: MutableRefObject<Simulacao>;
  mirando: boolean;
  reduzido: boolean;
}

/** Um impacto: as partículas saem do centro e caem (retalhos) ou sobem (cura); a nuvem cresce e some. */
function posar(g: THREE.Object3D, e: Efeito, reduzido: boolean) {
  const k = Math.min(1, e.t / VIDA_DO_EFEITO[e.tipo]);
  g.visible = true;
  g.position.set(e.x, e.tipo === "CURA" ? 0.2 + k * 1.6 : 1.1, e.z);
  const [nuvem, ...particulas] = g.children as THREE.Mesh[];
  const opaco = 1 - k;
  nuvem.visible = e.tipo === "NUVEM" || e.tipo === "BRILHO" || e.tipo === "CURA";
  nuvem.scale.setScalar(e.tipo === "NUVEM" ? 0.6 + k * 1.8 : 0.3 + k * 0.9);
  (nuvem.material as THREE.MeshBasicMaterial).color.set(COR[e.tipo]);
  (nuvem.material as THREE.MeshBasicMaterial).opacity = (e.tipo === "NUVEM" ? 0.45 : 0.6) * opaco;
  particulas.forEach((p, i) => {
    p.visible = !reduzido && (e.tipo === "FAISCA" || e.tipo === "TECIDO" || e.tipo === "BRILHO");
    const a = (i / PARTICULAS) * Math.PI * 2 + e.id;
    const r = 0.15 + k * (e.tipo === "TECIDO" ? 0.9 : 0.7);
    p.position.set(Math.cos(a) * r, (e.tipo === "TECIDO" ? 0.3 - k * 1 : 0.2 * Math.sin(a * 3)) + k * 0.2, Math.sin(a) * r);
    p.rotation.set(k * 6 + i, k * 4, 0);
    (p.material as THREE.MeshBasicMaterial).color.set(COR[e.tipo]);
    (p.material as THREE.MeshBasicMaterial).opacity = opaco;
  });
}

export function DemoEfeitos3D({ sim, mirando, reduzido }: Props) {
  const alfinetes = useRef<(THREE.Mesh | null)[]>([]);
  const impactos = useRef<(THREE.Group | null)[]>([]);
  const barras = useRef<(THREE.Group | null)[]>([]);
  const travado = useRef<THREE.Mesh>(null);
  const uso = useRef<THREE.Mesh>(null);
  const vigias = useMemo(() => sim.current.estado.vigias.map((v) => v.id), [sim]);
  useFrame(({ camera, clock }) => {
    const e = sim.current.estado;
    alfinetes.current.forEach((m, i) => {
      const p = e.projeteis[i];
      if (!m) return;
      m.visible = !!p;
      if (!p) return;
      m.position.set(p.x, 1.25, p.z);
      m.rotation.set(Math.PI / 2, 0, -Math.atan2(p.vx, p.vz));
    });
    impactos.current.forEach((g, i) => {
      if (!g) return;
      const x = e.efeitos[e.efeitos.length - 1 - i];
      if (x) posar(g, x, reduzido);
      else g.visible = false;
    });
    barras.current.forEach((g, i) => {
      const v = e.vigias.find((x) => x.id === vigias[i]);
      if (!g || !v) return;
      g.visible = !v.sumiu && v.modo !== "ABATIDO";
      g.position.set(v.x, 2.02, v.z);
      g.quaternion.copy(camera.quaternion);
      const cheio = g.children[1] as THREE.Mesh;
      const k = Math.max(0.001, v.vida / VIDA_DO_VIGIA);
      cheio.scale.x = k;
      cheio.position.x = -0.27 * (1 - k);
      (cheio.material as THREE.MeshBasicMaterial).color.set(k > 0.5 ? "#7BE3A0" : k > 0.25 ? "#F2C230" : "#E5484D");
    });
    const alvo = mirando ? alvoTravado(e) : null;
    if (travado.current) {
      travado.current.visible = !!alvo;
      if (alvo) travado.current.position.set(alvo.x, 0.04, alvo.z);
    }
    const perto = interativoProximo(e);
    if (uso.current) {
      uso.current.visible = !!perto && !e.fim;
      const l = perto && LUGAR[perto.id];
      if (l) uso.current.position.set(l.x, 0.04, l.z);
      uso.current.scale.setScalar(reduzido ? 1 : 1 + 0.08 * Math.sin(clock.elapsedTime * 5));
    }
  });
  const basico = (cor: string, opacidade = 1) => <meshBasicMaterial color={cor} transparent opacity={opacidade} depthWrite={false} />;
  return (
    <group name="efeitos-demo">
      {Array.from({ length: ALFINETES }, (_, i) => (
        <mesh key={`a${i}`} ref={(m) => void (alfinetes.current[i] = m)} visible={false} name="alfinete">
          <cylinderGeometry args={[0.025, 0.012, 0.42, 6]} />
          <meshBasicMaterial color="#F4E3B0" />
        </mesh>
      ))}
      {Array.from({ length: IMPACTOS }, (_, i) => (
        <group key={`i${i}`} ref={(g) => void (impactos.current[i] = g)} visible={false} name="impacto">
          <mesh><sphereGeometry args={[0.5, 16, 10]} />{basico("#fff", 0.5)}</mesh>
          {Array.from({ length: PARTICULAS }, (_, k) => <mesh key={k}><planeGeometry args={[0.12, 0.08]} />{basico("#fff")}</mesh>)}
        </group>
      ))}
      {vigias.map((id, i) => (
        <group key={id} ref={(g) => void (barras.current[i] = g)} name={`vida-${id}`}>
          <mesh><planeGeometry args={[0.58, 0.08]} />{basico("#000", 0.6)}</mesh>
          <mesh position={[0, 0, 0.001]}><planeGeometry args={[0.54, 0.05]} />{basico("#7BE3A0")}</mesh>
        </group>
      ))}
      <mesh ref={travado} rotation={[-Math.PI / 2, 0, 0]} visible={false} name="alvo-travado">
        <ringGeometry args={[0.45, 0.58, 32]} />
        {basico("#FF4D52", 0.85)}
      </mesh>
      <mesh ref={uso} rotation={[-Math.PI / 2, 0, 0]} visible={false} name="pode-usar">
        <ringGeometry args={[0.32, 0.42, 32]} />
        {basico("#F2C230", 0.9)}
      </mesh>
    </group>
  );
}
