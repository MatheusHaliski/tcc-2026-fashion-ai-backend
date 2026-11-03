import { useState } from "react";
import { api } from "@/lib/api/client";
import type { SetState, Toast } from "./room-page-model";

/** Busto de costura (Copilot): a pergunta, a resposta e o módulo para onde ele aponta (abre a porta/gaveta e destaca a peça). */
export function useRoomCopilot({ toast, setHighlight, setFocusModule, setOpenSet }: {
  toast: Toast; setHighlight: SetState<string | null>; setFocusModule: SetState<string | null>; setOpenSet: SetState<Set<string>>;
}) {
  const [copilot, setCopilot] = useState<{ open: boolean; q: string; busy: boolean; text: string | null; point: string | null }>({ open: false, q: "", busy: false, text: null, point: null });
  async function askCopilot() {
    setCopilot((c) => ({ ...c, busy: true, point: null }));
    try {
      const r = await api.post<{ text?: string; roomHighlight?: { pieceId: string; moduleId: string } | null }>("/api/copilot/messages", { message: copilot.q, view: "ROOM" });
      const mod = r.roomHighlight?.moduleId ?? null;
      setCopilot((c) => ({ ...c, busy: false, text: r.text ?? "", point: mod }));
      if (r.roomHighlight) { setHighlight(r.roomHighlight.pieceId); setFocusModule(mod); if (mod && (mod.startsWith("door:") || mod.startsWith("drawer:"))) setOpenSet(new Set([mod])); }
    } catch (e) { toast.fromError(e); setCopilot((c) => ({ ...c, busy: false })); }
  }
  return { copilot, setCopilot, askCopilot };
}
