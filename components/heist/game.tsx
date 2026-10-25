"use client";
/*
 * MET Gala Heist v2 — o jogo: simulação a 60 Hz no cliente (lib/heist/sim.ts), cena 3D (rua, salas, pessoas, efeitos),
 * câmera sobre o ombro (e os enquadramentos das cenas curtas), controles remapeáveis (teclado/mouse e controle de PS5),
 * HUD, roda de itens, revendedor, deck, puzzles, conversas, mapa, pausa, game over e vitória. Checkpoints ao entrar em
 * cada sala nova e no começo da fuga, guardados também neste navegador (continuar depois). Preferências salvas aqui.
 */
import "./heist.css";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useI18n } from "@/lib/i18n/i18n";
import type { HeistCard, SimState, VendorId, WeaponId } from "@/lib/heist/types";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { SIM_VERSION, newSim, outfitPieces, restore, simCtx, snapshot, type SimCtx } from "@/lib/heist/state";
import { choose, endTalk, equip, interact, quickHeal, skipBeat, skipCutscene, startBeat, startCutscene, step, writeView, type OpenUi } from "@/lib/heist/sim";
import { castShot, damagePlayer, tiredness } from "@/lib/heist/combat";
import { GUARDS, floorY } from "@/lib/heist/level";
import { angDiff, yawOf } from "@/lib/heist/math";
import { useReducedMotion } from "@/components/three/common";
import { HeistControls } from "./input";
import { HeistAudio } from "./audio";
import { HeistCamera } from "./camera";
import { HeistFx } from "./fx";
import { Hud, type HudState, type Line } from "./hud";
import { hudOf } from "./hud-state";
import { ItemWheel, slotAt, type WheelInfo, type WheelSlot } from "./wheel";
import { VendorPanel } from "./vendor";
import { DeckPanel } from "./cards-ui";
import { CluePanel, PuzzlePanel } from "./puzzles";
import { DialoguePanel } from "./dialogue-ui";
import { MapPanel } from "./map-ui";
import { Briefing, GameOver, PauseMenu, Victory, type StartOptions } from "./screens";
import { SceneRoot } from "./scene-root";
import { bindLabel, clearSave, loadSave, loadSettings, saveSettings, writeSave, type HeistSettings, type SavedRun } from "./settings";

type Panel = { kind: "vendor"; vendor: VendorId } | { kind: "puzzle" } | { kind: "clue"; ref: string } | { kind: "deck" } | { kind: "wheel" } | { kind: "dialogue" } | { kind: "map" } | null;
type Stage = "brief" | "play" | "pause" | "over" | "won";
const GUARD_NAMES = Object.fromEntries(GUARDS.map((g) => [g.id, g.callsign]));
const deckKey = (cards: HeistCard[]) => cards.map((c) => c.id).sort().join(",");

/** Laço dentro do Canvas: entrada → mira (e assistência) → passo → vista → eventos → HUD. */
function Driver({ sim, ctx, view, controls, audio, settings, running, slowMo, onEvents, onUi, onHud, onFps, doneAt }: {
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
    // passos: os dela no ritmo da passada; os dos seguranças a até 12 m, do lado de onde vêm (MH-15-04, MH-15-07)
    const p = s.player, st = steps.current;
    if (p.speed > 0.6 && p.mode === "WALK" && !p.hidden) {
      st.player += dt * (p.speed > 3 ? 3.2 : p.speed > 1.5 ? 2.1 : 1.6);
      if (st.player >= 1) { st.player = 0; audio.step(p.shoes === "heels" ? "heels" : "soft", p.discreet || p.crouch ? 0.35 : p.speed > 3 ? 1 : 0.6); }
    }
    for (const g of s.guards) {
      if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
      const v = Math.hypot(g.vel.x, g.vel.z), d = Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z);
      if (v < 0.5 || d > 12) continue;
      const t0 = (st.guards.get(g.id) ?? 0) + dt * (v > 3 ? 3 : 1.8);
      if (t0 >= 1) { st.guards.set(g.id, 0); audio.step(g.role === "heavy" || g.role === "police" ? "boots" : "soft", Math.max(0.25, 1 - d / 12), g.pos); } else st.guards.set(g.id, t0);
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

export interface HeistGameProps {
  cards: HeistCard[]; onExit?: () => void; debug?: boolean; quality?: "high" | "low"; startAt?: string;
  /** laboratório: expõe a simulação em `window.__heist` (testes de jogo e capturas automáticas) */
  labHandle?: boolean;
}

export function HeistGame({ cards, onExit, debug = false, quality: q0, startAt, labHandle = false }: HeistGameProps) {
  const { t, locale } = useI18n();
  const reduced = useReducedMotion();
  const ctx = useMemo(() => simCtx(), []);
  const [settings, setSettingsState] = useState<HeistSettings>(() => { const st = loadSettings(); return q0 ? { ...st, quality: q0 } : st; });
  const sim = useRef<{ s: SimState }>({ s: newSim(cards, 20261025, { beats: settings.beats, slowLasers: settings.slowLasers, regen: settings.regen }) });
  const view = useRef<SceneView>(emptyView());
  const controls = useMemo(() => new HeistControls(), []);
  const audio = useMemo(() => new HeistAudio(), []);
  const checkpoints = useRef<Record<string, SimState>>({ start: snapshot(sim.current.s) });
  const lastCheckpoint = useRef("start");
  const doneAt = useRef(-99);
  const wrap = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("brief");
  const [panel, setPanel] = useState<Panel>(null);
  const [hud, setHud] = useState<HudState>(() => hudOf(sim.current.s, null, Math.PI, -99));
  const [pieces, setPieces] = useState(() => outfitPieces(sim.current.s));
  const [lines, setLines] = useState<Line[]>([]);
  const [toasts, setToasts] = useState<Line[]>([]);
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(debug ? 1 : 0);
  const [fps, setFps] = useState<number | null>(null);
  // diagnóstico (F3): erros de script desde que a partida abriu
  const [errors, setErrors] = useState(0);
  useEffect(() => {
    const bump = () => setErrors((n) => n + 1);
    window.addEventListener("error", bump); window.addEventListener("unhandledrejection", bump);
    return () => { window.removeEventListener("error", bump); window.removeEventListener("unhandledrejection", bump); };
  }, []);
  const [save, setSave] = useState<SavedRun | null>(null);
  const [wheelHover, setWheelHover] = useState<WheelSlot | null>(null);
  const seq = useRef(1);
  const onUiRef = useRef<(ui: OpenUi) => void>(() => {});
  const loadingRef = useRef(0);
  const beatLine = useRef({ at: -1, next: 0 });
  const bump = useCallback(() => setRev((r) => r + 1), []);
  const setSettings = useCallback((st: HeistSettings) => { setSettingsState(st); saveSettings(st); }, []);

  useEffect(() => { controls.settings = settings; }, [controls, settings]);
  useEffect(() => { audio.setMix(settings.music, settings.sfx, settings.voices, settings.voiceVolume); }, [audio, settings.music, settings.sfx, settings.voices, settings.voiceVolume]);
  useEffect(() => { audio.locale = locale; }, [audio, locale]);
  useEffect(() => { const s = sim.current.s; s.options.slowLasers = settings.slowLasers; s.options.regen = settings.regen; s.options.beats = settings.beats; }, [settings.slowLasers, settings.regen, settings.beats]);
  useEffect(() => { if (!settings.showFps) setFps(null); }, [settings.showFps]);
  useEffect(() => { const sv = loadSave(SIM_VERSION); setSave(sv && sv.deck.join(",") === deckKey(cards) ? sv : null); }, [cards]);
  useEffect(() => { const el = wrap.current; if (!el) return; controls.attach(el); return () => { controls.detach(); audio.stop(); }; }, [controls, audio]);
  useEffect(() => {
    if (!labHandle) return;
    const w = window as unknown as { __heist?: unknown };
    w.__heist = { get s() { return sim.current.s; }, ctx, step: (inp: Parameters<typeof step>[2], dt: number) => step(sim.current.s, ctx, inp, dt), interact: () => onUiRef.current(interact(sim.current.s, ctx)), loading: () => loadingRef.current, takeDiamond: () => { startCutscene(sim.current.s); skipCutscene(sim.current.s); }, hurt: (n: number, by: string) => { const t = sim.current.s.guards.find((g) => g.id === by); damagePlayer(sim.current.s, n, t ? t.pos : sim.current.s.player.pos, by); } };
    return () => { delete w.__heist; };
  }, [labHandle, ctx]);
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

  const names = useCallback((who: string) => {
    if (who === "player") return t("heist.who.player");
    if (GUARD_NAMES[who]) return t("heist.who.guard", { name: GUARD_NAMES[who], role: t(`heist.guardRole.${GUARDS.find((g) => g.id === who)?.role ?? "guard"}`) });
    const c = sim.current.s.civs.find((x) => x.id === who);
    return c ? t(`heist.who.${c.role}`) : t(`heist.who.${who}`);
  }, [t]);
  const say = useCallback((who: string, key: string, vars?: Record<string, string | number>) => {
    setLines((l) => [...l.slice(-2), { id: seq.current++, who, key, vars, at: performance.now() }]);
    audio.duck(2.6);
    audio.speak(t(key, vars), !!GUARD_NAMES[who]);
  }, [audio, t]);

  const onEvents = useCallback((s: SimState) => {
    // falas da cena curta, no segundo em que entram
    if (s.beat) {
      if (beatLine.current.at !== s.beat.at) beatLine.current = { at: s.beat.at, next: 0 };
      const el = s.time - s.beat.at;
      while (beatLine.current.next < s.beat.lines.length && s.beat.lines[beatLine.current.next].at <= el) { const l = s.beat.lines[beatLine.current.next++]; say(l.who, l.key); }
    }
    if (!s.events.length) return;
    const now = performance.now();
    for (const e of s.events) {
      switch (e.t) {
        case "line": say(e.who, e.key, e.vars); break;
        case "toast": setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: e.key, vars: e.vars, at: now }]); break;
        case "sfx": audio.play(e.id, 1, e.pos); break;
        case "shot": audio.play(e.by === "player" ? (e.silenced ? "silenced" : "shot") : Math.hypot(e.from.x - s.player.pos.x, e.from.z - s.player.pos.z) > 14 ? "shotFar" : "shot", e.by === "player" ? 1 : 0.8, e.by === "player" ? undefined : e.from); break;
        case "hit": audio.play(e.on === "player" ? "hurt" : "hit"); break;
        case "down": audio.play("down"); break;
        case "outfit": setPieces(outfitPieces(s)); break;
        case "alarm": audio.alarm(e.on); break;
        case "rumble": controls.rumble(e.strong, e.weak, e.ms); break;
        case "detected":
          audio.play("detected");
          setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: "heist.toast.detected", vars: { reason: t(`heist.reason.${e.reason}`), who: names(e.by) }, at: now }]);
          break;
        case "loot": if (e.item.kind !== "diamante") setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: "heist.toast.loot", vars: { item: t(`heist.jewel.${e.item.kind}`), value: e.item.value }, at: now }]); break;
        case "beat": doneAt.current = s.time; audio.play("objective"); break;
        case "challenge": setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: e.result === "failed" ? "heist.toast.challengeFailed" : "heist.toast.challengeDone", vars: { name: t(`heist.challenge.${e.id}.name`) }, at: now }]); break;
        case "puzzle": if (e.result === "solved") audio.play("solved"); if (e.result === "mistake") audio.play("mistake"); break;
        case "checkpoint":
          if (e.reason !== "restore") {
            const snap = snapshot(s);
            checkpoints.current[e.reason] = snap; lastCheckpoint.current = e.reason;
            const run: SavedRun = { version: SIM_VERSION, savedAt: Date.now(), checkpoint: e.reason, deck: deckKey(cards).split(","), snap };
            // gravar no navegador fora do quadro (JSON grande): sem engasgo ao entrar na sala nova
            const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
            if (idle) idle(() => writeSave(run), { timeout: 2000 }); else setTimeout(() => writeSave(run), 0);
            setSave(run);
            if (e.reason !== "start") setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: "heist.toast.checkpoint", vars: { where: t(`heist.checkpoint.${e.reason}`) }, at: now }]);
          }
          break;
        case "phase":
          if (e.phase === "LOST") setTimeout(() => setStage("over"), 1800);
          if (e.phase === "WON") { clearSave(); setSave(null); setTimeout(() => setStage("won"), 2200); }
          if (e.phase === "LOST" || e.phase === "WON") controls.unlock();
          break;
      }
    }
    s.events.length = 0;
  }, [audio, controls, say, t, cards, names]);

  // tutorial gradual (MH-13-02): cada dica aparece uma vez, quando a situação acontece pela primeira vez
  const tipsSeen = useRef(new Set<string>());
  const tip = useCallback((id: string, vars?: Record<string, string>) => {
    if (tipsSeen.current.has(id)) return;
    tipsSeen.current.add(id);
    setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: `heist.tip.${id}`, vars, at: performance.now() + 2500 }]);
  }, []);
  useEffect(() => {
    if (stage !== "play" || hud.beat || hud.cutscene) return;
    const k = (a: Parameters<typeof bindLabel>[1]) => bindLabel(settings, a, controls.usingPad, t);
    if (hud.time > 1) tip("move", { move: controls.usingPad ? t("heist.key.leftStick") : ["forward", "left", "back", "right"].map((a) => k(a as never)).join(""), sprint: k("sprint"), discreet: k("discreet") });
    if (hud.exposure > 0.2) tip("exposure");
    if (hud.prompt?.kind === "pickpocket") tip("steal", { key: k("interact") });
    if (hud.prompt?.kind === "takedown") tip("takedown", { key: k("melee") });
    if (hud.hp <= 30) tip("lowHp", { key: k("heal") });
    if (hud.access === "staff" && hud.accessTone === "bad") tip("staffArea");
    if (hud.room === "cofre") tip("lasers", { key: k("crouch") });
    if (hud.phase === "ESCAPE") tip("escape", { key: k("dodge") });
    if (hud.weapon !== "hands" && hud.magSize > 0) tip("gun", { aim: k("aim"), fire: k("fire") });
  }, [hud, stage, settings, controls, t, tip]);

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
    if (ui.ui === "dialogue") setPanel({ kind: "dialogue" });
  }, [controls]);
  onUiRef.current = onUi;
  loadingRef.current = loading;
  const closePanel = useCallback((relock = true) => { setPanel(null); controls.reset(); if (relock) controls.lock(); bump(); }, [controls, bump]);
  const leaveTalk = useCallback(() => { endTalk(sim.current.s); closePanel(); }, [closePanel]);
  const onChoose = useCallback((i: number) => {
    const next = choose(sim.current.s, i);
    audio.play("ui");
    if (!next) closePanel(); else if (next.ui === "vendor") setPanel({ kind: "vendor", vendor: next.vendor }); else bump();
  }, [audio, closePanel, bump]);

  // bordas de interface (roda, mapa, pausa, armas, ombro, FPS, pular cena) lidas a cada quadro de React
  const wheelRef = useRef<WheelSlot | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      for (const e of controls.takeEdges()) {
        const s = sim.current.s;
        if (e === "pause") {
          if (panel && panel.kind !== "wheel") { if (panel.kind === "puzzle") s.puzzle = null; if (panel.kind === "dialogue") endTalk(s); closePanel(false); }
          else if (stage === "play") { setStage("pause"); controls.unlock(); }
          else if (stage === "pause") { setStage("play"); controls.lock(); }
        }
        if (e === "fps") setSettings({ ...settings, showFps: !settings.showFps });
        if (stage !== "play") continue;
        if (e === "skip") { if (s.beat) skipBeat(s); else skipCutscene(s); }
        if (s.beat || s.phase === "CUTSCENE") continue;
        if (e === "map") { if (panel?.kind === "map") closePanel(); else if (!panel) { controls.unlock(); setPanel({ kind: "map" }); } }
        if (e === "shoulder") setSettings({ ...settings, shoulder: settings.shoulder === "right" ? "left" : "right" });
        if (e === "wheel-open" && !panel) { setPanel({ kind: "wheel" }); setWheelHover(null); }
        if (e === "wheel-close" && panel?.kind === "wheel") pickWheel(wheelRef.current);
        const have: WeaponId[] = (["hands", "knife", "pistolS", "pistol", "guardPistol"] as WeaponId[]).filter((w) => s.player.inv.weapons.includes(w));
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

  /** Começa do zero (com a dificuldade e o desafio escolhidos) ou de uma partida salva. */
  const begin = (s: SimState, cp: string) => {
    sim.current.s = s; checkpoints.current = { [cp]: snapshot(s), start: checkpoints.current.start ?? snapshot(s) }; lastCheckpoint.current = cp;
    doneAt.current = -99; beatLine.current = { at: -1, next: 0 };
    setPieces(outfitPieces(s)); setPanel(null); setLines([]); setToasts([]);
    audio.start(); audio.alarm(s.alarm); setStage("play"); controls.lock(); bump();
  };
  const start = (o: StartOptions) => {
    const s = newSim(cards, (Date.now() % 1e9) | 0, { difficulty: o.difficulty, challenge: o.challenge, slowLasers: settings.slowLasers, regen: settings.regen, beats: settings.beats });
    checkpoints.current = { start: snapshot(s) };
    startBeat(s, "intro", "");
    begin(s, "start");
  };
  const continueRun = () => { if (save) begin(restore(save.snap as SimState), save.checkpoint); };
  const fromCheckpoint = () => {
    const snap = checkpoints.current[lastCheckpoint.current] ?? checkpoints.current.start;
    begin(restore(snap), lastCheckpoint.current);
  };
  const restart = () => {
    const old = sim.current.s;
    const s = newSim(cards, (Date.now() % 1e9) | 0, { difficulty: old.difficulty, challenge: old.challenge, slowLasers: settings.slowLasers, regen: settings.regen, beats: settings.beats });
    checkpoints.current = { start: snapshot(s) }; clearSave(); setSave(null);
    begin(s, "start");
  };

  const s = sim.current.s;
  const blurred = stage === "over" || stage === "pause" || stage === "won" || stage === "brief";
  const quality = settings.quality;
  // faixas de cinema: no pós-processamento quando ele está ligado (qualidade alta), senão as do HUD
  return <div ref={wrap} className={`hz-game ${blurred ? "is-dimmed" : ""} ${stage === "over" ? "is-over" : ""} ${quality === "high" && !debug ? "has-glbox" : ""}`} data-stage={stage}>
    <Canvas shadows={quality === "high"} dpr={quality === "high" ? [1, 1.75] : [0.7, 1]} gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
      camera={{ fov: settings.fov, near: 0.05, far: 500, position: [-18, 0.5, 52] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Driver sim={sim} ctx={ctx} view={view} controls={controls} audio={audio} settings={settings} running={running} slowMo={panel?.kind === "wheel"} onEvents={onEvents} onUi={onUi} onHud={setHud} onFps={setFps} doneAt={doneAt} />
      <HeistCamera view={view} sim={sim} world={ctx.world} controls={controls} reducedMotion={reduced} settings={settings} />
      <Suspense fallback={null}>
        <SceneRoot world={ctx.world} view={view} pieces={pieces} quality={quality} debug={debug} onProgress={setLoading} letterbox={!!hud.beat || hud.cutscene} />
      </Suspense>
      <HeistFx view={view} />
    </Canvas>
    {(stage === "play" || stage === "pause") && <Hud h={hud} pad={controls.usingPad} lines={lines} toasts={toasts} names={names} settings={settings} fps={fps} errors={errors} />}
    {stage === "play" && !controls.locked && !panel && !controls.usingPad && !hud.beat && !hud.cutscene && <p className="hz-clickhint">{t("heist.hud.clickToPlay")}</p>}
    {panel?.kind === "wheel" && <ItemWheel info={wheelInfo} hover={wheelHover} onPick={(sl) => pickWheel(sl)} />}
    {panel?.kind === "vendor" && <VendorPanel s={s} vendor={panel.vendor} onChange={bump} onClose={() => closePanel()} />}
    {panel?.kind === "deck" && <DeckPanel s={s} onChange={(close) => { bump(); if (close) closePanel(); }} onClose={() => closePanel()} />}
    {panel?.kind === "puzzle" && s.puzzle && <PuzzlePanel s={s} onChange={bump} onClose={() => closePanel()} />}
    {panel?.kind === "clue" && <CluePanel clue={panel.ref} onClose={() => closePanel()} />}
    {panel?.kind === "dialogue" && <DialoguePanel s={s} rev={rev} onChoose={onChoose} onLeave={leaveTalk} />}
    {panel?.kind === "map" && <MapPanel s={s} onClose={() => closePanel()} />}
    {stage === "brief" && <Briefing cards={s.cards} onStart={start} onContinue={continueRun} save={save} onExit={onExit} loading={loading} pad={controls.usingPad} settings={settings} onSettings={setSettings} />}
    {stage === "pause" && <PauseMenu s={s} settings={settings} onSettings={setSettings} controls={controls} pad={controls.usingPad}
      onResume={() => { setStage("play"); controls.lock(); }} onCheckpoint={fromCheckpoint} onRestart={restart} onExit={onExit} checkpoint={lastCheckpoint.current} />}
    {stage === "over" && <GameOver s={s} names={names} checkpoint={lastCheckpoint.current} onCheckpoint={fromCheckpoint} onRestart={restart} onExit={onExit} />}
    {stage === "won" && <Victory s={s} onRestart={restart} onExit={onExit} />}
  </div>;
}
