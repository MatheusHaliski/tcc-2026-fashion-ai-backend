"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { MakeUpScreen } from "@/components/flair/make-up/makeup-screen";

/** FLAIR › FLAIR 3D MAKE UP › um brief: provador 3D, Roupas e Maquiagem, comandos e entrega. */
export default function MakeUpBriefPage({ params }: { params: Promise<{ brief: string }> }) {
  const { brief } = use(params);
  return (
    <RequireAuth>
      <MakeUpScreen brief={brief} />
    </RequireAuth>
  );
}
