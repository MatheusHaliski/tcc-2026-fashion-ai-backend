/*
 * MET Gala Heist v2 — bordas de interface e roda de itens (game.tsx): as bordas dos controles (roda, mapa, pausa,
 * armas, ombro, FPS, pular cena) lidas a cada quadro de React, a escolha na roda (o que a jogadora tem, quanto, qual
 * arma está na mão) e o que acontece ao soltar a roda num setor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { SimState, WeaponId } from "@/lib/heist/types";
import type { SimCtx } from "@/lib/heist/state";
import { endTalk, equip, quickHeal, skipBeat, skipCutscene, step } from "@/lib/heist/sim";
import type { HeistControls } from "./input";
import type { HudState } from "./hud";
import { slotAt, type WheelInfo, type WheelSlot } from "./wheel";
import type { HeistSettings } from "./settings";
import type { Panel, Stage } from "./game-types";

export function useHeistEdges({ sim, ctx, controls, settings, setSettings, stage, setStage, panel, setPanel, closePanel, bump, hud }: {
  sim: React.MutableRefObject<{ s: SimState }>; ctx: SimCtx; controls: HeistControls; settings: HeistSettings; setSettings: (st: HeistSettings) => void;
  stage: Stage; setStage: (st: Stage) => void; panel: Panel; setPanel: (p: Panel) => void; closePanel: (relock?: boolean) => void; bump: () => void; hud: HudState;
}) {
  const [wheelHover, setWheelHover] = useState<WheelSlot | null>(null);
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

  return { wheelHover, wheelInfo, pickWheel };
}
