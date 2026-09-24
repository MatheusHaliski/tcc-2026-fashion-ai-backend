"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import { FaiCoupon, type Coupon, type CouponOwner } from "@/components/coupons/fai-coupon";

interface Promo {
  source: "SELO" | "FLAIR"; id: string; title: string; kind: string; detail?: string | null; discount: string; seal?: { id: string; name: string } | null;
  active: boolean; status: string; reason?: string | null; redeemed: number; quota?: number | null; pendingRights: number; startsAt?: string | null; endsAt?: string | null; storeUrl?: string | null;
}
interface Admin { owner: CouponOwner; stats: { issued: number; used: number; pendingRights: number; active: number; useRate: number }; coupons: Coupon[]; promotions: Promo[]; }
interface Seal { id: string; name: string; status?: string; tier?: string; }

export const BRAND_PROMO_TYPES = ["DESCONTO_ECOMMERCE", "CUPOM_LOJA", "FRETE_GRATIS", "BRINDE", "ACESSO_ANTECIPADO", "EVENTO"];
export const CELEB_PROMO_TYPES = [...BRAND_PROMO_TYPES, "SHOW", "MEET_GREET", "PRE_VENDA", "CONTEUDO_EXCLUSIVO"];
const TYPE_LABEL: Record<string, string> = { DESCONTO_ECOMMERCE: "Desconto no e-commerce", CUPOM_LOJA: "Cupom na loja", FRETE_GRATIS: "Frete grátis", BRINDE: "Brinde", ACESSO_ANTECIPADO: "Acesso antecipado", EVENTO: "Evento", SHOW: "Show", MEET_GREET: "Meet & greet", PRE_VENDA: "Pré-venda", CONTEUDO_EXCLUSIVO: "Conteúdo exclusivo", COMBINACAO: "Combinação (deck)", COLECAO: "Coleção (guarda-roupa)", DUELO_PATROCINADO: "Duelo patrocinado" };
const STATUS_LABEL: Record<string, string> = { ATIVA: "Ativa", FORA_DO_PERIODO: "Fora do período", DESATIVADA: "Desativada", REDEEMED: "Esgotada", EXPIRED: "Encerrada", REVOKED: "Revogada" };

/**
 * Card Trello RF38 — aba "Meus cupons promocionais" do perfil de marca ou celebridade: junta os cupons que QUALQUER
 * funcionalidade concede (política de promoção dos selos do RF25 e jogos FLAIR), os direitos conquistados à espera
 * de resgate, a conferência do código no caixa e a sub-aba "Todas as promoções" (ativas, inativas e criar promoção).
 */
export function BrandCouponsTab({ ownerId, celebrity, onCreateFlair }: { ownerId: string; celebrity: boolean; onCreateFlair: () => void }) {
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
    try { if (form.id) await api.put(`/api/promotions/${form.id}`, body); else await api.post("/api/promotions", body); toast.success("Promoção salva — quem tiver o selo será notificado para resgatar."); setForm(empty); admin.reload(); } catch (e) { toast.fromError(e); }
  }
  async function toggleSeal(p: Promo) {
    try { await api.put(`/api/promotions/${p.id}/status`, { status: p.active ? "REVOKED" : "AVAILABLE" }); admin.reload(); } catch (e) { toast.fromError(e); }
  }
  const promos = d.promotions.filter((p) => (promoFilter === "ATIVAS" ? p.active : !p.active));
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="type-caption text-muted">Cupons emitidos</p><p className="type-h2 tabular">{d.stats.issued}</p></Card>
        <Card><p className="type-caption text-muted">Usados na loja</p><p className="type-h2 tabular">{d.stats.used} <span className="type-caption text-muted">({d.stats.useRate}%)</span></p></Card>
        <Card><p className="type-caption text-muted">Conquistados, aguardando resgate</p><p className="type-h2 tabular">{d.stats.pendingRights}</p></Card>
        <Card><p className="type-caption text-muted">Promoções ativas</p><p className="type-h2 tabular">{d.stats.active}</p></Card>
      </div>
      <Tabs tabs={[{ id: "emitidos" as const, label: "Cupons emitidos", count: d.coupons.length }, { id: "promocoes" as const, label: "Todas as promoções", count: d.promotions.length }]} value={sub} onChange={setSub} />

      {sub === "emitidos" && <>
        <Card>
          <p className="label">Conferir código no caixa (selo ou FLAIR)</p>
          <div className="flex flex-wrap gap-2"><Input className="max-w-xs" aria-label="Código do cupom" placeholder="FLR-XXXX-XXXX ou código do selo" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><Button onClick={validate} disabled={code.trim().length < 6}>Validar e marcar como usado</Button></div>
        </Card>
        {d.coupons.length === 0 ? <EmptyState title="Nenhum cupom emitido ainda." hint="Quando alguém conquista uma promoção sua (selo ou jogo FLAIR), recebe a notificação e resgata o cupom — ele aparece aqui." /> :
          <div className="grid gap-4 lg:grid-cols-2">{d.coupons.map((c) => (
            <div key={`${c.source}-${c.id}`}>
              <FaiCoupon coupon={{ ...c, storeUrl: null }} compact />
              <p className="type-caption text-muted mt-1">Resgatado por {c.holder ? `@${c.holder.username}` : "—"}{c.issuedAt ? ` em ${new Date(c.issuedAt).toLocaleDateString("pt-BR")}` : ""}</p>
            </div>))}</div>}
      </>}

      {sub === "promocoes" && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5"><Chip active={promoFilter === "ATIVAS"} onClick={() => setPromoFilter("ATIVAS")}>Ativas ({d.promotions.filter((p) => p.active).length})</Chip><Chip active={promoFilter === "INATIVAS"} onClick={() => setPromoFilter("INATIVAS")}>Inativas ({d.promotions.filter((p) => !p.active).length})</Chip></div>
          <Button variant="primary" onClick={() => setChooser(true)}>Criar promoção</Button>
        </div>
        {promos.length === 0 ? <EmptyState title={promoFilter === "ATIVAS" ? "Nenhuma promoção ativa." : "Nenhuma promoção inativa."} /> :
          <div className="grid gap-3 md:grid-cols-2">{promos.map((p) => (
            <Card key={`${p.source}-${p.id}`}>
              <div className="flex flex-wrap items-center gap-1.5"><Badge tone={p.source === "SELO" ? "chalk" : "thread"}>{p.source === "SELO" ? "Selo · RF25" : "Jogo FLAIR"}</Badge><Badge>{TYPE_LABEL[p.kind] ?? label(p.kind.toLowerCase())}</Badge><Badge tone={p.active ? "thread" : "mark"}>{STATUS_LABEL[p.status] ?? p.status}</Badge></div>
              <p className="type-h3 mt-2">{p.title}</p>
              {p.detail && <p className="type-body-sm text-muted">{p.detail}</p>}
              <p className="type-body-sm mt-1"><b>{p.discount}</b>{p.seal ? ` · exige o selo ${p.seal.name}` : ""}</p>
              <p className="type-caption text-faint mt-1">{p.redeemed} resgate(s){p.quota ? ` de ${p.quota}` : ""} · {p.pendingRights} aguardando resgate{p.endsAt ? ` · até ${new Date(p.endsAt).toLocaleDateString("pt-BR")}` : ""}{p.storeUrl ? " · loja própria do cupom" : ""}</p>
              {p.reason && !p.active && <p className="type-caption text-mark mt-1">{p.reason}</p>}
              <div className="mt-2 flex gap-2">{p.source === "SELO" ? <Button size="sm" onClick={() => toggleSeal(p)}>{p.active ? "Desativar" : "Reativar"}</Button> : <Button size="sm" onClick={onCreateFlair}>Gerenciar no FLAIR</Button>}</div>
            </Card>))}</div>}
      </>}

      <Dialog open={chooser} onClose={() => setChooser(false)} title="Criar promoção">
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="surface p-3 text-left hover:ring-2 hover:ring-thread" onClick={() => { setChooser(false); setForm({ ...empty, open: true, type: "DESCONTO_ECOMMERCE" }); }}>
            <p className="type-h3">Política de promoção do selo</p><p className="type-body-sm text-muted">Formulário do RF25: quem ganhar o seu selo num look conquista o cupom.</p></button>
          <button type="button" className="surface p-3 text-left hover:ring-2 hover:ring-thread" onClick={() => { setChooser(false); onCreateFlair(); }}>
            <p className="type-h3">Jogo FLAIR</p><p className="type-body-sm text-muted">Defina a combinação de cartas (peças e looks) que completa o jogo e vale o cupom.</p></button>
        </div>
      </Dialog>
      <Dialog open={form.open} onClose={() => setForm(empty)} size="lg" title={form.id ? "Editar promoção do selo" : "Nova promoção do selo (RF25)"}
        footer={<><Button onClick={() => setForm(empty)}>Cancelar</Button><Button variant="primary" onClick={savePromo} disabled={form.title.trim().length < 3}>Salvar</Button></>}>
        <div className="grid gap-3">
          <Field label="Selo que libera o cupom" id="pp-seal" hint="Quem ganhar este selo num look recebe a notificação para resgatar."><Select id="pp-seal" value={form.sealId} onChange={(e) => setForm({ ...form, sealId: e.target.value })}><option value="">Qualquer selo ativo meu</option>{(seals.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.status && s.status !== "ACTIVE" ? ` (${s.status})` : ""}</option>)}</Select></Field>
          <Field label="Tipo" id="pp-type"><Select id="pp-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{(celebrity ? CELEB_PROMO_TYPES : BRAND_PROMO_TYPES).map((x) => <option key={x} value={x}>{TYPE_LABEL[x]}</option>)}</Select></Field>
          <Field label="Título do cupom" id="pp-title" required><Input id="pp-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="20% na nova coleção" /></Field>
          <Field label="Descrição" id="pp-desc"><Textarea id="pp-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Desconto (%)" id="pp-pct"><Input id="pp-pct" type="number" min={1} max={90} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>
            <Field label="Estoque total" id="pp-q" hint="vazio = ilimitado"><Input id="pp-q" type="number" min={1} value={form.totalQuota} onChange={(e) => setForm({ ...form, totalQuota: e.target.value })} /></Field>
            <Field label="Por pessoa" id="pp-u"><Input id="pp-u" type="number" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Começa em" id="pp-s"><Input id="pp-s" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
            <Field label="Termina em" id="pp-e"><Input id="pp-e" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
          </div>
          <Field label="Link da loja onde o cupom é usado" id="pp-url" hint="Opcional — sem ele, vale o site cadastrado no perfil."><Input id="pp-url" type="url" placeholder="https://" value={form.storeUrl} onChange={(e) => setForm({ ...form, storeUrl: e.target.value })} /></Field>
          <Field label="Regras" id="pp-rules"><Textarea id="pp-rules" rows={2} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></Field>
        </div>
      </Dialog>
      <Dialog open={!!checked} onClose={() => setChecked(null)} title="Cupom conferido" footer={<Button variant="primary" onClick={() => setChecked(null)}>Fechar</Button>}>
        {checked && <><FaiCoupon coupon={{ ...checked, storeUrl: null }} /><p className="type-caption text-muted mt-2">Marcado como usado{checked.holder ? ` · cliente @${checked.holder.username}` : ""}.</p></>}
      </Dialog>
    </div>
  );
}
