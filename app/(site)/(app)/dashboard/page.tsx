"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useIssuerReview } from "@/components/issuer-review";
import { RequireAuth } from "@/components/app-shell";
import { ErrorState, Skeleton } from "@/components/ui";

/** Links antigos do painel levam à gestão no próprio perfil, sem duplicar o dashboard. */
function IssuerProfileRedirect() {
  const { user } = useAuth(); const router = useRouter();
  const issuer = user?.profileType === "MARCA" || user?.profileType === "CELEBRIDADE";
  const review = useIssuerReview(issuer);
  useEffect(() => {
    if (!issuer) { router.replace("/lookbook"); return; }
    if (!review.data) return;
    const target = review.data.slug ?? user?.id;
    const tab = review.data.status === "APROVADO" ? "METRICAS" : "CENTRAL";
    router.replace(`/brands/${encodeURIComponent(target ?? "")}?tab=${tab}`);
  }, [issuer, review.data, user?.id, router]);
  if (review.error) return <ErrorState error={review.error} onRetry={review.reload} />;
  return <Skeleton className="h-64" />;
}
export default function IssuerDashboardPage() { return <RequireAuth><IssuerProfileRedirect /></RequireAuth>; }
