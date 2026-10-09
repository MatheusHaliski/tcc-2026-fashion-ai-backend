"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rng } from "@/components/three/common";

/*
 * Efeitos de cena compartilhados (mini lojas, mini palco, passarela): fogos e confete. "Reduzir movimento" congela tudo
 * num quadro bonito em vez de animar.
 */

/** Fogos: explosões de partículas acima da loja; cada nível a mais de fogos acrescenta uma explosão defasada. */
export function Fireworks({ x, z, level, colors, reduced }: { x: number; z: number; level: number; colors: string[]; reduced: boolean }) {
  const N = 90;
  const bursts = useMemo(() => Array.from({ length: level }, (_, k) => {
    const r = rng(101 + k * 17 + Math.round(x * 10)); const dirs = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); dirs.set([s * Math.cos(th), u, s * Math.sin(th)], i * 3); }
    return { dirs, cx: x + (r() - 0.5) * 1.6, cy: 4.2 + r() * 1.2, cz: z + (r() - 0.5) * 0.8, delay: k * 0.7, color: colors[k % colors.length] };
  }), [level, x, z, colors]);
  const refs = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(({ clock }) => {
    bursts.forEach((b, k) => {
      const pts = refs.current[k] as THREE.Points | null; if (!pts) return;
      const t = reduced ? 0.55 : ((clock.elapsedTime + 2.6 - b.delay) % 2.6) / 2.6;
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute; const rad = 0.2 + t * 1.3; const fall = t * t * 0.5;
      for (let i = 0; i < N; i++) pos.setXYZ(i, b.cx + b.dirs[i * 3] * rad, b.cy + b.dirs[i * 3 + 1] * rad - fall, b.cz + b.dirs[i * 3 + 2] * rad);
      pos.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = reduced ? 0.8 : Math.max(0, 1 - t * 1.1);
    });
  });
  return (
    <group>
      {bursts.map((b, k) => (
        <points key={k} ref={(p) => { refs.current[k] = p; }}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(N * 3), 3]} /></bufferGeometry>
          <pointsMaterial color={b.color} size={0.09} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      ))}
    </group>
  );
}

/** Confete: papéis coloridos caindo e girando sobre uma área; com movimento reduzido ficam parados no ar. */
export function Confetti({ colors, count = 260, area = [8, 4], top = 6, reduced }: { colors: string[]; count?: number; area?: [number, number]; top?: number; reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bits = useMemo(() => { const r = rng(77); return Array.from({ length: count }, () => ({ x: (r() - 0.5) * area[0], z: (r() - 0.5) * area[1] + 1, y0: r() * top, v: 0.5 + r() * 0.6, spin: (r() - 0.5) * 8, sway: r() * 6, c: new THREE.Color(colors[Math.floor(r() * colors.length)] ?? "#ffffff") })); }, [count, area, top, colors]);
  const m = useMemo(() => new THREE.Matrix4(), []); const q = useMemo(() => new THREE.Quaternion(), []); const e = useMemo(() => new THREE.Euler(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []); const pos = useMemo(() => new THREE.Vector3(), []);
  const place = (t: number) => {
    const im = mesh.current; if (!im) return;
    bits.forEach((b, i) => {
      const y = ((b.y0 - t * b.v) % top + top) % top + 0.3;
      pos.set(b.x + Math.sin(t * 1.3 + b.sway) * 0.15, y, b.z); e.set(t * b.spin, t * b.spin * 0.7, b.sway); q.setFromEuler(e);
      m.compose(pos, q, one); im.setMatrixAt(i, m); im.setColorAt(i, b.c);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };
  useFrame(({ clock }) => place(reduced ? 2.2 : clock.elapsedTime));
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}><planeGeometry args={[0.05, 0.08]} /><meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} /></instancedMesh>;
}
