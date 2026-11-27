"use client";

import { RequireAuth } from "@/components/app-shell";
import { AcervoApp } from "@/components/acervo/acervo-app";

/** ACERVO — o guarda-roupa como espaço navegável (docs/acervo/ACERVO.md). Privado da dona das peças. */
export default function AcervoPage() {
  return <RequireAuth><AcervoApp /></RequireAuth>;
}
