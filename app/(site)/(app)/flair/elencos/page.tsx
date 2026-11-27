"use client";
import { RequireAuth } from "@/components/app-shell";
import { ElencoList } from "@/components/flair/elencos/elenco-list";

/** FLAIR › Card Building Challenge: os cinco elencos com o que já foi concluído e a edição. */
export default function ElencosPage() {
  return (
    <RequireAuth>
      <ElencoList />
    </RequireAuth>
  );
}
