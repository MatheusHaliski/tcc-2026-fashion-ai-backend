"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Canvas, events as pointerEvents, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Label3D, pointer } from "@/components/room3d/room-props";
import type { RoomInteraction } from "@/lib/room3d/interaction";
import { insideW2, W2, wallOpacity, wallSide, type WallSpec } from "@/lib/room3d/room-bounds";
import type { WallMode } from "@/lib/room3d/camera-views";
import { useI18n } from "@/lib/i18n/i18n";
import { D, EXT_W, Y } from "./room-layout";

/* Paredes do quarto (somem com a câmera atrás delas) e a carcaça dos guarda-roupas: corpo, 2º móvel e o móvel trancado. */

/** Objeto com todos os ancestrais visíveis: os da parede escondida (câmera atrás dela) não recebem cliques. */
function shown(o: THREE.Object3D | null): boolean { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; }
/** O Raycaster do three não pula objetos invisíveis: só ficam os acertos em objetos visíveis (filtro dos eventos do R3F). */
export const shownHits = <T extends { object: THREE.Object3D }>(hits: T[]) => hits.filter((h) => shown(h.object));
export const visibleHits: NonNullable<React.ComponentProps<typeof Canvas>["events"]> = (store) => ({ ...pointerEvents(store), filter: (hits) => shownHits(hits) });

/**
 * Parede do quarto de quatro paredes (room-bounds.ts), no espaço local dela: x ao longo da parede, y para cima, z para
 * dentro do quarto. Plano de um lado só, virado para dentro (de fora a GPU já o descarta), que recebe sombra e nunca
 * projeta. Com a câmera atrás dela (foto/órbita), o plano some aos poucos, os objetos presos nela (janela, porta,
 * interruptor, quadro, guarda-roupas…) somem e deixam de receber cliques, e fica uma faixa baixa de 0,3 m para ler o
 * contorno do quarto. `userData.reveal()` mostra tudo por um instante (foto do espelho) e devolve como estava.
 */
export function Wall({ spec, color, strip, mode = "recortadas", children }: { spec: WallSpec; color: string; strip: string; mode?: WallMode; children?: React.ReactNode }) {
  const group = useRef<THREE.Group>(null), plane = useRef<THREE.Mesh>(null), band = useRef<THREE.Mesh>(null), props = useRef<THREE.Group>(null);
  const current = useRef({ o: 1, low: false });
  // paredes baixas (Configurações, planta, casa de bonecas): some o plano, ficam a faixa do rodapé e os móveis presos nela
  const apply = (o: number, low = false) => {
    current.current = { o, low };
    const mat = plane.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat && plane.current) { const transparent = o < 0.999; if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; } mat.opacity = o; mat.depthWrite = o > 0.5; plane.current.visible = !low && o > 0.001; }
    if (props.current) props.current.visible = low || o > 0.02;
    if (band.current) band.current.visible = low || o < 0.98;
  };
  useLayoutEffect(() => {
    const g = group.current; if (!g) return;
    g.userData.wall = spec.id; g.userData.reveal = () => { const before = current.current; apply(1); return () => apply(before.o, before.low); };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // inteiras: nunca somem (de fora, o plano de um lado só já não aparece); recortadas: somem as que tapam a vista
  useFrame(({ camera }) => (mode === "baixas" ? apply(1, true) : apply(mode === "inteiras" ? 1 : wallOpacity(wallSide(camera.position, spec)))));
  return (
    <group ref={group} position={spec.center} rotation={[0, spec.yaw, 0]}>
      <mesh ref={plane} position={[0, spec.height / 2, 0]} receiveShadow><planeGeometry args={[spec.width, spec.height]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
      <mesh ref={band} position={[0, 0.15, 0.004]} visible={false}><planeGeometry args={[spec.width, 0.3]} /><meshStandardMaterial color={strip} roughness={1} side={THREE.DoubleSide} /></mesh>
      <group ref={props} name={`wall-props-${spec.id}`}>{children}</group>
    </group>
  );
}

/** Carcaça do móvel FAI Origem: fundo, laterais, prateleiras e as divisórias entre as portas (largura `w`, centro em x = 0). */
export function Carcass({ w, dividers, carcass }: { w: number; dividers: number[]; carcass: THREE.MeshStandardMaterialParameters }) {
  return (
    <>
      <mesh position={[0, Y.top1 / 2, -D / 2 + 0.01]}><boxGeometry args={[w, Y.top1, 0.02]} /><meshStandardMaterial {...carcass} color="#e7e2d9" /></mesh>
      {[-w / 2 - 0.01, w / 2 + 0.01].map((x) => <mesh key={x} position={[x, Y.top1 / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.02, Y.top1, D]} /><meshStandardMaterial {...carcass} /></mesh>)}
      {[Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={y} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.04, 0.02, D]} /><meshStandardMaterial {...carcass} /></mesh>)}
      {dividers.map((x) => <mesh key={x} position={[x, (Y.drawers1 + Y.doors1) / 2, 0]}><boxGeometry args={[0.018, Y.doors1 - Y.drawers1, D - 0.02]} /><meshStandardMaterial {...carcass} /></mesh>)}
    </>
  );
}

/** Corpo do 2º guarda-roupa: obstáculo pela caixa orientada (girado 90° na parede oeste), como o espelho. */
export function Wardrobe2Body({ position, engine, children }: { position: [number, number, number]; engine?: RoomInteraction; children?: React.ReactNode }) {
  const body = useRef<THREE.Group>(null);
  useEffect(() => { const g = body.current; if (!engine || !g) return; g.userData.collider = { ...W2.collider }; engine.solids.add(g); return () => { engine.solids.delete(g); }; }, [engine]);
  // câmera da órbita dentro da carcaça (a órbita gira inteira): o móvel some em vez de aparecer por dentro (a colisão fica)
  useFrame(({ camera }) => { const g = body.current; if (g) g.visible = !insideW2(camera.position, Y.top1); });
  return <group ref={body} name="guarda-roupa-2" position={position}>{children}</group>;
}

/**
 * 2º guarda-roupa abaixo do Loft (sem as portas 5–6 e as gavetas 25–36): móvel fechado com a placa "Disponível no
 * nível Loft", que leva à loja de pontos — poucas chamadas de desenho, sem portas que abrem de mentira.
 */
export function LockedWardrobe({ carcass, finish, onOpen }: { carcass: THREE.MeshStandardMaterialParameters; finish: THREE.MeshStandardMaterialParameters; onOpen: () => void }) {
  const { t } = useI18n();
  const doorsH = Y.doors1 - Y.drawers1;
  return (
    <group>
      <mesh position={[0, Y.top1 / 2, 0]} castShadow receiveShadow><boxGeometry args={[EXT_W + 0.04, Y.top1, D]} /><meshStandardMaterial {...carcass} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[(s * EXT_W) / 4, Y.drawers1 + doorsH / 2, D / 2 + 0.01]}><boxGeometry args={[EXT_W / 2 - 0.012, doorsH - 0.012, 0.02]} /><meshStandardMaterial {...finish} /></mesh>)}
      <mesh position={[0, (Y.base1 + Y.drawers1) / 2, D / 2 + 0.01]}><boxGeometry args={[EXT_W - 0.012, Y.drawers1 - Y.base1 - 0.012, 0.02]} /><meshStandardMaterial {...finish} /></mesh>
      <group position={[0, 1.5, D / 2 + 0.03]} onClick={(e) => { e.stopPropagation(); onOpen(); }} {...pointer}>
        <RoundedBox args={[1.3, 0.4, 0.016]} radius={0.03} smoothness={4}><meshStandardMaterial color="#2b2622" roughness={0.5} /></RoundedBox>
        <Label3D text={t("room3d.roomScene.disponivel_no_nivel_loft")} w={1.2} h={0.16} px={768} fg="#E9B949" font="600 46px Inter, Arial, sans-serif" position={[0, 0.07, 0.009]} />
        <Label3D text={t("room3d.roomScene.ver_na_loja_de_pontos")} w={0.9} h={0.1} px={640} fg="#f6f1e7" font="500 40px Inter, Arial, sans-serif" position={[0, -0.1, 0.009]} />
      </group>
    </group>
  );
}
