"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { MyCoupons } from "@/components/coupons/my-coupons";

/** Card Trello RF38 — destino da notificação "Parabéns! Deseja resgatar o CUPOM?" e atalho para os cupons resgatados. */
function CouponsInner() {
  const sp = useSearchParams();
  return (
    <>
      <PageHeader kicker="RF38" title="Meus cupons" lead="Cupons Fashion AI conquistados com selos nos seus looks e com jogos FLAIR. Use o código na loja da marca, fora do app."
        actions={<Link href="/lookbook?tab=cupons" className="btn btn-sm">Ver no lookbook</Link>} />
      <MyCoupons openRight={sp.get("right")} />
    </>
  );
}
export default function CouponsPage() { return <RequireAuth><Suspense><CouponsInner /></Suspense></RequireAuth>; }
