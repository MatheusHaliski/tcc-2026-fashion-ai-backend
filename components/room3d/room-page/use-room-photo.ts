import { useState } from "react";
import { newCanvas, saveCanvas } from "@/lib/export/canvas";
import { FILTER_CSS, type Framing, type PhotoFilter, type Room, type SetState, type Toast, type Translate } from "./room-page-model";

/** Modo foto (DET-G04): enquadramento, filtro e profundidade de campo; a foto sai só com a cena, sem a interface. */
export function useRoomPhoto({ canvas, data, toast, t, setHighlight, setFocusModule, setOpenSet }: {
  canvas: HTMLCanvasElement | null; data: Room | null; toast: Toast; t: Translate;
  setHighlight: SetState<string | null>; setFocusModule: SetState<string | null>; setOpenSet: SetState<Set<string>>;
}) {
  const [photo, setPhoto] = useState<{ framing: Framing; filter: PhotoFilter; dof: boolean } | null>(null); const [shooting, setShooting] = useState(false);
  function frame(f: Framing) {
    setPhoto((p) => (p ? { ...p, framing: f } : p)); setHighlight(null);
    if (f === "overview") { setFocusModule(null); setOpenSet(new Set()); }
    if (f === "closet") { setFocusModule(null); setOpenSet(new Set(data!.modules.filter((m) => m.slotType === "DOOR").map((m) => m.id))); }
    if (f === "mirror") { setOpenSet(new Set()); setFocusModule("mirror"); }
    if (f === "shoes") { setOpenSet(new Set()); setFocusModule("base"); }
  }
  async function shoot() {
    if (!canvas || !photo) return; setShooting(true);
    try {
      const w = canvas.width, h = canvas.height; const [out, ctx] = newCanvas(w, h); const f = FILTER_CSS[photo.filter];
      if (photo.dof) {
        // profundidade de campo: fundo desfocado + centro nítido com borda suave (máscara radial)
        ctx.filter = `${f === "none" ? "" : f} blur(${Math.max(3, Math.round(w / 160))}px)`.trim(); ctx.drawImage(canvas, 0, 0);
        const [sharp, sctx] = newCanvas(w, h); sctx.filter = f; sctx.drawImage(canvas, 0, 0); sctx.filter = "none";
        sctx.globalCompositeOperation = "destination-in";
        const g = sctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.46); g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = g; sctx.fillRect(0, 0, w, h); ctx.filter = "none"; ctx.drawImage(sharp, 0, 0);
      } else { ctx.filter = f; ctx.drawImage(canvas, 0, 0); }
      await saveCanvas(out, `meu-quarto-${photo.framing}-${photo.filter}.jpg`, "image/jpeg", 0.94);
      toast.success(t("room.photo.salva"));
    } catch (e) { toast.fromError(e); } finally { setShooting(false); }
  }
  return { photo, setPhoto, shooting, frame, shoot };
}
