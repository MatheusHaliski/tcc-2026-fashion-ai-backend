"use client";
/*
 * MET Gala Heist v2 — o skyline atrás da quadra, em duas camadas além dos prédios da avenida (exterior-city.tsx): torres
 * do meio (110–230 m, 40–160 m de altura) e de longe (250–430 m, até 320 m), nos quatro lados — o fim da avenida a leste e a
 * oeste, atrás da quadra ao sul e do outro lado do parque, ao norte. Janelas acesas em padrão irregular (andares de
 * escritório inteiros, apartamentos salpicados), coroamentos escalonados, mastros e as luzes vermelhas de aviso piscando.
 *
 * A névoa da cena apagaria tudo depois de ~150 m: aqui a névoa é própria (mais densa embaixo, puxada para o brilho quente
 * do horizonte), e cada camada é uma malha só com um material (duas chamadas de desenho para o skyline inteiro).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { boxGeo, merge } from "./exterior-geometry";
import { prng, type Quality } from "./exterior-textures";
import { skylineTex } from "./exterior-citytex";
import { GlowField, type GlowSpec } from "./exterior-glow";

const VERT = /* glsl */ `varying vec2 vUv; varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = /* glsl */ `uniform sampler2D map; uniform sampler2D emissive; uniform vec2 rep; uniform vec3 haze; uniform float hazeK; uniform float lit;
varying vec2 vUv; varying vec3 vW;
void main() {
  vec2 uv = vUv * rep;
  vec3 c = texture2D(map, uv).rgb * 0.5 + texture2D(emissive, uv).rgb * lit;
  float h = clamp((vW.y + 2.0) / 160.0, 0.0, 1.0);
  c = mix(c, haze, clamp(hazeK * (1.0 - 0.55 * h), 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Camada só da câmera principal: o reflexo da pista (MeshReflectorMaterial, câmera virtual só na camada 0) não redesenha o
 * skyline nem o parque — não aparecem no reflexo e custariam uma passada inteira. HeistExterior liga a camada na câmera. */
export const SKY_LAYER = 1;
/** Põe o grupo (e tudo dentro dele) só na camada do skyline. */
export function OnSkyLayer({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => { ref.current?.traverse((o) => o.layers.set(SKY_LAYER)); });
  return <group ref={ref}>{children}</group>;
}
interface Tower { x: number; z: number; w: number; d: number; h: number; crown: number; mast: boolean }
/** Torres de uma camada: anéis nos quatro lados, sem cair em cima da avenida, das transversais nem do parque. */
function towers(seed: number, r0: number, r1: number, h0: number, h1: number, n: number): Tower[] {
  const r = prng(seed), out: Tower[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 20) {
    const a = r() * Math.PI * 2, d = r0 + r() * (r1 - r0), x = Math.cos(a) * d * 1.25, z = 30 + Math.sin(a) * d;
    if (Math.abs(z - 38) < 18 || (Math.abs(z - 38) < 30 && Math.abs(x) < 160)) continue;   // o eixo da avenida fica aberto até o horizonte
    if (z < -20 && z > -110 && Math.abs(x) < 120) continue;                           // o parque
    const w = 18 + r() * 26, dd = 18 + r() * 26, h = h0 + Math.pow(r(), 1.6) * (h1 - h0);
    if (out.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 + 4 && Math.abs(t.z - z) < (t.d + dd) / 2 + 4)) continue;
    out.push({ x, z, w, d: dd, h, crown: r() < 0.45 ? 1 + Math.floor(r() * 3) : 0, mast: h > h0 + (h1 - h0) * 0.45 && r() < 0.7 });
  }
  return out;
}
function layerGeometry(list: Tower[], glows: GlowSpec[], blinkSeed: number) {
  const parts: THREE.BufferGeometry[] = [], r = prng(blinkSeed);
  for (const t of list) {
    const y0 = -2;
    parts.push(boxGeo(t.x - t.w / 2, y0, t.z - t.d / 2, t.x + t.w / 2, y0 + t.h, t.z + t.d / 2));
    let top = y0 + t.h, w = t.w, d = t.d;
    for (let k = 0; k < t.crown; k++) { w *= 0.72; d *= 0.72; const hh = 6 + r() * 10; parts.push(boxGeo(t.x - w / 2, top, t.z - d / 2, t.x + w / 2, top + hh, t.z + d / 2)); top += hh; }
    if (t.mast) { const mh = 14 + r() * 26; parts.push(boxGeo(t.x - 0.5, top, t.z - 0.5, t.x + 0.5, top + mh, t.z + 0.5)); top += mh; }
    if (t.h > 70 || t.mast) glows.push({ pos: new THREE.Vector3(t.x, top + 0.5, t.z), size: t.mast ? 5 : 3.5, color: "#ff2a1a", blink: r() < 0.5 ? 0 : 0.5 });
  }
  return merge(parts);
}

export function HeistSkyline({ q }: { q: Quality }) {
  const data = useMemo(() => {
    const glows: GlowSpec[] = [];
    const mid = layerGeometry(towers(601, 120, 230, 40, 160, q === "high" ? 70 : 45), glows, 7);
    const far = layerGeometry(towers(602, 250, 430, 70, 320, q === "high" ? 90 : 55), glows, 8);
    return { mid, far, glows };
  }, [q]);
  const mats = useMemo(() => {
    const mk = (seed: number, haze: string, hazeK: number, lit: number) => {
      const t = skylineTex(q, seed), map = t.map.clone(), em = t.emissive.clone();
      for (const x of [map, em]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.needsUpdate = true; }
      return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, fog: false, uniforms: { map: { value: map }, emissive: { value: em }, rep: { value: new THREE.Vector2(1 / t.meters[0], 1 / t.meters[1]) }, haze: { value: new THREE.Color(haze) }, hazeK: { value: hazeK }, lit: { value: lit } } });
    };
    return { mid: mk(611, "#232831", 0.5, 1.0), far: mk(612, "#2b2c33", 0.68, 0.85) };
  }, [q]);
  return (
    <group>
      <OnSkyLayer>
        <mesh geometry={data.mid} material={mats.mid} frustumCulled={false} />
        <mesh geometry={data.far} material={mats.far} frustumCulled={false} />
        <GlowField items={data.glows} fog={false} />
      </OnSkyLayer>
    </group>
  );
}
