"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { RoomFixture, DoubleBed, CeilingFixture, BED_POSITION } from "./room-furniture";
import { ClosetLights, CorkBoard, deg, DressForm, FaiMedallion, FaiNeonSign, FaiRug, KeyHook, Label3D, LightSwitch, RoomDoor, RoomWindow, TailorTape, WallCalendar, WindowLight } from "@/components/room3d/room-props";
import RoomAvatarController from "./room-avatar-controller";
import { cameraViewMeta, wallsFor } from "@/lib/room3d/camera-views";
import { DEFAULT_CAMERA_OPTIONS, graphicsOf } from "@/lib/room3d/room-settings";
import { CHAIR, seatOf } from "@/lib/room3d/interaction";
import { ROOM, toWall, W2, walkArea, wallById } from "@/lib/room3d/room-bounds";
import { useI18n } from "@/lib/i18n/i18n";
import type { Ctx, RoomModule3D, RoomPiece3D, RoomSceneProps } from "./room-scene-types";
import { atLeast, D, DOOR_W, DRAWER_H, DRAWER_W, EXT_DRAWER_W, EXT_W, kelvinColor, layoutFor, moduleAnchor, moduleFacing, W, Y } from "./room-layout";
import { PieceMesh } from "./piece-mesh";
import { LoosePieces } from "./loose-pieces";
import { DoorBay, Drawer, LookBox } from "./wardrobe-bays";
import { Mirror } from "./room-mirror";
import { BagDisplay, Chair, Island, SaleRack } from "./room-stands";
import { CameraProbe, CameraRig, FogFollow, OrbitTurn, PresetCamera, ResponsiveFov } from "./room-cameras";
import { Carcass, LockedWardrobe, visibleHits, Wall, Wardrobe2Body } from "./room-walls";
export type { MirrorOverlay, RoomData3D, RoomDecoration, RoomModule3D, RoomPiece3D, RoomSceneProps, SceneView } from "./room-scene-types";
export { kelvinColor, LEVELS, moduleAnchor, moduleFacing } from "./room-layout";
export { shownHits } from "./room-walls";

/* RF27/RF32 — Meu Quarto 3D (React Three Fiber). Quarto de quatro paredes (lib/room3d/room-bounds.ts): móvel FAI Origem
 * paramétrico (molde = função de parâmetros, acabamento = dado) na parede norte, 2º guarda-roupa na oeste, porta e duas
 * janelas; peças como planos com a foto sem fundo (GLB quando houver modelo 3D do RF16); câmera que gira a cena (a
 * parede que fica na frente da câmera some). Todos os elementos de docs/meu-quarto/05-elementos-do-quarto.md: móvel,
 * objetos do quarto, módulos por nível (RF30) e elementos dos desafios ativos. Unidades em metros. */

const NORTH = wallById("north"), EAST = wallById("east"), SOUTH = wallById("south"), WEST = wallById("west");

export default function RoomScene({ data, open, onToggle, highlight, focusModule, onPick, onReady, lit = new Set(), mirror, dark, lightOn, lightIntensity, onToggleLight, onVistaMe, onCopilot,
  copilotPoint, copilotTalking, onKeys, onUnbox, unboxing, onAddToDrawer, gameplay, view, onViewStep, poseRef }: RoomSceneProps) {
  const { t } = useI18n();
  const router = useRouter();
  const controls = useRef<unknown>(null);
  const [dprCap, setDprCap] = useState<number | null>(null);
  const [, refreshInteractions] = useState(0);
  useEffect(() => { if (!gameplay) return; const refresh = () => refreshInteractions(n => n + 1); gameplay.engine.listeners.add(refresh); return () => { gameplay.engine.listeners.delete(refresh); }; }, [gameplay?.engine]);
  const reduced = view?.reduced ?? !!data.ambient?.reduceMotion;
  // hora do dia: a escolhida nas Configurações; "auto", a do perfil (fixa = tarde)
  const period = view?.period && view.period !== "auto" ? view.period : data.ambient?.period === "fixed" ? "afternoon" : data.ambient?.period ?? "afternoon";
  const night = period === "night";
  const ceilingOn = lightOn ?? data.light?.on ?? night;
  const brightness = Math.max(0, Math.min(1, lightIntensity ?? data.light?.intensity ?? .75));
  const level = data.level ?? "ESTREIA";
  const L = useMemo(() => layoutFor(level), [level]);
  useEffect(() => { gameplay?.engine.mirror.set(...L.mirror); }, [gameplay?.engine, L]);
  const byId = useMemo(() => Object.fromEntries(data.modules.map((m) => [m.id, m])), [data.modules]);
  const doorFinish = byId["door:1"]?.finish ?? { color: "#F4F2EF", roughness: 0.8 };
  const signature = atLeast(level, "LOFT") && !!byId["signature"];
  const finishOf = (m?: RoomModule3D): THREE.MeshStandardMaterialParameters => {
    const f: NonNullable<RoomModule3D["finish"]> = m?.finish ?? doorFinish; const glass = f?.material === "VIDRO" || f?.material === "ACRILICO";
    return { color: f?.color ?? doorFinish.color ?? "#F4F2EF", roughness: f?.roughness ?? doorFinish.roughness ?? 0.8, metalness: f?.metalness ?? 0.02, transparent: glass, opacity: glass ? 0.6 : 1 };
  };
  const carcass = { ...finishOf(byId["door:1"]), transparent: false, opacity: 1 };
  const handle = byId["handles"]?.finish?.color ?? "#d6d2ca";
  const plate = byId["logo"]?.finish && (byId["logo"].finish.logoUrl || byId["logo"].finish.labelText || byId["logo"].finish.material) ? byId["logo"].finish : undefined;
  const hangerFinish = byId["hangers"]?.finish ? finishOf(byId["hangers"]) : undefined;
  const kelvin = data.light?.guided ? data.light.kelvin ?? 4000 : 4000;
  const lightColor = kelvinColor(kelvin);
  // temperatura da lâmpada do teto escolhida nas Configurações (para avaliar a cor das roupas); a fita de LED segue a guiada
  const bulbColor = view?.kelvin ? kelvinColor(view.kelvin) : lightColor;
  const mark = atLeast(level, "STUDIO") && data.monogram ? data.monogram : "FAI";
  const cam = data.camera ?? {}; const po = cam.polar ?? [55, 80], zoom = cam.zoom ?? [0.8, 1.6];
  const focus = focusModule ? moduleAnchor(focusModule, level) : null;
  const facing = focusModule ? moduleFacing(focusModule) : null;
  const homeDist = 5.3;
  const shoes = [...(byId["base"]?.pieces ?? []), ...(byId["shoe"]?.pieces ?? [])];
  const shoeCap = atLeast(level, "STUDIO") ? 16 : 10;          // 10 na base do guarda-roupa 1; o excedente vai para a base do 2º
  const showcase = Array.isArray(data.showcase) ? (data.showcase as RoomPiece3D[]) : [];
  const decos = data.decorations ?? [];
  const deco = (t: string) => decos.find((d) => d.type === t);
  const tagged = useMemo(() => new Set(deco("etiqueta_2a_chance")?.taggedPieceIds ?? []), [decos]); // eslint-disable-line react-hooks/exhaustive-deps
  const tapedIds = useMemo(() => new Set(deco("fita_alfaiate")?.tapedPieceIds ?? []), [decos]); // eslint-disable-line react-hooks/exhaustive-deps
  const taped = (m?: RoomModule3D) => !!m && tapedIds.size > 0 && (m.pieces ?? []).some((p) => tapedIds.has(p.id));
  const ctx: Ctx = { highlight, onPick, reduced, tagged, hanger: hangerFinish, hangerModel: byId["hangers"]?.finish?.model3dUrl, engine: gameplay?.engine };
  const boxes: NonNullable<RoomModule3D["lookBoxes"]> = [];
  const penthouse = atLeast(level, "LOFT") && !!byId["season"];
  const pointAt = copilotPoint ? moduleAnchor(copilotPoint, level) : null;
  const litAny = (ids: string[]) => ids.some((i) => lit.has(i));
  // 2º guarda-roupa: funciona com os módulos do Loft (portas 5–6 e gavetas 25–36); sem eles, móvel fechado com a placa
  const w2 = L.loft && (!!byId["door:5"] || !!byId["door:6"] || Array.from({ length: 12 }, (_, i) => byId[`drawer:${i + 25}`]).some(Boolean));
  const wallColor = (day: string, dusk: string) => (night ? dusk : day), strip = night ? "#4a4038" : "#d9cbb5";
  const drop = walkArea(ROOM);
  // Configurações: qualidade (densidade de pixels, sombras), resolução dinâmica, paredes e ponto de vista
  const camOpts = view?.camera ?? DEFAULT_CAMERA_OPTIONS;
  const g = graphicsOf(view?.quality ?? "auto", !!gameplay);
  const dpr: [number, number] = dprCap ? [1, Math.min(g.dpr[1], dprCap)] : g.dpr;
  const walls = wallsFor(camOpts.saved ? "livre" : camOpts.view, view?.walls ?? "recortadas");
  // fora do modo andar, um ponto de vista (ou uma vista salva) assume a câmera; mostrar um módulo volta à órbita
  const preset = !gameplay && !focus && (camOpts.saved || (camOpts.view !== "livre" && !cameraViewMeta(camOpts.view).walkOnly)) ? camOpts : null;
  return (
    <Canvas shadows={g.shadows} dpr={dpr} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 38, position: [1.75, 2.35, 4.8], near: 0.05, far: 40 }} events={visibleHits}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; onReady?.(gl.domElement); }} aria-label={t("room3d.roomScene.meu_quarto_em_3d")}>
      {/* resolução dinâmica: a densidade de pixels cai quando o quadro fica lento e volta quando sobra fôlego */}
      {view?.dynamicRes !== false && <PerformanceMonitor onDecline={() => setDprCap(1)} onIncline={() => setDprCap(null)} />}
      <FogFollow />
      {poseRef && <CameraProbe poseRef={poseRef} />}
      <color attach="background" args={[night ? "#1d1f2a" : "#efe9df"]} />
      <fog attach="fog" args={[night ? "#1d1f2a" : "#efe9df", 8, 16]} />
      <CeilingFixture on={ceilingOn} intensity={brightness} color={bulbColor} />
      <hemisphereLight args={[night ? "#9aa0c8" : period === "morning" ? "#eef4ff" : "#fff6e8", night ? "#2a2433" : "#d9cbb5", night ? 0.55 : 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={night ? 0.35 : period === "golden" ? 1.3 : 1.6} color={period === "golden" ? "#ffd2a0" : period === "morning" ? "#f1f6ff" : "#ffffff"} castShadow={g.shadows} shadow-mapSize={[g.shadowMap, g.shadowMap]} shadow-camera-left={-6.5} shadow-camera-right={6} shadow-camera-top={4} shadow-camera-bottom={-5} />
      {/* luz de preenchimento do outro lado (sem sombra): as paredes de costas para o sol (leste e sul) não ficam cinzentas */}
      <directionalLight position={[-3, 4, -2]} intensity={night ? 0.12 : 0.45} color={night ? "#9aa0c8" : "#fff4e6"} />
      {/* quarto de quatro paredes (room-bounds.ts): piso do tamanho do quarto e teto de um lado só (virado para baixo: de
          cima, na órbita, some; não projeta sombra, então o sol continua entrando) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(ROOM.minX + ROOM.maxX) / 2, 0, (ROOM.minZ + ROOM.maxZ) / 2]} receiveShadow><planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ]} /><meshStandardMaterial color={night ? "#5a4636" : "#b8906a"} roughness={0.75} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[(ROOM.minX + ROOM.maxX) / 2, ROOM.height, (ROOM.minZ + ROOM.maxZ) / 2]}><planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ]} /><meshStandardMaterial color={night ? "#2a2c38" : "#f6f2ec"} emissive={night ? "#000000" : "#f6f2ec"} emissiveIntensity={night ? 0 : 0.3} roughness={1} /></mesh>
      {byId["rug"] && <FaiRug position={[0, 0.004, 1.3]} radius={1.1} night={night} />}

      {/* parede norte: guarda-roupa 1 (FAI Origem), porta, interruptor, gancho das chaves, janela, calendário e quadro de
          cortiça — em coordenadas da cena (o grupo desfaz o deslocamento da parede, que não gira) */}
      <Wall spec={NORTH} color={wallColor("#e8e1d4", "#343747")} strip={strip} mode={walls}><group position={toWall(NORTH, [0, 0, 0])}>
        <group>
          <Carcass w={W} dividers={[1, 2, 3].map((i) => -W / 2 + i * DOOR_W)} carcass={carcass} />
          {/* closet de assinatura (Maison): filetes dourados e placa */}
          {signature && <>
            {[Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={`g${y}`} position={[0, y, D / 2 + 0.002]}><boxGeometry args={[W + 0.04, 0.008, 0.004]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.2} /></mesh>)}
            <Label3D text={t("room3d.roomScene.closet_de_assinatura", { value: data.monogram ? ` · ${data.monogram}` : "" })} w={0.9} h={0.08} px={512} bg="#1a1a1a" fg="#E9B949" font="italic 600 30px Georgia, serif" position={[0, Y.top1 + 0.3, 0.02]} />
          </>}
          {/* iluminação guiada (Studio+): fita de LED sob o maleiro na temperatura escolhida */}
          {atLeast(level, "STUDIO") && <mesh position={[0, Y.doors1 - 0.015, D / 2 - 0.04]}><boxGeometry args={[W - 0.06, 0.008, 0.01]} /><meshBasicMaterial color={lightColor} toneMapped={false} /></mesh>}
        </group>

        {/* portas 1–4 com cabideiro */}
        {[1, 2, 3, 4].map((n) => { const m = byId[`door:${n}`]; return m ? <DoorBay key={n} m={m} x0={-W / 2 + (n - 1) * DOOR_W} doorW={DOOR_W} hingeLeft={(n - 1) % 2 === 0} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} mark={mark} taped={taped(m)} light={lightColor} ctx={ctx} plate={plate} /> : null; })}
        {/* 24 gavetas */}
        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => { const m = byId[`drawer:${n}`]; if (!m) return null; const col = (n - 1) % 8, row = Math.floor((n - 1) / 8);
          return <Drawer key={n} m={m} x={-W / 2 + col * DRAWER_W + DRAWER_W / 2} y={Y.drawers1 - (row + 0.5) * DRAWER_H} w={DRAWER_W} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} taped={taped(m)} onAdd={() => onAddToDrawer?.(m.id)} ctx={ctx} />; })}

        {/* maleiro: caixas de look; no Penthouse, as caixas da troca de estação; na Cápsula, a caixa trancada com fita */}
        {boxes.slice(0, penthouse ? 6 : tapedIds.size ? 7 : 8).map((b, i) => <LookBox key={b.id} b={b} x={-W / 2 + 0.16 + i * 0.3} />)}
        {penthouse && <LookBox x={-W / 2 + 0.16 + 6 * 0.3} season={t("room3d.roomScene.fora_de_estacao")} count={(byId["season"]?.pieces ?? []).length} />}
        {tapedIds.size > 0 && <group position={[-W / 2 + 0.16 + 7 * 0.3, 0, 0]}><LookBox x={0} season={t("room3d.roomScene.fora_da_capsula")} count={tapedIds.size} /><TailorTape width={0.3} position={[0, Y.doors1 + 0.16, 0.225]} rotation={[0, 0, 0.6]} /></group>}

        {/* base de calçados (vira Sapateira no Closet) com LED que acende no Vista-me; até 10 aqui, o resto no 2º guarda-roupa */}
        {atLeast(level, "STUDIO") && <mesh position={[0, 0.16, 0.05]} rotation={[-0.25, 0, 0]}><boxGeometry args={[W - 0.04, 0.012, 0.36]} /><meshStandardMaterial color="#d9cbb5" /></mesh>}
        {shoes.slice(0, 10).map((p, i) => <group key={p.id} position={[-W / 2 + 0.16 + i * 0.23, 0.14, 0.12]}><PieceMesh p={p} w={0.22} h={0.2} ctx={ctx} /></group>)}
        <mesh position={[0, 0.02, D / 2 - 0.01]}><boxGeometry args={[W - 0.04, 0.01, 0.01]} /><meshBasicMaterial color={litAny(["base", "shoe"]) ? "#ffd27a" : "#9b958a"} toneMapped={false} /></mesh>
        {litAny(["base", "shoe"]) && <pointLight position={[0, 0.2, 0.6]} intensity={1} distance={1.6} color="#ffe6a0" />}
        {atLeast(level, "STUDIO") && <Label3D text={t("room3d.roomScene.sapateira")} w={0.34} h={0.05} fg="#6b5a4a" position={[0, 0.26, D / 2 + 0.005]} />}

        {/* luzes do closet: marcos do Inventory Score */}
        {data.closetLights && data.closetLights.milestones.length > 0 && <ClosetLights y={Y.top1 + 0.1} width={W} milestones={data.closetLights.milestones} celebrate={!!mirror?.celebrate} reduced={reduced} />}

        {/* parede: porta do quarto (a chave fica no gancho ao lado), interruptor (tema), janela, calendário e quadro de cortiça */}
        <RoomDoor position={L.door} night={night} onClick={onKeys ? () => onKeys() : undefined} />
        {/* identidade FashionAI: letreiro de neon acima da porta (o batente termina em 2,11 m) */}
        <FaiNeonSign position={[L.door[0] - 0.03, 2.47, -D / 2 - 0.004]} w={1.12} />
        <RoomFixture engine={gameplay?.engine} id="switch" position={L.switch} kind="light" run={onToggleLight}><LightSwitch position={[0, 0, 0]} on={ceilingOn} onToggle={() => onToggleLight?.()} /></RoomFixture>
        <KeyHook position={L.keys} keys={data.keys ?? []} onClick={() => onKeys?.()} />
        <RoomWindow position={L.window} period={period} light={false} seasonal={data.ambient?.seasonal && data.ambient.seasonal !== "null" ? data.ambient.seasonal : null} />
        {deco("calendario_parede") && <WallCalendar position={L.calendar} days={deco("calendario_parede")!.days ?? 0} />}
        {deco("quadro_cortica") && <CorkBoard position={L.cork} days={deco("quadro_cortica")!.days ?? 10} polaroids={deco("quadro_cortica")!.polaroids ?? []} />}
      </group></Wall>

      {/* o sol da janela norte fica fora da parede: com a câmera atrás dela, a luz do quarto continua acesa */}
      <WindowLight position={L.window} period={period} />

      {/* parede oeste: o 2º guarda-roupa (a extensão do Loft: portas 5–6 e gavetas 25–36, mesmos endereços) */}
      <Wall spec={WEST} color={wallColor("#e2dacb", "#2e3140")} strip={strip} mode={walls}>
        <Wardrobe2Body position={toWall(WEST, [W2.x, 0, W2.z])} engine={gameplay?.engine}>
          {w2 ? <>
            <Carcass w={EXT_W + 0.02} dividers={[0]} carcass={carcass} />
            {signature && [Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={`g${y}`} position={[0, y, D / 2 + 0.002]}><boxGeometry args={[EXT_W + 0.06, 0.008, 0.004]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.2} /></mesh>)}
            {atLeast(level, "STUDIO") && <mesh position={[0, Y.doors1 - 0.015, D / 2 - 0.04]}><boxGeometry args={[EXT_W - 0.04, 0.008, 0.01]} /><meshBasicMaterial color={lightColor} toneMapped={false} /></mesh>}
            {[5, 6].map((n) => { const m = byId[`door:${n}`]; return m ? <DoorBay key={n} m={m} x0={-EXT_W / 2 + (n - 5) * (EXT_W / 2)} doorW={EXT_W / 2} hingeLeft={n === 5} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} mark={mark} taped={taped(m)} light={lightColor} ctx={ctx} plate={plate} /> : null; })}
            {Array.from({ length: 12 }, (_, i) => i + 25).map((n) => { const m = byId[`drawer:${n}`]; if (!m) return null; const k = n - 25;
              return <Drawer key={n} m={m} x={-EXT_W / 2 + (k % 4) * EXT_DRAWER_W + EXT_DRAWER_W / 2} y={Y.drawers1 - (Math.floor(k / 4) + 0.5) * DRAWER_H} w={EXT_DRAWER_W} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} taped={taped(m)} onAdd={() => onAddToDrawer?.(m.id)} ctx={ctx} />; })}
            {boxes.slice(8, 13).map((b, i) => <LookBox key={b.id} b={b} x={-EXT_W / 2 + 0.2 + i * 0.32} />)}
            {atLeast(level, "STUDIO") && <mesh position={[0, 0.16, 0.05]} rotation={[-0.25, 0, 0]}><boxGeometry args={[EXT_W - 0.02, 0.012, 0.36]} /><meshStandardMaterial color="#d9cbb5" /></mesh>}
            {shoes.slice(10, shoeCap).map((p, i) => <group key={p.id} position={[-EXT_W / 2 + 0.16 + i * 0.23, 0.14, 0.12]}><PieceMesh p={p} w={0.22} h={0.2} ctx={ctx} /></group>)}
            <mesh position={[0, 0.02, D / 2 - 0.01]}><boxGeometry args={[EXT_W - 0.02, 0.01, 0.01]} /><meshBasicMaterial color={litAny(["base", "shoe"]) ? "#ffd27a" : "#9b958a"} toneMapped={false} /></mesh>
          </> : <LockedWardrobe carcass={carcass} finish={finishOf(byId["door:1"])} onOpen={() => router.push("/points")} />}
        </Wardrobe2Body>
      </Wall>

      {/* parede leste: a 2ª janela (sem holofote próprio: a luz do sol já vem da 1ª), a cabeceira da cama e o medalhão FashionAI */}
      <Wall spec={EAST} color={wallColor("#e4dccd", "#30333f")} strip={strip} mode={walls}>
        <RoomWindow position={toWall(EAST, L.window2)} period={period} light={false} seasonal={data.ambient?.seasonal && data.ambient.seasonal !== "null" ? data.ambient.seasonal : null} />
        {/* identidade FashionAI: o medalhão do logo acima da cabeceira da cama (a cama encosta nesta parede) */}
        <FaiMedallion position={toWall(EAST, [ROOM.maxX - 0.015, 2.12, BED_POSITION[2]])} />
      </Wall>
      {/* parede sul: livre (é a parede da câmera na visão geral) */}
      <Wall spec={SOUTH} color={wallColor("#e6dfd2", "#32353f")} strip={strip} mode={walls} />

      {/* vitrine da peça ícone */}
      {showcase.length > 0 && <group position={L.showcase}>
        <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.36, 0.9, 0.36]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>
        <mesh position={[0, 1.12, 0]}><boxGeometry args={[0.34, 0.44, 0.34]} /><meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.02} transparent opacity={0.35} /></mesh>
        <group position={[0, 1.1, 0]}><PieceMesh p={showcase[0]} w={0.26} h={0.26} ctx={ctx} /></group>
        <Label3D text={t("room3d.roomScene.peca_icone")} w={0.3} h={0.05} fg="#6b5a4a" position={[0, 0.8, 0.185]} />
      </group>}
      {atLeast(level, "STUDIO") && (byId["bags"] || byId["jewelry"]) && <BagDisplay position={L.bags} bagModel={byId["bags"]?.finish?.model3dUrl} jewelryModel={byId["jewelry"]?.finish?.model3dUrl} bags={byId["bags"]?.pieces ?? []} jewelry={byId["jewelry"]?.pieces ?? []} ctx={ctx} />}
      {atLeast(level, "LOFT") && byId["island"] && <Island position={L.island} boxes={boxes.slice(0, 3)} modelUrl={byId["island"]?.finish?.model3dUrl} />}

      {data.modules.filter(m => m.slotType === "DOOR" || m.slotType === "DRAWER").map(m => {
        const anchor = moduleAnchor(m.id, level); return anchor ? <RoomFixture key={m.id} engine={gameplay?.engine} id={`action:${m.id}`} position={anchor} kind="open" run={() => onToggle(m.id)} /> : null;
      })}
      <Mirror position={L.mirror} look={data.mirrorDailyLook} overlay={mirror} theme={deco("tema_espelho")?.theme ?? null} onVistaMe={onVistaMe} reduced={reduced} module={byId["mirror"]} engine={gameplay?.engine} live={!!gameplay} glass={view ? view.mirror : undefined} />
      <DressForm position={L.bust} pointAt={pointAt} talking={!!copilotTalking} onClick={() => onCopilot?.()} reduced={reduced} />
      <SaleRack position={L.sale} rack={{ name: data.saleRack?.name ?? t("room.support_rack"), pieces: [...new Map([...(data.saleRack?.pieces ?? []), ...(data.chair ?? []), ...(data.basket ?? [])].map(p => [p.id, p])).values()] }} ctx={ctx} modelUrl={byId["saleRack"]?.finish?.model3dUrl ?? "/models/fai-room/rack-fai.glb"} />
      <RoomFixture engine={gameplay?.engine} id="chair" position={L.chair} collider={[.32, .32]} kind="sit" run={() => { if (gameplay) { const e = gameplay.engine; e.seated = e.seated ? null : seatOf(L.chair); e.seatYaw = CHAIR.yaw; e.notify(); } }}>
        <Chair position={[0, 0, 0]} pieces={[]} ctx={ctx} />
      </RoomFixture>
      <DoubleBed engine={gameplay?.engine} modelUrl={byId["bed"]?.finish?.model3dUrl ?? "/models/fai-room/bed-fai.glb"} lit={ceilingOn} intensity={brightness} />


      {/* Compras aguardam abrir o inventário; roupas e looks nunca viram caixas no cenário. */}


      <ContactShadows position={[0, 0.005, 0.4]} opacity={0.35} scale={10} blur={2.4} far={3} />
      {gameplay && <RoomAvatarController gameplay={gameplay} closetRight={W / 2} />}
      {gameplay && <LoosePieces engine={gameplay.engine} pieces={data.pieces} ctx={ctx} drop={drop} />}
      {!gameplay && <OrbitControls ref={controls as never} makeDefault enabled={!preset} enablePan={false} target={[0, 1.2, 0]}
        minPolarAngle={deg(po[0])} maxPolarAngle={deg(po[1])} minDistance={homeDist / zoom[1]} maxDistance={homeDist / zoom[0]} enableDamping dampingFactor={0.08} />}
      {!gameplay && !preset && <CameraRig focus={focus} facing={facing} home={[0, 1.2, 0]} homeDist={homeDist} controls={controls} />}
      {!gameplay && !preset && <OrbitTurn controls={controls} reduced={reduced} speed={camOpts.speed} invertX={camOpts.invertX} invertY={camOpts.invertY} />}
      {preset && <PresetCamera options={preset} mirror={L.mirror} door={L.door} onViewStep={onViewStep} />}
      <ResponsiveFov fov={camOpts.fov} />
    </Canvas>
  );
}
