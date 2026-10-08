"use client";

import { useEffect, useRef, useState } from "react";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import type { SavedTry } from "@/lib/tryon/fitting-room-model";
import { read, write, SAVED_KEY } from "@/lib/tryon/fitting-room-storage";

/** Local saved fittings, loaded once the user's fitting room is ready. */
export function useSavedTries(enabled: boolean) {
  const [saved, setSaved] = useState<SavedTry[]>([]);
  const loaded = useRef(false);
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    setSaved(read<SavedTry[]>("local", SAVED_KEY, []));
  }, [enabled]);

  function save(title: string, items: FittingItem[]) {
    const next = [{ id: `${Date.now()}`, title, items, createdAt: Date.now() }, ...saved].slice(0, 8);
    setSaved(next);
    write("local", SAVED_KEY, next);
  }

  function remove(id: string) {
    const next = saved.filter((item) => item.id !== id);
    setSaved(next);
    write("local", SAVED_KEY, next);
  }

  return { saved, save, remove };
}
