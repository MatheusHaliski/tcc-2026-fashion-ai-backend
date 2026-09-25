"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import { FaiCoupon, type Coupon, type CouponOwner } from "@/components/coupons/fai-coupon";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

interface Promo {
  source: "SELO" | "FLAIR"; id: string; title: string; kind: string; detail?: string | null; discount: string; seal?: { id: string; name: string } | null;
  active: boolean; status: string; reason?: string | null; redeemed: number; quota?: number | null; pendingRights: number; startsAt?: string | null; endsAt?: string | null; storeUrl?: string | null;
}
interface Admin { owner: CouponOwner; stats: { issued: number; used: number; pendingRights: number; active: number; useRate: number }; coupons: Coupon[]; promotions: Promo[]; }
interface Seal { id: string; name: string; status?: string; tier?: string; }

export const BRAND_PROMO_TYPES = ["DESCONTO_ECOMMERCE", "CUPOM_LOJA", "FRETE_GRATIS", "BRINDE", "ACESSO_ANTECIPADO", "EVENTO"];
export const CELEB_PROMO_TYPES = [...BRAND_PROMO_TYPES, "SHOW", "MEET_GREET", "PRE_VENDA", "CONTEUDO_EXCLUSIVO"];
const TYPE_LABEL: Record<string, string> = { get DESCONTO_ECOMMERCE() { return tr("coupons.brandCouponsTab.desconto_no_e_commerce"); }, get CUPOM_LOJA() { return tr("coupons.brandCouponsTab.cupom_na_loja"); }, get FRETE_GRATIS() { return tr("coupons.brandCouponsTab.frete_gratis"); }, get BRINDE() { return tr("coupons.brandCouponsTab.brinde"); }, get ACESSO_ANTECIPADO() { return tr("coupons.brandCouponsTab.acesso_antecipado"); }, get EVENTO() { return tr("coupons.brandCouponsTab.evento"); }, get SHOW() { return tr("coupons.brandCouponsTab.show"); }, get MEET_GREET() { return tr("coupons.brandCouponsTab.meet_greet"); }, get PRE_VENDA() { return tr("coupons.brandCouponsTab.pre_venda"); }, get CONTEUDO_EXCLUSIVO() { return tr("coupons.brandCouponsTab.conteudo_exclusivo"); }, get COMBINACAO() { return tr("coupons.brandCouponsTab.combinacao_deck"); }, get COLECAO() { return tr("common.colecao_guarda_roupa"); }, get DUELO_PATROCINADO() { return tr("common.duelo_patrocinado"); } };
const STATUS_LABEL: Record<string, string> = { get ATIVA() { return tr("flair.ativa"); }, get FORA_DO_PERIODO() { return tr("coupons.brandCouponsTab.fora_do_periodo"); }, get DESATIVADA() { return tr("coupons.brandCouponsTab.desativada"); }, get REDEEMED() { return tr("coupons.brandCouponsTab.esgotada"); }, get EXPIRED() { return tr("coupons.brandCouponsTab.encerrada"); }, get REVOKED() { return tr("coupons.brandCouponsTab.revogada"); } };

/**
 * Card Trello RF38 — aba "Meus cupons promocionais" do perfil de marca ou celebridade: junta os cupons que QUALQUER
 * funcionalidade concede (política de promoção dos selos do RF25 e jogos FLAIR), os direitos conquistados à espera
 * de resgate, a conferência do código no caixa e a sub-aba "Todas as promoções" (ativas, inativas e criar promoção).
 */
export function BrandCouponsTab({ ownerId, celebrity, onCreateFlair }: { ownerId: string; celebrity: boolean; onCreateFlair: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const admin = useApi<Admin>((signal) => api.get("/api/me/coupons/admin", { signal }), []);
  const seals = useApi<Seal[]>((signal) => api.get(`/api/users/${ownerId}/seals`, { signal }), [ownerId]);
  const [sub, setSub] = useState<"emitidos" | "promocoes">("emitidos");
  const [promoFilter, setPromoFilter] = useState<"ATIVAS" | "INATIVAS">("ATIVAS");
  const [code, setCode] = useState(""); const [checked, setChecked] = useState<Coupon | null>(null);
  const [chooser, setChooser] = useState(false);
  const empty = { open: false, id: undefined as string | undefined, type: "DESCONTO_ECOMMERCE", title: "", description: "", rules: "", discountPercent: "", sealId: "", startsAt: "", expiresAt: "", totalQuota: "", perUserLimit: "1", storeUrl: "" };
  const [form, setForm] = useState(empty);
  if (admin.error) return <ErrorState error={admin.error} onRetry={admin.reload} />;
  if (admin.loading || !admin.data) return <Skeleton className="h-64" />;
  const d = admin.data;
  async function validate() {
    try { setChecked(await api.post<Coupon>("/api/me/coupons/validate", { code })); setCode(""); admin.reload(); } catch (e) { toast.fromError(e); }
  }
  async function savePromo() {
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const body = { type: form.type, title: form.title, description: form.description || null, rules: form.rules || null, discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
      sealId: form.sealId || null, startsAt: iso(form.startsAt), expiresAt: iso(form.expiresAt), totalQuota: form.totalQuota ? Number(form.totalQuota) : null, perUserLimit: Number(form.perUserLimit || 1), storeUrl: form.storeUrl || null };
    try { if (form.id) await api.put(`/api/promotions/${form.id}`, body); else await api.post("/api/promotions", body); toast.success(t("coupons.brandCouponsTab.promocao_salva_quem_tiver_o")); setForm(empty); admin.reload(); } catch (e) { toast.fromError(e); }
  }
  async function toggleSeal(p: Promo) {
    try { await api.put(`/api/promotions/${p.id}/status`, { status: p.active ? "REVOKED" : "AVAILABLE" }); admin.reload(); } catch (e) { toast.fromError(e); }
  }
  const promos = d.promotions.filter((p) => (promoFilter === "ATIVAS" ? p.active : !p.active));
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="type-caption text-muted">{t("common.cupons_emitidos")}</p><p className="type-h2 tabular">{d.stats.issued}</p></Card>
        <Card><p className="type-caption text-muted">{t("coupons.brandCouponsTab.usados_na_loja")}</p><p className="type-h2 tabular">{d.stats.used} <span className="type-caption text-muted">({d.stats.useRate}%)</span></p></Card>
        <Card><p className="type-caption text-muted">{t("coupons.brandCouponsTab.conquistados_aguardando_resgate")}</p><p className="type-h2 tabular">{d.stats.pendingRights}</p></Card>
        <Card><p className="type-caption text-muted">{t("coupons.brandCouponsTab.promocoes_ativas")}</p><p className="type-h2 tabular">{d.stats.active}</p></Card>
      </div>
      <Tabs tabs={[{ id: "emitidos" as const, label: t("common.cupons_emitidos"), count: d.coupons.length }, { id: "promocoes" as const, label: t("coupons.brandCouponsTab.todas_as_promocoes"), count: d.promotions.length }]} value={sub} onChange={setSub} />

      {sub === "emitidos" && <>
        <Card>
          <p className="label">{t("coupons.brandCouponsTab.conferir_codigo_no_caixa_selo")}</p>
          <div className="flex flex-wrap gap-2"><Input className="max-w-xs" aria-label={t("common.codigo_do_cupom")} placeholder={t("coupons.brandCouponsTab.flr_xxxx_xxxx_ou_codigo")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><Button onClick={validate} disabled={code.trim().length < 6}>{t("coupons.brandCouponsTab.validar_e_marcar_como_usado")}</Button></div>
        </Card>
        {d.coupons.length === 0 ? <EmptyState title={t("coupons.brandCouponsTab.nenhum_cupom_emitido_ainda")} hint={t("coupons.brandCouponsTab.quando_alguem_conquista_uma_promocao")} /> :
          <div className="grid gap-4 lg:grid-cols-2">{d.coupons.map((c) => (
            <div key={`${c.source}-${c.id}`}>
              <FaiCoupon coupon={{ ...c, storeUrl: null }} compact />
              <p className="type-caption text-muted mt-1">{t("coupons.brandCouponsTab.resgatado_por", { value: c.holder ? `@${c.holder.username}` : "—", value2: c.issuedAt ? t("coupons.brandCouponsTab.em", { toLocaleDateString: new Date(c.issuedAt).toLocaleDateString(currentIntl()) }) : "" })}</p>
            </div>))}</div>}
      </>}

      {sub === "promocoes" && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5"><Chip active={promoFilter === "ATIVAS"} onClick={() => setPromoFilter("ATIVAS")}>{t("coupons.brandCouponsTab.ativas")}{d.promotions.filter((p) => p.active).length})</Chip><Chip active={promoFilter === "INATIVAS"} onClick={() => setPromoFilter("INATIVAS")}>{t("coupons.brandCouponsTab.inativas")}{d.promotions.filter((p) => !p.active).length})</Chip></div>
          <Button variant="primary" onClick={() => setChooser(true)}>{t("coupons.brandCouponsTab.criar_promocao")}</Button>
        </div>
        {promos.length === 0 ? <EmptyState title={promoFilter === "ATIVAS" ? t("common.nenhuma_promocao_ativa") : t("coupons.brandCouponsTab.nenhuma_promocao_inativa")} /> :
          <div className="grid gap-3 md:grid-cols-2">{promos.map((p) => (
            <Card key={`${p.source}-${p.id}`}>
              <div className="flex flex-wrap items-center gap-1.5"><Badge tone={p.source === "SELO" ? "chalk" : "thread"}>{p.source === "SELO" ? t("coupons.brandCouponsTab.selo_rf25") : t("common.jogo_flair")}</Badge><Badge>{TYPE_LABEL[p.kind] ?? label(p.kind.toLowerCase())}</Badge><Badge tone={p.active ? "thread" : "mark"}>{STATUS_LABEL[p.status] ?? p.status}</Badge></div>
              <p className="type-h3 mt-2">{p.title}</p>
              {p.detail && <p className="type-body-sm text-muted">{p.detail}</p>}
              <p className="type-body-sm mt-1"><b>{p.discount}</b>{p.seal ? t("coupons.brandCouponsTab.exige_o_selo", { name: p.seal.name }) : ""}</p>
              <p className="type-caption text-faint mt-1">{t("coupons.brandCouponsTab.resgate_s_aguardando_resgate", { redeemed: p.redeemed, value: p.quota ? t("coupons.brandCouponsTab.de", { quota: p.quota }) : "", pendingRights: p.pendingRights, value2: p.endsAt ? t("coupons.brandCouponsTab.ate", { toLocaleDateString: new Date(p.endsAt).toLocaleDateString(currentIntl()) }) : "", value3: p.storeUrl ? t("coupons.brandCouponsTab.loja_propria_do_cupom") : "" })}</p>
              {p.reason && !p.active && <p className="type-caption text-mark mt-1">{p.reason}</p>}
              <div className="mt-2 flex gap-2">{p.source === "SELO" ? <Button size="sm" onClick={() => toggleSeal(p)}>{p.active ? t("common.desativar") : t("common.reativar")}</Button> : <Button size="sm" onClick={onCreateFlair}>{t("coupons.brandCouponsTab.gerenciar_no_flair")}</Button>}</div>
            </Card>))}</div>}
      </>}

      <Dialog open={chooser} onClose={() => setChooser(false)} title={t("coupons.brandCouponsTab.criar_promocao")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="surface p-3 text-left hover:ring-2 hover:ring-thread" onClick={() => { setChooser(false); setForm({ ...empty, open: true, type: "DESCONTO_ECOMMERCE" }); }}>
            <p className="type-h3">{t("coupons.brandCouponsTab.politica_de_promocao_do_selo")}</p><p className="type-body-sm text-muted">{t("coupons.brandCouponsTab.formulario_do_rf25_quem_ganhar")}</p></button>
          <button type="button" className="surface p-3 text-left hover:ring-2 hover:ring-thread" onClick={() => { setChooser(false); onCreateFlair(); }}>
            <p className="type-h3">{t("common.jogo_flair")}</p><p className="type-body-sm text-muted">{t("coupons.brandCouponsTab.defina_a_combinacao_de_cartas")}</p></button>
        </div>
      </Dialog>
      <Dialog open={form.open} onClose={() => setForm(empty)} size="lg" title={form.id ? t("coupons.brandCouponsTab.editar_promocao_do_selo") : t("coupons.brandCouponsTab.nova_promocao_do_selo_rf25")}
        footer={<><Button onClick={() => setForm(empty)}>{t("common.cancel")}</Button><Button variant="primary" onClick={savePromo} disabled={form.title.trim().length < 3}>{t("common.save")}</Button></>}>
        <div className="grid gap-3">
          <Field label={t("coupons.brandCouponsTab.selo_que_libera_o_cupom")} id="pp-seal" hint={t("coupons.brandCouponsTab.quem_ganhar_este_selo_num")}><Select id="pp-seal" value={form.sealId} onChange={(e) => setForm({ ...form, sealId: e.target.value })}><option value="">{t("coupons.brandCouponsTab.qualquer_selo_ativo_meu")}</option>{(seals.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.status && s.status !== "ACTIVE" ? ` (${s.status})` : ""}</option>)}</Select></Field>
          <Field label={t("common.tipo")} id="pp-type"><Select id="pp-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{(celebrity ? CELEB_PROMO_TYPES : BRAND_PROMO_TYPES).map((x) => <option key={x} value={x}>{TYPE_LABEL[x]}</option>)}</Select></Field>
          <Field label={t("coupons.brandCouponsTab.titulo_do_cupom")} id="pp-title" required><Input id="pp-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("coupons.brandCouponsTab.n20_na_nova_colecao")} /></Field>
          <Field label={t("common.descricao")} id="pp-desc"><Textarea id="pp-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("common.desconto")} id="pp-pct"><Input id="pp-pct" type="number" min={1} max={90} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>
            <Field label={t("coupons.brandCouponsTab.estoque_total")} id="pp-q" hint={t("common.vazio_ilimitado")}><Input id="pp-q" type="number" min={1} value={form.totalQuota} onChange={(e) => setForm({ ...form, totalQuota: e.target.value })} /></Field>
            <Field label={t("coupons.brandCouponsTab.por_pessoa")} id="pp-u"><Input id="pp-u" type="number" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("coupons.brandCouponsTab.comeca_em")} id="pp-s"><Input id="pp-s" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
            <Field label={t("coupons.brandCouponsTab.termina_em")} id="pp-e"><Input id="pp-e" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
          </div>
          <Field label={t("common.link_da_loja_onde_o")} id="pp-url" hint={t("common.opcional_sem_ele_vale_o")}><Input id="pp-url" type="url" placeholder="https://" value={form.storeUrl} onChange={(e) => setForm({ ...form, storeUrl: e.target.value })} /></Field>
          <Field label={t("common.regras")} id="pp-rules"><Textarea id="pp-rules" rows={2} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></Field>
        </div>
      </Dialog>
      <Dialog open={!!checked} onClose={() => setChecked(null)} title={t("coupons.brandCouponsTab.cupom_conferido")} footer={<Button variant="primary" onClick={() => setChecked(null)}>{t("common.close")}</Button>}>
        {checked && <><FaiCoupon coupon={{ ...checked, storeUrl: null }} /><p className="type-caption text-muted mt-2">{t("coupons.brandCouponsTab.marcado_como_usado", { value: checked.holder ? t("coupons.brandCouponsTab.cliente", { username: checked.holder.username }) : "" })}</p></>}
      </Dialog>
    </div>
  );
}
