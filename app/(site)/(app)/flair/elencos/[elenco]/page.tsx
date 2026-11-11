"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { ElencoScreen } from "@/components/flair/elencos/elenco-screen";

/** FLAIR › Card Building Challenge › um elenco: quebra-cabeça, tabuleiro, química, requisitos e entrega. */
export default function ElencoPage({ params }: { params: Promise<{ elenco: string }> }) {
  const { elenco } = use(params);
  return (
    <RequireAuth>
      <ElencoScreen elenco={elenco} />
    </RequireAuth>
  );
}
