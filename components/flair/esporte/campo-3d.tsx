"use client";
/**
 * O campo da transmissão (o futebol tem o estádio próprio, components/flair/esporte/estadio-3d.tsx): piso, linhas, o que há nas pontas de cada modalidade (traves, cestas, rede no meio, linha de
 * chegada, rampa), a arquibancada do outro lado com a torcida em gente leve instanciada (a mesma do estádio: reage ao
 * lance) e as placas da lateral, nas cores do FashionAI (sem marca real). Tudo em primitivas, com as medidas de
 * lib/flair/esporte/campo.ts.
 */
import { Estadio3D, Setor, type Humor } from "@/components/flair/esporte/estadio-3d";
import { Gol3D, type Batida } from "@/components/flair/esporte/gol-3d";
import type { Campo } from "@/lib/flair/esporte/campo";

const BRANCO = "#F4F7F2";

function Linha({ x, z, largura, fundo, cor }: { x: number; z: number; largura: number; fundo: number; cor: string }) {
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[largura, fundo]} />
      <meshBasicMaterial color={cor} />
    </mesh>
  );
}

function Cesta({ x, lado }: { x: number; lado: 1 | -1 }) {
  return (
    <group name="cesta">
      <mesh position={[x + lado * 0.5, 1.6, 0]} castShadow>
        <boxGeometry args={[0.12, 3.2, 0.12]} />
        <meshStandardMaterial color="#3A3F47" />
      </mesh>
      <mesh position={[x + lado * 0.2, 3.3, 0]}>
        <boxGeometry args={[0.06, 1.05, 1.8]} />
        <meshStandardMaterial color={BRANCO} />
      </mesh>
      <mesh position={[x - lado * 0.2, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.025, 8, 20]} />
        <meshStandardMaterial color="#E8722A" />
      </mesh>
    </group>
  );
}

function Pontas({ campo, batida, reduzido }: { campo: Campo; batida: () => Batida | null; reduzido: boolean }) {
  const meio = campo.comprimento / 2;
  if (campo.alvo === "trave") {
    return (
      <>
        <Gol3D nome="gol-esquerda" x={-meio} lado={-1} batida={batida} reduzido={reduzido} />
        <Gol3D nome="gol-direita" x={meio} lado={1} batida={batida} reduzido={reduzido} />
      </>
    );
  }
  if (campo.alvo === "cesta") return <><Cesta x={-meio} lado={-1} /><Cesta x={meio} lado={1} /></>;
  if (campo.alvo === "rede") {
    const altura = campo.codigo === "TENIS" ? 0.95 : 2.3;
    return (
      <mesh name="rede" position={[0, altura / 2 + (campo.codigo === "TENIS" ? 0 : 0.6), 0]}>
        <boxGeometry args={[0.05, campo.codigo === "TENIS" ? altura : 1, campo.largura + 0.6]} />
        <meshStandardMaterial color={BRANCO} transparent opacity={0.7} />
      </mesh>
    );
  }
  if (campo.alvo === "chegada") return <Linha x={meio - 1.5} z={0} largura={0.5} fundo={campo.largura} cor="#F2C230" />;
  return (
    <mesh name="rampa" position={[meio - 3, 0.6, 0]} rotation={[0, 0, 0.35]} castShadow>
      <boxGeometry args={[5, 0.15, campo.largura * 0.5]} />
      <meshStandardMaterial color="#6B6E73" />
    </mesh>
  );
}

const SEM_BATIDA = () => null;

/** `batida`: a bola na rede (só no futebol); `reduzido`: a rede estufa sem balançar; `humor`: o que a torcida faz agora. */
export function Campo3D({ campo, batida = SEM_BATIDA, reduzido = false, humor, camisa }: { campo: Campo; batida?: () => Batida | null; reduzido?: boolean; humor?: Humor; camisa?: string }) {
  if (campo.alvo === "trave") {
    return (
      <group name="campo">
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[campo.comprimento + 30, campo.largura + 30]} />
          <meshStandardMaterial color="#20242B" roughness={1} />
        </mesh>
        <Estadio3D campo={campo} reduzido={reduzido} humor={humor} camisa={camisa} />
        <Pontas campo={campo} batida={batida} reduzido={reduzido} />
      </group>
    );
  }
  const { comprimento: c, largura: l } = campo;
  return (
    <group name="campo">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[c + 12, l + 14]} />
        <meshStandardMaterial color="#20242B" roughness={1} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[c, l]} />
        <meshStandardMaterial color={campo.piso} roughness={0.85} />
      </mesh>
      <Linha x={0} z={-l / 2} largura={c} fundo={0.1} cor={campo.linha} />
      <Linha x={0} z={l / 2} largura={c} fundo={0.1} cor={campo.linha} />
      <Linha x={-c / 2} z={0} largura={0.1} fundo={l} cor={campo.linha} />
      <Linha x={c / 2} z={0} largura={0.1} fundo={l} cor={campo.linha} />
      <Linha x={0} z={0} largura={0.1} fundo={l} cor={campo.linha} />
      {campo.alvo === "chegada" && [1, 2, 3].map((i) => <Linha key={i} x={0} z={-l / 2 + (i * l) / 4} largura={c} fundo={0.06} cor={campo.linha} />)}
      <Pontas campo={campo} batida={batida} reduzido={reduzido} />
      <Setor x={0} z={-l / 2 - 2.6} giro={0} comprimento={c + 4} semente={4} reduzido={reduzido} humor={humor} />
    </group>
  );
}
