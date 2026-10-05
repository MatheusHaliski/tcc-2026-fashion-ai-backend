"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { LensCapture } from "@/components/lens/lens-capture";

/**
 * FashionAI Lens (RF54) — captura: Câmera · Galeria · Recentes. Closet-first: antes de "onde encontro?", o Lens
 * mostra o que a pessoa já tem. Os rostos são borrados no aparelho antes do envio.
 */
export default function LensPage() {
  return <RequireAuth><Suspense fallback={null}><LensCapture /></Suspense></RequireAuth>;
}
