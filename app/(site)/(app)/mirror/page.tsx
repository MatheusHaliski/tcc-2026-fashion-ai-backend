"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/app-shell";
import { Skeleton } from "@/components/ui";
import { mirrorHref } from "@/lib/nav/mirror-href";

/*
 * O Espelho (RF28) vive dentro do Meu Quarto: o personagem vai até o espelho e a prova abre ali mesmo. Esta rota só leva
 * os links antigos ao quarto — /mirror, /mirror?piece=<id> (vestir a peça) e /mirror?vista=2d (prévia 2D).
 */
function MirrorRedirect() {
  const router = useRouter(); const sp = useSearchParams();
  useEffect(() => { router.replace(mirrorHref({ piece: sp.get("piece"), vista: sp.get("vista") })); }, [router, sp]);
  return <Skeleton className="h-64" />;
}
export default function MirrorPage() { return <RequireAuth><Suspense><MirrorRedirect /></Suspense></RequireAuth>; }
