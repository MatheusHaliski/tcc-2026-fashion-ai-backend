"use client";
/**
 * Torcida e plateia em humanos leves instanciados (nível TORCIDA de lib/flair/nucleos/gente/detalhe.ts): cabeça,
 * pescoço, cabelo, tronco, braços e pernas, com a roupa, a pele e o cabelo de cada um (lib/flair/nucleos/gente/torcida.ts).
 * Cinco malhas instanciadas desenham a arquibancada inteira (cinco chamadas de desenho, qualquer que seja o tamanho dela).
 * Quem torce acena de braços para cima, fora de fase; com "reduzir movimento", os braços ficam parados no alto.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PessoaDaTorcida } from "@/lib/flair/nucleos/gente/torcida";

/** Altura do ombro (pivô dos braços), em metros, antes da escala de cada pessoa. */
const OMBRO = 1.38;

function capsula(raio: number, comprimento: number, x: number, y: number, z = 0): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(raio, comprimento, 1, 6);
  g.translate(x, y, z);
  return g;
}

function juntar(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const limpas = partes.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of limpas) {
    g.deleteAttribute("uv");
  }
  const out = mergeGeometries(limpas, false);
  for (const g of [...partes, ...limpas]) g.dispose();
  return out;
}

/** As cinco malhas de uma pessoa da torcida (pés na origem, de frente para +z). */
export function geometriasDaTorcida() {
  const tronco = juntar([capsula(0.17, 0.34, 0, 1.15), capsula(0.15, 0.12, 0, 0.88)]);
  const pernas = juntar([capsula(0.075, 0.68, -0.09, 0.42), capsula(0.075, 0.68, 0.09, 0.42)]);
  const cabeca = juntar([new THREE.SphereGeometry(0.11, 8, 6).translate(0, 1.62, 0.01), new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6, 1, true).translate(0, 1.48, 0)]);
  const cabelo = new THREE.SphereGeometry(0.118, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.635, -0.006);
  // braços pendurados do ombro (pivô na origem): o quadro gira em volta dele
  const bracos = juntar([capsula(0.055, 0.5, -0.22, -0.3), capsula(0.055, 0.5, 0.22, -0.3)]);
  return { tronco, pernas, cabeca, cabelo, bracos };
}

/** Triângulos de uma pessoa da torcida (todas as malhas). */
export function triangulosDaTorcida(): number {
  const g = geometriasDaTorcida();
  const conta = (b: THREE.BufferGeometry) => (b.index ? b.index.count : b.attributes.position.count) / 3;
  const total = Object.values(g).reduce((n, b) => n + conta(b), 0);
  for (const b of Object.values(g)) b.dispose();
  return total;
}

const M = new THREE.Matrix4();
const BRACO = new THREE.Matrix4();
const GIRO = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();

function corpo(p: PessoaDaTorcida, alvo: THREE.Matrix4) {
  return alvo.compose(P.set(p.x, p.y, p.z), Q.identity(), S.setScalar(p.escala));
}

/** Braços de quem torce (para cima, acenando) ou de quem só assiste (ao lado do corpo). */
function bracos(p: PessoaDaTorcida, t: number, parado: boolean, alvo: THREE.Matrix4) {
  const angulo = p.torce ? -2.7 + (parado ? 0 : Math.sin((t + p.fase) * 5) * 0.25) : 0;
  corpo(p, alvo);
  BRACO.makeTranslation(0, OMBRO, 0).multiply(GIRO.makeRotationX(angulo));
  return alvo.multiply(BRACO);
}

interface Props {
  pessoas: PessoaDaTorcida[];
  reduzido: boolean;
  calca?: string;
}

export function Torcida3D({ pessoas, reduzido, calca = "#2A2F3A" }: Props) {
  const g = useMemo(() => geometriasDaTorcida(), []);
  const mat = useMemo(() => ({ cor: new THREE.MeshStandardMaterial({ roughness: 0.85 }), calca: new THREE.MeshStandardMaterial({ color: calca, roughness: 0.9 }) }), [calca]);
  const refs = { tronco: useRef<THREE.InstancedMesh>(null), pernas: useRef<THREE.InstancedMesh>(null), cabeca: useRef<THREE.InstancedMesh>(null), cabelo: useRef<THREE.InstancedMesh>(null), bracos: useRef<THREE.InstancedMesh>(null) };
  const torcem = useMemo(() => pessoas.map((p, i) => (p.torce ? i : -1)).filter((i) => i >= 0), [pessoas]);
  useEffect(() => () => {
    for (const b of Object.values(g)) b.dispose();
    mat.cor.dispose();
    mat.calca.dispose();
  }, [g, mat]);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    pessoas.forEach((p, i) => {
      corpo(p, M);
      for (const k of ["tronco", "pernas", "cabeca", "cabelo"] as const) refs[k].current?.setMatrixAt(i, M);
      refs.bracos.current?.setMatrixAt(i, bracos(p, 0, true, M));
      refs.tronco.current?.setColorAt(i, c.set(p.roupa));
      refs.bracos.current?.setColorAt(i, c.set(p.roupa));
      refs.cabeca.current?.setColorAt(i, c.set(p.pele));
      refs.cabelo.current?.setColorAt(i, c.set(p.cabelo));
    });
    for (const r of Object.values(refs)) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
  }, [pessoas, g]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    const b = refs.bracos.current;
    if (!b || reduzido) return;
    for (const i of torcem) b.setMatrixAt(i, bracos(pessoas[i], clock.elapsedTime, false, M));
    b.instanceMatrix.needsUpdate = true;
  });
  const n = pessoas.length;
  return (
    <group name="torcida">
      <instancedMesh ref={refs.tronco} args={[g.tronco, mat.cor, n]} />
      <instancedMesh ref={refs.bracos} args={[g.bracos, mat.cor, n]} />
      <instancedMesh ref={refs.cabeca} args={[g.cabeca, mat.cor, n]} />
      <instancedMesh ref={refs.cabelo} args={[g.cabelo, mat.cor, n]} />
      <instancedMesh ref={refs.pernas} args={[g.pernas, mat.calca, n]} />
    </group>
  );
}
