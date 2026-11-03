/*
 * MET Gala Heist v2 — acesso de laboratório (game.tsx): expõe a simulação em `window.__heist` (testes de jogo e capturas
 * automáticas) e começa num checkpoint (?at=salao, cofre…), também depois de "Começar", que cria a partida de novo.
 */
import { useCallback, useEffect } from "react";
import type { SimState } from "@/lib/heist/types";
import type { SimCtx } from "@/lib/heist/state";
import { interact, skipCutscene, startCutscene, step, type OpenUi } from "@/lib/heist/sim";
import { damagePlayer } from "@/lib/heist/combat";

export function useHeistLab({ labHandle, ctx, sim, onUiRef, loadingRef, startAt }: {
  labHandle: boolean; ctx: SimCtx; sim: React.MutableRefObject<{ s: SimState }>; onUiRef: React.MutableRefObject<(ui: OpenUi) => void>;
  loadingRef: React.MutableRefObject<number>; startAt?: string;
}) {
  useEffect(() => {
    if (!labHandle) return;
    const w = window as unknown as { __heist?: unknown };
    w.__heist = { get s() { return sim.current.s; }, ctx, step: (inp: Parameters<typeof step>[2], dt: number) => step(sim.current.s, ctx, inp, dt), interact: () => onUiRef.current(interact(sim.current.s, ctx)), loading: () => loadingRef.current, takeDiamond: () => { startCutscene(sim.current.s); skipCutscene(sim.current.s); }, hurt: (n: number, by: string) => { const t = sim.current.s.guards.find((g) => g.id === by); damagePlayer(sim.current.s, n, t ? t.pos : sim.current.s.player.pos, by); } };
    return () => { delete w.__heist; };
  }, [labHandle, ctx, sim, onUiRef, loadingRef]);
  // laboratório: começar num checkpoint (?at=salao, cofre…) — também depois de "Começar", que cria a partida de novo
  const labTeleport = useCallback((s: SimState) => {
    if (!startAt) return false;
    const cp = { salao: { x: 0, z: 12.6 }, servico: { x: -19.2, z: 15.2 }, cofre: { x: -14, z: -15 }, vestibulo: { x: 0, z: 22.6 }, terraco: { x: 20.6, z: -14 } }[startAt];
    if (cp) { s.player.pos = { ...cp }; s.player.y = 0; s.player.inv.wristband = true; s.player.lastRoom = startAt as SimState["player"]["lastRoom"]; }
    return !!cp;
  }, [startAt]);
  useEffect(() => { labTeleport(sim.current.s); }, [labTeleport, sim]);
  return labTeleport;
}
