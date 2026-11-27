"use client";
/**
 * ACERVO — as formas da peça na cena: pendurada (a silhueta da foto num cabide), dobrada (bloco de bordas arredondadas
 * com o tecido por cima) e calçado (o par, de perfil). Com a silhueta da foto ({@link Recorte}) a peça tem a forma dela;
 * sem, a silhueta da categoria ({@link contornoDaCategoria}) na cor da peça — nunca a foto inteira colada num bloco.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { contornoDaCategoria } from "@/lib/acervo/cena/formas";
import { painelDaSilhueta, type Recorte } from "@/lib/acervo/cena/silhueta";
import type { RoupaNaCena } from "@/lib/acervo/cena/roupas";

/** O que toda forma recebe: a malha principal tem o nome da peça, o material base e os eventos de clique. */
export interface FormaProps {
  nome: string;
  roupa: RoupaNaCena;
  base: THREE.Material;
  foto: THREE.Texture | null;
  recorte: Recorte | null;
  eventos: Record<string, unknown>;
}

const DE_LADO: [number, number, number] = [0, Math.PI / 2, 0];   // o painel na profundidade do móvel, como a peça no cabide
const ESPESSURA = 0.012;

function useDescartar<T extends { dispose(): void }>(coisa: T | null): T | null {
  useEffect(() => () => coisa?.dispose(), [coisa]);
  return coisa;
}

/** Plano com o trecho da textura onde está a peça. */
function useGeometriaDoPainel(recorte: Recorte, largura: number, altura: number) {
  const painel = useMemo(() => painelDaSilhueta(recorte, largura, altura), [recorte, largura, altura]);
  const geometria = useMemo(() => {
    const g = new THREE.PlaneGeometry(painel.w, painel.h);
    const { u0, u1, vBaixo, vCima } = painel.uv;
    g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, vCima, u1, vCima, u0, vBaixo, u1, vBaixo], 2));
    return g;
  }, [painel]);
  return { painel, geometria: useDescartar(geometria)! };
}

function useMaterialDaFoto(foto: THREE.Texture) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: foto, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }), [foto]);
  return useDescartar(material)!;
}

/** Silhueta da categoria com espessura de tecido, centrada. */
function useGeometriaDaCategoria(categoria: string, largura: number, altura: number) {
  const g = useMemo(() => {
    const e = new THREE.ExtrudeGeometry(contornoDaCategoria(categoria, largura, altura),
      { depth: ESPESSURA, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
    e.translate(0, 0, -ESPESSURA / 2);
    return e;
  }, [categoria, largura, altura]);
  return useDescartar(g)!;
}

function Cabide({ id, largura, y }: { id: string; largura: number; y: number }) {
  return (
    <group position={[0, y, 0]} name={`cabide-${id}`}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, largura * 0.8, 6]} />
        <meshStandardMaterial color="#9A9A9E" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={DE_LADO}>
        <torusGeometry args={[0.014, 0.0022, 6, 14, Math.PI * 1.3]} />
        <meshStandardMaterial color="#9A9A9E" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function PainelDaFoto({ nome, recorte, foto, largura, altura, y, eventos, x = 0 }: {
  nome: string; recorte: Recorte; foto: THREE.Texture; largura: number; altura: number; y: (h: number) => number;
  eventos: Record<string, unknown>; x?: number;
}) {
  const { painel, geometria } = useGeometriaDoPainel(recorte, largura, altura);
  const material = useMaterialDaFoto(foto);
  return <mesh name={nome} geometry={geometria} material={material} position={[x, y(painel.h), 0]} rotation={DE_LADO} castShadow
    userData={{ comFoto: true }} {...eventos} />;
}

export function Pendurada({ nome, roupa, base, foto, recorte, eventos }: FormaProps) {
  const [, altura, fundura] = roupa.tam;
  const largura = fundura * 0.95;
  const categoria = useGeometriaDaCategoria(roupa.categoria, largura * 0.9, altura);
  return (
    <>
      {!roupa.fantasma && <Cabide id={roupa.id} largura={largura} y={altura / 2} />}
      {foto && recorte
        ? <PainelDaFoto nome={nome} recorte={recorte} foto={foto} largura={largura} altura={altura} y={(h) => altura / 2 - h / 2} eventos={eventos} />
        : <mesh name={nome} geometry={categoria} material={base} rotation={DE_LADO} castShadow={!roupa.fantasma} userData={{ comFoto: false }} {...eventos} />}
    </>
  );
}

export function Dobrada({ nome, roupa, base, foto, recorte, eventos }: FormaProps) {
  const [w, h, d] = roupa.tam;
  const bloco = useDescartar(useMemo(() => new RoundedBoxGeometry(w, h, d, 2, Math.min(0.008, h / 2.5)), [w, h, d]))!;
  // o tecido por cima: o miolo da peça na foto (sem a borda nem o fundo), como a face de cima de uma peça dobrada
  const tecido = useDescartar(useMemo(() => {
    if (!foto || !recorte) return null;
    const [u0, v0, u1, v1] = recorte.caixa;
    const t = foto.clone();
    t.repeat.set((u1 - u0) * 0.45, (v1 - v0) * 0.45);
    t.offset.set((u0 + u1) / 2 - t.repeat.x / 2, 1 - (v0 + v1) / 2 - t.repeat.y / 2);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  }, [foto, recorte]));
  useEffect(() => () => tecido?.map?.dispose(), [tecido]);
  return (
    <>
      <mesh name={nome} geometry={bloco} material={base} castShadow={!roupa.fantasma} userData={{ comFoto: !!tecido }} {...eventos} />
      {tecido && <mesh name={`tecido-${roupa.id}`} position={[0, h / 2 + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={tecido}>
        <planeGeometry args={[w * 0.9, d * 0.9]} />
      </mesh>}
    </>
  );
}

export function Calcado({ nome, roupa, base, foto, recorte, eventos }: FormaProps) {
  const [w, h, d] = roupa.tam;
  const perfil = useGeometriaDaCategoria(roupa.categoria, d, h);
  const pe = (lado: number) => (lado < 0 ? nome : `par-${roupa.id}`);   // o par: só um pé leva o nome e o clique
  return (
    <>
      {[-1, 1].map((lado) => (foto && recorte
        ? <PainelDaFoto key={lado} nome={pe(lado)} recorte={recorte} foto={foto} largura={d} altura={h} x={(lado * w) / 4}
            y={(ph) => -h / 2 + ph / 2} eventos={lado < 0 ? eventos : {}} />
        : <mesh key={lado} name={pe(lado)} geometry={perfil} material={base} position={[(lado * w) / 4, 0, 0]} rotation={DE_LADO}
            castShadow={!roupa.fantasma} userData={{ comFoto: false }} {...(lado < 0 ? eventos : {})} />))}
    </>
  );
}
