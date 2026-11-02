"use client";
/*
 * MET Gala Heist v2 — o jogo: simulação a 60 Hz no cliente (lib/heist/sim.ts), cena 3D (rua, salas, pessoas, efeitos),
 * câmera sobre o ombro (e os enquadramentos das cenas curtas), controles remapeáveis (teclado/mouse e controle de PS5),
 * HUD, roda de itens, revendedor, deck, puzzles, conversas, mapa, pausa, game over e vitória. Checkpoints ao entrar em
 * cada sala nova e no começo da fuga, guardados também neste navegador (continuar depois). Preferências salvas aqui.
 * Composição: o laço por quadro em driver.tsx; eventos, tutorial, bordas/roda e acesso de laboratório em use-heist-*.ts.
 */
import "./heist.css";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useI18n } from "@/lib/i18n/i18n";
import type { HeistCard, SimState } from "@/lib/heist/types";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { SIM_VERSION, newSim, outfitPieces, restore, simCtx, snapshot } from "@/lib/heist/state";
import { choose, endTalk, startBeat, type OpenUi } from "@/lib/heist/sim";
import { wallBetween } from "@/lib/heist/world";
import { useReducedMotion } from "@/components/three/common";
import { HeistControls } from "./input";
import { HeistAudio } from "./audio";
import { HeistCamera, type LabShot } from "./camera";
import { HeistFx } from "./fx";
import { Hud, type HudState, type Line } from "./hud";
import { hudOf } from "./hud-state";
import { ItemWheel } from "./wheel";
import { VendorPanel } from "./vendor";
import { DeckPanel } from "./cards-ui";
import { CluePanel, PuzzlePanel } from "./puzzles";
import { DialoguePanel } from "./dialogue-ui";
import { MapPanel } from "./map-ui";
import { Briefing, GameOver, PauseMenu, Victory, type StartOptions } from "./screens";
import { SceneRoot } from "./scene-root";
import { clearSave, loadSave, loadSettings, saveSettings, type HeistSettings, type SavedRun } from "./settings";
import { Driver } from "./driver";
import { deckKey, type Panel, type Stage } from "./game-types";
import { useHeistLab } from "./use-heist-lab";
import { useHeistEvents } from "./use-heist-events";
import { useHeistTips } from "./use-heist-tips";
import { useHeistEdges } from "./use-heist-edges";

export interface HeistGameProps {
  cards: HeistCard[]; onExit?: () => void; debug?: boolean; quality?: "high" | "low"; startAt?: string;
  /** laboratório: câmera parada num enquadramento (?shot=) para fotografar pessoas e cenário em jogo */
  labShot?: LabShot | null;
  /** laboratório: expõe a simulação em `window.__heist` (testes de jogo e capturas automáticas) */
  labHandle?: boolean;
}

export function HeistGame({ cards, onExit, debug = false, quality: q0, startAt, labHandle = false, labShot = null }: HeistGameProps) {
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
  const seq = useRef(1);
  const onUiRef = useRef<(ui: OpenUi) => void>(() => {});
  const loadingRef = useRef(0);
  const beatLine = useRef({ at: -1, next: 0 });
  const bump = useCallback(() => setRev((r) => r + 1), []);
  const setSettings = useCallback((st: HeistSettings) => { setSettingsState(st); saveSettings(st); }, []);

  useEffect(() => { controls.settings = settings; }, [controls, settings]);
  useEffect(() => { audio.setMix(settings.music, settings.sfx, settings.voices, settings.voiceVolume); }, [audio, settings.music, settings.sfx, settings.voices, settings.voiceVolume]);
  useEffect(() => { audio.occluded = (pos) => { const s = sim.current.s; return wallBetween(ctx.world, s.player.pos, pos, s.doors); }; return () => { audio.occluded = null; }; }, [audio, ctx]);
  useEffect(() => { audio.locale = locale; }, [audio, locale]);
  useEffect(() => { const s = sim.current.s; s.options.slowLasers = settings.slowLasers; s.options.regen = settings.regen; s.options.beats = settings.beats; }, [settings.slowLasers, settings.regen, settings.beats]);
  useEffect(() => { if (!settings.showFps) setFps(null); }, [settings.showFps]);
  const calm = settings.reduceFlashes || reduced;
  useEffect(() => { view.current.calm = calm; }, [calm]);
  useEffect(() => { const sv = loadSave(SIM_VERSION); setSave(sv && sv.deck.join(",") === deckKey(cards) ? sv : null); }, [cards]);
  useEffect(() => { const el = wrap.current; if (!el) return; controls.attach(el); return () => { controls.detach(); audio.stop(); }; }, [controls, audio]);
  const labTeleport = useHeistLab({ labHandle, ctx, sim, onUiRef, loadingRef, startAt });

  const running = stage === "play" && (!panel || panel.kind === "wheel");
  // a roda aberta: o tempo quase para; o mouse escolhe
  useEffect(() => { controls.wheelMode = panel?.kind === "wheel"; controls.wheelVec = { x: 0, y: 0 }; }, [controls, panel]);

  const { names, onEvents } = useHeistEvents({ sim, audio, controls, cards, t, seq, checkpoints, lastCheckpoint, doneAt, beatLine, setLines, setToasts, setPieces, setSave, setStage });
  useHeistTips({ hud, stage, settings, controls, t, seq, setToasts });

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

  const { wheelHover, wheelInfo, pickWheel } = useHeistEdges({ sim, ctx, controls, settings, setSettings, stage, setStage, panel, setPanel, closePanel, bump, hud });

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
    if (!labTeleport(s)) startBeat(s, "intro", "");
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
  return <div ref={wrap} className={`hz-game ${blurred ? "is-dimmed" : ""} ${stage === "over" ? "is-over" : ""} ${quality === "high" && !debug ? "has-glbox" : ""} ${calm ? "is-calm" : ""}`} data-stage={stage}>
    <Canvas shadows={quality === "high"} dpr={quality === "high" ? [1, 1.75] : [0.7, 1]} gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
      camera={{ fov: settings.fov, near: 0.05, far: 500, position: [-18, 0.5, 52] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Driver sim={sim} ctx={ctx} view={view} controls={controls} audio={audio} settings={settings} running={running} slowMo={panel?.kind === "wheel"} onEvents={onEvents} onUi={onUi} onHud={setHud} onFps={setFps} doneAt={doneAt} />
      <HeistCamera view={view} sim={sim} world={ctx.world} controls={controls} reducedMotion={reduced} settings={settings} shot={labShot} />
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
