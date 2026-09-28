"use client";
import { use } from "react";
import { ExpandedScheme } from "@/components/expanded-card";

/**
 * Look ampliado (RF7.CA07/CA11): a página é o próprio card ampliado — criador no cabeçalho, dados, peças com borda,
 * ações do post e os botões no fim, tudo dentro da borda do card. Nada fora dele.
 */
export default function SchemePage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);   /* vai direto para caminhos da API: nada de "../" vindo da URL */
  return <div className="expanded-page"><ExpandedScheme id={id} /></div>;
}
