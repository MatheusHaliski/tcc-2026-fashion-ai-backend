"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";

/** FLAIR › FLAIR 3D › um núcleo: deck, cena 3D, janela de recursos, objetivo, comandos e entrega. */
export default function NucleoPage({ params }: { params: Promise<{ nucleo: string }> }) {
  const { nucleo } = use(params);
  return (
    <RequireAuth>
      <NucleoScreen nucleo={nucleo} />
    </RequireAuth>
  );
}
