"use client";
import { Suspense, use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { CbcPlay } from "@/components/flair/cbc";

/** FLAIR › Desafio de Montagem: o cenário com as vagas, o banco de cartas, conferir e entregar. */
export default function CbcPlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = encodeURIComponent(use(params).slug);   /* vai direto para caminhos da API: nada de "../" vindo da URL */
  return <RequireAuth><Suspense><CbcPlay slug={slug} /></Suspense></RequireAuth>;
}
