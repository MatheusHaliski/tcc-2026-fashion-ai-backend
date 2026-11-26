"use client";
/**
 * O estádio do futebol de 5 (pedido da dona de 15/11/2026): gramado com listras de corte, todas as marcações do
 * futebol de 5 (linhas laterais e de fundo, meio-campo, círculo e marca central, as duas áreas em arco com a marca do
 * pênalti e a do segundo pênalti, os arcos de escanteio), bandeirinhas de escanteio, os dois bancos, o túnel, o telão
 * do placar, quatro torres de refletores e arquibancada em três lados com a torcida em degraus (gente leve, com roupa, pele e cabelo de cada um). As placas trazem só as
 * marcas inventadas do FashionAI. As medidas são as do campo (lib/flair/esporte/campo.ts) e das regras de futsal.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Torcida3D } from "@/components/flair/nucleos/gente/torcida-3d";
import { UNIFORME_VISITANTE, type Campo } from "@/lib/flair/esporte/campo";
import { humorDoLado } from "@/lib/flair/esporte/torcida";
import type { Lado } from "@/lib/flair/esporte/types";
import { reservasNoBanco, torcidaEmDegraus, type HumorDaTorcida } from "@/lib/flair/nucleos/gente/torcida";

/** O humor da torcida agora (lido a cada quadro pela arquibancada e pelos bancos). */
export type Humor = () => HumorDaTorcida | null;
const SEM_HUMOR: Humor = () => null;
/** Quantos reservas sentam em cada banco. */
export const RESERVAS_POR_BANCO = 4;

/** Raio da área (arco de 6 m), marca do pênalti (6 m) e do segundo pênalti (10 m), círculo central (3 m), escanteio (0,25 m). */
export const MARCAS = { area: 6, penalti: 6, segundoPenalti: 10, circulo: 3, escanteio: 0.25, faixa: 0.08 };
const LISTRAS = 10;
const CORES_DA_TORCIDA = ["#C6275E", "#1F7A76", "#FBE7EE", "#3A3550", "#F2C230", "#2A5FA8", "#E8E2D6"];

function Faixa({ x, z, c, l, cor, giro = 0 }: { x: number; z: number; c: number; l: number; cor: string; giro?: number }) {
  return (
    <mesh position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, giro]}>
      <planeGeometry args={[c, l]} />
      <meshBasicMaterial color={cor} />
    </mesh>
  );
}

function Arco({ x, z, raio, de, ate, cor }: { x: number; z: number; raio: number; de: number; ate: number; cor: string }) {
  return (
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[raio - MARCAS.faixa / 2, raio + MARCAS.faixa / 2, 48, 1, de, ate - de]} />
      <meshBasicMaterial color={cor} />
    </mesh>
  );
}

function Marca({ x, z, cor }: { x: number; z: number; cor: string }) {
  return (
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.12, 16]} />
      <meshBasicMaterial color={cor} />
    </mesh>
  );
}

/** As listras de corte do gramado: faixas alternadas de verde, de uma linha de fundo à outra. */
export function listras(campo: Campo): { x: number; largura: number; clara: boolean }[] {
  const largura = campo.comprimento / LISTRAS;
  return Array.from({ length: LISTRAS }, (_, i) => ({ x: -campo.comprimento / 2 + largura * (i + 0.5), largura, clara: i % 2 === 0 }));
}

export function Marcacoes({ campo }: { campo: Campo }) {
  const { comprimento: c, largura: l, linha: cor } = campo;
  const meio = c / 2;
  const f = MARCAS.faixa;
  return (
    <group name="marcacoes">
      {listras(campo).map((li) => (
        <mesh key={li.x} position={[li.x, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[li.largura, l]} />
          <meshStandardMaterial color={li.clara ? "#3A8F5A" : "#2E7D4F"} roughness={0.9} />
        </mesh>
      ))}
      <Faixa x={0} z={-l / 2} c={c} l={f} cor={cor} />
      <Faixa x={0} z={l / 2} c={c} l={f} cor={cor} />
      <Faixa x={-meio} z={0} c={f} l={l} cor={cor} />
      <Faixa x={meio} z={0} c={f} l={l} cor={cor} />
      <Faixa x={0} z={0} c={f} l={l} cor={cor} />
      <Arco x={0} z={0} raio={MARCAS.circulo} de={0} ate={Math.PI * 2} cor={cor} />
      <Marca x={0} z={0} cor={cor} />
      {([-1, 1] as const).map((lado) => (
        <group key={lado} name={`area-${lado}`}>
          {/* a área do futsal: dois quartos de círculo ligados por uma reta em frente ao gol */}
          <Arco x={lado * meio} z={-0.8} raio={MARCAS.area} de={lado === 1 ? Math.PI : -Math.PI / 2} ate={lado === 1 ? Math.PI * 1.5 : 0} cor={cor} />
          <Arco x={lado * meio} z={0.8} raio={MARCAS.area} de={lado === 1 ? Math.PI / 2 : 0} ate={lado === 1 ? Math.PI : Math.PI / 2} cor={cor} />
          <Faixa x={lado * (meio - MARCAS.area)} z={0} c={f} l={1.6} cor={cor} />
          <Marca x={lado * (meio - MARCAS.penalti)} z={0} cor={cor} />
          <Marca x={lado * (meio - MARCAS.segundoPenalti)} z={0} cor={cor} />
          {([-1, 1] as const).map((canto) => (
            <Arco key={canto} x={lado * meio} z={canto * (l / 2)} raio={MARCAS.escanteio} de={0} ate={Math.PI * 2} cor={cor} />
          ))}
        </group>
      ))}
    </group>
  );
}

function Bandeira({ x, z }: { x: number; z: number }) {
  return (
    <group name="bandeira" position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.2, 6]} />
        <meshStandardMaterial color="#F4F7F2" />
      </mesh>
      <mesh position={[0.18, 1.05, 0]}>
        <planeGeometry args={[0.34, 0.24]} />
        <meshStandardMaterial color="#F2C230" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** O banco de um time, com os reservas sentados de frente para o campo: reagem ao lance como a torcida (o visitante, ao contrário). */
function Banco({ x, z, lado, camisa, humor, reduzido }: { x: number; z: number; lado: Lado; camisa: string; humor: Humor; reduzido: boolean }) {
  const reservas = useMemo(() => reservasNoBanco(lado === "NOS" ? 11 : 12, RESERVAS_POR_BANCO, camisa), [lado, camisa]);
  return (
    <group name="banco" position={[x, 0, z]}>
      <group name={`reservas-${lado}`} rotation={[0, Math.PI, 0]}>
        <Torcida3D pessoas={reservas} reduzido={reduzido} humor={() => humorDoLado(humor(), lado)} />
      </group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[4, 0.12, 0.6]} />
        <meshStandardMaterial color="#3A3F47" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 0.35]}>
        <boxGeometry args={[4.2, 1.4, 0.06]} />
        <meshStandardMaterial color="#9FB3C8" transparent opacity={0.45} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[4.3, 0.06, 1.2]} />
        <meshStandardMaterial color="#9FB3C8" transparent opacity={0.45} roughness={0.1} />
      </mesh>
    </group>
  );
}

/** Uma torre de refletores: o poste e o painel de luzes, que ilumina o campo de fato. */
function Refletor({ x, z }: { x: number; z: number }) {
  return (
    <group name="refletor" position={[x, 0, z]}>
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 14, 8]} />
        <meshStandardMaterial color="#5A5F66" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 14.2, 0]}>
        <boxGeometry args={[2, 1, 0.3]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFF4D6" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 13.5, 0]} intensity={60} distance={45} color="#FFF4D6" />
    </group>
  );
}

/** Um setor da arquibancada: degraus e a torcida em humanos leves (components/flair/nucleos/gente/torcida-3d.tsx). */
export function Setor({ x, z, giro, comprimento, semente, reduzido, humor = SEM_HUMOR }: { x: number; z: number; giro: number; comprimento: number; semente: number; reduzido: boolean; humor?: Humor }) {
  const torcida = useMemo(() => torcidaEmDegraus(semente, comprimento, 5, CORES_DA_TORCIDA), [semente, comprimento]);
  return (
    <group name="setor" position={[x, 0, z]} rotation={[0, giro, 0]}>
      {[0, 1, 2, 3, 4].map((d) => (
        <mesh key={d} position={[0, 0.35 + d * 0.7, -0.4 - d * 0.95]} receiveShadow>
          <boxGeometry args={[comprimento, 0.7, 0.95]} />
          <meshStandardMaterial color={d % 2 ? "#2F3440" : "#363C49"} roughness={0.95} />
        </mesh>
      ))}
      <Torcida3D pessoas={torcida} reduzido={reduzido} humor={humor} />
      <mesh name="placas" position={[0, 0.45, 0.35]}>
        <boxGeometry args={[comprimento, 0.9, 0.1]} />
        <meshStandardMaterial color="#C6275E" emissive="#C6275E" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export function Estadio3D({ campo, reduzido = false, humor = SEM_HUMOR, camisa = "#1F7A76" }: { campo: Campo; reduzido?: boolean; humor?: Humor; camisa?: string }) {
  const { comprimento: c, largura: l } = campo;
  const fundo = l / 2 + 2.6;
  const lateral = c / 2 + 3.4;
  return (
    <group name="estadio">
      <Marcacoes campo={campo} />
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([a, b]) => <Bandeira key={`${a}${b}`} x={(a * c) / 2} z={(b * l) / 2} />)}
      <Banco x={-5} z={l / 2 + 1.4} lado="NOS" camisa={camisa} humor={humor} reduzido={reduzido} />
      <Banco x={5} z={l / 2 + 1.4} lado="ELES" camisa={UNIFORME_VISITANTE.camisa} humor={humor} reduzido={reduzido} />
      <mesh name="tunel" position={[0, 1.2, l / 2 + 2.2]}>
        <boxGeometry args={[3, 2.4, 1.6]} />
        <meshStandardMaterial color="#1F7A76" roughness={0.7} />
      </mesh>
      <Setor x={0} z={-fundo} giro={0} comprimento={c + 4} semente={1} reduzido={reduzido} humor={humor} />
      <Setor x={-lateral} z={0} giro={Math.PI / 2} comprimento={l + 2} semente={2} reduzido={reduzido} humor={humor} />
      <Setor x={lateral} z={0} giro={-Math.PI / 2} comprimento={l + 2} semente={3} reduzido={reduzido} humor={humor} />
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([a, b]) => <Refletor key={`${a}${b}`} x={a * (c / 2 + 5)} z={b * (l / 2 + 5)} />)}
      <group name="telao" position={[0, 9, -fundo - 5.2]}>
        <mesh>
          <boxGeometry args={[7, 3, 0.3]} />
          <meshStandardMaterial color="#11141A" emissive="#1F7A76" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -4.2, 0]}>
          <boxGeometry args={[0.3, 5.4, 0.3]} />
          <meshStandardMaterial color="#5A5F66" metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
