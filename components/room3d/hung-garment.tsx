"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useTex } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";
import { fmtPriceShort } from "@/lib/i18n/money";
import { DustPuff, GoldDot, HangTag, pointer } from "./room-props";
import { ApprovedAsset } from "./approved-asset";
import { HUNG_DEPTH, HUNG_LENGTH, hangJitter, hungKindOf, type HungKind, type HungPiece } from "./hung-shape";
import { CLOTH_SWAY, CLOTH_TIME, averageColor, buildCloth } from "./hung-cloth";
export { HUNG_DEPTH, HUNG_LENGTH, clothFolds, hangJitter, hungKindOf, hungProfile, hungShape, type HungKind, type HungPiece } from "./hung-shape";
export { averageColor } from "./hung-cloth";

/*
 * Roupa pendurada de verdade (arara e guarda-roupa): cabide com o gancho no varão e a peça com volume, perpendicular
 * ao varão — de lado, uma ao lado da outra, como numa loja ou num closet. A silhueta vem do tipo da peça (camiseta,
 * manga longa, casaco, vestido, calça dobrada no cabide, saia, short), extrudada com a espessura do tecido no cabide e
 * pintada com a cor da peça (a média da foto quando não há cor gravada). A foto sem fundo vai nas duas faces: de frente
 * a peça aparece inteira; vista do corredor, é uma fatia colorida. Unidades em metros; origem no varão, y para baixo.
 */

/** O que a peça pendurada precisa da cena: destaque, clique, movimento reduzido, etiquetas e o cabide da loja. */
export interface HungCtx {
  highlight: string | null; onPick: (id: string) => void; reduced: boolean; tagged: Set<string>;
  hanger?: THREE.MeshStandardMaterialParameters; hangerModel?: string | null; engine?: { hidden: Set<string> };
}

function useFabricColor(tex: THREE.Texture | null, fallback?: string | null): string {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => { setColor(tex?.image ? averageColor(tex.image as CanvasImageSource) : null); }, [tex]);
  return fallback ?? color ?? "#c9c4bb";
}

/**
 * Cabide: gancho no varão, pescoço e braços na linha do ombro; a calça ganha a barra de baixo. O cabide comprado na
 * loja (módulo "hangers", RF39) troca o desenho pelo modelo aprovado, no mesmo tamanho.
 */
function Hanger({ kind, finish, gold, modelUrl }: { kind: Exclude<HungKind, "shelf">; finish?: THREE.MeshStandardMaterialParameters; gold?: boolean; modelUrl?: string | null }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(gold ? { color: "#C9A227", metalness: 0.9, roughness: 0.25 } : { color: finish?.color ?? "#8a6a4a", metalness: finish?.metalness ?? 0.15, roughness: finish?.roughness ?? 0.55 }), [gold, finish?.color, finish?.metalness, finish?.roughness]);
  const bottom = kind === "pants" || kind === "skirt" || kind === "shorts";
  const drawn = (
    <group>
      <mesh position={[0, 0.03, 0]} material={mat}><torusGeometry args={[0.022, 0.0035, 8, 18, Math.PI * 1.35]} /></mesh>
      <mesh position={[0, 0.0, 0]} material={mat}><cylinderGeometry args={[0.0035, 0.0035, 0.03, 6]} /></mesh>
      {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.1, -0.04, 0]} rotation={[0, 0, sd * 1.32]} material={mat}><cylinderGeometry args={[0.006, 0.006, 0.21, 8]} /></mesh>)}
      {bottom && <mesh position={[0, -0.065, 0]} rotation={[0, 0, Math.PI / 2]} material={mat}><cylinderGeometry args={[0.005, 0.005, 0.38, 8]} /></mesh>}
    </group>
  );
  // o desenho fica enquanto o modelo aprovado carrega (ou se ele falhar)
  return modelUrl && !gold ? <ApprovedAsset url={modelUrl} size={[0.42, 0.17, 0.04]} centered>{drawn}</ApprovedAsset> : drawn;
}

/**
 * Peça pendurada no varão (origem no varão). `along` é o eixo do varão no espaço do pai: a peça fica perpendicular a
 * ele, com um pequeno giro próprio (`jitter`, rad) como nas araras de verdade. `maxLength` encurta peças longas que
 * bateriam no fundo do vão (a dobra fica no cabide).
 */
export function HungGarment({ p, ctx, along = "x", jitter = 0, maxLength = Infinity, swingKey = 0 }: { p: HungPiece; ctx: HungCtx; along?: "x" | "z"; jitter?: number; maxLength?: number; swingKey?: number }) {
  const { t } = useI18n();
  const kind = hungKindOf(p); const hung = kind === "shelf" ? "top" : kind;
  const length = Math.min(HUNG_LENGTH[hung], maxLength), depth = HUNG_DEPTH[hung];
  const url = p.imageUrl ?? p.thumbnailUrl;
  const tex = useTex(url);
  const forgotten = !!p.states?.includes("ESQUECIDA");
  const color = useFabricColor(tex, p.colorHex);
  const cloth = useMemo(() => buildCloth(hung, length, depth, tex, hangJitter(p.id) + 0.5), [hung, length, depth, tex, p.id]);
  useEffect(() => () => cloth.dispose(), [cloth]);
  const highlight = ctx.highlight === p.id;
  const swing = useRef<THREE.Group>(null); const start = useRef(-1); const [puff, setPuff] = useState(0);
  useEffect(() => { if (swingKey) start.current = performance.now(); }, [swingKey]);
  useEffect(() => { cloth.front.color.set(forgotten ? "#b9b4aa" : cloth.photo ? "#ffffff" : color); cloth.back.color.set(forgotten ? "#a9a49b" : color); cloth.setSheen(color); }, [cloth, color, forgotten]);
  useFrame(({ clock }) => {
    CLOTH_TIME.value = clock.elapsedTime; CLOTH_SWAY.value = ctx.reduced ? 0 : 1;
    const glow = highlight ? 0.22 + 0.15 * Math.sin(clock.elapsedTime * 4) : 0; cloth.front.emissiveIntensity = glow; cloth.back.emissiveIntensity = glow;
    if (!swing.current) return;
    const s = start.current < 0 ? 99 : (performance.now() - start.current) / 1000;
    swing.current.rotation.x = s < 1.8 && !ctx.reduced ? Math.sin(s * 9) * 0.14 * Math.exp(-s * 2.2) : 0;   // balança no gancho e para
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); start.current = performance.now();
    if (forgotten && !ctx.reduced) { setPuff((x) => x + 1); setTimeout(() => ctx.onPick(p.id), 380); } else ctx.onPick(p.id);
  };
  const yaw = (along === "x" ? Math.PI / 2 : 0) + jitter;
  return (
    <group rotation={[0, yaw, 0]} visible={!ctx.engine?.hidden.has(p.id)} name={`hung-${p.id}`}>
      <group ref={swing}>
        <Hanger kind={hung} finish={ctx.hanger} gold={p.states?.includes("FAVORITA")} modelUrl={ctx.hangerModel} />
        <mesh geometry={cloth.frontGeo} material={cloth.front} castShadow receiveShadow onClick={click} {...pointer} />
        <mesh geometry={cloth.backGeo} material={cloth.back} castShadow receiveShadow onClick={click} {...pointer} />
        <group position={[0, -0.12, 0]}><DustPuff trigger={puff} reduced={ctx.reduced} /></group>
        {p.states?.includes("30_USOS") && <GoldDot position={[cloth.width / 2 - 0.03, -0.08, depth / 2 + 0.012]} />}
        {highlight && <pointLight position={[0, -length / 2, 0.35]} intensity={1.4} distance={1.1} color="#ffe6a0" />}
      </group>
      {/* etiquetas no gancho, de frente para quem olha a fileira */}
      <group rotation={[0, -yaw, 0]} position={[0, -0.1, 0]}>
        {p.salePrice != null && <HangTag text={fmtPriceShort(Number(p.salePrice), "BRL", 0)} position={[0.03, -0.02, 0.05]} />}
        {ctx.tagged.has(p.id) && <HangTag text={t("room3d.roomScene.n2_chance")} color="#fde2e4" fg="#9d174d" position={[-0.03, -0.12, 0.05]} />}
        {p.states?.includes("GARIMPO") && <HangTag text={t("common.garimpo")} color="#1F7A76" fg="#fff" position={[0.02, -0.22, 0.05]} w={0.11} />}
      </group>
    </group>
  );
}

/** Sapato ou acessório na prateleira da arara: par de sapatos (ou a peça) com a cor da peça e a foto por cima. */
export function ShelfPiece({ p, ctx, position }: { p: HungPiece; ctx: HungCtx; position: [number, number, number] }) {
  const tex = useTex(p.imageUrl ?? p.thumbnailUrl); const color = useFabricColor(tex, p.colorHex);
  const shoe = /shoe|calcad/.test((p.category ?? "").toLowerCase());
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); ctx.onPick(p.id); };
  return (
    <group position={position} visible={!ctx.engine?.hidden.has(p.id)} name={`shelf-${p.id}`} onClick={click} {...pointer}>
      {shoe ? [-0.055, 0.055].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <RoundedBox args={[0.09, 0.07, 0.25]} radius={0.025} position={[0, 0.035, 0]} castShadow><meshStandardMaterial color={color} roughness={0.7} /></RoundedBox>
          <mesh position={[0, 0.006, 0]}><boxGeometry args={[0.095, 0.012, 0.26]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>
        </group>
      )) : <RoundedBox args={[0.24, 0.16, 0.12]} radius={0.03} position={[0, 0.08, 0]} castShadow><meshStandardMaterial color={color} roughness={0.75} /></RoundedBox>}
      {tex && <mesh position={[0, shoe ? 0.075 : 0.165, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[shoe ? 0.18 : 0.2, shoe ? 0.2 : 0.1]} /><meshStandardMaterial map={tex} transparent alphaTest={0.12} /></mesh>}
    </group>
  );
}
