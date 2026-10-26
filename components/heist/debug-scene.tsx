"use client";
/*
 * MET Gala Heist v2 — cena de depuração (só com ?debug=planta): paredes da grade, móveis e pessoas como blocos, para
 * conferir simulação, colisão e câmera sem esperar a cena realista carregar. Não aparece no jogo normal.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { CELL, GH, GW, X0, Z0, type World } from "@/lib/heist/world";
import { floorY } from "@/lib/heist/level";

export function DebugScene({ world, view }: { world: World; view: React.MutableRefObject<SceneView> }) {
  const walls = useMemo(() => {
    const cells: [number, number][] = [];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (world.grid[j * GW + i] === 0) {
      let near = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < GW && b < GH && world.grid[b * GW + a] !== 0) near = true; }
      if (near) cells.push([i, j]);
    }
    const geo = new THREE.BoxGeometry(CELL, 3, CELL), mat = new THREE.MeshStandardMaterial({ color: "#8c8577" });
    const m = new THREE.InstancedMesh(geo, mat, cells.length); const o = new THREE.Object3D();
    cells.forEach(([i, j], k) => { const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL; o.position.set(x, floorY({ x, z }) + 1.5, z); o.updateMatrix(); m.setMatrixAt(k, o.matrix); });
    return m;
  }, [world]);
  const actors = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.CapsuleGeometry(0.25, 1.1, 4, 8), []);
  const mats = useMemo(() => ({ guard: new THREE.MeshStandardMaterial({ color: "#222" }), civ: new THREE.MeshStandardMaterial({ color: "#c9a0dc" }), player: new THREE.MeshStandardMaterial({ color: "#e02060" }) }), []);
  useFrame(() => {
    const g = actors.current; if (!g) return;
    const all = [view.current.player, ...view.current.actors];
    while (g.children.length < all.length) g.add(new THREE.Mesh(body, mats.civ));
    g.children.forEach((c, k) => {
      const a = all[k]; c.visible = !!a && a.visible; if (!a) return;
      const m = c as THREE.Mesh; m.material = mats[a.kind];
      const down = a.anim === "dead" || a.anim === "knockedOut" || a.anim === "downed";
      m.position.set(a.x, a.y + (down ? 0.3 : a.anim === "crouch" || a.anim === "sneak" ? 0.6 : 0.8), a.z);
      m.rotation.set(down ? Math.PI / 2 : 0, a.yaw, 0);
    });
  });
  return <group>
    <primitive object={walls} />
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, -1]}><planeGeometry args={[44, 47]} /><meshStandardMaterial color="#d8d2c4" /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.7, 37.5]}><planeGeometry args={[60, 26]} /><meshStandardMaterial color="#3a3c42" /></mesh>
    {world.props.map((p) => p.shape.type === "box"
      ? <mesh key={p.id} position={[(p.shape.x0 + p.shape.x1) / 2, floorY({ x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 }) + (p.height === "low" ? 0.45 : 1.1), (p.shape.z0 + p.shape.z1) / 2]}><boxGeometry args={[p.shape.x1 - p.shape.x0, p.height === "low" ? 0.9 : 2.2, p.shape.z1 - p.shape.z0]} /><meshStandardMaterial color={p.height === "glass" ? "#9fd4e8" : "#b08850"} transparent={p.height === "glass"} opacity={p.height === "glass" ? 0.4 : 1} /></mesh>
      : <mesh key={p.id} position={[p.shape.x, floorY(p.shape) + (p.height === "low" ? 0.45 : 1.1), p.shape.z]}><cylinderGeometry args={[p.shape.r, p.shape.r, p.height === "low" ? 0.9 : 2.2, 16]} /><meshStandardMaterial color="#a07850" /></mesh>)}
    <group ref={actors} />
    <hemisphereLight args={["#fff", "#445", 1.2]} />
    <directionalLight position={[10, 20, 10]} intensity={1.2} />
  </group>;
}
