"use client";
/*
 * MET Gala Heist v2 — brilhos e poças de luz da cena de fora numa chamada de desenho cada:
 *  - GlowField: halos de lâmpada, neon, faróis, luzes de aviso das torres (piscando) e flashes (intensidade por quadro),
 *    todos virados para a câmera no próprio shader (sem um sprite por luz);
 *  - PoolField: as poças de luz no chão (postes, vitrines, barraca), elípticas e giradas, recortadas por faixa de z para
 *    não subirem o degrau do meio-fio (calçada × pista).
 * Somam luz (aditivos) e somem na névoa da cena como o resto.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { glowTex } from "./exterior-textures";

export interface GlowSpec { pos: THREE.Vector3; size: number; color: string | THREE.Color; /** fase (0–1) do pisca de 2 s; sem = aceso */ blink?: number; strength?: number }

const GLOW_VERT = /* glsl */ `attribute vec2 corner; attribute vec3 tint; attribute float size; attribute float blink; attribute float strength;
uniform float time; uniform float fogDensity; varying vec2 vUv; varying vec3 vTint;
void main() {
  vUv = corner + 0.5;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += corner * size;
  gl_Position = projectionMatrix * mv;
  float a = strength;
  if (blink >= 0.0) { float t = fract(time * 0.5 + blink); a *= smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.22, 0.3, t)); }
  float d = -mv.z, f = exp(-fogDensity * fogDensity * d * d);
  vTint = tint * a * f;
}`;
const GLOW_FRAG = /* glsl */ `uniform sampler2D map; varying vec2 vUv; varying vec3 vTint;
void main() { float g = texture2D(map, vUv).a; gl_FragColor = vec4(vTint * g, 1.0); }   // o brilho está no alfa da textura`;

/** Brilhos virados para a câmera. `strengths` (opcional) muda a intensidade de cada um por quadro (flashes). */
export function GlowField({ items, fog = true, kind = "soft", strengths, renderOrder = 3 }: { items: GlowSpec[]; fog?: boolean; kind?: "soft" | "star"; strengths?: React.MutableRefObject<Float32Array | null>; renderOrder?: number }) {
  const { scene } = useThree();
  const { geo, mat } = useMemo(() => {
    const n = items.length, pos = new Float32Array(n * 12), corner = new Float32Array(n * 8), tint = new Float32Array(n * 12), size = new Float32Array(n * 4), blink = new Float32Array(n * 4), strength = new Float32Array(n * 4), idx: number[] = [];
    const C = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    items.forEach((it, i) => {
      const c = it.color instanceof THREE.Color ? it.color : new THREE.Color(it.color);
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        pos.set([it.pos.x, it.pos.y, it.pos.z], v * 3); corner.set(C[k], v * 2); tint.set([c.r, c.g, c.b], v * 3);
        size[v] = it.size; blink[v] = it.blink ?? -1; strength[v] = it.strength ?? 1;
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("corner", new THREE.BufferAttribute(corner, 2));
    g.setAttribute("tint", new THREE.BufferAttribute(tint, 3)); g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("blink", new THREE.BufferAttribute(blink, 1)); g.setAttribute("strength", new THREE.BufferAttribute(strength, 1));
    g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const m = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: glowTex(kind) }, time: { value: 0 }, fogDensity: { value: 0 } } });
    return { geo: g, mat: m };
  }, [items, kind]);
  useFrame(({ clock }) => {
    mat.uniforms.time.value = clock.elapsedTime;
    mat.uniforms.fogDensity.value = fog && scene.fog instanceof THREE.FogExp2 ? scene.fog.density : 0;
    const s = strengths?.current;
    if (s) { const a = geo.getAttribute("strength") as THREE.BufferAttribute; for (let i = 0; i < s.length && i * 4 < a.count; i++) for (let k = 0; k < 4; k++) a.setX(i * 4 + k, s[i]); a.needsUpdate = true; }
  });
  if (!items.length) return null;
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={renderOrder} />;
}

export interface PoolSpec { pos: THREE.Vector3; rx: number; rz: number; rot?: number; color: string; s: number; /** recorte em z (calçada × pista) */ z0?: number; z1?: number }
const POOL_VERT = /* glsl */ `attribute vec3 center; attribute vec3 shape; attribute vec3 tint; attribute vec2 zr; varying vec3 vW; varying vec3 vC; varying vec3 vShape; varying vec3 vTint; varying vec2 vZr; varying float vFogDepth;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = center; vShape = shape; vTint = tint; vZr = zr; vec4 mv = viewMatrix * w; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const POOL_FRAG = /* glsl */ `uniform float fogDensity; varying vec3 vW; varying vec3 vC; varying vec3 vShape; varying vec3 vTint; varying vec2 vZr; varying float vFogDepth;
void main() {
  if (vW.z < vZr.x || vW.z > vZr.y) discard;
  vec2 d = vW.xz - vC.xz; float c = cos(vShape.z), s = sin(vShape.z);
  vec2 l = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / vShape.xy;
  float a = pow(max(0.0, 1.0 - length(l)), 2.0);
  float f = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  gl_FragColor = vec4(vTint * a * f, 1.0);
}`;
/** Poças de luz no chão, todas numa malha (quadrado deitado do tamanho da elipse, girado junto). */
export function PoolField({ items }: { items: PoolSpec[] }) {
  const { scene } = useThree();
  const { geo, mat } = useMemo(() => {
    const n = items.length, pos = new Float32Array(n * 12), center = new Float32Array(n * 12), shape = new Float32Array(n * 12), tint = new Float32Array(n * 12), zr = new Float32Array(n * 8), idx: number[] = [];
    items.forEach((p, i) => {
      const c = new THREE.Color(p.color).multiplyScalar(p.s), rot = p.rot ?? 0, cs = Math.cos(rot), sn = Math.sin(rot);
      const C = [[-p.rx, -p.rz], [p.rx, -p.rz], [p.rx, p.rz], [-p.rx, p.rz]];
      C.forEach(([lx, lz], k) => {
        const v = i * 4 + k, wx = p.pos.x + cs * lx + sn * lz, wz = p.pos.z - sn * lx + cs * lz;
        pos.set([wx, p.pos.y, wz], v * 3); center.set([p.pos.x, p.pos.y, p.pos.z], v * 3); shape.set([p.rx, p.rz, rot], v * 3); tint.set([c.r, c.g, c.b], v * 3); zr.set([p.z0 ?? -1e4, p.z1 ?? 1e4], v * 2);
      });
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("center", new THREE.BufferAttribute(center, 3)); g.setAttribute("shape", new THREE.BufferAttribute(shape, 3));
    g.setAttribute("tint", new THREE.BufferAttribute(tint, 3)); g.setAttribute("zr", new THREE.BufferAttribute(zr, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.ShaderMaterial({ vertexShader: POOL_VERT, fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide, uniforms: { fogDensity: { value: 0 } } });
    return { geo: g, mat: m };
  }, [items]);
  useFrame(() => { mat.uniforms.fogDensity.value = scene.fog instanceof THREE.FogExp2 ? scene.fog.density : 0; });
  if (!items.length) return null;
  return <mesh geometry={geo} material={mat} renderOrder={1} />;
}
