"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Preset } from "./heist-gente-scene";

/*
 * Laboratório das pessoas do MET Gala Heist v2 (dados de exemplo, sem simulação). `?cam=` escolhe a cena
 * (multidao | close | anims | troca | caida | tiro | agachada | jogadora) e `?q=low` a qualidade baixa.
 */
const Scene = dynamic(() => import("./heist-gente-scene"), { ssr: false });
const PRESETS: Preset[] = ["multidao", "close", "anims", "troca", "caida", "tiro", "agachada", "jogadora"];

export default function HeistGenteLab() {
  const [opts, setOpts] = useState<{ preset: Preset; quality: "high" | "low" } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search), cam = q.get("cam") as Preset | null;
    setOpts({ preset: cam && PRESETS.includes(cam) ? cam : "multidao", quality: q.get("q") === "low" ? "low" : "high" });
  }, []);
  return <div style={{ position: "fixed", inset: 0, background: "#07090b" }}>{opts && <Scene preset={opts.preset} quality={opts.quality} />}</div>;
}
