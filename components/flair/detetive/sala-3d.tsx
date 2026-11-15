"use client";
/**
 * A sala do caso em 3D (lib/flair/detetive): piso, três paredes com rodapé e o teto aberto para a câmera de exploração,
 * os armários e gavetas nos pontos do servidor, os esconderijos (coluna, arara, estante, conforme a sala), as portas
 * nas saídas (trancada, aberta ou barrada) e os marcadores dos pontos aonde se pode ir (tocar anda). O lugar de cada
 * coisa vem do retrato; as cores e o tipo de esconderijo, da sala.
 */
import { useMemo } from "react";
import * as THREE from "three";
import type { Retrato } from "@/lib/flair/detetive/types";

/** Piso, parede, detalhe e o esconderijo de cada sala. */
const ESTILO: Record<string, { piso: string; parede: string; detalhe: string; esconderijo: "coluna" | "arara" | "estante" | "caixas" }> = {
  ENTRADA: { piso: "#E8E0D2", parede: "#E6DCC8", detalhe: "#B08A3E", esconderijo: "coluna" },
  SALAO: { piso: "#5A3A2A", parede: "#3B1F2B", detalhe: "#C9A24A", esconderijo: "coluna" },
  SEGURANCA: { piso: "#3A3F48", parede: "#56606C", detalhe: "#9AA6B4", esconderijo: "estante" },
  CAMARIM: { piso: "#D9BC94", parede: "#F6D5E0", detalhe: "#C6275E", esconderijo: "arara" },
  CLUBE: { piso: "#1B1C22", parede: "#2A2230", detalhe: "#E040A0", esconderijo: "caixas" },
  ATELIE: { piso: "#B98F62", parede: "#D9D6D0", detalhe: "#1F7A76", esconderijo: "arara" },
  ARQUIVO: { piso: "#6B5A48", parede: "#8A8072", detalhe: "#4A3A2A", esconderijo: "estante" },
  ESCRITORIO: { piso: "#2C2A28", parede: "#E3E1DC", detalhe: "#1B2440", esconderijo: "estante" },
  PASSARELA: { piso: "#121216", parede: "#1A1A22", detalhe: "#F2F0EA", esconderijo: "coluna" },
};

export function estiloDaSala(sala: string) {
  return ESTILO[sala] ?? ESTILO.ENTRADA;
}

const LARGURA = 9.6;
const FUNDO = 7.4;
const ALTURA = 3.4;

/** Afasta o objeto do ponto em direção à borda mais próxima (parede, ou a frente aberta): o ponto fica livre. */
function contraParede(x: number, z: number): [number, number, number] {
  if (Math.abs(x) >= 2.5) return [x + Math.sign(x) * 0.9, z, x > 0 ? -90 : 90];
  return z > 1 ? [x, z + 0.9, 180] : [x, z - 0.9, 0];
}

function Esconderijo({ tipo, cor, x, z }: { tipo: string; cor: string; x: number; z: number }) {
  const [px, pz, giro] = contraParede(x, z);
  const rot: [number, number, number] = [0, (giro * Math.PI) / 180, 0];
  if (tipo === "coluna") {
    return (
      <mesh position={[px, 1.6, pz]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.38, 3.2, 20]} />
        <meshStandardMaterial color={cor} roughness={0.5} metalness={0.2} />
      </mesh>
    );
  }
  const tam: [number, number, number] = tipo === "caixas" ? [1.4, 1.5, 0.8] : tipo === "arara" ? [1.6, 1.7, 0.5] : [1.8, 2.3, 0.45];
  return (
    <group position={[px, 0, pz]} rotation={rot}>
      <mesh position={[0, tam[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={tam} />
        <meshStandardMaterial color={cor} roughness={0.8} />
      </mesh>
      {tipo === "estante" && [0.5, 1.1, 1.7].map((y) => (
        <mesh key={y} position={[0, y, 0.24]}>
          <boxGeometry args={[1.7, 0.04, 0.05]} />
          <meshStandardMaterial color="#2A2420" />
        </mesh>
      ))}
    </group>
  );
}

function Armario({ x, z, aberto, cor }: { x: number; z: number; aberto: boolean; cor: string }) {
  const [px, pz, giro] = contraParede(x, z);
  return (
    <group position={[px, 0, pz]} rotation={[0, (giro * Math.PI) / 180, 0]} name="armario">
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.0, 0.5]} />
        <meshStandardMaterial color={cor} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, aberto ? 0.42 : 0.26]}>
        <boxGeometry args={[0.86, 0.28, 0.04]} />
        <meshStandardMaterial color="#D8D2C4" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function Porta({ x, z, estado }: { x: number; z: number; estado: "aberta" | "trancada" | "barrada" }) {
  const [px, pz, giro] = contraParede(x, z);
  const cor = estado === "aberta" ? "#4FB36A" : estado === "barrada" ? "#E0A030" : "#C9443A";
  return (
    <group position={[px, 0, pz]} rotation={[0, (giro * Math.PI) / 180, 0]} name={`porta-${estado}`}>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.3, 2.3, 0.08]} />
        <meshStandardMaterial color="#3A2A20" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.42, 0.05]}>
        <boxGeometry args={[0.6, 0.12, 0.04]} />
        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

interface Props {
  r: Retrato;
  /** os pontos aonde um passo leva (marcadores que se pode tocar) */
  vizinhos: string[];
  onIr: (ponto: string) => void;
}

export function Sala3D({ r, vizinhos, onIr }: Props) {
  const e = estiloDaSala(r.sala);
  const parede = useMemo(() => new THREE.MeshStandardMaterial({ color: e.parede, roughness: 0.9 }), [e.parede]);
  return (
    <group name={`sala-${r.sala}`}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LARGURA, FUNDO]} />
        <meshStandardMaterial color={e.piso} roughness={0.75} />
      </mesh>
      <mesh position={[0, ALTURA / 2, -FUNDO / 2]} material={parede} receiveShadow>
        <boxGeometry args={[LARGURA, ALTURA, 0.12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * LARGURA) / 2, ALTURA / 2, 0]} material={parede} receiveShadow>
          <boxGeometry args={[0.12, ALTURA, FUNDO]} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, -FUNDO / 2 + 0.08]}>
        <boxGeometry args={[LARGURA, 0.12, 0.04]} />
        <meshStandardMaterial color={e.detalhe} />
      </mesh>
      {r.sala === "PASSARELA" && (
        <mesh position={[0, 0.02, -0.4]} receiveShadow name="passarela">
          <boxGeometry args={[1.8, 0.04, 5.6]} />
          <meshStandardMaterial color="#EDEAE4" roughness={0.35} />
        </mesh>
      )}
      {r.layout.pontos.filter((p) => p.esconderijo).map((p) => <Esconderijo key={p.id} tipo={e.esconderijo} cor={e.detalhe} x={p.x} z={p.z} />)}
      {r.layout.armarios.map((a) => {
        const p = r.layout.pontos.find((x) => x.id === a.ponto);
        return p ? <Armario key={a.id} x={p.x} z={p.z} aberto={a.aberto} cor={e.detalhe} /> : null;
      })}
      {r.layout.saidas.map((s) => {
        const p = r.layout.pontos.find((x) => x.id === s.ponto);
        return p ? <Porta key={s.para} x={p.x} z={p.z} estado={s.barrada ? "barrada" : s.aberta ? "aberta" : "trancada"} /> : null;
      })}
      {r.layout.pontos.map((p) => {
        const perto = vizinhos.includes(p.id);
        const aqui = p.id === r.ponto;
        return (
          <mesh key={p.id} name={`ponto-${p.id}`} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]}
            onClick={perto ? (ev) => { ev.stopPropagation(); onIr(p.id); } : undefined}>
            <ringGeometry args={[0.34, 0.46, 32]} />
            <meshBasicMaterial color={aqui ? "#F2C230" : perto ? "#FFFFFF" : "#777777"} transparent opacity={aqui || perto ? 0.9 : 0.35} />
          </mesh>
        );
      })}
    </group>
  );
}
