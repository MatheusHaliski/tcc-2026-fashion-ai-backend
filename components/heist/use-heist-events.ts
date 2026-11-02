/*
 * MET Gala Heist v2 — eventos da simulação (game.tsx): quem fala (nomes traduzidos), as falas (legenda + voz) e o que
 * cada evento do passo vira na interface e no som — avisos, efeitos, alarme, vibração, roupa, checkpoints (gravados no
 * navegador fora do quadro) e o fim da partida.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { HeistCard, SimState } from "@/lib/heist/types";
import { SIM_VERSION, outfitPieces, snapshot } from "@/lib/heist/state";
import { GUARDS } from "@/lib/heist/level";
import type { HeistAudio } from "./audio";
import type { HeistControls } from "./input";
import type { Line } from "./hud";
import { clearSave, writeSave, type SavedRun } from "./settings";
import { GUARD_NAMES, deckKey, type Stage } from "./game-types";

type T = (key: string, vars?: Record<string, string | number>) => string;

export function useHeistEvents({ sim, audio, controls, cards, t, seq, checkpoints, lastCheckpoint, doneAt, beatLine, setLines, setToasts, setPieces, setSave, setStage }: {
  sim: React.MutableRefObject<{ s: SimState }>; audio: HeistAudio; controls: HeistControls; cards: HeistCard[]; t: T;
  seq: React.MutableRefObject<number>; checkpoints: React.MutableRefObject<Record<string, SimState>>; lastCheckpoint: React.MutableRefObject<string>;
  doneAt: React.MutableRefObject<number>; beatLine: React.MutableRefObject<{ at: number; next: number }>;
  setLines: Dispatch<SetStateAction<Line[]>>; setToasts: Dispatch<SetStateAction<Line[]>>; setPieces: (p: ReturnType<typeof outfitPieces>) => void;
  setSave: (run: SavedRun | null) => void; setStage: (st: Stage) => void;
}) {
  const names = useCallback((who: string) => {
    if (who === "player") return t("heist.who.player");
    if (GUARD_NAMES[who]) return t("heist.who.guard", { name: GUARD_NAMES[who], role: t(`heist.guardRole.${GUARDS.find((g) => g.id === who)?.role ?? "guard"}`) });
    const c = sim.current.s.civs.find((x) => x.id === who);
    return c ? t(`heist.who.${c.role}`) : t(`heist.who.${who}`);
  }, [t, sim]);
  const say = useCallback((who: string, key: string, vars?: Record<string, string | number>) => {
    setLines((l) => [...l.slice(-2), { id: seq.current++, who, key, vars, at: performance.now() }]);
    audio.duck(2.6);
    const st = sim.current.s, from = st.guards.find((g) => g.id === who)?.pos ?? st.civs.find((c) => c.id === who)?.pos;
    audio.speak(t(key, vars), !!GUARD_NAMES[who], from);
  }, [audio, t, sim, seq, setLines]);

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
  }, [audio, controls, say, t, cards, names, seq, checkpoints, lastCheckpoint, doneAt, beatLine, setToasts, setPieces, setSave, setStage]);

  return { names, say, onEvents };
}
