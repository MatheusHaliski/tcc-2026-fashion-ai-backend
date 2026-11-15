"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";

/**
 * Retorno da entrega do elenco: diz que deu certo e o que a pessoa ganhou (a imagem exclusiva e o número da edição).
 * Antes a única mudança era a etiqueta "edição 1" na arte e o botão desligado. Aparece à vista (rola até ela) e é
 * anunciada a leitores de tela.
 */
export function ElencoDelivered({ nome, edicao }: { nome: string; edicao: number }) {
  const tx = useElencoText();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, []);
  return (
    <div ref={ref} className="surface grid gap-2 p-4" role="status" data-testid="elenco-delivered">
      <p className="type-h3">{tx.t("flair3d.elencos.delivered.title")}</p>
      <p className="type-body">{tx.t("flair3d.elencos.delivered.body", { nome, n: edicao })}</p>
      <div>
        <Link href="/flair/elencos" className="btn btn-sm">{tx.t("flair3d.elencos.delivered.back")}</Link>
      </div>
    </div>
  );
}
