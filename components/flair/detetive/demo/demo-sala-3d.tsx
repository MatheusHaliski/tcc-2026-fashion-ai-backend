"use client";
/**
 * A sala da demonstração em 3D, com as cores do salão da gala e do arquivo (estiloDaSala, a mesma paleta da sala do
 * caso): piso, paredes, a parede do arquivo com a porta (gira ao abrir), a mesa, a arara, a cômoda com a gaveta (sai
 * ao abrir), a coluna, o armário (as portas abrem), a estante e os itens no chão, que giram devagar até serem
 * coletados. Cada caixa é a mesma da colisão (lib/flair/detetive/demo/mundo.ts).
 */
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { estiloDaSala } from "@/components/flair/detetive/sala-3d";
import { SalaAlta } from "@/components/flair/salas-altas/sala-alta";
import { LIMITES, LUGAR, MOVEIS, PORTA } from "@/lib/flair/detetive/demo/mundo";
import type { Caixa, Interativo } from "@/lib/flair/detetive/demo/tipos";
import type { Simulacao } from "@/components/flair/detetive/demo/use-demo";

const SALAO = estiloDaSala("SALAO");
/** Até onde o piso e as paredes vão na frente (além do guarda-corpo, só cenário, para a câmera). */
const FRENTE = 10;
const ROUPAS_DA_ARARA = ["#C6275E", "#1F7A76", "#F2F0EA", "#E8C93C", "#2A5FA8", "#121216"];
const ARQUIVO = estiloDaSala("ARQUIVO");
const ALTURA = 3;

const ALTURA_DO_MOVEL: Record<string, number> = { PAREDE: ALTURA, MESA: 0.78, ARARA: 1.7, COMODA: 0.95, COLUNA: 3, ARMARIO: 2.2, ESTANTE: 2.3 };
const COR_DO_MOVEL: Record<string, string> = { PAREDE: SALAO.parede, MESA: "#3A2418", ARARA: "#C9A24A", COMODA: "#4A2E22", COLUNA: SALAO.detalhe, ARMARIO: ARQUIVO.detalhe, ESTANTE: "#5A4632" };

function Bloco({ c, altura, cor, y = 0 }: { c: Caixa; altura: number; cor: string; y?: number }) {
  return (
    <mesh position={[(c.x0 + c.x1) / 2, y + altura / 2, (c.z0 + c.z1) / 2]} castShadow receiveShadow>
      <boxGeometry args={[c.x1 - c.x0, altura, c.z1 - c.z0]} />
      <meshStandardMaterial color={cor} roughness={0.7} />
    </mesh>
  );
}

/** A arara: a barra dourada e as roupas penduradas (a caixa da colisão é a mesma de mundo.ts). */
function Arara() {
  const c = MOVEIS.find((m) => m.tipo === "ARARA")!.caixa;
  const z = (c.z0 + c.z1) / 2;
  const passo = (c.x1 - c.x0) / ROUPAS_DA_ARARA.length;
  return (
    <group name="arara">
      <mesh position={[(c.x0 + c.x1) / 2, 1.7, z]}>
        <boxGeometry args={[c.x1 - c.x0, 0.05, 0.05]} />
        <meshStandardMaterial color={SALAO.detalhe} metalness={0.6} roughness={0.3} />
      </mesh>
      {ROUPAS_DA_ARARA.map((cor, i) => (
        <mesh key={cor} position={[c.x0 + passo * (i + 0.5), 1.15, z]} castShadow>
          <boxGeometry args={[passo * 0.8, 1.05, 0.42]} />
          <meshStandardMaterial color={cor} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function aberto(sim: MutableRefObject<Simulacao>, id: string): boolean {
  const i = sim.current.estado.interativos.find((x) => x.id === id) as Interativo | undefined;
  return !!i && (i.tipo === "ITEM" ? i.coletado : i.aberta);
}

/** Algo que se mexe quando abre (porta, gaveta, portas do armário): `aplicar` recebe de 0 (fechado) a 1 (aberto). */
function useAbertura(sim: MutableRefObject<Simulacao>, id: string, reduzido: boolean, aplicar: (k: number) => void) {
  const k = useRef(0);
  useFrame((_, dt) => {
    const alvo = aberto(sim, id) ? 1 : 0;
    k.current = reduzido ? alvo : k.current + (alvo - k.current) * Math.min(1, dt * 5);
    aplicar(k.current);
  });
}

function Porta({ sim, reduzido }: { sim: MutableRefObject<Simulacao>; reduzido: boolean }) {
  const giro = useRef<THREE.Group>(null);
  useAbertura(sim, "PORTA", reduzido, (k) => giro.current && (giro.current.rotation.y = -k * 1.7));
  const largura = PORTA.x1 - PORTA.x0;
  return (
    <group ref={giro} position={[PORTA.x0, 0, -2.5]} name="porta">
      <mesh position={[largura / 2, 1.2, 0]} castShadow>
        <boxGeometry args={[largura, 2.4, 0.12]} />
        <meshStandardMaterial color={SALAO.detalhe} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[largura - 0.18, 1.1, 0.09]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color="#F4E3B0" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Gaveta({ sim, reduzido }: { sim: MutableRefObject<Simulacao>; reduzido: boolean }) {
  const g = useRef<THREE.Mesh>(null);
  useAbertura(sim, "GAVETA", reduzido, (k) => g.current && (g.current.position.z = -1.72 + k * 0.4));
  return (
    <mesh ref={g} position={[4.6, 0.7, -1.72]} name="gaveta" castShadow>
      <boxGeometry args={[0.9, 0.2, 0.5]} />
      <meshStandardMaterial color="#7A4E36" roughness={0.6} />
    </mesh>
  );
}

function PortasDoArmario({ sim, reduzido }: { sim: MutableRefObject<Simulacao>; reduzido: boolean }) {
  const esq = useRef<THREE.Group>(null);
  const dir = useRef<THREE.Group>(null);
  useAbertura(sim, "ARMARIO", reduzido, (k) => {
    if (esq.current) esq.current.rotation.y = k * 1.4;
    if (dir.current) dir.current.rotation.y = -k * 1.4;
  });
  const folha = (
    <mesh position={[0.34, 1.1, 0]} castShadow>
      <boxGeometry args={[0.68, 2.1, 0.06]} />
      <meshStandardMaterial color="#6F8090" roughness={0.5} metalness={0.3} />
    </mesh>
  );
  return (
    <group position={[0, 0, -6.37]} name="armario-portas">
      <group ref={esq} position={[-5.7, 0, 0]}>{folha}</group>
      <group ref={dir} position={[-4.3, 0, 0]} rotation={[0, Math.PI, 0]}>{folha}</group>
    </group>
  );
}

/** Kit de costura (lata rosa), carretel (dourado) ou dossiê (pasta): gira devagar até ser coletado. */
function Item({ sim, id, tipo, reduzido }: { sim: MutableRefObject<Simulacao>; id: string; tipo: string; reduzido: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.visible = !aberto(sim, id);
    if (!reduzido) g.current.rotation.y = clock.elapsedTime * 1.2;
  });
  const lugar = LUGAR[id];
  return (
    <group ref={g} position={[lugar.x, 0.35, lugar.z]} name={`item-${id}`}>
      {tipo === "KIT" && <mesh><cylinderGeometry args={[0.22, 0.22, 0.14, 20]} /><meshStandardMaterial color="#E86A9A" emissive="#E86A9A" emissiveIntensity={0.35} /></mesh>}
      {tipo === "CARRETEL" && <mesh><cylinderGeometry args={[0.12, 0.12, 0.3, 16]} /><meshStandardMaterial color="#F2C230" emissive="#F2C230" emissiveIntensity={0.35} metalness={0.5} /></mesh>}
      {tipo === "DOSSIE" && <mesh><boxGeometry args={[0.42, 0.06, 0.32]} /><meshStandardMaterial color="#1F7A76" emissive="#2FD1C6" emissiveIntensity={0.45} /></mesh>}
    </group>
  );
}

export function DemoSala3D({ sim, reduzido }: { sim: MutableRefObject<Simulacao>; reduzido: boolean }) {
  const w = LIMITES.x1 - LIMITES.x0;
  // o que não se mexe é a reserva da sala high poly (scripts/blender3d_high/salas/detetive_demo.py): mesmas caixas
  const procedural = (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (FRENTE - 2.5) / 2]} receiveShadow>
        <planeGeometry args={[w + 0.4, FRENTE + 2.5]} />
        <meshStandardMaterial color={SALAO.piso} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, (LIMITES.z0 - 2.5) / 2]} receiveShadow>
        <planeGeometry args={[w, -2.5 - LIMITES.z0]} />
        <meshStandardMaterial color={ARQUIVO.piso} roughness={0.9} />
      </mesh>
      <Bloco c={{ x0: LIMITES.x0, x1: LIMITES.x1, z0: LIMITES.z0 - 0.2, z1: LIMITES.z0 }} altura={ALTURA} cor={ARQUIVO.parede} />
      <Bloco c={{ x0: LIMITES.x0 - 0.2, x1: LIMITES.x0, z0: LIMITES.z0, z1: FRENTE }} altura={ALTURA} cor={SALAO.parede} />
      <Bloco c={{ x0: LIMITES.x1, x1: LIMITES.x1 + 0.2, z0: LIMITES.z0, z1: FRENTE }} altura={ALTURA} cor={SALAO.parede} />
      {/* o guarda-corpo da frente: até aqui se anda (a câmera fica atrás dele) */}
      <Bloco c={{ x0: LIMITES.x0, x1: LIMITES.x1, z0: LIMITES.z1 + 0.05, z1: LIMITES.z1 + 0.15 }} altura={0.3} cor={SALAO.detalhe} />
      {MOVEIS.filter((m) => m.tipo !== "ARARA").map((m) => <Bloco key={m.id} c={m.caixa} altura={ALTURA_DO_MOVEL[m.tipo] ?? 1} cor={COR_DO_MOVEL[m.tipo] ?? "#555"} />)}
      <Arara />
      <Bloco c={{ x0: PORTA.x0, x1: PORTA.x1, z0: PORTA.z0, z1: PORTA.z1 }} altura={0.6} cor={SALAO.detalhe} y={2.4} />
    </>
  );
  return (
    <group name="sala-demo">
      <SalaAlta slug="detetive-demo" reserva={procedural} />
      <Porta sim={sim} reduzido={reduzido} />
      <Gaveta sim={sim} reduzido={reduzido} />
      <PortasDoArmario sim={sim} reduzido={reduzido} />
      {sim.current.estado.interativos.filter((i) => i.tipo === "ITEM").map((i) => (
        <Item key={i.id} sim={sim} id={i.id} tipo={i.tipo === "ITEM" ? i.item : ""} reduzido={reduzido} />
      ))}
    </group>
  );
}
