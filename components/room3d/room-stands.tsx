"use client";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { HangTag, Label3D } from "@/components/room3d/room-props";
import { CHAIR } from "@/lib/room3d/interaction";
import { useI18n } from "@/lib/i18n/i18n";
import { ApprovedAsset } from "./approved-asset";
import { hangJitter, hungKindOf, HungGarment, ShelfPiece } from "./hung-garment";
import { RoomFixture } from "./room-furniture";
import type { Ctx, RoomPiece3D } from "./room-scene-types";
import { GRAB } from "./room-layout";
import { useTex } from "./use-room-texture";
import { InteractionAnchor } from "./interaction-anchor";
import { PieceMesh } from "./piece-mesh";

/* Móveis soltos do quarto: cesto, arara do Desapego, cadeira, vitrine de bolsas com porta-joias e ilha do Atelier. */

function Basket({ position, pieces, ctx }: { position: [number, number, number]; pieces: RoomPiece3D[]; ctx: Ctx }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.24, 0.2, 0.4, 24, 1, true]} /><meshStandardMaterial color="#b89a6a" roughness={1} side={THREE.DoubleSide} /></mesh>
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.06 + i * 0.06, 0.36, 0]} rotation={[-0.4, i * 0.6, 0]}><PieceMesh p={p} w={0.28} h={0.28} ctx={ctx} /></group>)}
      <HangTag text={t("room3d.roomScene.para_lavar")} position={[0.2, 0.36, 0.2]} w={0.13} />
    </group>
  );
}

/** Alturas da arara (m): varão onde os ganchos encaixam e o tampo da prateleira de baixo (as mesmas do modelo aprovado). */
const RACK = { rail: 1.27, shelf: 0.17 } as const;
/**
 * Arara do Desapego: encostada na parede sul, de frente para o centro do quarto e longe das portas do 2º guarda-roupa
 * (a porta 5 abre até x = −1,90): peças de lado no varão (até 12), sapatos e acessórios na prateleira, etiqueta de
 * preço e selo Garimpo nas peças de brechó.
 */
export function SaleRack({ position, rack, ctx, modelUrl }: { modelUrl?: string | null; position: [number, number, number]; rack: { name: string; pieces: RoomPiece3D[] }; ctx: Ctx }) {
  // a peça pega (na mão ou no chão) sai do varão; pendurada de volta, reaparece no lugar dela
  const hung = rack.pieces.filter((p) => hungKindOf(p) !== "shelf" && !ctx.engine?.hidden.has(p.id)), shelf = rack.pieces.filter((p) => hungKindOf(p) === "shelf");
  const shown = hung.slice(0, 12), feet = shelf.slice(0, 4);
  const step = Math.min(0.11, 1.3 / Math.max(1, shown.length)), first = -((shown.length - 1) * step) / 2;
  return <RoomFixture engine={ctx.engine} id="support-rack" position={position} yaw={Math.PI} collider={[.82, .4]}>
    <ApprovedAsset url={modelUrl} size={[1.6, 1.55, .8]}><group>
      {[-.73, .73].map(x => <group key={x}><mesh position={[x, .72, 0]}><boxGeometry args={[.045, 1.42, .045]} /><meshStandardMaterial color="#1245a8" metalness={.4} /></mesh>{[-.24, .24].map(z => <mesh key={z} position={[x, .06, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.06, .06, .045, 16]} /><meshStandardMaterial color="#423a30" /></mesh>)}</group>)}
      <mesh position={[0, 1.23, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.018, .018, 1.46, 12]} /><meshStandardMaterial color="#c9a227" metalness={.8} roughness={.3} /></mesh>
      <mesh position={[0, 1.43, 0]}><boxGeometry args={[1.53, .12, .055]} /><meshStandardMaterial color="#1245a8" /></mesh>
      <mesh position={[0, .14, 0]}><boxGeometry args={[1.56, .04, .52]} /><meshStandardMaterial color="#f58220" /></mesh>
    </group></ApprovedAsset>
    {/* peças de lado no varão, uma ao lado da outra (como numa arara de loja); sapatos e acessórios na prateleira */}
    <InteractionAnchor ctx={ctx} id="rail:sale" kind="rail" position={[0, RACK.rail, 0]} />
    {shown.map((p, i) => <group key={p.id} position={[first + i * step, RACK.rail, 0]}>
      <InteractionAnchor ctx={ctx} id={p.id} kind="piece" label={p.name} position={GRAB} />
      <HungGarment p={p} ctx={ctx} along="x" jitter={hangJitter(p.id)} swingKey={ctx.engine?.hungBack?.id === p.id ? ctx.engine.hungBack.at : 0} />
    </group>)}
    {feet.map((p, i) => <ShelfPiece key={p.id} p={p} ctx={ctx} position={[-0.48 + i * 0.32, RACK.shelf, 0.02]} />)}
  </RoomFixture>;
}

export function Chair({ position, pieces, ctx }: { position: [number, number, number]; pieces: RoomPiece3D[]; ctx: Ctx }) {
  const wood = <meshStandardMaterial color="#8a6a4a" roughness={0.7} />;
  return (
    <group position={position} rotation={[0, CHAIR.yaw, 0]}>
      <mesh position={[0, CHAIR.seatTop - 0.025, 0]} castShadow><boxGeometry args={[0.45, 0.05, 0.45]} />{wood}</mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow><boxGeometry args={[0.45, 0.5, 0.04]} />{wood}</mesh>
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.22, z]}><boxGeometry args={[0.04, 0.45, 0.04]} />{wood}</mesh>)}
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.05 + i * 0.05, 0.62 + i * 0.03, -0.15]} rotation={[-0.2, 0, 0.1 * i]}><PieceMesh p={p} w={0.4} h={0.4} ctx={ctx} /></group>)}
    </group>
  );
}

/** Nível Closet: vitrine de bolsas (nichos de vidro) com o porta-joias em cima. */
export function BagDisplay({ position, bags, jewelry, ctx, bagModel, jewelryModel }: { bagModel?: string | null; jewelryModel?: string | null; position: [number, number, number]; bags: RoomPiece3D[]; jewelry: RoomPiece3D[]; ctx: Ctx }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <ApprovedAsset url={bagModel} size={[.64, 1.6, .42]}><group><mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[0.62, 1.6, 0.4]} /><meshStandardMaterial color="#efe9df" roughness={0.6} transparent opacity={0.25} /></mesh>
      {[0.02, 0.55, 1.08, 1.6].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.64, 0.02, 0.42]} /><meshStandardMaterial color="#d9cbb5" /></mesh>)}
      {[-0.31, 0.31].map((x) => <mesh key={x} position={[x, 0.8, 0]}><boxGeometry args={[0.02, 1.6, 0.42]} /><meshStandardMaterial color="#d9cbb5" /></mesh>)}</group></ApprovedAsset>
      {bags.slice(0, 6).map((p, i) => <group key={p.id} position={[i % 2 ? 0.14 : -0.14, 0.28 + Math.floor(i / 2) * 0.53, 0.05]}><PieceMesh p={p} w={0.24} h={0.24} ctx={ctx} /></group>)}
      <mesh position={[0, 1.36, 0.21]}><planeGeometry args={[0.6, 0.5]} /><meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} transparent opacity={0.2} /></mesh>
      <Label3D text={t("room3d.roomScene.vitrine_de_bolsas")} w={0.5} h={0.05} fg="#6b5a4a" position={[0, 0.1, 0.215]} />
      {/* porta-joias */}
      <group position={[0, 1.61, 0]}>
        <ApprovedAsset url={jewelryModel} size={[.3, .1, .2]}><RoundedBox args={[0.3, 0.1, 0.2]} radius={0.015} position={[0, 0.05, 0]}><meshStandardMaterial color="#7a1f3d" roughness={0.8} /></RoundedBox></ApprovedAsset>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.006, 0.006, 0.12, 6]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.2} /></mesh>
        {jewelry.slice(0, 4).map((p, i) => <group key={p.id} position={[-0.09 + i * 0.06, 0.2, 0.02]}><PieceMesh p={p} w={0.07} h={0.07} ctx={ctx} /></group>)}
      </group>
    </group>
  );
}

/** Nível Atelier: ilha central (bancada) para comparar 2–3 looks lado a lado. */
export function Island({ position, boxes, modelUrl }: { position: [number, number, number]; modelUrl?: string | null; boxes: { id: string; title: string; coverImageUrl?: string | null }[] }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <ApprovedAsset url={modelUrl} size={[1.14, .44, .46]}><group><RoundedBox args={[1.1, 0.42, 0.42]} radius={0.02} position={[0, 0.21, 0]} castShadow><meshStandardMaterial color="#e9e3d7" roughness={0.7} /></RoundedBox>
      <mesh position={[0, 0.425, 0]}><boxGeometry args={[1.14, 0.02, 0.46]} /><meshStandardMaterial color="#8a6a4a" roughness={0.5} /></mesh></group></ApprovedAsset>
      {boxes.slice(0, 3).map((b, i) => <IslandCard key={b.id} b={b} x={-0.35 + i * 0.35} />)}
      <Label3D text={t("room3d.roomScene.ilha_compare_looks")} w={0.5} h={0.05} fg="#6b5a4a" position={[0, 0.2, 0.215]} />
    </group>
  );
}
function IslandCard({ b, x }: { b: { title: string; coverImageUrl?: string | null }; x: number }) {
  const tex = useTex(b.coverImageUrl);
  return <group position={[x, 0.6, 0]} rotation={[-0.15, 0, 0]}><mesh><boxGeometry args={[0.26, 0.34, 0.01]} /><meshStandardMaterial color="#fff" /></mesh><mesh position={[0, 0.02, 0.006]}><planeGeometry args={[0.22, 0.26]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} /></mesh></group>;
}
