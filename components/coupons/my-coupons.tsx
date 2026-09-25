"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { Badge, Button, Chip, Dialog, EmptyState, ErrorState, SkeletonGrid, useToast } from "@/components/ui";
import { FaiCoupon, type Coupon, type CouponRight } from "@/components/coupons/fai-coupon";
import { useI18n } from "@/lib/i18n/i18n";

interface Mine { pending: CouponRight[]; coupons: Coupon[]; note: string; }

/**
 * Card Trello RF38 — "Meus cupons resgatados" (lookbook do usuário) e os cupons conquistados à espera de decisão:
 * "Parabéns! Deseja resgatar o CUPOM?" → sim → o cupom da marca/celebridade aparece aqui; tocar abre a loja terceira.
 */
export function MyCoupons({ openRight }: { openRight?: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<Mine>((signal) => api.get("/api/me/coupons", { signal }), []);
  const [ask, setAsk] = useState<CouponRight | null>(null); const [busy, setBusy] = useState(false); const [issued, setIssued] = useState<Coupon | null>(null);
  const [filter, setFilter] = useState<"TODOS" | "EMITIDO" | "USADO" | "EXPIRADO">("TODOS");
  useEffect(() => { if (openRight && data) { const r = data.pending.find((x) => x.id === openRight); if (r) setAsk(r); } }, [openRight, data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <SkeletonGrid n={3} h="h-40" />;
  async function redeem(r: CouponRight) {
    setBusy(true);
    try { const c = await api.post<Coupon>(`/api/me/coupon-rights/${r.id}/redeem`); setAsk(null); setIssued(c); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function dismiss(r: CouponRight) {
    try { await api.post(`/api/me/coupon-rights/${r.id}/dismiss`); setAsk(null); reload(); } catch (e) { toast.fromError(e); }
  }
  const coupons = data.coupons.filter((c) => filter === "TODOS" || c.status === filter);
  return (
    <div className="grid gap-4">
      {data.pending.length > 0 && (
        <section aria-label={t("coupons.myCoupons.cupons_conquistados")}>
          <h2 className="type-h3 mb-2">{t("coupons.myCoupons.cupons_conquistados_2")}{" "}<Badge tone="mark">{data.pending.length}</Badge></h2>
          <div className="grid gap-3 md:grid-cols-2">{data.pending.map((r) => (
            <div key={r.id} className="surface p-3">
              <p className="type-body font-semibold">{r.question}</p>
              <p className="type-caption text-muted">{r.detail} · {r.source === "SELO" ? t("coupons.myCoupons.liberado_pelo_selo_do_seu") : t("coupons.myCoupons.jogo_flair_completado")}</p>
              <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" onClick={() => setAsk(r)}>{t("coupons.myCoupons.resgatar_cupom")}</Button><Button size="sm" onClick={() => dismiss(r)}>{t("coupons.myCoupons.dispensar")}</Button></div>
            </div>))}</div>
        </section>
      )}
      <section aria-label={t("common.meus_cupons_resgatados")}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-h3">{t("common.meus_cupons_resgatados")}</h2>
          <div className="flex gap-1.5">{(["TODOS", "EMITIDO", "USADO", "EXPIRADO"] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "TODOS" ? t("common.all") : f === "EMITIDO" ? t("coupons.myCoupons.validos") : f === "USADO" ? t("coupons.myCoupons.usados") : t("coupons.myCoupons.expirados")}</Chip>)}</div>
        </div>
        <p className="type-caption text-muted mb-3">{t("coupons.myCoupons.tocar_num_cupom_valido_abre", { note: data.note })}</p>
        {coupons.length === 0 ? <EmptyState title={t("coupons.myCoupons.nenhum_cupom_por_aqui")} hint={t("coupons.myCoupons.ganhe_selos_de_marcas_e")} action={<Link className="btn btn-sm" href="/flair?tab=lojas">{t("coupons.myCoupons.ver_jogos_flair")}</Link>} /> :
          <div className="grid gap-4 lg:grid-cols-2">{coupons.map((c) => <FaiCoupon key={`${c.source}-${c.id}`} coupon={c} />)}</div>}
      </section>

      <Dialog open={!!ask} onClose={() => setAsk(null)} title={t("coupons.myCoupons.parabens")}
        footer={ask ? <><Button onClick={() => setAsk(null)}>{t("coupons.myCoupons.agora_nao")}</Button><Button variant="primary" loading={busy} onClick={() => redeem(ask)}>{t("coupons.myCoupons.sim_resgatar_cupom")}</Button></> : undefined}>
        {ask && <div className="grid gap-3">
          <p className="type-body">{ask.question}</p>
          <FaiCoupon preview coupon={{ source: ask.source, title: ask.title, discount: ask.detail ?? "", owner: ask.owner, accentColor: ask.owner.kind === "CELEBRIDADE" ? "#7B4FD6" : "#1F2A44", storeUrl: ask.owner.storeUrl, origin: ask.source === "SELO" ? t("coupons.myCoupons.selo_no_seu_look") : t("common.jogo_flair"), expiresAt: null }} />
          <p className="type-caption text-muted">{t("coupons.myCoupons.o_cupom_e_da_e", { value: ask.owner.kind === "CELEBRIDADE" ? t("coupons.myCoupons.celebridade") : t("coupons.myCoupons.marca") })}</p>
        </div>}
      </Dialog>
      <Dialog open={!!issued} onClose={() => setIssued(null)} title={t("coupons.myCoupons.cupom_resgatado")} footer={<Button variant="primary" onClick={() => setIssued(null)}>{t("common.close")}</Button>}>
        {issued && <><FaiCoupon coupon={issued} /><p className="type-caption text-muted mt-2">{t("coupons.myCoupons.guardado_em_meus_cupons_resgatados")}</p></>}
      </Dialog>
    </div>
  );
}
