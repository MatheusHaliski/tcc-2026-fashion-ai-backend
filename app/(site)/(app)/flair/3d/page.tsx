"use client";
import { RequireAuth } from "@/components/app-shell";
import { NucleoList } from "@/components/flair/nucleos/nucleo-list";

/** FLAIR › FLAIR 3D › núcleos: os 15 núcleos (base de cada modalidade) com número, nome e recursos. */
export default function NucleosPage() {
  return (
    <RequireAuth>
      <NucleoList />
    </RequireAuth>
  );
}
