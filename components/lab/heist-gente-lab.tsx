"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Preset } from "./heist-gente-scene";
import type { Anim, LookId } from "@/lib/heist/types";

/*
 * Laboratório das pessoas do MET Gala Heist v2 (dados de exemplo, sem simulação). `?cam=` escolhe a cena
 * (multidao | close | anims | troca | caida | tiro | agachada | jogadora | pessoa), `?q=low` a qualidade baixa, `?t=1.2`
 * para o tempo da cena num instante (captura de um momento do gesto) e, em `pessoa`, `?look=guard&seed=5&anim=guard` quem
 * aparece e o gesto.
 */
const Scene = dynamic(() => import("./heist-gente-scene"), { ssr: false });
const PRESETS: Preset[] = ["multidao", "close", "anims", "troca", "caida", "tiro", "agachada", "jogadora", "pessoa"];

export default function HeistGenteLab() {
  const [opts, setOpts] = useState<{ preset: Preset; quality: "high" | "low"; at?: number; look?: LookId; seed?: number; anim?: Anim } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search), cam = q.get("cam") as Preset | null;
    const at = Number(q.get("t"));
    setOpts({ preset: cam && PRESETS.includes(cam) ? cam : "multidao", quality: q.get("q") === "low" ? "low" : "high", at: q.has("t") && Number.isFinite(at) ? at : undefined,
      look: (q.get("look") as LookId | null) ?? undefined, seed: q.has("seed") ? Number(q.get("seed")) || 1 : undefined, anim: (q.get("anim") as Anim | null) ?? undefined });
  }, []);
  return <div style={{ position: "fixed", inset: 0, background: "#07090b" }}>{opts && <Scene preset={opts.preset} quality={opts.quality} at={opts.at} look={opts.look} seed={opts.seed} anim={opts.anim} />}</div>;
}
