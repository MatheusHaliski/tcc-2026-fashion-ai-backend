"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { mirrorHref } from "@/lib/nav/mirror-href";

/*
 * O Meu Quarto (Quarto 3D) saiu do app em 15/11/2026 (docs/quarto/RETIRADA_DO_QUARTO_3D.md); o ACERVO é o lugar para
 * ver o guarda-roupa em perspectiva. Esta rota só leva os links antigos ao lugar certo:
 *   /room                                  → o ACERVO (/acervo)
 *   /room?espelho=1[&vestir=X][&vista=2d]  → o Espelho (/mirror?vestir=X&vista=2d)
 *   /room?piece=X ("Mostrar no quarto")    → o Guarda-roupa (/closet)
 */
function RoomRedirect() {
  const router = useRouter(); const sp = useSearchParams(); const { t } = useI18n();
  useEffect(() => {
    const to = sp.get("espelho") === "1" ? mirrorHref({ piece: sp.get("vestir"), vista: sp.get("vista") }) : sp.get("piece") ? "/closet" : "/acervo";
    router.replace(to);
  }, [router, sp]);
  // enquanto redireciona: o esqueleto à vista e o "Carregando…" para o leitor de tela (a tela nunca fica em branco)
  return <><Skeleton className="h-64" /><p className="sr-only" role="status">{t("common.loading")}</p></>;
}
export default function RoomPage() { return <Suspense><RoomRedirect /></Suspense>; }
