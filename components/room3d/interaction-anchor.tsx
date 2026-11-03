"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Ctx } from "./room-scene-types";

/** Register actual world anchors, not screen-space click areas. */
export function InteractionAnchor({ ctx, id, kind, available = true, position = [0, 0, 0], children, progress, label }: {
  ctx: Ctx; id: string; kind: "handle" | "piece" | "rail"; available?: boolean; position?: [number, number, number]; children?: React.ReactNode; progress?: (delta: number) => void;
  /** nome da peça no aviso "Aperte X para pegar …" */
  label?: string;
}) {
  const object = useRef<THREE.Group>(null), marker = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!marker.current) return;
    const near = ctx.engine?.hover === id; marker.current.scale.setScalar(near ? 1.6 : 1); (marker.current.material as THREE.MeshBasicMaterial).color.set(near ? "#4ade80" : "#fbbf24");
    marker.current.visible = kind !== "rail" || !!ctx.engine?.held;          // o varão só vira alvo com uma peça na mão
  });
  useEffect(() => {
    if (!ctx.engine || !object.current) return;
    const engine = ctx.engine;
    const target = { id, kind, object: object.current, label, available: () => available && (kind === "rail" ? !!engine.held : kind !== "piece" || !engine.hidden.has(id)), progress };
    ctx.engine.targets.set(id, target);
    return () => { if (ctx.engine?.targets.get(id) === target) ctx.engine.targets.delete(id); };
  }, [ctx.engine, id, kind, available, progress, label]);
  return <group ref={object} position={position}>{children}{ctx.engine && available && <mesh ref={marker}><sphereGeometry args={[.016, 8, 6]} /><meshBasicMaterial color="#fbbf24" transparent opacity={.85} /></mesh>}</group>;
}
