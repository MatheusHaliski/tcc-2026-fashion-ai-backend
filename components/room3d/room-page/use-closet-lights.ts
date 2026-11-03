import { useEffect, useState } from "react";
import type { RoomData3D } from "@/components/room3d/room-scene";
import type { Room, Toast, Translate } from "./room-page-model";

/** Luzes do closet: um marco novo do Inventory Score (guardado no aparelho) faz a animação de conquista no espelho. */
export function useClosetLights(data: Room | null, toast: Toast, t: Translate) {
  const [celebrate, setCelebrate] = useState(false);
  // Luzes do closet: um marco novo do Inventory Score acende uma luz e faz a animação de conquista no espelho
  useEffect(() => {
    const cl = (data as unknown as RoomData3D | null)?.closetLights; if (!cl) return;
    let before = 0; try { before = Number(localStorage.getItem("fai.room.lights") ?? "0"); } catch { /* sem storage */ }
    if (cl.lit > before) { setCelebrate(true); const m = cl.milestones.filter((x) => x.lit).pop(); if (before > 0 && m) toast.success(t("room.nova_luz_do_closet_acesa", { label: m.label })); setTimeout(() => setCelebrate(false), 6000); }
    try { localStorage.setItem("fai.room.lights", String(cl.lit)); } catch { /* sem storage */ }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return celebrate;
}
