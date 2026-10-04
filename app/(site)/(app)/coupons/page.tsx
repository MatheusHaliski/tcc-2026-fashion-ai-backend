"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { MyCoupons } from "@/components/coupons/my-coupons";
import { useI18n } from "@/lib/i18n/i18n";

/** Card Trello RF38 — destino da notificação "Parabéns! Deseja resgatar o CUPOM?" e atalho para os cupons resgatados. */
function CouponsInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  return (
    <>
      <PageHeader kicker="RF38" title={t("coupons.meus_cupons")} lead={t("coupons.cupons_fashion_ai_conquistados_com")} />
      <MyCoupons openRight={sp.get("right")} />
    </>
  );
}
export default function CouponsPage() { return <RequireAuth><Suspense><CouponsInner /></Suspense></RequireAuth>; }
