"use client";
/*
 * MET Gala Heist v2 — o laço do jogo dentro do Canvas (game.tsx): a cada quadro, entrada → mira (e assistência) → passo
 * da simulação → vista da cena → eventos → sons de passos, ouvinte e batimento → HUD a 15 Hz → contador de quadros.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SimState } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import type { SimCtx } from "@/lib/heist/state";
import { interact, skipBeat, skipCutscene, step, writeView, type OpenUi } from "@/lib/heist/sim";
import { castShot, tiredness } from "@/lib/heist/combat";
import { floorY } from "@/lib/heist/level";
import { angDiff, yawOf } from "@/lib/heist/math";
import { floorKind } from "@/lib/heist/world";
import type { HeistControls } from "./input";
import type { HeistAudio } from "./audio";
import type { HudState } from "./hud";
import { hudOf } from "./hud-state";
import type { HeistSettings } from "./settings";

/** Laço dentro do Canvas: entrada → mira (e assistência) → passo → vista → eventos → HUD. */
export function Driver({ sim, ctx, view, controls, audio, settings, running, slowMo, onEvents, onUi, onHud, onFps, doneAt }: {
  sim: React.MutableRefObject<{ s: SimState }>; ctx: SimCtx; view: React.MutableRefObject<SceneView>; controls: HeistControls; audio: HeistAudio; settings: HeistSettings;
  running: boolean; slowMo: boolean; onEvents: (s: SimState) => void; onUi: (ui: OpenUi) => void; onHud: (h: HudState) => void; onFps: (n: number) => void;
  doneAt: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const hudAt = useRef(0), fps = useRef({ n: 0, t: 0 });
  const steps = useRef({ player: 0, guards: new Map<string, number>() });
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const s = sim.current.s, dt = Math.min(0.05, rawDt);
    const ended = s.phase === "LOST" || s.phase === "WON";
    camera.getWorldDirection(dir);
    const cyaw = Math.atan2(dir.x, dir.z), cpitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    if (!running && !ended) { writeView(s, view.current); return; }
    const inp = controls.frame(dt);
    const cinema = !!s.beat || s.phase === "CUTSCENE";
    if (!running || ended || cinema) {
      if (cinema && inp.interactPress) { if (s.beat) skipBeat(s); else skipCutscene(s); }
      inp.move = { x: 0, y: 0 }; inp.interactPress = inp.firePress = inp.fire = inp.meleePress = inp.healPress = inp.throwPress = inp.reloadPress = inp.dodgePress = false;
    }
    // assistência de mira: com a mira aberta, puxa de leve para o segurança mais perto da cruz (até ~4°)
    if (settings.aimAssist && s.player.aiming) {
      let best: { dy: number; dp: number } | null = null;
      for (const g of s.guards) {
        if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
        const dx = g.pos.x - camera.position.x, dz = g.pos.z - camera.position.z, d = Math.hypot(dx, dz);
        if (d > 30) continue;
        const dy = angDiff(cyaw, Math.atan2(dx, dz)), dp = Math.atan2(floorY(g.pos) + 1.25 - camera.position.y, d) - cpitch;
        if (Math.abs(dy) < 0.07 && Math.abs(dp) < 0.08 && (!best || Math.abs(dy) < Math.abs(best.dy))) best = { dy, dp };
      }
      if (best) { const k = Math.min(1, dt * 5); controls.yaw += best.dy * k; controls.pitch += best.dp * k * 0.6; }
    }
    // mira: o ponto sob a cruz (raio da câmera) e a direção da arma até ele
    if (s.player.aiming || inp.firePress) {
      const hit = castShot(s, ctx, { x: camera.position.x, z: camera.position.z }, camera.position.y, cyaw, cpitch, 60);
      const p = s.player, oy = p.y + (p.crouch ? 1.05 : 1.45);
      inp.aimYaw = yawOf({ x: hit.point.x - p.pos.x, z: hit.point.z - p.pos.z });
      inp.aimPitch = Math.atan2(hit.point.y - oy, Math.hypot(hit.point.x - p.pos.x, hit.point.z - p.pos.z));
    }
    if (inp.interactPress && !cinema) onUi(interact(s, ctx));
    step(s, ctx, inp, slowMo ? dt * 0.15 : dt);
    writeView(s, view.current);
    onEvents(s);
    audio.setListener(camera.position.x, camera.position.z, cyaw);
    audio.heartbeat(s.time, tiredness(s));
    // passos: os dela no ritmo da passada; os dos seguranças a até 12 m, do lado de onde vêm, no timbre do piso
    // (MH-15-04, MH-15-07); atrás de parede, abafados (audio.occluded)
    const p = s.player, st = steps.current;
    if (p.speed > 0.6 && p.mode === "WALK" && !p.hidden) {
      st.player += dt * (p.speed > 3 ? 3.2 : p.speed > 1.5 ? 2.1 : 1.6);
      if (st.player >= 1) { st.player = 0; audio.step(p.shoes === "heels" ? "heels" : "soft", p.discreet || p.crouch ? 0.35 : p.speed > 3 ? 1 : 0.6, undefined, floorKind(p.pos)); }
    }
    for (const g of s.guards) {
      if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
      const v = Math.hypot(g.vel.x, g.vel.z), d = Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z);
      if (v < 0.5 || d > 12) continue;
      const t0 = (st.guards.get(g.id) ?? 0) + dt * (v > 3 ? 3 : 1.8);
      if (t0 >= 1) { st.guards.set(g.id, 0); audio.step(g.role === "heavy" || g.role === "police" ? "boots" : "soft", Math.max(0.25, 1 - d / 12), g.pos, floorKind(g.pos)); } else st.guards.set(g.id, t0);
    }
    hudAt.current += dt;
    if (hudAt.current > 1 / 15) {
      hudAt.current = 0;
      const h = hudOf(s, camera, cyaw, doneAt.current);
      audio.setRoom(s.player.lastRoom);
      audio.setIntensity(s.alarm || s.phase === "ESCAPE" ? 2 : h.exposureAlert ? 1 : 0, h.exposure);
      onHud(h);
    }
    if (settings.showFps) { fps.current.n++; fps.current.t += rawDt; if (fps.current.t >= 1) { onFps(Math.round(fps.current.n / fps.current.t)); fps.current = { n: 0, t: 0 }; } }
  });
  return null;
}
