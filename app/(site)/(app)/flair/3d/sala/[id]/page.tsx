"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { SalaTela } from "@/components/flair/multi/sala-tela";

/** FLAIR › FLAIR 3D › sala multiplayer: convite, jogo por turnos ou com a mesma semente, resultado e revanche. */
export default function SalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <SalaTela id={id} />
    </RequireAuth>
  );
}
