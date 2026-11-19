"use client";
/**
 * Torcida e plateia em humanos leves instanciados (nível TORCIDA de lib/flair/nucleos/gente/detalhe.ts): cabeça,
 * pescoço, cabelo, tronco, braços e pernas, com a roupa, a pele e o cabelo de cada um (lib/flair/nucleos/gente/torcida.ts).
 * Cinco malhas instanciadas desenham a arquibancada inteira (cinco chamadas de desenho, qualquer que seja o tamanho dela).
 * Quem torce acena de braços para cima, fora de fase; com "reduzir movimento", os braços ficam parados no alto.
 * Com `humor` (o que acabou de acontecer no jogo), a arquibancada reage: pula e comemora, aplaude ou baixa a cabeça,
 * cada pessoa no próprio atraso e com a própria força (lib/flair/nucleos/gente/torcida.ts).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { poseDaTorcida, REACAO_DA_TORCIDA_S, type HumorDaTorcida, type PessoaDaTorcida, type PoseDaTorcida } from "@/lib/flair/nucleos/gente/torcida";

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
const BASE = new THREE.Matrix4();
const AUX = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
/** Quanto o corpo de cima desce quando a pessoa está sentada (o banco de reservas). */
const ASSENTO = 0.43;
/** De quantos em quantos quadros a arquibancada que reage é reposta (a animação barata de quem está longe). */
const QUADROS_DA_REACAO = 2;
const PARADA: PoseDaTorcida = { bracos: 0, pulo: 0, inclina: 0 };
type Refs = Record<"tronco" | "pernas" | "cabeca" | "cabelo" | "bracos", React.RefObject<THREE.InstancedMesh | null>>;

/** As matrizes de uma pessoa nas cinco malhas, na pose dada. */
function posar(refs: Refs, i: number, p: PessoaDaTorcida, pose: PoseDaTorcida, soBracos = false) {
  const desce = p.sentada ? -ASSENTO : 0;
  BASE.compose(P.set(p.x, p.y + pose.pulo, p.z), Q.setFromEuler(E.set(pose.inclina, 0, 0)), S.setScalar(p.escala));
  refs.bracos.current?.setMatrixAt(i, M.copy(BASE).multiply(AUX.makeTranslation(0, OMBRO + desce, 0)).multiply(AUX.makeRotationX(pose.bracos)));
  if (soBracos) return;
  M.copy(BASE).multiply(AUX.makeTranslation(0, desce, 0));
  for (const k of ["tronco", "cabeca", "cabelo"] as const) refs[k].current?.setMatrixAt(i, M);
  refs.pernas.current?.setMatrixAt(i, M.copy(BASE).multiply(AUX.makeScale(1, p.sentada ? 0.5 : 1, 1)));
}

interface Props {
  pessoas: PessoaDaTorcida[];
  reduzido: boolean;
  calca?: string;
  /** o que a torcida faz por causa do jogo agora (lido a cada quadro); sem ele, só quem torce acena */
  humor?: () => HumorDaTorcida | null;
}

export function Torcida3D({ pessoas, reduzido, calca = "#2A2F3A", humor }: Props) {
  const g = useMemo(() => geometriasDaTorcida(), []);
  const mat = useMemo(() => ({ cor: new THREE.MeshStandardMaterial({ roughness: 0.85 }), calca: new THREE.MeshStandardMaterial({ color: calca, roughness: 0.9 }) }), [calca]);
  const refs: Refs = { tronco: useRef<THREE.InstancedMesh>(null), pernas: useRef<THREE.InstancedMesh>(null), cabeca: useRef<THREE.InstancedMesh>(null), cabelo: useRef<THREE.InstancedMesh>(null), bracos: useRef<THREE.InstancedMesh>(null) };
  /** a reação em curso: a chave dela, quando começou e se as matrizes do corpo ainda estão fora do repouso */
  const reacao = useRef({ chave: "", desde: 0, mexida: false, quadro: 0, t: 0 });
  const torcem = useMemo(() => pessoas.map((p, i) => (p.torce ? i : -1)).filter((i) => i >= 0), [pessoas]);
  useEffect(() => () => {
    for (const b of Object.values(g)) b.dispose();
    mat.cor.dispose();
    mat.calca.dispose();
  }, [g, mat]);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    pessoas.forEach((p, i) => {
      posar(refs, i, p, poseDaTorcida(p, 0, null, 0, true));
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
  useFrame((_, dt) => {
    const b = refs.bracos.current;
    if (!b) return;
    const r = reacao.current;
    // o relógio da torcida: soma os quadros (uma aba em segundo plano não faz a arquibancada saltar no tempo)
    r.t += Math.min(0.25, dt);
    const t = r.t;
    const agora = humor?.() ?? null;
    if ((agora?.chave ?? "") !== r.chave) {
      r.chave = agora?.chave ?? "";
      r.desde = t;
    }
    // a reação a um lance dura alguns segundos; a do fim de jogo (chave "fim") não acaba
    const vale = agora && (agora.chave === "fim" || t - r.desde < REACAO_DA_TORCIDA_S) ? agora : null;
    if (vale || r.mexida) {
      // a arquibancada inteira reage: reposta a cada dois quadros (com "reduzir movimento", uma vez, na pose do gesto)
      if (vale && r.mexida && (reduzido || ++r.quadro % QUADROS_DA_REACAO !== 0)) return;
      pessoas.forEach((p, i) => posar(refs, i, p, vale ? poseDaTorcida(p, t, vale, r.desde, reduzido) : reduzido ? poseDaTorcida(p, 0, null, 0, true) : PARADA));
      r.mexida = !!vale;
      for (const m of Object.values(refs)) if (m.current) m.current.instanceMatrix.needsUpdate = true;
      if (vale || reduzido) return;
    }
    if (reduzido) return;
    for (const i of torcem) posar(refs, i, pessoas[i], poseDaTorcida(pessoas[i], t), true);
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
