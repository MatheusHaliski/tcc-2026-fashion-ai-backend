"use client";
/**
 * O campo da transmissão: piso, linhas, o que há nas pontas de cada modalidade (traves, cestas, rede no meio, linha de
 * chegada, rampa), a arquibancada do outro lado e as placas da lateral, nas cores do FashionAI (sem marca real). Tudo
 * em primitivas, com as medidas de lib/flair/esporte/campo.ts.
 */
import { useMemo } from "react";
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

function Trave({ x, lado }: { x: number; lado: 1 | -1 }) {
  const fundo = x + lado * 0.9;
  return (
    <group name="trave">
      {[-1.5, 1.5].map((z) => (
        <mesh key={z} position={[x, 1, z]} castShadow>
          <boxGeometry args={[0.1, 2, 0.1]} />
          <meshStandardMaterial color={BRANCO} />
        </mesh>
      ))}
      <mesh position={[x, 2, 0]} castShadow>
        <boxGeometry args={[0.1, 0.1, 3.1]} />
        <meshStandardMaterial color={BRANCO} />
      </mesh>
      <mesh position={[fundo, 1, 0]}>
        <boxGeometry args={[0.04, 2, 3]} />
        <meshStandardMaterial color={BRANCO} transparent opacity={0.28} />
      </mesh>
    </group>
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

function Pontas({ campo }: { campo: Campo }) {
  const meio = campo.comprimento / 2;
  if (campo.alvo === "trave") return <><Trave x={-meio} lado={-1} /><Trave x={meio} lado={1} /></>;
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

/** Torcida sem rosto: blocos de cor em três degraus, do lado de lá do campo. */
function Arquibancada({ campo }: { campo: Campo }) {
  const lugares = useMemo(() => {
    const out: { x: number; y: number; z: number; cor: string }[] = [];
    const cores = ["#C6275E", "#1F7A76", "#FBE7EE", "#3A3550", "#F2C230"];
    const quantos = Math.floor(campo.comprimento / 1.1);
    for (let degrau = 0; degrau < 3; degrau++) {
      for (let i = 0; i < quantos; i++) {
        out.push({ x: -campo.comprimento / 2 + 0.6 + i * 1.1, y: 1.3 + degrau * 0.8, z: -campo.largura / 2 - 3.6 - degrau * 1.1, cor: cores[(i * 3 + degrau * 2) % cores.length] });
      }
    }
    return out;
  }, [campo]);
  const z = -campo.largura / 2 - 4.7;
  return (
    <group name="arquibancada">
      {[0, 1, 2].map((d) => (
        <mesh key={d} position={[0, 0.4 + d * 0.8, z + 1.1 - d * 1.1]} receiveShadow>
          <boxGeometry args={[campo.comprimento + 4, 0.8, 1.1]} />
          <meshStandardMaterial color="#2A2633" roughness={0.95} />
        </mesh>
      ))}
      {lugares.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]}>
          <boxGeometry args={[0.5, 0.7, 0.4]} />
          <meshStandardMaterial color={l.cor} roughness={0.9} />
        </mesh>
      ))}
      <mesh name="placas" position={[0, 0.45, -campo.largura / 2 - 1.6]}>
        <boxGeometry args={[campo.comprimento + 2, 0.9, 0.12]} />
        <meshStandardMaterial color="#C6275E" emissive="#C6275E" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

export function Campo3D({ campo }: { campo: Campo }) {
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
      {campo.alvo === "trave" && (
        <>
          <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.9, 3, 48]} />
            <meshBasicMaterial color={campo.linha} />
          </mesh>
          {[-1, 1].map((lado) => (
            <mesh key={lado} position={[(lado * c) / 2, 0.013, 0]} rotation={[-Math.PI / 2, 0, lado === 1 ? Math.PI / 2 : -Math.PI / 2]}>
              <ringGeometry args={[5.9, 6, 48, 1, 0, Math.PI]} />
              <meshBasicMaterial color={campo.linha} />
            </mesh>
          ))}
        </>
      )}
      {campo.alvo === "chegada" && [1, 2, 3].map((i) => <Linha key={i} x={0} z={-l / 2 + (i * l) / 4} largura={c} fundo={0.06} cor={campo.linha} />)}
      <Pontas campo={campo} />
      <Arquibancada campo={campo} />
    </group>
  );
}
