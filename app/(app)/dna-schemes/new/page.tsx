"use client";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { DnaBuilder } from "@/components/dna-builder";

export default function NewDnaSchemePage() {
  return <RequireAuth><PageHeader title="Criar DNA de estilo" kicker="RF13 · RF11" lead="Mesmo fluxo do RF5: o que muda é o esquema criado — um DNA de estilo que conta uma história com 2 a 6 esquemas seus." /><DnaBuilder /></RequireAuth>;
}
