"use client";
/*
 * MET Gala Heist v2 — o interior do Museu Vesper na noite da Gala Lumière: vestíbulo do credenciamento, Grande Salão com
 * a instalação floral e a colunata, Instituto do Traje (corredor de museu com piso espelhado e vitrines iluminadas),
 * lounge e bar azul-petróleo com arcos dourados, bastidores, labirinto de serviço em luz fria, sala de segurança, doca,
 * Sala das Joias e o terraço-jardim. Dono: o "Agente Salas" (ver scratchpad/gala/PLANO.md).
 *
 * A montagem (interior-build) acontece uma vez por qualidade e idioma; a cada quadro (interior-fx) só se escondem as
 * salas que a câmera não vê, giram as folhas das portas conforme `view.current.doors`, as luzes dinâmicas acompanham a
 * câmera, o alarme acende os giroflex, a Visão desenha os contornos e os pisos polidos refletem a cena ("high").
 * Luzes internas não fazem sombra (a lua do céu faz); a luz difusa vem do ambiente de cada sala.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { RoomId } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import { sceneLocale } from "./interior-copy";
import { beaconDomes, buildInterior, disposeInterior, prepareInterior, type InteriorBuild } from "./interior-build";
import { KeyLight, LightPool, applyRoomEnv, captureProbes, flickerOf, roomsInView, updateAnimated, updateBeacons, updateDoors, updateHalos, updateVision } from "./interior-fx";
import type { LightAnchor } from "./interior-props";
import { roomAtPoint } from "./interior-shell";
import type { Quality } from "./interior-tex";

export type { InteriorBuild };

/** Multiplicador de cada âncora agora: chama/fluorescente, Sala das Joias na penumbra sem energia, giroflex no alarme. */
function gainOf(a: LightAnchor, v: SceneView, t: number): number {
  if (a.alarm) { if (!v.alarm) return 0; const s = Math.max(0, Math.sin(t * 5.2 + a.x)); return 0.15 + s * s; }
  let g = flickerOf(a, t);
  if (a.room === "cofre" && !v.lasersPowered) g *= 0.12;
  if (v.alarm) g *= 0.85;
  return g;
}

export function HeistInterior({ view, quality }: { view: React.MutableRefObject<SceneView>; quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const locale = useMemo(() => sceneLocale(), []);
  const b = useMemo(() => {
    const out = buildInterior(quality, locale);
    // o giroflex de cada sala também é uma luz (vermelha, pulsando) quando o alarme toca
    for (const bc of out.beacons.spins) out.anchors.push({ x: bc.pivot.position.x, y: bc.pivot.position.y, z: bc.pivot.position.z, color: "#ff2020", intensity: 9, distance: 8, room: bc.room, alarm: true });
    return out;
  }, [quality, locale]);
  const prep = useMemo(() => prepareInterior(b, gl), [b, gl]);
  const pool = useMemo(() => new LightPool(quality === "high" ? 10 : 5), [quality]);
  // a única luz interna com sombra (pessoas, colunas e mesas assentam no piso); só no "high"
  const key = useMemo(() => (quality === "high" ? new KeyLight(1024) : null), [quality]);
  useEffect(() => () => { disposeInterior(b); }, [b]);
  useEffect(() => () => { prep.mirror?.dispose(); }, [prep]);
  const st = useRef({ seen: new Set<RoomId>(), lit: new Set<RoomId>(), core: new Set<RoomId>(), focus: new THREE.Vector3(), first: true, frames: 0, probed: false });
  // "low": compila todos os materiais já na montagem (no "high" as sondas fazem isso ao fotografar cada sala)
  const camera = useThree((s) => s.camera), scene = useThree((s) => s.scene);
  useEffect(() => { if (quality === "low") gl.compileAsync(b.root, camera, scene).catch(() => undefined); }, [b, gl, camera, scene, quality]);
  const hide = useMemo(() => [...b.shadows, b.vision.group], [b]);
  useFrame((state, dt) => {
    const v = view.current, t = state.clock.elapsedTime, cam = state.camera, s = st.current;
    // 3º quadro (cena montada e acesa): a sonda de reflexo de cada sala (só "high", uma vez)
    let snap = s.first;
    if (quality === "high" && !s.probed && ++s.frames >= 3) {
      s.probed = true; snap = true;
      prep.mirror?.off();
      const ki = key ? key.light.intensity : 0; if (key) key.light.intensity = 0;
      const probes = captureProbes(state.gl, state.scene, b.root, b.rooms, pool, b.anchors, key ? [pool.group, key.light, key.light.target] : [pool.group]);
      for (const [room, g] of b.rooms) applyRoomEnv(g, room, state.gl, probes.get(room));
      for (const l of b.doors.leaves) applyRoomEnv(l.pivot, l.room, state.gl, probes.get(l.room));
      prep.domes.splice(0, prep.domes.length, ...beaconDomes(b));
      if (key) key.light.intensity = ki;
    }
    roomsInView(v, roomAtPoint(cam.position.x, cam.position.z), s.seen, s.lit, s.core);
    for (const [room, g] of b.rooms) g.visible = s.seen.has(room);
    for (const [o, [a, c]] of b.doorRooms) o.visible = s.seen.has(a) || s.seen.has(c);
    updateDoors(b.doors, v.doors, dt, s.first);
    // as luzes seguem um ponto entre a câmera e a jogadora (o que aparece na tela e o que está em volta dela)
    s.focus.set(cam.position.x * 0.6 + v.player.x * 0.4, cam.position.y * 0.6 + (v.player.y + 1.4) * 0.4, cam.position.z * 0.6 + v.player.z * 0.4);
    if (Math.hypot(cam.position.x - v.player.x, cam.position.z - v.player.z) > 12) s.focus.copy(cam.position);
    pool.update(b.anchors, s.lit, s.core, s.focus, dt, (a) => gainOf(a, v, t), snap);
    key?.update(v.playerRoom, v.player.x, v.player.z, dt, (v.playerRoom === "cofre" && !v.lasersPowered ? 0.12 : 1) * (v.alarm ? 0.85 : 1));
    updateBeacons(b.beacons, prep.domes, v, s.seen, t);
    updateVision(b.vision, v, t, dt);
    updateHalos(b.halos, t);
    updateAnimated(b.animated, v, t);
    for (const c of b.cones) if (c.room === "cofre") c.mesh.visible = v.lasersPowered;
    prep.mirror?.update(state.gl, state.scene, cam, hide);
    s.first = false;
  });
  return (
    <>
      <primitive object={b.root} />
      <primitive object={pool.group} />
      {key && <><primitive object={key.light} /><primitive object={key.light.target} /></>}
    </>
  );
}
