"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { Badge, Button, Chip, Dialog, EmptyState, ErrorState, SkeletonGrid, useToast } from "@/components/ui";
import { FaiCoupon, type Coupon, type CouponRight } from "@/components/coupons/fai-coupon";

interface Mine { pending: CouponRight[]; coupons: Coupon[]; note: string; }

/**
 * Card Trello RF38 — "Meus cupons resgatados" (lookbook do usuário) e os cupons conquistados à espera de decisão:
 * "Parabéns! Deseja resgatar o CUPOM?" → sim → o cupom da marca/celebridade aparece aqui; tocar abre a loja terceira.
 */
export function MyCoupons({ openRight }: { openRight?: string | null }) {
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
        <section aria-label="Cupons conquistados">
          <h2 className="type-h3 mb-2">🎉 Cupons conquistados <Badge tone="mark">{data.pending.length}</Badge></h2>
          <div className="grid gap-3 md:grid-cols-2">{data.pending.map((r) => (
            <div key={r.id} className="surface p-3">
              <p className="type-body font-semibold">{r.question}</p>
              <p className="type-caption text-muted">{r.detail} · {r.source === "SELO" ? "liberado pelo selo do seu look" : "jogo FLAIR completado"}</p>
              <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" onClick={() => setAsk(r)}>Resgatar cupom</Button><Button size="sm" onClick={() => dismiss(r)}>Dispensar</Button></div>
            </div>))}</div>
        </section>
      )}
      <section aria-label="Meus cupons resgatados">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-h3">Meus cupons resgatados</h2>
          <div className="flex gap-1.5">{(["TODOS", "EMITIDO", "USADO", "EXPIRADO"] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "TODOS" ? "Todos" : f === "EMITIDO" ? "Válidos" : f === "USADO" ? "Usados" : "Expirados"}</Chip>)}</div>
        </div>
        <p className="type-caption text-muted mb-3">{data.note} Tocar num cupom válido abre a loja da marca em outra aba.</p>
        {coupons.length === 0 ? <EmptyState title="Nenhum cupom por aqui." hint="Ganhe selos de marcas e celebridades nos seus looks ou complete jogos FLAIR para conquistar cupons." action={<Link className="btn btn-sm" href="/flair?tab=lojas">Ver jogos FLAIR</Link>} /> :
          <div className="grid gap-4 lg:grid-cols-2">{coupons.map((c) => <FaiCoupon key={`${c.source}-${c.id}`} coupon={c} />)}</div>}
      </section>

      <Dialog open={!!ask} onClose={() => setAsk(null)} title="Parabéns! 🎉"
        footer={ask ? <><Button onClick={() => setAsk(null)}>Agora não</Button><Button variant="primary" loading={busy} onClick={() => redeem(ask)}>Sim, resgatar cupom</Button></> : undefined}>
        {ask && <div className="grid gap-3">
          <p className="type-body">{ask.question}</p>
          <FaiCoupon preview coupon={{ source: ask.source, title: ask.title, discount: ask.detail ?? "", owner: ask.owner, accentColor: ask.owner.kind === "CELEBRIDADE" ? "#7B4FD6" : "#1F2A44", storeUrl: ask.owner.storeUrl, origin: ask.source === "SELO" ? "Selo no seu look" : "Jogo FLAIR", expiresAt: null }} />
          <p className="type-caption text-muted">O cupom é da {ask.owner.kind === "CELEBRIDADE" ? "celebridade" : "marca"} e é usado na loja dela, fora do app. Ele fica guardado em Meus cupons resgatados.</p>
        </div>}
      </Dialog>
      <Dialog open={!!issued} onClose={() => setIssued(null)} title="Cupom resgatado" footer={<Button variant="primary" onClick={() => setIssued(null)}>Fechar</Button>}>
        {issued && <><FaiCoupon coupon={issued} /><p className="type-caption text-muted mt-2">Guardado em Meus cupons resgatados, no seu lookbook.</p></>}
      </Dialog>
    </div>
  );
}
