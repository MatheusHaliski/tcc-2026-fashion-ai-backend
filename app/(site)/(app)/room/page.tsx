"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { mirrorHref } from "@/lib/nav/mirror-href";
import { room3dHref } from "@/lib/atelier/room-3d";

/*
 * O Meu Quarto deixou de ser uma tela: o quarto continua como dados (/api/me/room) e é visto em 3D no Atelier › Quarto.
 * Esta rota só leva os links antigos ao lugar certo:
 *   /room                                  → o quarto em 3D no Atelier (/atelier?tab=room&quarto=3d)
 *   /room?espelho=1[&vestir=X][&vista=2d]  → o Espelho, agora com casa própria (/mirror?vestir=X&vista=2d)
 *   /room?piece=X ("Mostrar no quarto")    → o Guarda-roupa (/closet)
 */
function RoomRedirect() {
  const router = useRouter(); const sp = useSearchParams(); const { t } = useI18n();
  useEffect(() => {
    const to = sp.get("espelho") === "1" ? mirrorHref({ piece: sp.get("vestir"), vista: sp.get("vista") }) : sp.get("piece") ? "/closet" : room3dHref();
    router.replace(to);
  }, [router, sp]);
  // enquanto redireciona: o esqueleto à vista e o "Carregando…" para o leitor de tela (a tela nunca fica em branco)
  return <><Skeleton className="h-64" /><p className="sr-only" role="status">{t("common.loading")}</p></>;
}
export default function RoomPage() { return <Suspense><RoomRedirect /></Suspense>; }
