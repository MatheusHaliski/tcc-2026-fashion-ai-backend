/*
 * Avatar 3D (RF40) — movimento do cabelo (HAIR-MOTION): vento e o atraso dos gestos, calculados na GPU.
 *
 *  - Cada vértice do cabelo carrega `hairS`, a distância (m) da raiz ao longo do fio: nos fios, o comprimento do arco;
 *    na base, 0 no couro cabeludo e, na cortina do cabelo médio/longo, a altura abaixo da orelha (+ o trecho do crânio).
 *  - O deslocamento cresce com (s/alcance)^1,5: raiz presa, ponta solta, como uma haste flexível.
 *  - Soma dois termos, os dois no espaço do objeto do cabelo:
 *      vento — direção e força (m de deslocamento na ponta), com rajadas lentas e tremulação rápida, de fase pela
 *              posição (ondas que correm pelo cabelo, as mechas não andam juntas);
 *      atraso — uma mola amortecida segue um ponto da massa do cabelo (abaixo e atrás do centro da cabeça): quando a
 *              cabeça gira, inclina ou o corpo troca o apoio, as pontas ficam para trás e voltam com um leve balanço.
 *  - Nunca empurra para dentro da cabeça ou do corpo: a componente contra a normal é retirada.
 * Sem física por fio (custo zero na CPU além da mola); "reduzir movimento" zera vento e atraso.
 */
import * as THREE from "three";

export interface HairMotionUniforms {
  hairTime: { value: number };
  hairWind: { value: THREE.Vector3 };
  hairLag: { value: THREE.Vector3 };
  hairReach: { value: number };
}

export function hairMotionUniforms(): HairMotionUniforms {
  return { hairTime: { value: 0 }, hairWind: { value: new THREE.Vector3() }, hairLag: { value: new THREE.Vector3() }, hairReach: { value: 0.32 } };
}

/** Trecho de vertex shader injetado depois do skinning (posição já deformada pelo esqueleto, espaço do objeto). */
export const HAIR_MOTION_VERTEX = /* glsl */ `
#include <skinning_vertex>
{
  float hs = max( hairS, 0.0 );
  float ha = pow( clamp( hs / hairReach, 0.0, 1.0 ), 1.5 );
  if ( ha > 0.0 ) {
    float ph = dot( transformed, vec3( 9.1, 5.3, 7.7 ) );
    float gust = 0.62 + 0.24 * sin( hairTime * 1.1 + ph * 0.35 ) + 0.14 * sin( hairTime * 2.9 + ph * 0.8 );
    float wl = length( hairWind );
    vec3 flutter = vec3( sin( hairTime * 5.3 + ph ), 0.35 * sin( hairTime * 4.1 + ph * 1.3 ), cos( hairTime * 4.7 + ph * 0.7 ) ) * wl * 0.16;
    vec3 hd = ( hairWind * gust + flutter + hairLag ) * ha;
    vec3 hn = normalize( objectNormal );
    float into = dot( hd, hn );
    if ( into < 0.0 ) hd -= into * hn;
    transformed += hd;
  }
}
`;

const DECL = "attribute float hairS;\nuniform float hairTime;\nuniform vec3 hairWind;\nuniform vec3 hairLag;\nuniform float hairReach;\n";

/** Liga o movimento num material do cabelo (mantém o onBeforeCompile que ele já tenha, como o brilho de fio). */
export function patchHairMotion(m: THREE.Material, u: HairMotionUniforms): void {
  if (m.userData.hairMotion) return;
  const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = DECL + shader.vertexShader.replace("#include <skinning_vertex>", HAIR_MOTION_VERTEX);
  };
  m.customProgramCacheKey = () => prevKey() + "|fai-hair-motion";
  m.userData.hairMotion = true; m.needsUpdate = true;
}

/**
 * `hairS` de uma malha de cabelo só com a base (sem fios) ou da parte da base numa malha com fios: 0 acima da orelha;
 * abaixo dela, a descida + o trecho do crânio (o fio que chega ali já percorreu ~10 cm desde a raiz).
 */
export function baseHairS(position: ArrayLike<number>, count: number, earY: number): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) { const d = earY + 0.01 - position[i * 3 + 1]; out[i] = d > 0 ? d + 0.1 : 0; }
  return out;
}

/**
 * Mola do atraso: segue o ponto-âncora (mundo) e devolve o atraso (mundo, m) = posição da mola − âncora, limitado.
 * Levemente sub-amortecida: as pontas passam um pouco e voltam, sem ficar balançando.
 */
export class HairSpring {
  private p = new THREE.Vector3(); private v = new THREE.Vector3(); private ready = false;
  readonly lag = new THREE.Vector3();
  constructor(private readonly k = 55, private readonly damping = 0.42, private readonly max = 0.045) {}
  step(dt: number, anchor: THREE.Vector3): THREE.Vector3 {
    if (!this.ready || dt <= 0 || dt > 0.25) { this.p.copy(anchor); this.v.set(0, 0, 0); this.ready = true; this.lag.set(0, 0, 0); return this.lag; }
    const c = 2 * Math.sqrt(this.k) * this.damping; const n = Math.max(1, Math.ceil(dt / (1 / 120))); const h = dt / n;
    const acc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      acc.copy(anchor).sub(this.p).multiplyScalar(this.k).addScaledVector(this.v, -c);
      this.v.addScaledVector(acc, h); this.p.addScaledVector(this.v, h);
    }
    this.lag.copy(this.p).sub(anchor);
    if (this.lag.length() > this.max) { this.lag.setLength(this.max); this.p.copy(anchor).add(this.lag); }
    return this.lag;
  }
  reset() { this.ready = false; this.lag.set(0, 0, 0); }
}

/** Vento do ambiente: brisa de frente-esquerda que joga o cabelo para trás. `strength` 0–1 → até 3 cm na ponta. */
export function windVector(strength: number, dir: [number, number, number] = [0.35, 0.04, -1]): THREE.Vector3 {
  return new THREE.Vector3(...dir).normalize().multiplyScalar(0.03 * Math.max(0, Math.min(1, strength)));
}
