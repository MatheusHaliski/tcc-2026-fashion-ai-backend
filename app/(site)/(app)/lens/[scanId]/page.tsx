"use client";
import { Suspense, use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { LensResult } from "@/components/lens/lens-result";

/**
 * FashionAI Lens (RF54) — resultado de um scan: imagem com hotspots, Foco (?focus=) e as abas (?tab=) Leitura · Seu
 * guarda-roupa · Recriar · Estilo & Hype · Descobrir. O scan é só do dono (qualquer outra pessoa recebe 404).
 */
export default function LensScanPage({ params }: { params: Promise<{ scanId: string }> }) {
  const scanId = String(use(params).scanId ?? "");
  return <RequireAuth><Suspense fallback={null}><LensResult key={scanId} scanId={scanId} /></Suspense></RequireAuth>;
}
