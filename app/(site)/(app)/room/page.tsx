"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { mirrorHref } from "@/lib/nav/mirror-href";

/*
 * O Meu Quarto deixou de ser uma tela: o quarto continua como dados (/api/me/room) e como cenário dos jogos da Suíte de
 * Vidro (Glass Empire, série A). Esta rota só leva os links antigos ao lugar certo:
 *   /room                                  → catálogo de jogos da Suíte (/flair/jogos?district=SUITE)
 *   /room?espelho=1[&vestir=X][&vista=2d]  → o Espelho, agora com casa própria (/mirror?vestir=X&vista=2d)
 *   /room?piece=X ("Mostrar no quarto")    → o Guarda-roupa (/closet)
 */
function RoomRedirect() {
  const router = useRouter(); const sp = useSearchParams(); const { t } = useI18n();
  useEffect(() => {
    const to = sp.get("espelho") === "1" ? mirrorHref({ piece: sp.get("vestir"), vista: sp.get("vista") }) : sp.get("piece") ? "/closet" : "/flair/jogos?district=SUITE";
    router.replace(to);
  }, [router, sp]);
  // enquanto redireciona: o esqueleto à vista e o "Carregando…" para o leitor de tela (a tela nunca fica em branco)
  return <><Skeleton className="h-64" /><p className="sr-only" role="status">{t("common.loading")}</p></>;
}
export default function RoomPage() { return <Suspense><RoomRedirect /></Suspense>; }
