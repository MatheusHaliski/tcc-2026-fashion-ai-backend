"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { label, useTaxonomy, CATEGORY_LABEL } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea, useToast, ChipMultiSelect } from "@/components/ui";
import { couponText, GAME_TYPE_LABEL, VoucherDialog, type Combination, type Voucher } from "@/components/flair/flair-shared";
import { useI18n } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

interface Tab { admin: boolean; brandName: string; participating: boolean; combinations: Combination[]; redemptions?: Voucher[]; stats?: { issued: number; used: number }; gameTypes?: { id: string; label: string }[]; }
interface Form {
  id?: string; name: string; description: string; gameType: string; requiredCategories: string[]; requiredStyles: string[]; requiredOccasions: string[];
  minBrandPieces: string; minDeckPower: string; minRarity: string; minWins: string; couponTitle: string; discountKind: "percent" | "amount"; discount: string;
  minPurchase: string; validDays: string; stock: string; active: boolean; accentColor: string; storeUrl: string;
}
const EMPTY: Form = { name: "", description: "", gameType: "COMBINACAO", requiredCategories: [], requiredStyles: [], requiredOccasions: [], minBrandPieces: "1", minDeckPower: "0", minRarity: "",
  minWins: "2", couponTitle: "", discountKind: "percent", discount: "10", minPurchase: "", validDays: "30", stock: "100", active: true, accentColor: "#2D55C9", storeUrl: "" };

/**
 * RF14/RF22 — aba "Minhas combinações FLAIR" do perfil da loja: a loja participante define qual combinação de cartas
 * (categorias, estilos, ocasiões, peças da marca, poder, raridade ou vitórias) completa o jogo e qual cupom entrega;
 * acompanha os cupons emitidos e confere o código no caixa. Para visitantes, a aba mostra as combinações ativas.
 */
export function BrandFlairTab({ slug, autoNew = 0 }: { slug: string; autoNew?: number }) {
  const { rich, t } = useI18n();
  const { user } = useAuth(); const toast = useToast(); const tax = useTaxonomy();
  const tab = useApi<Tab>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/flair`, { signal, anonymous: !user }), [slug, !!user]);
  const [form, setForm] = useState<Form | null>(null); const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(""); const [validated, setValidated] = useState<Voucher | null>(null);
  useEffect(() => { if (autoNew > 0) setForm({ ...EMPTY }); }, [autoNew]);
  if (tab.error) return <ErrorState error={tab.error} onRetry={tab.reload} />;
  if (tab.loading || !tab.data) return <Skeleton className="h-64" />;
  const d = tab.data;
  if (!d.participating) return <EmptyState title={t("flair.brandFlairTab.este_perfil_nao_participa_do")} hint={t("flair.brandFlairTab.so_marcas_e_celebridades_publicam")} />;

  const edit = (c: Combination) => setForm({
    id: c.id, name: c.name, description: c.description ?? "", gameType: c.gameType, requiredCategories: c.requiredCategories, requiredStyles: c.requiredStyles, requiredOccasions: c.requiredOccasions,
    minBrandPieces: String(c.minBrandPieces), minDeckPower: String(c.minDeckPower), minRarity: c.minRarity ?? "", minWins: String(c.minWins || 2), couponTitle: c.coupon.title,
    discountKind: c.coupon.discountPercent !== "" ? "percent" : "amount", discount: String(c.coupon.discountPercent !== "" ? c.coupon.discountPercent : c.coupon.discountAmount),
    minPurchase: c.coupon.minPurchase === "" ? "" : String(c.coupon.minPurchase), validDays: String(c.coupon.validDays), stock: c.stock == null ? "" : String(c.stock), active: c.active, accentColor: c.accentColor, storeUrl: (c as Combination & { storeUrl?: string | null }).storeUrl ?? "",
  });
  async function save() {
    if (!form) return;
    setSaving(true);
    const n = (v: string) => (v.trim() === "" ? null : Number(v));
    const body = { name: form.name, description: form.description || null, gameType: form.gameType, requiredCategories: form.requiredCategories, requiredStyles: form.requiredStyles,
      requiredOccasions: form.requiredOccasions, minBrandPieces: n(form.minBrandPieces), minDeckPower: n(form.minDeckPower), minRarity: form.minRarity || null, minWins: n(form.minWins),
      couponTitle: form.couponTitle, discountPercent: form.discountKind === "percent" ? n(form.discount) : null, discountAmount: form.discountKind === "amount" ? n(form.discount) : null,
      minPurchase: n(form.minPurchase), validDays: n(form.validDays), stock: n(form.stock), active: form.active, accentColor: form.accentColor, storeUrl: form.storeUrl || null };
    try {
      if (form.id) await api.put(`/api/flair/brand/combinations/${form.id}`, body); else await api.post("/api/flair/brand/combinations", body);
      toast.success(t("flair.brandFlairTab.combinacao_salva")); setForm(null); tab.reload();
    } catch (e) { toast.fromError(e); } finally { setSaving(false); }
  }
  async function remove(c: Combination) {
    try { await api.delete(`/api/flair/brand/combinations/${c.id}`); toast.success(c.redeemed > 0 ? t("flair.brandFlairTab.combinacao_desativada_os_cupons_emitidos") : t("flair.brandFlairTab.combinacao_removida")); tab.reload(); } catch (e) { toast.fromError(e); }
  }
  async function validate() {
    try { const v = await api.post<Voucher>("/api/flair/brand/redemptions/validate", { code }); setValidated(v); setCode(""); tab.reload(); } catch (e) { toast.fromError(e); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-body-sm text-muted max-w-2xl">{d.admin
          ? t("flair.brandFlairTab.defina_qual_combinacao_de_cartas")
          : t("flair.brandFlairTab.complete_uma_destas_combinacoes_no", { brandName: d.brandName })}</p>
        {d.admin ? <Button variant="primary" onClick={() => setForm({ ...EMPTY })}>{t("flair.brandFlairTab.nova_combinacao")}</Button> : <Link className="btn btn-sm btn-primary" href="/flair?tab=lojas">{t("flair.brandFlairTab.jogar_no_flair")}</Link>}
      </div>
      {d.admin && d.stats && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card><p className="type-caption text-muted">{t("common.cupons_emitidos")}</p><p className="type-h2 tabular">{d.stats.issued}</p></Card>
          <Card><p className="type-caption text-muted">{t("flair.brandFlairTab.cupons_usados_no_caixa")}</p><p className="type-h2 tabular">{d.stats.used}</p></Card>
          <Card><p className="label">{t("flair.brandFlairTab.conferir_codigo_no_caixa")}</p><div className="flex gap-2"><Input aria-label={t("common.codigo_do_cupom")} placeholder="FLR-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><Button onClick={validate} disabled={code.trim().length < 8}>{t("flair.brandFlairTab.validar")}</Button></div></Card>
        </div>
      )}
      {d.combinations.length === 0 ? <EmptyState title={d.admin ? t("flair.brandFlairTab.nenhuma_combinacao_ainda") : t("flair.brandFlairTab.nenhuma_combinacao_ativa")} hint={d.admin ? t("flair.brandFlairTab.crie_a_primeira_ex_parte") : undefined} /> :
        <div className="grid gap-4 md:grid-cols-2">{d.combinations.map((c) => (
          <Card key={c.id} pad={false} className="overflow-hidden">
            <div className="flair-combo-head" style={{ background: c.accentColor }}>
              <p className="type-caption opacity-90">{GAME_TYPE_LABEL[c.gameType]}{!c.active ? t("flair.brandFlairTab.desativada") : !c.available ? t("flair.brandFlairTab.fora_do_periodo_estoque") : ""}</p>
              <p className="type-h3">{c.name}</p>
              <p className="flair-coupon">{c.coupon.title} <span>{couponText(c.coupon)}</span></p>
            </div>
            <div className="p-3">
              {c.description && <p className="type-body-sm text-muted mb-2">{c.description}</p>}
              <div className="flex flex-wrap gap-1">
                {c.requiredCategories.map((x) => <Badge key={x}>{CATEGORY_LABEL[x] ?? label(x)}</Badge>)}
                {c.requiredStyles.map((x) => <Badge key={x} tone="thread">{label(x)}</Badge>)}
                {c.requiredOccasions.map((x) => <Badge key={x} tone="chalk">{label(x)}</Badge>)}
                {c.minBrandPieces > 0 && <Badge tone="mark">{t("flair.brandFlairTab.peca_s", { minBrandPieces: c.minBrandPieces, brandName: d.brandName })}</Badge>}
                {c.minDeckPower > 0 && <Badge>{t("flair.brandFlairTab.poder", { minDeckPower: c.minDeckPower })}</Badge>}
                {c.minRarity && <Badge>{c.minRarity}+</Badge>}
                {c.gameType === "DUELO_PATROCINADO" && <Badge tone="thread">{t("flair.brandFlairTab.vitorias_na_semana", { minWins: c.minWins })}</Badge>}
              </div>
              <p className="type-caption text-faint mt-2">{t("flair.brandFlairTab.troca_s_cupom_valido_por", { redeemed: c.redeemed, value: c.stock != null ? t("flair.brandFlairTab.de", { stock: c.stock }) : "", validDays: c.coupon.validDays })}</p>
              {d.admin && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => edit(c)}>{t("common.edit")}</Button><Button size="sm" onClick={() => remove(c)}>{c.redeemed > 0 ? t("common.desativar") : t("common.delete")}</Button></div>}
              {!d.admin && c.redemption && <p className="type-caption mt-2">{rich("flair.brandFlairTab.voce_ja_trocou", { code: c.redemption.code }, { 0: ($c) => <code className="flair-code">{$c}</code> })}</p>}
            </div>
          </Card>))}</div>}
      {d.admin && (d.redemptions?.length ?? 0) > 0 && (
        <Card><h3 className="type-h3 mb-2">{t("common.cupons_emitidos")}</h3>
          <div className="overflow-x-auto"><table className="w-full type-body-sm"><thead><tr className="text-left type-caption text-muted"><th>{t("auth.code")}</th><th>{t("flair.brandFlairTab.pessoa")}</th><th>{t("flair.brandFlairTab.combinacao")}</th><th>Deck</th><th>{t("common.status")}</th><th>{t("flair.brandFlairTab.validade")}</th></tr></thead>
            <tbody>{d.redemptions!.map((r) => <tr key={r.id}><td><code className="flair-code">{r.code}</code></td><td>@{r.user.username}</td><td>{r.combination.name}</td><td>{r.deck ?? "guarda-roupa"}{r.deckPower ? ` (${r.deckPower})` : ""}</td><td><Badge tone={r.status === "USADO" ? "chalk" : r.status === "EMITIDO" ? "thread" : "mark"}>{r.status}</Badge></td><td className="tabular">{new Date(r.expiresAt).toLocaleDateString(currentIntl())}</td></tr>)}</tbody></table></div>
        </Card>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} size="lg" title={form?.id ? t("flair.brandFlairTab.editar_combinacao_flair") : t("flair.brandFlairTab.nova_combinacao_flair")}
        footer={<><Button onClick={() => setForm(null)}>{t("common.cancel")}</Button><Button variant="primary" loading={saving} onClick={save} disabled={!form || form.name.trim().length < 3 || form.couponTitle.trim().length < 3 || !form.discount}>{t("common.save")}</Button></>}>
        {form && <div className="grid gap-3">
          <Field label={t("flair.brandFlairTab.nome_do_jogo")} id="fc-name" required><Input id="fc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t("common.descricao")} id="fc-desc"><Textarea id="fc-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label={t("flair.brandFlairTab.tipo_de_jogo")} id="fc-type"><Select id="fc-type" value={form.gameType} onChange={(e) => setForm({ ...form, gameType: e.target.value })}>{(d.gameTypes ?? []).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select></Field>
          <ChipMultiSelect legend={t("flair.brandFlairTab.categorias_exigidas_cartas")} max={Object.keys(CATEGORY_LABEL).length} options={Object.keys(CATEGORY_LABEL).map((c) => ({ id: c, label: CATEGORY_LABEL[c] }))} value={form.requiredCategories} onChange={(v) => setForm({ ...form, requiredCategories: v })} />
          <ChipMultiSelect legend={t("flair.brandFlairTab.estilos")} max={6} scroll options={(tax?.styles ?? []).map((o) => ({ id: o, label: label(o) }))} value={form.requiredStyles} onChange={(v) => setForm({ ...form, requiredStyles: v })} />
          <ChipMultiSelect legend={t("flair.brandFlairTab.ocasioes")} max={6} scroll options={(tax?.occasions ?? []).map((o) => ({ id: o, label: label(o) }))} value={form.requiredOccasions} onChange={(v) => setForm({ ...form, requiredOccasions: v })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("flair.brandFlairTab.pecas", { brandName: d.brandName })} id="fc-bp"><Input id="fc-bp" type="number" min={0} max={10} value={form.minBrandPieces} onChange={(e) => setForm({ ...form, minBrandPieces: e.target.value })} /></Field>
            <Field label={t("flair.brandFlairTab.poder_minimo_do_deck")} id="fc-pow"><Input id="fc-pow" type="number" min={0} max={1000} value={form.minDeckPower} onChange={(e) => setForm({ ...form, minDeckPower: e.target.value })} /></Field>
            <Field label={t("flair.brandFlairTab.raridade_minima")} id="fc-rar"><Select id="fc-rar" value={form.minRarity} onChange={(e) => setForm({ ...form, minRarity: e.target.value })}><option value="">—</option>{["PREMIUM", "LIMITED", "RARE"].map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
          </div>
          {form.gameType === "DUELO_PATROCINADO" && <Field label={t("flair.brandFlairTab.vitorias_na_semana_com_peca")} id="fc-wins"><Input id="fc-wins" type="number" min={1} max={20} value={form.minWins} onChange={(e) => setForm({ ...form, minWins: e.target.value })} /></Field>}
          <Field label={t("flair.brandFlairTab.cupom_titulo")} id="fc-ct" required><Input id="fc-ct" value={form.couponTitle} onChange={(e) => setForm({ ...form, couponTitle: e.target.value })} placeholder={t("flair.brandFlairTab.n15_na_colecao_alfaiataria")} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("flair.brandFlairTab.desconto")} id="fc-dk"><Select id="fc-dk" value={form.discountKind} onChange={(e) => setForm({ ...form, discountKind: e.target.value as Form["discountKind"] })}><option value="percent">{t("flair.brandFlairTab.do_valor")}</option><option value="amount">{t("flair.brandFlairTab.r_fixo")}</option></Select></Field>
            <Field label={form.discountKind === "percent" ? t("flair.brandFlairTab.percentual_1_90") : t("flair.brandFlairTab.valor_r")} id="fc-dv"><Input id="fc-dv" type="number" min={1} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
            <Field label={t("flair.brandFlairTab.compra_minima_r")} id="fc-mp"><Input id="fc-mp" type="number" min={0} value={form.minPurchase} onChange={(e) => setForm({ ...form, minPurchase: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("flair.brandFlairTab.validade_dias_7_120")} id="fc-vd"><Input id="fc-vd" type="number" min={7} max={120} value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value })} /></Field>
            <Field label={t("flair.brandFlairTab.estoque_de_cupons")} id="fc-st" hint={t("common.vazio_ilimitado")}><Input id="fc-st" type="number" min={1} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
            <Field label={t("common.color")} id="fc-col"><Input id="fc-col" type="color" className="h-10 w-16 p-1" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></Field>
          </div>
          <Field label={t("common.link_da_loja_onde_o")} id="fc-url" hint={t("common.opcional_sem_ele_vale_o")}><Input id="fc-url" type="url" placeholder="https://" value={form.storeUrl} onChange={(e) => setForm({ ...form, storeUrl: e.target.value })} /></Field>
          <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t("flair.brandFlairTab.ativa_visivel_no_flair")} />
        </div>}
      </Dialog>
      <VoucherDialog voucher={validated} onClose={() => setValidated(null)} />
    </div>
  );
}
