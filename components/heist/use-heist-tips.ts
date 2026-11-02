/*
 * MET Gala Heist v2 — tutorial gradual (MH-13-02, game.tsx): cada dica aparece uma vez, como aviso, quando a situação
 * acontece pela primeira vez (andar, exposição, furto, derrubar, vida baixa, área de serviço, lasers, fuga, arma).
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { I18n } from "@/lib/i18n/i18n";
import type { HeistControls } from "./input";
import type { HudState, Line } from "./hud";
import { bindLabel, type HeistSettings } from "./settings";
import type { Stage } from "./game-types";

export function useHeistTips({ hud, stage, settings, controls, t, seq, setToasts }: {
  hud: HudState; stage: Stage; settings: HeistSettings; controls: HeistControls; t: I18n["t"]; seq: React.MutableRefObject<number>; setToasts: Dispatch<SetStateAction<Line[]>>;
}) {
  // tutorial gradual (MH-13-02): cada dica aparece uma vez, quando a situação acontece pela primeira vez
  const tipsSeen = useRef(new Set<string>());
  const tip = useCallback((id: string, vars?: Record<string, string>) => {
    if (tipsSeen.current.has(id)) return;
    tipsSeen.current.add(id);
    setToasts((l) => [...l.slice(-2), { id: seq.current++, who: "", key: `heist.tip.${id}`, vars, at: performance.now() + 2500 }]);
  }, [seq, setToasts]);
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
}
