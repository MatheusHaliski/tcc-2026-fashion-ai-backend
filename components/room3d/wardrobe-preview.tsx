"use client";
import { useEffect, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { Label3D } from "@/components/room3d/room-props";
import { useI18n } from "@/lib/i18n/i18n";

/** Acabamento de um bloco do móvel (cor, material e, nos itens de marca/celebridade, logo, arte e nome gravado). */
export interface BlockFinish { color?: string; roughness?: number; metalness?: number; artUrl?: string | null; logoUrl?: string | null; labelText?: string | null; kelvin?: number; material?: string; }
export type Finishes = Partial<Record<string, BlockFinish>>;

const W = 2.4, D = 0.6, DOOR_W = 0.6;
const Y = { base1: 0.3, drawers1: 0.96, doors1: 2.16, top1: 2.5 };
const DRAWER_H = (Y.drawers1 - Y.base1) / 3, DRAWER_W = W / 8;

function useTex(url?: string | null) {
  const [t, setT] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const u = mediaUrl(url ?? null); if (!u) { setT(null); return; }
    let alive = true; const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
    l.load(u, (x) => { if (!alive) return; x.colorSpace = THREE.SRGBColorSpace; setT(x); }, undefined, () => alive && setT(null));
    return () => { alive = false; };
  }, [url]);
  return t;
}

function mat(f: BlockFinish | undefined, fallback: string, map?: THREE.Texture | null, selected?: boolean) {
  // key: o three.js só recompila o shader com "map" num material novo (textura chega depois do 1º render)
  return <meshStandardMaterial key={map ? map.uuid : "plain"} color={map ? "#ffffff" : f?.color ?? fallback} map={map ?? undefined} roughness={f?.roughness ?? 0.8} metalness={f?.metalness ?? 0.02}
    emissive={selected ? "#E9B949" : "#000000"} emissiveIntensity={selected ? 0.25 : 0} transparent={f?.material === "VIDRO"} opacity={f?.material === "VIDRO" ? 0.55 : 1} />;
}

/**
 * Pré-visualização do FAI Origem no "Criar guarda-roupa 3D" (RF39): cada bloco (porta, frente de gaveta, puxador,
 * maleiro, base, cabides, placa de logo, iluminação e tapete) usa o próprio acabamento; tocar num bloco o seleciona
 * para edição — é o criador de blocos.
 */
export default function WardrobePreview({ finishes, selected, onPick, name }: { finishes: Finishes; selected?: string | null; onPick?: (slot: string) => void; name?: string }) {
  const { t } = useI18n();
  const art = useTex(finishes.DOOR?.artUrl); const logo = useTex(finishes.LOGO?.logoUrl ?? finishes.DOOR?.logoUrl);
  const pick = (slot: string) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick?.(slot); };
  const hover = { onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = onPick ? "pointer" : ""; }, onPointerOut: () => { document.body.style.cursor = ""; } };
  const led = finishes.LIGHT?.color ?? "#FFF1D6";
  const label = finishes.LOGO?.labelText ?? finishes.DOOR?.labelText ?? name ?? null;
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 36, position: [1.9, 1.9, 4.6] }} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }} aria-label={t("room3d.wardrobePreview.pre_visualizacao_do_guarda_roupa")}>
      <color attach="background" args={["#efe9df"]} />
      <hemisphereLight args={["#ffffff", "#d9cbb5", 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#b8906a" roughness={0.8} /></mesh>
      {/* tapete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 1.2]} onClick={pick("RUG")} {...hover}><circleGeometry args={[1.0, 48]} />{mat(finishes.RUG, "#d9b8a0", null, selected === "RUG")}</mesh>
      {/* carcaça */}
      <mesh position={[0, Y.top1 / 2, -D / 2 + 0.01]}><boxGeometry args={[W, Y.top1, 0.02]} /><meshStandardMaterial color="#e7e2d9" /></mesh>
      {[-W / 2 - 0.01, W / 2 + 0.01].map((x) => <mesh key={x} position={[x, Y.top1 / 2, 0]} castShadow><boxGeometry args={[0.02, Y.top1, D]} />{mat(finishes.DOOR, "#F4F2EF")}</mesh>)}
      {/* maleiro e base */}
      <mesh position={[0, (Y.doors1 + Y.top1) / 2, 0]} onClick={pick("TOP")} {...hover} castShadow><boxGeometry args={[W + 0.04, Y.top1 - Y.doors1, D]} />{mat(finishes.TOP, "#F4F2EF", null, selected === "TOP")}</mesh>
      <mesh position={[0, Y.base1 / 2, 0]} onClick={pick("BASE")} {...hover} castShadow><boxGeometry args={[W + 0.04, Y.base1, D]} />{mat(finishes.BASE, "#e2dccf", null, selected === "BASE")}</mesh>
      {/* iluminação LED sob o maleiro */}
      <mesh position={[0, Y.doors1 - 0.015, D / 2 - 0.02]} onClick={pick("LIGHT")} {...hover}><boxGeometry args={[W - 0.06, 0.02, 0.02]} /><meshBasicMaterial color={led} toneMapped={false} /></mesh>
      <pointLight position={[0, Y.doors1 - 0.1, 0.6]} intensity={0.6} distance={2} color={led} />
      {/* portas (a porta 2 fica entreaberta para mostrar os cabides) */}
      {[0, 1, 2, 3].map((i) => {
        const x = -W / 2 + i * DOOR_W + DOOR_W / 2, h = Y.doors1 - Y.drawers1, open = i === 1;
        return (
          <group key={i}>
            <group position={[x - DOOR_W / 2, Y.drawers1 + h / 2, D / 2]} rotation={[0, open ? -1.1 : 0, 0]}>
              <mesh position={[DOOR_W / 2, 0, 0.01]} onClick={pick("DOOR")} {...hover} castShadow><boxGeometry args={[DOOR_W - 0.008, h - 0.008, 0.02]} />{mat(finishes.DOOR, "#F4F2EF", art, selected === "DOOR")}</mesh>
              <mesh position={[DOOR_W - 0.035, 0, 0.024]} onClick={pick("HANDLE")} {...hover}><boxGeometry args={[0.014, 0.3, 0.012]} />{mat(finishes.HANDLE, "#d6d2ca", null, selected === "HANDLE")}</mesh>
              {/* placa de logo / monograma */}
              <group position={[DOOR_W / 2, h * 0.3, 0.023]} onClick={pick("LOGO")} {...hover}>
                <RoundedBox args={[0.2, 0.1, 0.008]} radius={0.004}>{mat(finishes.LOGO, "#C9A227", null, selected === "LOGO")}</RoundedBox>
                {logo ? <mesh position={[0, 0, 0.005]}><planeGeometry args={[0.08, 0.08]} /><meshBasicMaterial map={logo} transparent /></mesh>
                  : <Label3D text={label ? label.slice(0, 10) : "FAI"} w={0.18} h={0.07} px={256} fg="rgba(0,0,0,.55)" font="700 60px Georgia, serif" position={[0, 0, 0.005]} />}
              </group>
            </group>
            {open && [0, 1, 2].map((k) => (
              <group key={k} position={[x - 0.15 + k * 0.15, Y.doors1 - 0.2, 0]} onClick={pick("HANGER")} {...hover}>
                <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 0.36, 8]} />{mat(finishes.HANGER, "#6B5A4A", null, selected === "HANGER")}</mesh>
                <mesh position={[0, 0.05, 0]}><torusGeometry args={[0.02, 0.004, 8, 16, Math.PI * 1.4]} />{mat(finishes.HANGER, "#6B5A4A", null, selected === "HANGER")}</mesh>
              </group>))}
          </group>
        );
      })}
      {/* 24 frentes de gaveta */}
      {Array.from({ length: 24 }, (_, n) => {
        const col = n % 8, row = Math.floor(n / 8);
        return (
          <group key={n} position={[-W / 2 + col * DRAWER_W + DRAWER_W / 2, Y.drawers1 - (row + 0.5) * DRAWER_H, D / 2]}>
            <mesh onClick={pick("DRAWER")} {...hover} castShadow><boxGeometry args={[DRAWER_W - 0.008, DRAWER_H - 0.008, 0.02]} />{mat(finishes.DRAWER, "#F4F2EF", null, selected === "DRAWER")}</mesh>
            <mesh position={[0, DRAWER_H / 2 - 0.035, 0.013]} onClick={pick("HANDLE")} {...hover}><boxGeometry args={[DRAWER_W * 0.5, 0.012, 0.008]} />{mat(finishes.HANDLE, "#d6d2ca", null, selected === "HANDLE")}</mesh>
          </group>
        );
      })}
      {/* móveis à parte (nível Closet/Atelier): sapateira, vitrine de bolsas, porta-joias e ilha */}
      {finishes.SHOE_RACK && <group position={[1.8, 0, 0]} onClick={pick("SHOE_RACK")} {...hover}>
        <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.9, 0.6, 0.4]} />{mat(finishes.SHOE_RACK, "#e2dccf", null, selected === "SHOE_RACK")}</mesh>
        {[0.2, 0.4].map((y) => <mesh key={y} position={[0, y, 0.201]}><boxGeometry args={[0.86, 0.012, 0.004]} /><meshStandardMaterial color="#000000" transparent opacity={0.25} /></mesh>)}
      </group>}
      {finishes.JEWELRY && <mesh position={[1.8, finishes.SHOE_RACK ? 0.67 : 0.07, 0]} onClick={pick("JEWELRY")} {...hover} castShadow><boxGeometry args={[0.34, 0.14, 0.26]} />{mat(finishes.JEWELRY, "#3a2a3a", null, selected === "JEWELRY")}</mesh>}
      {finishes.BAG_DISPLAY && <group position={[-1.75, 0, 0]} onClick={pick("BAG_DISPLAY")} {...hover}>
        <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[0.6, 1.8, 0.42]} />{mat(finishes.BAG_DISPLAY, "#DDE6EA", null, selected === "BAG_DISPLAY")}</mesh>
        {[0.5, 1.0, 1.5].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.56, 0.015, 0.38]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
      </group>}
      {finishes.ISLAND && <mesh position={[0.9, 0.3, 2.0]} onClick={pick("ISLAND")} {...hover} castShadow><boxGeometry args={[1.2, 0.6, 0.6]} />{mat(finishes.ISLAND, "#EDEAE4", null, selected === "ISLAND")}</mesh>}
      {label && <Label3D text={label} w={1.2} h={0.1} px={512} fg="#3a2f1a" font="italic 600 44px Georgia, serif" position={[0, Y.top1 + 0.12, 0.05]} />}
      <ContactShadows position={[0, 0.005, 0.3]} opacity={0.35} scale={6} blur={2.4} far={3} />
      <OrbitControls target={[0, 1.2, 0]} enablePan={false} minDistance={2.5} maxDistance={7} minPolarAngle={0.9} maxPolarAngle={1.45} minAzimuthAngle={-0.8} maxAzimuthAngle={0.8} />
    </Canvas>
  );
}
