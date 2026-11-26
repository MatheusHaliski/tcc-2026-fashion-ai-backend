"use client";
import { useEffect, useState } from "react";

/** true em telas largas (padrão: ≥ 1024 px). No servidor e onde não há matchMedia começa (e fica) false. */
export function useWideScreen(query = "(min-width: 1024px)"): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, [query]);
  return wide;
}
