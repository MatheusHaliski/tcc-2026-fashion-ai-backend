"use client";
import { useState } from "react";
import { useToast } from "@/components/ui";
import type { ModeResult } from "@/components/flair/modes-shared";

/** Hook comum dos painéis: executa a jogada, mostra o erro em aviso e guarda o resultado. */
export function usePlay() {
  const toast = useToast(); const [busy, setBusy] = useState(false); const [result, setResult] = useState<ModeResult | null>(null);
  async function play<T = ModeResult>(fn: () => Promise<T>, keep = true): Promise<T | null> {
    setBusy(true);
    try { const r = await fn(); if (keep) setResult(r as unknown as ModeResult); return r; } catch (e) { toast.fromError(e); return null; } finally { setBusy(false); }
  }
  return { busy, result, setResult, play };
}
