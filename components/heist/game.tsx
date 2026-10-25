"use client";
/*
 * MET Gala Heist v2 — o jogo: simulação a 60 Hz no cliente (lib/heist/sim.ts), cena 3D (rua, salas, pessoas, efeitos),
 * câmera sobre o ombro, controles (teclado/mouse e controle de PS5), HUD, roda de itens, revendedor, deck, puzzles,
 * pausa, game over e vitória. Checkpoints guardados na memória ao entrar em cada sala nova e no começo da fuga.
 */
import "./heist.css";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useI18n } from "@/lib/i18n/i18n";
import type { HeistCard, SimState, VendorId, WeaponId } from "@/lib/heist/types";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { newSim, outfitPieces, restore, simCtx, snapshot, type SimCtx } from "@/lib/heist/state";
import { equip, interact, promptAt, quickHeal, skipCutscene, step, writeView, type OpenUi } from "@/lib/heist/sim";
import { castShot, magSize, tiredness } from "@/lib/heist/combat";
import { GUARDS } from "@/lib/heist/level";
import { angDiff, yawOf } from "@/lib/heist/math";
import { useReducedMotion } from "@/components/three/common";
import { HeistControls, DEFAULT_SETTINGS, type ControlSettings } from "./input";
import { HeistAudio } from "./audio";
import { HeistCamera } from "./camera";
import { HeistFx } from "./fx";
import { Hud, type Detect, type HudState, type Line } from "./hud";
import { ItemWheel, slotAt, type WheelInfo, type WheelSlot } from "./wheel";
import { VendorPanel } from "./vendor";
import { DeckPanel } from "./cards-ui";
import { CluePanel, PuzzlePanel } from "./puzzles";
import { Briefing, GameOver, PauseMenu, Victory } from "./screens";
import { SceneRoot } from "./scene-root";

type Panel = { kind: "vendor"; vendor: VendorId } | { kind: "puzzle" } | { kind: "clue"; ref: string } | { kind: "deck" } | { kind: "wheel" } | null;
type Stage = "brief" | "play" | "pause" | "over" | "won";
const GUARD_NAMES = Object.fromEntries(GUARDS.map((g) => [g.id, g.callsign]));

function hudOf(s: SimState, controls: HeistControls, camYaw: number): HudState {
  const p = s.player;
  const detect: Detect[] = [];
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    if (g.suspicion < 0.04 && g.state !== "ALERT") continue;
    const d = { x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z };
    if (Math.hypot(d.x, d.z) > 26) continue;
    detect.push({ id: g.id, angle: angDiff(camYaw, yawOf(d)) * -1, level: g.state === "ALERT" ? 1 : Math.min(1, g.suspicion), alert: g.state === "ALERT" });
  }
  return {
    hp: p.hp, maxHp: p.maxHp, armor: p.armor, tired: tiredness(s), lastHitAt: p.lastHitAt, time: s.time,
    weapon: p.weapon, mag: p.inv.mag, magSize: magSize(p.weapon), ammo: p.inv.ammo, reloading: !!p.reloadUntil, aiming: p.aiming,
    medkit: p.inv.medkit, medkitXL: p.inv.medkitXL, bandages: s.cards.filter((c) => c.use === "BANDAGE" && s.cardState[c.id] === "DECK").length, bottles: p.inv.bottles,
    disguise: p.disguise, shoes: p.shoes, hood: p.hood, vision: Math.max(0, p.visionUntil - s.time), slow: Math.max(0, p.slowUntil - s.time),
    objective: s.objective, room: p.lastRoom, phase: s.phase, alarm: s.alarm, prompt: promptAt(s), detect,
    keys: p.inv.keys, keycard: p.inv.keycard, invite: p.inv.invite, diamond: p.inv.diamond,
  };
  void controls;
}

/** Laço dentro do Canvas: entrada → mira → passo → vista → eventos. */
function Driver({ sim, ctx, view, controls, audio, running, slowMo, onEvents, onUi, onHud }: {
  sim: React.MutableRefObject<{ s: SimState }>; ctx: SimCtx; view: React.MutableRefObject<SceneView>; controls: HeistControls; audio: HeistAudio;
  running: boolean; slowMo: boolean; onEvents: (s: SimState) => void; onUi: (ui: OpenUi) => void; onHud: (h: HudState) => void;
}) {
  const { camera } = useThree();
  const hudAt = useRef(0);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const s = sim.current.s, dt = Math.min(0.05, rawDt);
    const ended = s.phase === "LOST" || s.phase === "WON";
    if (!running && !ended) { writeView(s, view.current); return; }
    const inp = controls.frame(dt);
    if (!running || ended) { inp.move = { x: 0, y: 0 }; inp.interactPress = inp.firePress = inp.fire = inp.meleePress = inp.healPress = inp.throwPress = inp.reloadPress = false; }
    // mira: o ponto sob a cruz (raio da câmera) e a direção da arma até ele
    camera.getWorldDirection(dir);
    const cyaw = Math.atan2(dir.x, dir.z), cpitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    if (s.player.aiming || inp.firePress) {
      const hit = castShot(s, ctx, { x: camera.position.x, z: camera.position.z }, camera.position.y, cyaw, cpitch, 60);
      const p = s.player, oy = p.y + (p.crouch ? 1.05 : 1.45);
      inp.aimYaw = yawOf({ x: hit.point.x - p.pos.x, z: hit.point.z - p.pos.z });
      inp.aimPitch = Math.atan2(hit.point.y - oy, Math.hypot(hit.point.x - p.pos.x, hit.point.z - p.pos.z));
    }
    if (inp.interactPress && s.phase !== "CUTSCENE") onUi(interact(s, ctx));
    if (inp.interactPress && s.phase === "CUTSCENE") skipCutscene(s);
    step(s, ctx, inp, slowMo ? dt * 0.15 : dt);
    writeView(s, view.current);
    onEvents(s);
    audio.heartbeat(s.time, tiredness(s));
    hudAt.current += dt;
    if (hudAt.current > 1 / 15) { hudAt.current = 0; onHud(hudOf(s, controls, cyaw)); }
  });
  return null;
}

export interface HeistGameProps { cards: HeistCard[]; onExit?: () => void; debug?: boolean; quality?: "high" | "low"; startAt?: string }

export function HeistGame({ cards, onExit, debug = false, quality: q0, startAt }: HeistGameProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const ctx = useMemo(() => simCtx(), []);
  const sim = useRef<{ s: SimState }>({ s: newSim(cards) });
  const view = useRef<SceneView>(emptyView());
  const controls = useMemo(() => new HeistControls(), []);
  const audio = useMemo(() => new HeistAudio(), []);
  const checkpoints = useRef<Record<string, SimState>>({ start: snapshot(sim.current.s) });
  const lastCheckpoint = useRef("start");
  const wrap = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("brief");
  const [panel, setPanel] = useState<Panel>(null);
  const [hud, setHud] = useState<HudState>(() => hudOf(sim.current.s, controls, 0));
  const [pieces, setPieces] = useState(() => outfitPieces(sim.current.s));
  const [lines, setLines] = useState<Line[]>([]);
  const [toasts, setToasts] = useState<Line[]>([]);
  const [, setRev] = useState(0);
  const [quality, setQuality] = useState<"high" | "low">(q0 ?? "high");
  const [loading, setLoading] = useState(debug ? 1 : 0);
  const [settings, setSettings] = useState<ControlSettings>(DEFAULT_SETTINGS);
  const [volume, setVolume] = useState(0.7);
  const [wheelHover, setWheelHover] = useState<WheelSlot | null>(null);
  const seq = useRef(1);
  const bump = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => { controls.settings = settings; }, [controls, settings]);
  useEffect(() => { audio.setVolume(volume); }, [audio, volume]);
  useEffect(() => { const el = wrap.current; if (!el) return; controls.attach(el); return () => { controls.detach(); audio.stop(); }; }, [controls, audio]);
  // laboratório: começar num checkpoint (?at=salao, cofre…)
  useEffect(() => {
    if (!startAt) return;
    const s = sim.current.s;
    const cp = { salao: { x: 0, z: 12.6 }, servico: { x: -19.2, z: 15.2 }, cofre: { x: -14, z: -15 }, vestibulo: { x: 0, z: 22.6 }, terraco: { x: 20.6, z: -14 } }[startAt];
    if (cp) { s.player.pos = { ...cp }; s.player.y = 0; s.player.inv.wristband = true; }
  }, [startAt]);

  const running = stage === "play" && (!panel || panel.kind === "wheel");
  // a roda aberta: o tempo quase para; o mouse escolhe
  useEffect(() => { controls.wheelMode = panel?.kind === "wheel"; controls.wheelVec = { x: 0, y: 0 }; }, [controls, panel]);

  const onEvents = useCallback((s: SimState) => {
    if (!s.events.length) return;
    const now = performance.now();
    for (const e of s.events) {
      switch (e.t) {
        case "line": setLines((l) => [...l.slice(-2), { id: seq.current++, who: e.who, key: e.key, vars: e.vars, at: now }]); break;
        case "toast": setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: e.key, vars: e.vars, at: now }]); break;
        case "sfx": audio.play(e.id); break;
        case "shot": audio.play(e.by === "player" ? (e.silenced ? "silenced" : "shot") : Math.hypot(e.from.x - s.player.pos.x, e.from.z - s.player.pos.z) > 14 ? "shotFar" : "shot", e.by === "player" ? 1 : 0.8); break;
        case "hit": audio.play(e.on === "player" ? "hurt" : "hit"); break;
        case "down": audio.play("down"); break;
        case "outfit": setPieces(outfitPieces(s)); break;
        case "alarm": audio.alarm(e.on); break;
        case "rumble": controls.rumble(e.strong, e.weak, e.ms); break;
        case "puzzle": if (e.result === "solved") audio.play("solved"); if (e.result === "mistake") audio.play("mistake"); break;
        case "checkpoint": if (e.reason !== "restore") { checkpoints.current[e.reason] = snapshot(s); lastCheckpoint.current = e.reason; } break;
        case "phase":
          if (e.phase === "LOST") setTimeout(() => setStage("over"), 1800);
          if (e.phase === "WON") setTimeout(() => setStage("won"), 2200);
          if (e.phase === "LOST" || e.phase === "WON") controls.unlock();
          break;
      }
    }
    s.events.length = 0;
  }, [audio, controls]);

  // falas e avisos somem sozinhos
  useEffect(() => {
    const id = setInterval(() => { const now = performance.now(); setLines((l) => l.filter((x) => now - x.at < 4200)); setToasts((l) => l.filter((x) => now - x.at < 3200)); }, 400);
    return () => clearInterval(id);
  }, []);

  const onUi = useCallback((ui: OpenUi) => {
    if (!ui) return;
    controls.unlock(); controls.reset();
    if (ui.ui === "vendor") setPanel({ kind: "vendor", vendor: ui.vendor });
    if (ui.ui === "puzzle") setPanel({ kind: "puzzle" });
    if (ui.ui === "clue") setPanel({ kind: "clue", ref: ui.ref });
  }, [controls]);
  const closePanel = useCallback((relock = true) => { setPanel(null); controls.reset(); if (relock) controls.lock(); bump(); }, [controls, bump]);

  // bordas de interface (roda, pausa, armas, pular cena) lidas a cada quadro de React
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      for (const e of controls.takeEdges()) {
        const s = sim.current.s;
        if (e === "pause") {
          if (panel && panel.kind !== "wheel") { if (panel.kind === "puzzle") s.puzzle = null; closePanel(false); }
          else if (stage === "play") { setStage("pause"); controls.unlock(); }
          else if (stage === "pause") { setStage("play"); }
        }
        if (stage !== "play") continue;
        if (e === "wheel-open" && !panel && s.phase !== "CUTSCENE") { setPanel({ kind: "wheel" }); setWheelHover(null); }
        if (e === "wheel-close" && panel?.kind === "wheel") pickWheel(wheelRef.current);
        if (e === "skip") skipCutscene(s);
        const order: WeaponId[] = ["hands", "knife", ...(["pistolS", "pistol", "guardPistol"] as WeaponId[]).filter((w) => s.player.inv.weapons.includes(w))];
        const have = order.filter((w) => s.player.inv.weapons.includes(w));
        if (e === "weapon-1") equip(s, "hands");
        if (e === "weapon-2") equip(s, "knife");
        if (e === "weapon-3") { const g = have.find((w) => w !== "hands" && w !== "knife"); if (g) equip(s, g); }
        if (e === "weapon-next" || e === "weapon-prev") { const i = have.indexOf(s.player.weapon); equip(s, have[(i + (e === "weapon-next" ? 1 : have.length - 1)) % have.length]); }
      }
      if (panel?.kind === "wheel") {
        const d = controls.wheelDirection(controls.wheelVec.x, controls.wheelVec.y);
        const slot = d === null ? null : slotAt(d);
        if (slot !== wheelRef.current) { wheelRef.current = slot; setWheelHover(slot); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  const wheelRef = useRef<WheelSlot | null>(null);

  function pickWheel(slot: WheelSlot | null) {
    const s = sim.current.s; wheelRef.current = null;
    setPanel(null);
    if (!slot) return;
    const p = s.player;
    if (slot === "hands") equip(s, "hands");
    if (slot === "knife") equip(s, "knife");
    if (slot === "pistol") { const g = (["pistolS", "pistol", "guardPistol"] as WeaponId[]).find((w) => p.inv.weapons.includes(w)); if (g) equip(s, g); }
    if (slot === "heal") quickHeal(s);
    if (slot === "reload") { s.player.reloadUntil = 0; const want = { ...controls.frame(0), reloadPress: true }; step(s, ctx, want, 0); }
    if (slot === "bottle") { const want = { ...controls.frame(0), throwPress: true, camYaw: controls.yaw }; step(s, ctx, want, 0); }
    if (slot === "cards" || slot === "outfit") { controls.unlock(); setPanel({ kind: "deck" }); }
    bump();
  }

  const wheelInfo: WheelInfo = useMemo(() => {
    const p = sim.current.s.player, s = sim.current.s;
    const gun = p.inv.weapons.some((w) => w === "pistol" || w === "pistolS" || w === "guardPistol");
    return {
      has: { hands: true, knife: p.inv.weapons.includes("knife"), pistol: gun, heal: p.inv.medkit + p.inv.medkitXL + hud.bandages > 0, bottle: p.inv.bottles > 0, reload: gun && p.inv.ammo > 0, cards: s.cards.length > 0, outfit: true },
      count: { heal: String(p.inv.medkit + p.inv.medkitXL + hud.bandages), bottle: String(p.inv.bottles), pistol: gun ? `${p.inv.mag}/${p.inv.ammo}` : undefined, cards: String(s.cards.filter((c) => s.cardState[c.id] === "DECK").length) },
      current: p.weapon === "hands" ? "hands" : p.weapon === "knife" ? "knife" : "pistol",
    };
  }, [hud]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { audio.start(); setStage("play"); controls.lock(); };
  const fromCheckpoint = () => {
    const snap = checkpoints.current[lastCheckpoint.current] ?? checkpoints.current.start;
    sim.current.s = restore(snap); setPieces(outfitPieces(sim.current.s)); audio.alarm(sim.current.s.alarm);
    setPanel(null); setStage("play"); controls.lock(); bump();
  };
  const restart = () => {
    sim.current.s = newSim(cards); checkpoints.current = { start: snapshot(sim.current.s) }; lastCheckpoint.current = "start";
    setPieces(outfitPieces(sim.current.s)); audio.alarm(false); setPanel(null); setStage("play"); controls.lock(); bump();
  };
  const names = useCallback((who: string) => {
    if (who === "player") return t("heist.who.player");
    if (who === "hostess") return t("heist.who.hostess");
    if (GUARD_NAMES[who]) return t("heist.who.guard", { name: GUARD_NAMES[who] });
    const c = sim.current.s.civs.find((x) => x.id === who);
    return c ? t(`heist.who.${c.role}`) : who;
  }, [t]);

  const s = sim.current.s;
  const blurred = stage === "over" || stage === "pause" || stage === "won" || stage === "brief";
  return <div ref={wrap} className={`hz-game ${blurred ? "is-dimmed" : ""} ${stage === "over" ? "is-over" : ""}`} data-stage={stage}>
    <Canvas shadows={quality === "high"} dpr={quality === "high" ? [1, 1.75] : [0.7, 1]} gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.05, far: 500, position: [-18, 0.5, 52] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Driver sim={sim} ctx={ctx} view={view} controls={controls} audio={audio} running={running} slowMo={panel?.kind === "wheel"} onEvents={onEvents} onUi={onUi} onHud={setHud} />
      <HeistCamera view={view} sim={sim} world={ctx.world} controls={controls} reducedMotion={reduced} />
      <Suspense fallback={null}>
        <SceneRoot world={ctx.world} view={view} pieces={pieces} quality={quality} debug={debug} onProgress={setLoading} />
      </Suspense>
      <HeistFx view={view} />
    </Canvas>
    {stage === "play" && <Hud h={hud} pad={controls.usingPad} lines={lines} toasts={toasts} names={names} />}
    {stage === "play" && !controls.locked && !panel && !controls.usingPad && <p className="hz-clickhint">{t("heist.hud.clickToPlay")}</p>}
    {panel?.kind === "wheel" && <ItemWheel info={wheelInfo} hover={wheelHover} onPick={(sl) => pickWheel(sl)} />}
    {panel?.kind === "vendor" && <VendorPanel s={s} vendor={panel.vendor} onChange={bump} onClose={() => closePanel()} />}
    {panel?.kind === "deck" && <DeckPanel s={s} onChange={(close) => { bump(); if (close) closePanel(); }} onClose={() => closePanel()} />}
    {panel?.kind === "puzzle" && s.puzzle && <PuzzlePanel s={s} onChange={bump} onClose={() => closePanel()} />}
    {panel?.kind === "clue" && <CluePanel clue={panel.ref} onClose={() => closePanel()} />}
    {stage === "brief" && <Briefing cards={s.cards} onStart={start} onExit={onExit} loading={loading} pad={controls.usingPad} />}
    {stage === "pause" && <PauseMenu settings={settings} onSettings={setSettings} quality={quality} onQuality={setQuality} volume={volume} onVolume={setVolume} pad={controls.usingPad}
      onResume={() => { setStage("play"); controls.lock(); }} onCheckpoint={fromCheckpoint} onRestart={restart} onExit={onExit} checkpoint={lastCheckpoint.current} />}
    {stage === "over" && <GameOver stats={s.stats} checkpoint={lastCheckpoint.current} onCheckpoint={fromCheckpoint} onRestart={restart} onExit={onExit} />}
    {stage === "won" && <Victory stats={s.stats} onRestart={restart} onExit={onExit} />}
  </div>;
}
