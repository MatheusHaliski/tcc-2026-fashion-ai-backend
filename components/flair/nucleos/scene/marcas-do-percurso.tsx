"use client";
/**
 * As marcas do percurso desenhadas no piso da cena (lib/flair/nucleos/movimento/desfile.ts): um aro por marca — a
 * próxima acesa e pulsando, as seguintes apagadas, as já tocadas na cor da nota (verde certo, roxo ousado, vermelho
 * erro). Na fase de uso dos jogos de zonas cada marca tem o alvo do jogo: o cone do campo, o feixe de luz do palco, o
 * portão da pista e o drone do terraço, que some quando a personagem acerta. Só desenha: quem conta as marcas é
 * desfile-jogavel.tsx e quem dá a nota é o servidor.
 */
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { assinarFx } from "@/lib/flair/nucleos/fx-events";
import { ALCANCE, type Marca } from "@/lib/flair/nucleos/movimento/desfile";
import type { NotaDoToque } from "@/lib/flair/nucleos/movimento/execucao";
import type { AlvoDaMarca } from "@/lib/flair/nucleos/movimento/fase-de-uso";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { agora } from "@/components/flair/nucleos/scene/stage-context";

const COR_DA_NOTA: Record<NotaDoToque, string> = { PERFEITO: "#50C878", BOM: "#50C878", OUSADO: "#7A5CFF", ERROU: "#E5484D" };
const PROXIMA = "#E0B04D";
const DEPOIS = "#FFFFFF";

type Estado = "PROXIMA" | "DEPOIS" | NotaDoToque | "PASSOU";

function corDe(estado: Estado): string {
  if (estado === "PROXIMA" || estado === "PASSOU") return PROXIMA;
  return estado === "DEPOIS" ? DEPOIS : COR_DA_NOTA[estado];
}

/** O alvo do jogo em cima da marca; some (ou sobe e vai embora) depois da nota. */
function Alvo({ tipo, estado }: { tipo: AlvoDaMarca; estado: Estado }) {
  const grupo = useRef<THREE.Group>(null);
  const feito = estado !== "PROXIMA" && estado !== "DEPOIS";
  useFrame(() => {
    const g = grupo.current;
    if (!g || tipo !== "DRONE") return;
    // o drone paira; acertado, cai e some; perdido, sobe e escapa
    const t = agora();
    const alvo = !feito ? 1.45 + Math.sin(t * 2.4 + g.position.x) * 0.12 : estado === "ERROU" ? 4.5 : 0.2;
    g.position.y += (alvo - g.position.y) * 0.08;
    g.rotation.y = t * 1.8;
    g.scale.setScalar(feito && estado !== "ERROU" ? Math.max(0.001, g.scale.x * 0.9) : 1);
  });
  const cor = corDe(estado);
  if (tipo === "CONE") {
    return (
      <group name="alvo-cone" position={[0.32, 0, 0]} rotation={[0, 0, feito ? 1.45 : 0]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <coneGeometry args={[0.15, 0.48, 16]} />
          <meshStandardMaterial color="#F0762B" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.36, 0.04, 0.36]} />
          <meshStandardMaterial color="#F0762B" roughness={0.6} />
        </mesh>
      </group>
    );
  }
  if (tipo === "FEIXE") {
    return (
      <mesh name="alvo-feixe" position={[0, 2.6, 0]} visible={!feito}>
        <cylinderGeometry args={[0.12, ALCANCE, 5.2, 20, 1, true]} />
        <meshBasicMaterial color={cor} transparent opacity={estado === "PROXIMA" ? 0.34 : 0.1} depthWrite={false} side={2} />
      </mesh>
    );
  }
  if (tipo === "PORTAO") {
    return (
      <group name="alvo-portao">
        {[-0.85, 0.85].map((x) => (
          <mesh key={x} position={[x, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 1.6, 10]} />
            <meshStandardMaterial color="#F4F4F4" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 1.62, 0]}>
          <boxGeometry args={[1.8, 0.16, 0.06]} />
          <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={estado === "DEPOIS" ? 0.15 : 0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <group ref={grupo} name="alvo-drone" position={[0.75, 1.7, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial color="#1B1F2A" emissive={estado === "DEPOIS" ? "#E5484D" : cor} emissiveIntensity={1.2} roughness={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.025, 8, 24]} />
        <meshStandardMaterial color="#8E939C" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

interface Props {
  codigo: NucleoCodigo;
  marcas: Marca[];
  /** altura do piso onde a personagem anda (a passarela, o palco) */
  altura: number;
  alvo?: AlvoDaMarca;
  reduzido: boolean;
}

export function MarcasDoPercurso({ codigo, marcas, altura, alvo, reduzido }: Props) {
  const [alcancadas, setAlcancadas] = useState(0);
  const [notas, setNotas] = useState<NotaDoToque[]>([]);
  const aros = useRef<(THREE.Mesh | null)[]>([]);
  useEffect(() => {
    setAlcancadas(0);
    setNotas([]);
    return assinarFx((e) => {
      if (e.nucleo !== codigo) return;
      if (e.tipo === "desfile") setAlcancadas(e.alcancadas);
      if (e.tipo === "desfile-nota") setNotas((n) => [...n.slice(0, e.marca), e.nota]);
    });
  }, [codigo, marcas]);
  const estados: Estado[] = marcas.map((_, i) => notas[i] ?? (i < alcancadas ? "PASSOU" : i === Math.max(alcancadas, notas.length) ? "PROXIMA" : "DEPOIS"));
  useFrame(() => {
    if (reduzido) return;
    const pulso = 1 + Math.sin(agora() * 5) * 0.08;
    aros.current.forEach((aro, i) => aro?.scale.setScalar(estados[i] === "PROXIMA" ? pulso : 1));
  });
  return (
    <group name="marcas-do-percurso">
      {marcas.map((m, i) => {
        const estado = estados[i];
        const cor = corDe(estado);
        return (
          <group key={i} position={[m.x, altura, m.z]}>
            <mesh ref={(o) => void (aros.current[i] = o)} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[ALCANCE, 0.035, 8, 40]} />
              <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={estado === "DEPOIS" ? 0.2 : 1.4} transparent opacity={estado === "DEPOIS" ? 0.45 : 1} />
            </mesh>
            {estado === "PROXIMA" && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[ALCANCE, 32]} />
                <meshBasicMaterial color={cor} transparent opacity={0.22} depthWrite={false} />
              </mesh>
            )}
            {alvo && <Alvo tipo={alvo} estado={estado} />}
          </group>
        );
      })}
    </group>
  );
}
