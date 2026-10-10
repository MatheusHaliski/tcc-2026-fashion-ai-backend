"use client";

import { useRef } from "react";
import { useToast } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { encodeTryOn, type FittingItem } from "@/lib/tryon/fitting-room";

/** Browser-only export actions, separate from selection, catalog requests and persistence. */
export function useFittingShare(items: FittingItem[], environmentKey: string) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const toast = useToast();
  const { t } = useI18n();

  function snapshot() {
    if (!canvas.current) return;
    try {
      const link = document.createElement("a");
      link.href = canvas.current.toDataURL("image/png");
      link.download = `provador-${environmentKey}.png`;
      link.click();
      toast.success(t("tryOn.foto_salva"));
    } catch {
      toast.info(t("tryOn.foto_indisponivel"));
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/try-on?provar=` + encodeURIComponent(encodeTryOn(items));
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("tryOn.link_copiado"));
    } catch {
      toast.info(url);
    }
  }

  function onCanvas(next: HTMLCanvasElement) {
    canvas.current = next;
  }

  return { onCanvas, snapshot, copyLink };
}
