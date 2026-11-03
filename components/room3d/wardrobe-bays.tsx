"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { deg, EmptyDrawerCharm, Label3D, pointer, TailorTape } from "@/components/room3d/room-props";
import { useI18n } from "@/lib/i18n/i18n";
import { hangJitter, HungGarment } from "./hung-garment";
import type { Ctx, RoomModule3D } from "./room-scene-types";
import { D, DRAWER_H, GRAB, Y } from "./room-layout";
import { useTex } from "./use-room-texture";
import { InteractionAnchor } from "./interaction-anchor";
import { PieceMesh } from "./piece-mesh";

/* Vãos do guarda-roupa FAI Origem: porta com cabideiro (e a marca), gaveta e caixa de look do maleiro. */

/** Frente com o logo de fábrica, ou o monograma a partir do Studio (DET-K03). */
function DoorMark({ text, w, h, position, plate }: { text: string; w: number; h: number; position: [number, number, number]; plate?: RoomModule3D["finish"] }) {
  const logo = useTex(plate?.logoUrl);
  if (!plate) return <Label3D text={text} w={w} h={h} px={128} fg="rgba(0,0,0,.2)" font={`700 ${text.length > 3 ? 30 : 44}px Georgia, serif`} position={position} />;
  // placa de logo comprada na loja (RF39): material/cor da placa + logo da marca ou nome gravado
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.002]}><boxGeometry args={[w + 0.03, h + 0.02, 0.006]} /><meshStandardMaterial color={plate.color ?? "#C9A227"} metalness={plate.metalness ?? 0.6} roughness={plate.roughness ?? 0.3} /></mesh>
      {logo ? <mesh position={[0, 0, 0.0055]}><planeGeometry args={[h * 0.9, h * 0.9]} /><meshBasicMaterial map={logo} transparent /></mesh>
        : <Label3D text={(plate.labelText ?? text).slice(0, 12)} w={w} h={h} px={256} fg="rgba(0,0,0,.6)" font="700 56px Georgia, serif" position={[0, 0, 0.0055]} />}
    </group>
  );
}

/** Porta com cabideiro atrás: dobradiça na borda externa do par; abre com animação e acende quando o Vista-me aponta. */
export function DoorBay({ m, x0, doorW, hingeLeft, open, lit, onToggle, finish, handle, mark, taped, light, ctx, plate }: {
  m: RoomModule3D; x0: number; doorW: number; hingeLeft: boolean; open: boolean; lit: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; handle: string;
  mark: string; taped: boolean; light: string; ctx: Ctx; plate?: RoomModule3D["finish"];
}) {
  const h = Y.doors1 - Y.drawers1;
  const art = useTex(m.finish?.artUrl); // arte da marca/celebridade aplicada na porta (RF39)
  const door = useRef<THREE.Group>(null); const front = useRef<THREE.Mesh>(null);
  useEffect(() => { ctx.engine?.progress.set(m.id, Number(open)); }, [open, m.id, ctx.engine]);
  useEffect(() => { const mesh = front.current; if (!ctx.engine || !mesh) return; ctx.engine.solids.add(mesh); return () => { ctx.engine?.solids.delete(mesh); }; }, [ctx.engine]);
  useFrame(({ clock }, dt) => {
    const angle = (ctx.engine?.progress.get(m.id) ?? Number(open)) * (hingeLeft ? -deg(105) : deg(105));
    if (door.current) door.current.rotation.y = ctx.reduced ? angle : THREE.MathUtils.damp(door.current.rotation.y, angle, 7, dt);
    if (front.current) (front.current.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 3) : 0;
  });
  // varão de lado a lado do vão, 10 cm abaixo do maleiro; as peças de lado no varão, a cada ~10 cm (5 no vão de 60 cm,
  // 8 no de 90), como num closet de verdade — peças longas dobram no cabide para não bater no fundo do vão
  const railY = h - 0.1, cap = Math.max(1, Math.floor((doorW - 0.06) / 0.1));
  const pieces = (m.pieces ?? []).filter(p => !ctx.engine?.hidden.has(p.id)).slice(0, cap);
  const step = (doorW - 0.08) / Math.max(1, pieces.length), first = 0.04 + step / 2;
  const reach = (ctx.engine?.progress.get(m.id) ?? Number(open)) > .6;
  return (
    <group position={[x0, Y.drawers1, 0]}>
      <mesh position={[doorW / 2, railY, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, doorW - 0.03, 12]} /><meshStandardMaterial color={ctx.hanger?.color ? String(ctx.hanger.color) : "#b7b7b7"} metalness={ctx.hanger?.metalness ?? 0.8} roughness={ctx.hanger?.roughness ?? 0.3} /></mesh>
      <InteractionAnchor ctx={ctx} id={`rail:${m.id}`} kind="rail" available={reach} position={[doorW / 2, railY, 0]} />
      {pieces.map((p, i) => (
        <group key={p.id} position={[first + i * step, railY, 0]}>
          {/* pegar pelo ombro da roupa, na borda da frente do vão (o gancho fica alto e no fundo, fora do alcance do braço) */}
          <InteractionAnchor ctx={ctx} id={p.id} kind="piece" available={reach} label={p.name} position={GRAB} />
          <HungGarment p={p} ctx={ctx} along="x" jitter={hangJitter(p.id) * 0.5} maxLength={railY - 0.04} swingKey={ctx.engine?.hungBack?.id === p.id ? ctx.engine.hungBack.at : 0} />
        </group>
      ))}
      {(open || lit) && <pointLight position={[doorW / 2, h - 0.05, 0]} intensity={lit ? 1.4 : 0.8} distance={1.4} color={lit ? "#ffe6a0" : light} />}
      <group ref={door} position={[hingeLeft ? 0 : doorW, 0, D / 2]}>
        <mesh ref={front} position={[hingeLeft ? doorW / 2 : -doorW / 2, h / 2, 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }} {...pointer}>
          <boxGeometry args={[doorW - 0.006, h - 0.006, 0.02]} /><meshStandardMaterial key={art ? art.uuid : "plain"} {...finish} color={art ? "#ffffff" : finish.color} map={art ?? undefined} emissive="#ffd27a" emissiveIntensity={0} />
        </mesh>
        <InteractionAnchor ctx={ctx} id={m.id} kind="handle" position={[hingeLeft ? doorW - .03 : -doorW + .03, h / 2, .021]} progress={delta => { ctx.engine?.progress.set(m.id, THREE.MathUtils.clamp((ctx.engine.progress.get(m.id) ?? Number(open)) + delta, 0, 1)); ctx.engine?.notify(); }}>
        <mesh><boxGeometry args={[0.012, 0.28, 0.004]} /><meshStandardMaterial color={handle} roughness={0.9} /></mesh></InteractionAnchor>
        <DoorMark text={mark} w={0.16} h={0.08} plate={plate} position={[hingeLeft ? doorW / 2 : -doorW / 2, h * 0.72, 0.0215]} />
        {taped && <TailorTape width={0.2} position={[hingeLeft ? doorW - 0.03 : -doorW + 0.03, h / 2, 0.028]} rotation={[0, 0, 0.5]} />}
      </group>
    </group>
  );
}

/** Gaveta: desliza para fora e mostra as peças; frente com o rótulo; vazia mostra sachê de lavanda e meia sem par. */
export function Drawer({ m, x, y, w, open, lit, onToggle, finish, handle, taped, onAdd, ctx }: {
  m: RoomModule3D; x: number; y: number; w: number; open: boolean; lit: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; handle: string; taped: boolean; onAdd: () => void; ctx: Ctx;
}) {
  const g = useRef<THREE.Group>(null); const front = useRef<THREE.Mesh>(null);
  useEffect(() => { ctx.engine?.progress.set(m.id, Number(open)); }, [open, m.id, ctx.engine]);
  useEffect(() => { const mesh = front.current; if (!ctx.engine || !mesh) return; ctx.engine.solids.add(mesh); return () => { ctx.engine?.solids.delete(mesh); }; }, [ctx.engine]);
  useFrame(({ clock }, dt) => {
    const extension = (ctx.engine?.progress.get(m.id) ?? Number(open)) * .34;
    if (g.current) g.current.position.z = ctx.reduced ? extension : THREE.MathUtils.damp(g.current.position.z, extension, 8, dt);
    if (front.current) (front.current.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 3) : 0;
  });
  const pieces = m.pieces ?? [];
  return (
    <group ref={g} position={[x, y, 0]}>
      <mesh ref={front} position={[0, 0, D / 2 - 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }} {...pointer}>
        <boxGeometry args={[w - 0.008, DRAWER_H - 0.008, 0.02]} /><meshStandardMaterial {...finish} emissive="#ffd27a" emissiveIntensity={0} />
      </mesh>
      <InteractionAnchor ctx={ctx} id={m.id} kind="handle" position={[0, DRAWER_H / 2 - .035, D / 2 + .0012]} progress={delta => { ctx.engine?.progress.set(m.id, THREE.MathUtils.clamp((ctx.engine.progress.get(m.id) ?? Number(open)) + delta, 0, 1)); ctx.engine?.notify(); }}><mesh><boxGeometry args={[w * 0.5, 0.01, 0.004]} /><meshStandardMaterial color={handle} /></mesh></InteractionAnchor>
      <Label3D text={m.category ?? m.label} w={w * 0.86} h={0.045} fg="#4a453c" position={[0, -0.02, D / 2 + 0.001]} />
      {pieces.length > 0 && <mesh position={[w / 2 - 0.03, DRAWER_H / 2 - 0.03, D / 2 + 0.002]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color="#1F7A76" /></mesh>}
      {taped && <TailorTape width={w * 0.9} position={[0, DRAWER_H / 2 - 0.035, D / 2 + 0.008]} />}
      <mesh position={[0, -DRAWER_H / 2 + 0.02, 0.05]}><boxGeometry args={[w - 0.03, 0.01, D - 0.14]} /><meshStandardMaterial color="#efeae1" /></mesh>
      {open && pieces.length === 0 && <group position={[0, -DRAWER_H / 2 + 0.03, D / 2 - 0.12]}><EmptyDrawerCharm width={w} onAdd={onAdd} /></group>}
      {(open || (ctx.engine?.progress.get(m.id) ?? 0) > .6) && pieces.slice(0, 4).map((p, i) => (
        <group key={p.id} position={[(i % 2 ? 1 : -1) * w / 4, -DRAWER_H / 2 + .04, -.08 + Math.floor(i / 2) * .18]}>
          <InteractionAnchor ctx={ctx} id={p.id} kind="piece" label={p.name} available={(ctx.engine?.progress.get(m.id) ?? Number(open)) > .6} />
          <PieceMesh p={p} w={(w - .06) / 2} h={.15} ctx={ctx} lying />
        </group>))}
      {lit && <pointLight position={[0, 0, D / 2 + 0.2]} intensity={0.6} distance={0.6} color="#ffe6a0" />}
    </group>
  );
}

export function LookBox({ b, x, season, count }: { b?: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }; x: number; season?: string; count?: number }) {
  const { t } = useI18n();
  const tex = useTex(b?.coverImageUrl);
  return (
    <group position={[x, Y.doors1 + 0.16, 0.02]}>
      <RoundedBox args={[0.26, 0.26, 0.4]} radius={0.01} castShadow><meshStandardMaterial color={season ? "#cfe0ea" : b?.lookDoDia ? "#f5d9a8" : "#e9e3d7"} roughness={0.9} /></RoundedBox>
      {b && <mesh position={[0, 0, 0.201]}><planeGeometry args={[0.2, 0.2]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} /></mesh>}
      {season && <Label3D text={t("room3d.roomScene.pecas", { season, value: count ?? 0 })} w={0.22} h={0.14} px={192} bg="#f7fbfd" fg="#29485c" position={[0, 0, 0.202]} />}
    </group>
  );
}
