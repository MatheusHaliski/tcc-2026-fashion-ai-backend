"use client";
import { useEffect } from "react";
import { isChunkLoadError, reloadOnceForChunk } from "@/lib/chunk-recovery";

/** Pedaço de script ausente depois de um deploy (erro fora de um componente): recarrega a página uma vez. */
export function ChunkRecovery() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (isChunkLoadError(e.error ?? e.message)) reloadOnceForChunk(); };
    const onRejection = (e: PromiseRejectionEvent) => { if (isChunkLoadError(e.reason)) reloadOnceForChunk(); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
