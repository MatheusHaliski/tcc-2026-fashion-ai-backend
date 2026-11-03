import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { RoomData3D } from "@/components/room3d/room-scene";
import type { Room, Toast } from "./room-page-model";

/** Luz do teto do quarto: acesa/apagada (com trava contra clique duplo) e intensidade, gravadas no servidor. */
export function useRoomLight(data: Room | null, toast: Toast) {
  const [lightOn, setLightOn] = useState(false);
  const [lightBusy, setLightBusy] = useState(false); const lightLock = useRef(false);
  const [lightIntensity, setLightIntensity] = useState(.75);
  const lightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightPeriod = data?.ambient?.period;
  useEffect(() => { if (data) { const light = (data as unknown as RoomData3D).light; setLightOn(light?.on ?? lightPeriod === "night"); setLightIntensity(light?.intensity ?? .75); } }, [lightPeriod, !!data]);
  useEffect(() => () => { if (lightTimer.current) clearTimeout(lightTimer.current); }, []);
  async function toggleLight() {
    if (lightLock.current) return;
    lightLock.current = true; setLightBusy(true);
    const next = !lightOn;
    try { const saved = await api.put<{ on?: boolean }>("/api/me/room/light", { on: next }); setLightOn(saved.on ?? next); }
    catch (error) { toast.fromError(error); }
    finally { lightLock.current = false; setLightBusy(false); }
  }
  function dimLight(value: number) {
    setLightIntensity(value);
    if (lightTimer.current) clearTimeout(lightTimer.current);
    lightTimer.current = setTimeout(() => { api.put("/api/me/room/light", { intensity: value }).catch(e => toast.fromError(e)); }, 350);
  }
  return { lightOn, lightBusy, lightIntensity, toggleLight, dimLight };
}
