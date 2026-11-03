/*
 * Avatar 3D — locomoção: vocabulário da dança da pista (andamento, passos de pé e estilos de braços por compasso).
 */
import * as THREE from "three";
import { type Rig, type Side, SIGN } from "./locomotion-model";
import { clamp, D, mix, smooth } from "./locomotion-math";
import { chest } from "./locomotion-kinematics";

/* ---------- pista de dança, DJ e comer ---------- */
/** Andamento da música da pista (batidas por minuto, o mesmo das luzes da pista em salao-dj.ts): o relógio comum de quem
 * dança e do DJ é MotionInput.time (o tempo da cena). */
export const DANCE_BPM = 122;
/** Batida no relógio comum (contagem contínua: 0, 1, 2… a cada batida). */
export const danceBeat = (time: number) => (time * DANCE_BPM) / 60;

/** Passos de pé: balanço no lugar, passo e junta de lado, passo à frente e volta, giro dos calcanhares (twist). */
export const STEPS = ["bounce", "side", "rock", "twist"] as const;
export type Steps = typeof STEPS[number];
/** Braços: soco no ar, mãos para o alto, cotovelos dobrados, palmas, apontar (disco), mãos para o par. */
export const ARMS = ["pump", "up", "elbows", "clap", "point", "partner"] as const;
type Arms = typeof ARMS[number];

/** Pés no apoio da dança (posição do tornozelo, ponta e giro do pé) e o quadril sobre eles. */
interface Footwork { x: [number, number]; z: [number, number]; lift: [number, number]; pitch: [number, number]; turn: [number, number]; hx: number; hz: number; twist: number }
export const FW: [Footwork, Footwork] = [0, 1].map(() => ({ x: [0, 0], z: [0, 0], lift: [0, 0], pitch: [0, 0], turn: [0, 0], hx: 0, hz: 0, twist: 0 })) as [Footwork, Footwork];
/** Mãos de um estilo de braços: alvo do punho, dedos, palma e fechamento, por lado. */
interface ArmSet { t: [THREE.Vector3, THREE.Vector3]; f: [THREE.Vector3, THREE.Vector3]; n: [THREE.Vector3, THREE.Vector3]; curl: [number, number]; pole: [THREE.Vector3, THREE.Vector3] }
const newArmSet = (): ArmSet => ({ t: [new THREE.Vector3(), new THREE.Vector3()], f: [new THREE.Vector3(), new THREE.Vector3()], n: [new THREE.Vector3(), new THREE.Vector3()], curl: [0, 0], pole: [new THREE.Vector3(), new THREE.Vector3()] });
export const AS: [ArmSet, ArmSet] = [newArmSet(), newArmSet()];

/** Passo que vai de `a` a `b` dentro da batida (u de 0 a 1): pé sobe no meio e pousa na batida seguinte. */
function stepArc(a: number, b: number, u: number): { p: number; lift: number } {
  const e = smooth(0.08, 0.92, u);
  return { p: mix(a, b, e), lift: Math.sin(Math.PI * clamp(u, 0, 1)) };
}

/**
 * Pés de um estilo no compasso (c de 0 a 4 batidas), em metros em torno da posição de dança de cada pé. Todo estilo
 * começa e termina o compasso com os pés no lugar: a troca de estilo (no começo de um bloco) não arrasta pé.
 */
export function footwork(style: Steps, c: number, bar: number, k: number, out: Footwork) {
  out.x[0] = out.x[1] = out.z[0] = out.z[1] = out.lift[0] = out.lift[1] = out.pitch[0] = out.pitch[1] = out.turn[0] = out.turn[1] = 0;
  out.hx = 0; out.hz = 0; out.twist = 0;
  const beat = Math.floor(c), u = c - beat;
  switch (style) {
    case "bounce": {
      // no lugar: o peso passa de um pé ao outro a cada batida e o calcanhar do pé livre sobe
      const free: Side = beat % 2 ? 1 : 0, heel = Math.sin(Math.PI * u) * (0.6 + 0.4 * k);
      out.pitch[free] = 16 * D * heel; out.hx = -SIGN[free] * 0.03 * k * Math.sin(Math.PI * u);
      break;
    }
    case "side": {
      // passo e junta: o pé da frente sai (1), o outro junta (2), sai de volta (3) e o primeiro junta (4); o compasso par
      // vai para a direita da pessoa (pé direito na frente) e o ímpar para a esquerda (pé esquerdo) — sempre de volta ao lugar
      const lead: Side = bar % 2 ? 0 : 1, other: Side = lead ? 0 : 1, W = SIGN[lead] * (0.13 + 0.09 * k);
      const P1 = beat === 0 ? stepArc(0, W, u) : beat === 3 ? stepArc(W, 0, u) : { p: beat === 1 || beat === 2 ? W : 0, lift: 0 };
      const P2 = beat === 1 ? stepArc(0, W, u) : beat === 2 ? stepArc(W, 0, u) : { p: 0, lift: 0 };
      out.x[lead] = P1.p; out.x[other] = P2.p; out.lift[lead] = P1.lift; out.lift[other] = P2.lift;
      out.hx = (W / 2) * (1 - Math.cos((Math.PI * c) / 2)); out.twist = SIGN[other] * 5 * D * Math.sin((Math.PI * c) / 2);
      break;
    }
    case "rock": {
      // passo à frente na batida 1, peso nele na 2, volta na 3, toque do outro pé na 4 (compasso ímpar: o outro pé)
      const s: Side = bar % 2 ? 0 : 1, o: Side = s ? 0 : 1, L = 0.12 + 0.08 * k;
      const S = beat === 0 ? stepArc(0, L, u) : beat === 1 ? { p: L, lift: 0 } : beat === 2 ? stepArc(L, 0, u) : { p: 0, lift: 0 };
      out.z[s] = S.p; out.lift[s] = S.lift * 0.7;
      out.hz = L * 0.55 * (beat === 0 ? smooth(0.3, 1, u) : beat === 1 ? 1 : beat === 2 ? 1 - smooth(0, 0.7, u) : 0);
      out.hx = SIGN[s] * 0.025 * (beat === 1 ? 1 : 0);
      if (beat === 3) out.pitch[o] = 22 * D * Math.sin(Math.PI * u);                // toque do outro pé (calcanhar sobe)
      out.twist = -SIGN[s] * 7 * D * (beat === 1 ? 1 : beat === 0 ? u : beat === 2 ? 1 - u : 0);
      break;
    }
    case "twist": {
      // os dois pés giram sobre a ponta, para um lado e para o outro a cada batida; o quadril gira ao contrário
      const a = Math.sin(Math.PI * c) * (16 + 12 * k) * D;
      out.turn[0] = out.turn[1] = a; out.twist = -a * 0.8;
      out.pitch[0] = out.pitch[1] = 8 * D * Math.abs(Math.sin(Math.PI * c));
      break;
    }
  }
}

/** Mãos de um estilo de braços no compasso (alvos relativos ao peito: acompanham o tronco). */
export function armStyle(r: Rig, style: Arms, c: number, k: number, seed: number, out: ArmSet) {
  const beat = Math.floor(c), u = c - beat, on = Math.cos(2 * Math.PI * c) * 0.5 + 0.5;   // 1 na batida
  const sway = Math.sin((Math.PI * c) / 2);                                            // um lado por compasso de 2
  for (const s of [0, 1] as Side[]) { out.curl[s] = 0.3; out.pole[s].set(SIGN[s] * 0.8, -1, -0.3); }
  const set = (s: Side, x: number, y: number, z: number, fx: number, fy: number, fz: number, nx: number, ny: number, nz: number) => {
    chest(r, x, y, z, out.t[s]); out.f[s].set(fx, fy, fz); out.n[s].set(nx, ny, nz);
  };
  switch (style) {
    case "pump": {
      // punho direito sobe no ar chegando na batida e desce devagar; a esquerda dobrada junto ao peito
      const up = (0.35 + 0.15 * k) * Math.max(smooth(0.7, 1, u), 1 - smooth(0, 0.5, u)) + 0.05;
      set(1, -0.2, 0.22 + up, 0.22, -0.1, 1, 0.2, 0.9, 0, -0.3); out.curl[1] = 1; out.pole[1].set(-1, -0.3, -0.5);
      set(0, 0.17, -0.12 + 0.04 * on, 0.25, -0.5, 0.6, 0.6, -0.6, 0, -0.8); out.curl[0] = 0.75;
      break;
    }
    case "up": {
      // as duas mãos no alto, balançando de um lado ao outro com o quadril
      for (const s of [0, 1] as Side[]) {
        set(s, SIGN[s] * (0.2 + 0.05 * k) + 0.12 * sway, 0.62 + 0.06 * on - 0.03 * s, 0.12 + 0.04 * s, SIGN[s] * 0.2 + 0.4 * sway, 1, 0.1, 0, 0.2, 1);
        out.curl[s] = 0.15; out.pole[s].set(SIGN[s], -0.3, -0.6);
      }
      break;
    }
    case "elbows": {
      // braços dobrados em 90° à frente, indo e vindo em oposição (o jeito de dançar mais comum na pista)
      for (const s of [0, 1] as Side[]) {
        const fw = (s ? 1 : -1) * Math.sin(Math.PI * c);
        set(s, SIGN[s] * 0.2, -0.18 + 0.05 * fw * k, 0.24 + 0.07 * fw * k, -SIGN[s] * 0.3, 0.6, 0.75, -SIGN[s] * 0.8, 0, -0.5);
        out.curl[s] = 0.7;
      }
      break;
    }
    case "clap": {
      // palmas nas batidas 2 e 4: as mãos se encontram à frente do peito
      const meet = beat % 2 ? 1 - smooth(0, 0.45, u) : smooth(0.55, 1, u);
      for (const s of [0, 1] as Side[]) {
        set(s, SIGN[s] * mix(0.22, 0.035, meet), -0.02 + 0.06 * meet, 0.3 + 0.04 * meet, 0, 0.75, 0.6, -SIGN[s], 0, 0);
        out.curl[s] = 0.1; out.pole[s].set(SIGN[s], -1, -0.2);
      }
      break;
    }
    case "point": {
      // apontar (disco): direita no alto em diagonal na batida 1, cruzando para baixo na 3; a esquerda na cintura
      const hi = beat < 2 ? 1 - smooth(0.6, 1, c - 1) : smooth(0.6, 1, c - 3);
      set(1, mix(0.1, -0.42, hi), mix(-0.32, 0.62, hi), mix(0.3, 0.2, hi), mix(0.3, -0.5, hi), mix(-0.8, 0.85, hi), 0.3, 0.9, 0, 0); out.curl[1] = 0.8;
      out.pole[1].set(-1, -0.4, -0.4);
      set(0, 0.24, -0.34, 0.06, 0.2, -0.9, 0.3, -0.3, 0, 1); out.curl[0] = 0.4; out.pole[0].set(1, 0, -1);
      break;
    }
    case "partner": {
      // mãos à frente na altura da cintura, como quem segura as mãos do par, balançando no ritmo
      for (const s of [0, 1] as Side[]) {
        set(s, SIGN[s] * 0.2 + 0.04 * sway, -0.3 + 0.03 * on, 0.36, 0, -0.1, 1, -SIGN[s] * 0.3, 0.9, 0); out.curl[s] = 0.35;
      }
      break;
    }
  }
  void seed;
}
