"use client";
import { Suspense, use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { GamePlay } from "@/components/flair/games/game-play";

/** FLAIR › FLAIR 3D MAKE UP › um jogo: bloqueio por nível, cenário (a suíte na série A), vagas, ficha, Hype, efeitos e entrega. */
export default function GamePlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = encodeURIComponent(use(params).slug);   /* vai direto para caminhos da API: nada de "../" vindo da URL */
  return <RequireAuth><Suspense><GamePlay slug={slug} /></Suspense></RequireAuth>;
}
