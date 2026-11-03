"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomInteraction } from "@/lib/room3d/interaction";
import { dropPoint, walkArea } from "@/lib/room3d/room-bounds";
import { fallPose, stepFall, type Fall } from "@/lib/room3d/cloth-motion";
import { HungGarment } from "./hung-garment";
import type { Ctx, RoomPiece3D } from "./room-scene-types";

/** Altura do gancho da peça deitada no chão (o pano assentado tem ~3 cm). */
const FLOOR_Y = 0.03;
/**
 * Peça na mão ou solta no chão: a mesma roupa no cabide das araras. Na mão, o controlador do personagem move e gira
 * este grupo (pêndulo no gancho, room-avatar-controller.tsx); solta, ela cai com o arrasto do tecido, deita ao chegar
 * ao chão girando um pouco, quica de leve e assenta (cloth-motion.ts).
 */
function LoosePiece({ engine, p, ctx, drop }: { engine: RoomInteraction; p: RoomPiece3D; ctx: Ctx; drop: ReturnType<typeof walkArea> }) {
  const object = useRef<THREE.Group>(null), cloth = useRef<THREE.Group>(null);
  const fall = useRef<{ f: Fall; start: number; spin: number; key: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!object.current) return;
    const carry = { id: `carry:${p.id}`, kind: "piece" as const, object: object.current, available: () => false };
    const ground = { id: p.id, kind: "piece" as const, object: object.current, available: () => engine.dropped.has(p.id) && object.current!.position.y < .08 };
    engine.targets.set(carry.id, carry);
    const original = engine.targets.get(p.id); engine.targets.set(p.id, ground);
    return () => { engine.targets.delete(carry.id); if (engine.targets.get(p.id) === ground) { if (original) engine.targets.set(p.id, original); else engine.targets.delete(p.id); } };
  }, [engine, p.id]);
  useFrame((_, dt) => {
    const dropped = engine.dropped.get(p.id), g = object.current; if (!g) return;
    if (!dropped) { fall.current = null; if (cloth.current) cloth.current.scale.z = 1; return; }   // na mão: o controlador cuida
    if (!fall.current || fall.current.key !== dropped) fall.current = { f: { y: dropped.y, vy: 0, landed: -1 }, start: dropped.y, spin: (Math.random() - 0.5) * 1.1, key: dropped };
    const st = fall.current; st.f = ctx.reduced ? { y: FLOOR_Y, vy: 0, landed: 1 } : stepFall(st.f, FLOOR_Y, dt);
    dropped.y = st.f.y; dropPoint(dropped, drop);   // cai dentro do quarto, fora dos dois guarda-roupas
    const pose = fallPose(st.start, st.f.y, FLOOR_Y, st.f.landed, st.spin);
    g.position.copy(dropped); g.rotation.set(pose.tiltX, g.rotation.y, pose.spinZ, "YXZ");
    if (cloth.current) cloth.current.scale.z = pose.squash;
  });
  return <group ref={object} name={`room-carried-${p.id}`} position={engine.dropped.get(p.id)?.toArray() ?? [0, 1, 1]}>
    <group ref={cloth}><HungGarment p={p} ctx={{ ...ctx, engine: undefined }} along="z" /></group>
  </group>;
}
export function LoosePieces({ engine, pieces, ctx, drop }: { engine: RoomInteraction; pieces: Record<string, RoomPiece3D>; ctx: Ctx; drop: ReturnType<typeof walkArea> }) {
  return <>{[...new Set([...(engine.held ? [engine.held] : []), ...engine.dropped.keys()])].map(id => pieces[id] ? <LoosePiece key={id} engine={engine} p={pieces[id]} ctx={ctx} drop={drop} /> : null)}</>;
}
