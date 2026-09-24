"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, SkeletonGrid, Tabs, Textarea, useToast } from "@/components/ui";
import { SchemeCard, toSealBadges } from "@/components/scheme-card";
import { SealCreator } from "@/components/seal-creator";
import { DEFAULT_DESIGN, SealMedallion, type SealDesign } from "@/components/seal-medallion";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";

interface Seal { id: string; name: string; tier: string; policyText?: string; iconUrl?: string; status: string; available?: boolean; unavailableReason?: string | null; usageCount?: number; usageLimit?: number | null; premium?: boolean; availableFrom?: string | null; availableUntil?: string | null; design?: SealDesign | null; }
interface Promotion { id: string; type: string; title: string; description?: string; rules?: string; discountPercent?: number; status: string; eligible?: boolean; requiredSealId?: string; redemptions?: number; }
interface Profile { user?: UserCard; brand?: Record<string, unknown>; celebrity?: Record<string, unknown>; header: { userId?: string; username?: string; name?: string; slug?: string; logoUrl?: string | null; coverUrl?: string | null; bio?: string | null; storeUrl?: string | null; status?: string; kind?: string; profileType?: string; verified?: boolean; premium?: boolean; following: number; activeSeals: number; viewerFollows: boolean; metrics?: Record<string, number> }; mode?: string; tabs?: ({ id: string; label: string; adminOnly?: boolean } | string)[]; admin?: boolean; store?: { url?: string; hashtag?: string }; [k: string]: unknown; }
const TIERS = ["LOOK", "PECA", "PERFIL"];

export default function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); const { t, fmtDate } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Profile>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}`, { signal, anonymous: !user }), [slug, !!user]);
  const [tab, setTab] = useState("ESQUEMAS_DESTAQUE");
  const ownerId = data?.header?.userId ?? data?.user?.id;
  const seals = useApi<Seal[]>((signal) => api.get(`/api/users/${ownerId}/seals`, { signal, anonymous: !user }), [ownerId, !!user], { enabled: !!ownerId });
  const promos = useApi<Promotion[]>((signal) => api.get(`/api/users/${ownerId}/promotions`, { signal, anonymous: !user }), [ownerId, !!user], { enabled: !!ownerId });
  type SealBadgeSource = NonNullable<Parameters<typeof toSealBadges>[0]>[number];
  type HighlightedPieces = { piece: PieceView; author?: UserCard; schemeId?: string; schemeTitle?: string; seals?: SealBadgeSource[] }[];
  type SavedSchemes = { scheme: SchemeView; author?: UserCard; savedAt?: string }[];
  type SavedPieces = { piece: PieceView; author?: UserCard; snapshot?: boolean; savedAt?: string }[];
  type Catalog = { piece: PieceView; looks: number; neverInLook: boolean }[];
  type Consecrated = { scheme: SchemeView; seals: SealBadgeSource[] }[];
  // Esquemas e peças sempre em abas separadas (RF14/RF22): cada aba carrega um único tipo de conteúdo.
  const tabData = useApi<HighlightedPieces | Catalog | Consecrated | SavedSchemes | SavedPieces>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/tabs/${tab === "LOOKS_CONSAGRADOS" && data?.mode === "ADMINISTRADOR" ? "MEUS_ESQUEMAS" : tab}`, { signal, anonymous: !user }), [slug, tab, !!user, data?.mode], { enabled: ["ESQUEMAS_DESTAQUE", "PECAS_DESTAQUE", "CATALOGO", "LOOKS_CONSAGRADOS", "ESQUEMAS_SALVOS", "PECAS_SALVAS"].includes(tab) && !!data });
  const badges = toSealBadges;
  const emptySeal = { open: false, name: "", tier: "LOOK", policyText: "", usageLimit: "", status: "ACTIVE", availableFrom: "", availableUntil: "", design: DEFAULT_DESIGN as SealDesign };
  const [sealForm, setSealForm] = useState<{ open: boolean; id?: string; name: string; tier: string; policyText: string; usageLimit: string; status: string; availableFrom: string; availableUntil: string; design: SealDesign }>(emptySeal);
  const [promoForm, setPromoForm] = useState<{ open: boolean; id?: string; type: string; title: string; description: string; rules: string; discountPercent: string }>({ open: false, type: "DESCONTO", title: "", description: "", rules: "", discountPercent: "" });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  const admin = data.admin ?? data.mode === "ADMINISTRADOR"; const brand = data.brand ?? data.celebrity ?? {}; const h = data.header;
  const isCeleb = (data.user?.profileType ?? h.profileType ?? h.kind) === "CELEBRIDADE" || h.premium === true || String(h.kind ?? "").toUpperCase().includes("CELEB");
  const owner: UserCard = data.user ?? ({ id: h.userId ?? "", username: h.username ?? h.slug ?? "", displayName: h.name ?? h.username ?? "", avatarUrl: h.logoUrl ?? null, profileType: isCeleb ? "CELEBRIDADE" : "MARCA", verified: h.verified } as unknown as UserCard);
  const tabs = [{ id: "ESQUEMAS_DESTAQUE", label: "Esquemas em destaque" }, { id: "PECAS_DESTAQUE", label: "Peças em destaque" }, { id: "LOOKS_CONSAGRADOS", label: admin ? "Meus looks" : "Looks consagrados" }, { id: "CATALOGO", label: "Catálogo de peças" }, { id: "SELOS", label: `Selos (${seals.data?.length ?? data.header.activeSeals})` }, { id: "PROMOCOES", label: "Promoções" },
    ...(admin ? [{ id: "ESQUEMAS_SALVOS", label: "Esquemas salvos" }, { id: "PECAS_SALVAS", label: "Peças salvas" }, { id: "REVISAO", label: "Revisão de vínculos" }, { id: "METRICAS", label: "Métricas" }] : [])];
  async function follow() { try { if (data!.header.viewerFollows) await api.delete(`/api/users/${ownerId}/followers/me`); else await api.post(`/api/users/${ownerId}/followers`); reload(); } catch (e) { toast.fromError(e); } }
  async function saveSeal() {
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const body = { name: sealForm.name, tier: sealForm.tier, policyText: sealForm.policyText, usageLimit: sealForm.usageLimit ? Number(sealForm.usageLimit) : null, status: sealForm.status, availableFrom: iso(sealForm.availableFrom), availableUntil: iso(sealForm.availableUntil), design: sealForm.design };
    try { if (sealForm.id) await api.put(`/api/seals/${sealForm.id}`, body); else await api.post("/api/seals", body); setSealForm({ ...sealForm, open: false }); toast.success(t("common.saved")); seals.reload(); } catch (e) { toast.fromError(e); }
  }
  async function savePromo() {
    const body = { type: promoForm.type, title: promoForm.title, description: promoForm.description, rules: promoForm.rules, discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : null };
    try { if (promoForm.id) await api.put(`/api/promotions/${promoForm.id}`, body); else await api.post("/api/promotions", body); setPromoForm({ ...promoForm, open: false }); toast.success(t("common.saved")); promos.reload(); } catch (e) { toast.fromError(e); }
  }
  async function redeem(p: Promotion) { try { const r = await api.post<{ code?: string; message?: string }>(`/api/promotions/${p.id}/redemptions`); toast.success(r.message ?? `Código: ${r.code}`); promos.reload(); } catch (e) { toast.fromError(e); } }
  const td = tabData.data;
  // Na troca de aba, o hook ainda guarda os dados da aba anterior por um render: cada aba só lê itens do próprio tipo.
  const only = <T,>(key: "scheme" | "piece") => (Array.isArray(td) ? (td as Record<string, unknown>[]).filter((e) => e && typeof e === "object" && e[key]) : []) as T;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {isCeleb ? <Avatar src={mediaUrl((brand.officialPhotoUrl as string) ?? owner.avatarUrl)} name={owner.displayName} size={72} /> : <BrandLogo name={(brand.brandName as string) ?? owner.displayName} src={brand.logoUrl as string} size={72} />}
        <div className="min-w-0 flex-1"><p className="type-label text-muted">{isCeleb ? "Celebridade" : "Marca"}{owner.verified && " · verificada"}</p><h1 className="type-display">{(brand.brandName as string) ?? (brand.stageName as string) ?? owner.displayName}</h1>
          <p className="type-body text-muted">{(brand.fashionCategory as string) ?? ((brand.areas as string[]) ?? []).join(", ")}{brand.officialHashtag ? ` · #${String(brand.officialHashtag).replace(/^#/, "")}` : ""}</p>
          <p className="mt-1 type-body-sm tabular">{data.header.following} seguidores · {data.header.activeSeals} selos ativos</p></div>
        <div className="flex gap-2">{!admin && user && <Button variant={data.header.viewerFollows ? "default" : "primary"} onClick={follow}><FaiIcon id="SOC-12" size={24} active={data.header.viewerFollows} decorative />{data.header.viewerFollows ? t("lookbook.unfollow") : t("lookbook.follow")}</Button>}{data.store?.url && <a className="btn" href={data.store.url} target="_blank" rel="noreferrer">Loja ↗</a>}{admin && <Link href="/settings" className="btn">{t("common.edit")}</Link>}</div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "ESQUEMAS_DESTAQUE" && (tabData.loading ? <SkeletonGrid /> : only<Consecrated>("scheme").length ? <><p className="type-body-sm text-muted mb-3">Looks de qualquer usuário que conquistaram um selo deste perfil (política do selo + aprovação).</p><div className="grid-looks">{only<Consecrated>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} seals={badges(e.seals)} />)}</div></> : <EmptyState title="Nenhum esquema em destaque ainda." hint="Aparecem aqui os looks que conquistaram um selo deste perfil." />)}
      {tab === "PECAS_DESTAQUE" && (tabData.loading ? <SkeletonGrid /> : only<HighlightedPieces>("piece").length ? <><p className="type-body-sm text-muted mb-3">Peças que compõem os looks com selo deste perfil.</p><div className="grid-cards">{only<HighlightedPieces>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} seals={badges(e.seals)} extra={<span className="caption">no look <Link className="underline" href={`/schemes/${e.schemeId}`}>{e.schemeTitle}</Link>{e.author ? ` · @${e.author.username}` : ""}</span>} />)}</div></> : <EmptyState title="Nenhuma peça em destaque ainda." hint="As peças dos looks com selo deste perfil aparecem aqui." />)}
      {tab === "ESQUEMAS_SALVOS" && admin && (tabData.loading ? <SkeletonGrid /> : only<SavedSchemes>("scheme").length ? <div className="grid-looks">{only<SavedSchemes>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} />)}</div> : <EmptyState title="Nenhum esquema salvo." />)}
      {tab === "PECAS_SALVAS" && admin && (tabData.loading ? <SkeletonGrid /> : only<SavedPieces>("piece").length ? <div className="grid-cards">{only<SavedPieces>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} extra={e.author ? <span className="caption">de @{e.author.username}{e.snapshot ? " · arquivada pelo autor" : ""}</span> : undefined} />)}</div> : <EmptyState title="Nenhuma peça salva." />)}
      {tab === "LOOKS_CONSAGRADOS" && (tabData.loading ? <SkeletonGrid /> : only<Consecrated>("scheme").length ? <div className="grid-looks">{only<Consecrated>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} seals={badges(e.seals)} />)}</div> : <EmptyState title={t("common.empty")} />)}
      {tab === "CATALOGO" && (tabData.loading ? <SkeletonGrid /> : only<Catalog>("piece").length ? <div className="grid-cards">{only<Catalog>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} extra={<span className="caption tabular">{e.looks} looks{e.neverInLook ? " · nunca usada em look" : ""}</span>} />)}</div> : <EmptyState title={t("common.empty")} />)}
      {tab === "SELOS" && (
        <>
          <p className="type-body text-muted mb-3">{admin ? "Só o dono deste perfil cria, edita ou desativa selos. Looks de outros usuários recebem o selo quando o SealBond Matcher detecta compatibilidade com a política e você aprova o vínculo." : "Selos concedidos por este perfil. Para usar um selo, publique um look compatível com a política — a IA sugere o vínculo e a marca revisa."}</p>
          {admin && <Button className="mb-3" variant="primary" onClick={() => setSealForm({ ...emptySeal, open: true })}><FaiIcon id={isCeleb ? "ACT-27" : "ACT-26"} size={24} decorative />Novo selo</Button>}
          {seals.loading ? <SkeletonGrid n={3} h="h-32" /> : (seals.data ?? []).length === 0 ? <EmptyState title="Nenhum selo ainda." /> : <div className="grid-cards">{(seals.data ?? []).map((s) => (
            <Card key={s.id} className={s.premium ? "bg-gradient-to-br from-surface to-surface-3" : ""}>
              <div className="flex items-start gap-3"><SealMedallion design={s.design ?? DEFAULT_DESIGN} size={56} premium={s.premium} title={s.name} /><div className="min-w-0 flex-1"><p className="type-h3">{s.name}</p><p className="type-caption text-muted">{label(s.tier.toLowerCase())} · {s.available ? "disponível" : s.unavailableReason ?? label(s.status.toLowerCase())}</p></div></div>
              {s.policyText && <p className="mt-2 type-body-sm">{s.policyText}</p>}
              <p className="mt-2 type-data text-faint tabular">{s.usageCount ?? 0}{s.usageLimit ? `/${s.usageLimit}` : ""} emissões{(s.availableFrom || s.availableUntil) && <> · válido {s.availableFrom ? `de ${fmtDate(s.availableFrom)}` : ""} {s.availableUntil ? `até ${fmtDate(s.availableUntil)}` : ""}</>}</p>
              {admin && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setSealForm({ open: true, id: s.id, name: s.name, tier: s.tier, policyText: s.policyText ?? "", usageLimit: s.usageLimit?.toString() ?? "", status: s.status, availableFrom: s.availableFrom ? s.availableFrom.slice(0, 16) : "", availableUntil: s.availableUntil ? s.availableUntil.slice(0, 16) : "", design: s.design ?? DEFAULT_DESIGN })}>{t("common.edit")}</Button><Button size="sm" variant="danger" onClick={async () => { try { await api.put(`/api/seals/${s.id}`, { name: s.name, tier: s.tier, policyText: s.policyText, usageLimit: s.usageLimit, availableFrom: s.availableFrom, availableUntil: s.availableUntil, status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }); seals.reload(); } catch (e) { toast.fromError(e); } }}>{s.status === "ACTIVE" ? "Desativar" : "Ativar"}</Button></div>}
            </Card>))}</div>}
        </>
      )}
      {tab === "PROMOCOES" && (
        <>
          {admin && <Button className="mb-3" variant="primary" onClick={() => setPromoForm({ open: true, type: "DESCONTO", title: "", description: "", rules: "", discountPercent: "" })}>Nova promoção</Button>}
          {promos.loading ? <SkeletonGrid n={3} h="h-32" /> : (promos.data ?? []).length === 0 ? <EmptyState title="Nenhuma promoção ativa." /> : <div className="grid-cards">{(promos.data ?? []).map((p) => (
            <Card key={p.id}><Badge tone="chalk">{label(p.type.toLowerCase())}</Badge><p className="type-h3 mt-2">{p.title}</p>{p.description && <p className="type-body-sm text-muted mt-1">{p.description}</p>}{p.discountPercent != null && <p className="hero-number text-3xl mt-2">{p.discountPercent}%</p>}{p.rules && <p className="type-caption text-faint mt-1">{p.rules}</p>}
              <div className="mt-3 flex flex-wrap gap-2">{!admin && user && <Button size="sm" variant="primary" disabled={p.eligible === false} onClick={() => redeem(p)}>{p.eligible === false ? "Precisa do selo" : "Resgatar"}</Button>}{admin && <><Button size="sm" onClick={() => setPromoForm({ open: true, id: p.id, type: p.type, title: p.title, description: p.description ?? "", rules: p.rules ?? "", discountPercent: p.discountPercent?.toString() ?? "" })}>{t("common.edit")}</Button><Select aria-label="status" className="w-auto py-1" value={p.status} onChange={async (e) => { try { await api.put(`/api/promotions/${p.id}/status`, { status: e.target.value }); promos.reload(); } catch (err) { toast.fromError(err); } }}>{["DRAFT", "ACTIVE", "PAUSED", "ENDED"].map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></>}</div></Card>))}</div>}
        </>
      )}
      {tab === "REVISAO" && admin && <ReviewQueue />}
      {tab === "METRICAS" && admin && <IssuerMetrics />}
      <Dialog open={sealForm.open} onClose={() => setSealForm({ ...sealForm, open: false })} title={sealForm.id ? "Editar selo" : "Novo selo"} footer={<Button variant="primary" onClick={saveSeal} disabled={sealForm.name.trim().length < 2}>{t("common.save")}</Button>}>
        <Field label="Nome" id="sname" required><Input id="sname" value={sealForm.name} onChange={(e) => setSealForm({ ...sealForm, name: e.target.value })} /></Field>
        <div className="mb-3"><p className="label mb-1">Desenho do selo (proporções do logo FashionAI)</p><SealCreator value={sealForm.design} onChange={(dd) => setSealForm({ ...sealForm, design: dd })} premium={isCeleb} /></div>
        <Field label="Nível" id="stier"><Select id="stier" value={sealForm.tier} onChange={(e) => setSealForm({ ...sealForm, tier: e.target.value })}>{TIERS.map((x) => <option key={x} value={x}>{label(x.toLowerCase())}</option>)}</Select></Field>
        <Field label="Política / critérios promocionais (a IA usa este texto para detectar looks compatíveis)" id="spolicy"><Textarea id="spolicy" value={sealForm.policyText} onChange={(e) => setSealForm({ ...sealForm, policyText: e.target.value })} maxLength={2000} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Disponível de" id="sfrom" hint="vazio = imediato"><Input id="sfrom" type="datetime-local" value={sealForm.availableFrom} onChange={(e) => setSealForm({ ...sealForm, availableFrom: e.target.value })} /></Field><Field label="até" id="suntil" hint="vazio = sem fim"><Input id="suntil" type="datetime-local" value={sealForm.availableUntil} onChange={(e) => setSealForm({ ...sealForm, availableUntil: e.target.value })} /></Field></div>
        <Field label="Limite de emissões" id="slimit"><Input id="slimit" type="number" min={1} value={sealForm.usageLimit} onChange={(e) => setSealForm({ ...sealForm, usageLimit: e.target.value })} /></Field>
      </Dialog>
      <Dialog open={promoForm.open} onClose={() => setPromoForm({ ...promoForm, open: false })} title={promoForm.id ? "Editar promoção" : "Nova promoção"} footer={<Button variant="primary" onClick={savePromo} disabled={!promoForm.title.trim()}>{t("common.save")}</Button>}>
        <Field label="Tipo" id="ptype"><Select id="ptype" value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value })}>{["DESCONTO", "BRINDE", "ACESSO_ANTECIPADO", "EVENTO"].map((x) => <option key={x} value={x}>{label(x.toLowerCase())}</option>)}</Select></Field>
        <Field label="Título" id="ptitle" required><Input id="ptitle" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} /></Field>
        <Field label="Descrição" id="pdesc"><Textarea id="pdesc" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} /></Field>
        <Field label="Regras" id="prules"><Textarea id="prules" value={promoForm.rules} onChange={(e) => setPromoForm({ ...promoForm, rules: e.target.value })} /></Field>
        <Field label="Desconto (%)" id="pdisc"><Input id="pdisc" type="number" min={0} max={100} value={promoForm.discountPercent} onChange={(e) => setPromoForm({ ...promoForm, discountPercent: e.target.value })} /></Field>
      </Dialog>
    </>
  );
}

function ReviewQueue() {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ id: string; scheme?: SchemeView; requestedBy?: UserCard; seal?: { name: string }; confidence?: number; basis?: string; createdAt?: string }[]>((signal) => api.get("/api/seal-bonds/review-queue", { signal }), []);
  async function decide(id: string, approve: boolean) { try { await api.post(`/api/seal-bonds/${id}/review`, { approve, reason: approve ? null : "Não atende à política do selo." }); reload(); } catch (e) { toast.fromError(e); } }
  if (loading) return <Skeleton className="h-40" />;
  if (!data || data.length === 0) return <EmptyState title="Nenhum vínculo aguardando revisão." />;
  return <ul className="surface divide-y divide-line-soft">{data.map((b) => <li key={b.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="type-body"><b>{b.scheme?.title ?? "look"}</b> por @{b.requestedBy?.username ?? b.scheme?.owner?.username}</p><p className="type-caption text-muted">selo {b.seal?.name ?? ""} · {b.basis ?? ""} {b.confidence != null ? `· confiança ${Math.round(b.confidence * 100)}%` : ""}</p></div>{b.scheme && <Link href={`/schemes/${b.scheme.id}`} className="btn btn-sm">Ver look</Link>}<Button size="sm" variant="primary" onClick={() => decide(b.id, true)}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => decide(b.id, false)}>Rejeitar</Button></li>)}</ul>;
}
function IssuerMetrics() {
  const { data, loading } = useApi<Record<string, unknown>>((signal) => api.get("/api/me/issuer-metrics", { signal }), []);
  if (loading || !data) return <Skeleton className="h-40" />;
  return <div className="grid gap-3 sm:grid-cols-3">{Object.entries(data).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => <Card key={k}><p className="label">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</p><p className="hero-number text-3xl">{String(v)}</p></Card>)}<Link href="/dashboard" className="btn sm:col-span-3">Abrir dashboard do emissor →</Link></div>;
}
