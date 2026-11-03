import { useState } from "react";
import { api } from "@/lib/api/client";
import { vistaRequest, type MirrorData } from "@/components/mirror/mirror-controls";
import type { Api, MirrorState, Pins, SetState, Toast, Translate } from "./room-page-model";

/** Vista-me no quarto: as portas e gavetas de onde as peças saem acendem; aceitar o look fecha tudo e sobe a luz do espelho. */
export function useRoomVista({ mirror, pins, toast, t, reload, setOpenSet, setFocusModule }: {
  mirror: Api<MirrorState>; pins: Pins; toast: Toast; t: Translate; reload: () => unknown; setOpenSet: SetState<Set<string>>; setFocusModule: SetState<string | null>;
}) {
  const [lit, setLit] = useState<Set<string>>(new Set()); const [closingKey, setClosingKey] = useState(0);
  const [vista, setVista] = useState<{ open: boolean; busy: boolean; result: MirrorState | null }>({ open: false, busy: false, result: null });
  /** A sequência do Vista-me acende as portas e gavetas de onde as peças saem. */
  function lightSequence(r: MirrorData) {
    const mods = new Set((r.sequence ?? []).map((x) => x.moduleId).filter((m): m is string => !!m));
    setLit(mods); setOpenSet(new Set([...mods].filter((m) => m.startsWith("door:") || m.startsWith("drawer:"))));
  }
  async function runVistaMe(kind: "vista-me" | "another", prompt = "") {
    setVista((v) => ({ ...v, busy: true }));
    try {
      // as peças fixadas no painel do Espelho ("Manter") também são âncoras aqui
      const req = vistaRequest(kind, mirror.data, pins.anchorIds(), prompt);
      const r = await api.post<MirrorState>(req.path, req.body ?? {});
      lightSequence(r);
      setVista((v) => ({ ...v, busy: false, result: r })); mirror.setData(r);
    } catch (e) { toast.fromError(e); setVista((v) => ({ ...v, busy: false })); }
  }
  async function acceptLook() {
    try {
      const r = await api.post<{ message?: string }>("/api/me/mirror/use");
      // fecho do Vista-me (DET-D07): portas fecham, a luz do espelho sobe e aparece a foto do look
      setOpenSet(new Set()); setLit(new Set()); setClosingKey((k) => k + 1); setVista({ open: false, busy: false, result: null }); setFocusModule("mirror");
      toast.success(r.message ?? t("common.look_do_dia_registrado")); reload(); mirror.reload();
    } catch (e) { toast.fromError(e); }
  }
  return { lit, closingKey, vista, setVista, lightSequence, runVistaMe, acceptLook };
}
