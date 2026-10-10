"use client";
import { Suspense, use } from "react";
import { MomentPage } from "@/components/moments/moment-page";

/** Um Momento = dados; a página é genérica (§52). O id pode ser o UUID ou o slug (halloween-2026). */
export default function MomentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);   /* vai direto para caminhos da API: nada de "../" vindo da URL */
  return <Suspense><MomentPage idOrSlug={id} /></Suspense>;
}
