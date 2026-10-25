"use client";
/*
 * MET Gala Heist v2 — conversa com escolhas (MH-08-06/07, MH-14-15): quem fala e a fala no alto, as respostas embaixo.
 * Resposta indisponível aparece apagada com o motivo (o que falta: convite, uma peça mais cara, uma pista). Teclado:
 * ↑/↓ (ou W/S) escolhe, Enter/E responde, 1–9 vai direto, Esc sai da conversa. Controle: direcional ou analógico, ✕
 * responde, ○ sai. O mundo fica parado enquanto a conversa está aberta.
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { SimState } from "@/lib/heist/types";
import { DIALOGUES, choicesOf, nodeLine } from "@/lib/heist/dialogue";
import { PAD, usePad } from "@/lib/input/gamepad";

export function DialoguePanel({ s, rev, onChoose, onLeave }: { s: SimState; rev: number; onChoose: (index: number) => void; onLeave: () => void }) {
  const { t } = useI18n();
  const d = s.dialogue;
  const node = d ? DIALOGUES[d.id][d.node] : null;
  const options = node ? choicesOf(s, node) : [];
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const stickAt = useRef(0);
  // nó novo: volta para a primeira resposta disponível
  useEffect(() => { setSel(Math.max(0, options.findIndex((o) => !o.locked))); }, [d?.node, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (list.current?.querySelectorAll("button")[sel] as HTMLButtonElement | undefined)?.focus({ preventScroll: true }); }, [sel, d?.node]);
  const pick = (k: number) => { const o = options[k]; if (o && !o.locked) onChoose(o.i); };
  const move = (dir: 1 | -1) => setSel((x) => (x + dir + options.length) % Math.max(1, options.length));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && !["ArrowUp", "ArrowDown"].includes(e.code)) return;
      if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); move(-1); }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); move(1); }
      else if (e.code === "Enter" || e.code === "KeyE" || e.code === "Space") { e.preventDefault(); pick(sel); }
      else if (e.code === "Escape" || e.code === "Backspace") { e.preventDefault(); onLeave(); }
      else if (/^Digit[1-9]$/.test(e.code)) { const k = Number(e.code.slice(5)) - 1; if (k < options.length) { setSel(k); pick(k); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // o ✕ que abriu a conversa ainda está apertado no primeiro quadro: espera soltar antes de valer
  const openedAt = useRef(0);
  useEffect(() => { openedAt.current = performance.now(); }, [d?.npc]);
  usePad(!!node, (f) => {
    if (performance.now() - openedAt.current < 350) return;
    if (f.tapped(PAD.up)) move(-1);
    if (f.tapped(PAD.down)) move(1);
    if (Math.abs(f.move.y) > 0.6 && performance.now() - stickAt.current > 260) { stickAt.current = performance.now(); move(f.move.y > 0 ? 1 : -1); }
    if (f.tapped(PAD.cross)) pick(sel);
    if (f.tapped(PAD.circle)) onLeave();
  });
  if (!d || !node) return null;
  return <div className="hz-dialogue" role="dialog" aria-modal="true" aria-labelledby="hz-dlg-who" aria-describedby="hz-dlg-line">
    <div className="hz-dialogue-box">
      <p className="hz-eyebrow" id="hz-dlg-who">{t(`heist.who.${node.who}`)}</p>
      <p className="hz-dialogue-line" id="hz-dlg-line">{t(nodeLine(s, node))}</p>
      <ol className="hz-dialogue-choices" ref={list}>
        {options.map((o, k) => <li key={o.i}>
          <button type="button" className={cn("hz-choice", k === sel && "is-sel", o.locked && "is-locked")} aria-disabled={!!o.locked} onMouseEnter={() => setSel(k)} onClick={() => pick(k)}>
            <span className="hz-choice-n" aria-hidden>{k + 1}</span>
            <span className="hz-choice-text">{t(o.c.key)}</span>
            {o.locked && <span className="hz-choice-lock">🔒 {t(o.locked.key, o.locked.vars)}</span>}
          </button>
        </li>)}
      </ol>
      <p className="hz-fine">{t("heist.dlg.help")}</p>
    </div>
  </div>;
}
