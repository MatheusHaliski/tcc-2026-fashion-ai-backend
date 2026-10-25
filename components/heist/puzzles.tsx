"use client";
/*
 * MET Gala Heist v2 — puzzles: teclado da porta de serviço e cofre da sala de segurança (4 dígitos; com a Visão, as teclas
 * gastas aparecem), quadro de luz (3×3: cada disjuntor vira ele e os vizinhos; todos verdes cortam a energia dos lasers;
 * com a Visão, os certos acendem) e a trava da vitrine do diamante (três anéis de símbolos; a placa da exposição diz a
 * ordem). Joia (grampo) ou decodificador abrem teclado, cofre e vitrine sem o código. Também a tela das pistas.
 */
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { SimState } from "@/lib/heist/types";
import { CODES, RING_SYMBOLS } from "@/lib/heist/level";
import { closePuzzle, puzzleFuse, puzzleKey, puzzlePick, puzzleRing } from "@/lib/heist/sim";

const RING_GLYPH: Record<(typeof RING_SYMBOLS)[number], string> = { lua: "☾", coracao: "♥", estrela: "★", coroa: "♛" };

export function PuzzlePanel({ s, onChange, onClose }: { s: SimState; onChange: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const z = s.puzzle;
  const vision = s.time < s.player.visionUntil;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!s.puzzle || (s.puzzle.kind !== "keypad" && s.puzzle.kind !== "safe")) return;
      if (/^Digit\d$|^Numpad\d$/.test(e.code)) { puzzleKey(s, e.code.slice(-1)); onChange(); }
      if (e.code === "Backspace") { puzzleKey(s, "C"); onChange(); }
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [s, onChange]);
  useEffect(() => { if (z?.solved) { const id = setTimeout(onClose, z.kind === "rings" ? 400 : 900); return () => clearTimeout(id); } }, [z?.solved, z?.kind, onClose]);
  if (!z) return null;
  const picks = s.cards.filter((c) => c.use === "PICK" && s.cardState[c.id] === "DECK");
  const canPick = z.kind !== "fuses" && !z.solved;
  const code = z.kind === "keypad" ? CODES.service : CODES.safe;
  const close = () => { closePuzzle(s); onClose(); };
  return <div className="hz-modal" role="dialog" aria-modal="true" aria-labelledby="hz-pz-title">
    <div className={cn("hz-panel hz-puzzle", `is-${z.kind}`, z.solved && "is-solved")}>
      <header className="hz-panel-head"><div><p className="hz-eyebrow">{t("heist.puzzle.eyebrow")}</p><h2 id="hz-pz-title">{t(`heist.puzzle.${z.kind}.title`)}</h2><p className="hz-muted">{t(`heist.puzzle.${z.kind}.text`)}</p></div></header>
      {(z.kind === "keypad" || z.kind === "safe") && <div className="hz-keypad">
        <output className="hz-keypad-screen" aria-live="polite">{z.solved ? t("heist.puzzle.open") : z.input.padEnd(4, "•")}</output>
        <div className="hz-keypad-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0"].map((k) => <button key={k} type="button" className={cn("hz-key", vision && code.includes(k) && "is-worn")} onClick={() => { puzzleKey(s, k); onChange(); }} aria-label={k === "C" ? t("heist.puzzle.clear") : k}>{k}</button>)}
        </div>
        {z.mistakes > 0 && !z.solved && <p className="hz-warn" role="alert">{t("heist.puzzle.wrong", { n: 3 - z.mistakes })}</p>}
      </div>}
      {z.kind === "fuses" && <div className="hz-fuses" role="group" aria-label={t("heist.puzzle.fuses.title")}>
        {z.lights.map((on, i) => <button key={i} type="button" className={cn("hz-fuse", on && "is-on", vision && [0, 4, 8].includes(i) && !z.solved && "is-hint")} aria-pressed={on} aria-label={t("heist.puzzle.fuse", { n: i + 1, state: t(on ? "heist.puzzle.on" : "heist.puzzle.off") })} onClick={() => { puzzleFuse(s, i); onChange(); }} />)}
      </div>}
      {z.kind === "rings" && <div className="hz-rings">
        {z.rings.map((v, r) => <div key={r} className="hz-ring">
          <button type="button" className="hz-btn" onClick={() => { puzzleRing(s, r, -1); onChange(); }} aria-label={t("heist.puzzle.ringPrev", { n: r + 1 })}>‹</button>
          <span className={cn("hz-ring-face", vision && v === CODES.rings[r] && "is-right")} aria-live="polite" aria-label={t(`heist.symbol.${RING_SYMBOLS[v]}`)}>{RING_GLYPH[RING_SYMBOLS[v]]}</span>
          <button type="button" className="hz-btn" onClick={() => { puzzleRing(s, r, 1); onChange(); }} aria-label={t("heist.puzzle.ringNext", { n: r + 1 })}>›</button>
        </div>)}
      </div>}
      {z.solved && <p className="hz-good" role="status">{t(`heist.puzzle.${z.kind}.solved`)}</p>}
      <footer className="hz-panel-foot">
        {canPick && picks.map((c) => <button key={c.id} type="button" className="hz-btn is-card" onClick={() => { puzzlePick(s, c.id); onChange(); }}>{t("heist.puzzle.usePick", { name: c.starter ? t(`heist.${c.name}`) : c.name })}</button>)}
        {canPick && s.player.inv.decoder > 0 && <button type="button" className="hz-btn is-card" onClick={() => { puzzlePick(s, "decoder"); onChange(); }}>{t("heist.puzzle.useDecoder")}</button>}
        {canPick && !picks.length && !s.player.inv.decoder && <p className="hz-fine">{t("heist.puzzle.noPick")}</p>}
        {!z.solved && <button type="button" className="hz-btn" onClick={close} autoFocus>{t("heist.puzzle.leave")}</button>}
      </footer>
    </div>
  </div>;
}

/** Pistas lidas no cenário (cartaz do Aurora, folha de chamada, placa da exposição). */
export function CluePanel({ clue, onClose }: { clue: string; onClose: () => void }) {
  const { t } = useI18n();
  return <div className="hz-modal" role="dialog" aria-modal="true" aria-labelledby="hz-clue-title">
    <div className={cn("hz-panel hz-clue", `is-${clue}`)}>
      <p className="hz-eyebrow">{t("heist.clue.eyebrow")}</p>
      <h2 id="hz-clue-title">{t(`heist.clue.${clue}.title`)}</h2>
      <p className="hz-clue-text">{t(`heist.clue.${clue}.text`)}</p>
      {clue === "placardStars" && <p className="hz-clue-glyphs" aria-hidden>{CODES.rings.map((i) => RING_GLYPH[RING_SYMBOLS[i]]).join("  ")}</p>}
      <footer className="hz-panel-foot"><button type="button" className="hz-btn" onClick={onClose} autoFocus>{t("heist.close")}</button></footer>
    </div>
  </div>;
}
